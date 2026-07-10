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
  /**
   * Sprite id for Jane's card art — `cards/chain`, `cards/passives/might`. The
   * ids are a convention, not a table column, because every weapon and every
   * passive needs exactly one and a column would only ever restate the id.
   * `glyph` stays the fallback for art she hasn't drawn.
   */
  icon: string | null;
  /** One line of effect text, already resolved for the level being granted. */
  effect: string;
  /**
   * The exact numbers behind `effect` — `damage +16%` — drawn dimmed beneath it.
   * `null` when the effect line already *is* the number, which is every weapon:
   * a weapon's note describes what the level does, and there is no one stat to
   * restate. design.md §8.
   */
  detail: string | null;
  /** `LV 3 → 4`, or `NEW`. */
  levelText: string;
  isNew: boolean;
  apply(w: World): void;
};

/**
 * The numbers one more level of a passive buys, from its own curve — the line
 * that goes *under* Jane's sentence, not in place of it.
 *
 * Uses the table's `label`, never `stat`: `stat` is a key in `StatName` and
 * printing it showed the player `hp_per_sec` and `flat_reduce`.
 */
function passiveNumbers(data: GameData, id: string, nextLevel: number): string {
  const def = data.passives.byId.get(id);
  if (def === undefined) return '';

  const value = def.values[nextLevel - 1];
  if (value === null || value === undefined) return '';

  if (def.kind === 'add') return `${def.label} +${round(value)}`;

  // Multiplicative: show it as a percentage off the base, which is what a
  // player actually reasons about. Cooldown goes down, everything else up.
  const pct = Math.round((value - 1) * 100);
  return pct >= 0 ? `${def.label} +${pct}%` : `${def.label} ${pct}%`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A weapon with no note. `1.34s` already reads as a time, so the word "cooldown"
 * only cost us the characters that pushed the line off the card.
 */
function weaponFallback(dmg: number, cd: number): string {
  return `${round(dmg)} damage · ${round(cd)}s`;
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
      icon: `cards/${owned.id}`,
      effect: next.note !== '' ? next.note : weaponFallback(next.dmg, next.cd),
      detail: null,
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
        icon: `cards/${id}`,
        effect: first.note !== '' ? first.note : weaponFallback(first.dmg, first.cd),
        detail: null,
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

    // Jane's sentence is the card; the numbers are the footnote. A player choosing
    // between three cards in two seconds reads "Blunts every blow.", not
    // "armour +3". If she left the note empty the number is all we have.
    const numbers = passiveNumbers(data, id, next);
    const hasNote = def.note !== '';

    pool.push({
      title: def.name,
      glyph: PASSIVE_GLYPHS[id] ?? '◇',
      color: 0x4ff0f0,
      kind: 'passive',
      icon: `cards/passives/${id}`,
      effect: hasNote ? def.note : numbers,
      detail: hasNote && numbers !== '' ? numbers : null,
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
        icon: null,
        effect: 'restore 30 health',
        detail: null,
        levelText: '',
        isNew: false,
        apply: (world) => {
          world.hp = Math.min(world.maxHp, world.hp + 30);
        },
      },
    ];
  }

  return dealHand(pool, rng, count);
}

/**
 * Deal `count` cards, guaranteeing at least one that levels something the player
 * already owns — whenever such a card exists.
 *
 * Jane simulated a player taking the Chain every single time it was offered, for
 * twenty minutes, and it never reached level 8: the shuffle simply didn't offer
 * it enough. That isn't difficulty, it's a slot machine. The other two cards stay
 * fully random, so the hand still surprises you. design.md §8.
 */
function dealHand(pool: readonly Card[], rng: Rng, count: number): Card[] {
  const shuffled = rng.shuffle([...pool]);
  if (shuffled.length <= count) return shuffled;

  const hand = shuffled.slice(0, count);
  if (hand.some((c) => !c.isNew)) return hand;

  const upgrade = shuffled.find((c) => !c.isNew);
  if (upgrade === undefined) return hand; // the player owns nothing yet

  // Displace a random card rather than always the last, or the guaranteed slot
  // becomes a tell the player learns to read.
  hand[rng.int(0, count - 1)] = upgrade;
  return hand;
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
