/**
 * design.md §16.9 (unfrozen by owner feedback 15.07 23:31): on a raster
 * backend the title / crossroads / dawn screens are display typography plus
 * one raster accent — never the ASCII block-letter banners. The terminal
 * keeps every .txt banner exactly as before ("the terminal is allowed to
 * look like a terminal").
 *
 * These are the regression tests for "the owner never sees ASCII art again":
 * if someone re-wires a screen back to drawSprite(ui/…) on the raster path,
 * this file goes red before the owner does.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Color } from '../engine/color.ts';
import type { Capabilities, Surface } from '../engine/surface.ts';
import type { InputSource } from '../engine/input-source.ts';
import { SpriteLoader } from '../assets/loader.ts';
import { parseGlyphTable } from '../data/entities.ts';
import { parseWeapons } from '../data/weapons.ts';
import { parsePassives } from '../data/passives.ts';
import { parseDirector } from '../data/director.ts';
import { parseEvolutions } from '../data/evolutions.ts';
import { parseCharacters } from '../data/characters.ts';
import { parseCrossroads } from '../data/crossroads.ts';
import { parseCountess } from '../data/countess.ts';
import { fallbackJuice } from '../data/juice.ts';
import { emptyImageTable } from '../data/images.ts';
import { emptyAudioTable } from '../data/audio.ts';
import { emptyBackgroundTable } from '../data/backgrounds.ts';
import type { GameData } from '../data/gamedata.ts';
import { App } from '../game/app.ts';

const data: GameData = {
  glyphs: parseGlyphTable('player\t@\tThe Warden\tW\t100\t20\t0\t-\t-\t0'),
  weapons: parseWeapons('nova\t1\tSanguine Nova\t*\tR\tbolt\t1.4\t8\t2\t2\t1\t1\t2\t1\t40\t'),
  passives: parsePassives('might\tMight\tdamage\tmult\t1.08\t1.16\t1.24\t1.32\t1.4\t1.48\t1.56\t1.64\t'),
  director: parseDirector('param\ttarget_start\t0\nparam\ttarget_end\t0'),
  evolutions: parseEvolutions(''),
  characters: parseCharacters('warden\tThe Warden\tsprites/player\tnova\t100\t1\t1\t1\t1\t0\t'),
  crossroads: parseCrossroads(''),
  countess: parseCountess(''),
  juice: fallbackJuice(),
  images: emptyImageTable(),
  audio: emptyAudioTable(),
  backgrounds: emptyBackgroundTable(),
  warnings: [],
};

const input: InputSource = {
  update(): void {},
  takePressed: () => new Set<string>(),
  isDown: () => false,
  anyDown: () => false,
  quitRequested: false,
};

/** Records everything a screen draws; `raster` picks which backend it mimics. */
class RecordingSurface implements Surface {
  readonly width = 180;
  readonly height = 60;
  readonly caps: Capabilities;
  cells = new Map<string, string>();
  displayTexts: { text: string; hCells: number; color: Color }[] = [];
  images = 0;

  constructor(raster: boolean) {
    this.caps = { smoothLight: raster, subCell: raster, raster };
  }

  clear(): void {
    this.cells.clear();
    this.displayTexts.length = 0;
    this.images = 0;
  }
  set(x: number, y: number, ch: string): void {
    this.cells.set(`${x},${y}`, ch);
  }
  setF(x: number, y: number, ch: string): void {
    this.set(Math.round(x), Math.round(y), ch);
  }
  tint(): void {}
  getChar(x: number, y: number): string {
    return this.cells.get(`${x},${y}`) ?? ' ';
  }
  text(x: number, y: number, s: string, _fg?: Color, _bg?: Color): number {
    for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i]!);
    return s.length;
  }
  fillRect(x: number, y: number, w: number, h: number, ch: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
  }
  inBounds(): boolean {
    return true;
  }
  invalidate(): void {}
  setLight(): void {}
  drawImage(): void {
    this.images++;
  }
  dot(): void {}
  glowRect(): void {}
  glowRing(): void {}
  displayText(_cx: number, _cy: number, text: string, hCells: number, color: Color): void {
    this.displayTexts.push({ text, hCells, color });
  }
  panelFrame(): void {}
  flush(): number {
    return 0;
  }
}

/** Every glyph the screen wrote, as one string — for "does it contain X" checks. */
function drawn(r: RecordingSurface): string {
  return [...r.cells.values()].join('');
}

const realAssets = new SpriteLoader(new URL('../../assets', import.meta.url).pathname);
const assetsReady = realAssets.load();

describe('§16.9 screens — raster is typography, terminal keeps the banners', () => {
  it('title on raster: LONE NIGHT is displayText, no block-letter cells, menu copy is Jane’s', async () => {
    await assetsReady;
    const app = new App(data, realAssets, input, { dark: false, debug: false });
    const r = new RecordingSurface(true);
    r.clear();
    app.render(r);

    assert.ok(
      r.displayTexts.some((t) => t.text === 'LONE NIGHT'),
      'wordmark must be display typography',
    );
    const glyphs = drawn(r);
    assert.ok(!glyphs.includes('█'), 'the ASCII banner (███ blocks) must not reach a raster screen');
    assert.ok(glyphs.includes('begin the night'), 'Jane’s menu copy survives as body text');
  });

  it('title on the terminal: Jane’s ui/title.txt banner still draws, no displayText', async () => {
    await assetsReady;
    const app = new App(data, realAssets, input, { dark: false, debug: false });
    const r = new RecordingSurface(false);
    r.clear();
    app.render(r);

    assert.equal(r.displayTexts.length, 0, 'terminal never sees displayText calls');
    assert.ok(drawn(r).includes('█'), 'the .txt banner keeps drawing on the terminal');
  });

  it('crossroads on raster: heading is displayText and the gold readout drops the ⛁ picture-glyph', async () => {
    await assetsReady;
    const app = new App(data, realAssets, input, { dark: false, debug: false, openShop: true });
    const r = new RecordingSurface(true);
    r.clear();
    app.render(r);

    assert.ok(r.displayTexts.some((t) => t.text === 'THE CROSSROADS'));
    const glyphs = drawn(r);
    assert.ok(!glyphs.includes('⛁'), 'no picture-glyph gold on a raster screen');
    assert.ok(glyphs.includes('gold'), 'the readout itself survives as text');
  });

  it('dawn on raster: DAWN is displayText and the body line is Jane’s sentence', async () => {
    await assetsReady;
    const app = new App(data, realAssets, input, { dark: false, debug: false, skipTitle: true });
    (app as unknown as { state: string }).state = 'dawn';
    const r = new RecordingSurface(true);
    r.clear();
    app.render(r);

    assert.ok(r.displayTexts.some((t) => t.text === 'DAWN'));
    assert.ok(drawn(r).includes('you are still standing'), 'the ui/dawn.txt sentence survives as body text');
  });
});
