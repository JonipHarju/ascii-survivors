/**
 * Tests for the simulation rules that are invisible when wrong but wreck the
 * feel: isotropic movement, the Chain's footprint, mote merging, the director.
 *
 * design.md §5 calls the aspect-ratio rule a hard requirement, so it gets a test
 * rather than a comment.
 *
 * These build a GameData from inline TSV, which means they also exercise every
 * table parser on the way through.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectDepth } from '../engine/color.ts';
import { Renderer } from '../engine/renderer.ts';
import { TICK_DT } from '../engine/loop.ts';
import { parseGlyphTable } from '../data/entities.ts';
import { parseWeapons } from '../data/weapons.ts';
import { parsePassives } from '../data/passives.ts';
import { parseDirector, targetPopulation, spawnCap, mixWeight } from '../data/director.ts';
import { parseEvolutions } from '../data/evolutions.ts';
import { parseCharacters } from '../data/characters.ts';
import { parseCrossroads } from '../data/crossroads.ts';
import type { GameData } from '../data/gamedata.ts';
import { GameView } from '../game/render.ts';
import { SpriteLoader } from '../assets/loader.ts';
import { World, WU_PER_ROW, xpToNext } from '../game/world.ts';

const GLYPHS = [
  'player\t@\tThe Warden\tW\t100\t20\t0\t-\t-\t0',
  'ghoul\tg\tGhoul\te\t10\t9\t4\t1\t0:00\t1',
  'rat\tr\tGrave Rat\ts\t2\t14\t2\t1\t0:30\t1',
  'rattlejack\tx\tRattlejack\tW\t16\t11\t6\t4\t8:00\t2\ton death spawns 2 rats',
  'countess\t-\tThe Countess\tR\t9000\t10\t25\t0\t-\t200\tBOSS',
  'gravewarden\tG\tGravewarden\tY\t600\t7\t16\t0\t-\t40\tELITE',
  'mote1\t·\tXP Mote\tb\t-\t0\t0\t-\t-\t1',
  'mote5\t+\tXP Shard\tG\t-\t0\t0\t-\t-\t5',
  'mote20\t◆\tXP Heart\tY\t-\t0\t0\t-\t-\t20',
  'gold\t⛁\tGold\tY\t-\t0\t0\t-\t-\t0',
  'chest\t▄\tChest\tY\t-\t0\t0\t-\t-\t0',
  'heal\t♥\tRoast Chicken\tR\t-\t0\t0\t-\t-\t0',
  'decal0\t※\tR\t0\t6',
].join('\n');

// Level 1 and 4 of the Chain, verbatim shape from Jane's weapons.tsv.
const WEAPONS = [
  'chain\t1\tThe Chain\t=\tW\tband\t1.1\t10\t12.0\t6.0\t99\t4\t0.12\t1\t0\thorizontal band',
  'chain\t2\tThe Chain\t=\tW\tband\t1.05\t12\t12.7\t6.4\t99\t4\t0.12\t1\t0',
  'chain\t3\tThe Chain\t=\tW\tband\t1.0\t14\t13.4\t6.7\t99\t4\t0.12\t1\t0',
  'chain\t4\tThe Chain\t=\tW\tband\t0.95\t15\t14.2\t7.1\t99\t4\t0.12\t2\t0\tALSO strikes behind you',
  'censer\t1\tCenser\t~\tG\tring\t0.5\t3\t8.0\t8.0\t99\t0\t0\t1\t0\tpersistent ring',
  'nova\t1\tSanguine Nova\t*\tR\tbolt\t1.4\t8\t2.0\t2.0\t1\t1\t2.0\t1\t40\thoming bolt',
].join('\n');

const PASSIVES = [
  'might\tMight\tdamage\tmult\t1.08\t1.16\t1.24\t1.32\t1.4\t1.48\t1.56\t1.64\t+8% per level',
  'armour\tArmour\tflat_reduce\tadd\t1\t2\t3\t4\t5\t6\t7\t8\tflat reduction',
  'swift\tSwiftness\tmove_speed\tmult\t1.05\t1.1\t1.15\t1.2\t1.25\t1.3\t1.35\t1.4\t',
  'revival\tRevival\trevives\tadd\t1\t2\t-\t-\t-\t-\t-\t-\tCAPS AT 2',
].join('\n');

const DIRECTOR_QUIET = [
  'param\trun_duration\t1200',
  'param\ttarget_start\t0',
  'param\ttarget_end\t0',
].join('\n');

const DIRECTOR_REAL = [
  'param\trun_duration\t1200\tseconds',
  'param\ttarget_start\t3\tenemies',
  'param\ttarget_end\t300\tenemies',
  'param\ttarget_curve\t1.5\tback-loaded',
  'param\tcap_start\t15',
  'param\tcap_end\t60',
  'param\tspawn_margin\t4',
  'param\tdespawn_margin\t40',
  'mix\tghoul\t0:00\t100\t10\tbread and butter',
  'mix\trat\t0:30\t60\t8',
  'beat\t0:30\tswarm\trat\t12\tfirst rat swarm',
  'beat\t5:00\telite\tgravewarden\t1\tfirst chest',
  'beat\t19:00\tboss\tcountess\t1\tTHE COUNTESS',
].join('\n');

const EVOLUTIONS = 'chain\tmight\touroboros\tOuroboros\tbands on BOTH sides, always';

// characters.tsv: "no starting weapon may require aiming." These tests want the
// Chain under the microscope, so this fixture's Warden opens with it anyway.
const CHARACTERS = [
  'warden\tThe Warden\tsprites/player\tchain\t100\t1.00\t1.00\t1.00\t1.00\t0\tthe default',
  'ashling\tThe Ashling\tsprites/ashling\tnova\t70\t1.20\t1.00\t1.00\t1.00\t400\tfragile, fast',
].join('\n');

const CROSSROADS = [
  'param\tgold_kill_chance\t0.025',
  'param\tgold_per_kill\t3',
  'param\tgold_per_elite\t100',
  'param\tgold_per_chest\t60',
  'param\tgold_countess\t500',
  'might\tMight\tcards/passives/might\tdamage\tmult\t0.05\t5\t100\t1.6\t+5% damage per level',
  'maxhp\tVigour\tcards/passives/regen\tmax_hp\tadd\t10\t5\t80\t1.6\t+10 max HP',
  'armour\tArmour\tcards/passives/armour\tflat_reduce\tadd\t1\t3\t200\t2.0\tflat reduction',
  'greed\tGreed\tcards/passives/magnet\tgold_gain\tmult\t0.10\t5\t120\t1.5\t+10% gold',
  'ashling\tThe Ashling\tsprites/ashling\t-\tunlock\t-\t1\t400\t1.0\tfragile, fast',
].join('\n');

function makeData(directorSrc: string = DIRECTOR_QUIET): GameData {
  return {
    glyphs: parseGlyphTable(GLYPHS),
    weapons: parseWeapons(WEAPONS),
    passives: parsePassives(PASSIVES),
    director: parseDirector(directorSrc),
    evolutions: parseEvolutions(EVOLUTIONS),
    characters: parseCharacters(CHARACTERS),
    crossroads: parseCrossroads(CROSSROADS),
    warnings: [],
  };
}

const data = makeData();

/** A world whose director never spawns anything, so tests stay deterministic. */
function quietWorld(): World {
  const w = new World(data, 99);
  w.setViewport(100, 32);
  return w;
}

function step(w: World, seconds: number, input = { x: 0, y: 0 }): void {
  const steps = Math.round(seconds / TICK_DT);
  for (let i = 0; i < steps; i++) w.update(TICK_DT, input);
}

describe('movement is isotropic in world units', () => {
  it('covers the same wu horizontally and vertically in the same time', () => {
    const a = quietWorld();
    step(a, 1, { x: 1, y: 0 });
    const b = quietWorld();
    step(b, 1, { x: 0, y: 1 });

    const dx = Math.abs(a.x);
    const dy = Math.abs(b.y);
    assert.ok(Math.abs(dx - dy) < 0.01, `expected equal wu travel, got dx=${dx} dy=${dy}`);
    assert.ok(Math.abs(dx - 20) < 0.2, 'player speed is 20 wu/s');
  });

  it('renders as twice the columns as rows, because a cell is 1x2 wu', () => {
    assert.equal(20 / 1, 20);
    assert.equal(20 / WU_PER_ROW, 10);
  });

  it('normalizes diagonals so they are not 1.41x faster', () => {
    const straight = quietWorld();
    step(straight, 1, { x: 1, y: 0 });
    const diag = quietWorld();
    step(diag, 1, { x: 1, y: 1 });

    const a = Math.hypot(straight.x, straight.y);
    const b = Math.hypot(diag.x, diag.y);
    assert.ok(Math.abs(a - b) < 0.05, `diagonal must not be faster: ${b} vs ${a}`);
  });

  it('faces the last horizontal direction pressed, never up or down', () => {
    const w = quietWorld();
    step(w, 0.2, { x: -1, y: 0 });
    assert.equal(w.facing, -1);
    step(w, 0.2, { x: 0, y: -1 }); // pressing up must not change facing
    assert.equal(w.facing, -1);
    step(w, 0.2, { x: 1, y: 0 });
    assert.equal(w.facing, 1);
  });

  it('aims the Chain at the swarm when you are not steering it', () => {
    // Owner feedback 09.07: aiming by walking meant walking *into* the enemies.
    // Jane fixed it in the tables instead, so this is now opt-in.
    const w = quietWorld();
    w.autoFace = true;
    w.facing = 1;
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x - 30, w.y);

    step(w, 0.1, { x: 0, y: -1 }); // fleeing straight up
    assert.equal(w.facing, 1, 'not immediately — there is a grace period');

    step(w, 0.4, { x: 0, y: -1 });
    assert.equal(w.facing, -1, 'now the whip looks at what is chasing you');
  });

  it('never lets auto-face override an explicit horizontal press', () => {
    const w = quietWorld();
    w.autoFace = true;
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x - 30, w.y);

    step(w, 1.0, { x: 1, y: 0 }); // walking right, ghoul is to the left
    assert.equal(w.facing, 1, 'turning by walking is the skill; auto-aim must not fight it');
  });

  it('leaves facing alone with auto-face off, which is the default', () => {
    const w = quietWorld();
    assert.equal(w.autoFace, false, 'Jane fixed the clunkiness in the tables, not here');
    w.facing = 1;
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x - 30, w.y);

    step(w, 1.0, { x: 0, y: -1 });
    assert.equal(w.facing, 1);
  });

  it('ignores enemies directly overhead, which would flip facing every frame', () => {
    const w = quietWorld();
    w.autoFace = true;
    w.facing = 1;
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 0.2, w.y - 10);

    step(w, 0.6, { x: 0, y: 0 });
    assert.equal(w.facing, 1, 'neither side is wrong, so do not thrash');
  });

  it('speeds up with Swiftness, straight from passives.tsv', () => {
    const w = quietWorld();
    w.passives.push({ id: 'swift', level: 8 }); // 1.4x
    step(w, 1, { x: 1, y: 0 });
    assert.ok(Math.abs(w.x - 28) < 0.3, `expected 20 * 1.4 = 28 wu, got ${w.x}`);
  });
});

describe('characters.tsv', () => {
  it('takes the starting weapon from the table, never from code', () => {
    // "no starting weapon may require aiming" is a rule that only holds if the
    // weapon is data. Hardcoding 'chain' here would silently break it forever.
    const w = new World(makeData(), 1, 'ashling');
    assert.equal(w.character?.id, 'ashling');
    assert.equal(w.weapons[0]?.id, 'nova');
  });

  it('defaults to the first character that costs no gold', () => {
    const w = quietWorld();
    assert.equal(w.character?.id, 'warden');
    assert.equal(w.character?.unlock, 0);
  });

  it('applies the character hp and move multipliers', () => {
    const w = new World(makeData(), 1, 'ashling');
    w.setViewport(100, 32);
    assert.equal(w.maxHp, 70, 'the Ashling is fragile');

    step(w, 1, { x: 1, y: 0 });
    assert.ok(Math.abs(w.x - 24) < 0.3, `20 wu/s x 1.20 = 24, got ${w.x}`);
  });
});

describe('The Chain', () => {
  function fireOnce(w: World) {
    w.effects.length = 0;
    w.weapons[0]!.timer = 0;
    w.update(TICK_DT, { x: 0, y: 0 });
    const band = w.effects.find((e) => e.kind === 'band');
    assert.ok(band !== undefined && band.kind === 'band');
    return band;
  }

  it('draws exactly 12 columns by 3 rows at level 1', () => {
    const w = quietWorld();
    const fx = fireOnce(w);

    // Rasterize the way the renderer does and count the footprint.
    const cols = new Set<number>();
    const rows = new Set<number>();
    const c0 = Math.round(fx.xLeft - w.x);
    const c1 = Math.round(fx.xRight - w.x);
    const cy = Math.round((fx.yCenter - w.y) / WU_PER_ROW);
    for (let y = cy - fx.halfRows; y <= cy + fx.halfRows; y++) {
      for (let x = c0; x < c1; x++) {
        cols.add(x);
        rows.add(y);
      }
    }
    assert.equal(cols.size, 12, 'band is 12 wu wide');
    assert.equal(rows.size, 3, 'band is 3 rows tall');
  });

  it('is centred on the player row', () => {
    const w = quietWorld();
    const fx = fireOnce(w);
    assert.equal(fx.yCenter, w.y);
    assert.equal(fx.halfRows, 1);
  });

  it('extends in the facing direction only, until level 4', () => {
    const w = quietWorld();
    step(w, 0.2, { x: -1, y: 0 });
    const fx = fireOnce(w);
    assert.ok(fx.xRight <= w.x, 'facing left, the band must be left of the player');
    assert.equal(w.effects.filter((e) => e.kind === 'band').length, 1);
  });

  it('strikes both sides at level 4, because count says 2', () => {
    const w = quietWorld();
    w.weapons[0]!.level = 4;
    fireOnce(w);
    assert.equal(w.effects.filter((e) => e.kind === 'band').length, 2);
  });

  it('kills a ghoul standing in the band, and leaves gore behind', () => {
    const w = quietWorld();
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 5, w.y);

    fireOnce(w);
    assert.equal(w.enemies.length, 0, 'ghoul has 10hp, chain hits for 10');
    assert.equal(w.kills, 1);
    assert.equal(w.decals.length, 1, 'the floor remembers');
    assert.equal(w.pickups.filter((p) => p.kind === 'mote').length, 1);
  });

  it('keeps the rats a dying Rattlejack splits into', () => {
    // Regression: reap() swaps in the survivor array, and killEnemy appends the
    // spawned rats. Do those in the wrong order and the rats vanish.
    const w = quietWorld();
    const jack = w.spawnEnemy(data.glyphs.entities.get('rattlejack')!, w.x + 5, w.y);
    jack.hp = 1;

    fireOnce(w);
    assert.equal(w.enemies.length, 2, 'the Rattlejack died and left two rats');
    assert.ok(w.enemies.every((e) => e.def.id === 'rat'));
  });

  it('misses a ghoul standing outside the band', () => {
    const w = quietWorld();
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 40, w.y);
    fireOnce(w);
    assert.equal(w.enemies.length, 1);
  });

  it('misses a ghoul two rows above, which is 4wu up', () => {
    const w = quietWorld();
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 5, w.y - 2 * WU_PER_ROW - 1);
    fireOnce(w);
    assert.equal(w.enemies.length, 1, 'a 3-row band must not reach 2 rows up');
  });

  it('scales damage by Might, straight from passives.tsv', () => {
    const w = quietWorld();
    w.passives.push({ id: 'might', level: 8 }); // 1.64x -> 16.4 damage
    const e = w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 5, w.y);
    e.hp = 16;
    fireOnce(w);
    assert.equal(w.enemies.length, 0, '16.4 damage must kill a 16hp ghoul');
  });
});

describe('other weapon shapes', () => {
  it('the Censer damages everything inside its ring and nothing outside', () => {
    const w = quietWorld();
    w.weapons = [{ id: 'censer', level: 1, timer: 0, angle: 0, evolved: null }];

    const inside = w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 6, w.y); // r=8
    const outside = w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 20, w.y);
    inside.hp = 100;
    outside.hp = 100;

    w.update(TICK_DT, { x: 0, y: 0 });
    assert.ok(inside.hp < 100, 'enemy inside the ring takes a tick of damage');
    assert.equal(outside.hp, 100, 'enemy outside the ring is untouched');
  });

  it('Sanguine Nova launches a homing bolt toward the nearest enemy', () => {
    const w = quietWorld();
    w.weapons = [{ id: 'nova', level: 1, timer: 0, angle: 0, evolved: null }];
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 30, w.y);

    w.update(TICK_DT, { x: 0, y: 0 });
    assert.equal(w.bolts.length, 1);
    assert.ok(w.bolts[0]!.vx > 0, 'bolt flies toward the enemy on the right');
  });
});

describe('xp, motes and pickups', () => {
  it('follows the design curve', () => {
    assert.equal(xpToNext(1), 5);
    assert.equal(xpToNext(2), Math.ceil(5 * 1.16));
  });

  it('merges touching motes and upgrades their glyph tier', () => {
    const w = quietWorld();
    for (let i = 0; i < 5; i++) {
      w.pickups.push({ kind: 'mote', x: 100, y: 100, value: 1, homing: false, dead: false });
    }
    step(w, 0.05);
    const motes = w.pickups.filter((p) => p.kind === 'mote');
    assert.equal(motes.length, 1);
    assert.equal(motes[0]!.value, 5);
  });

  it('levels up more than once from a single fat mote', () => {
    const w = quietWorld();
    w.gainXp(500);
    assert.ok(w.level > 2, `expected several levels, got ${w.level}`);
    assert.ok(w.pendingLevelUps >= 2);
  });

  it('vacuums motes inside the pickup radius', () => {
    const w = quietWorld();
    w.pickups.push({ kind: 'mote', x: w.x + 3, y: w.y, value: 1, homing: false, dead: false });
    step(w, 0.4);
    assert.equal(w.pickups.length, 0);
    assert.equal(w.xp, 1);
  });

  it('leaves motes outside the pickup radius alone', () => {
    const w = quietWorld();
    w.pickups.push({ kind: 'mote', x: w.x + 40, y: w.y, value: 1, homing: false, dead: false });
    step(w, 0.4);
    assert.equal(w.pickups.length, 1);
    assert.equal(w.xp, 0);
  });

  it('does not magnet chests — you walk to those', () => {
    const w = quietWorld();
    w.pickups.push({ kind: 'chest', x: w.x + 4, y: w.y, value: 1, homing: false, dead: false });
    step(w, 0.3);
    assert.equal(w.pickups[0]?.homing, false);
  });
});

describe('evolution', () => {
  it('needs the weapon maxed AND the paired passive maxed', () => {
    const w = quietWorld();
    assert.equal(w.eligibleEvolution(), null);

    w.weapons[0]!.level = 4; // maxLevel of 'chain' in this fixture
    assert.equal(w.eligibleEvolution(), null, 'weapon maxed but no Might');

    w.passives.push({ id: 'might', level: 8 });
    assert.equal(w.eligibleEvolution()?.intoId, 'ouroboros');
  });

  it('opening a chest evolves the weapon and flashes the screen', () => {
    const w = quietWorld();
    w.weapons[0]!.level = 4;
    w.passives.push({ id: 'might', level: 8 });

    w.pickups.push({ kind: 'chest', x: w.x, y: w.y, value: 1, homing: false, dead: false });
    step(w, 0.05);

    assert.equal(w.weapons[0]!.evolved?.intoId, 'ouroboros');
    assert.equal(w.justEvolved?.intoName, 'Ouroboros');
  });

  it('Ouroboros strikes both sides even at level 1 facing', () => {
    const w = quietWorld();
    w.weapons[0]!.evolved = { weapon: 'chain', passive: 'might', intoId: 'ouroboros', intoName: 'O', effect: '' };
    w.effects.length = 0;
    w.weapons[0]!.timer = 0;
    w.update(TICK_DT, { x: 0, y: 0 });
    assert.equal(w.effects.filter((e) => e.kind === 'band').length, 2);
  });
});

describe('the player', () => {
  it('takes contact damage on a per-enemy cooldown, not every frame', () => {
    const w = quietWorld();
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x, w.y);
    w.weapons.length = 0; // don't let the Chain kill it

    step(w, 0.4);
    assert.equal(w.hp, 96, 'exactly one 4-damage hit in the first 0.4s');
    step(w, 0.4);
    assert.equal(w.hp, 92, 'a second hit only after the 0.5s cooldown');
  });

  it('applies armour as flat reduction, but always takes at least 1', () => {
    const w = quietWorld();
    w.passives.push({ id: 'armour', level: 8 }); // -8 flat
    w.damagePlayer(4);
    assert.equal(w.hp, 99, 'a 4-damage hit against 8 armour still costs 1');
  });

  it('spends a Revival charge instead of dying', () => {
    const w = quietWorld();
    w.passives.push({ id: 'revival', level: 1 });
    w.damagePlayer(1000);
    assert.equal(w.dead, false);
    assert.equal(w.hp, w.maxHp * 0.5);

    w.damagePlayer(1000);
    assert.equal(w.dead, true, 'only one charge at level 1');
  });
});

describe('the spawn director', () => {
  const dir = parseDirector(DIRECTOR_REAL);

  it('ramps the head-count target along a back-loaded curve', () => {
    assert.equal(Math.round(targetPopulation(dir, 0)), 3);
    assert.equal(Math.round(targetPopulation(dir, 1200)), 300);
    // curve 1.5 means the midpoint sits well below halfway.
    assert.ok(targetPopulation(dir, 600) < 150, 'most of the ramp is late');
  });

  it('ramps the spawn rate cap linearly', () => {
    assert.equal(spawnCap(dir, 0), 15);
    assert.equal(spawnCap(dir, 1200), 60);
  });

  it('gates entities behind their `from` time and lerps their weight', () => {
    const rat = dir.mix.find((m) => m.entity === 'rat')!;
    assert.equal(mixWeight(dir, rat, 0), 0, 'rats do not spawn before 0:30');
    assert.ok(mixWeight(dir, rat, 60) > 0);
    // weight lerps 60 -> 8 across the run
    assert.ok(mixWeight(dir, rat, 1200) < mixWeight(dir, rat, 60));
  });

  it('closes the loop: it spawns toward the target and then stops', () => {
    const w = new World(makeData(DIRECTOR_REAL), 7);
    w.setViewport(100, 32);
    w.weapons.length = 0; // nothing dies, so population is purely the director
    w.time = 300;

    step(w, 3);
    const target = targetPopulation(dir, w.time);
    assert.ok(w.enemies.length > 0, 'it spawned something');
    assert.ok(
      w.enemies.length <= Math.ceil(target) + 2,
      `must not overshoot the target: ${w.enemies.length} vs target ${target.toFixed(1)}`,
    );
  });

  it('fires the rat swarm beat exactly once', () => {
    const w = new World(makeData(DIRECTOR_REAL), 7);
    w.setViewport(100, 32);
    w.weapons.length = 0;
    w.time = 29.5;

    step(w, 1.0);
    const rats = w.enemies.filter((e) => e.def.id === 'rat').length;
    assert.ok(rats >= 12, `expected the 12-rat swarm, saw ${rats}`);

    const before = w.enemies.length;
    step(w, 0.5);
    assert.ok(w.enemies.length - before < 12, 'the beat must not fire twice');
  });

  it('fastForward skips beats already passed, but still fires the one on the mark', () => {
    // Otherwise `--start 19:00` would dump the rat swarm, the bat flock, the
    // Wight Wall, the Ring and three elites into your lap on the first tick.
    // Elites are the clean probe here: the director's mix never spawns them, so
    // any elite on the field can only have come from a beat.
    const w = new World(makeData(DIRECTOR_REAL), 7);
    w.setViewport(100, 32);
    w.weapons.length = 0;
    w.fastForward(19 * 60);

    step(w, TICK_DT * 2);
    assert.equal(w.enemies.filter((e) => e.elite).length, 0, 'the 5:00 elite beat must not fire');
    assert.equal(w.bossActive, true, 'but the 19:00 boss beat must');
  });

  it('fastForward fills the field to the head-count target', () => {
    // `--start 15:00` exists so Jane can look at the late game. An empty
    // graveyard slowly trickling back up to 200 enemies is useless for that.
    const w = new World(makeData(DIRECTOR_REAL), 7);
    w.setViewport(100, 32);
    w.weapons.length = 0;

    assert.equal(w.enemies.length, 0);
    w.fastForward(15 * 60);

    const target = targetPopulation(parseDirector(DIRECTOR_REAL), 15 * 60);
    assert.ok(w.enemies.length > target * 0.8, `expected ~${Math.round(target)} enemies, got ${w.enemies.length}`);
    assert.equal(w.justSeen, null, 'and it must not flash every portrait at once');
  });

  it('spawns the Countess on screen, since her first phase never moves', () => {
    const w = new World(makeData(DIRECTOR_REAL), 7);
    w.setViewport(100, 32);
    w.weapons.length = 0;
    w.fastForward(19 * 60 - 0.5);
    step(w, 1.0);

    const boss = w.enemies.find((e) => e.boss)!;
    assert.ok(Math.abs(boss.x - w.x) < 50, 'within half a viewport horizontally');
    assert.ok(Math.abs(boss.y - w.y) < 32, 'within half a viewport vertically');
  });

  it('spawns the Countess at 19:00 and stops the clock', () => {
    const w = new World(makeData(DIRECTOR_REAL), 7);
    w.setViewport(100, 32);
    w.weapons.length = 0;
    w.time = 19 * 60 - 0.5;

    step(w, 1.0);
    assert.equal(w.bossActive, true);
    assert.equal(w.clockRunning, false, 'the clock freezes at 19:00');

    const t = w.time;
    step(w, 1.0);
    assert.equal(w.time, t, 'and it stays frozen');
  });

  it('ends the run in victory when the Countess dies', () => {
    const w = new World(makeData(DIRECTOR_REAL), 7);
    w.setViewport(100, 32);
    w.time = 19 * 60 - 0.5;
    step(w, 1.0);

    const boss = w.enemies.find((e) => e.boss)!;
    w.damageEnemy(boss, 99999);
    step(w, TICK_DT);

    assert.equal(w.won, true, 'kill her and the sun comes up');
    assert.equal(w.bossActive, false);
  });
});

describe('rendering the world', () => {
  it('draws the player as the only bright-white cell on the field', async () => {
    const loader = new SpriteLoader('/nonexistent');
    await loader.load(); // no assets: everything falls back to placeholders

    const w = quietWorld();
    w.spawnEnemy(data.glyphs.entities.get('ghoul')!, w.x + 6, w.y);

    const r = new Renderer(60, 20, 'truecolor', { write: () => true } as unknown as NodeJS.WritableStream);
    r.clear();
    new GameView(loader).render(r, w, { x: 0, y: 0, w: 60, h: 20 }, { dark: true, debug: false });

    assert.equal(r.getChar(30, 10), '@');
    assert.equal(r.getChar(36, 10), 'g');
  });

  it('runs a full frame against the real asset folder without throwing', async () => {
    const loader = new SpriteLoader(new URL('../../assets', import.meta.url).pathname);
    await loader.load();
    const w = quietWorld();
    const r = new Renderer(100, 34, detectDepth(), { write: () => true } as unknown as NodeJS.WritableStream);
    const view = new GameView(loader);
    assert.doesNotThrow(() => {
      r.clear();
      view.render(r, w, { x: 0, y: 1, w: 100, h: 32 }, { dark: true, debug: false });
      r.flush();
    });
  });
});
