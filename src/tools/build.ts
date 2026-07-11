#!/usr/bin/env node
/**
 * Static production build. `npm run build` -> `dist/index.html` (+ `dist/assets/`)
 *
 * **One HTML file**, still. The JS bundle, Jane's `.txt`/`.tsv` text, and every
 * game table are inlined into `index.html` exactly as before — that part of the
 * story hasn't changed, and the reason hasn't either: a
 * `<script type="module" src="...">` is a fetch, and browsers block fetches
 * from `file://`. On a multi-file build, double-clicking `index.html` runs no
 * JavaScript whatsoever — not even the handler that would have reported it — so
 * the page hangs on its loading text forever. The owner hit exactly this.
 *
 * **What changed (john.md, the space pivot):** raster ship art and sound are
 * binary and the purchased pack is 620MB — nowhere near base64-inlinable. Those
 * ship as ordinary files under `dist/assets/`, copied by `copyReferencedMedia`
 * from only what `images.tsv`/`audio.tsv` name, not the whole pack. That still
 * drops onto any static host unchanged (Vercel, Netlify, Coolify, GitHub Pages,
 * S3, `python -m http.server`) — a folder with an index and an assets/
 * subfolder is exactly what those expect. The one thing it costs: a
 * double-clicked `dist/index.html` opened straight off disk (`file://`) will
 * still show the game and its ship art (`<img>` loads work over `file://`), but
 * play **silent** — `fetch()`, which `WebAudioSink` needs to decode audio, is
 * blocked on `file://` by browser CORS policy. Serving the folder (`npm start`,
 * or any static host) has sound; only the raw-double-click fallback doesn't.
 */

import { mkdir, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import { packAssets } from './pack.ts';
import { bundle, inlineJson, scriptSafe } from './bundle.ts';
import { copyReferencedMedia } from './media.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = join(ROOT, 'assets');
const DIST = join(ROOT, 'dist');
const ENTRY = 'web/boot';

/** Compile `src/web` to CommonJS in a scratch dir, the shape `bundle.ts` eats. */
function compile(outDir: string): void {
  const tsc = spawnSync('npx', ['tsc', '-p', 'tsconfig.bundle.json', '--outDir', outDir], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (tsc.status !== 0) {
    console.error(`${tsc.stdout ?? ''}${tsc.stderr ?? ''}`.trim());
    process.exit(1);
  }
}

/**
 * Swap the dev page's two scripts — the file:// tripwire and the module tag —
 * for the inlined assets and the bundle. Everything else about the page (the
 * vignette, the title, the layout) stays exactly as it is in `web/index.html`,
 * so there is one page to style and no second copy to keep in sync.
 */
function inline(html: string, assets: string, js: string): string {
  const withoutDevScripts = html.replace(/[ \t]*<!--[\s\S]*?-->\s*<script>[\s\S]*?<\/script>\s*/, '').replace(
    /[ \t]*<script type="module"[^>]*><\/script>\s*/,
    '',
  );
  if (withoutDevScripts.includes('<script')) throw new Error('build: a script survived the strip');

  return withoutDevScripts.replace(
    '</body>',
    `    <script>window.__ASSETS__ = ${inlineJson(assets)};</script>\n` +
      `    <script>\n${js}\n    </script>\n  </body>`,
  );
}

async function main(): Promise<void> {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const scratch = join(await mkdtempish(), 'cjs');
  console.log('compiling src/web ...');
  compile(scratch);

  console.log('bundling ...');
  const js = await bundle(scratch, ENTRY);

  console.log('packing assets ...');
  const assets = await packAssets();

  const page = inline(await readFile(join(ROOT, 'web', 'index.html'), 'utf8'), assets, scriptSafe(js));
  await writeFile(join(DIST, 'index.html'), page, 'utf8');
  await rm(scratch, { recursive: true, force: true });

  // A build that can't be loaded is not a build. The HTML has a sharper test
  // than "does the entry file exist": it must load no *markup* reference to a
  // file it does not ship with. (Binary media is fetched from JS at runtime,
  // deliberately — see the file header — so this check is unaffected by it.)
  const external = /<(?:script|link)[^>]*\b(?:src|href)=/i.exec(page);
  if (external !== null) throw new Error(`build: page still loads an external file — ${external[0]}`);
  if (!page.includes('window.__ASSETS__')) throw new Error('build: assets were not inlined');

  console.log('copying referenced media ...');
  const media = await copyReferencedMedia(ASSETS, join(DIST, 'assets'));
  for (const f of media.failed) console.warn(`  ! ${f}`);

  const kb = ((await stat(join(DIST, 'index.html'))).size / 1024).toFixed(0);
  console.log(`\n  dist/index.html  ${kb} KB  +  ${media.copied} media file(s) in dist/assets/`);
  console.log(`  serve ${relative(ROOT, DIST)}/ anywhere static (npm run preview does this locally)`);
  console.log(`  double-clicking index.html works too, but plays silent — see the file header\n`);
}

/** A private scratch directory that survives a crash without polluting the repo. */
async function mkdtempish(): Promise<string> {
  const dir = join(tmpdir(), `long-night-build-${process.pid}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

await main();
