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
import { parseCrossroads, fallbackCrossroads, type CrossroadsTable } from './crossroads.ts';
import { parseCountess, fallbackCountess, type CountessTable } from './countess.ts';
import { parseJuice, fallbackJuice, type JuiceTable } from './juice.ts';
import { parseImageTable, emptyImageTable, type ImageTable } from './images.ts';
import { parseAudioTable, emptyAudioTable, type AudioTable } from './audio.ts';

export type GameData = {
  readonly glyphs: GlyphTable;
  readonly weapons: WeaponTable;
  readonly passives: PassiveTable;
  readonly director: DirectorTable;
  readonly evolutions: EvolutionTable;
  readonly characters: CharacterTable;
  readonly crossroads: CrossroadsTable;
  readonly countess: CountessTable;
  readonly juice: JuiceTable;
  /** Raster-art contract (the space pivot). Empty until `assets/images.tsv` exists. */
  readonly images: ImageTable;
  /** Sound contract. Empty until `assets/audio.tsv` exists. */
  readonly audio: AudioTable;
  readonly warnings: readonly string[];
};

/** Jane's `.tsv` files, as raw text. Missing tables are the empty string. */
export type TableSources = {
  glyphs: string;
  weapons: string;
  passives: string;
  director: string;
  evolutions: string;
  characters: string;
  crossroads: string;
  countess: string;
  juice: string;
  images: string;
  audio: string;
};

export const TABLE_FILES = [
  'glyphs',
  'weapons',
  'passives',
  'director',
  'evolutions',
  'characters',
  'crossroads',
  'countess',
  'juice',
  'images',
  'audio',
] as const;

export function buildGameData(src: TableSources): GameData {
  const glyphs = parseGlyphTable(src.glyphs);
  const weapons = parseWeapons(src.weapons);
  const passives = src.passives === '' ? fallbackPassives() : parsePassives(src.passives);
  const director = src.director === '' ? fallbackDirector() : parseDirector(src.director);
  const evolutions = parseEvolutions(src.evolutions);
  const characters = src.characters === '' ? fallbackCharacters() : parseCharacters(src.characters);
  const crossroads = src.crossroads === '' ? fallbackCrossroads() : parseCrossroads(src.crossroads);
  const countess = src.countess === '' ? fallbackCountess() : parseCountess(src.countess);
  const juice = src.juice === '' ? fallbackJuice() : parseJuice(src.juice);
  const images = src.images === '' ? emptyImageTable() : parseImageTable(src.images);
  const audio = src.audio === '' ? emptyAudioTable() : parseAudioTable(src.audio);

  const warnings = [
    ...glyphs.warnings,
    ...weapons.warnings,
    ...passives.warnings,
    ...director.warnings,
    ...evolutions.warnings,
    ...characters.warnings,
    ...crossroads.warnings,
    ...countess.warnings,
    ...juice.warnings,
    ...images.warnings,
    ...audio.warnings,
  ];

  if (weapons.byId.size === 0) warnings.push('weapons.tsv missing or empty — the player will start unarmed');

  return {
    glyphs,
    weapons,
    passives,
    director,
    evolutions,
    characters,
    crossroads,
    countess,
    juice,
    images,
    audio,
    warnings,
  };
}
