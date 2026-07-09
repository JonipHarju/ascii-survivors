/**
 * The state machine that sits above the sim: title, playing, level-up, pause,
 * death, dawn. Owns input routing and decides what gets drawn.
 */

import { DEFAULT, shade, type Color } from '../engine/color.ts';
import { drawBox, drawCentered, drawSprite, type Rect } from '../engine/draw.ts';
import type { Input } from '../engine/input.ts';
import type { Renderer } from '../engine/renderer.ts';
import type { SpriteLoader } from '../assets/loader.ts';
import type { GlyphTable } from '../data/entities.ts';
import { GameView, drawHud, type ViewOptions } from './render.ts';
import { generateCards, type Card } from './upgrades.ts';
import { formatTime, World } from './world.ts';

const ACCENT: Color = 0xffe040;
const DIM: Color = 0x6a6a6a;
const TEXT: Color = 0xc7c7c7;

/** Below this the HUD and field can't coexist; we ask for a bigger window. */
const MIN_COLS = 80;
const MIN_ROWS = 24;
/** Above this the player loses track of their own `@` (design.md §5). */
const MAX_COLS = 120;
const MAX_ROWS = 40;

type State = 'title' | 'playing' | 'levelup' | 'paused' | 'dead' | 'dawn';

export type AppOptions = ViewOptions & {
  seed?: number | undefined;
  /** `--start mm:ss` — begin the run at this clock time. A dev affordance. */
  startTime?: number | undefined;
};

export class App {
  private readonly table: GlyphTable;
  private readonly sprites: SpriteLoader;
  private readonly input: Input;
  private readonly opts: AppOptions;

  private state: State = 'title';
  private world: World;
  private view: GameView;
  private cards: Card[] = [];
  private cardIndex = 0;
  private quitting = false;

  fps = 0;

  constructor(table: GlyphTable, sprites: SpriteLoader, input: Input, opts: AppOptions) {
    this.table = table;
    this.sprites = sprites;
    this.input = input;
    this.opts = opts;
    this.world = this.newWorld();
    this.view = new GameView(sprites);
  }

  get done(): boolean {
    return this.quitting || this.input.quitRequested;
  }

  private newWorld(): World {
    const w = new World(this.table, this.opts.seed);
    if (this.opts.startTime !== undefined) w.time = this.opts.startTime;
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

    if (this.world.pendingLevelUps > 0) {
      this.world.pendingLevelUps--;
      this.cards = generateCards(this.world, this.world.rng);
      this.cardIndex = 0;
      this.state = 'levelup';
    }
  }

  private updateLevelUp(pressed: Set<string>): void {
    const n = this.cards.length;

    if (pressed.has('left') || pressed.has('a')) this.cardIndex = (this.cardIndex - 1 + n) % n;
    if (pressed.has('right') || pressed.has('d')) this.cardIndex = (this.cardIndex + 1) % n;

    for (let i = 0; i < n; i++) {
      if (pressed.has(String(i + 1))) {
        this.choose(i);
        return;
      }
    }

    if (pressed.has('enter') || pressed.has('space')) this.choose(this.cardIndex);
  }

  private choose(i: number): void {
    this.cards[i]?.apply(this.world);
    this.cards = [];
    // Another level may have landed in the same frame as this one.
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

  render(r: Renderer): void {
    r.clear();

    if (r.width < MIN_COLS || r.height < MIN_ROWS) {
      this.drawTooSmall(r);
      return;
    }

    if (this.state === 'title') {
      this.drawTitle(r);
      return;
    }

    const field = this.fieldRect(r);
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
      default:
        break;
    }
  }

  /** One HUD line top, one bottom; the rest is field, capped so `@` stays findable. */
  private fieldRect(r: Renderer): Rect {
    const w = Math.min(r.width, MAX_COLS);
    const h = Math.min(r.height - 2, MAX_ROWS);
    return { x: Math.floor((r.width - w) / 2), y: 1, w, h };
  }

  private dimField(r: Renderer, field: Rect): void {
    for (let y = field.y; y < field.y + field.h; y++) {
      for (let x = field.x; x < field.x + field.w; x++) {
        const ch = r.getChar(x, y);
        if (ch !== ' ') r.tint(x, y, 0x4a4a4a);
      }
    }
  }

  private drawTooSmall(r: Renderer): void {
    const cy = Math.floor(r.height / 2);
    drawCentered(r, Math.floor(r.width / 2), cy - 1, 'THE LONG NIGHT', ACCENT);
    drawCentered(
      r,
      Math.floor(r.width / 2),
      cy + 1,
      `needs at least ${MIN_COLS}x${MIN_ROWS} — you have ${r.width}x${r.height}`,
      TEXT,
    );
    drawCentered(r, Math.floor(r.width / 2), cy + 2, 'resize your terminal', DIM);
  }

  private drawTitle(r: Renderer): void {
    const cx = Math.floor(r.width / 2);
    const sprite = this.sprites.get('ui/title');

    let y = Math.floor(r.height / 2) - 6;
    if (!sprite.placeholder) {
      const frame = sprite.frames[0]!;
      drawSprite(r, frame, cx - Math.floor(frame.w / 2), y, { x: 0, y: 0, w: r.width, h: r.height });
      y += frame.h + 1;
    } else {
      drawCentered(r, cx, y, 'THE LONG NIGHT', ACCENT);
      drawCentered(r, cx, y + 2, 'One night. Kill everything. See the sun.', DIM);
      y += 4;
    }

    drawCentered(r, cx, y + 2, 'You cannot attack. Your weapons swing themselves.', TEXT);
    drawCentered(r, cx, y + 3, 'All you do is walk.', TEXT);

    drawCentered(r, cx, y + 6, 'WASD / arrows  ·  move', DIM);
    drawCentered(r, cx, y + 7, 'ESC  ·  pause      Q  ·  quit', DIM);
    drawCentered(r, cx, y + 9, 'press any key to begin', ACCENT);

    if (this.sprites.count === 0) {
      drawCentered(r, cx, r.height - 2, 'assets/ not loaded — running on placeholder glyphs', 0x8a5a2b);
    }
  }

  private drawPause(r: Renderer, field: Rect): void {
    const box: Rect = { x: field.x + Math.floor(field.w / 2) - 16, y: field.y + Math.floor(field.h / 2) - 3, w: 32, h: 7 };
    drawBox(r, box, ACCENT, 0x101010, 'PAUSED');
    drawCentered(r, box.x + 16, box.y + 2, 'ESC / ENTER  resume', TEXT, 0x101010);
    drawCentered(r, box.x + 16, box.y + 4, 'Q  quit to shell', DIM, 0x101010);
  }

  private drawCards(r: Renderer, field: Rect): void {
    const n = this.cards.length;
    const cardW = 22;
    const cardH = 9;
    const gap = 3;
    const totalW = n * cardW + (n - 1) * gap;
    const x0 = field.x + Math.floor((field.w - totalW) / 2);
    const y0 = field.y + Math.floor((field.h - cardH) / 2);

    drawCentered(r, field.x + Math.floor(field.w / 2), y0 - 3, `LEVEL ${this.world.level}`, ACCENT);
    drawCentered(r, field.x + Math.floor(field.w / 2), y0 - 2, 'choose one', DIM);

    for (let i = 0; i < n; i++) {
      const card = this.cards[i]!;
      const selected = i === this.cardIndex;
      const rect: Rect = { x: x0 + i * (cardW + gap), y: y0, w: cardW, h: cardH };
      const border = selected ? ACCENT : DIM;
      const bg: Color = selected ? 0x1c1a10 : 0x101010;

      drawBox(r, rect, border, bg);

      const cx = rect.x + Math.floor(cardW / 2);
      drawCentered(r, cx, rect.y + 2, card.glyph, selected ? ACCENT : TEXT, bg);
      drawCentered(r, cx, rect.y + 4, card.title, TEXT, bg);
      if (card.isNew) drawCentered(r, cx, rect.y + 5, '· NEW ·', 0x3aff3a, bg);
      drawCentered(r, cx, rect.y + 6, card.effect, DIM, bg);
      drawCentered(r, cx, rect.y + cardH - 1, ` ${i + 1} `, border, bg);
    }

    drawCentered(r, field.x + Math.floor(field.w / 2), y0 + cardH + 2, '← → select   ENTER confirm   1-3 quick pick', DIM);
  }

  private drawSummary(r: Renderer, field: Rect): void {
    const w = this.world;
    const box: Rect = {
      x: field.x + Math.floor(field.w / 2) - 21,
      y: field.y + Math.floor(field.h / 2) - 7,
      w: 42,
      h: 15,
    };
    drawBox(r, box, 0xff3b3b, 0x100808, 'YOU DIED');

    const cx = box.x + 21;
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
    const build = w.weapons.map((wp) => wp.glyph).join(' ');
    r.text(box.x + box.w - 4 - build.length, y, build, ACCENT, 0x100808);

    drawCentered(r, cx, box.y + box.h - 2, 'any key: run again    Q: quit', ACCENT, 0x100808);
  }

  private drawDawn(r: Renderer, field: Rect): void {
    const sprite = this.sprites.get('ui/dawn');
    const cx = field.x + Math.floor(field.w / 2);
    if (!sprite.placeholder) {
      const frame = sprite.frames[0]!;
      drawSprite(r, frame, cx - Math.floor(frame.w / 2), field.y + 4, field);
    }
    drawCentered(r, cx, field.y + Math.floor(field.h / 2), 'DAWN', 0xffe040);
    drawCentered(r, cx, field.y + Math.floor(field.h / 2) + 2, 'you saw the sun', TEXT);
  }
}

export { MIN_COLS, MIN_ROWS };
