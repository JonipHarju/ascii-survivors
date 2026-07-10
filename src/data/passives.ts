/**
 * `assets/passives.tsv` — one row per passive, absolute value at each level.
 *
 * `kind=mult` multiplies the stat, `kind=add` adds to it. `-` means the passive
 * doesn't offer that level (only Revival, which caps at 2). Again: absolute
 * values, so there's no per-level formula living in the code.
 */

import { num, optNum, readRows } from './tsv.ts';

export type StatKind = 'mult' | 'add';

/** Every stat a passive can touch. Names match the `stat` column exactly. */
export type StatName =
  | 'damage'
  | 'cooldown'
  | 'area'
  | 'duration'
  | 'move_speed'
  | 'pickup_radius'
  | 'xp_gain'
  | 'luck'
  | 'flat_reduce'
  | 'hp_per_sec'
  | 'light_radius'
  | 'revives';

export type PassiveDef = {
  readonly id: string;
  readonly name: string;
  readonly stat: StatName;
  readonly kind: StatKind;
  /** Absolute value at each level; `null` where the passive doesn't go. */
  readonly values: readonly (number | null)[];
  readonly note: string;
  /**
   * The human name of the quantity, for the card's numbers line. `stat` is an
   * identifier in a union type — printing it gave the player `hp_per_sec`.
   */
  readonly label: string;
};

export type PassiveTable = {
  readonly byId: ReadonlyMap<string, PassiveDef>;
  readonly order: readonly string[];
  readonly warnings: readonly string[];
};

/** Multiplicative stats start at 1; additive ones at 0. */
export const BASE_STATS: Readonly<Record<StatName, number>> = {
  damage: 1,
  cooldown: 1,
  area: 1,
  duration: 1,
  move_speed: 1,
  pickup_radius: 1,
  xp_gain: 1,
  luck: 1,
  flat_reduce: 0,
  hp_per_sec: 0,
  light_radius: 0,
  revives: 0,
};

const STAT_NAMES = new Set<string>(Object.keys(BASE_STATS));

export function parsePassives(source: string): PassiveTable {
  const byId = new Map<string, PassiveDef>();
  const order: string[] = [];
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const f = row.cells;
    if (f.length < 12) {
      warnings.push(`passives.tsv:${row.line}: expected >=12 columns, got ${f.length}`);
      continue;
    }

    const id = f[0]!;
    const stat = f[2]!;
    const kind = f[3]!;

    if (!STAT_NAMES.has(stat)) {
      warnings.push(`passives.tsv:${row.line}: unknown stat '${stat}' — '${id}' will have no effect`);
      continue;
    }
    if (kind !== 'mult' && kind !== 'add') {
      warnings.push(`passives.tsv:${row.line}: unknown kind '${kind}' for '${id}'`);
      continue;
    }

    const values: (number | null)[] = [];
    for (let i = 0; i < 8; i++) values.push(optNum(f[4 + i]));

    // `label` is appended at index 13, so a table written before it existed still
    // parses — it just falls back to spelling the identifier out.
    const label = f[13] !== undefined && f[13] !== '' ? f[13] : stat.replace(/_/g, ' ');

    byId.set(id, { id, name: f[1]!, stat: stat as StatName, kind, values, note: f[12] ?? '', label });
    order.push(id);
  }

  return { byId, order, warnings };
}

/** Highest level this passive actually offers (Revival stops at 2). */
export function passiveMaxLevel(def: PassiveDef): number {
  let n = 0;
  for (const v of def.values) {
    if (v === null) break;
    n++;
  }
  return n;
}

export type Owned = { readonly id: string; level: number };

/**
 * Fold owned passives into a stat block. Multiplicative passives compose by
 * multiplying (two sources of +8% give 1.08x, not +16% additive) — but since a
 * player only ever holds one copy of each passive, this is really just "look up
 * the absolute value at the owned level".
 */
export function computeStats(table: PassiveTable, owned: readonly Owned[]): Record<StatName, number> {
  const stats: Record<StatName, number> = { ...BASE_STATS };

  for (const p of owned) {
    const def = table.byId.get(p.id);
    if (def === undefined) continue;

    const value = def.values[Math.max(0, Math.min(def.values.length - 1, p.level - 1))];
    if (value === null || value === undefined) continue;

    if (def.kind === 'mult') stats[def.stat] *= value;
    else stats[def.stat] += value;
  }

  return stats;
}

export function fallbackPassives(): PassiveTable {
  return { byId: new Map(), order: [], warnings: ['passives.tsv missing — no passives available'] };
}
