/**
 * Sprite blitting and a few UI primitives, all clipped to a rect.
 *
 * Everything the game draws in the play field goes through `drawSprite` with
 * the viewport as the clip, so entities half-off the edge render correctly
 * instead of bleeding into the HUD.
 */

import { DEFAULT, type Color } from './color.ts';
import type { Surface } from './surface.ts';
import type { Frame } from '../assets/sprite.ts';

export type Rect = { x: number; y: number; w: number; h: number };

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/**
 * Draw one sprite frame with its anchor cell landing on (sx, sy).
 * `tint`, when given, overrides every glyph's color — used for damage flashes
 * and for silhouetting things the player shouldn't read detail on.
 */
export function drawSprite(
  r: Surface,
  frame: Frame,
  sx: number,
  sy: number,
  clip: Rect,
  tint: Color | null = null,
  bg: Color = DEFAULT,
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
      const cell = frame.cells[fy * frame.w + fx];
      if (cell === null || cell === undefined) continue;

      const px = x0 + fx;
      if (px < clip.x || px >= clip.x + clip.w) continue;

      r.set(px, py, cell.ch, tint ?? cell.fg, bg);
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

export function drawBox(r: Surface, rect: Rect, fg: Color, bg: Color = DEFAULT, title?: string): void {
  const { x, y, w, h } = rect;
  if (w < 2 || h < 2) return;

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
    for (let i = 1; i < w - 1; i++) r.set(x + i, y + j, ' ', fg, bg);
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
