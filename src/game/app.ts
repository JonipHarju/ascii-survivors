/**
 * The state machine above the sim: title, playing, level-up, pause, death, dawn.
 * Owns input routing and decides what gets drawn.
 */

import type { Color } from '../engine/color.ts';
import { drawBox, drawCentered, drawSprite, type Rect } from '../engine/draw.ts';
import type { InputSource } from '../engine/input-source.ts';
import type { Surface } from '../engine/surface.ts';
import type { SpriteBank } from '../assets/bank.ts';
import { NULL_IMAGE_SOURCE, resolveImage, type ImageSource } from '../assets/imagesource.ts';
import { NULL_AUDIO_SINK, type AudioSink } from '../engine/audio.ts';
import type { GameData } from '../data/gamedata.ts';
import type { Evolution } from '../data/evolutions.ts';
import { GameView, drawHud, type ViewOptions } from './render.ts';
import { generateCards, type Card } from './upgrades.ts';
import { crossroadsParam, upgradeCost, type Upgrade } from '../data/crossroads.ts';
import { makeHitRadius } from './hitbox.ts';
import { loadProfile, memoryStore, saveProfile, type Profile, type SaveStore } from './save.ts';
import { formatTime, World } from './world.ts';

const ACCENT: Color = 0xffe040;
const DIM: Color = 0x6a6a6a;
const TEXT: Color = 0xc7c7c7;
const RED: Color = 0xff3b3b;

/** Below this the HUD and field can't coexist; we ask for a bigger window. */
const MIN_COLS = 80;
const MIN_ROWS = 24;

/**
 * Level-up card width. The floor is what three cards plus two 3-column gaps
 * cost on an 80-column terminal (3×24 + 2×3 = 78); the ceiling is where Jane's
 * longest sentence stops wrapping and extra width buys nothing but margin.
 */
const MIN_CARD_W = 24;
const MAX_CARD_W = 40;
/**
 * The field the game is designed around (jane.md: 180x60 target, 120x40 min).
 * A bigger window shows the same world, scaled — never more world.
 */
const MAX_COLS = 180;
const MAX_ROWS = 60;

type State = 'title' | 'crossroads' | 'playing' | 'levelup' | 'paused' | 'dead' | 'dawn' | 'evolution';

export type AppOptions = ViewOptions & {
  seed?: number | undefined;
  /** `--start mm:ss` — begin the run at this clock time. A dev affordance. */
  startTime?: number | undefined;
  /** The Chain aims itself when you aren't steering it. Owner feedback 09.07. */
  autoFace?: boolean | undefined;
  /** Skip the title screen and drop straight into a run. For dev and screenshots. */
  skipTitle?: boolean | undefined;
  /** Invulnerable, so the late game can be observed rather than survived. */
  god?: boolean | undefined;
  /** Where gold and unlocks live. Defaults to an in-memory (non-persistent) store. */
  store?: SaveStore | undefined;
  /** Raster art (images.tsv). Defaults to "nothing ever loads" — the terminal's case. */
  images?: ImageSource | undefined;
  /** Sound (audio.tsv). Defaults to silence — the terminal's case, and tests'. */
  audio?: AudioSink | undefined;
  /** Open straight on The Crossroads. Dev deep-link. */
  openShop?: boolean | undefined;
  /** Open straight on a level-up hand, so Jane can look at her card art. */
  openCards?: boolean | undefined;
  /**
   * Developer mode. `npm run dev` sets this; `npm start` (the customer build)
   * does not. Unlocks the in-game cheat panel (backtick to open). Owner ask,
   * 10.07 22:27: "npm run dev ... developer mode with cheats toggleable".
   */
  dev?: boolean | undefined;
};

export class App {
  private readonly data: GameData;
  private readonly sprites: SpriteBank;
  private readonly input: InputSource;
  private readonly opts: AppOptions;

  private state: State = 'title';
  private world: World;
  private view: GameView;
  private cards: Card[] = [];
  private cardIndex = 0;
  private evolution: Evolution | null = null;
  private evolutionTimer = 0;
  private quitting = false;
  private readonly hitRadius: (id: string) => number;

  private readonly store: SaveStore;
  private readonly images: ImageSource;
  private readonly audio: AudioSink;
  private profile: Profile;
  private saveWarning: string | null;
  /** Selected row on the Crossroads screen. */
  private shopIndex = 0;
  private shopMessage = '';

  /** `updateMusic` runs on a slow tick — the crossfade itself takes 0.6s, so scheduling it at 60Hz would just spam the audio graph for no audible gain. */
  private musicUpdateCd = 0;

  /** Dev cheat panel visibility, and a transient line echoing the last cheat. */
  private devPanel = false;
  private devMessage = '';

  fps = 0;

  constructor(data: GameData, sprites: SpriteBank, input: InputSource, opts: AppOptions) {
    this.data = data;
    this.sprites = sprites;
    this.input = input;
    this.opts = opts;
    this.hitRadius = makeHitRadius(sprites);
    this.store = opts.store ?? memoryStore();
    this.images = opts.images ?? NULL_IMAGE_SOURCE;
    this.audio = opts.audio ?? NULL_AUDIO_SINK;

    const loaded = loadProfile(this.store);
    this.profile = loaded.profile;
    this.saveWarning = loaded.warning;

    this.world = this.newWorld();
    this.view = new GameView(sprites, this.images);
    if (opts.openCards === true) this.openCards();
    else if (opts.skipTitle === true) this.state = 'playing';
    else if (opts.openShop === true) this.state = 'crossroads';
  }

  /**
   * The window lost focus. A background tab stops getting animation frames, but a
   * merely *unfocused* one keeps running at full speed — so clicking on something
   * else for ten seconds used to mean coming back to a corpse, standing exactly
   * where you left it. Only `playing` pauses: a menu is already frozen, and death
   * doesn't need confirming twice.
   */
  blur(): void {
    if (this.state === 'playing') this.state = 'paused';
  }

  get done(): boolean {
    return this.quitting || this.input.quitRequested;
  }

  private newWorld(): World {
    const w = new World(this.data, this.opts.seed, undefined, this.profile);
    w.hitRadius = this.hitRadius;
    if (this.opts.autoFace !== undefined) w.autoFace = this.opts.autoFace;
    if (this.opts.god === true) w.godMode = true;
    if (this.opts.startTime !== undefined) w.fastForward(this.opts.startTime);
    return w;
  }

  private restart(): void {
    this.world = this.newWorld();
    this.view = new GameView(this.sprites, this.images);
    this.state = 'playing';
  }

  /**
   * design.md §15.4: a continuous crossfade, not a track switch — `World`
   * only ever exposes a 0..1 "how hot is this" number (`musicIntensity`) and
   * never an audio id, so the fixed ids (`music/ambient`, `music/combat`,
   * `music/boss` — the audio.tsv contract, `john.md`) live here, the one place
   * that's allowed to know about sound at all. Calling this with unchanged
   * boss state is cheap: a real `AudioSink` only re-schedules a gain ramp, it
   * doesn't restart anything.
   */
  private updateMusic(): void {
    const w = this.world;
    this.audio.setMusic(
      w.bossActive
        ? { 'music/ambient': 0, 'music/combat': 0, 'music/boss': 1 }
        : { 'music/ambient': 1 - w.musicIntensity, 'music/combat': w.musicIntensity, 'music/boss': 0 },
    );
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    // The screen keeps settling even when the sim doesn't: a death shake fires on
    // the frame the world freezes, and the run ends in 'dead' where world.update
    // never runs again. tickShake lives outside the sim for exactly this.
    this.world.tickShake(dt);

    this.input.update();
    const pressed = this.input.takePressed();

    // Cheats consume their keys before anything else sees them, so opening the
    // panel from the title screen doesn't also start a run.
    this.handleCheats(pressed);

    switch (this.state) {
      case 'title':
        if (pressed.has('q')) this.quitting = true;
        else if (pressed.has('c')) {
          this.shopIndex = 0;
          this.shopMessage = '';
          this.state = 'crossroads';
        } else if (pressed.size > 0) this.restart();
        return;

      case 'crossroads':
        this.updateCrossroads(pressed);
        return;

      case 'paused':
        if (pressed.has('q')) this.quitting = true;
        else if (pressed.has('escape') || pressed.has('enter')) this.state = 'playing';
        return;

      case 'dead':
      case 'dawn':
        if (pressed.has('q')) this.quitting = true;
        else if (pressed.has('c')) {
          this.shopIndex = 0;
          this.shopMessage = '';
          this.state = 'crossroads';
        } else if (pressed.size > 0) this.restart();
        return;

      case 'evolution':
        this.evolutionTimer -= dt;
        if (this.evolutionTimer <= 0 || pressed.size > 0) this.state = 'playing';
        return;

      case 'levelup':
        this.updateLevelUp(pressed);
        return;

      case 'playing':
        break;
    }

    if (pressed.has('escape')) {
      this.state = 'paused';
      return;
    }

    this.world.update(dt, this.readMovement());
    this.view.tick(dt);

    if (this.world.sfx.length > 0) {
      for (const id of this.world.sfx) this.audio.play(id);
      this.world.sfx.length = 0;
    }

    this.musicUpdateCd -= dt;
    if (this.musicUpdateCd <= 0) {
      this.musicUpdateCd = 0.25;
      this.updateMusic();
    }

    if (this.world.justSeen !== null) {
      this.view.notifyFirstEncounter(this.world.justSeen);
      this.world.justSeen = null;
    }

    if (this.world.dead) {
      this.bankRun();
      this.state = 'dead';
      return;
    }
    if (this.world.won) {
      this.profile.wonOnce = true; // Endless unlocks by seeing dawn, not by gold
      this.bankRun();
      this.state = 'dawn';
      return;
    }

    // Evolution is the payoff moment of the run, so it interrupts everything.
    if (this.world.justEvolved !== null) {
      this.evolution = this.world.justEvolved;
      this.world.justEvolved = null;
      this.evolutionTimer = 2.2;
      this.state = 'evolution';
      return;
    }

    if (this.world.pendingLevelUps > 0 || this.world.pendingChests > 0) {
      if (this.world.pendingLevelUps > 0) this.world.pendingLevelUps--;
      else this.world.pendingChests--;
      this.openCards();
    }
  }

  /** Gold earned in a run is only ever banked once, when the run ends. */
  private bankRun(): void {
    const w = this.world;
    this.profile.gold += w.gold;
    this.profile.runs++;
    this.profile.bestTime = Math.max(this.profile.bestTime, Math.floor(w.time));
    this.profile.bestKills = Math.max(this.profile.bestKills, w.kills);
    saveProfile(this.store, this.profile);
  }

  // ------------------------------------------------------------ crossroads

  /** Rows that can still be bought, plus the maxed ones (shown greyed). */
  private shopRows(): Upgrade[] {
    return [...this.data.crossroads.upgrades];
  }

  private levelOf(u: Upgrade): number {
    return this.profile.upgrades[u.id] ?? 0;
  }

  private updateCrossroads(pressed: Set<string>): void {
    const rows = this.shopRows();
    if (rows.length === 0 || pressed.has('escape') || pressed.has('q')) {
      this.state = 'title';
      return;
    }

    if (pressed.has('up') || pressed.has('w')) this.shopIndex = (this.shopIndex - 1 + rows.length) % rows.length;
    if (pressed.has('down') || pressed.has('s')) this.shopIndex = (this.shopIndex + 1) % rows.length;
    if (pressed.has('enter') || pressed.has('space')) this.buy(rows[this.shopIndex]!);
  }

  private buy(u: Upgrade): void {
    const level = this.levelOf(u);

    if (level >= u.levels) {
      this.shopMessage = `${u.name} is already maxed.`;
      return;
    }
    // Endless is free but gated on having seen dawn.
    if (u.id === 'endless' && !this.profile.wonOnce) {
      this.shopMessage = 'Endless unlocks when you first see the sun.';
      return;
    }

    const cost = upgradeCost(u, level + 1);
    if (this.profile.gold < cost) {
      this.shopMessage = `${u.name} costs ${cost}g — you have ${this.profile.gold}g.`;
      return;
    }

    this.profile.gold -= cost;
    this.profile.upgrades[u.id] = level + 1;

    // Buying a character selects them; that's the only reason to buy one.
    if (u.kind === 'unlock' && this.data.characters.byId.has(u.id)) this.profile.character = u.id;

    saveProfile(this.store, this.profile);
    this.shopMessage = `Bought ${u.name}.`;
    // A purchase changes the starting build, so rebuild the pending world.
    this.world = this.newWorld();
  }

  private openCards(): void {
    this.cards = generateCards(this.world, this.world.rng);
    this.cardIndex = 0;
    this.state = 'levelup';
  }

  private updateLevelUp(pressed: Set<string>): void {
    const n = this.cards.length;
    if (n === 0) {
      this.state = 'playing';
      return;
    }

    if (pressed.has('left') || pressed.has('a')) this.cardIndex = (this.cardIndex - 1 + n) % n;
    if (pressed.has('right') || pressed.has('d')) this.cardIndex = (this.cardIndex + 1) % n;

    for (let i = 0; i < n; i++) {
      if (pressed.has(String(i + 1))) return this.choose(i);
    }
    if (pressed.has('enter') || pressed.has('space')) this.choose(this.cardIndex);
  }

  private choose(i: number): void {
    this.cards[i]?.apply(this.world);
    this.cards = [];
    this.state = 'playing';
    // Movement keys held through the menu shouldn't re-trigger card nav.
    this.input.takePressed();
  }

  /** WASD and arrows, as an isotropic wu direction. Up is -y. */
  private readMovement(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.input.anyDown('a', 'left')) x -= 1;
    if (this.input.anyDown('d', 'right')) x += 1;
    if (this.input.anyDown('w', 'up')) y -= 1;
    if (this.input.anyDown('s', 'down')) y += 1;
    return { x, y };
  }

  // ------------------------------------------------------------------- dev
  // The cheat panel only exists in `npm run dev`. Every action keys off the
  // panel being open, so none of these letters ever collide with movement
  // (WASD), menus, or a `restart-on-any-key` screen — the backtick and the
  // action keys are deleted from `pressed` the moment they're consumed.

  private handleCheats(pressed: Set<string>): void {
    if (this.opts.dev !== true) return;

    if (pressed.has('`')) {
      this.devPanel = !this.devPanel;
      pressed.delete('`');
    }
    if (!this.devPanel || this.state !== 'playing') return;

    const w = this.world;
    const take = (key: string): boolean => {
      if (!pressed.has(key)) return false;
      pressed.delete(key);
      return true;
    };

    if (take('g')) {
      w.godMode = !w.godMode;
      this.devMessage = `god mode ${w.godMode ? 'ON' : 'off'}`;
    }
    if (take('l')) {
      w.gainXp(w.xpToNext); // pushes past the threshold -> a card next frame
      this.devMessage = 'level up';
    }
    if (take('k')) {
      let n = 0;
      for (const e of w.enemies) {
        if (!e.boss) {
          w.damageEnemy(e, e.hp + 1); // real kill: pops, numbers, drops all fire
          n++;
        }
      }
      this.devMessage = `culled ${n}`;
    }
    if (take('m')) {
      w.gold += 1000;
      this.devMessage = '+1000 gold';
    }
    if (take('t')) {
      w.fastForward(60);
      this.devMessage = 'skipped +1:00';
    }
  }

  // ---------------------------------------------------------------- render

  render(r: Surface): void {
    r.clear();

    if (r.width < MIN_COLS || r.height < MIN_ROWS) return this.drawTooSmall(r);
    if (this.state === 'title') return this.drawTitle(r);
    if (this.state === 'crossroads') return this.drawCrossroads(r);

    const field = this.fieldRect(r);
    this.world.setViewport(field.w, field.h);

    this.view.render(r, this.world, field, this.opts);
    drawHud(r, this.world, this.fps, this.opts);

    switch (this.state) {
      case 'levelup':
        this.dimField(r, field);
        this.drawCards(r, field);
        break;
      case 'paused':
        this.dimField(r, field);
        this.drawPause(r, field);
        break;
      case 'dead':
        this.dimField(r, field);
        this.drawSummary(r, field);
        break;
      case 'dawn':
        this.drawDawn(r, field);
        break;
      case 'evolution':
        this.drawEvolution(r, field);
        break;
      default:
        break;
    }

    if (this.opts.dev === true) this.drawDevPanel(r, field);
  }

  /**
   * The dev overlay: a hint when closed, the cheat sheet when open. Top-left,
   * out of the way of the boss bar (top-centre) and the crowd (centre). Drawn
   * dead last, so it sits above the menus too.
   */
  private drawDevPanel(r: Surface, field: Rect): void {
    if (!this.devPanel) {
      r.text(field.x + 1, field.y, '` dev', 0x00e0a0, 0x111111);
      return;
    }

    const w = this.world;
    const lines: [string, Color][] = [
      ['— DEV —', ACCENT],
      [`g  god mode      ${w.godMode ? 'ON' : 'off'}`, w.godMode ? 0x00e0a0 : TEXT],
      ['l  level up', TEXT],
      ['k  kill screen', TEXT],
      ['m  +1000 gold', TEXT],
      ['t  skip +1:00', TEXT],
      ['`  close', DIM],
    ];
    if (this.devMessage !== '') lines.push([`» ${this.devMessage}`, 0x00e0a0]);

    const width = Math.max(...lines.map((l) => l[0].length)) + 2;
    for (let i = 0; i < lines.length; i++) {
      const [text, color] = lines[i]!;
      const y = field.y + i;
      r.fillRect(field.x + 1, y, width, 1, ' ', DIM, 0x111111);
      r.text(field.x + 2, y, text, color, 0x111111);
    }
  }

  /** One HUD line top, one bottom; the rest is field, capped so `@` stays findable. */
  private fieldRect(r: Surface): Rect {
    const w = Math.min(r.width, MAX_COLS);
    const h = Math.min(r.height - 2, MAX_ROWS);
    return { x: Math.floor((r.width - w) / 2), y: 1, w, h };
  }

  /**
   * Flatten the field to one dim grey behind a menu. A late-game field carries
   * 250 enemies and 4,000 decals; at 0x4a it was still loud enough to compete
   * with three cards laid on top of it, and the cards are the only thing the
   * player can act on while they're up.
   */
  private dimField(r: Surface, field: Rect): void {
    for (let y = field.y; y < field.y + field.h; y++) {
      for (let x = field.x; x < field.x + field.w; x++) {
        if (r.getChar(x, y) !== ' ') r.tint(x, y, 0x333333);
      }
    }
  }

  private drawTooSmall(r: Surface): void {
    const cy = Math.floor(r.height / 2);
    const cx = Math.floor(r.width / 2);
    drawCentered(r, cx, cy - 1, 'THE LONG NIGHT', ACCENT);
    drawCentered(r, cx, cy + 1, `needs at least ${MIN_COLS}x${MIN_ROWS} — you have ${r.width}x${r.height}`, TEXT);
    drawCentered(r, cx, cy + 2, 'resize your terminal', DIM);
  }

  private drawTitle(r: Surface): void {
    const cx = Math.floor(r.width / 2);
    const sprite = this.sprites.get('ui/title');
    const full: Rect = { x: 0, y: 0, w: r.width, h: r.height };

    if (!sprite.placeholder) {
      // Jane's title art carries its own menu and tagline. Centre it and stay
      // out of the way — the title screen is hers, and anything I add here just
      // prints a second copy of what she already drew.
      const frame = sprite.frames[0]!;
      const y = Math.max(0, Math.floor((r.height - frame.h) / 2));
      drawSprite(r, frame, cx - Math.floor(frame.w / 2), y, full);
    } else {
      const y = Math.max(1, Math.floor(r.height / 2) - 5);
      drawCentered(r, cx, y, 'THE LONG NIGHT', ACCENT);
      drawCentered(r, cx, y + 2, 'One night. Kill everything. See the sun.', DIM);
      drawCentered(r, cx, y + 4, 'You cannot attack. Your weapons swing themselves.', TEXT);
      drawCentered(r, cx, y + 5, 'All you do is walk.', TEXT);
      drawCentered(r, cx, y + 7, 'WASD / arrows  ·  move    ESC  ·  pause    Q  ·  quit', DIM);
      drawCentered(r, cx, y + 9, 'press any key to begin', ACCENT);
      drawCentered(r, cx, r.height - 2, 'assets/ not loaded — running on placeholder glyphs', 0x8a5a2b);
    }
  }

  /**
   * The Crossroads (design.md §13). Gold persists; you spend it here between
   * runs and it never comes back. Costs come from crossroads.tsv — Jane costed
   * the whole economy against them and asked me not to invent any.
   */
  private drawCrossroads(r: Surface): void {
    const cx = Math.floor(r.width / 2);
    const rows = this.shopRows();
    const full: Rect = { x: 0, y: 0, w: r.width, h: r.height };

    let y = 1;
    const banner = this.sprites.get('ui/crossroads');
    if (!banner.placeholder) {
      const frame = banner.frames[0]!;
      drawSprite(r, frame, cx - Math.floor(frame.w / 2), y, full);
      y += frame.h + 1;
    } else {
      drawCentered(r, cx, y + 1, 'THE CROSSROADS', ACCENT);
      y += 3;
    }

    drawCentered(r, cx, y, `⛁ ${this.profile.gold.toLocaleString('en-US')} gold`, ACCENT);
    y += 2;

    if (rows.length === 0) {
      drawCentered(r, cx, y + 1, 'crossroads.tsv is missing — nothing to buy', 0x8a5a2b);
      drawCentered(r, cx, r.height - 2, 'ESC  back', DIM);
      return;
    }

    // Rows are drawn in file order, which is the order Jane offers them in.
    //
    // The list scrolls, so a row has to be exactly one line tall — wrapping the
    // note here would desync `maxRows` and `first` from the rows on screen. So
    // the note column grows with the window instead: 24 columns on an 80-wide
    // terminal, up to 46 on the canvas. Jane's longest note is 24 characters,
    // which means the `truncate` below is now a guard rather than a policy.
    const listW = clamp(r.width - 8, 62, 84);
    const x0 = cx - Math.floor(listW / 2);
    const maxRows = Math.max(1, r.height - y - 4);
    const first = Math.max(0, Math.min(this.shopIndex - Math.floor(maxRows / 2), rows.length - maxRows));

    for (let i = first; i < Math.min(rows.length, first + maxRows); i++) {
      const u = rows[i]!;
      const level = this.levelOf(u);
      const maxed = level >= u.levels;
      const selected = i === this.shopIndex;
      const locked = u.id === 'endless' && !this.profile.wonOnce;

      const cost = maxed ? '—' : locked ? 'see dawn' : `${upgradeCost(u, level + 1)}g`;
      const affordable = !maxed && !locked && this.profile.gold >= upgradeCost(u, level + 1);

      const nameColor = maxed ? DIM : selected ? ACCENT : TEXT;
      const costColor = maxed || locked ? DIM : affordable ? 0x3aff3a : RED;

      const row = y + (i - first);
      if (selected) r.text(x0 - 2, row, '▸', ACCENT);

      r.text(x0, row, u.name.padEnd(16), nameColor);

      // Pips, so progress is readable without arithmetic.
      let pips = '';
      for (let k = 0; k < u.levels; k++) pips += k < level ? '●' : '○';
      r.text(x0 + 16, row, pips.padEnd(8), maxed ? 0x3aff3a : DIM);

      r.text(x0 + 26, row, cost.padStart(9), costColor);
      r.text(x0 + 38, row, truncate(u.note, listW - 38), DIM);
    }

    const footer = r.height - 2;
    if (this.shopMessage !== '') drawCentered(r, cx, footer - 1, this.shopMessage, 0x4ff0f0);
    drawCentered(r, cx, footer, '↑↓ select    ENTER buy    ESC back', DIM);

    if (this.saveWarning !== null) drawCentered(r, cx, 0, this.saveWarning, 0x8a5a2b);
  }

  private drawPause(r: Surface, field: Rect): void {
    const cx = field.x + Math.floor(field.w / 2);
    const box: Rect = { x: cx - 16, y: field.y + Math.floor(field.h / 2) - 3, w: 32, h: 7 };
    drawBox(r, box, ACCENT, 0x101010, 'PAUSED', this.panelImage(r));
    drawCentered(r, cx, box.y + 2, 'ESC / ENTER  resume', TEXT, 0x101010);
    drawCentered(r, cx, box.y + 4, 'Q  quit to shell', DIM, 0x101010);
  }

  private drawCards(r: Surface, field: Rect): void {
    const n = this.cards.length;
    const gap = 3;

    // The card used to be a flat 24, the widest that fits three-across on an
    // 80-column terminal. But the canvas is 180 columns and that is where the
    // game is actually played: three 24s left two thirds of the screen empty
    // while Jane's sentences wrapped. Take what the field gives, up to 40 —
    // past which every string in the game is on one line and the box is just air.
    const cardW = clamp(Math.floor((field.w - (n - 1) * gap) / n) - 2, MIN_CARD_W, MAX_CARD_W);

    // Jane's card art is 12x5. Art, title, level, two lines of effect, and the
    // dimmed numbers line under them.
    const cardH = 15;
    const totalW = n * cardW + (n - 1) * gap;
    const x0 = field.x + Math.floor((field.w - totalW) / 2);
    const y0 = field.y + Math.floor((field.h - cardH) / 2);
    const cx = field.x + Math.floor(field.w / 2);

    drawCentered(r, cx, y0 - 3, `LEVEL ${this.world.level}`, ACCENT);
    drawCentered(r, cx, y0 - 2, 'choose one', DIM);

    for (let i = 0; i < n; i++) {
      const card = this.cards[i]!;
      const selected = i === this.cardIndex;
      const rect: Rect = { x: x0 + i * (cardW + gap), y: y0, w: cardW, h: cardH };
      const border = selected ? ACCENT : DIM;
      const bg: Color = selected ? 0x1c1a10 : 0x101010;

      drawBox(r, rect, border, bg, undefined, this.panelImage(r));

      const mid = rect.x + Math.floor(cardW / 2);
      this.drawCardArt(r, card, rect, bg);
      drawCentered(r, mid, rect.y + 8, card.title, TEXT, bg);
      drawCentered(r, mid, rect.y + 9, card.levelText, card.isNew ? 0x3aff3a : DIM, bg);

      // Jane writes real sentences in the `note` column — "Sweeps a wide band to
      // either side of you." A card that cuts her off at "Sweeps a wide ba…" is
      // asking the player to choose blind.
      const lines = wrap(card.effect, cardW - 4, 2);
      for (const [j, line] of lines.entries()) drawCentered(r, mid, rect.y + 11 + j, line, TEXT, bg);

      // The numbers sit below the sentence and below it in the reading order too.
      // Fixed row, not `after the last line`, or a one-line card and a two-line
      // card put their numbers on different rows and the hand stops scanning.
      if (card.detail !== null) drawCentered(r, mid, rect.y + 13, truncate(card.detail, cardW - 4), DIM, bg);

      drawCentered(r, mid, rect.y + cardH - 1, ` ${i + 1} `, border, bg);
    }

    drawCentered(r, cx, y0 + cardH + 2, '← → select   ENTER confirm   1-3 quick pick', DIM);
  }

  /**
   * A texture for `drawBox` to stretch behind its ASCII border (design.md
   * §15.13's GUI-overhaul plumbing) — every `drawBox` caller in this file
   * shares one id, `panels/frame`, rather than one per screen: it's a plain
   * backdrop with no baked-in text or per-screen meaning, so there's nothing
   * to differentiate on, the same "free reuse" call already made for
   * portraits. `undefined` (no row, no raster backend) is the normal case
   * until Jane adds one — `drawBox` already treats that as "no texture,
   * flat fill" with zero special-casing needed here.
   */
  private panelImage(r: Surface): CanvasImageSource | undefined {
    if (!r.caps.raster) return undefined;
    return resolveImage(this.images, this.data.images, 'panels/frame')?.img;
  }

  /**
   * Raster (`images.tsv`, `cards/<id>`) first, then Jane's ASCII art, then the
   * single glyph — same three-tier fallback `GameView` uses for entities
   * (jane.md [39]/john.md [41]). A `cards/*` id is screen-space UI, not a
   * world entity, so its `w`/`h` are cells directly — no `WU_PER_ROW` divide,
   * there's no world for this to be isotropic in.
   *
   * Never tinted: her mask (or the raster art itself) assigns colour per
   * pixel/character, and a tint would flatten the whole drawing to one hue.
   * Selection is carried by the border and the card's background instead.
   */
  private drawCardArt(r: Surface, card: Card, rect: Rect, bg: Color): void {
    const mid = rect.x + Math.floor(rect.w / 2);

    if (card.icon !== null && r.caps.raster) {
      const resolved = resolveImage(this.images, this.data.images, card.icon);
      if (resolved !== null) {
        const cy = rect.y + 2 + resolved.entry.h / 2;
        // `onTop`: `drawBox` already buffered this card's own background fill
        // over these cells; without it the icon would paint, then vanish
        // under that fill at flush() regardless of call order (jane.md
        // [43]/[44]).
        r.drawImage(mid, cy, resolved.img, resolved.entry.w, resolved.entry.h, 0, undefined, true);
        return;
      }
    }

    const sprite = card.icon === null ? null : this.sprites.get(card.icon);
    if (sprite === null || sprite.placeholder) {
      drawCentered(r, mid, rect.y + 3, card.glyph, card.color, bg);
      return;
    }

    // `drawSprite` positions by anchor, so add the offset back to land the art's
    // top-left where we want it whatever anchor Jane gives the file.
    const frame = sprite.frames[0]!;
    drawSprite(r, frame, mid - Math.floor(frame.w / 2) + frame.ox, rect.y + 2 + frame.oy, rect, null, bg);
  }

  private drawEvolution(r: Surface, field: Rect): void {
    const evo = this.evolution;
    if (evo === null) return;

    const cx = field.x + Math.floor(field.w / 2);

    // 44 wide, not 28. This box is drawn alone at the payoff moment of the whole
    // run, and at 28 it was cutting the one sentence that explains the reward:
    // "bands on BOTH sides, always, no facing check" -> "bands on BOTH sides, a…".
    const boxW = clamp(field.w - 4, 28, 44);
    const box: Rect = { x: cx - Math.floor(boxW / 2), y: field.y + Math.floor(field.h / 2) - 4, w: boxW, h: 9 };
    drawBox(r, box, ACCENT, 0x1c1a10, undefined, this.panelImage(r));

    drawCentered(r, cx, box.y + 2, 'EVOLUTION', ACCENT, 0x1c1a10);
    drawCentered(r, cx, box.y + 4, evo.intoName.toUpperCase(), 0xffffff, 0x1c1a10);

    const lines = wrap(evo.effect, box.w - 4, 2);
    for (const [j, line] of lines.entries()) drawCentered(r, cx, box.y + 6 + j, line, DIM, 0x1c1a10);
  }

  private drawSummary(r: Surface, field: Rect): void {
    const w = this.world;
    const cx = field.x + Math.floor(field.w / 2);
    const box: Rect = { x: cx - 21, y: field.y + Math.floor(field.h / 2) - 9, w: 42, h: 17 };
    drawBox(r, box, RED, 0x100808, 'YOU DIED', this.panelImage(r));
    drawCentered(r, cx, box.y + 2, 'the night took you', 0x8a5a5a, 0x100808);

    const rows: [string, string][] = [
      ['time survived', formatTime(w.time)],
      ['kills', w.kills.toLocaleString('en-US')],
      ['level reached', String(w.level)],
      ['best minute', `${w.bestMinute} kills`],
      ['gold earned', String(w.gold)],
      ['gold banked', this.profile.gold.toLocaleString('en-US')],
    ];

    let y = box.y + 4;
    for (const [label, value] of rows) {
      r.text(box.x + 4, y, label, DIM, 0x100808);
      r.text(box.x + box.w - 4 - value.length, y, value, TEXT, 0x100808);
      y++;
    }

    y++;
    r.text(box.x + 4, y, 'build', DIM, 0x100808);
    const build = w.weapons.map((wp) => this.data.weapons.byId.get(wp.id)?.[0]?.glyph ?? '?').join(' ');
    r.text(box.x + box.w - 4 - build.length, y, build, ACCENT, 0x100808);

    drawCentered(r, cx, box.y + box.h - 2, 'any key: run again   C: crossroads   Q: quit', ACCENT, 0x100808);
  }

  private drawDawn(r: Surface, field: Rect): void {
    const w = this.world;
    const cx = field.x + Math.floor(field.w / 2);
    const sprite = this.sprites.get('ui/dawn');

    let y = field.y + 2;
    if (!sprite.placeholder) {
      const frame = sprite.frames[0]!;
      drawSprite(r, frame, cx - Math.floor(frame.w / 2), y, field);
      y += frame.h + 1;
    } else {
      drawCentered(r, cx, y + 2, 'DAWN', ACCENT);
      y += 4;
    }

    drawCentered(r, cx, y + 1, 'you saw the sun', TEXT);
    drawCentered(r, cx, y + 3, `${w.kills.toLocaleString('en-US')} dead · ${formatTime(w.time)} · level ${w.level}`, DIM);
    drawCentered(r, cx, y + 5, `⛁ ${this.profile.gold.toLocaleString('en-US')} banked`, ACCENT);
    drawCentered(r, cx, y + 7, 'any key: run again   C: crossroads   Q: quit', DIM);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Greedy word wrap to at most `maxLines` lines of `width`, ellipsizing the last.
 * A word longer than the line is cut rather than allowed to overflow the card.
 */
function wrap(s: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';

  for (const word of s.split(' ')) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (candidate.length <= width) {
      line = candidate;
    } else {
      if (line !== '') lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);

  // A word longer than the line gets cut wherever it lands; text that ran out of
  // lines is dropped, and the surviving last line says so.
  const overflowed = lines.length > maxLines;
  if (overflowed) lines.length = maxLines;

  const out = lines.map((l) => truncate(l, width));
  if (overflowed && out.length > 0) out[out.length - 1] = truncate(`${out[out.length - 1]!}…`, width);
  return out;
}

export { MIN_COLS, MIN_ROWS, wrap };
