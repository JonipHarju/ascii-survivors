/**
 * `assets/crossroads.tsv` — meta-progression (design.md §13).
 *
 * Jane's rule, from the file: *"meta-progression may make a bad run survivable.
 * It may never make a good run trivial. Nothing here touches weapon damage
 * scaling or the spawn curve; it only moves the floor, never the ceiling."*
 *
 * She costed the economy rather than guessing it: a winning run pays ~1,365g and
 * a full unlock is 15,230g, so winning is 11 runs and grinding losses is 35.
 * Those numbers only hold if the gold rates live here too — so they do, as
 * `param` rows, and `killEnemy` reads them instead of the `1/40` I'd hardcoded.
 */

import { num, readRows } from './tsv.ts';

export type UpgradeKind = 'mult' | 'add' | 'unlock';

export type Upgrade = {
  readonly id: string;
  readonly name: string;
  /** Sprite id for the icon, e.g. `cards/passives/might`. */
  readonly icon: string;
  /** Stat name; matches passives.tsv where they overlap. `-` for unlocks. */
  readonly stat: string;
  readonly kind: UpgradeKind;
  /** Value granted per level. `mult` is additive-into-a-multiplier: +0.05 -> 1.05x. */
  readonly perLevel: number;
  readonly levels: number;
  readonly costBase: number;
  readonly costGrowth: number;
  readonly note: string;
};

export type CrossroadsTable = {
  readonly params: ReadonlyMap<string, number>;
  /** Non-param rows, in file order — which is the order they're offered in. */
  readonly upgrades: readonly Upgrade[];
  readonly warnings: readonly string[];
};

const DEFAULT_PARAMS: Readonly<Record<string, number>> = {
  gold_kill_chance: 0.025,
  gold_per_kill: 3,
  gold_per_elite: 100,
  gold_per_chest: 60,
  gold_countess: 500,
};

export function parseCrossroads(source: string): CrossroadsTable {
  const params = new Map<string, number>(Object.entries(DEFAULT_PARAMS));
  const upgrades: Upgrade[] = [];
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const f = row.cells;

    if (f[0] === 'param') {
      if (f.length < 3) {
        warnings.push(`crossroads.tsv:${row.line}: param needs a name and value`);
        continue;
      }
      params.set(f[1]!, num(f[2]));
      continue;
    }

    if (f.length < 9) {
      warnings.push(`crossroads.tsv:${row.line}: expected >=9 columns, got ${f.length}`);
      continue;
    }

    const kind = f[4]!;
    if (kind !== 'mult' && kind !== 'add' && kind !== 'unlock') {
      warnings.push(`crossroads.tsv:${row.line}: unknown kind '${kind}'`);
      continue;
    }

    upgrades.push({
      id: f[0]!,
      name: f[1]!,
      icon: f[2]!,
      stat: f[3]!,
      kind,
      perLevel: num(f[5]),
      levels: Math.max(1, num(f[6], 1)),
      costBase: num(f[7]),
      costGrowth: num(f[8], 1),
      note: f[9] ?? '',
    });
  }

  return { params, upgrades, warnings };
}

export function crossroadsParam(t: CrossroadsTable, name: string): number {
  return t.params.get(name) ?? DEFAULT_PARAMS[name] ?? 0;
}

/**
 * `cost(level) = cost_base * cost_growth^(level-1)`, rounded to the nearest 10.
 * `level` is 1-based: the price of the *next* purchase.
 *
 * **Ties round up.** Two rows land exactly on a tie: Luck lv2 (`150 * 1.7 = 255`)
 * and Greed lv4 (`120 * 1.5^3 = 405`). Jane's header quotes a 15,230g full
 * unlock, which is what Python's `round()` gives — that's *banker's rounding*,
 * which sends 255 up to 260 but 405 down to 400. Nobody prices a shop with
 * round-half-even; it's an artifact of the tool she costed it in, not a design
 * decision. We round half up, consistently, and land at 15,240g.
 *
 * The 10g gap changes nothing she concluded (a winning run still pays ~1,365g,
 * so it's still 11 runs to buy everything). Raised in john.md — if she wants
 * 15,230 exactly, one `cost_base` nudge gets it without importing Python's
 * rounding into a game.
 */
export function upgradeCost(u: Upgrade, nextLevel: number): number {
  const raw = u.costBase * Math.pow(u.costGrowth, Math.max(0, nextLevel - 1));
  return Math.round(raw / 10) * 10;
}

/** Total gold to buy everything. Jane quotes 15,230g; this is how she got it. */
export function fullUnlockCost(t: CrossroadsTable): number {
  let total = 0;
  for (const u of t.upgrades) {
    for (let lv = 1; lv <= u.levels; lv++) total += upgradeCost(u, lv);
  }
  return total;
}

export function fallbackCrossroads(): CrossroadsTable {
  return {
    params: new Map(Object.entries(DEFAULT_PARAMS)),
    upgrades: [],
    warnings: ['crossroads.tsv missing — no meta-progression'],
  };
}
