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
   *
   * `onTop`, when true, inverts the default: the image paints *over* every
   * buffered glyph/background fill this frame instead of under it. For a
   * field entity that's wrong (see above); for screen-space UI like a
   * level-up card, it's backwards otherwise — `drawBox`'s own background
   * fill is a buffered `set()` call and, being buffered, always wins over an
   * immediate `drawImage` regardless of which one the caller made first
   * (jane.md [43]/[44], design.md §15.10). Use it when the raster art is
   * meant to sit in front of a UI panel's own background, never on the
   * field.
   */
  drawImage(
    cx: number,
    cy: number,
    img: CanvasImageSource,
    wCells: number,
    hCells: number,
    angle?: number,
    glow?: Color,
    onTop?: boolean,
  ): void;

  /**
   * A small, textureless glow — a filled ellipse, `color` at full `alpha` in
   * the centre fading radially to 0 at the rim. design.md §16.2a: the raster
   * pivot's small ambient particles (thrust, embers, sparks) don't need a
   * texture, just to stop being monospace glyphs next to a smoothly-rotating
   * raster ship.
   *
   * `rx`/`ry` are cell-space, the SAME ellipse convention every circular AoE
   * in this codebase already reduces to (render.ts's own header comment: a
   * column is 1 wu, a row is `WU_PER_ROW` wu, so an isotropic wu circle is
   * `rx = r, ry = r / WU_PER_ROW` once expressed in cells) — a backend that
   * scales `rx` by its own cell width and `ry` by its own cell height gets a
   * true circle in pixels for free, no extra correction needed. `alpha` is
   * the CENTRE opacity (0..1); it fades to 0 at the rim regardless — callers
   * still control temporal fade (age, cooling) by varying `color`/`alpha`
   * frame to frame, same as they always did.
   *
   * Deferred, not immediate like `drawImage`: painted at `flush()`, after
   * every buffered glyph AND every immediate `drawImage` call made this
   * frame, so a dot spawned early in `render()` (thrust/embers/sparks all
   * draw before the player and the enemies) still reads on top of a raster
   * ship painted later in the same frame instead of vanishing under it.
   * No-op where `caps.raster` is false, same contract as `drawImage` —
   * callers keep a glyph fallback ready.
   */
  dot(cx: number, cy: number, rx: number, ry: number, color: Color, alpha: number): void;

  /**
   * A translucent, softly glowing filled rectangle in cell space. Deferred with
   * `dot()` so area weapons paint over raster actors instead of disappearing
   * beneath them. No-op on non-raster backends; callers keep their glyph fill.
   */
  glowRect(cx: number, cy: number, w: number, h: number, color: Color, alpha: number): void;

  /**
   * A translucent glowing ellipse outline in cell space. `rx`/`ry` follow the
   * same wu-correct convention as `dot()`; `thickness` is measured in cells.
   */
  glowRing(cx: number, cy: number, rx: number, ry: number, thickness: number, color: Color, alpha: number): void;

  /**
   * Real display typography — a heading drawn at `hCells` rows tall, centred
   * on (cx, cy) in cell space. design.md §16.9: screen headings become canvas
   * display text (bold, tightly tracked) instead of ASCII block-letter
   * banners; body copy stays ordinary `text()` cells.
   *
   * Deferred on the canvas (painted at the very end of `flush()`, above
   * every glyph, image and primitive) so a heading can sit over its own
   * screen's accent art regardless of call order. No-op where `caps.raster`
   * is false — the terminal keeps Jane's `.txt` banners, per §16.9's own
   * ruling ("the terminal is allowed to look like a terminal"), so callers
   * branch on `caps.raster` rather than expecting a fallback here.
   */
  displayText(
    cx: number,
    cy: number,
    text: string,
    hCells: number,
    color: Color,
    opts?: { weight?: number; trackingEm?: number; alpha?: number; glow?: Color },
  ): void;

  /** Push the frame to the display. Returns bytes written, where meaningful. */
  flush(): number;
}
