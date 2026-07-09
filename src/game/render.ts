/**
 * Draws the world. Reads sim state, writes cells. Never mutates the world.
 *
 * The screen transform is the entire aspect-ratio correction: a column is 1 wu,
 * a row is 2 wu. Everything else in the game reasons in isotropic wu and only
 * this file knows the grid is squashed.
 */

import { DEFAULT, mix, shade, type Color } from '../engine/color.ts';
import { drawBar, drawSprite, drawCentered, type Rect } from '../engine/draw.ts';
import type { Renderer } from '../engine/renderer.ts';
import { hash2 } from '../engine/rng.ts';
import { frameAt } from '../assets/sprite.ts';
import type { SpriteLoader } from '../assets/loader.ts';
import type { DecalDef } from '../data/entities.ts';
import { formatTime, WU_PER_ROW, type Enemy, type World } from './world.ts';

const PLAYER_COLOR: Color = 0xffffff;
const HUD_DIM: Color = 0x6a6a6a;
const HUD_TEXT: Color = 0xc7c7c7;
const DARK_COLOR: Color = 0x585858;
const FLASH_COLOR: Color = 0xffffff;

export type Camera = { x: number; y: number };

export type ViewOptions = {
  /** `--no-dark` kills the light radius. Jane asked for this switch on day one. */
  dark: boolean;
  debug: boolean;
};

export class GameView {
  private readonly sprites: SpriteLoader;
  /** Corner panel shown when a new enemy type first appears (design.md §12). */
  private portraitId: string | null = null;
  private portraitTimer = 0;

  constructor(sprites: SpriteLoader) {
    this.sprites = sprites;
  }

  notifyFirstEncounter(id: string): void {
    this.portraitId = id;
    this.portraitTimer = 1.5;
  }

  tick(dt: number): void {
    if (this.portraitTimer > 0) {
      this.portraitTimer -= dt;
      if (this.portraitTimer <= 0) this.portraitId = null;
    }
  }

  render(r: Renderer, w: World, field: Rect, opts: ViewOptions): void {
    const cam: Camera = { x: w.x, y: w.y };
    const halfW = Math.floor(field.w / 2);
    const halfH = Math.floor(field.h / 2);

    const col = (x: number): number => field.x + halfW + Math.round(x - cam.x);
    const row = (y: number): number => field.y + halfH + Math.round((y - cam.y) / WU_PER_ROW);

    /** Distance from the player in wu — the light test, and it must be isotropic. */
    const lit = (x: number, y: number): boolean =>
      !opts.dark || Math.hypot(x - w.x, y - w.y) <= w.lightRadius;

    this.drawGround(r, w, field, cam, opts);
    this.drawDecals(r, w, field, col, row, lit);
    this.drawMotes(r, w, field, col, row, lit);
    this.drawEnemies(r, w, field, col, row, lit, opts);
    this.drawEffects(r, w, field, col, row);

    // The player is drawn last and is the only bright white thing on the field.
    r.set(col(w.x), row(w.y), w.playerDef.glyph, PLAYER_COLOR);

    if (this.portraitId !== null) this.drawPortrait(r, field, this.portraitId);
  }

  /**
   * Sparse static scatter so movement is legible on an empty field. Hashed from
   * world coords, not random, or it would shimmer as the camera moves.
   */
  private drawGround(r: Renderer, w: World, field: Rect, cam: Camera, opts: ViewOptions): void {
    const halfW = Math.floor(field.w / 2);
    const halfH = Math.floor(field.h / 2);
    const originX = Math.round(cam.x) - halfW;
    const originY = Math.round(cam.y / WU_PER_ROW) - halfH;

    for (let sy = 0; sy < field.h; sy++) {
      for (let sx = 0; sx < field.w; sx++) {
        const wx = originX + sx;
        const wy = originY + sy;
        const h = hash2(wx, wy, 7);
        if (h > 0.028) continue;

        const ch = h < 0.008 ? '"' : h < 0.017 ? '.' : '`';
        const wuY = wy * WU_PER_ROW;
        const inLight = !opts.dark || Math.hypot(wx - w.x, wuY - w.y) <= w.lightRadius;
        r.set(field.x + sx, field.y + sy, ch, inLight ? 0x3a4438 : 0x2c2c2c);
      }
    }
  }

  private drawDecals(
    r: Renderer,
    w: World,
    field: Rect,
    col: (x: number) => number,
    row: (y: number) => number,
    lit: (x: number, y: number) => boolean,
  ): void {
    const stages = w.table.decals;
    if (stages.length === 0) return;

    for (const d of w.decals) {
      const age = w.time - d.born;
      const stage = stageFor(stages, age);
      if (stage === null) continue;

      const sx = col(d.cx);
      const sy = field.y + Math.floor(field.h / 2) + Math.round(d.cy - w.y / WU_PER_ROW);
      if (sx < field.x || sx >= field.x + field.w || sy < field.y || sy >= field.y + field.h) continue;

      // Fade within the stage as well as between stages, so the carpet thins
      // continuously instead of stepping through five discrete looks.
      const t = (age - stage.ageFrom) / Math.max(0.001, stage.ageTo - stage.ageFrom);
      const c = shade(stage.color, 1 - t * 0.45);
      r.set(sx, sy, stage.glyph, lit(d.cx, d.cy * WU_PER_ROW) ? c : shade(c, 0.45));
    }
  }

  private drawMotes(
    r: Renderer,
    w: World,
    field: Rect,
    col: (x: number) => number,
    row: (y: number) => number,
    lit: (x: number, y: number) => boolean,
  ): void {
    for (const m of w.motes) {
      const sx = col(m.x);
      const sy = row(m.y);
      if (sx < field.x || sx >= field.x + field.w || sy < field.y || sy >= field.y + field.h) continue;

      const id = m.value >= 20 ? 'mote20' : m.value >= 5 ? 'mote5' : 'mote1';
      const def = w.table.entities.get(id);
      const glyph = def?.glyph ?? '·';
      const color = def?.color ?? 0x6f8dff;
      r.set(sx, sy, glyph, lit(m.x, m.y) ? color : shade(color, 0.4));
    }
  }

  private drawEnemies(
    r: Renderer,
    w: World,
    field: Rect,
    col: (x: number) => number,
    row: (y: number) => number,
    lit: (x: number, y: number) => boolean,
    opts: ViewOptions,
  ): void {
    for (const e of w.enemies) {
      const sx = col(e.x);
      const sy = row(e.y);
      if (sx < field.x || sx >= field.x + field.w || sy < field.y || sy >= field.y + field.h) continue;

      const inLight = lit(e.x, e.y);

      // The Stalker is the one thing that can kill you while unseen — by design,
      // and it's telegraphed by a `?` at the light's edge before it arrives.
      if (e.def.id === 'stalker' && !inLight && opts.dark) continue;

      // Elites and bosses ignore the dark: they're always fully lit.
      const alwaysLit = e.elite || e.def.id === 'countess';
      let color = inLight || alwaysLit ? e.def.color : DARK_COLOR;
      if (e.flash > 0) color = mix(color, FLASH_COLOR, Math.min(1, e.flash / 0.08));

      if (e.def.id === 'countess') {
        this.drawBoss(r, e, sx, sy, field, w.time);
        continue;
      }

      r.set(sx, sy, e.def.glyph, color);

      if (e.elite) this.drawEliteBar(r, e, sx, sy, field);
    }
  }

  private drawBoss(r: Renderer, e: Enemy, sx: number, sy: number, field: Rect, time: number): void {
    const sprite = this.sprites.get('sprites/countess', 'C', e.def.color);
    const frame = frameAt(sprite, time);
    drawSprite(r, frame, sx, sy, field, e.flash > 0 ? FLASH_COLOR : null);
  }

  private drawEliteBar(r: Renderer, e: Enemy, sx: number, sy: number, field: Rect): void {
    const y = sy - 1;
    if (y < field.y) return;
    const w = 5;
    const x = sx - 2;
    const frac = e.hp / e.maxHp;
    const filled = Math.round(frac * w);
    for (let i = 0; i < w; i++) {
      const px = x + i;
      if (px < field.x || px >= field.x + field.w) continue;
      r.set(px, y, i < filled ? '▬' : '─', i < filled ? 0xff3b3b : 0x503030);
    }
  }

  private drawEffects(
    r: Renderer,
    w: World,
    field: Rect,
    col: (x: number) => number,
    row: (y: number) => number,
  ): void {
    for (const fx of w.effects) {
      if (fx.kind !== 'chain') continue;
      // Two frames, ~60ms each: `═` then `─`. That's the whole animation, and
      // it reads perfectly at speed.
      const ch = fx.age < 0.06 ? '═' : '─';
      const color = fx.age < 0.06 ? 0xffe040 : 0xb8a000;

      const x0 = col(fx.xLeft);
      const x1 = col(fx.xRight); // exclusive: [xLeft, xRight)
      const cy = row(fx.yCenter);

      for (let y = cy - fx.halfRows; y <= cy + fx.halfRows; y++) {
        for (let x = x0; x < x1; x++) {
          if (x < field.x || x >= field.x + field.w || y < field.y || y >= field.y + field.h) continue;
          r.set(x, y, ch, color);
        }
      }
    }
  }

  private drawPortrait(r: Renderer, field: Rect, id: string): void {
    const sprite = this.sprites.get(`portraits/${id}`);
    if (sprite.placeholder) return; // Jane hasn't drawn this one yet.

    const frame = sprite.frames[0]!;
    const x = field.x + field.w - frame.w - 2;
    const y = field.y + 1;

    // Slide-in: eased over the first 250ms of the 1.5s window.
    const t = Math.min(1, (1.5 - this.portraitTimer) / 0.25);
    const offset = Math.round((1 - t * t) * (frame.w + 2));

    drawSprite(r, frame, x + offset, y, field);
    const label = sprite.name.toUpperCase();
    r.text(x + offset, y + frame.h, label, 0xffe040);
  }
}

function stageFor(stages: readonly DecalDef[], age: number): DecalDef | null {
  for (const s of stages) {
    if (age >= s.ageFrom && age < s.ageTo) return s;
  }
  return null;
}

/** Top and bottom HUD lines (design.md §12). */
export function drawHud(r: Renderer, w: World, fps: number, opts: ViewOptions): void {
  const top = 0;
  const bottom = r.height - 1;

  r.fillRect(0, top, r.width, 1, ' ', DEFAULT, 0x141414);
  r.fillRect(0, bottom, r.width, 1, ' ', DEFAULT, 0x141414);

  // --- top: HP, level, clock, kills, gold ---
  let x = 1;
  x += r.text(x, top, 'HP ', HUD_DIM, 0x141414);
  drawBar(r, x, top, 10, w.hp / w.maxHp, 0xff3b3b, 0x4a2020, '░');
  x += 10;
  x += r.text(x, top, ` ${Math.ceil(w.hp)}/${w.maxHp}`, HUD_TEXT, 0x141414);

  x += r.text(x + 2, top, `LV ${w.level}`, 0xffe040, 0x141414) + 2;

  const clock = formatTime(w.time);
  const clockColor = w.clockRunning ? HUD_TEXT : 0xff3b3b;
  drawCentered(r, Math.floor(r.width / 2), top, `⏱ ${clock}`, clockColor, 0x141414);

  const right = `☠ ${w.kills.toLocaleString('en-US')}   ⛁ ${w.gold}`;
  r.text(r.width - right.length - 1, top, right, HUD_TEXT, 0x141414);

  // --- bottom: XP bar, then weapon glyphs, then (optionally) debug counters ---
  const weaponStrip = w.weapons.map((wp) => wp.glyph).join(' ');
  const dbg = opts.debug
    ? `${fps.toFixed(0)}fps ${w.enemies.length}e ${w.motes.length}m ${w.decals.length}d`
    : '';

  // Reserve the debug gutter out of the bar, or it draws over the weapon strip.
  const reserved = weaponStrip.length + 4 + (dbg.length > 0 ? dbg.length + 2 : 0);
  const barWidth = Math.max(10, r.width - reserved - 2);

  drawBar(r, 1, bottom, barWidth, w.xp / w.xpToNext, 0x4ff0f0, 0x1e3a3a, '─');
  r.text(barWidth + 3, bottom, weaponStrip, 0xffe040, 0x141414);
  if (dbg.length > 0) r.text(r.width - dbg.length - 1, bottom, dbg, 0x6a6a6a, 0x141414);
}
