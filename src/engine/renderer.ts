/**
 * Double-buffered cell renderer.
 *
 * We keep two grids of cells. Drawing writes into `back`. On flush we diff
 * `back` against `front` and emit escape codes only for cells that changed,
 * batched into a single write() per frame.
 *
 * Why hand-roll this: a survivors game repaints a dense field of glyphs every
 * frame, but between two frames most cells are identical. Naively repainting
 * 3400 cells with per-cell color escapes is ~40KB/frame of ANSI; the diff plus
 * run-coalescing typically drops that by 10-30x, which is the difference
 * between a smooth 60fps and a terminal that visibly tears.
 */

import { DEFAULT, makeBgEncoder, makeFgEncoder, type Color, type ColorDepth } from './color.ts';
import type { Capabilities, Surface } from './surface.ts';
import { isWide } from './text.ts';

export { isWide };

const ESC = '\x1b[';

export class Renderer implements Surface {
  readonly width: number;
  readonly height: number;

  /** A terminal has none of these: the dark is faked per-cell, glyphs snap to cells. */
  readonly caps: Capabilities = { smoothLight: false, subCell: false, raster: false };

  private readonly size: number;
  private readonly out: NodeJS.WritableStream;

  // Front = what the terminal currently shows. Back = what we're drawing now.
  private frontCh: string[];
  private frontFg: Int32Array;
  private frontBg: Int32Array;
  private backCh: string[];
  private backFg: Int32Array;
  private backBg: Int32Array;

  private readonly encodeFg: (c: Color) => string;
  private readonly encodeBg: (c: Color) => string;
  private readonly mono: boolean;

  /** Set when the terminal resized; forces a full repaint on next flush. */
  private dirtyAll = true;

  constructor(width: number, height: number, depth: ColorDepth, out: NodeJS.WritableStream = process.stdout) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.out = out;

    this.encodeFg = makeFgEncoder(depth);
    this.encodeBg = makeBgEncoder(depth);
    this.mono = depth === 'mono';

    this.frontCh = new Array<string>(this.size).fill(' ');
    this.frontFg = new Int32Array(this.size).fill(DEFAULT);
    this.frontBg = new Int32Array(this.size).fill(DEFAULT);
    this.backCh = new Array<string>(this.size).fill(' ');
    this.backFg = new Int32Array(this.size).fill(DEFAULT);
    this.backBg = new Int32Array(this.size).fill(DEFAULT);
  }

  /** Force the next flush to repaint every cell (after a resize or screen switch). */
  invalidate(): void {
    this.dirtyAll = true;
  }

  /** Clear the back buffer. Call at the top of each frame. */
  clear(bg: Color = DEFAULT): void {
    this.backCh.fill(' ');
    this.backFg.fill(DEFAULT);
    this.backBg.fill(bg);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /**
   * Write one cell. Out-of-bounds writes are silently dropped, which lets
   * callers draw sprites that hang off the edge of the screen without clipping
   * math at every call site.
   */
  set(x: number, y: number, ch: string, fg: Color = DEFAULT, bg: Color = DEFAULT): void {
    // NaN fails every comparison below, so it would slip past a naive bounds
    // check and index the grid with NaN. Reject it explicitly.
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.backCh[i] = ch;
    this.backFg[i] = fg;
    if (bg !== DEFAULT) this.backBg[i] = bg;
  }

  /** No sub-cell precision in a terminal, so we round to the nearest cell. */
  setF(x: number, y: number, ch: string, fg: Color = DEFAULT): void {
    this.set(Math.round(x), Math.round(y), ch, fg);
  }

  /** Terminals can't do a light falloff; GameView dims each cell instead. */
  setLight(): void {}

  /** `caps.raster` is false — callers always have a glyph fallback ready. */
  drawImage(): void {}

  /** `caps.raster` is false — callers always have a glyph fallback ready. */
  dot(): void {}

  /** Recolor a cell without touching its glyph. Used for flashes and tinting. */
  tint(x: number, y: number, fg: Color): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.backFg[y * this.width + x] = fg;
  }

  getChar(x: number, y: number): string {
    if (!this.inBounds(x, y)) return ' ';
    return this.backCh[y * this.width + x]!;
  }

  /** Draw a string left-to-right from (x,y). Clipped at the right edge. */
  text(x: number, y: number, s: string, fg: Color = DEFAULT, bg: Color = DEFAULT): number {
    let cx = x;
    for (const ch of s) {
      if (cx >= this.width) break;
      this.set(cx, y, ch, fg, bg);
      cx += isWide(ch.codePointAt(0)!) ? 2 : 1;
    }
    return cx - x;
  }

  fillRect(x: number, y: number, w: number, h: number, ch: string, fg: Color = DEFAULT, bg: Color = DEFAULT): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) this.set(i, j, ch, fg, bg);
    }
  }

  /**
   * Diff back against front and push the minimal escape sequence to the terminal.
   * Returns the number of bytes written, which the debug HUD reports.
   */
  flush(): number {
    const { width, height } = this;
    let buf = '';

    // Terminal's current SGR state as we walk the grid. `pending` tracks where
    // the cursor is so we can skip the move when we're already there.
    let curFg = DEFAULT;
    let curBg = DEFAULT;
    let cursorX = -1;
    let cursorY = -1;
    let sgrClean = false;

    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const i = row + x;

        // A missing glyph is a bug upstream, but a crash mid-frame drops the
        // player's run. Render a blank and keep going.
        const ch = this.backCh[i] ?? ' ';
        const fg = this.backFg[i]!;
        const bg = this.backBg[i]!;

        if (!this.dirtyAll && ch === this.frontCh[i] && fg === this.frontFg[i] && bg === this.frontBg[i]) {
          continue;
        }

        if (cursorY !== y || cursorX !== x) {
          buf += `${ESC}${y + 1};${x + 1}H`;
          cursorX = x;
          cursorY = y;
        }

        if (!this.mono && (fg !== curFg || bg !== curBg)) {
          // Going back to default for either channel needs a full reset,
          // since there's no "unset just the fg" that all terminals honor.
          if ((fg === DEFAULT && curFg !== DEFAULT) || (bg === DEFAULT && curBg !== DEFAULT)) {
            buf += `${ESC}0m`;
            curFg = DEFAULT;
            curBg = DEFAULT;
            sgrClean = true;
          }
          const parts: string[] = [];
          if (fg !== curFg && fg !== DEFAULT) parts.push(this.encodeFg(fg));
          if (bg !== curBg && bg !== DEFAULT) parts.push(this.encodeBg(bg));
          if (parts.length > 0) {
            buf += `${ESC}${parts.join(';')}m`;
            sgrClean = false;
          }
          curFg = fg;
          curBg = bg;
        }

        buf += ch;
        cursorX += isWide(ch.codePointAt(0)!) ? 2 : 1;

        this.frontCh[i] = ch;
        this.frontFg[i] = fg;
        this.frontBg[i] = bg;
      }
    }

    this.dirtyAll = false;
    if (buf === '') return 0;

    if (!sgrClean) buf += `${ESC}0m`;
    this.out.write(buf);
    return buf.length;
  }
}
