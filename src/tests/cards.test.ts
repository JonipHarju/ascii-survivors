/**
 * Level-up hands. Jane simulated a player who takes the Chain every single time
 * it is offered, for twenty minutes, and never reached level 8 — the shuffle
 * simply didn't offer it enough. That is a slot machine, not a difficulty curve.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Rng } from '../engine/rng.ts';
import { parseGlyphTable } from '../data/entities.ts';
import { parseWeapons } from '../data/weapons.ts';
import { parsePassives } from '../data/passives.ts';
import { parseDirector } from '../data/director.ts';
import { parseEvolutions } from '../data/evolutions.ts';
import { parseCharacters } from '../data/characters.ts';
import { parseCrossroads } from '../data/crossroads.ts';
import { parseCountess } from '../data/countess.ts';
import type { GameData } from '../data/gamedata.ts';
import { generateCards } from '../game/upgrades.ts';
import { World } from '../game/world.ts';

const WEAPONS = [
  'chain\t1\tThe Chain\t=\tW\tband\t1.1\t10\t12\t6\t99\t4\t0.12\t2\t0\t',
  'chain\t2\tThe Chain\t=\tW\tband\t1.0\t12\t12\t6\t99\t4\t0.12\t2\t0\t',
  'chain\t3\tThe Chain\t=\tW\tband\t0.9\t14\t12\t6\t99\t4\t0.12\t2\t0\t',
  'nova\t1\tSanguine Nova\t*\tR\tbolt\t1.4\t8\t2\t2\t1\t1\t2\t1\t40\t',
  'nova\t2\tSanguine Nova\t*\tR\tbolt\t1.3\t9\t2\t2\t1\t1\t2\t1\t40\t',
  'censer\t1\tCenser\t~\tG\tring\t0.5\t3\t8\t8\t99\t0\t0\t1\t0\t',
  'cinder\t1\tCinder Trail\t.\tr\ttrail\t0.25\t2\t2\t2\t99\t0\t3\t1\t0\t',
  'lantern\t1\tWisp Lantern\to\tY\torbit\t0\t6\t9\t3\t99\t1\t0\t1\t120\t',
].join('\n');

const PASSIVES = [
  'might\tMight\tdamage\tmult\t1.08\t1.16\t1.24\t1.32\t1.4\t1.48\t1.56\t1.64\t',
  'haste\tHaste\tcooldown\tmult\t0.94\t0.88\t0.82\t0.76\t0.7\t0.64\t0.58\t0.52\t',
  'area\tArea\tarea\tmult\t1.07\t1.14\t1.21\t1.28\t1.35\t1.42\t1.49\t1.56\t',
  'swift\tSwiftness\tmove_speed\tmult\t1.05\t1.1\t1.15\t1.2\t1.25\t1.3\t1.35\t1.4\t',
  'magnet\tMagnet\tpickup_radius\tmult\t1.12\t1.24\t1.36\t1.48\t1.6\t1.72\t1.84\t1.96\t',
  'growth\tGrowth\txp_gain\tmult\t1.06\t1.12\t1.18\t1.24\t1.3\t1.36\t1.42\t1.48\t',
].join('\n');

const data: GameData = {
  glyphs: parseGlyphTable('player\t@\tThe Warden\tW\t100\t20\t0\t-\t-\t0'),
  weapons: parseWeapons(WEAPONS),
  passives: parsePassives(PASSIVES),
  director: parseDirector('param\ttarget_start\t0\nparam\ttarget_end\t0'),
  evolutions: parseEvolutions('chain\tmight\touroboros\tOuroboros\tboth sides'),
  characters: parseCharacters('warden\tThe Warden\tsprites/player\tchain\t100\t1\t1\t1\t1\t0\t'),
  crossroads: parseCrossroads(''),
  countess: parseCountess(''),
  warnings: [],
};

function world(): World {
  const w = new World(data, 1);
  w.setViewport(180, 60);
  return w;
}

describe('level-up hands', () => {
  it('always offers a card that levels something you already own', () => {
    // The player starts holding the Chain, so a "Chain -> lv2" card always exists.
    for (let seed = 0; seed < 300; seed++) {
      const w = world();
      const hand = generateCards(w, new Rng(seed));
      assert.ok(
        hand.some((c) => !c.isNew),
        `seed ${seed} dealt three brand-new cards; a focused build would starve`,
      );
    }
  });

  it('does not put the guaranteed card in a predictable slot', () => {
    const slots = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const w = world();
      const hand = generateCards(w, new Rng(seed));
      hand.forEach((c, i) => {
        if (!c.isNew) slots.add(i);
      });
    }
    assert.ok(slots.size >= 2, 'the upgrade slot must move, or players learn to read it');
  });

  it('still deals three distinct cards', () => {
    for (let seed = 0; seed < 100; seed++) {
      const hand = generateCards(world(), new Rng(seed));
      assert.equal(hand.length, 3);
      assert.equal(new Set(hand.map((c) => c.title + c.levelText)).size, 3);
    }
  });

  it('offers new things too — it must not become an upgrade treadmill', () => {
    let sawNew = 0;
    for (let seed = 0; seed < 100; seed++) {
      if (generateCards(world(), new Rng(seed)).some((c) => c.isNew)) sawNew++;
    }
    assert.ok(sawNew > 80, `only ${sawNew}/100 hands offered something new`);
  });

  it('copes when the player owns nothing that can be levelled', () => {
    const w = world();
    w.weapons.length = 0; // no weapons, so every card is new
    assert.doesNotThrow(() => generateCards(w, new Rng(5)));
    assert.equal(generateCards(w, new Rng(5)).length, 3);
  });
});
