/**
 * Walks `assets/`, parses every `.txt` into a Sprite, and hot-reloads on change.
 *
 * Design rule: **a missing sprite is never an error.** `get()` always returns
 * something drawable. Jane can add art at any time and it shows up; I can
 * reference art that doesn't exist yet and the game still runs. Neither of us
 * ever blocks the other.
 */

import { watch, type FSWatcher } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { Color } from '../engine/color.ts';
import { parseSprite, placeholderSprite, type Sprite } from './sprite.ts';

export class SpriteLoader {
  private readonly root: string;
  private sprites = new Map<string, Sprite>();
  private fallbacks = new Map<string, Sprite>();
  private watcher: FSWatcher | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;

  /** Parse warnings from the most recent load, for the debug overlay. */
  warnings: string[] = [];
  /** Bumped on every successful reload, so callers can invalidate caches. */
  generation = 0;

  constructor(root: string) {
    this.root = root;
  }

  get count(): number {
    return this.sprites.size;
  }

  /** Every sprite id currently loaded, sorted. Used by the asset preview mode. */
  ids(): string[] {
    return [...this.sprites.keys()].sort();
  }

  async load(): Promise<void> {
    const found = new Map<string, Sprite>();
    const warnings: string[] = [];

    let files: string[];
    try {
      files = await walk(this.root);
    } catch {
      // No assets/ directory at all. Perfectly fine — placeholders all the way.
      this.sprites = found;
      this.warnings = [];
      this.generation++;
      return;
    }

    for (const file of files) {
      if (!file.endsWith('.txt')) continue;
      const id = relative(this.root, file).slice(0, -'.txt'.length).split(sep).join('/');
      try {
        const source = await readFile(file, 'utf8');
        const { sprite, warnings: w } = parseSprite(id, source);
        found.set(id, sprite);
        warnings.push(...w);
      } catch (err) {
        warnings.push(`${id}: could not read file (${(err as Error).message})`);
      }
    }

    this.sprites = found;
    this.warnings = warnings;
    this.generation++;
  }

  /**
   * Look up a sprite. If Jane hasn't drawn it yet, synthesize a placeholder
   * from `ch`/`fg` and cache it, so the game keeps rendering something sensible.
   */
  get(id: string, ch?: string, fg?: Color): Sprite {
    const found = this.sprites.get(id);
    if (found !== undefined) return found;

    const cached = this.fallbacks.get(id);
    if (cached !== undefined) return cached;

    const made = placeholderSprite(id, ch, fg);
    this.fallbacks.set(id, made);
    return made;
  }

  /** True if `id` has real art behind it (not a generated placeholder). */
  has(id: string): boolean {
    return this.sprites.has(id);
  }

  /**
   * Re-read assets/ whenever a file changes. Debounced, because editors write
   * a file as several syscalls and we'd otherwise reload three times per save.
   */
  watch(onReload: () => void): void {
    if (this.watcher !== null) return;
    try {
      this.watcher = watch(this.root, { recursive: true }, () => {
        if (this.reloadTimer !== null) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => {
          void this.load().then(() => {
            // A reloaded sprite may now exist for real; drop the placeholders
            // so it gets picked up instead of the cached stand-in.
            this.fallbacks.clear();
            onReload();
          });
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
