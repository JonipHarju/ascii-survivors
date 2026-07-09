/**
 * A parsed set of sprites, with no idea where the bytes came from.
 *
 * Node reads them off disk (`SpriteLoader`); the browser fetches them as one
 * JSON blob. Both end up here, so nothing downstream of this file imports
 * `node:fs` and the game renders identically on both backends.
 *
 * Design rule that survives the port: **a missing sprite is never an error.**
 * `get()` always returns something drawable, so Jane can add art at any time and
 * I can reference art she hasn't drawn yet.
 */

import type { Color } from '../engine/color.ts';
import { parseSprite, placeholderSprite, type Sprite } from './sprite.ts';

export class SpriteBank {
  protected sprites = new Map<string, Sprite>();
  private fallbacks = new Map<string, Sprite>();

  /** Parse warnings from the most recent load, for `--preview` and the debug HUD. */
  warnings: string[] = [];
  /** Bumped on every successful load, so callers can invalidate caches. */
  generation = 0;

  get count(): number {
    return this.sprites.size;
  }

  ids(): string[] {
    return [...this.sprites.keys()].sort();
  }

  /** Replace every sprite from `id -> file contents`. */
  loadFromSources(sources: Iterable<readonly [string, string]>): void {
    const found = new Map<string, Sprite>();
    const warnings: string[] = [];

    for (const [id, source] of sources) {
      const { sprite, warnings: w } = parseSprite(id, source);
      found.set(id, sprite);
      warnings.push(...w);
    }

    this.sprites = found;
    this.warnings = warnings;
    // A sprite that now exists for real must win over the stand-in we invented.
    this.fallbacks.clear();
    this.generation++;
  }

  /**
   * Look up a sprite. If Jane hasn't drawn it yet, synthesize a placeholder from
   * `ch`/`fg` and cache it, so the game keeps rendering something sensible.
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
}
