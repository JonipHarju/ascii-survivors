/**
 * Level-up cards. Freeze the sim, dim the field, draw three, pick one.
 *
 * Every card is generated from Jane's tables — `weapons.tsv` supplies the name,
 * glyph, colour and per-level note; `passives.tsv` supplies the stat curve. The
 * generator never offers a maxed weapon, a maxed passive, an evolved weapon, or
 * a seventh slot.
 */

import type { Color } from '../engine/color.ts';
import type { Rng } from '../engine/rng.ts';
import type { GameData } from '../data/gamedata.ts';
import { passiveMaxLevel } from '../data/passives.ts';
import { maxLevel, weaponAt } from '../data/weapons.ts';
import type { World } from './world.ts';

export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;

export type Card = {
  title: string;
  glyph: string;
  color: Color;
  kind: 'weapon' | 'passive' | 'bonus';
  /** One line of effect text, already resolved for the level being granted. */
  effect: string;
  /** `LV 3 → 4`, or `NEW`. */
  levelText: string;
  isNew: boolean;
  apply(w: World): void;
};

/** Describe what one more level of a passive does, from its own curve. */
function passiveEffect(data: GameData, id: string, nextLevel: number): string {
  const def = data.passives.byId.get(id);
  if (def === undefined) return '';

  const value = def.values[nextLevel - 1];
  if (value === null || value === undefined) return def.note;

  if (def.kind === 'add') {
    return `${def.stat.replace(/_/g, ' ')} +${round(value)}`;
  }

  // Multiplicative: show it as a percentage off the base, which is what a
  // player actually reasons about. Cooldown goes down, everything else up.
  const pct = Math.round((value - 1) * 100);
  const label = def.stat.replace(/_/g, ' ');
  return pct >= 0 ? `${label} +${pct}%` : `${label} ${pct}%`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateCards(w: World, rng: Rng, count = 3): Card[] {
  const data = w.data;
  const pool: Card[] = [];

  // --- level up a weapon you already carry ---
  for (const owned of w.weapons) {
    if (owned.evolved !== null) continue; // evolved weapons are finished
    const cap = maxLevel(data.weapons, owned.id);
    if (cap === 0 || owned.level >= cap) continue;

    const next = weaponAt(data.weapons, owned.id, owned.level + 1);
    if (next === null) continue;

    pool.push({
      title: next.name,
      glyph: next.glyph,
      color: next.color,
      kind: 'weapon',
      effect: next.note !== '' ? next.note : `${round(next.dmg)} damage · ${round(next.cd)}s cooldown`,
      levelText: `LV ${owned.level} → ${owned.level + 1}`,
      isNew: false,
      apply: (world) => {
        const wp = world.weapons.find((x) => x.id === owned.id);
        if (wp !== undefined) wp.level++;
      },
    });
  }

  // --- take a weapon you don't have ---
  if (w.weapons.length < MAX_WEAPONS) {
    for (const id of data.weapons.order) {
      if (w.weapons.some((x) => x.id === id)) continue;
      const first = weaponAt(data.weapons, id, 1);
      if (first === null) continue;

      pool.push({
        title: first.name,
        glyph: first.glyph,
        color: first.color,
        kind: 'weapon',
        effect: first.note !== '' ? first.note : `${round(first.dmg)} damage · ${round(first.cd)}s cooldown`,
        levelText: 'NEW WEAPON',
        isNew: true,
        apply: (world) => {
          world.weapons.push({ id, level: 1, timer: 0, angle: 0, evolved: null });
        },
      });
    }
  }

  // --- passives ---
  for (const id of data.passives.order) {
    const def = data.passives.byId.get(id)!;
    const owned = w.passives.find((p) => p.id === id);
    const cap = passiveMaxLevel(def);

    if (owned !== undefined && owned.level >= cap) continue;
    if (owned === undefined && w.passives.length >= MAX_PASSIVES) continue;

    const next = (owned?.level ?? 0) + 1;
    pool.push({
      title: def.name,
      glyph: PASSIVE_GLYPHS[id] ?? '◇',
      color: 0x4ff0f0,
      kind: 'passive',
      effect: passiveEffect(data, id, next),
      levelText: owned === undefined ? 'NEW' : `LV ${owned.level} → ${next}`,
      isNew: owned === undefined,
      apply: (world) => {
        const existing = world.passives.find((p) => p.id === id);
        if (existing !== undefined) existing.level++;
        else world.passives.push({ id, level: 1 });
      },
    });
  }

  if (pool.length === 0) {
    // Everything is maxed. Rather than show nothing, hand out health.
    return [
      {
        title: 'Nightfall Draught',
        glyph: '♥',
        color: 0xff3b3b,
        kind: 'bonus',
        effect: 'restore 30 health',
        levelText: '',
        isNew: false,
        apply: (world) => {
          world.hp = Math.min(world.maxHp, world.hp + 30);
        },
      },
    ];
  }

  return rng.shuffle([...pool]).slice(0, Math.min(count, pool.length));
}

/** Cosmetic only — the passive table doesn't carry glyphs, so the UI picks them. */
const PASSIVE_GLYPHS: Readonly<Record<string, string>> = {
  might: '↑',
  haste: '»',
  area: '○',
  duration: '∞',
  swift: '≫',
  magnet: '∪',
  growth: '↟',
  luck: '☘',
  armour: '▣',
  regen: '+',
  oil: '☼',
  revival: '♁',
};
