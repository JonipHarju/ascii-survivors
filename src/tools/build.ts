#!/usr/bin/env node
/**
 * Static production build. `npm run build` -> `dist/index.html`
 *
 * **One file.** Not a folder of modules and an `assets.json` beside them: a
 * single HTML document with the game and Jane's art inlined into it.
 *
 * That is not a size optimization, it is the difference between working and not.
 * A `<script type="module" src="...">` is a fetch, and browsers block fetches
 * from `file://`. On a multi-file build, double-clicking `index.html` runs no
 * JavaScript whatsoever — not even the handler that would have reported it — so
 * the page hangs on its loading text forever. The owner hit exactly this.
 *
 * With everything inlined there is nothing left to block. Double-click it, mail
 * it, drop it on any static host: Vercel, Netlify, Coolify, GitHub Pages, S3,
 * `python -m http.server`. It is all the same file.
 */

import { mkdir, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import { packAssets } from './pack.ts';
import { bundle, inlineJson, scriptSafe } from './bundle.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
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

  // A build that can't be loaded is not a build. The self-contained one has a
  // sharper test than "does the entry file exist": it must contain no reference
  // to a file it does not ship with.
  const external = /<(?:script|link)[^>]*\b(?:src|href)=/i.exec(page);
  if (external !== null) throw new Error(`build: page still loads an external file — ${external[0]}`);
  if (!page.includes('window.__ASSETS__')) throw new Error('build: assets were not inlined');

  const kb = ((await stat(join(DIST, 'index.html'))).size / 1024).toFixed(0);
  console.log(`\n  dist/index.html  ${kb} KB — one self-contained file, no server required`);
  console.log(`  open it directly, or host ${relative(ROOT, DIST)}/ anywhere\n`);
}

/** A private scratch directory that survives a crash without polluting the repo. */
async function mkdtempish(): Promise<string> {
  const dir = join(tmpdir(), `long-night-build-${process.pid}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

await main();
