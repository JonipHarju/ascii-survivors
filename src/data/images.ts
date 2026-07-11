/**
 * Parser for `assets/images.tsv` — the raster-art contract (john.md, the
 * space pivot). Same idea as `glyphs.tsv`: Jane maps an id to content, John
 * parses it, nobody hardcodes a file path in code.
 *
 * An id here is the *same string* `spriteIdFor()` already computes for the
 * ASCII sprite bank (`sprites/player`, `sprites/mobs/ghoul`, `sprites/countess`,
 * ...). That's deliberate: a row in this table shadows the glyph sprite for
 * that id: if the image is mapped and loaded, the ship/mob draws as a raster
 * blit; otherwise the game falls straight back to whatever `sprites/*.txt` (or
 * the placeholder glyph) already draws today. Nothing breaks if this file is
 * empty or missing.
 *
 * Columns: id, path, w, h
 *   id    the sprite id, e.g. `sprites/player`, `sprites/mobs/ghoul`
 *   path  file path, relative to `assets/` — always under `space/`, the
 *         small tracked, curated folder (e.g.
 *         `space/ships/ranger/Galactica_Ranger_A.png`). Never
 *         `space-assets/` — that's the ~600MB vendor drop, gitignored, and
 *         doesn't exist on a fresh checkout or in a build.
 *   w, h  footprint in world units (isotropic wu, same unit `entities.ts`
 *         speeds and radii already use — NOT cells, NOT pixels). Pick these
 *         to match the source image's real pixel aspect ratio, or the blit
 *         stretches it: `drawImage` scales to exactly the box you give it.
 */

import { num, readRows } from './tsv.ts';

export type ImageEntry = {
  readonly id: string;
  readonly path: string;
  readonly w: number;
  readonly h: number;
};

export type ImageTable = {
  readonly byId: ReadonlyMap<string, ImageEntry>;
  readonly warnings: readonly string[];
};

export function parseImageTable(source: string): ImageTable {
  const byId = new Map<string, ImageEntry>();
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const [id, path, wRaw, hRaw] = row.cells;
    const where = `images.tsv:${row.line}`;

    if (id === undefined || id === '' || path === undefined || path === '') {
      warnings.push(`${where}: expected 'id  path  w  h', skipped`);
      continue;
    }

    const w = num(wRaw, 0);
    const h = num(hRaw, 0);
    if (w <= 0 || h <= 0) {
      warnings.push(`${where}: '${id}' has non-positive size ${w}x${h}, skipped`);
      continue;
    }

    byId.set(id, { id, path, w, h });
  }

  return { byId, warnings };
}

export function emptyImageTable(): ImageTable {
  return { byId: new Map(), warnings: [] };
}
