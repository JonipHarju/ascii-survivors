/**
 * Where `drawImage`'s pixels come from. Platform-agnostic on purpose — same
 * split as `SpriteBank`/`SpriteLoader`: this file (and everything that imports
 * it) has to stay importable from Node, because `App`/`GameView` run in the
 * terminal build too. The real loader (`Image()`, `document`) lives in
 * `web/imagesource.ts`; the terminal never constructs one.
 *
 * Same rule as a missing sprite: a missing or not-yet-loaded image is never an
 * error. `get()` returns `undefined` and the caller draws the glyph fallback
 * instead — Jane's images.tsv rows and John's sprite art can be finished on
 * different days without either of us blocking on the other.
 */

export interface ImageSource {
  /**
   * A ready-to-blit image for `path`, or `undefined` if it hasn't finished
   * loading (or failed, or was never requested). Synchronous and non-blocking
   * — never await inside a render call.
   */
  get(path: string): CanvasImageSource | undefined;
}

/** The terminal's `ImageSource`: nothing ever loads, so `caps.raster` being
 * false is the only guard that actually matters — this just makes the type
 * satisfiable without a DOM. */
export const NULL_IMAGE_SOURCE: ImageSource = {
  get: () => undefined,
};
