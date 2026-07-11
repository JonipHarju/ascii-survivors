/**
 * Browser `ImageSource`: preloads every path `images.tsv` references as an
 * `<img>`, relative to `baseUrl`.
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

import type { ImageTable } from '../data/images.ts';
import type { ImageSource } from '../assets/imagesource.ts';

export class WebImageSource implements ImageSource {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly failed = new Set<string>();

  constructor(table: ImageTable, baseUrl: string) {
    const base = baseUrl.replace(/\/$/, '');
    const requested = new Set<string>();

    for (const entry of table.byId.values()) {
      if (requested.has(entry.path)) continue; // several ids can share one file
      requested.add(entry.path);

      const img = new Image();
      img.decoding = 'async';
      img.onerror = () => this.failed.add(entry.path);
      img.src = `${base}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
      this.images.set(entry.path, img);
    }
  }

  get(path: string): CanvasImageSource | undefined {
    if (this.failed.has(path)) return undefined;
    const img = this.images.get(path);
    if (img === undefined || !img.complete || img.naturalWidth === 0) return undefined;
    return img;
  }
}
