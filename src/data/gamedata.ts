/**
 * Every table Jane owns, assembled in one place.
 *
 * `buildGameData` is pure — it takes the raw text of each `.tsv` and nothing
 * else, so the browser can build the same GameData from a fetched blob. The
 * filesystem version lives in `gamedata.node.ts`.
 *
 * Each table degrades to a fallback on its own rather than taking the game down.
 * A missing `weapons.tsv` should cost you weapons, not the process.
 */

import { parseGlyphTable, type GlyphTable } from './entities.ts';
import { parseDirector, fallbackDirector, type DirectorTable } from './director.ts';
import { parseEvolutions, type EvolutionTable } from './evolutions.ts';
import { parsePassives, fallbackPassives, type PassiveTable } from './passives.ts';
import { parseWeapons, type WeaponTable } from './weapons.ts';
import { parseCharacters, fallbackCharacters, type CharacterTable } from './characters.ts';

export type GameData = {
  readonly glyphs: GlyphTable;
  readonly weapons: WeaponTable;
  readonly passives: PassiveTable;
  readonly director: DirectorTable;
  readonly evolutions: EvolutionTable;
  readonly characters: CharacterTable;
  readonly warnings: readonly string[];
};

/** The five `.tsv` files, as raw text. Missing tables are the empty string. */
export type TableSources = {
  glyphs: string;
  weapons: string;
  passives: string;
  director: string;
  evolutions: string;
  characters: string;
};

export const TABLE_FILES = ['glyphs', 'weapons', 'passives', 'director', 'evolutions', 'characters'] as const;

export function buildGameData(src: TableSources): GameData {
  const glyphs = parseGlyphTable(src.glyphs);
  const weapons = parseWeapons(src.weapons);
  const passives = src.passives === '' ? fallbackPassives() : parsePassives(src.passives);
  const director = src.director === '' ? fallbackDirector() : parseDirector(src.director);
  const evolutions = parseEvolutions(src.evolutions);
  const characters = src.characters === '' ? fallbackCharacters() : parseCharacters(src.characters);

  const warnings = [
    ...glyphs.warnings,
    ...weapons.warnings,
    ...passives.warnings,
    ...director.warnings,
    ...evolutions.warnings,
    ...characters.warnings,
  ];

  if (weapons.byId.size === 0) warnings.push('weapons.tsv missing or empty — the player will start unarmed');

  return { glyphs, weapons, passives, director, evolutions, characters, warnings };
}
