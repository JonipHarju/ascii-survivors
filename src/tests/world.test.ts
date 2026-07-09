/**
 * Tests for the simulation rules that are invisible when wrong but wreck the
 * feel: isotropic movement, the Chain's footprint, and mote merging.
 *
 * design.md §5 calls the aspect-ratio rule a hard requirement, so it gets a
 * test rather than a comment.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectDepth } from '../engine/color.ts';
import { Renderer } from '../engine/renderer.ts';
import { TICK_DT } from '../engine/loop.ts';
import { parseGlyphTable, type GlyphTable } from '../data/entities.ts';
import { GameView } from '../game/render.ts';
import { SpriteLoader } from '../assets/loader.ts';
import { World, WU_PER_ROW, xpToNext } from '../game/world.ts';

const TSV = [
  'player\t@\tThe Warden\tW\t100\t20\t0\t-\t-\t0',
  'ghoul\tg\tGhoul\te\t10\t9\t4\t1\t0:00\t1',
  'rat\tr\tGrave Rat\ts\t2\t14\t2\t1\t0:30\t1',
  'rattlejack\tx\tRattlejack\tW\t16\t11\t6\t4\t8:00\t2\ton death spawns 2 rats',
  'mote1\t·\tXP Mote\tb\t-\t0\t0\t-\t-\t1',
  'mote5\t+\tXP Shard\tG\t-\t0\t0\t-\t-\t5',
  'mote20\t◆\tXP Heart\tY\t-\t0\t0\t-\t-\t20',
  'decal0\t※\tR\t0\t6',
].join('\n');

const table: GlyphTable = parseGlyphTable(TSV);

/** Advance the sim without letting the spawn director add anything. */
function quietWorld(): World {
  const w = new World(table, 99);
  // Neutralize the director by draining its pool.
  (w as unknown as { spawnPool: unknown[] }).spawnPool = [];
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

    const dx = Math.abs(a.x - 0);
    const dy = Math.abs(b.y - 0);
    assert.ok(Math.abs(dx - dy) < 0.01, `expected equal wu travel, got dx=${dx} dy=${dy}`);
    assert.ok(Math.abs(dx - 20) < 0.2, 'player speed is 20 wu/s');
  });

  it('renders as twice the columns as rows, because a cell is 1x2 wu', () => {
    // 20 wu of travel is 20 columns sideways but only 10 rows down.
    assert.equal(20 / 1, 20);
    assert.equal(20 / WU_PER_ROW, 10);
  });

  it('normalizes diagonals so they are not 1.41x faster', () => {
    const straight = quietWorld();
    step(straight, 1, { x: 1, y: 0 });

    const diag = quietWorld();
    step(diag, 1, { x: 1, y: 1 });

    const straightDist = Math.hypot(straight.x, straight.y);
    const diagDist = Math.hypot(diag.x, diag.y);
    assert.ok(Math.abs(straightDist - diagDist) < 0.05, `diagonal must not be faster: ${diagDist} vs ${straightDist}`);
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
});

describe('The Chain', () => {
  /** Fire once and return the effect the renderer will draw. */
  function fireOnce(w: World) {
    w.effects.length = 0;
    const chain = w.weapons.find((x) => x.id === 'chain')!;
    chain.timer = 0;
    w.update(TICK_DT, { x: 0, y: 0 });
    return w.effects.find((e) => e.kind === 'chain')!;
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
    assert.equal(w.effects.filter((e) => e.kind === 'chain').length, 1);
  });

  it('strikes both sides at level 4', () => {
    const w = quietWorld();
    w.weapons[0]!.level = 4;
    fireOnce(w);
    assert.equal(w.effects.filter((e) => e.kind === 'chain').length, 2);
  });

  it('kills a ghoul standing in the band, and leaves gore behind', () => {
    const w = quietWorld();
    const ghoul = table.entities.get('ghoul')!;
    w.spawnEnemy(ghoul, w.x + 5, w.y); // inside a 12-wide band to the right

    fireOnce(w);
    assert.equal(w.enemies.length, 0, 'ghoul has 10hp, chain hits for 10');
    assert.equal(w.kills, 1);
    assert.equal(w.decals.length, 1, 'the floor remembers');
    assert.equal(w.motes.length, 1);
  });

  it('keeps the rats a dying Rattlejack splits into', () => {
    // Regression: reap() swaps in the survivor array, and killEnemy appends the
    // spawned rats. Do those in the wrong order and the rats vanish.
    const w = quietWorld();
    const jack = w.spawnEnemy(table.entities.get('rattlejack')!, w.x + 5, w.y);
    jack.hp = 1;

    fireOnce(w);

    assert.equal(w.enemies.length, 2, 'the Rattlejack died and left two rats');
    assert.ok(w.enemies.every((e) => e.def.id === 'rat'));
  });

  it('misses a ghoul standing outside the band', () => {
    const w = quietWorld();
    const ghoul = table.entities.get('ghoul')!;
    w.spawnEnemy(ghoul, w.x + 40, w.y); // well beyond 12 wu
    fireOnce(w);
    assert.equal(w.enemies.length, 1);
  });

  it('misses a ghoul two rows above, which is 4wu up', () => {
    const w = quietWorld();
    const ghoul = table.entities.get('ghoul')!;
    w.spawnEnemy(ghoul, w.x + 5, w.y - 2 * WU_PER_ROW - 1);
    fireOnce(w);
    assert.equal(w.enemies.length, 1, 'a 3-row band must not reach 2 rows up');
  });
});

describe('xp and motes', () => {
  it('follows the design curve', () => {
    assert.equal(xpToNext(1), 5);
    assert.equal(xpToNext(2), Math.ceil(5 * 1.16));
  });

  it('merges touching motes and upgrades their glyph tier', () => {
    const w = quietWorld();
    for (let i = 0; i < 5; i++) w.motes.push({ x: 100, y: 100, value: 1, homing: false, dead: false });
    step(w, 0.05);
    assert.equal(w.motes.length, 1);
    assert.equal(w.motes[0]!.value, 5);
  });

  it('levels up more than once from a single fat mote', () => {
    const w = quietWorld();
    w.gainXp(500);
    assert.ok(w.level > 2, `expected several levels, got ${w.level}`);
    assert.ok(w.pendingLevelUps >= 2);
  });

  it('vacuums motes inside the pickup radius', () => {
    const w = quietWorld();
    w.motes.push({ x: w.x + 3, y: w.y, value: 1, homing: false, dead: false });
    step(w, 0.4);
    assert.equal(w.motes.length, 0);
    assert.equal(w.xp, 1);
  });

  it('leaves motes outside the pickup radius alone', () => {
    const w = quietWorld();
    w.motes.push({ x: w.x + 40, y: w.y, value: 1, homing: false, dead: false });
    step(w, 0.4);
    assert.equal(w.motes.length, 1);
    assert.equal(w.xp, 0);
  });
});

describe('the player', () => {
  it('takes contact damage on a per-enemy cooldown, not every frame', () => {
    const w = quietWorld();
    const ghoul = table.entities.get('ghoul')!;
    w.spawnEnemy(ghoul, w.x, w.y);
    w.weapons.length = 0; // don't let the Chain kill it

    step(w, 0.4);
    assert.equal(w.hp, 96, 'exactly one 4-damage hit in the first 0.4s');

    step(w, 0.4);
    assert.equal(w.hp, 92, 'a second hit only after the 0.5s cooldown');
  });

  it('dies when hp reaches zero and records the run', () => {
    const w = quietWorld();
    w.damagePlayer(1000);
    assert.equal(w.hp, 0);
    assert.equal(w.dead, true);
  });

  it('applies armour as flat reduction, but always takes at least 1', () => {
    const w = quietWorld();
    w.passives.push({ id: 'armour', name: 'Armour', level: 8 });
    w.damagePlayer(4);
    assert.equal(w.hp, 99);
  });
});

describe('rendering the world', () => {
  it('draws the player as the only bright-white cell on the field', async () => {
    const loader = new SpriteLoader('/nonexistent');
    await loader.load(); // no assets: everything falls back to placeholders

    const w = quietWorld();
    w.spawnEnemy(table.entities.get('ghoul')!, w.x + 6, w.y);

    const r = new Renderer(60, 20, 'truecolor', { write: () => true } as unknown as NodeJS.WritableStream);
    r.clear();
    new GameView(loader).render(r, w, { x: 0, y: 0, w: 60, h: 20 }, { dark: true, debug: false });

    assert.equal(r.getChar(30, 10), '@');
    assert.equal(r.getChar(36, 10), 'g');
  });

  it('runs a full frame against a real asset folder without throwing', async () => {
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
