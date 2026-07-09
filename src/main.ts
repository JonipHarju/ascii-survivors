#!/usr/bin/env node
/**
 * THE LONG NIGHT — entry point.
 *
 * Wires the terminal, renderer, input, asset loader and game loop together,
 * then gets out of the way. Run it with `npm start`.
 *
 *   --no-dark       disable the light radius (design.md §9 asked for this switch)
 *   --debug         fps / entity counters in the HUD corner
 *   --watch         hot-reload assets/ while the game runs
 *   --seed <n>      deterministic run
 *   --start <mm:ss> begin the run at this clock time, to inspect the late game
 *   --no-autoface   the Chain never aims itself; you turn only by walking
 *   --god           invulnerable, for watching the late game
 *   --no-save       don't touch the save file (gold never persists)
 *   --preview       dump every sprite in assets/ and exit (no game loop)
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SpriteLoader } from './assets/loader.ts';
import { frameAt } from './assets/sprite.ts';
import { detectDepth } from './engine/color.ts';
import { GameLoop } from './engine/loop.ts';
import { Input } from './engine/input.ts';
import { Renderer } from './engine/renderer.ts';
import { Terminal } from './engine/terminal.ts';
import { loadGameData } from './data/gamedata.node.ts';
import { App, MIN_COLS, MIN_ROWS } from './game/app.ts';
import { fileStore } from './game/save.node.ts';
import { memoryStore } from './game/save.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');

type Args = {
  dark: boolean;
  debug: boolean;
  watch: boolean;
  preview: boolean;
  seed: number | undefined;
  startTime: number | undefined;
  autoFace: boolean;
  god: boolean;
  save: boolean;
  shop: boolean;
};

/** `mm:ss` or a bare seconds count. */
function parseClock(raw: string): number | undefined {
  const m = /^(\d+):(\d{1,2})$/.exec(raw);
  if (m !== null) return Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    dark: true,
    debug: false,
    watch: false,
    preview: false,
    seed: undefined,
    startTime: undefined,
    autoFace: true,
    god: false,
    save: true,
    shop: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-dark') args.dark = false;
    else if (a === '--no-autoface') args.autoFace = false;
    else if (a === '--god') args.god = true;
    else if (a === '--no-save') args.save = false;
    else if (a === '--shop') args.shop = true;
    else if (a === '--debug') args.debug = true;
    else if (a === '--watch') args.watch = true;
    else if (a === '--preview') args.preview = true;
    else if (a === '--seed') {
      const n = Number.parseInt(argv[++i] ?? '', 10);
      if (Number.isFinite(n)) args.seed = n;
    } else if (a === '--start') args.startTime = parseClock(argv[++i] ?? '');
  }
  return args;
}

/**
 * Render every sprite to stdout and exit. This is Jane's feedback loop: she can
 * check her art loads, is the size she thinks it is, and is coloured how she
 * meant, without playing to minute 14 to see a Stalker.
 */
async function preview(loader: SpriteLoader): Promise<void> {
  await loader.load();

  const depth = detectDepth();
  console.log(`assets: ${loader.count} sprites, colour depth: ${depth}\n`);

  for (const id of loader.ids()) {
    const sprite = loader.get(id);
    const f = sprite.frames[0]!;
    const frames = sprite.frames.length > 1 ? `, ${sprite.frames.length} frames @ ${sprite.fps}fps` : '';
    console.log(`\x1b[1m${id}\x1b[0m  (${f.w}x${f.h}, anchor ${sprite.anchor}${frames})`);

    const r = new Renderer(f.w, f.h, depth);
    r.clear();
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const cell = f.cells[y * f.w + x];
        if (cell != null) r.set(x, y, cell.ch, cell.fg);
      }
    }
    // Render into a string rather than to the live cursor.
    const lines: string[] = [];
    for (let y = 0; y < f.h; y++) {
      let line = '  ';
      for (let x = 0; x < f.w; x++) {
        const cell = f.cells[y * f.w + x];
        line += cell == null ? ' ' : `\x1b[38;2;${(cell.fg >> 16) & 255};${(cell.fg >> 8) & 255};${cell.fg & 255}m${cell.ch}\x1b[0m`;
      }
      lines.push(line);
    }
    console.log(lines.join('\n'));
    console.log();
  }

  if (loader.warnings.length > 0) {
    console.log('\x1b[33mwarnings:\x1b[0m');
    for (const w of loader.warnings) console.log(`  ${w}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const loader = new SpriteLoader(ASSETS);

  if (args.preview) {
    await preview(loader);
    return;
  }

  const [data] = await Promise.all([loadGameData(ASSETS), loader.load()]);

  const term = new Terminal();
  if (!term.isTTY) {
    console.error('THE LONG NIGHT needs an interactive terminal (stdin/stdout must be a TTY).');
    console.error('Try: npm start   — from a real shell, not a pipe.');
    process.exitCode = 1;
    return;
  }
  if (term.cols < MIN_COLS || term.rows < MIN_ROWS) {
    console.error(`Needs a terminal of at least ${MIN_COLS}x${MIN_ROWS}. Yours is ${term.cols}x${term.rows}.`);
    process.exitCode = 1;
    return;
  }

  const depth = detectDepth();
  const input = new Input();

  term.enter();
  await input.negotiate();
  input.start();

  let renderer = new Renderer(term.cols, term.rows, depth);
  const app = new App(data, loader, input, {
    dark: args.dark,
    debug: args.debug,
    seed: args.seed,
    startTime: args.startTime,
    autoFace: args.autoFace,
    god: args.god,
    store: args.save ? fileStore() : memoryStore(),
    openShop: args.shop,
  });

  term.onResize((cols, rows) => {
    renderer = new Renderer(cols, rows, depth);
    renderer.invalidate();
    term.write('\x1b[2J');
  });

  if (args.watch) loader.watch(() => renderer.invalidate());

  const loop = new GameLoop({
    update: (dt) => app.update(dt),
    render: () => {
      app.fps = loop.fps;
      app.render(renderer);
      renderer.flush();
    },
    shouldStop: () => app.done,
  });

  await loop.start();

  loader.unwatch();
  input.teardown();
  term.restore();

  const warnings = [...loader.warnings, ...data.warnings];
  if (warnings.length > 0) {
    console.log('\nasset warnings:');
    for (const w of warnings) console.log(`  ${w}`);
  }
}

await main();
