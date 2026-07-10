/**
 * `assets/juice.tsv` — how the game reacts, in seconds.
 *
 * Jane's framing, from the file: the owner asked why singular characters walking
 * around is still the 1960s, and we read that as "draw better sprites". The
 * sprites were never the problem — *nothing in the game reacted*. A `g` that
 * flinches when you hit it and pops when it dies is more impressive than a `g`
 * drawn in three colours, and it costs no art.
 *
 * Two rules the parser exists to enforce:
 *
 *  - **Everything is in seconds, never in frames.** He also asked for 120fps, and
 *    a flash written as "two frames" runs twice as fast at 120 as at 60. That is
 *    exactly why old ports feel wrong on new hardware. There is no frame count in
 *    this file and there must be none in the code that reads it.
 *  - **Shake amplitude is in cells, and it is less than one.** A character grid
 *    can only shake by a whole cell, and a cell is 1 wu, which is an earthquake.
 *    The canvas offsets the field by a fraction of a cell. design.md §14.
 *
 * Three row kinds: `param`, `shake`, `glyph`.
 */

import { num, readRows } from './tsv.ts';
import { paletteColor } from '../assets/sprite.ts';
import { DEFAULT, type Color } from '../engine/color.ts';

/** One screen-shake event. `amp` is in cells and should be < 1. */
export type ShakeDef = {
  readonly event: string;
  readonly amp: number;
  readonly seconds: number;
};

export type JuiceGlyph = {
  readonly name: string;
  /** The characters this layer owns. `number` owns all ten digits. */
  readonly chars: string;
  readonly color: Color;
};

export type JuiceTable = {
  readonly params: ReadonlyMap<string, number>;
  readonly shakes: ReadonlyMap<string, ShakeDef>;
  readonly glyphs: ReadonlyMap<string, JuiceGlyph>;
  readonly warnings: readonly string[];
};

/**
 * What a table that forgot to mention a number falls back to. These are Jane's
 * values, copied; the table is the source of truth and this is the safety net
 * that keeps a missing `juice.tsv` from making the game feel dead rather than
 * making it crash.
 */
const DEFAULT_PARAMS: Readonly<Record<string, number>> = {
  hit_flash: 0.06,
  hit_flash_lift: 0.55,
  death_flash: 0.05,

  num_life: 0.55,
  num_rise: 3,
  num_lift_per_hit: 0.12,
  num_lift_max: 0.6,
  num_max: 40,
  num_min: 1,

  hitstop: 0.05,
  hitstop_gap: 0.2, // refractory after a freeze, so a swarm can't stack them into a judder
  levelup_hitstop: 0.08,
  levelup_flash: 0.12,

  ember_rate: 6,
  ember_r_in: 3,
  ember_life: 1.2,
  ember_drift: 4,
  ember_max: 60,
  ember_level: 0.45,

  mote_trail: 2,
  mote_trail_level: 0.4,
};

/** No shake at all is the right fallback: a missing table must not shake the screen. */
export function parseJuice(source: string): JuiceTable {
  const params = new Map<string, number>(Object.entries(DEFAULT_PARAMS));
  const shakes = new Map<string, ShakeDef>();
  const glyphs = new Map<string, JuiceGlyph>();
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const f = row.cells;
    const kind = f[0];

    if (kind === 'param') {
      if (f.length < 3) {
        warnings.push(`juice.tsv:${row.line}: param needs a name and value`);
        continue;
      }
      params.set(f[1]!, num(f[2]));
      continue;
    }

    if (kind === 'shake') {
      if (f.length < 4) {
        warnings.push(`juice.tsv:${row.line}: shake needs event, amp, seconds`);
        continue;
      }
      const event = f[1]!;
      const amp = num(f[2]);
      const seconds = num(f[3]);

      // Jane's own constraint, checked rather than trusted. A whole-cell shake is
      // an earthquake, and it is the one way this table can wreck the screen.
      if (amp > 1) warnings.push(`juice.tsv:${row.line}: shake '${event}' amp ${amp} is over a whole cell`);
      shakes.set(event, { event, amp, seconds });
      continue;
    }

    if (kind === 'glyph') {
      if (f.length < 4) {
        warnings.push(`juice.tsv:${row.line}: glyph needs name, chars, colour`);
        continue;
      }
      const color = paletteColor(f[3]!) ?? DEFAULT;
      glyphs.set(f[1]!, { name: f[1]!, chars: f[2]!, color });
      continue;
    }

    warnings.push(`juice.tsv:${row.line}: unknown row kind '${kind ?? ''}'`);
  }

  return { params, shakes, glyphs, warnings };
}

/** A juice number, by name. Falls back to Jane's value, then to 0. */
export function juice(table: JuiceTable, name: string): number {
  return table.params.get(name) ?? DEFAULT_PARAMS[name] ?? 0;
}

/**
 * A shake event's definition, or `null` when the table doesn't list it.
 *
 * `null` means *don't shake*, and that is deliberate: Jane lists exactly four
 * events for a twenty-minute run. An unlisted event is not an oversight to paper
 * over with a default — it is her saying the screen should hold still.
 */
export function shakeDef(table: JuiceTable, event: string): ShakeDef | null {
  return table.shakes.get(event) ?? null;
}

export function juiceGlyph(table: JuiceTable, name: string, fallbackChar: string, fallbackColor: Color): JuiceGlyph {
  return table.glyphs.get(name) ?? { name, chars: fallbackChar, color: fallbackColor };
}

export function fallbackJuice(): JuiceTable {
  return {
    params: new Map(Object.entries(DEFAULT_PARAMS)),
    shakes: new Map(),
    glyphs: new Map(),
    warnings: ['juice.tsv missing — the game will still react, but on my numbers, not Jane’s'],
  };
}
