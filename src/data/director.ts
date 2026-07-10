/**
 * `assets/director.tsv` — the spawn director, as a closed loop.
 *
 * Jane's reasoning, from the file: a budget that pays out points and spends them
 * on enemies is *open loop*. Population is whatever `spawns - kills` integrates
 * to, so a weak build drowns in 8,400 enemies and a strong one clears the field.
 * Two players get two different games.
 *
 * So instead the director **targets a head-count** and spawns to fill the
 * deficit, rate-limited by a cap. That makes late-game density a designed
 * quantity rather than an emergent one, and it's why `cost` in glyphs.tsv is now
 * only an advisory threat rating.
 *
 * Three row kinds share the file: `param`, `mix`, `beat`.
 */

import { num, parseTime, readRows } from './tsv.ts';

export type BeatKind = 'swarm' | 'flock' | 'wall' | 'ring' | 'elite' | 'tide' | 'boss';

const BEAT_KINDS = new Set<string>(['swarm', 'flock', 'wall', 'ring', 'elite', 'tide', 'boss']);

export type MixEntry = {
  readonly entity: string;
  /** Seconds; the entity cannot spawn before this. */
  readonly from: number;
  readonly weightEarly: number;
  readonly weightLate: number;
};

export type Beat = {
  readonly time: number;
  readonly kind: BeatKind;
  /** `-` for beats that don't name one (tide). */
  readonly entity: string | null;
  readonly count: number;
  readonly note: string;
};

export type DirectorTable = {
  readonly params: ReadonlyMap<string, number>;
  readonly mix: readonly MixEntry[];
  /** Sorted by time, so the runtime just walks a cursor forward. */
  readonly beats: readonly Beat[];
  readonly warnings: readonly string[];
};

const DEFAULT_PARAMS: Readonly<Record<string, number>> = {
  run_duration: 1200,
  target_start: 3,
  target_end: 300,
  target_curve: 1.5,
  cap_start: 15,
  cap_end: 60,
  spawn_margin: 4,
  despawn_margin: 40,

  // Feel and legibility. Jane's, and she reasons about them in `director.tsv` —
  // these are only the values a table that forgot to mention them falls back to.
  pickup_radius_base: 12,
  ring_radius_frac: 0.95,
  gore_chance: 0.35,
  gore_level: 0.55,
  mote_lift: 0.1,
  mote_pulse: 0.25,
  mote_pulse_hz: 1.5,
};

export function parseDirector(source: string): DirectorTable {
  const params = new Map<string, number>(Object.entries(DEFAULT_PARAMS));
  const mix: MixEntry[] = [];
  const beats: Beat[] = [];
  const warnings: string[] = [];

  for (const row of readRows(source)) {
    const f = row.cells;
    const kind = f[0];

    if (kind === 'param') {
      if (f.length < 3) {
        warnings.push(`director.tsv:${row.line}: param needs a name and value`);
        continue;
      }
      params.set(f[1]!, num(f[2]));
      continue;
    }

    if (kind === 'mix') {
      if (f.length < 5) {
        warnings.push(`director.tsv:${row.line}: mix needs entity, from, early, late`);
        continue;
      }
      mix.push({
        entity: f[1]!,
        from: parseTime(f[2]) ?? 0,
        weightEarly: num(f[3]),
        weightLate: num(f[4]),
      });
      continue;
    }

    if (kind === 'beat') {
      if (f.length < 5) {
        warnings.push(`director.tsv:${row.line}: beat needs time, kind, entity, count`);
        continue;
      }
      const time = parseTime(f[1]);
      const beatKind = f[2]!;
      if (time === null) {
        warnings.push(`director.tsv:${row.line}: bad beat time '${f[1]}'`);
        continue;
      }
      if (!BEAT_KINDS.has(beatKind)) {
        warnings.push(`director.tsv:${row.line}: unknown beat kind '${beatKind}'`);
        continue;
      }
      const entity = f[3] === '-' || f[3] === undefined || f[3] === '' ? null : f[3];
      beats.push({ time, kind: beatKind as BeatKind, entity, count: num(f[4], 1), note: f[5] ?? '' });
      continue;
    }

    warnings.push(`director.tsv:${row.line}: unknown row kind '${kind ?? ''}'`);
  }

  beats.sort((a, b) => a.time - b.time);

  return { params, mix, beats, warnings };
}

export function param(table: DirectorTable, name: string): number {
  return table.params.get(name) ?? DEFAULT_PARAMS[name] ?? 0;
}

/** `target(t) = start + (end-start) * (t/dur)^curve` — back-loaded when curve > 1. */
export function targetPopulation(table: DirectorTable, time: number): number {
  const dur = param(table, 'run_duration');
  const t = Math.max(0, Math.min(1, time / dur));
  const start = param(table, 'target_start');
  const end = param(table, 'target_end');
  return start + (end - start) * Math.pow(t, param(table, 'target_curve'));
}

/** `cap(t)` — spawns per second, so 0:00 can't dogpile and 20:00 can keep up. */
export function spawnCap(table: DirectorTable, time: number): number {
  const dur = param(table, 'run_duration');
  const t = Math.max(0, Math.min(1, time / dur));
  return param(table, 'cap_start') + (param(table, 'cap_end') - param(table, 'cap_start')) * t;
}

/** Weight lerps early->late across the run, and is gated by the `from` time. */
export function mixWeight(table: DirectorTable, entry: MixEntry, time: number): number {
  if (time < entry.from) return 0;
  const t = Math.max(0, Math.min(1, time / param(table, 'run_duration')));
  return Math.max(0, entry.weightEarly + (entry.weightLate - entry.weightEarly) * t);
}

export function fallbackDirector(): DirectorTable {
  return {
    params: new Map(Object.entries(DEFAULT_PARAMS)),
    mix: [{ entity: 'ghoul', from: 0, weightEarly: 100, weightLate: 100 }],
    beats: [],
    warnings: ['director.tsv missing — using a ghouls-only fallback'],
  };
}
