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
import { WebImageSource } from './imagesource.ts';
import { WebAudioSink } from './audio.ts';
import { localStore } from './save.web.ts';
import { emptyProfile, memoryStore, saveProfile, type SaveStore } from '../game/save.ts';

/**
 * Binary media (ship art, SFX, music) live beside the page as ordinary static
 * files, not inlined — john.md: the purchased pack is 620MB, nowhere near
 * base64-inlinable. `tools/build.ts` copies only the files `images.tsv`/
 * `audio.tsv` actually reference into `dist/assets/`; the dev server
 * (`serve.ts`) serves the same relative path straight off `assets/` on disk.
 * Same URL scheme both places, so this is the only line that has to know it.
 */
const MEDIA_BASE_URL = 'assets';

/** The shape `src/tools/pack.ts` writes and this file reads. */
type AssetBundle = {
  tables: TableSources;
  sprites: Record<string, string>;
};

/**
 * The single-file build inlines the bundle here instead of shipping it beside
 * the page. A `file://` page cannot fetch its own neighbours, so when the game
 * is opened by double-clicking, this is the only way the assets arrive.
 */
function inlinedAssets(): AssetBundle | undefined {
  return (globalThis as { __ASSETS__?: AssetBundle }).__ASSETS__;
}

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

/**
 * `?gold=5000` hands you a throwaway profile with money in it, so the Crossroads
 * can be looked at without playing eleven runs. Never touches localStorage.
 */
function pickStore(): SaveStore {
  const gold = numberParam('gold');
  if (gold !== undefined) {
    const store = memoryStore();
    saveProfile(store, { ...emptyProfile(), gold, wonOnce: true });
    return store;
  }
  return flag('nosave') ? memoryStore() : localStore();
}

/** The dev server's path: `assets.json` sits next to the page and is re-packed per request. */
async function fetchAssets(): Promise<AssetBundle> {
  if (location.protocol === 'file:') {
    throw new Error('opened from a file:// path without inlined assets — run `npm run build` and open dist/index.html');
  }
  const res = await fetch('assets.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`could not load assets.json (${res.status})`);
  return (await res.json()) as AssetBundle;
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  const status = document.getElementById('status');
  if (canvas === null) throw new Error('missing <canvas id="screen">');

  const bundle = inlinedAssets() ?? (await fetchAssets());

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

  const imagePaths = new Set<string>();
  for (const e of data.images.byId.values()) imagePaths.add(e.path);
  for (const e of data.backgrounds.byId.values()) imagePaths.add(e.path);
  const images = new WebImageSource(imagePaths, MEDIA_BASE_URL);
  const audio = new WebAudioSink(data.audio, MEDIA_BASE_URL);
  // AudioContext needs a user gesture before it's allowed to make sound.
  // Whichever fires first unlocks it; App.startMusic() then plays into it.
  addEventListener('keydown', () => audio.resume(), { once: true });
  addEventListener('pointerdown', () => audio.resume(), { once: true });

  const app = new App(data, sprites, input, {
    // design.md §16.5, owner feedback 12.07 16:10 ("this light mechanic is so
    // pointless"): normal play is fully lit now — `?dark` opts INTO the old
    // gothic-lantern look instead of `?nodark` opting out of it. `w.dusk`
    // (the boss's phase-3 blackout) is untouched, forced regardless
    // (render.ts's `dark = opts.dark || w.dusk`).
    dark: flag('dark'),
    debug: flag('debug'),
    seed: numberParam('seed'),
    startTime: numberParam('start'),
    autoFace: !flag('noautoface'),
    skipTitle: flag('play'),
    god: flag('god'),
    store: pickStore(),
    openShop: flag('shop'),
    openCards: flag('cards'),
    images,
    audio,
    // `npm run dev` injects window.__DEV__; `?dev` forces it on any build.
    dev: flag('dev') || (globalThis as { __DEV__?: boolean }).__DEV__ === true,
  });

  // `?sim=600` advances the simulation N ticks before the first frame is drawn,
  // with weapons firing and enemies dying. `?start=` alone only moves the clock;
  // this is how you get a field that has actually been fought over — gore on the
  // ground, motes to collect — which is what a screenshot needs to be honest.
  const simTicks = numberParam('sim');
  if (simTicks !== undefined) {
    for (let i = 0; i < Math.min(20000, simTicks); i++) {
      // A level-up freezes the sim and waits for a card. Take the first one and
      // keep fighting, or the fast-forward stops dead at the player's first
      // level and the field never gets fought over.
      if (i % 4 === 0) input.press('1');
      app.update(TICK_DT);
    }
    input.takePressed();
  }

  addEventListener('resize', () => {
    if (surface.resize()) surface.invalidate();
  });

  // Click away from the tab and the run stops rather than dying without you.
  addEventListener('blur', () => app.blur());

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

function runBench(
  app: App,
  surface: CanvasSurface,
  frames: number,
  status: HTMLElement | null,
): void {
  // Warm up first: the glyph cache rasterizes every (character, colour) pair on
  // its first sighting, so the opening frames measure the cache, not the game.
  const WARMUP = 40;
  for (let i = 0; i < WARMUP; i++) {
    app.update(TICK_DT);
    app.render(surface);
    surface.flush();
  }

  const samples: number[] = [];
  const updateMs: number[] = [];
  let drawn = 0;
  for (let i = 0; i < frames; i++) {
    const t = performance.now();
    app.update(TICK_DT);
    const u = performance.now();
    app.render(surface);
    drawn = surface.flush();
    samples.push(performance.now() - t);
    updateMs.push(u - t);
  }

  samples.sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))]!;
  const avgUpdate = updateMs.reduce((a, b) => a + b, 0) / updateMs.length;
  const report =
    `grid ${surface.width}x${surface.height} | glyphs ${drawn} | frames ${frames} | ` +
    `sim ${avgUpdate.toFixed(2)}ms | draw ${(avg - avgUpdate).toFixed(2)}ms | ` +
    `avg ${avg.toFixed(2)}ms | p99 ${p99.toFixed(2)}ms | ` +
    `ceiling ${(1000 / avg).toFixed(0)}fps`;

  console.log(report);
  if (status !== null) {
    status.textContent = report;
    status.setAttribute('data-bench', report);
  }
  document.title = report;
}

/**
 * `?bench=300` measures update+render cost for N frames as fast as the CPU
 * allows, ignoring the display's refresh rate. It's the only honest way to
 * answer "can it hold 120fps": requestAnimationFrame reports 60 on a 60Hz panel
 * no matter how much headroom there is.
 *
 * Deliberately **synchronous, start to finish** — a blocking fetch, no font
 * wait, no await anywhere. An automated harness reads the result out of the DOM,
 * and the DOM is only dumped once `load` has fired. Any `await` in here would
 * push the numbers past that moment and report nothing.
 */
function benchSync(frames: number): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  const status = document.getElementById('status');

  let bundle = inlinedAssets();
  if (bundle === undefined) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'assets.json', false); // sync on purpose; see above
    xhr.send();
    bundle = JSON.parse(xhr.responseText) as AssetBundle;
  }

  const data = buildGameData(bundle.tables);
  const sprites = new SpriteBank();
  sprites.loadFromSources(Object.entries(bundle.sprites));

  const surface = new CanvasSurface(canvas, flag('noglow') ? { glow: 0 } : {});
  const app = new App(data, sprites, new WebInput(), {
    // design.md §16.5, owner feedback 12.07 16:10 ("this light mechanic is so
    // pointless"): normal play is fully lit now — `?dark` opts INTO the old
    // gothic-lantern look instead of `?nodark` opting out of it. `w.dusk`
    // (the boss's phase-3 blackout) is untouched, forced regardless
    // (render.ts's `dark = opts.dark || w.dusk`).
    dark: flag('dark'),
    debug: flag('debug'),
    seed: numberParam('seed'),
    startTime: numberParam('start'),
    god: flag('god'),
    skipTitle: true,
    store: memoryStore(),
  });

  runBench(app, surface, Math.max(30, frames), status);
}

const benchFrames = numberParam('bench');
if (benchFrames !== undefined) {
  benchSync(benchFrames);
} else {
  boot().catch((err: unknown) => {
    const status = document.getElementById('status');
    const message = err instanceof Error ? err.message : String(err);
    if (status !== null) status.textContent = `failed to start: ${message}`;
    console.error(err);
  });
}
