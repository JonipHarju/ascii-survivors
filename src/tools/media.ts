/**
 * Copies the binary media a build actually references, out of Jane's curated
 * `assets/space/` — not the ~600MB vendor pack (`assets/space-assets/`,
 * gitignored, jane.md [34]; a table row must never point there, and this
 * function doesn't care where a row points, it just copies whatever path it
 * finds under `assetsDir`).
 *
 * Even `space/` shouldn't be base64-inlined into `dist/index.html` the way
 * `tools/pack.ts` inlines Jane's `.txt`/`.tsv` text — text compresses and
 * JSON-escapes fine; PNGs and MP3s don't. So raster art and sound ship as
 * ordinary static files under `dist/assets/` instead, filtered down to only
 * what `images.tsv`/`audio.tsv` actually name (in case `space/` ever holds
 * an alternate nothing currently uses) — a copy keyed off those two tables,
 * not `cp -r`.
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { readTableSources } from '../data/gamedata.node.ts';
import { parseImageTable } from '../data/images.ts';
import { parseAudioTable } from '../data/audio.ts';
import { parseBackgroundTable } from '../data/backgrounds.ts';

/** Copy every file `images.tsv`/`audio.tsv`/`backgrounds.tsv` reference from `assetsDir` into `outDir`. Returns the count copied. */
export async function copyReferencedMedia(assetsDir: string, outDir: string): Promise<{ copied: number; failed: string[] }> {
  const tables = await readTableSources(assetsDir);
  const images = parseImageTable(tables.images);
  const audio = parseAudioTable(tables.audio);
  const backgrounds = parseBackgroundTable(tables.backgrounds);

  const paths = new Set<string>();
  for (const e of images.byId.values()) paths.add(e.path);
  for (const e of audio.byId.values()) paths.add(e.path);
  for (const e of backgrounds.byId.values()) paths.add(e.path);

  let copied = 0;
  const failed: string[] = [];
  for (const rel of paths) {
    const parts = rel.split('/');
    const src = join(assetsDir, ...parts);
    const dest = join(outDir, ...parts);
    try {
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      copied++;
    } catch (err) {
      failed.push(`${rel}: ${(err as Error).message}`);
    }
  }
  return { copied, failed };
}
