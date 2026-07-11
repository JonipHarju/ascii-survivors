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

import type { ImageEntry, ImageTable } from '../data/images.ts';

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

export type ResolvedImage = { readonly entry: ImageEntry; readonly img: CanvasImageSource };

/**
 * `id` -> table row -> loaded pixels, in one call. Null the instant any link
 * is missing (no row, or the image hasn't decoded yet) — every caller
 * (`GameView.imageFor`, `App.drawCardArt`) treats that as "draw the glyph
 * fallback instead," never as an error.
 *
 * Deliberately returns the raw `ImageEntry`, not a cells-converted size: a
 * world entity's `w`/`h` are wu and need `/ WU_PER_ROW` on the height (see
 * `GameView.imageFor`); a `cards/*` icon is screen-space UI with no world to
 * be isotropic *in*, so its `w`/`h` are cells, used as-is (see
 * `App.drawCardArt`). One table, two id namespaces, two unit conventions —
 * this function doesn't pick one, its callers do.
 */
export function resolveImage(source: ImageSource, table: ImageTable, id: string): ResolvedImage | null {
  const entry = table.byId.get(id);
  if (entry === undefined) return null;
  const img = source.get(entry.path);
  if (img === undefined) return null;
  return { entry, img };
}
