/**
 * `assets/evolutions.tsv` — weapon at max level + paired passive at max level,
 * then open a chest. The evolved weapon replaces the base one in the same slot.
 *
 * design.md §8 calls this "the payoff moment of the entire run", so the trigger
 * check lives close to the data and the presentation is loud.
 */

import { readRows } from './tsv.ts';

export type Evolution = {
  readonly weapon: string;
  readonly passive: string;
  readonly intoId: string;
  readonly intoName: string;
  readonly effect: string;
};

export type EvolutionTable = {
  readonly all: readonly Evolution[];
  readonly warnings: readonly string[];
};

export function parseEvolutions(source: string): EvolutionTable {
  const all: Evolution[] = [];
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const f = row.cells;
    if (f.length < 5) {
      warnings.push(`evolutions.tsv:${row.line}: expected 5 columns, got ${f.length}`);
      continue;
    }
    all.push({ weapon: f[0]!, passive: f[1]!, intoId: f[2]!, intoName: f[3]!, effect: f[4]! });
  }

  return { all, warnings };
}

export function evolutionFor(table: EvolutionTable, weaponId: string): Evolution | null {
  return table.all.find((e) => e.weapon === weaponId) ?? null;
}
