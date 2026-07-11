/**
 * The one interface every renderer implements.
 *
 * The game draws into a grid of character cells and knows nothing else. That
 * lets the terminal backend (ANSI diffing) and the canvas backend (WebGL-free
 * 2D, glyph atlas, real lighting) be swapped without the game noticing.
 *
 * Owner feedback 09.07: move off the terminal to canvas for smoother, richer
 * output. This interface is why that's a new file rather than a rewrite.
 */

import type { Color } from './color.ts';

/** What a given backend can do beyond plain cells. The game adapts to these. */
export type Capabilities = {
  /**
   * True when the backend can render a smooth light falloff itself. The
   * terminal can't — it fakes the dark by dimming each cell's colour — so on a
   * terminal the game does that work and on canvas it hands over a light source.
   */
  readonly smoothLight: boolean;
  /** True when glyphs can be drawn at fractional cell offsets. */
  readonly subCell: boolean;
  /**
   * True when the backend can blit a raster image (`drawImage`), not just
   * glyph cells. The space pivot (owner 11.07 00:03): the terminal can never do
   * this, so callers must always have a glyph/placeholder fallback ready —
   * `drawImage` on a backend without this capability is a documented no-op,
   * not an error.
   */
  readonly raster: boolean;
};

export interface Surface {
  readonly width: number;
  readonly height: number;
  readonly caps: Capabilities;

  /** Reset the back buffer. Call at the top of each frame. */
  clear(bg?: Color): void;

  /** Write one cell. Out-of-bounds writes are dropped, not clipped by callers. */
  set(x: number, y: number, ch: string, fg?: Color, bg?: Color): void;

  /**
   * Write one cell at a fractional position. Backends with `subCell` nudge the
   * glyph by the fraction; the terminal just rounds. Entities use this so they
   * glide on canvas and snap in the terminal, from one call site.
   */
  setF(x: number, y: number, ch: string, fg?: Color): void;

  /** Recolour a cell without touching its glyph. Used for flashes and dimming. */
  tint(x: number, y: number, fg: Color): void;

  getChar(x: number, y: number): string;

  /** Draw a string left-to-right. Returns the columns advanced. */
  text(x: number, y: number, s: string, fg?: Color, bg?: Color): number;

  fillRect(x: number, y: number, w: number, h: number, ch: string, fg?: Color, bg?: Color): void;

  inBounds(x: number, y: number): boolean;

  /** Force a full repaint next flush (after a resize or a screen switch). */
  invalidate(): void;

  /**
   * Place the player's lantern, in cell coordinates. Backends with `smoothLight`
   * render a real falloff; others ignore it. Cleared implicitly by `clear()`.
   */
  setLight(cx: number, cy: number, radius: number): void;

  /**
   * Blit a raster image centered at fractional cell (cx, cy), sized
   * `wCells` x `hCells` (same cell-unit space as everything else — see
   * `render.ts`'s wu -> cell projection). No-op where `caps.raster` is false.
   *
   * Drawn as its own layer, under every glyph (`set`/`setF`/`text`) drawn this
   * frame — ground texture, decals, XP motes, damage numbers, the HUD all sit
   * on top of ship art regardless of call order. That's deliberate for v1: it
   * keeps the things design.md says must stay legible (motes, numbers) legible
   * for free, at the cost of an occasional ground speck drawing over a hull. A
   * real single z-buffer compositor is future work if that seam ever matters.
   *
   * `glow`, when given, is the raster equivalent of the ASCII alphabet's
   * "bright white is reserved to the player" law (design.md §15.3.1,
   * jane.md/design.md §15.7 — a plain raster blit reads as part of the void).
   * A real backend haloes the sprite's own silhouette in that colour, the same
   * shadow-blur mechanism the glyph tile cache already uses for glow.
   */
  drawImage(
    cx: number,
    cy: number,
    img: CanvasImageSource,
    wCells: number,
    hCells: number,
    angle?: number,
    glow?: Color,
  ): void;

  /** Push the frame to the display. Returns bytes written, where meaningful. */
  flush(): number;
}
