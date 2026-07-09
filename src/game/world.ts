/**
 * The simulation. No rendering, no input parsing — just state and rules.
 *
 * ## Coordinates (design.md §5, and it is a hard requirement)
 *
 * A terminal cell is twice as tall as it is wide. So the world is measured in
 * **world units (wu)** where `1 cell = 1 wu wide x 2 wu tall`. Every speed,
 * radius and distance in here is isotropic wu. Rendering — and only rendering —
 * divides y by 2. Get this wrong and circles become ovals, fleeing upward is
 * twice as fast as fleeing sideways, and every AoE lies to the player.
 *
 * The world is unbounded. No walls: walls let you camp a corner, and the genre
 * dies when you can camp.
 */

import { Rng } from '../engine/rng.ts';
import type { EntityDef, GlyphTable } from '../data/entities.ts';
import { requireDef } from '../data/entities.ts';

/** Vertical wu per terminal row. The whole aspect-ratio correction, in one number. */
export const WU_PER_ROW = 2;

export const RUN_LENGTH = 20 * 60;
export const BOSS_TIME = 19 * 60;

const MOTE_MERGE_DIST = 1.2;
const MOTE_MAGNET_SPEED = 46;
const CONTACT_COOLDOWN = 0.5;
const DECAL_LIFETIME = 90;
const MAX_DECALS = 24000;
const SEPARATION_DIST = 1.15;

export type Vec = { x: number; y: number };

export type Enemy = {
  def: EntityDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Seconds alive; drives sine drift and spawn de-sync. */
  age: number;
  /** Cooldown until this enemy can damage the player again. */
  hitCd: number;
  /** Damage flash timer, in seconds. */
  flash: number;
  elite: boolean;
  /** Per-enemy phase so a flock of bats doesn't move as one organism. */
  phase: number;
  knockX: number;
  knockY: number;
};

export type Mote = {
  x: number;
  y: number;
  value: number;
  /** Set once the magnet grabs it; from then on it homes and can't merge. */
  homing: boolean;
  dead: boolean;
};

export type Decal = {
  /** Cell coords, not wu: the gore layer is a character grid. */
  cx: number;
  cy: number;
  born: number;
};

export type Weapon = {
  id: string;
  name: string;
  glyph: string;
  level: number;
  cooldown: number;
  timer: number;
};

export type Passive = {
  id: string;
  name: string;
  level: number;
};

/**
 * A transient visual the renderer draws and the sim owns the lifetime of.
 *
 * The band is stored as wu bounds horizontally but as a *row count* vertically.
 * Rows are the honest unit here: "3 rows tall" is what design.md specifies and
 * what the player sees. Deriving rows by rounding wu bounds gives a lopsided
 * band, because Math.round(-1.5) is -1 while Math.round(1.5) is 2.
 */
export type Effect = {
  kind: 'chain';
  /** Horizontal wu bounds, half-open: [xLeft, xRight). */
  xLeft: number;
  xRight: number;
  /** Vertical centre in wu, and how many rows out from it the band reaches. */
  yCenter: number;
  halfRows: number;
  age: number;
};

export type Stats = {
  might: number;
  haste: number;
  area: number;
  swiftness: number;
  magnet: number;
  growth: number;
  armour: number;
};

export class World {
  readonly table: GlyphTable;
  readonly rng: Rng;
  readonly playerDef: EntityDef;

  // --- player ---
  x = 0;
  y = 0;
  hp: number;
  maxHp: number;
  /** The Chain is horizontal-only; you turn by walking. -1 left, +1 right. */
  facing: 1 | -1 = 1;
  moving = false;

  level = 1;
  xp = 0;
  xpToNext = 5;
  kills = 0;
  gold = 0;
  time = 0;
  /** Frozen while the Countess is alive, per design.md §4. */
  clockRunning = true;
  dead = false;

  weapons: Weapon[] = [];
  passives: Passive[] = [];

  enemies: Enemy[] = [];
  motes: Mote[] = [];
  decals: Decal[] = [];
  effects: Effect[] = [];

  /** Enemy ids the player has met, for the first-encounter portrait (design §12). */
  seen = new Set<string>();
  /** Set for one frame when a new enemy type shows up. */
  justSeen: string | null = null;

  /** Rolling peak, for the death screen's "best minute". */
  private killsThisMinute = 0;
  private minuteMark = 0;
  bestMinute = 0;

  private budget = 0;
  private spawnPool: EntityDef[] = [];

  /** Grid for enemy-enemy separation. Rebuilt each tick. */
  private grid = new Map<number, number[]>();

  constructor(table: GlyphTable, seed?: number) {
    this.table = table;
    this.rng = new Rng(seed);
    this.playerDef = requireDef(table, 'player');

    this.maxHp = this.playerDef.hp;
    this.hp = this.maxHp;

    for (const def of table.entities.values()) {
      if (def.cost > 0 && def.from !== null) this.spawnPool.push(def);
    }
    this.spawnPool.sort((a, b) => (a.from ?? 0) - (b.from ?? 0));

    this.weapons.push({
      id: 'chain',
      name: 'The Chain',
      glyph: '═',
      level: 1,
      cooldown: 1.1,
      timer: 0.35,
    });
  }

  // ---------------------------------------------------------------- stats

  /** Aggregate passive levels into multipliers. Recomputed on demand; it's cheap. */
  stats(): Stats {
    const lv = (id: string): number => this.passives.find((p) => p.id === id)?.level ?? 0;
    return {
      might: 1 + lv('might') * 0.1,
      haste: 1 - lv('haste') * 0.06,
      area: 1 + lv('area') * 0.1,
      swiftness: 1 + lv('swiftness') * 0.07,
      magnet: 1 + lv('magnet') * 0.35,
      growth: 1 + lv('growth') * 0.08,
      armour: lv('armour'),
    };
  }

  get lightRadius(): number {
    return 14 + (this.passives.find((p) => p.id === 'oil')?.level ?? 0) * 3;
  }

  get pickupRadius(): number {
    return 6 * this.stats().magnet;
  }

  // ---------------------------------------------------------------- tick

  update(dt: number, input: Vec): void {
    if (this.dead) return;

    if (this.clockRunning) this.time += dt;

    if (this.time - this.minuteMark >= 60) {
      this.bestMinute = Math.max(this.bestMinute, this.killsThisMinute);
      this.killsThisMinute = 0;
      this.minuteMark = this.time;
    }

    this.movePlayer(dt, input);
    this.runDirector(dt);
    this.buildGrid();
    this.moveEnemies(dt);
    this.fireWeapons(dt);
    // Reap after weapons fire, not before: otherwise an enemy killed this tick
    // survives until the next one, dealing contact damage from beyond the grave.
    this.reap();
    this.updateMotes(dt);
    this.updateEffects(dt);
    this.pruneDecals();
  }

  private movePlayer(dt: number, input: Vec): void {
    const len = Math.hypot(input.x, input.y);
    this.moving = len > 0;
    if (len === 0) return;

    // Normalize so diagonals aren't 1.41x faster (design.md §5).
    const nx = input.x / len;
    const ny = input.y / len;

    if (nx > 0.2) this.facing = 1;
    else if (nx < -0.2) this.facing = -1;

    const speed = this.playerDef.speed * this.stats().swiftness;
    this.x += nx * speed * dt;
    this.y += ny * speed * dt;
  }

  // ---------------------------------------------------------------- spawning

  /**
   * Budget director (design.md §11): earn points every second, spend them on
   * whatever is unlocked. Spawn just outside the viewport so nothing pops in.
   */
  private runDirector(dt: number): void {
    const minutes = this.time / 60;
    this.budget += (1.0 + minutes * 0.9) * dt;

    const available = this.spawnPool.filter((d) => (d.from ?? Infinity) <= this.time);
    if (available.length === 0) return;

    let guard = 0;
    while (guard++ < 64) {
      const cheapest = Math.min(...available.map((d) => d.cost));
      if (this.budget < cheapest) break;

      const affordable = available.filter((d) => d.cost <= this.budget);
      const def = this.rng.pick(affordable);
      this.budget -= def.cost;

      // Rats travel in packs; the table says 12+.
      const count = def.id === 'rat' ? this.rng.int(12, 18) : 1;
      const anchor = this.spawnPoint();
      for (let i = 0; i < count; i++) {
        this.spawnEnemy(def, anchor.x + this.rng.range(-6, 6), anchor.y + this.rng.range(-6, 6));
      }
    }
  }

  /** A point on an ellipse comfortably outside the visible field. */
  private spawnPoint(): Vec {
    const dir = this.rng.onCircle();
    const rx = 70;
    const ry = 40;
    return { x: this.x + dir.x * rx, y: this.y + dir.y * ry };
  }

  spawnEnemy(def: EntityDef, x: number, y: number, elite = false): Enemy {
    const hp = def.hp * (elite ? 20 : 1);
    const e: Enemy = {
      def,
      x,
      y,
      hp,
      maxHp: hp,
      age: 0,
      hitCd: 0,
      flash: 0,
      elite,
      phase: this.rng.next() * Math.PI * 2,
      knockX: 0,
      knockY: 0,
    };
    this.enemies.push(e);

    if (!this.seen.has(def.id)) {
      this.seen.add(def.id);
      this.justSeen = def.id;
    }
    return e;
  }

  // ---------------------------------------------------------------- enemies

  private cellKey(x: number, y: number): number {
    // 8wu buckets. Bit-packing keeps this a Map<number,...> rather than strings.
    const gx = Math.floor(x / 8) + 4096;
    const gy = Math.floor(y / 8) + 4096;
    return (gx << 13) | gy;
  }

  private buildGrid(): void {
    this.grid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      const k = this.cellKey(e.x, e.y);
      const bucket = this.grid.get(k);
      if (bucket === undefined) this.grid.set(k, [i]);
      else bucket.push(i);
    }
  }

  private moveEnemies(dt: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0) continue; // already dead this tick; reap() will clear it

      e.age += dt;
      e.hitCd = Math.max(0, e.hitCd - dt);
      e.flash = Math.max(0, e.flash - dt);

      const dx = this.x - e.x;
      const dy = this.y - e.y;
      const dist = Math.hypot(dx, dy);
      // Guard only the division. Using the guarded value for the contact test
      // would mean an enemy standing exactly on you could never hit you.
      const norm = dist === 0 ? 1 : dist;

      let vx = (dx / norm) * e.def.speed;
      let vy = (dy / norm) * e.def.speed;

      // Bats drift on a sine wave perpendicular to their approach, so they
      // overshoot you instead of homing perfectly. glyphs.tsv: amp 6wu, T 1.2s.
      if (e.def.id === 'bat') {
        const wobble = Math.sin(e.age * ((Math.PI * 2) / 1.2) + e.phase) * 6;
        vx += (-dy / norm) * wobble;
        vy += (dx / norm) * wobble;
      }

      // Blood Wisps float through the pile; everything else jostles.
      if (e.def.id !== 'wisp') {
        const sep = this.separation(i, e);
        vx += sep.x;
        vy += sep.y;
      }

      e.x += (vx + e.knockX) * dt;
      e.y += (vy + e.knockY) * dt;

      const decay = Math.exp(-8 * dt);
      e.knockX *= decay;
      e.knockY *= decay;

      // Contact damage: a slow drain on a per-enemy cooldown, never a spike.
      if (dist < 1.0 && e.hitCd === 0) {
        this.damagePlayer(e.def.power);
        e.hitCd = CONTACT_COOLDOWN;
      }
    }
  }

  /** Clear out everything killed this tick, awarding drops exactly once. */
  private reap(): void {
    if (!this.enemies.some((e) => e.hp <= 0)) return;

    const alive: Enemy[] = [];
    const dead: Enemy[] = [];
    for (const e of this.enemies) (e.hp > 0 ? alive : dead).push(e);

    // Swap the survivors in *before* running death effects: a Rattlejack's
    // death spawns two rats, and spawnEnemy appends to `this.enemies`. Reap
    // first and those rats would land in the array we're about to discard.
    this.enemies = alive;
    for (const e of dead) this.killEnemy(e);
  }

  /** Soft push-apart so the swarm forms a crowd, not a single stacked glyph. */
  private separation(index: number, e: Enemy): Vec {
    let sx = 0;
    let sy = 0;

    const gx = Math.floor(e.x / 8);
    const gy = Math.floor(e.y / 8);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = this.grid.get(((gx + ox + 4096) << 13) | (gy + oy + 4096));
        if (bucket === undefined) continue;

        for (const j of bucket) {
          if (j === index) continue;
          const o = this.enemies[j]!;
          const dx = e.x - o.x;
          const dy = e.y - o.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > SEPARATION_DIST * SEPARATION_DIST || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const push = (SEPARATION_DIST - d) / SEPARATION_DIST;
          sx += (dx / d) * push * 14;
          sy += (dy / d) * push * 14;
        }
      }
    }
    return { x: sx, y: sy };
  }

  damageEnemy(e: Enemy, amount: number, knockback = 0): void {
    e.hp -= amount;
    e.flash = 0.08;
    if (knockback > 0) {
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      e.knockX += (dx / d) * knockback * 10;
      e.knockY += (dy / d) * knockback * 10;
    }
  }

  private killEnemy(e: Enemy): void {
    this.kills++;
    this.killsThisMinute++;
    this.addDecal(e.x, e.y);

    // Rattlejacks split. The table says so; the code just reads it.
    if (e.def.id === 'rattlejack') {
      const rat = this.table.entities.get('rat');
      if (rat !== undefined) {
        for (let i = 0; i < 2; i++) {
          this.spawnEnemy(rat, e.x + this.rng.range(-2, 2), e.y + this.rng.range(-2, 2));
        }
      }
    }

    if (e.def.xp > 0) this.motes.push({ x: e.x, y: e.y, value: e.def.xp, homing: false, dead: false });
    if (this.rng.chance(1 / 40)) this.gold += this.rng.int(1, 3);
  }

  damagePlayer(amount: number): void {
    const reduced = Math.max(1, amount - this.stats().armour);
    this.hp -= reduced;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.bestMinute = Math.max(this.bestMinute, this.killsThisMinute);
    }
  }

  // ---------------------------------------------------------------- weapons

  private fireWeapons(dt: number): void {
    const s = this.stats();
    for (const w of this.weapons) {
      w.timer -= dt;
      if (w.timer > 0) continue;
      w.timer += w.cooldown * s.haste;
      if (w.id === 'chain') this.fireChain(w, s);
    }
  }

  /**
   * The Chain: a horizontal band in the facing direction, infinite pierce.
   * Horizontal-only is the point — you turn by walking, and good players flick
   * left-right to keep the band on the swarm.
   */
  private fireChain(w: Weapon, s: Stats): void {
    const lv = w.level;
    const damage = (10 + (lv >= 2 ? 4 : 0) + (lv >= 5 ? 6 : 0) + (lv >= 8 ? 8 : 0)) * s.might;
    const width = (12 + (lv >= 3 ? 3 : 0) + (lv >= 6 ? 3 : 0)) * s.area;

    // 3 rows tall, 5 at level 8 (design.md §7). Rows are odd so the band is
    // centred on the player's own row.
    const halfRows = lv >= 8 ? 2 : 1;
    // A row spans WU_PER_ROW wu, so `halfRows` rows either side of centre covers
    // yCenter ± (halfRows * WU_PER_ROW + 1) wu. That +1 is the player's own row.
    const halfHeightWu = halfRows * WU_PER_ROW + 1;

    const bothSides = lv >= 4;
    const dirs: (1 | -1)[] = bothSides ? [1, -1] : [this.facing];

    for (const dir of dirs) {
      const xLeft = dir === 1 ? this.x + 1 : this.x - 1 - width;
      const xRight = xLeft + width;

      this.effects.push({ kind: 'chain', xLeft, xRight, yCenter: this.y, halfRows, age: 0 });

      for (const e of this.enemies) {
        if (e.x >= xLeft && e.x < xRight && Math.abs(e.y - this.y) <= halfHeightWu) {
          this.damageEnemy(e, damage, 4);
        }
      }
    }
  }

  private updateEffects(dt: number): void {
    for (const fx of this.effects) fx.age += dt;
    this.effects = this.effects.filter((fx) => fx.age < 0.12);
  }

  // ---------------------------------------------------------------- motes

  /**
   * Motes merge on contact — both a performance trick and a joy: a hundred `·`
   * collapse into one fat `◆` you can inhale from across the screen.
   */
  private updateMotes(dt: number): void {
    const radius = this.pickupRadius;

    for (const m of this.motes) {
      if (m.dead) continue;

      const dx = this.x - m.x;
      const dy = this.y - m.y;
      const dist = Math.hypot(dx, dy);

      if (m.homing || dist < radius) {
        m.homing = true;
        if (dist < 1.0) {
          this.gainXp(m.value);
          m.dead = true;
          continue;
        }
        // Accelerate as it closes, so the inhale has a snap to it.
        const speed = MOTE_MAGNET_SPEED * (1 + (1 - Math.min(1, dist / radius)) * 1.5);
        m.x += (dx / dist) * speed * dt;
        m.y += (dy / dist) * speed * dt;
      }
    }

    this.mergeMotes();
    if (this.motes.some((m) => m.dead)) this.motes = this.motes.filter((m) => !m.dead);
  }

  private mergeMotes(): void {
    if (this.motes.length < 2) return;

    // Bucket by cell so merging is linear rather than quadratic. Only free
    // (non-homing) motes merge — otherwise the stream into the player fuses
    // into one blob and the inhale stops reading.
    const buckets = new Map<number, Mote[]>();
    for (const m of this.motes) {
      if (m.dead || m.homing || m.value >= 20) continue;
      const k = this.cellKey(m.x, m.y);
      const b = buckets.get(k);
      if (b === undefined) buckets.set(k, [m]);
      else b.push(m);
    }

    for (const bucket of buckets.values()) {
      for (let i = 0; i < bucket.length; i++) {
        const a = bucket[i]!;
        if (a.dead) continue;
        for (let j = i + 1; j < bucket.length; j++) {
          const b = bucket[j]!;
          if (b.dead || a.dead) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) > MOTE_MERGE_DIST) continue;
          a.value = Math.min(20, a.value + b.value);
          a.x = (a.x + b.x) / 2;
          a.y = (a.y + b.y) / 2;
          b.dead = true;
        }
      }
    }
  }

  gainXp(value: number): void {
    this.xp += Math.round(value * this.stats().growth);
    // `while`, not `if`: one fat mote can carry you through two levels.
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpToNext(this.level);
      this.pendingLevelUps++;
    }
  }

  pendingLevelUps = 0;

  // ---------------------------------------------------------------- decals

  /**
   * The gore layer. Jane specced it capped to the viewport; I anchor it in world
   * space instead so it doesn't smear when the camera moves, and bound it by
   * eviction. Same look, and it survives you walking back over old ground.
   */
  private addDecal(x: number, y: number): void {
    this.decals.push({ cx: Math.round(x), cy: Math.round(y / WU_PER_ROW), born: this.time });
    if (this.decals.length > MAX_DECALS) this.decals.splice(0, this.decals.length - MAX_DECALS);
  }

  private pruneDecals(): void {
    // Decals are appended in time order, so the expired ones are a prefix.
    let cut = 0;
    while (cut < this.decals.length && this.time - this.decals[cut]!.born > DECAL_LIFETIME) cut++;
    if (cut > 0) this.decals.splice(0, cut);
  }
}

export function xpToNext(level: number): number {
  return Math.ceil(5 * Math.pow(1.16, level - 1));
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
