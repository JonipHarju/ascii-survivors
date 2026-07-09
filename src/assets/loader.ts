/**
 * Node-only: walks `assets/`, feeds every `.txt` into a SpriteBank, and
 * hot-reloads on change. The browser build never imports this file — it fetches
 * a packed JSON of the same sources and calls `loadFromSources` directly.
 */

import { watch, type FSWatcher } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { SpriteBank } from './bank.ts';

export class SpriteLoader extends SpriteBank {
  private readonly root: string;
  private watcher: FSWatcher | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;

  constructor(root: string) {
    super();
    this.root = root;
  }

  async load(): Promise<void> {
    const sources = await readSpriteSources(this.root);
    this.loadFromSources(sources);
  }

  /**
   * Re-read assets/ whenever a file changes. Debounced, because editors write a
   * file as several syscalls and we'd otherwise reload three times per save.
   */
  watch(onReload: () => void): void {
    if (this.watcher !== null) return;
    try {
      this.watcher = watch(this.root, { recursive: true }, () => {
        if (this.reloadTimer !== null) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => {
          void this.load().then(onReload);
        }, 60);
      });
    } catch {
      // Some platforms don't support recursive watch, and assets/ may not exist
      // yet. Hot reload is a nicety; the game runs fine without it.
    }
  }

  unwatch(): void {
    if (this.reloadTimer !== null) clearTimeout(this.reloadTimer);
    this.watcher?.close();
    this.watcher = null;
  }
}

/**
 * `assets/enemies/bat.txt` -> id `enemies/bat`. Shared with the asset packer so
 * the browser build derives exactly the same ids.
 */
export async function readSpriteSources(root: string): Promise<Array<[string, string]>> {
  let files: string[];
  try {
    files = await walk(root);
  } catch {
    return []; // No assets/ directory at all. Placeholders all the way.
  }

  const out: Array<[string, string]> = [];
  for (const file of files) {
    if (!file.endsWith('.txt')) continue;
    const id = relative(root, file).slice(0, -'.txt'.length).split(sep).join('/');
    try {
      out.push([id, await readFile(file, 'utf8')]);
    } catch {
      // Unreadable file: skip it rather than take the game down.
    }
  }
  return out;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}
