/**
 * Parser for `assets/glyphs.tsv` — Jane's entity table.
 *
 * She asked, in the file's own header: "John: parse this, don't hardcode
 * glyphs." So the game's stats, glyphs, colours, spawn times and budget costs
 * all come from here at load time. Retuning the difficulty curve is an art-side
 * edit, not a code change, which is exactly the right seam between us.
 *
 * The file holds three kinds of row, distinguished by shape:
 *   - entities (player, enemies, bosses): 10-11 tab-separated columns
 *   - pickups: same columns, with `-` where a stat doesn't apply
 *   - decals:  5 columns, id starting with `decal`
 */

import { readFile } from 'node:fs/promises';

import { paletteColor } from '../assets/sprite.ts';
import type { Color } from '../engine/color.ts';

export type EntityDef = {
  readonly id: string;
  readonly glyph: string;
  readonly name: string;
  readonly color: Color;
  readonly hp: number;
  /** World units per second. Isotropic — see design.md §5. */
  readonly speed: number;
  /** Contact damage dealt to the player. */
  readonly power: number;
  /** Spawn-director budget cost. 0 means never budget-spawned. */
  readonly cost: number;
  /** Earliest budget spawn time, in seconds. null = scripted/boss only. */
  readonly from: number | null;
  /** XP motes dropped. */
  readonly xp: number;
  readonly notes: string;
};

export type DecalDef = {
  readonly id: string;
  readonly glyph: string;
  readonly color: Color;
  readonly ageFrom: number;
  readonly ageTo: number;
};

export type GlyphTable = {
  readonly entities: ReadonlyMap<string, EntityDef>;
  /** Ordered by `ageFrom`, so a linear scan finds the right stage. */
  readonly decals: readonly DecalDef[];
  readonly warnings: readonly string[];
};

/** `mm:ss` -> seconds. `-` or junk -> null. */
function parseTime(raw: string): number | null {
  const s = raw.trim();
  if (s === '' || s === '-') return null;
  const m = /^(\d+):(\d{1,2})$/.exec(s);
  if (m === null) return null;
  return Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10);
}

/** Numeric cell; `-` and blanks mean "not applicable", which we model as 0. */
function parseNum(raw: string): number {
  const s = raw.trim();
  if (s === '' || s === '-') return 0;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseGlyphTable(source: string): GlyphTable {
  const entities = new Map<string, EntityDef>();
  const decals: DecalDef[] = [];
  const warnings: string[] = [];

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trimEnd();
    if (line.trim() === '' || line.startsWith('#')) continue;

    const f = line.split('\t').map((c) => c.trim());
    const where = `glyphs.tsv:${i + 1}`;

    // Decal rows: decalN <glyph> <colour> <age_from> <age_to>
    if (f[0]!.startsWith('decal') && f.length >= 5) {
      const color = paletteColor(f[2]!);
      if (color === undefined) {
        warnings.push(`${where}: unknown palette char '${f[2]}' for ${f[0]}`);
        continue;
      }
      decals.push({
        id: f[0]!,
        glyph: f[1]!,
        color,
        ageFrom: parseNum(f[3]!),
        ageTo: parseNum(f[4]!),
      });
      continue;
    }

    // Entity / pickup rows.
    if (f.length < 10) {
      warnings.push(`${where}: expected >=10 columns, got ${f.length} — skipped`);
      continue;
    }

    const id = f[0]!;
    const color = paletteColor(f[3]!);
    if (color === undefined) {
      warnings.push(`${where}: unknown palette char '${f[3]}' for '${id}'`);
    }

    entities.set(id, {
      id,
      glyph: f[1]!,
      name: f[2]!,
      color: color ?? 0xc7c7c7,
      hp: parseNum(f[4]!),
      speed: parseNum(f[5]!),
      power: parseNum(f[6]!),
      cost: parseNum(f[7]!),
      from: parseTime(f[8]!),
      xp: parseNum(f[9]!),
      notes: f[10] ?? '',
    });
  }

  decals.sort((a, b) => a.ageFrom - b.ageFrom);

  if (entities.size === 0) warnings.push('glyphs.tsv: no entities parsed — falling back to built-ins');

  return { entities, decals, warnings };
}

/**
 * Minimal built-ins so the game still boots if `glyphs.tsv` is missing or
 * mangled. Deliberately terse: this is a lifeboat, not a second source of truth.
 */
function fallbackTable(): GlyphTable {
  const mk = (
    id: string,
    glyph: string,
    name: string,
    hp: number,
    speed: number,
    power: number,
    cost: number,
    from: number | null,
    xp: number,
  ): EntityDef => ({ id, glyph, name, color: 0xc7c7c7, hp, speed, power, cost, from, xp, notes: '' });

  const entities = new Map<string, EntityDef>([
    ['player', mk('player', '@', 'The Warden', 100, 20, 0, 0, null, 0)],
    ['ghoul', mk('ghoul', 'g', 'Ghoul', 10, 9, 4, 1, 0, 1)],
  ]);
  return { entities, decals: [], warnings: ['using built-in fallback entity table'] };
}

export async function loadGlyphTable(path: string): Promise<GlyphTable> {
  try {
    return parseGlyphTable(await readFile(path, 'utf8'));
  } catch {
    return fallbackTable();
  }
}

/** Look up a definition, or die loudly — a missing id is a code bug, not art drift. */
export function requireDef(table: GlyphTable, id: string): EntityDef {
  const d = table.entities.get(id);
  if (d === undefined) {
    throw new Error(`glyphs.tsv has no entity '${id}' (add the row, or fix the id in code)`);
  }
  return d;
}
