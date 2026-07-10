/** Node-only: read Jane's `.tsv` tables off disk and build a GameData. */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildGameData, TABLE_FILES, type GameData, type TableSources } from './gamedata.ts';

async function readOr(path: string, fallback: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return fallback;
  }
}

export async function readTableSources(assetsDir: string): Promise<TableSources> {
  const entries = await Promise.all(
    TABLE_FILES.map(async (name) => [name, await readOr(join(assetsDir, `${name}.tsv`), '')] as const),
  );
  return Object.fromEntries(entries) as TableSources;
}

export async function loadGameData(assetsDir: string): Promise<GameData> {
  return buildGameData(await readTableSources(assetsDir));
}
