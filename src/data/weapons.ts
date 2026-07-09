/**
 * `assets/weapons.tsv` — one row per (weapon, level), absolute values.
 *
 * Jane's note in the file: "Values are ABSOLUTE, not deltas — no formula for you
 * to reimplement, and I can hand-tune any single cell." So there is no damage
 * curve in this codebase. Level N's numbers are looked up, never computed.
 *
 * All distances are world units (design.md §5).
 */

import { paletteColor } from '../assets/sprite.ts';
import type { Color } from '../engine/color.ts';
import { num, readRows, type Row } from './tsv.ts';

export type Shape = 'band' | 'bolt' | 'ring' | 'arc' | 'orbit' | 'column' | 'trail';

const SHAPES = new Set<string>(['band', 'bolt', 'ring', 'arc', 'orbit', 'column', 'trail']);

export type WeaponLevel = {
  readonly id: string;
  readonly level: number;
  readonly name: string;
  readonly glyph: string;
  readonly color: Color;
  readonly shape: Shape;
  /** Seconds between activations. 0 means "always on" (orbit). */
  readonly cd: number;
  readonly dmg: number;
  /** Shape-dependent; see the header comment in weapons.tsv. */
  readonly ax: number;
  readonly ay: number;
  readonly pierce: number;
  readonly knock: number;
  /** Lifetime of the effect, seconds. */
  readonly dur: number;
  /** Simultaneous instances: bolts fired, orbiting motes, columns, band sides. */
  readonly count: number;
  /** Projectile speed (wu/s), or degrees/s for orbit. */
  readonly pspeed: number;
  readonly note: string;
};

export type WeaponTable = {
  /** id -> levels, indexed by (level - 1). */
  readonly byId: ReadonlyMap<string, readonly WeaponLevel[]>;
  /** Declaration order, so the level-up pool offers weapons the way Jane listed them. */
  readonly order: readonly string[];
  readonly warnings: readonly string[];
};

export function parseWeapons(source: string): WeaponTable {
  const byId = new Map<string, WeaponLevel[]>();
  const order: string[] = [];
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const f: Row['cells'] = row.cells;
    if (f.length < 15) {
      warnings.push(`weapons.tsv:${row.line}: expected >=15 columns, got ${f.length}`);
      continue;
    }

    const id = f[0]!;
    const level = num(f[1]);
    const shape = f[5]!;
    if (!SHAPES.has(shape)) {
      warnings.push(`weapons.tsv:${row.line}: unknown shape '${shape}' for ${id}`);
      continue;
    }

    const color = paletteColor(f[4]!);
    if (color === undefined) warnings.push(`weapons.tsv:${row.line}: unknown palette char '${f[4]}'`);

    const def: WeaponLevel = {
      id,
      level,
      name: f[2]!,
      glyph: f[3]!,
      color: color ?? 0xc7c7c7,
      shape: shape as Shape,
      cd: num(f[6]),
      dmg: num(f[7]),
      ax: num(f[8]),
      ay: num(f[9]),
      pierce: num(f[10], 1),
      knock: num(f[11]),
      dur: num(f[12]),
      count: Math.max(1, num(f[13], 1)),
      pspeed: num(f[14]),
      note: f[15] ?? '',
    };

    let levels = byId.get(id);
    if (levels === undefined) {
      levels = [];
      byId.set(id, levels);
      order.push(id);
    }
    levels[level - 1] = def;
  }

  for (const [id, levels] of byId) {
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] === undefined) warnings.push(`weapons.tsv: ${id} is missing level ${i + 1}`);
    }
  }

  return { byId, order, warnings };
}

/** Clamp to the levels that exist, so an out-of-range level can't crash a run. */
export function weaponAt(table: WeaponTable, id: string, level: number): WeaponLevel | null {
  const levels = table.byId.get(id);
  if (levels === undefined || levels.length === 0) return null;
  const i = Math.max(0, Math.min(levels.length - 1, level - 1));
  return levels[i] ?? levels[0] ?? null;
}

export function maxLevel(table: WeaponTable, id: string): number {
  return table.byId.get(id)?.length ?? 0;
}
