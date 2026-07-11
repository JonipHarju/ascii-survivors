/**
 * Canvas backend. Same cell grid the terminal draws, rendered properly.
 *
 * Owner feedback 09.07: "why is it in terminal? ... move to canvas where we can
 * have smoother gameplay and more frame rate ... ASCII art can be made much more
 * impressive nowadays."
 *
 * What this buys over ANSI, none of which the terminal could ever do:
 *
 *  - **No 80x24 ceiling.** The grid is whatever fits the window, so Jane gets a
 *    much bigger canvas and enemies can be multi-cell sprites again.
 *  - **Real light.** The terminal fakes the lantern by dimming each cell's
 *    colour to grey. Here it's a radial falloff composited over the frame, so
 *    the dark is a gradient rather than a threshold.
 *  - **Sub-cell motion.** Entities are drawn at fractional cell offsets, so a
 *    ghoul crossing a cell boundary glides instead of teleporting. At 20 wu/s
 *    the terminal quantizes that to 20 discrete jumps a second; we don't.
 *  - **Glow.** Bright glyphs get a baked shadow blur, which is what makes ASCII
 *    read as *lit* rather than as text.
 *
 * Performance: glyphs are cached per (character, colour) into small offscreen
 * canvases, so a frame is N `drawImage` calls with no text shaping at all.
 */

import { DEFAULT, type Color } from '../engine/color.ts';
import { isWide } from '../engine/text.ts';
import type { Capabilities, Surface } from '../engine/surface.ts';

/** A cell is twice as tall as it is wide, exactly like a terminal (design §5). */
export const CELL_ASPECT = 2;

export type CanvasOptions = {
  /** Width of one cell in CSS pixels. Height is `cellWidth * CELL_ASPECT`. */
  cellWidth: number;
  fontFamily: string;
  /** Glow radius in pixels, baked into the glyph cache. 0 disables it. */
  glow: number;
  background: Color;
  /**
   * The box to fit the grid into, in CSS pixels.
   *
   * Deliberately *not* the canvas's own size: we set that from the grid we
   * compute, so measuring it would be a feedback loop. It defaults to the
   * viewport.
   */
  measure: () => { width: number; height: number };
  /** Grid bounds in cells. Below the minimum we scale; above the max we stop. */
  minCols: number;
  minRows: number;
  maxCols: number;
  maxRows: number;
};

/** The field the game is designed around (jane.md). Never show more world. */
export const GRID_MIN_COLS = 120;
export const GRID_MIN_ROWS = 40;
export const GRID_MAX_COLS = 180;
export const GRID_MAX_ROWS = 60;

export const DEFAULT_OPTIONS: CanvasOptions = {
  cellWidth: 12,
  fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace',
  glow: 6,
  background: 0x07070a,
  measure: () => ({ width: window.innerWidth, height: window.innerHeight }),
  minCols: GRID_MIN_COLS,
  minRows: GRID_MIN_ROWS,
  maxCols: GRID_MAX_COLS,
  maxRows: GRID_MAX_ROWS,
};

type Light = { cx: number; cy: number; radius: number } | null;

function css(c: Color): string {
  return `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
}

export class CanvasSurface implements Surface {
  readonly caps: Capabilities = { smoothLight: true, subCell: true, raster: true };

  width = 0;
  height = 0;

  /** Mutable: we shrink the cell to fit the minimum grid into a small window. */
  cellW: number;
  cellH: number;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: CanvasOptions;
  private dpr = 1;

  // Cell buffers. `ox`/`oy` are sub-cell offsets in cells, for smooth motion.
  private ch: string[] = [];
  private fg: Int32Array = new Int32Array(0);
  private bg: Int32Array = new Int32Array(0);
  private ox: Float32Array = new Float32Array(0);
  private oy: Float32Array = new Float32Array(0);

  private light: Light = null;

  /** (glyph, colour) -> pre-rendered tile. Bounded; the game uses few combos. */
  private glyphCache = new Map<string, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement, opts: Partial<CanvasOptions> = {}) {
    this.canvas = canvas;
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    this.cellW = this.opts.cellWidth;
    this.cellH = this.opts.cellWidth * CELL_ASPECT;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (ctx === null) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;

    this.resize();
  }

  /**
   * Refit the grid. Returns true if the grid dimensions changed.
   *
   * jane.md: "Min 120x40; below that scale the canvas, don't show less world."
   * So a small window shrinks the cell until the minimum grid fits, and a large
   * one stops growing the grid at 180x60 rather than revealing more graveyard.
   *
   * Note the two independent outputs: the **grid** (cols x rows) and the **cell
   * size**. Resizing the window usually changes only the second one — the grid
   * pins at 120x40 across most of the useful range — and the canvas element is
   * sized in pixels, so it has to follow `cellW`, not the grid. Skipping the
   * element resize because "the grid didn't change" leaves the game drawing a
   * bigger cell into a smaller canvas: the bottom row and the right-hand columns
   * fall off the edge, taking the XP bar and the kill counter with them.
   */
  resize(): boolean {
    const prevDpr = this.dpr;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);

    const { width: cssW, height: cssH } = this.opts.measure();
    const base = this.opts.cellWidth;

    let cellW = base;
    let cols = Math.floor(cssW / cellW);
    let rows = Math.floor(cssH / (cellW * CELL_ASPECT));

    const { minCols, minRows, maxCols, maxRows } = this.opts;
    if (cols < minCols || rows < minRows) {
      // Too small for the designed field: scale the cell, keep the world.
      const scale = Math.min(cssW / (minCols * base), cssH / (minRows * base * CELL_ASPECT));
      cellW = Math.max(2, base * scale);
      cols = minCols;
      rows = minRows;
    } else {
      cols = Math.min(cols, maxCols);
      rows = Math.min(rows, maxRows);
    }

    const gridChanged = cols !== this.width || rows !== this.height;
    const metricsChanged = cellW !== this.cellW || this.dpr !== prevDpr;
    if (!gridChanged && !metricsChanged) return false;

    this.cellW = cellW;
    this.cellH = cellW * CELL_ASPECT;
    this.width = cols;
    this.height = rows;

    this.canvas.width = Math.round(cols * this.cellW * this.dpr);
    this.canvas.height = Math.round(rows * this.cellH * this.dpr);
    this.canvas.style.width = `${Math.round(cols * this.cellW)}px`;
    this.canvas.style.height = `${Math.round(rows * this.cellH)}px`;

    // Only the grid dimensions govern the buffers. A cell that merely changed
    // size keeps the frame that's already in them, so a resize doesn't flicker.
    if (gridChanged) {
      const size = cols * rows;
      this.ch = new Array<string>(size).fill(' ');
      this.fg = new Int32Array(size).fill(DEFAULT);
      this.bg = new Int32Array(size).fill(DEFAULT);
      this.ox = new Float32Array(size);
      this.oy = new Float32Array(size);
    }

    // Tiles are rasterized for one cell size at one DPR. Both just moved.
    this.glyphCache.clear();
    return gridChanged;
  }

  invalidate(): void {
    // The canvas repaints in full every frame, so there is nothing to dirty.
  }

  clear(bg: Color = DEFAULT): void {
    this.ch.fill(' ');
    this.fg.fill(DEFAULT);
    this.bg.fill(bg);
    this.ox.fill(0);
    this.oy.fill(0);
    this.light = null;

    // Paint the flat backdrop immediately, not in flush(). drawImage() below is
    // an immediate draw too — GameView calls it between clear() and flush(), and
    // if flush() re-painted the backdrop it would erase every ship drawn this
    // frame. Everything drawn via set()/setF() stays double-buffered and is
    // flushed on top of the images, same as always (see drawImage's doc comment
    // on Surface — that ordering is deliberate).
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.fillStyle = css(this.opts.background);
    this.ctx.fillRect(0, 0, this.width * this.cellW, this.height * this.cellH);
  }

  /**
   * Blit a raster image. Immediate, not buffered — see `clear()`. `angle` is
   * radians, 0 = the image's own "up"; unused by any caller yet (v1 ships don't
   * turn to face their heading), kept so that's additive later, not a signature
   * break.
   *
   * `glow`: same shadow-blur trick `tile()` bakes into every glyph, applied
   * live instead of pre-baked (a player-only call, once a frame, so baking it
   * into a cache buys nothing). `ctx.shadowBlur` haloes whatever `drawImage`
   * paints using that draw's own alpha silhouette — free rim-light on a PNG.
   */
  drawImage(
    cx: number,
    cy: number,
    img: CanvasImageSource,
    wCells: number,
    hCells: number,
    angle = 0,
    glow?: Color,
  ): void {
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
    const { ctx, cellW, cellH } = this;
    const px = cx * cellW;
    const py = cy * cellH;
    const w = wCells * cellW;
    const h = hCells * cellH;

    // Fast path: no state to restore, so no save()/restore() — a background
    // tiles dozens of these a frame with neither, and shadowBlur/an extra
    // matrix push is real per-call cost multiplied by "dozens."
    if (angle === 0 && glow === undefined) {
      ctx.drawImage(img, px - w / 2, py - h / 2, w, h);
      return;
    }

    ctx.save();
    if (glow !== undefined) {
      ctx.shadowColor = css(glow);
      ctx.shadowBlur = cellW * 1.4;
    }
    if (angle === 0) {
      ctx.drawImage(img, px - w / 2, py - h / 2, w, h);
    } else {
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, ch: string, fg: Color = DEFAULT, bg: Color = DEFAULT): void {
    // NaN fails every comparison below; reject it before it indexes the grid.
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.ch[i] = ch;
    this.fg[i] = fg;
    this.ox[i] = 0;
    this.oy[i] = 0;
    if (bg !== DEFAULT) this.bg[i] = bg;
  }

  /** Keep the fractional remainder so the glyph can be nudged inside its cell. */
  setF(x: number, y: number, ch: string, fg: Color = DEFAULT): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return;
    const i = cy * this.width + cx;
    this.ch[i] = ch;
    this.fg[i] = fg;
    this.ox[i] = x - cx;
    this.oy[i] = y - cy;
  }

  tint(x: number, y: number, fg: Color): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.fg[y * this.width + x] = fg;
  }

  getChar(x: number, y: number): string {
    if (!this.inBounds(x, y)) return ' ';
    return this.ch[y * this.width + x]!;
  }

  text(x: number, y: number, s: string, fg: Color = DEFAULT, bg: Color = DEFAULT): number {
    let cx = x;
    for (const c of s) {
      if (cx >= this.width) break;
      this.set(cx, y, c, fg, bg);
      cx += isWide(c.codePointAt(0)!) ? 2 : 1;
    }
    return cx - x;
  }

  fillRect(x: number, y: number, w: number, h: number, ch: string, fg: Color = DEFAULT, bg: Color = DEFAULT): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) this.set(i, j, ch, fg, bg);
    }
  }

  setLight(cx: number, cy: number, radius: number): void {
    this.light = { cx, cy, radius };
  }

  // ---------------------------------------------------------------- painting

  /** Rasterize one glyph in one colour, once, with its glow baked in. */
  private tile(ch: string, color: Color): HTMLCanvasElement {
    const key = `${ch} ${color}`;
    const hit = this.glyphCache.get(key);
    if (hit !== undefined) return hit;

    const pad = this.opts.glow;
    const tile = document.createElement('canvas');
    tile.width = Math.ceil((this.cellW + pad * 2) * this.dpr);
    tile.height = Math.ceil((this.cellH + pad * 2) * this.dpr);

    const c = tile.getContext('2d')!;
    c.scale(this.dpr, this.dpr);
    c.font = `${Math.round(this.cellH * 0.78)}px ${this.opts.fontFamily}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    const fill = css(color);
    if (this.opts.glow > 0) {
      // The glow is what makes a grid of characters read as lit rather than as
      // a page of text. Brighter glyphs bloom more.
      c.shadowColor = fill;
      c.shadowBlur = this.opts.glow * (luminance(color) * 0.8 + 0.2);
    }
    c.fillStyle = fill;
    c.fillText(ch, pad + this.cellW / 2, pad + this.cellH / 2);

    // Bound the cache; the game realistically uses a few hundred combinations.
    if (this.glyphCache.size > 4096) this.glyphCache.clear();
    this.glyphCache.set(key, tile);
    return tile;
  }

  flush(): number {
    const { ctx, width, height, cellW, cellH } = this;

    // The flat backdrop is already on the canvas — clear() paints it immediately
    // so drawImage() calls made during render() land on top of it, not under it.

    // Backgrounds first, coalesced into horizontal runs of one colour.
    for (let y = 0; y < height; y++) {
      let run = -1;
      let runBg = DEFAULT;
      for (let x = 0; x <= width; x++) {
        const b = x < width ? this.bg[y * width + x]! : DEFAULT;
        if (b !== runBg) {
          if (runBg !== DEFAULT && run >= 0) {
            ctx.fillStyle = css(runBg);
            ctx.fillRect(run * cellW, y * cellH, (x - run) * cellW, cellH);
          }
          run = x;
          runBg = b;
        }
      }
    }

    const pad = this.opts.glow;
    let drawn = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const ch = this.ch[i] ?? ' ';
        if (ch === ' ') continue;

        const fg = this.fg[i]!;
        const tile = this.tile(ch, fg === DEFAULT ? 0xc7c7c7 : fg);
        ctx.drawImage(
          tile,
          (x + this.ox[i]!) * cellW - pad,
          (y + this.oy[i]!) * cellH - pad,
          cellW + pad * 2,
          cellH + pad * 2,
        );
        drawn++;
      }
    }

    this.paintLight();
    return drawn;
  }

  /**
   * The dark, as a gradient rather than a threshold. The lantern radius arrives
   * in columns; a cell is twice as tall as it is wide, so an ellipse in cells is
   * a circle in pixels — which is the whole point of the wu system.
   */
  private paintLight(): void {
    const l = this.light;
    if (l === null) return;

    const { ctx, width, height, cellW, cellH } = this;
    const px = (l.cx + 0.5) * cellW;
    const py = (l.cy + 0.5) * cellH;
    const rPx = l.radius * cellW;

    // design.md §9: "dim, not hidden ... you always see the swarm coming.
    // Nothing that can kill you is ever invisible." So the falloff bottoms out
    // well short of black — a bright enemy at the screen edge stays readable.
    const g = ctx.createRadialGradient(px, py, rPx * 0.4, px, py, rPx * 2.4);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width * cellW, height * cellH);
  }
}

/** Rough perceptual brightness in 0..1, used to scale the glow. */
function luminance(c: Color): number {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
