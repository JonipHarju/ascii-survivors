/**
 * Draws the world. Reads sim state, writes cells. Never mutates the world.
 *
 * The screen transform is the entire aspect-ratio correction: a column is 1 wu,
 * a row is 2 wu. Everything else in the game reasons in isotropic wu and only
 * this file knows the grid is squashed. That's why a circular AoE of radius r
 * is drawn here as an ellipse with `rx = r, ry = r/2` cells.
 */

import { DEFAULT, mix, shade, type Color } from '../engine/color.ts';
import { drawBar, drawSprite, drawCentered, type Rect } from '../engine/draw.ts';
import type { Surface } from '../engine/surface.ts';
import { hash2 } from '../engine/rng.ts';
import { frameAt } from '../assets/sprite.ts';
import type { SpriteBank } from '../assets/bank.ts';
import { NULL_IMAGE_SOURCE, type ImageSource } from '../assets/imagesource.ts';
import type { DecalDef } from '../data/entities.ts';
import { param } from '../data/director.ts';
import { countessParam } from '../data/countess.ts';
import { juice, juiceGlyph } from '../data/juice.ts';
import { formatTime, WU_PER_ROW, type Enemy, type World } from './world.ts';

const PLAYER_COLOR: Color = 0xffffff;
/**
 * The card a `# opaque: true` sprite sits on. Near-black rather than black so it
 * reads as the player's own shadow and not as a hole cut in the floor.
 */
const OPAQUE_BG: Color = 0x0a0a0a;
const HUD_BG: Color = 0x141414;
const HUD_DIM: Color = 0x6a6a6a;
const HUD_TEXT: Color = 0xc7c7c7;
const DARK_COLOR: Color = 0x585858;
const FLASH_COLOR: Color = 0xffffff;
const ACCENT: Color = 0xffe040;

// The legibility knobs — gore_level, mote_lift, mote_pulse, mote_pulse_hz — are
// Jane's, and they live in `director.tsv`. Brightness is balance, and balance is
// hers. `param()` supplies the fallback when a table doesn't mention them.

export type ViewOptions = {
  /** `--no-dark` kills the light radius. Jane asked for this switch on day one. */
  dark: boolean;
  debug: boolean;
};

/** Screen-space projection for one frame. Built once, closed over everywhere. */
type Proj = {
  col(x: number): number;
  row(y: number): number;
  /** Unrounded, for backends that can draw between cells. */
  colF(x: number): number;
  rowF(y: number): number;
  /** Inside the lantern. Governs *gameplay* visibility (the Stalker). */
  lit(x: number, y: number): boolean;
  /**
   * Colour to draw something at (x,y) in. On a terminal this greys out anything
   * beyond the lantern; on canvas the backend paints a real falloff, so the
   * glyph keeps its colour and we hand the dimming to the compositor.
   */
  shadeAt(x: number, y: number, c: Color): Color;
  inside(sx: number, sy: number): boolean;
};

export class GameView {
  private readonly sprites: SpriteBank;
  private readonly images: ImageSource;
  private portraitId: string | null = null;
  private portraitTimer = 0;
  /** Reused each frame so the z-sort doesn't allocate at 220 enemies x 60fps. */
  private zOrder: Enemy[] = [];

  constructor(sprites: SpriteBank, images: ImageSource = NULL_IMAGE_SOURCE) {
    this.sprites = sprites;
    this.images = images;
  }

  /**
   * The raster art contract (john.md, the space pivot): `images.tsv` maps a
   * sprite id to a loaded picture. Returns null the instant any link in that
   * chain is missing — no row, no loaded pixels yet, or a backend that can't
   * blit (`caps.raster`) — and every call site falls back to the glyph/ASCII
   * path it already had. Nothing here can make a frame worse than before.
   */
  private imageFor(r: Surface, w: World, id: string): { img: CanvasImageSource; wCells: number; hCells: number } | null {
    if (!r.caps.raster) return null;
    const entry = w.data.images.byId.get(id);
    if (entry === undefined) return null;
    const img = this.images.get(entry.path);
    if (img === undefined) return null;
    return { img, wCells: entry.w, hCells: entry.h / WU_PER_ROW };
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

  render(r: Surface, w: World, field: Rect, opts: ViewOptions): void {
    const halfW = Math.floor(field.w / 2);
    const halfH = Math.floor(field.h / 2);

    // Dusk (boss phase 3) collapses the world to your lantern, whatever --no-dark says.
    const dark = opts.dark || w.dusk;
    const radius = w.dusk ? w.lightRadius * 0.7 : w.lightRadius;
    const soft = r.caps.smoothLight;

    // Screen shake (juice.tsv). The offset is in cells and < 1; the canvas draws
    // it as pixels and the terminal's Math.round swallows it, which is the right
    // thing for a terminal. The HUD is drawn separately and never sees it.
    const sh = w.shakeOffset();

    const p: Proj = {
      col: (x) => field.x + halfW + Math.round(x - w.x + sh.x),
      row: (y) => field.y + halfH + Math.round((y - w.y) / WU_PER_ROW + sh.y),
      colF: (x) => field.x + halfW + (x - w.x) + sh.x,
      rowF: (y) => field.y + halfH + (y - w.y) / WU_PER_ROW + sh.y,
      lit: (x, y) => !dark || Math.hypot(x - w.x, y - w.y) <= radius,
      shadeAt: (x, y, c) => {
        if (!dark || soft) return c;
        return Math.hypot(x - w.x, y - w.y) <= radius ? c : shade(c, 0.4);
      },
      inside: (sx, sy) => sx >= field.x && sx < field.x + field.w && sy >= field.y && sy < field.y + field.h,
    };

    // Hand the lantern to backends that can render a real falloff.
    if (dark && soft) r.setLight(p.colF(w.x), p.rowF(w.y), radius);

    this.drawGround(r, w, field, dark && !soft, radius);
    // Sparks are the bottom of the juice stack: drawn before the gore even, so
    // nothing that matters ever loses a cell to one (juice.tsv: the rat wins).
    this.drawSparks(r, w, p);
    this.drawDecals(r, w, p);
    this.drawEmbers(r, w, p);
    this.drawHazards(r, w, p);
    this.drawColumns(r, w, p);
    this.drawRings(r, w, p);
    this.drawPickups(r, w, p);
    this.drawEnemies(r, w, field, p, dark);
    // Death pops sit where the enemy stood; damage numbers ride above the crowd.
    this.drawPops(r, w, field, p);
    this.drawNumbers(r, w, p);
    this.drawBands(r, w, p);
    this.drawBolts(r, w, p);
    this.drawOrbs(r, w, p);

    // The player is drawn last and is the only bright white thing on the field.
    // Her head is still the `@`; the sprite carries the rest of the silhouette.
    // On a level-up the `@` burns gold for `levelup_flash` seconds — no ring, no
    // new glyph, just the one you already are, lit. The card is about to fill the
    // screen anyway (juice.tsv §5).
    const goldFlash = w.playerFlash > 0 ? ACCENT : null;
    const playerId = w.character?.sprite ?? 'sprites/player';
    const playerImg = this.imageFor(r, w, playerId);
    if (playerImg !== null) {
      // design.md §15.7: a bare raster blit reads as part of the void — the
      // reserved-bright-white-player law needs a code answer on this medium
      // too. `PLAYER_COLOR` (0xffffff) haloes the ship the same way it used to
      // be the one glyph nothing else could draw in.
      r.drawImage(p.colF(w.x), p.rowF(w.y), playerImg.img, playerImg.wCells, playerImg.hCells, 0, PLAYER_COLOR);
      // The level-up flash still needs to read on a raster ship; a white full-field
      // flash effect already exists below (`drawWhiteFlash`) for bigger moments, so
      // this one frame of colour just isn't drawn on raster yet — a placeholder
      // glyph-only nicety, not a correctness gap.
    } else {
      const playerSprite = this.sprites.get(playerId);
      if (!playerSprite.placeholder) {
        // An opaque player carries her own background, so the horde parts around
        // her outline instead of a ghoul's `(` sitting between her boots.
        const fill = playerSprite.opaque ? OPAQUE_BG : null;
        drawSprite(r, frameAt(playerSprite, w.timeAlive), p.col(w.x), p.row(w.y), field, goldFlash, DEFAULT, fill);
      } else {
        r.setF(p.colF(w.x), p.rowF(w.y), w.playerDef.glyph, goldFlash ?? PLAYER_COLOR);
      }
    }

    if (this.portraitId !== null) this.drawPortrait(r, field, this.portraitId);
    if (w.effects.some((fx) => fx.kind === 'flash')) this.drawWhiteFlash(r, field);
  }

  /**
   * Sparse static scatter so movement is legible on an empty field. Hashed from
   * world coords, not random, or it would shimmer as the camera moves.
   */
  private drawGround(r: Surface, w: World, field: Rect, dark: boolean, radius: number): void {
    const originX = Math.round(w.x) - Math.floor(field.w / 2);
    const originY = Math.round(w.y / WU_PER_ROW) - Math.floor(field.h / 2);

    for (let sy = 0; sy < field.h; sy++) {
      for (let sx = 0; sx < field.w; sx++) {
        const wx = originX + sx;
        const wy = originY + sy;
        const h = hash2(wx, wy, 7);
        if (h > 0.028) continue;

        // `,` where a `.` used to sit: `.` is retired game-wide because at a
        // glance it is `·`, the XP mote. Ground is scenery and must never read
        // as a pickup. (Jane: swap this speck if you want a different texture.)
        const ch = h < 0.008 ? '"' : h < 0.017 ? ',' : '`';
        const inLight = !dark || Math.hypot(wx - w.x, wy * WU_PER_ROW - w.y) <= radius;
        r.set(field.x + sx, field.y + sy, ch, inLight ? 0x3a4438 : 0x2c2c2c);
      }
    }
  }

  private drawDecals(r: Surface, w: World, p: Proj): void {
    const stages = w.table.decals;
    if (stages.length === 0) return;
    const goreLevel = param(w.data.director, 'gore_level');

    for (const d of w.decals) {
      const age = w.time - d.born;
      const stage = stageFor(stages, age);
      if (stage === null) continue;

      const sx = p.col(d.cx);
      const sy = p.row(d.cy * WU_PER_ROW);
      if (!p.inside(sx, sy)) continue;

      // Fade within the stage as well as between stages, so the carpet thins
      // continuously instead of stepping through five discrete looks.
      //
      // GORE_LEVEL sits on top of that. The floor is scenery: it must read as a
      // record of the slaughter without competing with the things that can kill
      // you or the XP you need to find. At full brightness a late-game field is
      // an unreadable red sheet — the owner's exact complaint.
      const t = (age - stage.ageFrom) / Math.max(0.001, stage.ageTo - stage.ageFrom);
      const c = shade(stage.color, goreLevel * (1 - t * 0.45));
      r.set(sx, sy, stage.glyph, p.shadeAt(d.cx, d.cy * WU_PER_ROW, c));
    }
  }

  private drawEmbers(r: Surface, w: World, p: Proj): void {
    // A Cinder Trail ember is a weapon the player emits, so it speaks the
    // Warden's alphabet: `°`, never `.`. `.` reads as `·` at a glance, and `·`
    // is an XP mote — the owner has already reported losing his XP once. The
    // ember holds its shape and fades in COLOUR instead (jane.md [29]).
    const cinder = juiceGlyph(w.data.juice, 'cinder', '°', DEFAULT).chars;
    for (const em of w.embers) {
      const sx = p.col(em.x);
      const sy = p.row(em.y);
      if (!p.inside(sx, sy)) continue;
      const t = Math.min(1, em.life / 3);
      r.setF(p.colF(em.x), p.rowF(em.y), cinder, shade(em.color, 0.5 + t * 0.5));
    }
  }

  /**
   * Lantern sparks (juice.tsv §6). They rise, cool from yellow toward a dim
   * ember, and are capped at `ember_level` so a spark never out-shines an XP
   * mote — beauty does not outrank information (design §9).
   */
  private drawSparks(r: Surface, w: World, p: Proj): void {
    if (w.sparks.length === 0) return;
    const g = juiceGlyph(w.data.juice, 'ember', "'", 0xffcc44);
    const ceil = juice(w.data.juice, 'ember_level');

    for (const s of w.sparks) {
      const sx = p.col(s.x);
      const sy = p.row(s.y);
      if (!p.inside(sx, sy)) continue;
      const t = Math.min(1, s.age / Math.max(0.0001, s.life));
      const hue = mix(g.color, 0x6a1a08, t); // yellow -> dim red as it cools
      r.setF(p.colF(s.x), p.rowF(s.y), g.chars, shade(hue, ceil * (1 - t * 0.6)));
    }
  }

  /**
   * The death pop (juice.tsv §2): one bright frame of the enemy's own glyphs
   * where it fell, fading over `death_flash`. Costs no art and it is the single
   * frame that sells a kill. The boss never pops — it is filtered upstream.
   */
  private drawPops(r: Surface, w: World, field: Rect, p: Proj): void {
    if (w.pops.length === 0) return;
    const life = Math.max(0.0001, juice(w.data.juice, 'death_flash'));

    for (const pop of w.pops) {
      const sx = p.col(pop.x);
      const sy = p.row(pop.y);
      if (!p.inside(sx, sy)) continue;

      const k = Math.max(0, 1 - pop.age / life);
      const white = shade(FLASH_COLOR, 0.6 + 0.4 * k);
      const id = pop.elite ? `sprites/elites/${pop.def.id}` : `sprites/mobs/${pop.def.id}`;
      const sprite = this.sprites.get(id);
      if (!sprite.placeholder) {
        drawSprite(r, frameAt(sprite, 0, pop.phase), sx, sy, field, white);
      } else {
        r.setF(p.colF(pop.x), p.rowF(pop.y), pop.def.glyph, white);
      }
    }
  }

  /**
   * Damage numbers (juice.tsv §3). At most one per enemy; it climbs and brightens
   * as damage is fed into it. White, capped below the player's pure white so it
   * never out-shines the thing it celebrates, and it fades over its final third.
   */
  private drawNumbers(r: Surface, w: World, p: Proj): void {
    if (w.numbers.length === 0) return;
    const g = juiceGlyph(w.data.juice, 'number', '0123456789', 0xf0f0f0);
    const liftMax = Math.max(0.0001, juice(w.data.juice, 'num_lift_max'));

    for (const n of w.numbers) {
      const sx = p.col(n.x);
      const sy = p.row(n.y);
      if (!p.inside(sx, sy)) continue;

      const fade = Math.min(1, (n.life - n.age) / (n.life * 0.33));
      const bright = (0.55 + 0.35 * (n.lift / liftMax)) * Math.max(0, fade);
      const text = String(Math.round(n.amount));
      r.text(sx - Math.floor(text.length / 2), sy, text, shade(g.color, bright));
    }
  }

  private drawHazards(r: Surface, w: World, p: Proj): void {
    const glyph = w.data.countess.trailGlyph;
    const life = Math.max(0.001, countessParam(w.data.countess, 'trail_life'));
    for (const h of w.hazards) {
      const sx = p.col(h.x);
      const sy = p.row(h.y);
      if (!p.inside(sx, sy)) continue;
      // Cools as it burns out, so the arena reads as filling with old exhaust.
      r.set(sx, sy, glyph, shade(h.color, Math.min(1, 0.35 + (h.life / life) * 0.65)));
    }
  }

  private drawColumns(r: Surface, w: World, p: Proj): void {
    for (const c of w.columns) {
      const x0 = p.col(c.x - c.w / 2);
      const x1 = p.col(c.x + c.w / 2);
      const y0 = p.row(c.y - c.h / 2);
      const y1 = p.row(c.y + c.h / 2);

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!p.inside(x, y)) continue;
          r.set(x, y, '|', c.color);
        }
      }
    }
  }

  /** A circular AoE of radius r draws as an ellipse rx = r, ry = r/2 (design §5). */
  private drawRings(r: Surface, w: World, p: Proj): void {
    for (const fx of w.effects) {
      if (fx.kind !== 'ring') continue;

      const steps = Math.max(16, Math.round(fx.radius * 4));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const sx = p.col(fx.x + Math.cos(a) * fx.radius);
        const sy = p.row(fx.y + Math.sin(a) * fx.radius);
        if (!p.inside(sx, sy)) continue;
        r.set(sx, sy, '~', fx.color);
      }
    }
  }

  private drawPickups(r: Surface, w: World, p: Proj): void {
    // XP is information, not scenery. It is drawn over the gore, never dimmed by
    // the dark, and it breathes — because a static dark-blue `·` on a red carpet
    // is invisible, which is precisely what the owner reported.
    //
    // Jane's fix went further than mine and is better: now that a mote is bright
    // cyan rather than dark blue, it doesn't need much lift, and lifting it hard
    // pushes 176 of them up near the player's own bright white. So find the eye
    // with *motion* instead — a pulse costs no brightness at all.
    const amp = param(w.data.director, 'mote_pulse');
    const hz = param(w.data.director, 'mote_pulse_hz');
    const lift = param(w.data.director, 'mote_lift');
    const pulse = 1 - amp + amp * (0.5 + 0.5 * Math.sin(w.timeAlive * hz * Math.PI * 2));

    for (const pk of w.pickups) {
      const sx = p.col(pk.x);
      const sy = p.row(pk.y);
      if (!p.inside(sx, sy)) continue;

      const mote = pk.kind === 'mote';
      const id = mote ? (pk.value >= 20 ? 'mote20' : pk.value >= 5 ? 'mote5' : 'mote1') : pk.kind;

      const def = w.table.entities.get(id);
      const glyph = def?.glyph ?? '·';
      const base = def?.color ?? 0x6f8dff;

      // Only the motes breathe. A chest is already the brightest yellow on the
      // field and does not need to wave. Pickups are never dimmed by the lantern.
      const color = mote ? shade(mix(base, 0xffffff, lift), pulse) : base;
      r.setF(p.colF(pk.x), p.rowF(pk.y), glyph, color);
    }
  }

  private drawEnemies(r: Surface, w: World, field: Rect, p: Proj, dark: boolean): void {
    // Painter's algorithm on world y, so 220 overlapping sprites read as a crowd
    // rather than as z-fighting noise: things lower on the screen are nearer, so
    // they draw last and occlude what's behind them.
    this.zOrder.length = 0;
    for (const e of w.enemies) this.zOrder.push(e);
    this.zOrder.sort((a, b) => a.y - b.y);

    for (const e of this.zOrder) {
      const sx = p.col(e.x);
      const sy = p.row(e.y);

      if (e.boss) {
        this.drawBoss(r, w, e, sx, sy, field);
        continue;
      }
      if (!p.inside(sx, sy)) continue;

      const inLight = p.lit(e.x, e.y);

      // The Stalker is the one thing that can kill you while unseen — by design,
      // and it's telegraphed by a `?` at the light's edge before it arrives.
      if (e.def.id === 'stalker' && !inLight && dark) {
        this.drawStalkerTell(r, w, e, p);
        continue;
      }

      // Hit flash: lift toward white by `hit_flash_lift` over the flash's life,
      // never all the way (that erases the silhouette and reads as a new enemy
      // arriving, not this one getting hurt). 60ms, from juice.tsv.
      const lift = e.flash > 0 && e.flashMax > 0 ? juice(w.data.juice, 'hit_flash_lift') * (e.flash / e.flashMax) : 0;

      // Elites ignore the dark: they're always fully lit.
      let color = e.elite ? e.def.color : p.shadeAt(e.x, e.y, e.def.color);
      if (!inLight && !e.elite && !r.caps.smoothLight) color = DARK_COLOR;
      if (lift > 0) color = mix(color, FLASH_COLOR, lift);

      // Raster art by convention first (images.tsv, same id namespace), then
      // Jane's ASCII sprite (jane.md), then the bare `glyph` column in
      // glyphs.tsv. Each fallback is how we ship a half-drawn bestiary.
      const id = spriteIdFor(e);
      const img = this.imageFor(r, w, id);
      if (img !== null) {
        r.drawImage(p.colF(e.x), p.rowF(e.y), img.img, img.wCells, img.hCells);
      } else {
        const sprite = this.sprites.get(id);
        if (!sprite.placeholder) {
          drawSprite(r, frameAt(sprite, e.age, e.phase), sx, sy, field, null, DEFAULT, null, lift);
        } else {
          r.setF(p.colF(e.x), p.rowF(e.y), e.def.glyph, color);
        }
      }

      if (e.elite) this.drawEliteBar(r, e, sx, sy, field);
    }
  }

  /** A `?` at the light's edge, one second before the Stalker enters it. */
  private drawStalkerTell(r: Surface, w: World, e: Enemy, p: Proj): void {
    const dist = Math.hypot(e.x - w.x, e.y - w.y);
    const lead = e.def.speed * 1.0;
    if (dist > w.lightRadius + lead) return;

    const a = Math.atan2(e.y - w.y, e.x - w.x);
    const sx = p.col(w.x + Math.cos(a) * w.lightRadius);
    const sy = p.row(w.y + Math.sin(a) * w.lightRadius);
    if (p.inside(sx, sy)) r.set(sx, sy, '?', 0xa020a0);
  }

  private drawBoss(r: Surface, w: World, e: Enemy, sx: number, sy: number, field: Rect): void {
    const img = this.imageFor(r, w, 'sprites/countess');
    if (img !== null) {
      // The telegraph tint (below) needs per-pixel recolouring to apply to a
      // raster image; skipped for v1 — the boss bar and the screen shake
      // already carry the charge warning. Tracked in john.md as a follow-up.
      r.drawImage(sx, sy, img.img, img.wCells, img.hCells);
      return;
    }

    const sprite = this.sprites.get('sprites/countess', 'C', e.def.color);
    const frame = frameAt(sprite, w.timeAlive);

    // The telegraph is the player's entire tell before a 52 wu/s charge they
    // cannot outrun, so it has to be the loudest thing on the field — a real
    // tint that overrides everything. A plain hit, though, only lifts her.
    let tint: Color | null = null;
    let lift = e.flash > 0 && e.flashMax > 0 ? juice(w.data.juice, 'hit_flash_lift') * (e.flash / e.flashMax) : 0;
    if (w.bossTelegraph > 0) {
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(w.timeAlive * 26));
      tint = mix(0xff3b3b, 0xffffff, pulse * (1 - w.bossTelegraph));
      lift = 0;
    }
    drawSprite(r, frame, sx, sy, field, tint, DEFAULT, null, lift);
  }

  private drawEliteBar(r: Surface, e: Enemy, sx: number, sy: number, field: Rect): void {
    const y = sy - 1;
    if (y < field.y) return;
    const width = 5;
    const frac = e.hp / e.maxHp;
    const filled = Math.round(frac * width);
    for (let i = 0; i < width; i++) {
      const px = sx - 2 + i;
      if (px < field.x || px >= field.x + field.w) continue;
      r.set(px, y, i < filled ? '▬' : '─', i < filled ? 0xff3b3b : 0x503030);
    }
  }

  private drawBands(r: Surface, w: World, p: Proj): void {
    for (const fx of w.effects) {
      if (fx.kind !== 'band') continue;
      // Two frames, ~60ms each: `═` then `─`. That's the whole animation, and
      // it reads perfectly at speed.
      const ch = fx.age < 0.06 ? '═' : '─';
      const color = fx.age < 0.06 ? ACCENT : 0xb8a000;

      const x0 = p.col(fx.xLeft);
      const x1 = p.col(fx.xRight); // exclusive: [xLeft, xRight)
      const cy = p.row(fx.yCenter);

      for (let y = cy - fx.halfRows; y <= cy + fx.halfRows; y++) {
        for (let x = x0; x < x1; x++) {
          if (!p.inside(x, y)) continue;
          r.set(x, y, ch, color);
        }
      }
    }
  }

  private drawBolts(r: Surface, w: World, p: Proj): void {
    for (const b of w.bolts) {
      const sx = p.col(b.x);
      const sy = p.row(b.y);
      if (p.inside(sx, sy)) r.setF(p.colF(b.x), p.rowF(b.y), b.glyph, b.color);
    }
    for (const s of w.salts) {
      const sx = p.col(s.x);
      const sy = p.row(s.y);
      if (p.inside(sx, sy)) r.setF(p.colF(s.x), p.rowF(s.y), '^', s.color);
    }
  }

  private drawOrbs(r: Surface, w: World, p: Proj): void {
    for (const o of w.orbs) {
      const sx = p.col(o.x);
      const sy = p.row(o.y);
      if (p.inside(sx, sy)) r.setF(p.colF(o.x), p.rowF(o.y), 'o', o.color);
    }
  }

  /** One white frame. Evolution, revival, boss phase change. */
  private drawWhiteFlash(r: Surface, field: Rect): void {
    for (let y = field.y; y < field.y + field.h; y++) {
      for (let x = field.x; x < field.x + field.w; x++) r.tint(x, y, 0xffffff);
    }
  }

  private drawPortrait(r: Surface, field: Rect, id: string): void {
    const sprite = this.sprites.get(`portraits/${id}`);
    if (sprite.placeholder) return; // Jane hasn't drawn this one yet.

    const frame = sprite.frames[0]!;
    const x = field.x + field.w - frame.w - 2;
    const y = field.y + 1;

    // Slide-in eased over the first 250ms. It never pauses the game: stopping
    // mid-swarm to admire art is how you get killed.
    const t = Math.min(1, (1.5 - this.portraitTimer) / 0.25);
    const offset = Math.round((1 - t * t) * (frame.w + 2));

    drawSprite(r, frame, x + offset, y, field);
    r.text(x + offset, y + frame.h, sprite.name.toUpperCase(), ACCENT);
  }
}

/**
 * `sprites/mobs/<id>` for trash, `sprites/elites/<id>` for elites. Missing art
 * falls back to the glyph, so a half-drawn bestiary still ships.
 */
function spriteIdFor(e: Enemy): string {
  return e.elite ? `sprites/elites/${e.def.id}` : `sprites/mobs/${e.def.id}`;
}

function stageFor(stages: readonly DecalDef[], age: number): DecalDef | null {
  for (const s of stages) {
    if (age >= s.ageFrom && age < s.ageTo) return s;
  }
  return null;
}

/** Top and bottom HUD lines (design.md §12). */
export function drawHud(r: Surface, w: World, fps: number, opts: ViewOptions): void {
  const top = 0;
  const bottom = r.height - 1;

  r.fillRect(0, top, r.width, 1, ' ', DEFAULT, HUD_BG);
  r.fillRect(0, bottom, r.width, 1, ' ', DEFAULT, HUD_BG);

  // --- top: HP, level, clock, kills, gold ---
  let x = 1;
  x += r.text(x, top, 'HP ', HUD_DIM, HUD_BG);
  drawBar(r, x, top, 10, w.hp / w.maxHp, 0xff3b3b, 0x4a2020, '░');
  x += 10;
  x += r.text(x, top, ` ${Math.ceil(w.hp)}/${w.maxHp}`, HUD_TEXT, HUD_BG);
  r.text(x + 2, top, `LV ${w.level}`, ACCENT, HUD_BG);

  // The clock freezes at 19:00 when the Countess arrives, and turns red.
  const clock = formatTime(w.time);
  drawCentered(r, Math.floor(r.width / 2), top, `⏱ ${clock}`, w.clockRunning ? HUD_TEXT : 0xff3b3b, HUD_BG);

  const right = `☠ ${w.kills.toLocaleString('en-US')}   ⛁ ${w.gold}`;
  r.text(r.width - right.length - 1, top, right, HUD_TEXT, HUD_BG);

  // --- bottom: XP bar, then weapon glyphs, then (optionally) debug counters ---
  const weaponStrip = w.weapons.map((wp) => weaponGlyph(w, wp.id)).join(' ');
  const dbg = opts.debug
    ? `${fps.toFixed(0)}fps ${w.enemies.length}e ${w.pickups.length}p ${w.decals.length}d`
    : '';

  // Reserve the debug gutter out of the bar, or it draws over the weapon strip.
  const reserved = weaponStrip.length + 4 + (dbg.length > 0 ? dbg.length + 2 : 0);
  const barWidth = Math.max(10, r.width - reserved - 2);

  drawBar(r, 1, bottom, barWidth, w.xp / w.xpToNext, 0x4ff0f0, 0x1e3a3a, '─');
  r.text(barWidth + 3, bottom, weaponStrip, ACCENT, HUD_BG);
  if (dbg.length > 0) r.text(r.width - dbg.length - 1, bottom, dbg, HUD_DIM, HUD_BG);

  if (w.bossActive) drawBossBar(r, w);
}

function weaponGlyph(w: World, id: string): string {
  const levels = w.data.weapons.byId.get(id);
  return levels?.[0]?.glyph ?? '?';
}

/** The Countess gets the whole top of the field. */
function drawBossBar(r: Surface, w: World): void {
  const y = 1;
  const width = Math.min(r.width - 20, 60);
  const x = Math.floor((r.width - width) / 2);

  drawCentered(r, Math.floor(r.width / 2), y, 'THE COUNTESS', 0xff3b3b);
  drawBar(r, x, y + 1, width, w.bossHpFraction, 0xff3b3b, 0x3a1010, '─');
}
