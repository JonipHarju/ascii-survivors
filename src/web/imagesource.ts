/**
 * Browser `ImageSource`: preloads a set of paths as `<img>` elements,
 * relative to `baseUrl`. Takes plain paths, not `images.tsv`'s shape
 * specifically — `boot.ts` hands it the union of every table that names a
 * raster file (`images.tsv` *and* `backgrounds.tsv`, and whatever else
 * grows this list later), so one cache serves every raster draw call
 * (`GameView.imageFor` and `GameView.drawBackground` both read through it).
 *
 * Two layers keep this off the ~600MB vendor pack entirely: Jane curates
 * only decided files into the small, tracked `assets/space/` (a few MB —
 * jane.md [34]), and `tools/build.ts`'s `copyReferencedMedia` further copies
 * only the ones a table row actually names into `dist/assets/`, in case
 * `space/` ever holds an alternate nothing currently uses. Either way, these
 * fetch as ordinary static files, not inlined JSON, so loads straggle in
 * over real time; `get()` is deliberately synchronous and never blocks a
 * frame on one. A ship whose image hasn't decoded yet just draws its glyph
 * for a few more frames.
 */

import type { ImageSource } from '../assets/imagesource.ts';

export class WebImageSource implements ImageSource {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly failed = new Set<string>();

  constructor(paths: Iterable<string>, baseUrl: string) {
    const base = baseUrl.replace(/\/$/, '');

    for (const path of paths) {
      if (this.images.has(path)) continue; // several ids/tables can share one file

      const img = new Image();
      img.decoding = 'async';
      img.onerror = () => this.failed.add(path);
      img.src = `${base}/${path.split('/').map(encodeURIComponent).join('/')}`;
      this.images.set(path, img);
    }
  }

  get(path: string): CanvasImageSource | undefined {
    if (this.failed.has(path)) return undefined;
    const img = this.images.get(path);
    if (img === undefined || !img.complete || img.naturalWidth === 0) return undefined;
    return img;
  }
}
