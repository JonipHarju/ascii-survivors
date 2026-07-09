# THE LONG NIGHT
### An ASCII survivors game. One night. Kill everything. See the sun.

*Owner: Jane. This file is the source of truth for design. If it's not written here, it isn't decided.*

---

## 1. The pitch

You are a lantern-bearer stranded in a graveyard at midnight. Dawn is twenty
minutes away. You cannot attack — your weapons swing themselves. All you do is
**walk**. Everything else, you choose between waves.

The dead come in ones, then dozens, then in a tide that fills every cell of the
screen. By minute fifteen you are a walking meat grinder wading through a carpet
of your own kills. At 19:00 the Countess arrives and the clock **stops**. Kill
her, and the sun comes up.

## 2. Why it's fun (the three things we protect)

1. **Your only verb is movement.** No attack button. Ever. The player's skill is
   positioning, kiting, and knowing when to walk *into* the swarm. The build does
   the killing. This is the genre's soul and we do not compromise it.
2. **The power curve is obscene.** Minute 1: you kill one ghoul per second and
   it's scary. Minute 18: you delete a hundred enemies a second and you are bored
   of being a god. That gap *is* the game.
3. **The floor remembers.** Every kill leaves gore on the ground that lingers.
   By the end of a run the field is a visible record of the slaughter. This is
   free in ASCII and it looks incredible. See §9.

## 3. Core loop

```
  move  →  weapons auto-fire  →  things die  →  they drop XP motes
    ↑                                                    ↓
  new toy  ←  pick 1 of 3 cards  ←  level up  ←  walk over motes
```

Every ~60s the spawn director escalates. Elites drop chests. Chests evolve
weapons. Death → run summary → spend gold → run again, stronger.

**Run length:** 20 minutes. That's the whole night.

## 4. The clock

The HUD clock counts **up** from `00:00`. Dawn is at `20:00`.

- At **19:00** the Countess spawns and **the clock freezes at 19:00**.
- The sun does not rise on a schedule. It rises when she dies.
- Kill her → `DAWN` → victory screen.

> **Decision:** the boss is a *fight*, not a survival timer. You cannot outlast
> her. A 20-minute run that ends with "you stood in a corner for 60 seconds" is
> a bad ending, so we don't ship one.

## 5. Space, and the thing everyone gets wrong

**A terminal cell is twice as tall as it is wide.** If we treat the grid as
square, circles come out as ovals, "run away" is twice as fast vertically as
horizontally, and every AoE lies to the player.

**Therefore — this is a hard requirement, not a preference:**

- The world uses **world units (wu)**. `1 cell = 1 wu wide × 2 wu tall`.
- All speeds, radii, and distances are in wu and are **isotropic**.
- Rendering divides the y coordinate by 2.
- **A circular AoE of radius `r` draws as an ellipse `rx = r`, `ry = r/2` cells.**

Consequence for feel: a player moving at 20 wu/s covers 20 cells/s horizontally
and 10 rows/s vertically. That is correct and it will *look* right. Diagonal
movement must be normalized (`× 0.707`), not additive.

**Camera & bounds:** the world is **unbounded**. No walls, ever — walls let you
camp a corner and the genre dies. The camera hard-centers on the player.

**Viewport:** minimum supported terminal `80×24`. Target `100×34`. Render the
play field to whatever the terminal actually is, capped at `120×40` so the
player can still see their own `@`. HUD is a thin overlay: one line top, one
line bottom. Everything else is the field.

## 6. The player

The player is a single glyph: **`@`**, bright white, bold. Nothing else on the
field is bright white. It is always the most legible thing on screen.

| | |
|---|---|
| Base HP | 100 |
| Base move | 20 wu/s |
| Base pickup radius | 6 wu |
| Contact damage taken | enemy `power`, on a 0.5s per-enemy cooldown |
| i-frames | none — damage is a slow drain, not a spike |

You do not get knocked back and you do not get stunned. Losing control in a
swarm feels like a bug even when it isn't.

### Characters (unlocked with gold)

| Glyph | Name | Starts with | Twist |
|---|---|---|---|
| `@` | **The Warden** | The Chain | +10% Area. The default. |
| `&` | **The Ashling** | Cinder Trail | +20% move, 70 HP. Fragile, fast, burns the floor. |
| `%` | **The Beggar** | Wisp Lantern | +30% Luck, +50% gold. Weak damage, rich runs. |

## 7. Weapons — how auto-attacking works

**Every weapon is a timer.** No aiming, no firing, no targeting input. A weapon
is fully described by:

`cooldown · damage · shape · pierce · knockback · projectile speed · duration`

The cooldown ticks down; at zero the weapon resolves its shape at its origin and
resets. That's the entire system. Level-ups mutate those seven numbers (and
occasionally add a clause, like "also strikes behind you").

You may carry **6 weapons** and **6 passives**. Each caps at **level 8**.

### The starting weapon: THE CHAIN

A whip. It knows where you're facing — the last **horizontal** direction you
pressed. Left or right, never up or down.

- **Cooldown** 1.1s · **Damage** 10 · **Pierce** ∞ (hits everything in the band)
- **Shape** a band `12 wu wide × 3 rows tall`, starting at the player's edge, in
  the facing direction. Knockback 4 wu.
- **Render:** the band flashes as `═` for ~60ms, then `─` for ~60ms, then clears.
  Two frames. That's the whole animation and it reads perfectly.

Because it's horizontal-only, the Chain teaches the game's first real skill:
**you turn by walking.** Good players flick left-right to keep the band on the
swarm. It should feel like snapping a towel.

Levels: `2` +damage · `3` +width · `4` **strikes behind you too** · `5` +damage
`6` +width · `7` -cooldown · `8` +damage, band is 5 rows tall.

### The rest of the arsenal

| Weapon | Glyph | Behaviour |
|---|---|---|
| **The Chain** | `═` | Horizontal band, facing. Starting weapon. |
| **Sanguine Nova** | `*` | Fires a bolt at the nearest enemy every 1.4s. Homing, low damage, high rate. The reliable one. |
| **Censer** | `~` | A persistent damaging ring around you. Ticks 2/s. Tiny damage, infinite pierce, never stops. The safety blanket. |
| **Grave Salt** | `^` | Lobs upward in an arc, falls, shatters into a small burst. Hits things *behind* the swarm. |
| **Wisp Lantern** | `o` | 1–4 motes orbit you, damaging on contact. Pure defense that scales into offense. |
| **Silver Rain** | `\|` | Every 4s, a column of falling silver in a random zone near you. Big damage, no control. |
| **Cinder Trail** | `.` | Leaves burning embers behind you as you walk. Damage-over-time on the floor. Rewards kiting in circles. |

Note how many of these are *shapes*, not projectiles — bands, rings, columns,
trails. In a terminal, a shape reads instantly and a bullet doesn't. Lean in.

## 8. Passives, levelling, and evolution

### XP and motes

Enemies drop **motes**. Motes merge when they touch — this is both a performance
trick and a joy: watch a hundred `·` collapse into a single fat `◆` you can
inhale from across the screen.

| Glyph | Colour | XP | |
|---|---|---|---|
| `·` | blue | 1 | every enemy |
| `+` | green | 5 | merged, or elites |
| `◆` | yellow | 20 | merged, or chests |

`xp_to_next(L) = ceil(5 × 1.16^(L-1))`. Expect **~28–35 levels** and a few
thousand kills per completed run.

### Level-up

Freeze the sim. Dim the field to grey. Draw three cards. Pick one. Unfreeze.

Cards offer: a **new weapon** (if you have <6), a **weapon level**, a **new
passive** (if <6), or a **passive level**. Reroll / Banish / Skip are gold
unlocks and start at 0 charges.

### Passives

`Might` (+dmg) · `Haste` (−cooldown) · `Area` (+size) · `Duration` ·
`Swiftness` (+move) · `Magnet` (+pickup radius) · `Growth` (+XP) · `Luck` ·
`Armour` (flat reduction) · `Regen` · `Lantern Oil` (+light radius) · `Revival`

### Evolution

Max a weapon (lv8), hold the paired passive at max, then **open a chest**. The
weapon transforms. This is the payoff moment of the entire run and it should be
loud: screen flash, the field goes white for one frame, a 20×8 card slams up.

| Weapon | + Passive | → | Evolution |
|---|---|---|---|
| The Chain | Might | → | **Ouroboros** — bands on *both* sides, always |
| Sanguine Nova | Haste | → | **Hemorrhage** — bolts chain to 4 targets |
| Censer | Area | → | **Pyre** — the ring ignites the floor it passes over |
| Wisp Lantern | Duration | → | **Corona** — 8 motes, they orbit *out* and come back |
| Cinder Trail | Swiftness | → | **Wildfire** — embers spread to adjacent embers |
| Silver Rain | Luck | → | **Moonfall** — one huge column, screen-tall |
| Grave Salt | Growth | → | **Bonemeal** — shattered salt raises XP motes |

## 9. The Dark, and the Gore

Two systems that exist because this is ASCII and would be expensive anywhere else.

### The Dark — *dim, not hidden*

The player is the only light. Light radius **14 wu** (`Lantern Oil` raises it).

- **Inside** the radius: full colour.
- **Outside**: everything still renders, in dim grey. You always see the swarm
  coming. This is atmosphere, not blindness. **Nothing that can kill you is ever
  invisible** — except one enemy, on purpose (the Stalker, §10).
- Bosses and elites are always drawn at full brightness.

*Playtest risk:* 300 dim-grey glyphs may read as mush. **This must be a runtime
flag (`--no-dark`) from day one** so we can A/B it. If it's ugly, it dies.

### The Gore — the floor remembers

A **decal layer** underneath everything. Every death writes gore at the corpse's
cell and it decays over ~90 seconds:

`※` fresh (bright red) → `%` → `*` → `,` → `.` → `` (gone)

Decals never block movement, never collide, never think. It is a character grid
and a timestamp grid. By minute 18 the field is a red-brown carpet that thins
out where you haven't walked. **This is the single best-looking thing in the
game and it costs nothing.** Cap the layer at the viewport; don't persist it into
the unbounded world.

## 10. The bestiary

Every enemy on the field is **one glyph**. Not a sprite — one cell.

This is not a limitation, it's the core rendering decision: we want *three
hundred* enemies visible at once, and at that density a multi-cell sprite is an
unreadable smear. Multi-cell art is reserved for **bosses**, and for **portraits**
shown in the HUD (§12). See `assets/glyphs.tsv` for the machine-readable table.

| Glyph | Name | HP | Speed | Power | From | Behaviour |
|---|---|---|---|---|---|---|
| `g` | **Ghoul** | 10 | 9 | 4 | 0:00 | Walks straight at you. The bread and butter. |
| `r` | **Grave Rat** | 2 | 14 | 2 | 0:30 | Spawns in packs of 12+. Dies to a stiff breeze. |
| `w` | **Bat** | 5 | 26 | 3 | 2:00 | Faster than you. Drifts on a sine wave, so it *misses*. |
| `W` | **Wight** | 40 | 6 | 9 | 4:00 | Slow, tanky, hits hard. Advances in a line. |
| `*` | **Blood Wisp** | 12 | 16 | 5 | 12:00 | Ignores enemy collision. Floats through the pile. |
| `x` | **Rattlejack** | 16 | 11 | 6 | 8:00 | On death, splits into two Grave Rats. |
| `S` | **Stalker** | 30 | 18 | 12 | 14:00 | **Invisible outside your light.** The only one. Rare, deadly, telegraphed by a `?` at the light's edge one second before it enters. |

**Elites** are still one glyph, drawn **bold + bright**, with a small HP bar
above them. They are ordinary enemies with ×20 HP and a chest.

| Glyph | Name | Arrives |
|---|---|---|
| `G` | **Gravewarden** | 5:00, 10:00, 15:00 (×2) |

### The boss: THE COUNTESS

The one multi-cell creature in the game: **16 wide × 5 tall**, anchored at her
centre, drawn above all decals. `assets/sprites/countess.txt`.

She spawns at **19:00**. The clock stops. She has three phases:

1. **Court** — she is stationary and summons Bats in rings. Kill the bats or
   drown.
2. **Hunt** — she charges the player in straight lines, leaving a trail of `▓`
   that damages. Slow turns. Bait her.
3. **Dusk** — at 25% HP, the screen darkens to your light radius only. She is
   *fast*. Your gore-carpet is the only map you have.

Kill her and the sun comes up.

## 11. The spawn director

Not a wave table — a **budget**. Every second the director gets
`budget += 1.0 + t_minutes × 0.9` points and spends them on enemies (each enemy
costs its `cost` from `glyphs.tsv`), spawning them just outside the viewport.
This keeps pressure smooth and terminal-size-independent.

On top of the budget, **scripted beats** that the player learns to dread:

| Time | Beat |
|---|---|
| 0:30 | First rat swarm |
| 2:00 | **Bat flock** — 40 bats cross the screen on one axis. Get out of the way. |
| 4:00 | **The Wight Wall** — a solid line of Wights advances from one edge. |
| 5:00 | ELITE: Gravewarden |
| 7:00 | **The Ring** — 60 ghouls spawn as a closing circle around you. Punch out. |
| 10:00 | ELITE + rat swarm |
| 12:00 | Blood Wisps enter the pool |
| 15:00 | ELITE ×2 |
| 17:00 | **The Tide** — everything, from every edge, for 90 seconds. |
| 19:00 | **THE COUNTESS.** Clock stops. |

## 12. Screens, HUD, and where the art goes

**HUD, top line:** `HP ████████░░ 82/100   LV 14   ⏱ 12:43   ☠ 1,847   ⛁ 312`
**HUD, bottom line:** the XP bar, full width, plus your weapon glyphs `═ * ~ o`.

**First encounter.** The first time each enemy type appears, a **20×8 portrait**
slides into the top-right corner for 1.5s with its name. It does **not** pause
the game — pausing mid-swarm to admire art is how you get killed. It's a corner
panel. `assets/portraits/*.txt`

**Level-up screen.** Field dims. Three cards. Each card shows the weapon/passive
glyph huge, a name, and a one-line effect.

**Death screen.** Per John's question (§meetings): **run summary first**, then
restart. It shows: time survived, kills, level reached, your build (the weapon
glyphs in a row), gold earned, and your best minute (peak kills/min). Then a
single key to run again. `assets/ui/death.txt`

**Dawn screen.** You earned this one. `assets/ui/dawn.txt`

**Title.** `assets/ui/title.txt`

## 13. Meta progression — The Crossroads

Gold drops from chests, elites, and 1-in-40 ordinary kills. Between runs, spend
it: `+Might%` · `+Max HP` · `+Armour` · `+Luck` · `+1 Reroll` · `+1 Banish` ·
`+1 Revival` · unlock The Ashling · unlock The Beggar.

**Endless mode** unlocks when you first see dawn: *the sun never rises*, the
director budget never stops climbing, and at 30:00 the Reapers come and they
cannot be killed. Nobody survives Endless. That's the point.

---

## Open questions / assumptions I'm running with

Tracked live in `jane.md`. Anything settled gets promoted **into this file** and
mirrored to `meetings.md`.
