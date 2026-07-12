#!/usr/bin/env node
/**
 * Headless performance benchmark. `node src/bench.ts [entityCount]`
 *
 * Exists to answer Jane's question in jane.md §6.3 — "is 30fps realistic with a
 * diff renderer at 300 entities?" — with a number instead of an opinion. It
 * drives the real sim and the real renderer, and throws the escape codes away
 * instead of writing them to a terminal.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpriteLoader } from './assets/loader.ts';
import { detectDepth } from './engine/color.ts';
import { Renderer } from './engine/renderer.ts';
import { TICK_DT } from './engine/loop.ts';
import { loadGameData } from './data/gamedata.node.ts';
import { GameView } from './game/render.ts';
import { World } from './game/world.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');

/** Swallows output but records how many bytes a real terminal would receive. */
class NullStream {
  bytes = 0;
  write(s: string): boolean {
    this.bytes += Buffer.byteLength(s, 'utf8');
    return true;
  }
}

function percentile(sorted: readonly number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i]!;
}

async function main(): Promise<void> {
  const target = Number.parseInt(process.argv[2] ?? '300', 10);
  const FRAMES = 600;

  const data = await loadGameData(ASSETS);
  const sprites = new SpriteLoader(ASSETS);
  await sprites.load();

  const world = new World(data, 12345);
  world.setViewport(100, 32);
  const view = new GameView(sprites);
  const out = new NullStream();
  const renderer = new Renderer(100, 34, detectDepth(), out as unknown as NodeJS.WritableStream);
  const field = { x: 0, y: 1, w: 100, h: 32 };

  // Fast-forward the director to a late-game clock, then top up to `target`.
  world.time = 15 * 60;
  const pool = [...data.glyphs.entities.values()].filter((d) => d.cost > 0 && d.from !== null);
  while (world.enemies.length < target) {
    const def = world.rng.pick(pool);
    const a = world.rng.next() * Math.PI * 2;
    const r = world.rng.range(4, 55);
    world.spawnEnemy(def, world.x + Math.cos(a) * r, world.y + Math.sin(a) * r * 0.6);
  }
  // Give the gore layer a realistic load, too.
  for (let i = 0; i < 4000; i++) {
    world.decals.push({
      cx: Math.round(world.x + world.rng.range(-60, 60)),
      cy: Math.round(world.y / 2 + world.rng.range(-20, 20)),
      born: world.time - world.rng.range(0, 89),
    });
  }

  const updateMs: number[] = [];
  const renderMs: number[] = [];
  let bytes = 0;

  // Walk in a slow circle so the camera actually moves and the diff has work.
  for (let f = 0; f < FRAMES; f++) {
    const angle = (f / FRAMES) * Math.PI * 4;
    const input = { x: Math.cos(angle), y: Math.sin(angle) };

    let t = performance.now();
    world.update(TICK_DT, input);
    updateMs.push(performance.now() - t);

    // Keep the population near `target` so we measure a steady state.
    while (world.enemies.length < target) {
      const def = world.rng.pick(pool);
      const a = world.rng.next() * Math.PI * 2;
      world.spawnEnemy(def, world.x + Math.cos(a) * 70, world.y + Math.sin(a) * 40);
    }
    world.pendingLevelUps = 0;
    world.hp = world.maxHp; // never die mid-benchmark

    t = performance.now();
    renderer.clear();
    view.render(renderer, world, field, { dark: true, debug: false });
    const before = out.bytes;
    renderer.flush();
    bytes += out.bytes - before;
    renderMs.push(performance.now() - t);
  }

  updateMs.sort((a, b) => a - b);
  renderMs.sort((a, b) => a - b);

  const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
  const avgU = sum(updateMs) / FRAMES;
  const avgR = sum(renderMs) / FRAMES;
  const avgFrame = avgU + avgR;
  const p99 = percentile(updateMs, 99) + percentile(renderMs, 99);

  const row = (k: string, v: string): void => console.log(`  ${k.padEnd(22)} ${v}`);

  console.log(`\nLONE NIGHT — benchmark  (${target} enemies, ${world.decals.length} decals, 100x34)\n`);
  row('sim update  avg', `${avgU.toFixed(3)} ms`);
  row('sim update  p99', `${percentile(updateMs, 99).toFixed(3)} ms`);
  row('render+diff avg', `${avgR.toFixed(3)} ms`);
  row('render+diff p99', `${percentile(renderMs, 99).toFixed(3)} ms`);
  row('total frame avg', `${avgFrame.toFixed(3)} ms`);
  row('total frame p99', `${p99.toFixed(3)} ms`);
  row('headroom @ 60fps', `${(16.67 / avgFrame).toFixed(1)}x`);
  row('headroom @ 30fps', `${(33.3 / avgFrame).toFixed(1)}x`);
  row('ANSI bytes/frame', `${Math.round(bytes / FRAMES).toLocaleString('en-US')}`);
  row('sustainable fps', `${Math.min(999, Math.round(1000 / avgFrame))}`);
  console.log();
}

await main();
