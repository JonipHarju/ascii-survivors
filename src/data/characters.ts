/**
 * `assets/characters.tsv` — the playable characters.
 *
 * Jane's rule, written at the top of that file: **no starting weapon may require
 * aiming.** The Chain used to be the Warden's opener; it fires along your facing,
 * facing came from your last horizontal input, so hitting a thing meant walking
 * toward it in a game where things hurt you by touching you. Nova seeks, Cinder
 * Trail drops behind you, Ion Wisp orbits. Directional weapons are chosen,
 * never given.
 *
 * Which is why the starting weapon lives here and not in a constant in world.ts.
 */

import { num, readRows } from './tsv.ts';

export type CharacterDef = {
  readonly id: string;
  readonly name: string;
  /** Sprite id, e.g. `sprites/player`. */
  readonly sprite: string;
  readonly startWeapon: string;
  /** Absolute, unlike the rest. */
  readonly hp: number;
  readonly move: number;
  readonly area: number;
  readonly luck: number;
  readonly gold: number;
  /** Gold cost at The Crossroads. 0 = available from the start. */
  readonly unlock: number;
  readonly note: string;
};

export type CharacterTable = {
  readonly byId: ReadonlyMap<string, CharacterDef>;
  /** Declaration order; the first free character is the default. */
  readonly order: readonly string[];
  readonly warnings: readonly string[];
};

export function parseCharacters(source: string): CharacterTable {
  const byId = new Map<string, CharacterDef>();
  const order: string[] = [];
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const f = row.cells;
    if (f.length < 10) {
      warnings.push(`characters.tsv:${row.line}: expected >=10 columns, got ${f.length}`);
      continue;
    }

    const id = f[0]!;
    byId.set(id, {
      id,
      name: f[1]!,
      sprite: f[2]!,
      startWeapon: f[3]!,
      hp: num(f[4], 100),
      move: num(f[5], 1),
      area: num(f[6], 1),
      luck: num(f[7], 1),
      gold: num(f[8], 1),
      unlock: num(f[9]),
      note: f[10] ?? '',
    });
    order.push(id);
  }

  return { byId, order, warnings };
}

/** The default playable character: the first one that costs no gold. */
export function defaultCharacter(table: CharacterTable): CharacterDef | null {
  for (const id of table.order) {
    const c = table.byId.get(id);
    if (c !== undefined && c.unlock === 0) return c;
  }
  return null;
}

export function fallbackCharacters(): CharacterTable {
  return { byId: new Map(), order: [], warnings: ['characters.tsv missing'] };
}
