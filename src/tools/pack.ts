#!/usr/bin/env node
/**
 * Packs `assets/` into a single JSON the browser can fetch.
 *
 * The browser can't walk a directory, so we ship one blob containing the exact
 * bytes of Jane's `.txt` art and `.tsv` tables. Both builds then parse the same
 * source text with the same parsers — there is no second, web-only asset format
 * to keep in sync, which is the only reason this port stayed small.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSpriteSources } from '../assets/loader.ts';
import { readTableSources } from '../data/gamedata.node.ts';
import { TABLE_FILES } from '../data/gamedata.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = join(ROOT, 'assets');
const OUT = join(ROOT, 'web', 'assets.json');

export async function packAssets(): Promise<string> {
  const [tables, spriteList] = await Promise.all([readTableSources(ASSETS), readSpriteSources(ASSETS)]);
  return JSON.stringify({ tables, sprites: Object.fromEntries(spriteList) });
}

async function main(): Promise<void> {
  const json = await packAssets();
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, json, 'utf8');

  const bundle = JSON.parse(json) as { sprites: Record<string, string> };
  const kb = (json.length / 1024).toFixed(1);
  console.log(
    `packed ${Object.keys(bundle.sprites).length} sprites + ${TABLE_FILES.length} tables -> web/assets.json (${kb} KB)`,
  );
}

// Only run when invoked directly; `serve.ts` imports `packAssets` instead.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
