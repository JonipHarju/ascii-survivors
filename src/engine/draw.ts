/**
 * Sprite blitting and a few UI primitives, all clipped to a rect.
 *
 * Everything the game draws in the play field goes through `drawSprite` with
 * the viewport as the clip, so entities half-off the edge render correctly
 * instead of bleeding into the HUD.
 */

import { DEFAULT, mix, type Color } from './color.ts';
import type { Surface } from './surface.ts';
import type { Frame } from '../assets/sprite.ts';

export type Rect = { x: number; y: number; w: number; h: number };

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/**
 * Draw one sprite frame with its anchor cell landing on (sx, sy).
 *
 * `tint`, when given, overrides every glyph's color — used for damage flashes
 * and for silhouetting things the player shouldn't read detail on.
 *
 * `fill`, when given, paints the frame's *transparent* cells instead of skipping
 * them, so the sprite occupies its whole bounding box and nothing already on the
 * field shows through the gaps in it. See `Sprite.opaque`.
 *
 * `lift` mixes every glyph's own colour toward white by that fraction — the hit
 * flash. Unlike `tint` it keeps each character's hue, so a struck enemy brightens
 * without flattening to a white blob (juice.tsv: 1.0 would erase the silhouette).
 * `tint` still wins outright when both are given.
 */
export function drawSprite(
  r: Surface,
  frame: Frame,
  sx: number,
  sy: number,
  clip: Rect,
  tint: Color | null = null,
  bg: Color = DEFAULT,
  fill: Color | null = null,
  lift = 0,
): void {
  const x0 = sx - frame.ox;
  const y0 = sy - frame.oy;

  // Bail early when the whole sprite is outside the clip rect.
  if (x0 + frame.w <= clip.x || y0 + frame.h <= clip.y || x0 >= clip.x + clip.w || y0 >= clip.y + clip.h) {
    return;
  }

  for (let fy = 0; fy < frame.h; fy++) {
    const py = y0 + fy;
    if (py < clip.y || py >= clip.y + clip.h) continue;

    for (let fx = 0; fx < frame.w; fx++) {
      const px = x0 + fx;
      if (px < clip.x || px >= clip.x + clip.w) continue;

      const cell = frame.cells[fy * frame.w + fx];
      if (cell === null || cell === undefined) {
        if (fill !== null) r.set(px, py, ' ', fill, fill);
        continue;
      }

      const fg = tint ?? (lift > 0 ? mix(cell.fg, 0xffffff, lift) : cell.fg);
      r.set(px, py, cell.ch, fg, fill ?? bg);
    }
  }
}

/**
 * Horizontal progress bar built from eighth-blocks, so it moves smoothly.
 *
 * `EIGHTHS[0]` is deliberately absent: a zero-eighths partial cell is not a
 * glyph, it's the track showing through.
 */
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const;

export function drawBar(
  r: Surface,
  x: number,
  y: number,
  w: number,
  fraction: number,
  fg: Color,
  trackFg: Color,
  trackCh = '·',
): void {
  const f = Math.max(0, Math.min(1, fraction));
  const exact = f * w;

  let full = Math.floor(exact);
  let rem = Math.round((exact - full) * 8);

  // Rounding eight eighths up is a whole block, not a ninth eighth. Without this
  // carry, any fraction whose remainder lands at or above 0.9375 indexed one
  // past the end of EIGHTHS, wrote `undefined` into the cell grid, and crashed
  // the renderer on the next flush. The XP bar hit it eventually in every run.
  if (rem >= 8) {
    full += 1;
    rem = 0;
  }

  for (let i = 0; i < w; i++) {
    if (i < full) r.set(x + i, y, '█', fg);
    else if (i === full && rem > 0) r.set(x + i, y, EIGHTHS[rem]!, fg);
    else r.set(x + i, y, trackCh, trackFg);
  }
}

/**
 * `panelImg`, when given (design.md §15.13's GUI-overhaul plumbing): a raster
 * texture stretched to fill `rect`, drawn immediately behind the ASCII
 * border/title — same "raster shadows glyph" convention as every entity row,
 * not a replacement for the border-drawing logic below. Its own bg fill is
 * skipped in that case (left `DEFAULT`) rather than layered on top: `bg`'s
 * buffered fill paints in `flush()`'s background pass, which runs after any
 * immediate `drawImage`, so painting it here would blot out the texture just
 * drawn (the same bug `onTop` fixed for card icons, cards/nova — jane.md
 * [43]/[44] — just the mirror case: there the icon needed to win over the
 * fill, here the texture needs the fill to get out of its way instead). The
 * border/title glyphs still carry `bg` as before — a solid character tile
 * always draws over whatever's behind it regardless, so the selection tint
 * still reads on the frame line even with a texture behind the body.
 */
export function drawBox(
  r: Surface,
  rect: Rect,
  fg: Color,
  bg: Color = DEFAULT,
  title?: string,
  panelImg?: CanvasImageSource,
): void {
  const { x, y, w, h } = rect;
  if (w < 2 || h < 2) return;

  if (panelImg !== undefined) r.drawImage(x + w / 2, y + h / 2, panelImg, w, h);
  const interiorBg = panelImg !== undefined ? DEFAULT : bg;

  if (r.caps.raster) {
    // Owner 15.07 23:31, no ASCII art: the box-drawing border retires on
    // raster. Blank cells still erase whatever field glyphs sit behind the
    // panel (that's what occludes the crowd), the texture shows through the
    // DEFAULT-bg cells, and the frame is a real stroke painted under the text.
    r.fillRect(x, y, w, h, ' ', fg, interiorBg);
    r.panelFrame(x + w / 2, y + h / 2, w, h, fg);
    if (title !== undefined && title.length > 0 && w > title.length + 4) {
      r.text(x + 2, y, ` ${title} `, fg, interiorBg);
    }
    return;
  }

  r.set(x, y, '╭', fg, bg);
  r.set(x + w - 1, y, '╮', fg, bg);
  r.set(x, y + h - 1, '╰', fg, bg);
  r.set(x + w - 1, y + h - 1, '╯', fg, bg);

  for (let i = 1; i < w - 1; i++) {
    r.set(x + i, y, '─', fg, bg);
    r.set(x + i, y + h - 1, '─', fg, bg);
  }
  for (let j = 1; j < h - 1; j++) {
    r.set(x, y + j, '│', fg, bg);
    r.set(x + w - 1, y + j, '│', fg, bg);
    for (let i = 1; i < w - 1; i++) r.set(x + i, y + j, ' ', fg, interiorBg);
  }

  if (title !== undefined && title.length > 0 && w > title.length + 4) {
    r.text(x + 2, y, ` ${title} `, fg, bg);
  }
}

export function textWidth(s: string): number {
  return [...s].length;
}

export function drawCentered(r: Surface, cx: number, y: number, s: string, fg: Color, bg: Color = DEFAULT): void {
  r.text(cx - Math.floor(textWidth(s) / 2), y, s, fg, bg);
}
