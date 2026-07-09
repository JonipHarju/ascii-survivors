/**
 * `assets/countess.tsv` — the boss fight (design.md §10).
 *
 * She spawns at 19:00, the clock freezes, and the ambient director halts: the
 * night ends when she dies, not when a timer expires. A 20-minute run must never
 * be decided by the player standing in a corner.
 *
 * The fight is three phases keyed on her HP fraction, and the numbers that make
 * each one readable — the 0.8s telegraph before a charge, the 90°/s turn rate
 * that makes her baitable, the 4s burning trail that fills the arena with her own
 * exhaust — all live here rather than in the code that reads them.
 */

import { num, readRows } from './tsv.ts';

export type PhaseAction = 'summon_ring' | 'charge';

export type Phase = {
  readonly id: string;
  /** HP percentage this phase begins at (100 = full). */
  readonly hpFrom: number;
  /** HP percentage it ends at. */
  readonly hpTo: number;
  /** Cruise speed in wu/s; overrides `speed` from glyphs.tsv. */
  readonly speed: number;
  readonly action: PhaseAction;
  /** Seconds between actions. */
  readonly cadence: number;
  /** Action magnitude: bats per ring, or charges per cycle. */
  readonly count: number;
  readonly note: string;
};

export type CountessTable = {
  readonly params: ReadonlyMap<string, number>;
  /** The trail glyph is the one non-numeric param. */
  readonly trailGlyph: string;
  /** Ordered from full health downward. */
  readonly phases: readonly Phase[];
  readonly warnings: readonly string[];
};

const DEFAULT_PARAMS: Readonly<Record<string, number>> = {
  arrive_at: 1140,
  freeze_clock: 1,
  halt_director: 1,
  telegraph: 0.8,
  charge_speed: 52,
  turn_rate: 90,
  trail_damage: 8,
  trail_life: 4.0,
  enrage_after: 120,
};

const ACTIONS = new Set<string>(['summon_ring', 'charge']);

export function parseCountess(source: string): CountessTable {
  const params = new Map<string, number>(Object.entries(DEFAULT_PARAMS));
  const phases: Phase[] = [];
  const warnings: string[] = [];
  let trailGlyph = '▓';

  for (const row of readRows(source)) {
    const f = row.cells;

    if (f[0] === 'param') {
      if (f.length < 3) {
        warnings.push(`countess.tsv:${row.line}: param needs a name and value`);
        continue;
      }
      const name = f[1]!;
      if (name === 'trail_glyph') {
        trailGlyph = f[2]!;
        continue;
      }
      params.set(name, num(f[2]));
      continue;
    }

    if (f[0] === 'phase') {
      if (f.length < 8) {
        warnings.push(`countess.tsv:${row.line}: phase needs id, hp_from, hp_to, speed, action, cadence, count`);
        continue;
      }
      const action = f[5]!;
      if (!ACTIONS.has(action)) {
        warnings.push(`countess.tsv:${row.line}: unknown action '${action}'`);
        continue;
      }
      phases.push({
        id: f[1]!,
        hpFrom: num(f[2], 100),
        hpTo: num(f[3]),
        speed: num(f[4]),
        action: action as PhaseAction,
        cadence: Math.max(0.1, num(f[6], 1)),
        count: Math.max(1, num(f[7], 1)),
        note: f[8] ?? '',
      });
      continue;
    }

    warnings.push(`countess.tsv:${row.line}: unknown row kind '${f[0] ?? ''}'`);
  }

  phases.sort((a, b) => b.hpFrom - a.hpFrom);
  if (phases.length === 0) warnings.push('countess.tsv: no phases — the boss will just stand there');

  return { params, trailGlyph, phases, warnings };
}

export function countessParam(t: CountessTable, name: string): number {
  return t.params.get(name) ?? DEFAULT_PARAMS[name] ?? 0;
}

/** Which phase a given HP fraction (0..1) falls into. Never returns null if any exist. */
export function phaseFor(t: CountessTable, hpFraction: number): Phase | null {
  const pct = hpFraction * 100;
  for (const p of t.phases) {
    if (pct <= p.hpFrom && pct > p.hpTo) return p;
  }
  // Below the last band (she's dying) or above the first (rounding): clamp.
  return t.phases[t.phases.length - 1] ?? null;
}

export function fallbackCountess(): CountessTable {
  return {
    params: new Map(Object.entries(DEFAULT_PARAMS)),
    trailGlyph: '▓',
    phases: [],
    warnings: ['countess.tsv missing — the boss fight will be inert'],
  };
}
