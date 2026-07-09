/**
 * Contact radii, derived from sprite art.
 *
 * jane.md: "Hitboxes stay circles in wu, sized to a sprite's inner mass, not its
 * bounding box. Big sprites must not become unfair sprites."
 *
 * So we count a sprite's *opaque* cells, convert that area into world units (a
 * cell is 1 wu wide and 2 wu tall), and take the radius of the equal-area circle
 * — then shrink it, because a creature's silhouette is always more forgiving
 * than its mass suggests. A 9x5 Gravewarden whose art is mostly limbs gets a
 * hitbox around its torso, not around its reach.
 */

import type { SpriteBank } from '../assets/bank.ts';
import { WU_PER_ROW } from './world.ts';

/** Nothing is smaller than a glyph, and nothing is unfairly huge. */
const MIN_RADIUS = 1.0;
const MAX_RADIUS = 4.5;
/** Silhouettes are forgiving. Tuned so a 3x2 ghoul lands near 1.4 wu. */
const MASS_SCALE = 0.62;

function radiusFromSprite(bank: SpriteBank, id: string): number | null {
  const sprite = bank.get(id);
  if (sprite.placeholder) return null;

  const frame = sprite.frames[0]!;
  let filled = 0;
  for (const cell of frame.cells) if (cell !== null) filled++;
  if (filled === 0) return null;

  const areaWu = filled * WU_PER_ROW; // 1 cell = 1 wu x 2 wu
  const r = Math.sqrt(areaWu / Math.PI) * MASS_SCALE;
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r));
}

/**
 * Build the `id -> radius` lookup the sim uses for contact damage. Cached, since
 * it's called for every enemy every tick.
 */
export function makeHitRadius(bank: SpriteBank): (id: string) => number {
  const cache = new Map<string, number>();
  return (id: string): number => {
    const hit = cache.get(id);
    if (hit !== undefined) return hit;

    const r =
      radiusFromSprite(bank, `sprites/mobs/${id}`) ??
      radiusFromSprite(bank, `sprites/elites/${id}`) ??
      radiusFromSprite(bank, `sprites/${id}`) ??
      MIN_RADIUS;

    cache.set(id, r);
    return r;
  };
}
