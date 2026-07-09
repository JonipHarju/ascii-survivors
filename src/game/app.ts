/**
 * The state machine above the sim: title, playing, level-up, pause, death, dawn.
 * Owns input routing and decides what gets drawn.
 */

import type { Color } from '../engine/color.ts';
import { drawBox, drawCentered, drawSprite, type Rect } from '../engine/draw.ts';
import type { InputSource } from '../engine/input-source.ts';
import type { Surface } from '../engine/surface.ts';
import type { SpriteBank } from '../assets/bank.ts';
import type { GameData } from '../data/gamedata.ts';
import type { Evolution } from '../data/evolutions.ts';
import { GameView, drawHud, type ViewOptions } from './render.ts';
import { generateCards, type Card } from './upgrades.ts';
import { formatTime, World } from './world.ts';

const ACCENT: Color = 0xffe040;
const DIM: Color = 0x6a6a6a;
const TEXT: Color = 0xc7c7c7;
const RED: Color = 0xff3b3b;

/** Below this the HUD and field can't coexist; we ask for a bigger window. */
const MIN_COLS = 80;
const MIN_ROWS = 24;
/** Above this the player loses track of their own `@` (design.md §5). */
const MAX_COLS = 120;
const MAX_ROWS = 40;

type State = 'title' | 'playing' | 'levelup' | 'paused' | 'dead' | 'dawn' | 'evolution';

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

  fps = 0;

  constructor(data: GameData, sprites: SpriteBank, input: InputSource, opts: AppOptions) {
    this.data = data;
    this.sprites = sprites;
    this.input = input;
    this.opts = opts;
    this.world = this.newWorld();
    this.view = new GameView(sprites);
    if (opts.skipTitle === true) this.state = 'playing';
  }

  get done(): boolean {
    return this.quitting || this.input.quitRequested;
  }

  private newWorld(): World {
    const w = new World(this.data, this.opts.seed);
    if (this.opts.autoFace !== undefined) w.autoFace = this.opts.autoFace;
    if (this.opts.god === true) w.godMode = true;
    if (this.opts.startTime !== undefined) w.fastForward(this.opts.startTime);
    return w;
  }

  private restart(): void {
    this.world = this.newWorld();
    this.view = new GameView(this.sprites);
    this.state = 'playing';
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    this.input.update();
    const pressed = this.input.takePressed();

    switch (this.state) {
      case 'title':
        if (pressed.size > 0) {
          if (pressed.has('q')) this.quitting = true;
          else this.restart();
        }
        return;

      case 'paused':
        if (pressed.has('q')) this.quitting = true;
        else if (pressed.has('escape') || pressed.has('enter')) this.state = 'playing';
        return;

      case 'dead':
      case 'dawn':
        if (pressed.has('q')) this.quitting = true;
        else if (pressed.size > 0) this.restart();
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

    if (this.world.justSeen !== null) {
      this.view.notifyFirstEncounter(this.world.justSeen);
      this.world.justSeen = null;
    }

    if (this.world.dead) {
      this.state = 'dead';
      return;
    }
    if (this.world.won) {
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

  // ---------------------------------------------------------------- render

  render(r: Surface): void {
    r.clear();

    if (r.width < MIN_COLS || r.height < MIN_ROWS) return this.drawTooSmall(r);
    if (this.state === 'title') return this.drawTitle(r);

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
  }

  /** One HUD line top, one bottom; the rest is field, capped so `@` stays findable. */
  private fieldRect(r: Surface): Rect {
    const w = Math.min(r.width, MAX_COLS);
    const h = Math.min(r.height - 2, MAX_ROWS);
    return { x: Math.floor((r.width - w) / 2), y: 1, w, h };
  }

  private dimField(r: Surface, field: Rect): void {
    for (let y = field.y; y < field.y + field.h; y++) {
      for (let x = field.x; x < field.x + field.w; x++) {
        if (r.getChar(x, y) !== ' ') r.tint(x, y, 0x4a4a4a);
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

  private drawPause(r: Surface, field: Rect): void {
    const cx = field.x + Math.floor(field.w / 2);
    const box: Rect = { x: cx - 16, y: field.y + Math.floor(field.h / 2) - 3, w: 32, h: 7 };
    drawBox(r, box, ACCENT, 0x101010, 'PAUSED');
    drawCentered(r, cx, box.y + 2, 'ESC / ENTER  resume', TEXT, 0x101010);
    drawCentered(r, cx, box.y + 4, 'Q  quit to shell', DIM, 0x101010);
  }

  private drawCards(r: Surface, field: Rect): void {
    const n = this.cards.length;
    const cardW = 24;
    const cardH = 10;
    const gap = 3;
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

      drawBox(r, rect, border, bg);

      const mid = rect.x + Math.floor(cardW / 2);
      drawCentered(r, mid, rect.y + 2, card.glyph, card.color, bg);
      drawCentered(r, mid, rect.y + 4, card.title, TEXT, bg);
      drawCentered(r, mid, rect.y + 5, card.levelText, card.isNew ? 0x3aff3a : DIM, bg);
      drawCentered(r, mid, rect.y + 7, truncate(card.effect, cardW - 4), DIM, bg);
      drawCentered(r, mid, rect.y + cardH - 1, ` ${i + 1} `, border, bg);
    }

    drawCentered(r, cx, y0 + cardH + 2, '← → select   ENTER confirm   1-3 quick pick', DIM);
  }

  private drawEvolution(r: Surface, field: Rect): void {
    const evo = this.evolution;
    if (evo === null) return;

    const cx = field.x + Math.floor(field.w / 2);
    const box: Rect = { x: cx - 14, y: field.y + Math.floor(field.h / 2) - 4, w: 28, h: 9 };
    drawBox(r, box, ACCENT, 0x1c1a10);

    drawCentered(r, cx, box.y + 2, 'EVOLUTION', ACCENT, 0x1c1a10);
    drawCentered(r, cx, box.y + 4, evo.intoName.toUpperCase(), 0xffffff, 0x1c1a10);
    drawCentered(r, cx, box.y + 6, truncate(evo.effect, box.w - 4), DIM, 0x1c1a10);
  }

  private drawSummary(r: Surface, field: Rect): void {
    const w = this.world;
    const cx = field.x + Math.floor(field.w / 2);
    const box: Rect = { x: cx - 21, y: field.y + Math.floor(field.h / 2) - 8, w: 42, h: 16 };
    drawBox(r, box, RED, 0x100808, 'YOU DIED');
    drawCentered(r, cx, box.y + 2, 'the night took you', 0x8a5a5a, 0x100808);

    const rows: [string, string][] = [
      ['time survived', formatTime(w.time)],
      ['kills', w.kills.toLocaleString('en-US')],
      ['level reached', String(w.level)],
      ['best minute', `${w.bestMinute} kills`],
      ['gold earned', String(w.gold)],
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

    drawCentered(r, cx, box.y + box.h - 2, 'any key: run again    Q: quit', ACCENT, 0x100808);
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
    drawCentered(r, cx, y + 5, 'any key: run again    Q: quit', ACCENT);
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}

export { MIN_COLS, MIN_ROWS };
