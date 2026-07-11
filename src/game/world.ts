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
 *
 * ## Nothing here is balanced in code
 *
 * Enemy stats, weapon numbers at every level, passive curves, the spawn
 * director and the evolution pairs all come from Jane's `.tsv` tables at load
 * time. If you find yourself typing a damage number into this file, it belongs
 * in `assets/` instead.
 */

import { Rng } from '../engine/rng.ts';
import type { Color } from '../engine/color.ts';
import type { EntityDef, GlyphTable } from '../data/entities.ts';
import type { GameData } from '../data/gamedata.ts';
import { mixWeight, param, spawnCap, targetPopulation, type Beat } from '../data/director.ts';
import { evolutionFor, type Evolution } from '../data/evolutions.ts';
import { computeStats, passiveMaxLevel, type StatName } from '../data/passives.ts';
import { maxLevel, weaponAt, type WeaponLevel } from '../data/weapons.ts';
import { defaultCharacter, type CharacterDef } from '../data/characters.ts';
import { crossroadsParam } from '../data/crossroads.ts';
import { countessParam, phaseFor, type Phase } from '../data/countess.ts';
import { juice, shakeDef } from '../data/juice.ts';
import { emptyProfile, type Profile } from './save.ts';

/** Vertical wu per terminal row. The whole aspect-ratio correction, in one number. */
export const WU_PER_ROW = 2;

const MOTE_MERGE_DIST = 1.2;
const MOTE_MAGNET_SPEED = 46;
const CONTACT_COOLDOWN = 0.5;
const DECAL_LIFETIME = 90;
const MAX_DECALS = 24000;
const SEPARATION_DIST = 1.15;
/** Per-enemy cooldown for shapes that sit on top of an enemy continuously. */
const AURA_COOLDOWN = 0.3;
const EMBER_TICK = 0.5;
const TIDE_DURATION = 90;

export type Vec = { x: number; y: number };

export type Enemy = {
  def: EntityDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  age: number;
  hitCd: number;
  /** Seconds of hit flash left, and what it started at, so the fade is a ratio. */
  flash: number;
  flashMax: number;
  /** This enemy's one live damage number, if it has one. §14: at most one. */
  num: DamageNumber | null;
  elite: boolean;
  boss: boolean;
  /** Per-enemy phase so a flock of bats doesn't move as one organism. */
  phase: number;
  knockX: number;
  knockY: number;
  /** Cooldowns for continuous damage sources, so they tick instead of shredding. */
  orbCd: number;
  emberCd: number;
  /** Beat-spawned enemies can be given a fixed heading instead of homing. */
  driftX: number;
  driftY: number;
  drift: number;
};

export type PickupKind = 'mote' | 'gold' | 'chest' | 'heal';

export type Pickup = {
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  homing: boolean;
  dead: boolean;
};

export type Decal = { cx: number; cy: number; born: number };

export type Bolt = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  radius: number;
  pierce: number;
  knock: number;
  life: number;
  color: Color;
  glyph: string;
  /** Chain-to-next-target budget, for Hemorrhage. */
  chains: number;
  hits: Set<Enemy>;
};

export type Salt = {
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** 0..1 along the lob. */
  t: number;
  flight: number;
  dmg: number;
  radius: number;
  knock: number;
  color: Color;
  /** Bonemeal: the burst raises XP motes. */
  raisesMotes: boolean;
};

export type Ember = {
  x: number;
  y: number;
  radius: number;
  dmg: number;
  life: number;
  color: Color;
  /** Wildfire: embers spread to adjacent embers. */
  spreads: number;
};

export type Column = {
  x: number;
  y: number;
  w: number;
  h: number;
  life: number;
  dmg: number;
  color: Color;
  struck: boolean;
};

export type Hazard = { x: number; y: number; life: number; dmg: number; color: Color };

export type Orb = { x: number; y: number; radius: number; dmg: number; knock: number; color: Color };

export type Effect =
  | { kind: 'band'; xLeft: number; xRight: number; yCenter: number; halfRows: number; age: number; color: Color }
  | { kind: 'ring'; x: number; y: number; radius: number; age: number; color: Color }
  | { kind: 'flash'; age: number };

// --------------------------------------------------------------------- juice
// design.md §14. Everything below is measured in seconds and world units, and
// every constant behind it lives in `assets/juice.tsv`.

/**
 * One accumulating damage number, owned by exactly one enemy.
 *
 * Jane: *"I already made this mistake once, with gore."* One number per damage
 * **event** stacks the same way decals did — at 14:00 that's ~200 enemies × 4
 * weapons — so a number is born on an enemy's first damage and later damage is
 * *added to it*: its life resets and it brightens. A rat hit eleven times gives
 * you one number that climbs to 34 and glows.
 */
export type DamageNumber = {
  x: number;
  y: number;
  amount: number;
  age: number;
  life: number;
  /** Brightness accumulated from repeated hits. This is the crit feel, without a crit system. */
  lift: number;
  dead: boolean;
};

/** A dying enemy's last frame: its own glyphs, in white. The frame that sells the kill. */
export type Pop = {
  def: EntityDef;
  x: number;
  y: number;
  age: number;
  phase: number;
  elite: boolean;
};

/**
 * A spark off the lantern. Damages nothing, collides with nothing, drawn under
 * everything: if a spark and a rat want the same cell, the rat gets it.
 */
export type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
};

export type Weapon = {
  id: string;
  level: number;
  timer: number;
  /** Orbit angle, radians. */
  angle: number;
  evolved: Evolution | null;
};

export type Owned = { id: string; level: number };

/** Phase ids come from countess.tsv; the renderer only needs to know about dusk. */
export type BossPhase = string;

export class World {
  readonly data: GameData;
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

  /**
   * Owner feedback 09.07: "the first weapon feels clunky because you have to
   * [walk] towards enemies to aim it, meaning that you easily walk to the
   * enemies when trying to damage them."
   *
   * That's a real trap: the Chain fires horizontally in your facing direction,
   * facing is set by walking, so aiming and fleeing are the same input pulling
   * in opposite directions. The player is punished for playing correctly.
   *
   * The fix keeps design.md §7's identity — you still turn by walking, and a
   * good player still flicks left-right to keep the band on the swarm — but when
   * you *aren't* pressing a horizontal key, the lantern-bearer looks at whatever
   * is about to eat them. Kiting vertically no longer aims the whip at empty
   * ground. Set false to compare (`--no-autoface`, `?noautoface`).
   *
   * **Default off.** Jane fixed this properly in the tables instead: the Warden
   * now opens with Sanguine Nova (which seeks) and the Chain strikes both sides
   * from level 1, so facing is skill expression rather than a toll. Auto-aim on
   * top of that would erase the skill she deliberately kept. Kept as a flag
   * because it's a one-line A/B if the Chain still reads badly.
   */
  autoFace = false;

  /** Seconds since the player last pressed left or right. */
  private horizontalIdle = 0;

  level = 1;
  xp = 0;
  xpToNext = 5;
  kills = 0;
  gold = 0;
  time = 0;
  /**
   * Seconds since the run began, never frozen. `time` stops when the Countess
   * arrives, and animations must not stop with it.
   */
  timeAlive = 0;
  /** Frozen while the Countess is alive, per design.md §4. */
  clockRunning = true;
  dead = false;
  won = false;
  /** Countess phase 3 collapses the light to your lantern only. */
  dusk = false;

  weapons: Weapon[] = [];
  passives: Owned[] = [];
  revivesUsed = 0;

  enemies: Enemy[] = [];
  pickups: Pickup[] = [];
  decals: Decal[] = [];
  effects: Effect[] = [];
  bolts: Bolt[] = [];
  salts: Salt[] = [];
  embers: Ember[] = [];
  columns: Column[] = [];
  hazards: Hazard[] = [];
  orbs: Orb[] = [];

  /** The juice layer (design.md §14). Numbers, death pops, and lantern sparks. */
  numbers: DamageNumber[] = [];
  pops: Pop[] = [];
  sparks: Spark[] = [];
  private sparkDebt = 0;

  /** Seconds of frozen simulation left. Rendering never stops. */
  private hitstopT = 0;
  /**
   * Refractory: seconds until hitstop may fire again. Without it a player being
   * swarmed re-freezes every frame the moment the last freeze thaws, and the
   * game half-freezes into a permanent judder — the exact thing Jane scoped
   * hitstop *away* from. One freeze, then a gap, then it may punctuate again.
   */
  private hitstopCd = 0;
  /** Seconds the player's `@` burns gold, after a level-up. */
  playerFlash = 0;

  /**
   * Screen shake. `amp` is in cells and is always < 1 — a whole-cell shake is an
   * earthquake, and sub-cell offsets are the first thing we got back for leaving
   * the terminal. Four events in a twenty-minute run.
   */
  private shakeAmp = 0;
  private shakeLeft = 0;
  private shakeDur = 0;
  /** Advanced every frame, even while dead, so a death shake actually settles. */
  private shakeClock = 0;

  /** Enemy ids the player has met, for the first-encounter portrait (design §12). */
  seen = new Set<string>();
  justSeen: string | null = null;
  /** Set for one frame when a weapon evolves, so the UI can slam a card up. */
  justEvolved: Evolution | null = null;

  /**
   * Sound event ids raised this tick, drained by `App` into whatever
   * `AudioSink` it holds (`engine/audio.ts`). `World` never imports audio
   * itself — same reason it never imports the DOM — so this is a queue of
   * plain strings, not a call. `playSfx` below rate-limits each id so 40
   * simultaneous hits at 250 enemies don't queue 40 overlapping `hit` sounds.
   */
  sfx: string[] = [];
  private sfxCooldownUntil = new Map<string, number>();

  private playSfx(id: string, cooldown = 0): void {
    if (cooldown > 0) {
      const until = this.sfxCooldownUntil.get(id) ?? 0;
      if (this.time < until) return;
      this.sfxCooldownUntil.set(id, this.time + cooldown);
    }
    this.sfx.push(id);
  }

  pendingLevelUps = 0;
  pendingChests = 0;

  private killsThisMinute = 0;
  private minuteMark = 0;
  bestMinute = 0;

  /** Viewport in cells; the director spawns just outside it. */
  private viewCols = 100;
  private viewRows = 32;

  private spawnCredit = 0;
  private beatCursor = 0;
  private tideUntil = 0;
  private tideFactor = 1;

  private boss: Enemy | null = null;
  bossPhase: BossPhase = 'court';
  /** Seconds until her next action (a summon, or committing to a charge). */
  private bossTimer = 0;
  private bossTarget: Vec = { x: 0, y: 0 };
  /** Her heading in radians while charging. She turns at `turn_rate`, no faster. */
  private bossHeading = 0;
  private bossState: 'idle' | 'telegraph' | 'charging' = 'idle';
  /** Set while telegraphing, so the renderer can make her glow. */
  bossTelegraph = 0;
  private bossArrived = 0;
  private bossTrailAcc = 0;
  private warnedNoBat = false;

  /** Non-fatal problems noticed while playing. Surfaced on exit and in --debug. */
  readonly runtimeWarnings: string[] = [];

  private grid = new Map<number, number[]>();

  /**
   * Contact radius in wu for an enemy id. Injected, because it's derived from
   * the sprite's *inner mass* and the sim must not know what a sprite is.
   * jane.md: "Hitboxes stay circles in wu, sized to a sprite's inner mass, not
   * its bounding box. Big sprites must not become unfair sprites."
   */
  hitRadius: (id: string) => number = () => 1.0;

  /** Which character is being played. Drives the starting weapon and bonuses. */
  readonly character: CharacterDef | null;

  /** Meta-progression bought at The Crossroads. Moves the floor, never the ceiling. */
  readonly profile: Profile;

  constructor(data: GameData, seed?: number, characterId?: string, profile?: Profile) {
    this.data = data;
    this.table = data.glyphs;
    this.rng = new Rng(seed);
    this.profile = profile ?? emptyProfile();

    const player = data.glyphs.entities.get('player');
    this.playerDef = player ?? {
      id: 'player',
      glyph: '@',
      name: 'The Warden',
      color: 0xffffff,
      hp: 100,
      speed: 20,
      power: 0,
      cost: 0,
      from: null,
      xp: 0,
      notes: '',
    };

    const wantedCharacter = characterId ?? this.profile.character;
    this.character = data.characters.byId.get(wantedCharacter) ?? defaultCharacter(data.characters);

    this.maxHp = (this.character?.hp ?? this.playerDef.hp) + this.meta('max_hp');
    this.hp = this.maxHp;

    // characters.tsv: "no starting weapon may require aiming." The Warden opens
    // with Nova, which seeks. Never hardcode this — that rule is the whole file.
    const wanted = this.character?.startWeapon;
    const starting =
      wanted !== undefined && data.weapons.byId.has(wanted) ? wanted : (data.weapons.order[0] ?? null);
    if (starting !== null) this.weapons.push({ id: starting, level: 1, timer: 0.35, angle: 0, evolved: null });
  }

  setViewport(cols: number, rows: number): void {
    this.viewCols = cols;
    this.viewRows = rows;
    this.viewportKnown = true;

    // A prewarm requested before the surface was measured has been waiting for
    // a real field size to scatter across. Now it has one.
    if (this.pendingPrewarm) {
      this.pendingPrewarm = false;
      this.populateToTarget();
    }
  }

  private viewportKnown = false;
  private pendingPrewarm = false;

  /**
   * Jump the clock (the `--start mm:ss` dev flag). Beats that already passed are
   * skipped rather than all firing on the first tick — otherwise starting at
   * 18:00 would dump the rat swarm, the bat flock, the Wight Wall, the Ring and
   * three elites into your lap simultaneously.
   *
   * Beats exactly *at* the start time still fire, so `--start 19:00` shows the
   * Countess, which is the whole reason you'd type it.
   */
  fastForward(time: number): void {
    this.time = time;
    this.minuteMark = time;
    this.beatCursor = this.data.director.beats.filter((b) => b.time < time).length;

    // Fill the field to whatever the director is targeting at that clock.
    // Jumping to 15:00 and watching an empty graveyard trickle back up to 200
    // enemies is useless for tuning, which is the only reason the flag exists.
    //
    // The App builds the World before it has measured the surface, so if we
    // don't know the field size yet, wait for the first setViewport rather than
    // scattering the whole horde across a guessed 100x32 default.
    if (this.viewportKnown) this.populateToTarget();
    else this.pendingPrewarm = true;
  }

  /** Scatter the director's head-count target across the visible field. */
  private populateToTarget(): void {
    const target = Math.min(400, Math.round(targetPopulation(this.data.director, this.time)));
    const half = this.viewHalf();

    for (let i = 0; i < target; i++) {
      const def = this.rollMix();
      if (def === null) break;
      // Uniform over the rectangle of the field, not a disc around the player:
      // a disc leaves the corners empty and packs everything onto your face.
      this.spawnEnemy(def, this.x + this.rng.range(-half.x, half.x), this.y + this.rng.range(-half.y, half.y));
    }
    // They arrived off-camera, conceptually; don't flash every portrait at once.
    this.justSeen = null;
  }

  /** `--god` / `?god`: Jane needs to watch minute 18 without dying to it. */
  godMode = false;

  // ---------------------------------------------------------------- stats

  /**
   * Total bonus from purchased Crossroads upgrades for one stat.
   * `add` rows sum; `mult` rows contribute `per_level * levels` as a fraction,
   * so +5%/level bought three times is +0.15 — a bonus, not a multiplier yet.
   */
  meta(stat: string): number {
    let total = 0;
    for (const u of this.data.crossroads.upgrades) {
      if (u.stat !== stat || u.kind === 'unlock') continue;
      const levels = this.profile.upgrades[u.id] ?? 0;
      total += u.perLevel * levels;
    }
    return total;
  }

  stats(): Record<StatName, number> {
    const s = computeStats(this.data.passives, this.passives);

    // Character bonuses are multipliers on the base (characters.tsv).
    const c = this.character;
    if (c !== null) {
      s.move_speed *= c.move;
      s.area *= c.area;
      s.luck *= c.luck;
    }

    // Crossroads: "it only moves the floor, never the ceiling." Note damage is a
    // flat bonus on top, not a multiplier on the weapon curve — that's the rule.
    s.damage *= 1 + this.meta('damage');
    s.luck *= 1 + this.meta('luck');
    s.flat_reduce += this.meta('flat_reduce');
    s.revives += this.meta('revives');
    return s;
  }

  /** Gold multiplier: character identity times Greed. Gold isn't a passive stat. */
  get goldMultiplier(): number {
    return (this.character?.gold ?? 1) * (1 + this.meta('gold_gain'));
  }

  get rerolls(): number {
    return this.meta('rerolls');
  }

  get banishes(): number {
    return this.meta('banishes');
  }

  get lightRadius(): number {
    return 14 + this.stats().light_radius;
  }

  /**
   * How far a mote will fly to you, in wu. `pickup_radius_base` is Jane's, in
   * `director.tsv`: she measured time-to-first-card at 6 wu and 12 wu across six
   * seeds, and at 6 a player who walks in a straight line waits six and a half
   * minutes for a level-up while a player who stands still gets one in eighteen
   * seconds. The dial doesn't touch combat; it decides whether earned XP is ever
   * received. design.md §6.
   *
   * The only definition — `updatePickups` used to carry a second copy of the
   * literal, and a magnet that pulls from a circle it doesn't draw is a bug
   * waiting to happen.
   */
  get pickupRadius(): number {
    return param(this.data.director, 'pickup_radius_base') * this.stats().pickup_radius;
  }

  get bossActive(): boolean {
    return this.boss !== null;
  }

  get bossHpFraction(): number {
    return this.boss === null ? 0 : Math.max(0, this.boss.hp / this.boss.maxHp);
  }

  /**
   * 0..1, how "hot" the fight is right now — design.md §15.4: the ambient bed
   * should crossfade toward combat music on the *same curve the horde already
   * climbs*, not a second tuning surface. Reuses the spawn director's own
   * `targetPopulation`, normalized against its own late-game ceiling
   * (`target_end`), so retuning the difficulty curve retunes the music for
   * free. `App` is the one that turns this into actual track ids/gains —
   * World only ever exposes the number, never an audio id.
   */
  get musicIntensity(): number {
    const ceiling = Math.max(1, param(this.data.director, 'target_end'));
    return Math.max(0, Math.min(1, targetPopulation(this.data.director, this.time) / ceiling));
  }

  // ---------------------------------------------------------------- tick

  update(dt: number, input: Vec): void {
    if (this.dead || this.won) return;

    this.hitstopCd = Math.max(0, this.hitstopCd - dt);

    // Hit stop. The simulation freezes; rendering does not, so the frame you are
    // staring at is the frame where you got hit. `tickShake` runs outside this,
    // in the app loop, so the screen keeps moving while the world holds still.
    //
    // `reap()` still runs while frozen: a dead thing is dead, and the win the
    // Countess just handed you must register even if she touched you on the same
    // frame. Nothing new *dies* during a freeze — weapons don't fire — so in
    // ordinary play this is a no-op; it only resolves a kill dealt from outside.
    if (this.hitstopT > 0) {
      this.hitstopT = Math.max(0, this.hitstopT - dt);
      this.reap();
      return;
    }

    this.playerFlash = Math.max(0, this.playerFlash - dt);
    this.timeAlive += dt;
    if (this.clockRunning) this.time += dt;

    if (this.time - this.minuteMark >= 60) {
      this.bestMinute = Math.max(this.bestMinute, this.killsThisMinute);
      this.killsThisMinute = 0;
      this.minuteMark = this.time;
    }

    const stats = this.stats();

    this.movePlayer(dt, input, stats);
    this.regen(dt, stats);
    this.runBeats();
    this.runDirector(dt);
    this.buildGrid();
    this.moveEnemies(dt);
    this.updateBoss(dt);
    this.fireWeapons(dt, stats);
    this.updateBolts(dt);
    this.updateSalts(dt);
    this.updateEmbers(dt);
    this.updateColumns(dt);
    this.updateHazards(dt);
    this.reap();
    this.updatePickups(dt);
    this.updateEffects(dt);

    // Juice (design.md §14). Advances with the sim, so a hitstop freezes it too.
    this.updateNumbers(dt);
    this.updatePops(dt);
    this.updateSparks(dt);

    this.pruneDecals();
    this.despawnDistant();
  }

  /** Grace period before the whip starts aiming itself. */
  private static readonly AUTOFACE_DELAY = 0.25;

  private movePlayer(dt: number, input: Vec, stats: Record<StatName, number>): void {
    const len = Math.hypot(input.x, input.y);

    // Normalize so diagonals aren't 1.41x faster (design.md §5).
    const nx = len === 0 ? 0 : input.x / len;
    const ny = len === 0 ? 0 : input.y / len;

    // Explicit horizontal input always wins, immediately. Turning by walking is
    // the skill the Chain teaches, and auto-aim must never fight the player.
    if (nx > 0.2) {
      this.facing = 1;
      this.horizontalIdle = 0;
    } else if (nx < -0.2) {
      this.facing = -1;
      this.horizontalIdle = 0;
    } else {
      this.horizontalIdle += dt;
      if (this.autoFace && this.horizontalIdle >= World.AUTOFACE_DELAY) this.faceNearestEnemy();
    }

    if (len === 0) return;
    const speed = this.playerDef.speed * stats.move_speed;
    this.x += nx * speed * dt;
    this.y += ny * speed * dt;
  }

  /**
   * Turn toward the closest enemy that isn't already level with us. Enemies in
   * a narrow vertical band dead ahead are ignored for the purpose of choosing a
   * side, because when something is directly above you neither side is wrong and
   * flipping back and forth every frame looks broken.
   */
  private faceNearestEnemy(): void {
    let best: number = Infinity;
    let side: 1 | -1 | 0 = 0;

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - this.x;
      if (Math.abs(dx) < 1.5) continue; // effectively on top of us

      const d = dx * dx + (e.y - this.y) * (e.y - this.y);
      if (d < best) {
        best = d;
        side = dx > 0 ? 1 : -1;
      }
    }

    if (side !== 0) this.facing = side;
  }

  private regen(dt: number, stats: Record<StatName, number>): void {
    if (stats.hp_per_sec <= 0 || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + stats.hp_per_sec * dt);
  }

  // ---------------------------------------------------------------- spawning

  /** Half-extents of the viewport, in wu. */
  private viewHalf(): Vec {
    return { x: this.viewCols / 2, y: (this.viewRows / 2) * WU_PER_ROW };
  }

  /** A point `marginCells` outside the viewport rectangle, at a random angle. */
  private spawnPoint(marginCells = param(this.data.director, 'spawn_margin')): Vec {
    const half = this.viewHalf();
    const hx = half.x + marginCells;
    const hy = half.y + marginCells * WU_PER_ROW;

    const a = this.rng.next() * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Project the ray onto the rectangle boundary rather than a circle, so we
    // hug the screen edge instead of spawning far off the short axis.
    const t = Math.min(hx / Math.max(1e-6, Math.abs(cos)), hy / Math.max(1e-6, Math.abs(sin)));
    return { x: this.x + cos * t, y: this.y + sin * t };
  }

  /**
   * Closed-loop director (director.tsv). Target a head-count, spawn to fill the
   * deficit, rate-limited by cap(t). An open-loop budget makes the population
   * depend on the player's build; this makes density a designed quantity.
   */
  private runDirector(dt: number): void {
    const d = this.data.director;

    if (this.time > this.tideUntil) this.tideFactor = 1;

    // The boss owns the field: no ambient spawns during the fight (halt_director).
    if (this.boss !== null && countessParam(this.data.countess, 'halt_director') !== 0) return;

    const target = targetPopulation(d, this.time) * this.tideFactor;
    const ambient = this.enemies.filter((e) => !e.elite && !e.boss).length;
    const deficit = target - ambient;
    if (deficit <= 0) {
      this.spawnCredit = 0;
      return;
    }

    this.spawnCredit += Math.min(deficit, spawnCap(d, this.time) * dt);
    let n = Math.floor(this.spawnCredit);
    if (n <= 0) return;
    this.spawnCredit -= n;

    while (n-- > 0) {
      const def = this.rollMix();
      if (def === null) return;
      const p = this.spawnPoint();
      this.spawnEnemy(def, p.x, p.y);
    }
  }

  /** Weighted pick from the mix rows, lerping early->late weights on the clock. */
  private rollMix(): EntityDef | null {
    const d = this.data.director;
    let total = 0;
    const weights: number[] = [];

    for (const entry of d.mix) {
      const w = this.table.entities.has(entry.entity) ? mixWeight(d, entry, this.time) : 0;
      weights.push(w);
      total += w;
    }
    if (total <= 0) return null;

    let r = this.rng.next() * total;
    for (let i = 0; i < d.mix.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return this.table.entities.get(d.mix[i]!.entity) ?? null;
    }
    return this.table.entities.get(d.mix[d.mix.length - 1]!.entity) ?? null;
  }

  spawnEnemy(def: EntityDef, x: number, y: number, elite = false): Enemy {
    const boss = def.id === 'countess';
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
      flashMax: 0,
      num: null,
      elite,
      boss,
      phase: this.rng.next() * Math.PI * 2,
      knockX: 0,
      knockY: 0,
      orbCd: 0,
      emberCd: 0,
      driftX: 0,
      driftY: 0,
      drift: 0,
    };
    this.enemies.push(e);

    if (!this.seen.has(def.id)) {
      this.seen.add(def.id);
      this.justSeen = def.id;
    }
    return e;
  }

  /** Cull enemies that wandered far behind the camera. Never elites or the boss. */
  private despawnDistant(): void {
    const margin = param(this.data.director, 'despawn_margin');
    const half = this.viewHalf();
    const limX = half.x + margin;
    const limY = half.y + margin * WU_PER_ROW;

    this.enemies = this.enemies.filter(
      (e) => e.elite || e.boss || (Math.abs(e.x - this.x) <= limX && Math.abs(e.y - this.y) <= limY),
    );
  }

  // ---------------------------------------------------------------- beats

  private runBeats(): void {
    const beats = this.data.director.beats;
    while (this.beatCursor < beats.length && beats[this.beatCursor]!.time <= this.time) {
      this.fireBeat(beats[this.beatCursor]!);
      this.beatCursor++;
    }
  }

  private fireBeat(beat: Beat): void {
    const def = beat.entity !== null ? this.table.entities.get(beat.entity) : undefined;

    switch (beat.kind) {
      case 'swarm': {
        if (def === undefined) return;
        const p = this.spawnPoint();
        for (let i = 0; i < beat.count; i++) {
          this.spawnEnemy(def, p.x + this.rng.range(-6, 6), p.y + this.rng.range(-12, 12));
        }
        return;
      }

      case 'flock': {
        if (def === undefined) return;
        // Cross the whole viewport along one axis, on a fixed heading, so they
        // sweep past you instead of homing. Get out of the way.
        const half = this.viewHalf();
        const horizontal = this.rng.chance(0.5);
        const sign = this.rng.chance(0.5) ? 1 : -1;

        for (let i = 0; i < beat.count; i++) {
          const t = (i / Math.max(1, beat.count - 1) - 0.5) * 2;
          const e = horizontal
            ? this.spawnEnemy(def, this.x - sign * (half.x + 6), this.y + t * half.y)
            : this.spawnEnemy(def, this.x + t * half.x, this.y - sign * (half.y + 12));

          e.driftX = horizontal ? sign : 0;
          e.driftY = horizontal ? 0 : sign;
          e.drift = 4.5; // seconds of straight flight before they resume homing
        }
        return;
      }

      case 'wall': {
        if (def === undefined) return;
        const half = this.viewHalf();
        const side = this.rng.int(0, 3);
        for (let i = 0; i < beat.count; i++) {
          const t = (i / Math.max(1, beat.count - 1) - 0.5) * 2;
          const spread = 0.9;
          if (side === 0) this.spawnEnemy(def, this.x - half.x - 4, this.y + t * half.y * spread);
          else if (side === 1) this.spawnEnemy(def, this.x + half.x + 4, this.y + t * half.y * spread);
          else if (side === 2) this.spawnEnemy(def, this.x + t * half.x * spread, this.y - half.y - 8);
          else this.spawnEnemy(def, this.x + t * half.x * spread, this.y + half.y + 8);
        }
        return;
      }

      case 'ring': {
        if (def === undefined) return;
        // **Inscribed** in the viewport, not circumscribed around it. A cell is
        // one wu wide and two wu tall, so a wu is the same number of pixels in
        // both axes: a circle in world units draws as a circle. The old
        // `max(half.x, 40) * 0.95` sized it to the *wide* axis, and the top and
        // bottom of the ring spawned off-screen — the player saw a band closing
        // from the left and right instead of a ring closing around them.
        // Jane's formula, `director.tsv` and design.md §11.
        const half = this.viewHalf();
        const radius = Math.min(half.x, half.y) * param(this.data.director, 'ring_radius_frac');
        for (let i = 0; i < beat.count; i++) {
          const a = (i / beat.count) * Math.PI * 2;
          this.spawnEnemy(def, this.x + Math.cos(a) * radius, this.y + Math.sin(a) * radius);
        }
        return;
      }

      case 'elite': {
        if (def === undefined) return;
        for (let i = 0; i < beat.count; i++) {
          const p = this.spawnPoint();
          this.spawnEnemy(def, p.x, p.y, true);
        }
        return;
      }

      case 'tide': {
        this.tideFactor = Math.max(1, beat.count);
        this.tideUntil = this.time + TIDE_DURATION;
        return;
      }

      case 'boss': {
        if (def === undefined) return;
        // On screen, and above the player. Her Court phase is stationary, so
        // spawning her outside the viewport like an ordinary enemy would leave
        // her sitting in the dark summoning bats at a graveyard you can't see.
        const half = this.viewHalf();
        this.boss = this.spawnEnemy(def, this.x, this.y - half.y * 0.55);
        // The sun rises when she dies, not on a timer.
        if (countessParam(this.data.countess, 'freeze_clock') !== 0) this.clockRunning = false;
        this.bossPhase = this.data.countess.phases[0]?.id ?? 'court';
        this.bossState = 'idle';
        this.bossTimer = 0;
        this.bossArrived = 0;
        return;
      }
    }
  }

  // ---------------------------------------------------------------- enemies

  private cellKey(x: number, y: number): number {
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
      if (e.hp <= 0 || e.boss) continue; // the boss has its own brain

      e.age += dt;
      e.hitCd = Math.max(0, e.hitCd - dt);
      e.flash = Math.max(0, e.flash - dt);
      e.orbCd = Math.max(0, e.orbCd - dt);
      e.emberCd = Math.max(0, e.emberCd - dt);

      const dx = this.x - e.x;
      const dy = this.y - e.y;
      const dist = Math.hypot(dx, dy);
      // Guard only the division. Using the guarded value as the contact distance
      // would mean an enemy standing exactly on you could never hit you.
      const norm = dist === 0 ? 1 : dist;

      let vx: number;
      let vy: number;

      if (e.drift > 0) {
        // Flock members hold a heading until their drift expires.
        e.drift -= dt;
        vx = e.driftX * e.def.speed;
        vy = e.driftY * e.def.speed * WU_PER_ROW;
      } else {
        vx = (dx / norm) * e.def.speed;
        vy = (dy / norm) * e.def.speed;

        // Bats drift on a sine wave perpendicular to their approach, so they
        // overshoot you instead of homing perfectly. glyphs.tsv: amp 6wu, T 1.2s.
        if (e.def.id === 'bat') {
          const wobble = Math.sin(e.age * ((Math.PI * 2) / 1.2) + e.phase) * 6;
          vx += (-dy / norm) * wobble;
          vy += (dx / norm) * wobble;
        }
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

      if (dist < this.hitRadius(e.def.id) && e.hitCd === 0) {
        this.damagePlayer(e.def.power);
        e.hitCd = CONTACT_COOLDOWN;
      }
    }
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

  // ------------------------------------------------------------------ juice
  // design.md §14. Every constant is read from `assets/juice.tsv`, in seconds.
  // If anything in here ever counts frames, the feel becomes a function of the
  // frame rate and Jane's table becomes a decoration.

  /** A juice constant, by name. */
  private j(name: string): number {
    return juice(this.data.juice, name);
  }

  /**
   * Start a screen shake. An event Jane hasn't listed does **not** shake: her
   * table names exactly four for a whole run, and an unlisted event is her
   * saying the screen should hold still, not an oversight to default around.
   */
  private shake(event: string): void {
    const def = shakeDef(this.data.juice, event);
    if (def === null) return;

    // Take the stronger of the two rather than summing: her landing during her
    // charge's shake must not add up to a whole cell.
    this.shakeAmp = Math.max(this.shakeAmp, def.amp);
    this.shakeLeft = Math.max(this.shakeLeft, def.seconds);
    this.shakeDur = Math.max(this.shakeDur, this.shakeLeft);
  }

  /**
   * Decay the shake. Called every frame by the app, *outside* `update`, because
   * a death shake happens on the frame the simulation stops and the screen still
   * has to settle.
   */
  tickShake(dt: number): void {
    this.shakeClock += dt;
    if (this.shakeLeft <= 0) return;
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (this.shakeLeft === 0) {
      this.shakeAmp = 0;
      this.shakeDur = 0;
    }
  }

  /**
   * The field's offset this frame, in cells. Fractional: the canvas draws it as
   * pixels, and the terminal — which can only move by a whole cell — rounds it
   * to zero, which is the correct thing for a terminal to do.
   *
   * Two incommensurable frequencies, so it never settles into a visible wobble.
   * Driven by a clock rather than the rng, so asking twice in one frame gives
   * the same answer.
   */
  shakeOffset(): Vec {
    if (this.shakeLeft <= 0 || this.shakeDur <= 0) return { x: 0, y: 0 };
    const k = this.shakeAmp * (this.shakeLeft / this.shakeDur); // linear decay
    const t = this.shakeClock;
    return { x: Math.sin(t * 86.3) * k, y: Math.cos(t * 71.7) * k * 0.5 };
  }

  /**
   * Add `amount` to this enemy's damage number, or start one.
   *
   * Never called on a killing blow: *the corpse is the number*, and that halves
   * the count on screen at exactly the moment the field is most crowded.
   */
  private addDamageNumber(e: Enemy, amount: number): void {
    if (amount < this.j('num_min')) return; // a floating `0` is a bug report

    const live = e.num !== null && !e.num.dead;
    if (live) {
      const n = e.num!;
      n.amount += amount;
      n.age = 0;
      n.x = e.x;
      n.y = e.y;
      n.lift = Math.min(this.j('num_lift_max'), n.lift + this.j('num_lift_per_hit'));
      return;
    }

    const n: DamageNumber = { x: e.x, y: e.y, amount, age: 0, life: this.j('num_life'), lift: 0, dead: false };
    e.num = n;
    this.numbers.push(n);

    // Over budget, drop the DIMMEST rather than the oldest: the number you have
    // been feeding for half a second is the one you are actually reading.
    const max = this.j('num_max');
    if (this.numbers.length > max) {
      let dimmest = 0;
      for (let i = 1; i < this.numbers.length; i++) {
        if (this.numbers[i]!.lift < this.numbers[dimmest]!.lift) dimmest = i;
      }
      this.numbers[dimmest]!.dead = true;
      this.numbers.splice(dimmest, 1);
    }
  }

  private updateNumbers(dt: number): void {
    const rise = this.j('num_rise');
    for (const n of this.numbers) {
      n.age += dt;
      n.y -= (rise / Math.max(0.0001, n.life)) * dt; // up is -y
      if (n.age >= n.life) n.dead = true;
    }
    if (this.numbers.some((n) => n.dead)) this.numbers = this.numbers.filter((n) => !n.dead);
  }

  private updatePops(dt: number): void {
    if (this.pops.length === 0) return;
    const life = this.j('death_flash');
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < life);
  }

  /**
   * Sparks rise off the lantern, cool, and die. Spawned in the annulus between
   * `ember_r_in` and the **current** light radius, so Lantern Oil visibly widens
   * the shower: a passive you can see is worth more than a passive you can read.
   */
  private updateSparks(dt: number): void {
    const life = this.j('ember_life');
    const drift = this.j('ember_drift');

    for (const s of this.sparks) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy -= drift * 0.4 * dt; // they keep accelerating upward as they cool
    }
    if (this.sparks.some((s) => s.age >= s.life)) this.sparks = this.sparks.filter((s) => s.age < s.life);

    const cap = this.j('ember_max');
    this.sparkDebt += this.j('ember_rate') * dt;
    while (this.sparkDebt >= 1) {
      this.sparkDebt -= 1;
      if (this.sparks.length >= cap) continue;

      // Uniform over the annulus, not over the radius, or every spark clusters
      // at the inner edge where the player already is.
      const rIn = this.j('ember_r_in');
      const rOut = Math.max(rIn + 1, this.lightRadius);
      const r = Math.sqrt(this.rng.range(rIn * rIn, rOut * rOut));
      const a = this.rng.next() * Math.PI * 2;

      this.sparks.push({
        x: this.x + Math.cos(a) * r,
        y: this.y + Math.sin(a) * r,
        vx: this.rng.range(-drift * 0.25, drift * 0.25),
        vy: -drift,
        age: 0,
        life: life * this.rng.range(0.7, 1.15),
      });
    }
  }

  damageEnemy(e: Enemy, amount: number, knockback = 0): void {
    e.hp -= amount;
    e.flash = this.j('hit_flash');
    e.flashMax = e.flash;
    this.playSfx('hit', 0.03);

    // The corpse is the number. Skip the digits on a killing blow.
    if (e.hp > 0) this.addDamageNumber(e, amount);

    if (knockback > 0 && !e.boss) {
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      e.knockX += (dx / d) * knockback * 10;
      e.knockY += (dy / d) * knockback * 10;
    }
  }

  /** Clear out everything killed this tick, awarding drops exactly once. */
  private reap(): void {
    if (!this.enemies.some((e) => e.hp <= 0)) return;

    const alive: Enemy[] = [];
    const dead: Enemy[] = [];
    for (const e of this.enemies) (e.hp > 0 ? alive : dead).push(e);

    // Swap the survivors in *before* running death effects: a Rattlejack's
    // death spawns two rats, and spawnEnemy appends to `this.enemies`.
    this.enemies = alive;
    for (const e of dead) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    this.kills++;
    this.killsThisMinute++;
    this.addDecal(e.x, e.y);
    this.playSfx('kill', 0.02);

    // The corpse is the number: retire any number this enemy was still carrying.
    if (e.num !== null) e.num.dead = true;

    // One frame of its own glyphs in white, over the fresh decal. The boss gets
    // no pop — a 28x11 sprite flashing white is a lightning strike, not a kill.
    if (!e.boss && this.j('death_flash') > 0) {
      this.pops.push({ def: e.def, x: e.x, y: e.y, age: 0, phase: e.phase, elite: e.elite });
    }

    if (e.boss) {
      this.boss = null;
      this.won = true; // kill her and the sun comes up
      this.playSfx('win');
      this.gold += Math.round(crossroadsParam(this.data.crossroads, 'gold_countess') * this.goldMultiplier);
      return;
    }

    // Rattlejacks split. The table says so; the code just reads it.
    if (e.def.id === 'rattlejack') {
      const rat = this.table.entities.get('rat');
      if (rat !== undefined) {
        for (let i = 0; i < 2; i++) {
          this.spawnEnemy(rat, e.x + this.rng.range(-2, 2), e.y + this.rng.range(-2, 2));
        }
      }
    }

    if (e.def.xp > 0) this.dropPickup('mote', e.x, e.y, e.def.xp);

    // Gold rates come from crossroads.tsv, because Jane costed the whole meta
    // economy against them (a winning run pays ~1,365g). A `1/40` in here would
    // silently invalidate her 11-runs-to-unlock-everything maths.
    const cr = this.data.crossroads;
    const luck = this.stats().luck;
    const gold = (n: number): number => Math.max(1, Math.round(n * this.goldMultiplier));

    if (e.elite) {
      this.dropPickup('chest', e.x, e.y, 1);
      this.dropPickup('gold', e.x + 2, e.y, gold(crossroadsParam(cr, 'gold_per_elite')));
    } else {
      if (this.rng.chance(crossroadsParam(cr, 'gold_kill_chance') * luck)) {
        this.dropPickup('gold', e.x, e.y, gold(crossroadsParam(cr, 'gold_per_kill')));
      }
      if (this.rng.chance(0.004 * luck)) this.dropPickup('heal', e.x, e.y, 30);
    }
  }

  /**
   * `hitstop` is the punch of a discrete hit landing. Continuous sources — a
   * burning trail you're standing in — pass `false`: standing in fire is a
   * *state*, not an event, and freezing 20×/second while you stand there is the
   * judder, not the juice. The refractory keeps even discrete hits from a swarm
   * from stacking into the same permanent freeze.
   */
  damagePlayer(amount: number, hitstop = true): void {
    if (this.godMode) return;
    const reduced = Math.max(1, amount - this.stats().flat_reduce);
    this.hp -= reduced;
    this.playSfx('hurt', 0.15);

    if (hitstop && this.hitstopCd <= 0) {
      this.hitstopT = Math.max(this.hitstopT, this.j('hitstop'));
      this.hitstopCd = this.j('hitstop') + this.j('hitstop_gap');
    }

    if (this.hp > 0) return;

    // Revival: spend a charge rather than ending the run.
    const revives = this.stats().revives;
    if (this.revivesUsed < revives) {
      this.revivesUsed++;
      this.hp = this.maxHp * 0.5;
      this.effects.push({ kind: 'flash', age: 0 });
      this.shake('player_revive');
      this.playSfx('revive');
      return;
    }

    this.hp = 0;
    this.dead = true;
    this.shake('player_death');
    this.playSfx('death');
    this.bestMinute = Math.max(this.bestMinute, this.killsThisMinute);
  }

  // ---------------------------------------------------------------- the boss

  /**
   * The Countess (design.md §10, `countess.tsv`).
   *
   * Court: stationary, summons bats in a ring around herself. She isn't what's
   * hurting you. Hunt: an 0.8s telegraph, then a 52 wu/s charge — you cannot
   * outrun it, but she turns at only 90 deg/s, so you sidestep late. Her trail
   * burns for 4s, and the arena slowly fills with her own exhaust. Dusk: the
   * field goes black beyond your lantern, even with --no-dark. Your gore-carpet
   * is the only map you have.
   *
   * Every number in here is read from her table. The only judgement call left in
   * code is what "charge" means geometrically.
   */
  private updateBoss(dt: number): void {
    const b = this.boss;
    if (b === null) return;

    const t = this.data.countess;
    b.age += dt;
    b.hitCd = Math.max(0, b.hitCd - dt);
    b.flash = Math.max(0, b.flash - dt);
    this.bossArrived += dt;

    const phase = phaseFor(t, b.hp / b.maxHp);
    if (phase === null) return;

    if (phase.id !== this.bossPhase) {
      this.bossPhase = phase.id;
      this.bossState = 'idle';
      this.bossTimer = 0;
      this.effects.push({ kind: 'flash', age: 0 });
      this.playSfx('boss_phase');
    }
    // Dusk collapses the world to the lantern, whatever --no-dark says: the one
    // moment the darkness is the mechanic rather than the mood.
    this.dusk = phase.id === 'dusk';

    // No stalling her out: past `enrage_after` her cadence tightens.
    const enrageAt = countessParam(t, 'enrage_after');
    const enraged = enrageAt > 0 && this.bossArrived > enrageAt;
    const cadence = phase.cadence / (enraged ? 1.5 : 1);

    if (phase.action === 'summon_ring') this.bossCourt(b, phase, cadence, dt);
    else this.bossHunt(b, phase, cadence, dt, t);

    const reach = this.hitRadius(b.def.id);
    if (Math.hypot(this.x - b.x, this.y - b.y) < reach && b.hitCd === 0) {
      this.damagePlayer(b.def.power);
      b.hitCd = CONTACT_COOLDOWN;
    }
  }

  /** Stationary. Summons bats in a closing ring around herself. Kill them or drown. */
  private bossCourt(b: Enemy, phase: Phase, cadence: number, dt: number): void {
    this.bossTelegraph = 0;
    this.bossTimer -= dt;
    if (this.bossTimer > 0) return;

    this.bossTimer = cadence;

    const bat = this.table.entities.get('bat');
    if (bat === undefined) {
      // Her whole first phase is "summon bats". Silently standing there would
      // look like a hang, so say so once and let the fight continue.
      if (!this.warnedNoBat) {
        this.warnedNoBat = true;
        this.runtimeWarnings.push("countess: glyphs.tsv has no 'bat' — Court phase cannot summon");
      }
      return;
    }

    for (let i = 0; i < phase.count; i++) {
      const a = (i / phase.count) * Math.PI * 2 + b.age;
      this.spawnEnemy(bat, b.x + Math.cos(a) * 14, b.y + Math.sin(a) * 14);
    }
  }

  /**
   * Telegraph, then charge. The telegraph is the player's whole tell, and the
   * turn rate is what makes her baitable: she commits to a heading and can only
   * bend it so fast, so you sidestep *late* rather than early.
   */
  private bossHunt(b: Enemy, phase: Phase, cadence: number, dt: number, t: typeof this.data.countess): void {
    const telegraph = countessParam(t, 'telegraph');
    const chargeSpeed = countessParam(t, 'charge_speed');
    const turnRate = (countessParam(t, 'turn_rate') * Math.PI) / 180;

    switch (this.bossState) {
      case 'idle': {
        this.bossTelegraph = 0;
        // Cruise toward the player at the phase's (slow) speed while she winds up.
        this.moveToward(b, this.x, this.y, phase.speed * dt);

        this.bossTimer -= dt;
        if (this.bossTimer <= 0) {
          this.bossState = 'telegraph';
          this.bossTimer = telegraph;
          this.bossTarget = { x: this.x, y: this.y };
          this.bossHeading = Math.atan2(this.y - b.y, this.x - b.x);
        }
        return;
      }

      case 'telegraph': {
        this.bossTimer -= dt;
        this.bossTelegraph = Math.max(0, this.bossTimer / Math.max(0.001, telegraph));
        // She locks on during the wind-up, so you can't just stand still.
        this.bossHeading = this.turnToward(this.bossHeading, Math.atan2(this.y - b.y, this.x - b.x), turnRate * dt);

        if (this.bossTimer <= 0) {
          this.bossState = 'charging';
          this.bossTimer = 1.6; // seconds of committed charge
          this.bossTrailAcc = 0;
        }
        return;
      }

      case 'charging': {
        this.bossTelegraph = 0;
        this.bossTimer -= dt;

        // Slow turns. Bait her.
        this.bossHeading = this.turnToward(this.bossHeading, Math.atan2(this.y - b.y, this.x - b.x), turnRate * dt);
        b.x += Math.cos(this.bossHeading) * chargeSpeed * dt;
        b.y += Math.sin(this.bossHeading) * chargeSpeed * dt;

        // A burning trail, laid at a fixed spatial rate rather than per frame,
        // so it doesn't thin out when the framerate does.
        this.bossTrailAcc += chargeSpeed * dt;
        while (this.bossTrailAcc >= 1.5) {
          this.bossTrailAcc -= 1.5;
          this.hazards.push({
            x: b.x,
            y: b.y,
            life: countessParam(t, 'trail_life'),
            dmg: countessParam(t, 'trail_damage'),
            color: 0xff3b3b,
          });
        }

        if (this.bossTimer <= 0) {
          this.bossState = 'idle';
          this.bossTimer = cadence;
        }
        return;
      }
    }
  }

  private moveToward(e: Enemy, tx: number, ty: number, step: number): void {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001 || step <= 0) return;
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
  }

  /** Rotate `from` toward `to` by at most `maxStep` radians, the short way round. */
  private turnToward(from: number, to: number, maxStep: number): number {
    let delta = to - from;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return from + Math.max(-maxStep, Math.min(maxStep, delta));
  }

  // ---------------------------------------------------------------- weapons

  /** Resolve a weapon's numbers at its current level, scaled by passives. */
  private resolve(w: Weapon, stats: Record<StatName, number>): WeaponLevel | null {
    const base = weaponAt(this.data.weapons, w.id, w.level);
    if (base === null) return null;
    return {
      ...base,
      cd: base.cd * stats.cooldown,
      dmg: base.dmg * stats.damage,
      ax: base.ax * stats.area,
      ay: base.ay * stats.area,
      dur: base.dur * stats.duration,
    };
  }

  private fireWeapons(dt: number, stats: Record<StatName, number>): void {
    this.orbs.length = 0;

    for (const w of this.weapons) {
      const def = this.resolve(w, stats);
      if (def === null) continue;

      // cd = 0 means "always on" — the orbiting Wisp Lantern.
      if (def.shape === 'orbit') {
        this.updateOrbit(w, def, dt);
        continue;
      }

      w.timer -= dt;
      if (w.timer > 0) continue;
      w.timer += Math.max(0.05, def.cd);
      this.fire(w, def);
    }
  }

  private fire(w: Weapon, def: WeaponLevel): void {
    switch (def.shape) {
      case 'band':
        return this.fireBand(w, def);
      case 'bolt':
        return this.fireBolt(w, def);
      case 'ring':
        return this.fireRing(w, def);
      case 'arc':
        return this.fireArc(w, def);
      case 'column':
        return this.fireColumn(w, def);
      case 'trail':
        return this.fireTrail(w, def);
      case 'orbit':
        return;
    }
  }

  /**
   * A horizontal band in the facing direction. Horizontal-only is the point —
   * you turn by walking, and good players flick left-right to keep the band on
   * the swarm. `count >= 2` (level 4+) strikes behind you as well.
   */
  private fireBand(w: Weapon, def: WeaponLevel): void {
    // ay is the band height in wu; a row is WU_PER_ROW wu tall. Round to an odd
    // row count so the band is centred on the player's own row.
    const rows = Math.max(1, Math.round(def.ay / WU_PER_ROW));
    const halfRows = Math.max(0, Math.floor(rows / 2));
    const halfHeightWu = halfRows * WU_PER_ROW + 1;

    const bothSides = def.count >= 2 || w.evolved?.intoId === 'ouroboros';
    const dirs: (1 | -1)[] = bothSides ? [1, -1] : [this.facing];

    for (const dir of dirs) {
      const xLeft = dir === 1 ? this.x + 1 : this.x - 1 - def.ax;
      const xRight = xLeft + def.ax;

      this.effects.push({ kind: 'band', xLeft, xRight, yCenter: this.y, halfRows, age: 0, color: def.color });

      let pierced = 0;
      for (const e of this.enemies) {
        if (pierced >= def.pierce) break;
        if (e.x >= xLeft && e.x < xRight && Math.abs(e.y - this.y) <= halfHeightWu) {
          this.damageEnemy(e, def.dmg, def.knock);
          pierced++;
        }
      }
    }
  }

  /** Homing bolts at the nearest enemies. The reliable weapon. */
  private fireBolt(w: Weapon, def: WeaponLevel): void {
    const targets = this.nearestEnemies(def.count);
    const chains = w.evolved?.intoId === 'hemorrhage' ? 4 : 0;

    for (let i = 0; i < def.count; i++) {
      const t = targets[i] ?? targets[0];
      const a = t !== undefined ? Math.atan2(t.y - this.y, t.x - this.x) : this.rng.next() * Math.PI * 2;
      this.bolts.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(a) * def.pspeed,
        vy: Math.sin(a) * def.pspeed,
        dmg: def.dmg,
        radius: def.ax,
        pierce: def.pierce,
        knock: def.knock,
        life: def.dur,
        color: def.color,
        glyph: def.glyph,
        chains,
        hits: new Set(),
      });
    }
  }

  /** A persistent damaging ring around you. Ticks on its cooldown, never stops. */
  private fireRing(w: Weapon, def: WeaponLevel): void {
    this.effects.push({ kind: 'ring', x: this.x, y: this.y, radius: def.ax, age: 0, color: def.color });

    let pierced = 0;
    for (const e of this.enemies) {
      if (pierced >= def.pierce) break;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= def.ax) {
        this.damageEnemy(e, def.dmg, def.knock);
        pierced++;
      }
    }

    // Pyre: the ring ignites the floor it passes over.
    if (w.evolved?.intoId === 'pyre') {
      for (let i = 0; i < 6; i++) {
        const a = this.rng.next() * Math.PI * 2;
        this.embers.push({
          x: this.x + Math.cos(a) * def.ax,
          y: this.y + Math.sin(a) * def.ax,
          radius: 2.2,
          dmg: def.dmg * 0.5,
          life: 2.5,
          color: 0xff8700,
          spreads: 0,
        });
      }
    }
  }

  /** Lobbed upward, falls, shatters. Hits things *behind* the swarm. */
  private fireArc(w: Weapon, def: WeaponLevel): void {
    const targets = this.nearestEnemies(def.count + 2);
    const raises = w.evolved?.intoId === 'bonemeal';

    for (let i = 0; i < def.count; i++) {
      // Deliberately aim past the front rank: pick a farther target when we can.
      const t = targets[Math.min(targets.length - 1, i + 1)] ?? targets[0];
      const tx = t !== undefined ? t.x : this.x + this.facing * 20;
      const ty = t !== undefined ? t.y : this.y;

      this.salts.push({
        x: this.x,
        y: this.y,
        sx: this.x,
        sy: this.y,
        tx,
        ty,
        t: 0,
        flight: Math.max(0.3, Math.hypot(tx - this.x, ty - this.y) / Math.max(1, def.pspeed)),
        dmg: def.dmg,
        radius: def.ax,
        knock: def.knock,
        color: def.color,
        raisesMotes: raises,
      });
    }
  }

  /** Columns of falling silver in random zones near you. Big damage, no control. */
  private fireColumn(w: Weapon, def: WeaponLevel): void {
    const moonfall = w.evolved?.intoId === 'moonfall';
    const n = moonfall ? 1 : def.count;
    const half = this.viewHalf();

    for (let i = 0; i < n; i++) {
      const x = moonfall ? this.x : this.x + this.rng.range(-half.x * 0.7, half.x * 0.7);
      const y = moonfall ? this.y : this.y + this.rng.range(-half.y * 0.7, half.y * 0.7);
      this.columns.push({
        x,
        y,
        w: moonfall ? def.ax * 3 : def.ax,
        h: moonfall ? half.y * 2 : def.ay,
        life: def.dur,
        dmg: moonfall ? def.dmg * 2 : def.dmg,
        color: def.color,
        struck: false,
      });
    }
  }

  /** Burning embers behind you as you walk. Rewards kiting in circles. */
  private fireTrail(w: Weapon, def: WeaponLevel): void {
    this.embers.push({
      x: this.x,
      y: this.y,
      radius: def.ax,
      dmg: def.dmg,
      life: def.dur,
      color: def.color,
      spreads: w.evolved?.intoId === 'wildfire' ? 1 : 0,
    });
  }

  private updateOrbit(w: Weapon, def: WeaponLevel, dt: number): void {
    w.angle += (def.pspeed * Math.PI) / 180 * dt;

    const corona = w.evolved?.intoId === 'corona';
    const count = corona ? 8 : def.count;
    // Corona: the motes breathe outward and come back.
    const radius = corona ? def.ax * (1 + 0.45 * Math.sin(w.angle * 0.7)) : def.ax;

    for (let i = 0; i < count; i++) {
      const a = w.angle + (i / count) * Math.PI * 2;
      const ox = this.x + Math.cos(a) * radius;
      const oy = this.y + Math.sin(a) * radius;
      this.orbs.push({ x: ox, y: oy, radius: def.ay, dmg: def.dmg, knock: def.knock, color: def.color });

      for (const e of this.enemies) {
        if (e.orbCd > 0 || e.hp <= 0) continue;
        if (Math.hypot(e.x - ox, e.y - oy) <= def.ay) {
          this.damageEnemy(e, def.dmg, def.knock);
          e.orbCd = AURA_COOLDOWN;
        }
      }
    }
  }

  /** Nearest `n` enemies, cheapest correct way at our population sizes. */
  private nearestEnemies(n: number): Enemy[] {
    if (this.enemies.length === 0) return [];
    return [...this.enemies]
      .filter((e) => e.hp > 0)
      .sort(
        (a, b) =>
          (a.x - this.x) ** 2 + (a.y - this.y) ** 2 - ((b.x - this.x) ** 2 + (b.y - this.y) ** 2),
      )
      .slice(0, Math.max(1, n));
  }

  // ---------------------------------------------------------------- projectiles

  private updateBolts(dt: number): void {
    for (const b of this.bolts) {
      b.life -= dt;
      if (b.life <= 0) continue;

      // Re-home toward the nearest enemy it hasn't hit yet.
      const target = this.nearestEnemies(1)[0];
      if (target !== undefined && !b.hits.has(target)) {
        const a = Math.atan2(target.y - b.y, target.x - b.x);
        const speed = Math.hypot(b.vx, b.vy);
        b.vx += (Math.cos(a) * speed - b.vx) * Math.min(1, 6 * dt);
        b.vy += (Math.sin(a) * speed - b.vy) * Math.min(1, 6 * dt);
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      for (const e of this.enemies) {
        if (e.hp <= 0 || b.hits.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) > b.radius) continue;

        this.damageEnemy(e, b.dmg, b.knock);
        b.hits.add(e);
        b.pierce--;

        // Hemorrhage: leap to another target rather than dying on impact.
        if (b.pierce <= 0 && b.chains > 0) {
          b.chains--;
          b.pierce = 1;
          b.life = Math.max(b.life, 0.5);
        } else if (b.pierce <= 0) {
          b.life = 0;
        }
        break;
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  private updateSalts(dt: number): void {
    for (const s of this.salts) {
      s.t += dt / s.flight;
      if (s.t < 1) {
        s.x = s.sx + (s.tx - s.sx) * s.t;
        s.y = s.sy + (s.ty - s.sy) * s.t;
        continue;
      }
      // Landed: shatter into a burst.
      for (const e of this.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - s.tx, e.y - s.ty) <= s.radius) {
          this.damageEnemy(e, s.dmg, s.knock);
        }
      }
      if (s.raisesMotes) this.dropPickup('mote', s.tx, s.ty, 1);
      this.addDecal(s.tx, s.ty);
    }
    this.salts = this.salts.filter((s) => s.t < 1);
  }

  private updateEmbers(dt: number): void {
    const spawned: Ember[] = [];

    for (const em of this.embers) {
      em.life -= dt;
      if (em.life <= 0) continue;

      for (const e of this.enemies) {
        if (e.hp <= 0 || e.emberCd > 0) continue;
        if (Math.hypot(e.x - em.x, e.y - em.y) <= em.radius) {
          this.damageEnemy(e, em.dmg, 0);
          e.emberCd = EMBER_TICK;

          // Wildfire: embers spread to adjacent embers.
          if (em.spreads > 0 && spawned.length < 24 && this.rng.chance(0.06)) {
            const a = this.rng.next() * Math.PI * 2;
            spawned.push({
              x: em.x + Math.cos(a) * em.radius * 1.6,
              y: em.y + Math.sin(a) * em.radius * 1.6,
              radius: em.radius,
              dmg: em.dmg,
              life: em.life * 0.7,
              color: em.color,
              spreads: em.spreads - 1,
            });
          }
        }
      }
    }

    this.embers = this.embers.filter((e) => e.life > 0);
    // Cap so a long Wildfire chain can't grow without bound.
    for (const e of spawned) if (this.embers.length < 400) this.embers.push(e);
  }

  private updateColumns(dt: number): void {
    for (const c of this.columns) {
      c.life -= dt;
      if (c.struck) continue;
      c.struck = true;

      const halfW = c.w / 2;
      const halfH = c.h / 2;
      for (const e of this.enemies) {
        if (e.hp > 0 && Math.abs(e.x - c.x) <= halfW && Math.abs(e.y - c.y) <= halfH) {
          this.damageEnemy(e, c.dmg, 0);
        }
      }
    }
    this.columns = this.columns.filter((c) => c.life > 0);
  }

  /**
   * Her burning trail. `trail_damage` is *per second standing in it*, so we
   * accumulate fractional damage rather than rolling a die each frame — a coin
   * flip per tick would make an 8 dmg/s trail feel like a random 8-damage spike.
   */
  private trailDebt = 0;

  private updateHazards(dt: number): void {
    let standingIn = 0;
    for (const h of this.hazards) {
      h.life -= dt;
      if (h.life > 0 && Math.hypot(this.x - h.x, this.y - h.y) < 1.5) {
        standingIn = Math.max(standingIn, h.dmg);
      }
    }

    if (standingIn > 0) {
      this.trailDebt += standingIn * dt;
      if (this.trailDebt >= 1) {
        const whole = Math.floor(this.trailDebt);
        this.trailDebt -= whole;
        this.damagePlayer(whole, false); // DoT is a state, not a hit — no hitstop
      }
    } else {
      this.trailDebt = 0;
    }

    this.hazards = this.hazards.filter((h) => h.life > 0);
  }

  // ---------------------------------------------------------------- pickups

  private dropPickup(kind: PickupKind, x: number, y: number, value: number): void {
    this.pickups.push({ kind, x, y, value, homing: false, dead: false });
  }

  private updatePickups(dt: number): void {
    const radius = this.pickupRadius;

    for (const p of this.pickups) {
      if (p.dead) continue;

      const dx = this.x - p.x;
      const dy = this.y - p.y;
      const dist = Math.hypot(dx, dy);

      // Chests don't fly to you; you walk to them. That's the whole ritual.
      const magnetic = p.kind !== 'chest';
      if (magnetic && (p.homing || dist < radius)) p.homing = true;

      if (dist < 1.2) {
        this.collect(p);
        p.dead = true;
        continue;
      }

      if (p.homing && dist > 0) {
        const speed = MOTE_MAGNET_SPEED * (1 + (1 - Math.min(1, dist / radius)) * 1.5);
        p.x += (dx / dist) * speed * dt;
        p.y += (dy / dist) * speed * dt;
      }
    }

    this.mergeMotes();
    if (this.pickups.some((p) => p.dead)) this.pickups = this.pickups.filter((p) => !p.dead);
  }

  private collect(p: Pickup): void {
    switch (p.kind) {
      case 'mote':
        this.playSfx('pickup', 0.03);
        return this.gainXp(p.value);
      case 'gold':
        this.gold += p.value;
        this.playSfx('gold', 0.05);
        return;
      case 'heal':
        this.hp = Math.min(this.maxHp, this.hp + p.value);
        this.playSfx('heal');
        return;
      case 'chest':
        this.openChest();
        return;
    }
  }

  /**
   * Chests evolve a weapon if one is eligible, else they hand out a level-up.
   * Evolution is the payoff moment of the run, so it takes priority.
   */
  private openChest(): void {
    const evo = this.eligibleEvolution();
    if (evo !== null) {
      const w = this.weapons.find((x) => x.id === evo.weapon);
      if (w !== undefined) {
        w.evolved = evo;
        this.justEvolved = evo;
        this.effects.push({ kind: 'flash', age: 0 });
        this.playSfx('evolve');
        this.gold += Math.round(crossroadsParam(this.data.crossroads, 'gold_per_chest') * this.goldMultiplier);
        return;
      }
    }
    this.pendingChests++;
    this.playSfx('chest');
    this.gold += Math.round(crossroadsParam(this.data.crossroads, 'gold_per_chest') * this.goldMultiplier);
  }

  /**
   * Weapon at max level + the paired passive **owned** (any level).
   *
   * It used to require the passive at max level too. Jane simulated a player who
   * rushes exactly those two and nothing else, and the payoff moment of the run
   * landed in one seed out of three, with 70 seconds left. The weapon is the
   * commitment; the passive is the key. design.md §8.
   */
  eligibleEvolution(): Evolution | null {
    for (const w of this.weapons) {
      if (w.evolved !== null) continue;
      if (w.level < maxLevel(this.data.weapons, w.id)) continue;

      const evo = evolutionFor(this.data.evolutions, w.id);
      if (evo === null) continue;
      if (!this.passives.some((p) => p.id === evo.passive && p.level >= 1)) continue;

      return evo;
    }
    return null;
  }

  /**
   * Motes merge on contact — both a performance trick and a joy: a hundred `·`
   * collapse into one fat `◆` you can inhale from across the screen.
   */
  private mergeMotes(): void {
    const buckets = new Map<number, Pickup[]>();
    for (const p of this.pickups) {
      if (p.dead || p.homing || p.kind !== 'mote' || p.value >= 20) continue;
      const k = this.cellKey(p.x, p.y);
      const b = buckets.get(k);
      if (b === undefined) buckets.set(k, [p]);
      else b.push(p);
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
    this.xp += Math.round(value * this.stats().xp_gain);
    // `while`, not `if`: one fat mote can carry you through two levels.
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpToNext(this.level);
      this.pendingLevelUps++;

      // No expanding ring: every glyph a ring could use is already owned by the
      // bolt, the mote or the gore. The `@` burns gold and the world stops.
      // The pause *is* the reward, and the card is about to fill the screen.
      this.playerFlash = this.j('levelup_flash');
      this.hitstopT = Math.max(this.hitstopT, this.j('levelup_hitstop'));
      // A cooldown, not a dedupe: it also throttles two real level-ups landing
      // in the same tick down to one sound, matching the one visual flash.
      this.playSfx('levelup', 0.5);
    }
  }

  // ---------------------------------------------------------------- decals

  /**
   * The gore layer. Jane specced it capped to the viewport; I anchor it in world
   * space instead so it doesn't smear when the camera moves, and bound it by
   * eviction. Same look, and it survives you walking back over old ground.
   */
  private addDecal(x: number, y: number): void {
    const cx = Math.round(x);
    const cy = Math.round(y / WU_PER_ROW);
    const key = (cx + 32768) * 65536 + (cy + 32768);

    // One decal per cell. Two hundred kills in a square metre used to push two
    // hundred overlapping decals, and because the freshest stage is bright red,
    // a busy patch of ground saturated into a solid red sheet you couldn't read
    // motes or enemies against. Re-killing on the same cell now just refreshes
    // the gore that's already there.
    const existing = this.decalIndex.get(key);
    if (existing !== undefined) {
      existing.born = this.time;
      return;
    }

    // `gore_chance` thins the carpet by *cells stained*, which is what floor
    // coverage means — so the roll belongs here, on a cell's first kill, and not
    // above where it would also skip refreshing ground you are still fighting on.
    if (!this.rng.chance(param(this.data.director, 'gore_chance'))) return;

    const decal: Decal = { cx, cy, born: this.time };
    this.decalIndex.set(key, decal);
    this.decals.push(decal);

    if (this.decals.length > MAX_DECALS) {
      const dropped = this.decals.splice(0, this.decals.length - MAX_DECALS);
      for (const d of dropped) this.decalIndex.delete((d.cx + 32768) * 65536 + (d.cy + 32768));
    }
  }

  private decalIndex = new Map<number, Decal>();

  /**
   * A decal outlives its last stage as an invisible entry, holding its cell
   * against a fresh kill and paying for a map slot. Jane shortened the chain from
   * 90s to 60s and the constant didn't follow her, so read the answer off her
   * table instead of copying the number into the code a second time.
   */
  private decalLifetime(): number {
    const stages = this.table.decals;
    const last = stages[stages.length - 1];
    return last?.ageTo ?? DECAL_LIFETIME;
  }

  private pruneDecals(): void {
    // Refreshing a cell's `born` breaks the time ordering, so the expired ones
    // are no longer a clean prefix. Sweep, but only about once a second.
    this.decalSweep -= 1;
    if (this.decalSweep > 0) return;
    this.decalSweep = 60;

    const lifetime = this.decalLifetime();
    if (!this.decals.some((d) => this.time - d.born > lifetime)) return;

    const alive: Decal[] = [];
    for (const d of this.decals) {
      if (this.time - d.born > lifetime) this.decalIndex.delete((d.cx + 32768) * 65536 + (d.cy + 32768));
      else alive.push(d);
    }
    this.decals = alive;
  }

  private decalSweep = 60;

  private updateEffects(dt: number): void {
    for (const fx of this.effects) fx.age += dt;
    this.effects = this.effects.filter((fx) => fx.age < (fx.kind === 'flash' ? 0.08 : 0.12));
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
