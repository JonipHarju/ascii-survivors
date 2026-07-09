/**
 * Level-up cards. Freeze the sim, dim the field, draw three, pick one.
 *
 * A card is just a closure over the world plus enough text to render it. The
 * generator never offers a maxed weapon, a maxed passive, or a seventh slot.
 */

import type { Rng } from '../engine/rng.ts';
import type { World } from './world.ts';

export const MAX_LEVEL = 8;
export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;

export type Card = {
  title: string;
  glyph: string;
  kind: 'weapon' | 'passive';
  /** One line of effect text, already resolved for the *next* level. */
  effect: string;
  isNew: boolean;
  apply(w: World): void;
};

type PassiveDef = {
  id: string;
  name: string;
  glyph: string;
  effect: string;
};

const PASSIVES: readonly PassiveDef[] = [
  { id: 'might', name: 'Might', glyph: '↑', effect: '+10% damage' },
  { id: 'haste', name: 'Haste', glyph: '»', effect: '-6% weapon cooldown' },
  { id: 'area', name: 'Area', glyph: '○', effect: '+10% weapon size' },
  { id: 'swiftness', name: 'Swiftness', glyph: '≫', effect: '+7% movement speed' },
  { id: 'magnet', name: 'Magnet', glyph: '∪', effect: '+35% pickup radius' },
  { id: 'growth', name: 'Growth', glyph: '↟', effect: '+8% experience gained' },
  { id: 'armour', name: 'Armour', glyph: '▣', effect: '-1 damage taken per hit' },
  { id: 'oil', name: 'Lantern Oil', glyph: '☼', effect: '+3 light radius' },
];

/** Per-level flavour for The Chain, straight from design.md §7. */
const CHAIN_LEVELS: Readonly<Record<number, string>> = {
  2: '+4 damage',
  3: '+3 width',
  4: 'strikes behind you too',
  5: '+6 damage',
  6: '+3 width',
  7: '-15% cooldown',
  8: '+8 damage, band is 5 rows tall',
};

export function generateCards(w: World, rng: Rng, count = 3): Card[] {
  const pool: Card[] = [];

  for (const weapon of w.weapons) {
    if (weapon.level >= MAX_LEVEL) continue;
    const next = weapon.level + 1;
    pool.push({
      title: weapon.name,
      glyph: weapon.glyph,
      kind: 'weapon',
      effect: CHAIN_LEVELS[next] ?? `level ${next}`,
      isNew: false,
      apply: (world) => {
        const wp = world.weapons.find((x) => x.id === weapon.id);
        if (wp === undefined) return;
        wp.level++;
        if (wp.id === 'chain' && wp.level === 7) wp.cooldown *= 0.85;
      },
    });
  }

  for (const def of PASSIVES) {
    const owned = w.passives.find((p) => p.id === def.id);
    if (owned !== undefined && owned.level >= MAX_LEVEL) continue;
    if (owned === undefined && w.passives.length >= MAX_PASSIVES) continue;

    pool.push({
      title: def.name,
      glyph: def.glyph,
      kind: 'passive',
      effect: def.effect,
      isNew: owned === undefined,
      apply: (world) => {
        const existing = world.passives.find((p) => p.id === def.id);
        if (existing !== undefined) existing.level++;
        else world.passives.push({ id: def.id, name: def.name, level: 1 });
      },
    });
  }

  if (pool.length === 0) {
    // Everything is maxed. Rather than show nothing, hand out health.
    return [
      {
        title: 'Nightfall Draught',
        glyph: '♥',
        kind: 'passive',
        effect: 'restore 30 health',
        isNew: false,
        apply: (world) => {
          world.hp = Math.min(world.maxHp, world.hp + 30);
        },
      },
    ];
  }

  return rng.shuffle([...pool]).slice(0, Math.min(count, pool.length));
}
