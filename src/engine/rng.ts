/**
 * Seeded PRNG (mulberry32) plus a stateless spatial hash.
 *
 * Everything random in the sim goes through one seeded stream, so a run is
 * reproducible from its seed. That matters for two reasons: bug reports become
 * "here's the seed", and we can add a daily-challenge mode for free later.
 */

export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed: number = (Math.random() * 2 ** 32) >>> 0) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }

  /** Uniform point on the unit circle. */
  onCircle(): { x: number; y: number } {
    const a = this.next() * Math.PI * 2;
    return { x: Math.cos(a), y: Math.sin(a) };
  }
}

/**
 * Deterministic hash of a world coordinate to [0,1). Stateless, so background
 * scatter stays put as the camera moves instead of shimmering every frame.
 */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
