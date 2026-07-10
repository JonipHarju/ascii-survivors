#!/usr/bin/env node
/**
 * Static production build. `npm run build` -> `dist/`
 *
 * Emits a plain folder of files with no server-side anything: `index.html`, the
 * compiled ES modules, and `assets.json`. That's the whole deployable. Vercel,
 * Netlify, Coolify, GitHub Pages, S3 or `python -m http.server` all serve it
 * identically, because there is nothing to serve but static files.
 */

import { cp, mkdir, rm, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { packAssets } from './pack.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(ROOT, 'dist');

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else total += (await stat(full)).size;
  }
  return total;
}

async function main(): Promise<void> {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  console.log('compiling src/web ...');
  const tsc = spawnSync('npx', ['tsc', '-p', 'tsconfig.web.json', '--outDir', join(DIST, 'dist')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (tsc.status !== 0) {
    console.error(`${tsc.stdout ?? ''}${tsc.stderr ?? ''}`.trim());
    process.exit(1);
  }

  // The page references ./dist/web/boot.js, so the compiled tree keeps its shape.
  await cp(join(ROOT, 'web', 'index.html'), join(DIST, 'index.html'));

  console.log('packing assets ...');
  await writeFile(join(DIST, 'assets.json'), await packAssets(), 'utf8');

  // Source maps are useful in a hosted build and cost the player nothing:
  // the browser only fetches them when devtools is open.
  const bytes = await dirSize(DIST);
  console.log(`\n  dist/  ${(bytes / 1024).toFixed(0)} KB — static, no server required`);
  console.log(`  files rooted at ${relative(ROOT, DIST)}/index.html\n`);

  // A build that can't be loaded is not a build. Check the entry resolves.
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  const m = /src="\.\/(.+?)"/.exec(html);
  if (m === null) throw new Error('index.html has no module entry');
  await stat(join(DIST, m[1]!)); // throws if the compiler put it elsewhere
  console.log(`  entry ok: ${m[1]!}`);
}

await main();
