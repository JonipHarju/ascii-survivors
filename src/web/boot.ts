/**
 * Browser entry point.
 *
 * Fetches the packed assets (Jane's `.txt` art and `.tsv` tables, exactly the
 * bytes on disk), builds the same GameData and SpriteBank the terminal build
 * uses, and drives the same `App` through a requestAnimationFrame loop.
 *
 * The simulation still runs at a fixed 60Hz regardless of display refresh, so a
 * seeded run plays out identically here, in the terminal, and in the benchmark.
 * On a 120Hz or 144Hz monitor the *render* rate follows the display while the
 * physics stay deterministic.
 */

import { SpriteBank } from '../assets/bank.ts';
import { MAX_CATCHUP_STEPS, TICK_DT, TICK_MS } from '../engine/tick.ts';
import { buildGameData, type TableSources } from '../data/gamedata.ts';
import { App } from '../game/app.ts';
import { CanvasSurface } from './canvas.ts';
import { WebInput } from './input.ts';

/** The shape `src/tools/pack.ts` writes and this file reads. */
type AssetBundle = {
  tables: TableSources;
  sprites: Record<string, string>;
};

function flag(name: string): boolean {
  return new URLSearchParams(location.search).has(name);
}

function numberParam(name: string): number | undefined {
  const raw = new URLSearchParams(location.search).get(name);
  if (raw === null) return undefined;
  const m = /^(\d+):(\d{1,2})$/.exec(raw);
  if (m !== null) return Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10);
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  const status = document.getElementById('status');
  if (canvas === null) throw new Error('missing <canvas id="screen">');

  const res = await fetch('assets.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`could not load assets.json (${res.status})`);
  const bundle = (await res.json()) as AssetBundle;

  const data = buildGameData(bundle.tables);
  const sprites = new SpriteBank();
  sprites.loadFromSources(Object.entries(bundle.sprites));

  for (const w of [...data.warnings, ...sprites.warnings]) console.warn('asset:', w);

  // Wait for the webfont before caching any glyph tiles, or the whole first
  // screen bakes at the fallback metrics and never re-rasterizes.
  try {
    await document.fonts.ready;
  } catch {
    // Font Loading API unavailable; the fallback stack is monospace anyway.
  }

  const surface = new CanvasSurface(canvas, flag('noglow') ? { glow: 0 } : {});
  const input = new WebInput();
  input.attach();

  const app = new App(data, sprites, input, {
    dark: !flag('nodark'),
    debug: flag('debug'),
    seed: numberParam('seed'),
    startTime: numberParam('start'),
    autoFace: !flag('noautoface'),
    skipTitle: flag('play'),
    god: flag('god'),
  });

  addEventListener('resize', () => {
    if (surface.resize()) surface.invalidate();
  });

  status?.remove();

  // Fixed-timestep sim, free-running render. Same contract as engine/loop.ts.
  let last = performance.now();
  let accumulator = 0;
  let fpsAvg = 60;

  const frame = (now: number): void => {
    let elapsed = now - last;
    last = now;

    if (elapsed > 0) fpsAvg += (1000 / elapsed - fpsAvg) * 0.1;

    // A big gap means the tab was backgrounded. Don't fast-forward the run.
    if (elapsed > MAX_CATCHUP_STEPS * TICK_MS) elapsed = TICK_MS;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= TICK_MS && steps < MAX_CATCHUP_STEPS) {
      app.update(TICK_DT);
      accumulator -= TICK_MS;
      steps++;
    }

    app.fps = fpsAvg;
    app.render(surface);
    surface.flush();

    if (!app.done) requestAnimationFrame(frame);
    else document.body.classList.add('quit');
  };

  requestAnimationFrame(frame);
}

boot().catch((err: unknown) => {
  const status = document.getElementById('status');
  const message = err instanceof Error ? err.message : String(err);
  if (status !== null) status.textContent = `failed to start: ${message}`;
  console.error(err);
});
