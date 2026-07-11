/**
 * Parser for `assets/backgrounds.tsv` — the field's own backdrop.
 *
 * design.md §15.7 point 2: this is deliberately its own table, not another
 * `images.tsv` row. A background isn't a positioned entity — it has to tile
 * to cover a viewport of any size, and it can drift slower than the world
 * scrolls under it (parallax) rather than being pinned to a world position.
 * `images.tsv`'s shape (one id -> one wu-sized sprite at a world point) is
 * right for a ship; it's the wrong shape for this.
 *
 * Columns: id, path, parallax, tileWu
 *   id        which backdrop — `field` is the only one `GameView` looks up
 *             today. Room to add e.g. `dusk` later (the boss's phase-3
 *             blackout, countess.tsv) without a new table.
 *   path      relative to `assets/`, always under `space/` — same rule as
 *             `images.tsv`.
 *   parallax  0..1. 0 = pinned to the screen, never moves. 1 = scrolls
 *             exactly with the world, like a positioned sprite. A starfield
 *             reads as *distant* somewhere well under 1 — it drifts, but
 *             slower than anything you're actually flying past.
 *   tileWu    the image's edge length in world units, isotropic. The image
 *             repeats at this spacing to cover however big the field gets;
 *             pick it to match how dense the source PNG's own starfield is.
 */

import { num, readRows } from './tsv.ts';

export type BackgroundEntry = {
  readonly id: string;
  readonly path: string;
  readonly parallax: number;
  readonly tileWu: number;
};

export type BackgroundTable = {
  readonly byId: ReadonlyMap<string, BackgroundEntry>;
  readonly warnings: readonly string[];
};

export function parseBackgroundTable(source: string): BackgroundTable {
  const byId = new Map<string, BackgroundEntry>();
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const [id, path, parallaxRaw, tileWuRaw] = row.cells;
    const where = `backgrounds.tsv:${row.line}`;

    if (id === undefined || id === '' || path === undefined || path === '') {
      warnings.push(`${where}: expected 'id  path  parallax  tileWu', skipped`);
      continue;
    }

    const tileWu = num(tileWuRaw, 0);
    if (tileWu <= 0) {
      warnings.push(`${where}: '${id}' has a non-positive tileWu, skipped`);
      continue;
    }

    byId.set(id, {
      id,
      path,
      parallax: Math.max(0, Math.min(1, num(parallaxRaw, 1))),
      tileWu,
    });
  }

  return { byId, warnings };
}

export function emptyBackgroundTable(): BackgroundTable {
  return { byId: new Map(), warnings: [] };
}
