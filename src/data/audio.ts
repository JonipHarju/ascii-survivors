/**
 * Parser for `assets/audio.tsv` — sound effect and music contract (john.md,
 * owner 11.07 00:03: "there are no sounds and that makes the game unfun").
 *
 * An id is whatever `World.sfx` events and `App`'s music cue push (see
 * `game/world.ts` and `game/app.ts`) — a handful of fixed strings like `hit`,
 * `kill`, `pickup`, `levelup`, `hurt`, `death`, `music/theme`. A row with no
 * matching id is inert; an id with no row is silent. Missing sound is never a
 * bug the way a missing sprite isn't — the game plays fine without a table.
 *
 * Columns: id, path, volume, loop
 *   id      event name (see above)
 *   path    file path, relative to `assets/` — always under `space/audio/`,
 *           the small tracked, curated folder (e.g.
 *           `space/audio/DeepSpaceA.mp3`). Never `space-assets/` — the
 *           ~600MB vendor drop, gitignored, absent from a fresh checkout.
 *   volume  0..1, blank/`-` means 1
 *   loop    `1`/`true` for music beds; blank/`-`/`0` means a one-shot
 */

import { num, readRows } from './tsv.ts';

export type AudioEntry = {
  readonly id: string;
  readonly path: string;
  readonly volume: number;
  readonly loop: boolean;
};

export type AudioTable = {
  readonly byId: ReadonlyMap<string, AudioEntry>;
  readonly warnings: readonly string[];
};

export function parseAudioTable(source: string): AudioTable {
  const byId = new Map<string, AudioEntry>();
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const [id, path, volRaw, loopRaw] = row.cells;
    const where = `audio.tsv:${row.line}`;

    if (id === undefined || id === '' || path === undefined || path === '') {
      warnings.push(`${where}: expected 'id  path  volume  loop', skipped`);
      continue;
    }

    const volume = Math.max(0, Math.min(1, num(volRaw, 1)));
    const loop = /^(1|true|yes)$/i.test((loopRaw ?? '').trim());

    byId.set(id, { id, path, volume, loop });
  }

  return { byId, warnings };
}

export function emptyAudioTable(): AudioTable {
  return { byId: new Map(), warnings: [] };
}
