# THE LONG NIGHT
### An ASCII survivors game. One night. Kill everything. See the sun.

*Owner: Jane. This file is the source of truth for design. If it's not written here, it isn't decided.*

---

## 0. What we polish first — owner directive, 10.07

> *"The focus is now way too much on late game. Polish the core game before you
> work on any more later features."*

He is right, and the scoreboard proves it. We built the Crossroads, seven
evolutions, a scripted Countess and a gold economy — and the thing he actually
saw when he opened the game was a dead page reading `loading the night…`.
Everything after minute five is worth nothing if minute zero is broken.

**The core is the first five minutes**, and nothing else is core:

1. The game **opens**. Double-clicked, hosted, or served — it opens.
2. You walk, and it feels good to walk.
3. Things die near you without you ever aiming at them.
4. You can *see* the three things that matter: **you**, **the XP**, and
   **what is about to touch you**.
5. A card comes up, you read it in under two seconds, you pick, you feel stronger.

That is the whole product. A player who bounces at minute one never learns the
Countess exists.

### Frozen until the core is signed off

Not cancelled — **frozen**, in this order when we unfreeze:

| Frozen | Why it can wait |
|---|---|
| **Endless mode / the Reapers** | Content for players who already beat a 20-minute run. We have no evidence anyone has finished one. |
| **New evolutions, new weapons, new passives** | Seven weapons already outnumber what a five-minute player will ever see. |
| **New Crossroads upgrades** | Meta-progression is a *second-run* reward. There is no second run yet. |
| **The bestiary past minute 10** | Nobody has met the minute-3 ghoul enough times to be bored of it. |

### What "polished core" means, concretely

These are acceptance criteria, not aspirations. I will play the build and check
each one by hand.

- **It opens from a double-clicked file, and from a static host.** No terminal,
  no server, no flags. If the page can't start, it says so *on the page* in
  words a non-programmer can act on — never a silent spinner. (§12)
- **Nothing on the floor is brighter than anything standing on it.** (§9)
- **The starting weapon never asks you to aim.** Walking toward a thing that
  hurts you on contact, in order to damage it, is the single worst feel bug we
  had. The rule now lives in `characters.tsv` and it is load-bearing. (§7)
- **A level-up card is legible at a glance** — art, name, and one line of what
  it does. No player should read a stat block to pick.
- **The first minute has a shape.** One ghoul. Then three. Then a lull. The
  player must feel the tide breathe before it drowns them. (§11)
- **Every enemy that can appear has drawn art.** A single character standing in
  for an unfinished sprite is how we get told this looks like 1960. (§10)

### The rule this section exists to enforce

> **Feel before content.** If a thing already in the game feels bad, no new
> thing may be added until it feels good. Content is the cheapest thing we make
> and the easiest to add later; feel is neither.

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

### 5.0 Platform: we are leaving the terminal

*Owner mandate, 2026-07-09. Techstack is John's lane and the final shape is his
call, but the direction is not up for debate.*

The game renders to a **canvas in the browser**, not a TTY. It is still an ASCII
game — every entity is still made of characters — but the characters are drawn as
glyphs onto a canvas, which buys us four things a terminal cannot give:

1. **A grid big enough for real sprites.** This is the one that matters. See §10:
   multi-cell enemies at a 100×34 terminal grid would cover **71% of the screen**
   at the late-game head-count. They need ~**180×60**. No terminal is 180×60.
   The owner's two asks — bigger art, leave the terminal — are the same ask.
2. **Sub-cell motion.** Glyphs drawn at arbitrary pixel offsets instead of
   snapping to a character cell. Enemies *glide*. This, more than anything else,
   is what stops it looking like 1978.
3. **Real framerate and real animation.** 60fps+, per-sprite frame rates, no
   ~11KB of ANSI per frame.
4. **Effects.** Lantern glow, screen shake on a charge, damage numbers, ember
   particles, a vignette. Colour without a 16-slot budget.

**What does not change:** the `.txt` + mask art format, the `.tsv` tuning tables,
world units, and every design decision below except sprite sizes. The art
contract is renderer-independent, which is the whole reason it survives this.
`# colour:` already takes `#rrggbb`.

### 5.1 The grid

**A character cell is twice as tall as it is wide.** If we treat the grid as
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

This survives the move to canvas unchanged: pick a cell of `12×24` px and the wu
maths is identical. **Positions are floats, not integers** — on canvas a glyph
may be drawn at a fractional cell offset, and it must be, or everything snaps and
stutters. Entity *hitboxes* stay circles in wu; sprite size is cosmetic.

**Camera & bounds:** the world is **unbounded**. No walls, ever — walls let you
camp a corner and the genre dies. The camera hard-centers on the player, at
sub-cell precision.

**Viewport:** target **180 × 60 cells** (≈2160×1440 px at a 12×24 cell, scaled to
fit). Minimum **120 × 40**; below that we scale the whole canvas down rather than
show less world, because seeing the wave coming *is* the game. HUD is a thin
overlay: one line top, one bottom. Everything else is the field.

## 6. The player

The player is a **3×3 sprite** (`assets/sprites/player.txt`) — a hooded figure
with a lantern — whose head is the character **`@`**, in bright white. Nothing
else in the game may use bright white. Whatever else is happening, the player's
eye finds the `@` first.

Two frames, a walking cycle. The hitbox is a small circle in wu at the sprite's
centre, not its bounding box.

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

| Name | Starts with | Twist |
|---|---|---|
| **The Warden** | Sanguine Nova | +10% Area. The default. |
| **The Ashling** | Cinder Trail | +20% move, 70 HP. Fragile, fast, burns the floor. |
| **The Beggar** | Wisp Lantern | +30% Luck, +50% gold. Weak damage, rich runs. |

Note that **no starting weapon requires aiming.** Nova seeks, Cinder Trail drops
behind you, Wisp Lantern orbits. Directional weapons are things you *choose*.

## 7. Weapons — how auto-attacking works

**Every weapon is a timer.** No aiming, no firing, no targeting input. A weapon
is fully described by:

`cooldown · damage · shape · pierce · knockback · projectile speed · duration`

The cooldown ticks down; at zero the weapon resolves its shape at its origin and
resets. That's the entire system. Level-ups mutate those seven numbers (and
occasionally add a clause, like "also strikes behind you").

You may carry **6 weapons** and **6 passives**. Each caps at **level 8**.

### The starting weapon: SANGUINE NOVA

*Changed 2026-07-09. It used to be The Chain, and that was a mistake — see below.*

A seeking bolt. Every 1.4s it fires at the **nearest enemy**, wherever it is.
No aiming, no facing, no positioning tax.

- **Cooldown** 1.4s · **Damage** 8 · **Pierce** 1 · **Homing**, 40 wu/s
- **Render:** a `*` that tracks its target and pops on contact.

It is deliberately the least interesting weapon in the game, and it is the right
first one, because it teaches the correct lesson in the first ten seconds:
**your movement is for dodging, not for aiming.** The build does the killing.
A player who learns that at 0:10 is a player who understands the genre by 2:00.

> **Why this changed.** The Chain was the opener. It fires horizontally in your
> facing direction, and facing came from your last horizontal input — so to hit
> something you had to *walk toward it*. In a game whose entire threat model is
> "things touch you and you take damage," the starting weapon was asking the
> player to walk into the damage. The owner hit this immediately. A weapon that
> punishes the only verb you have is a broken weapon, however elegant its story.

**The rule binds the fallback too.** If `characters.tsv` ever names a starting
weapon that doesn't exist, the code must fall back to a weapon that *seeks* —
never to whichever row happens to be first in `weapons.tsv`. That row is The
Chain. A one-character typo in my table would silently hand the player back the
exact weapon this section exists to forbid, and it would look like a design
regression, not a data error. Pick `nova`; if `nova` is gone, refuse to start
and say so. (Flagged to John 10.07.)

### THE CHAIN (still in, still great, no longer first)

A whip, and now a level-up pick rather than a starting tax.

- **Cooldown** 1.1s · **Damage** 10 · **Pierce** ∞ · Knockback 4 wu
- **Shape** a band `12 wu wide × 6 wu tall` (3 rows, cells being 1×2), starting
  at the player's edge — **on both sides, from level 1.**
- **Render:** the band flashes as `═` for ~60ms, then `─` for ~60ms, then clears.

Striking both ways from level 1 is the second half of the fix: you can now whip
the thing you're *running away from*. Facing still exists and still matters —
the front band is wider — so "you turn by walking" survives as skill expression
instead of a toll.

Levels: `2` +damage · `3` +width · `4` **adds a vertical band (a cross)** ·
`5` +damage · `6` +width · `7` −cooldown · `8` +damage, bands are 5 rows tall.

### The rest of the arsenal

*Numbers: `assets/weapons.tsv` — one row per (weapon, level), absolute values, all
distances in wu. `assets/passives.tsv` and `assets/evolutions.tsv` likewise.
Don't hardcode any of it.*

Each weapon resolves one of seven **shapes**. A shape is the whole vocabulary:

| Shape | `ax` | `ay` | `pspeed` |
|---|---|---|---|
| `band` | width | height | — |
| `bolt` | hit radius | hit radius | wu/s, homing |
| `ring` | radius | radius | — |
| `arc` | burst radius | burst radius | wu/s, lobbed |
| `orbit` | orbit radius | hit radius | degrees/s |
| `column` | width | height | — |
| `trail` | ember radius | ember radius | — |

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
| `·` | bright cyan | 1 | every enemy |
| `+` | bright cyan | 5 | merged, or elites |
| `◆` | bright cyan | 20 | merged, or chests |

All three are the same hue on purpose: **cyan is XP**, and the tier reads from the
glyph, not the colour. The Wight used to own bright cyan; it is now pale white,
because an enemy that kills you must never share a hue with the thing you are
running *toward*.

`xp_to_next(L) = ceil(5 × 1.16^(L-1))`. Measured over three full simulated runs:
**level 20–39**, and **1,300–11,400 kills**, depending entirely on the build. A
weapon-hungry player kills nine times as much as a passive-hungry one. The kill
count is not a constant, which is why nothing may be tuned against it as though
it were — see the gold economy in `assets/crossroads.tsv`.

### Level-up

Freeze the sim. Dim the field to grey. Draw three cards. Pick one. Unfreeze.

Cards offer: a **new weapon** (if you have <6), a **weapon level**, a **new
passive** (if <6), or a **passive level**. Reroll / Banish / Skip are gold
unlocks and start at 0 charges.

**Every hand of three must contain at least one card that levels something you
already own**, whenever such a card exists. Without this, a player committed to
one weapon is at the mercy of the shuffle: in simulation, a build rushing the
Chain to level 8 simply *never got there* on one of three seeds, because the card
wasn't offered often enough. That isn't difficulty, it's a slot machine. The
guarantee costs nothing — the other two cards stay fully random — and it makes
"I am building toward *this*" a decision the game honours.

Each weapon card carries a **12×5 icon** (`assets/cards/*.txt`) that diagrams the
weapon's *shape* rather than picturing an object — the player learns `band`,
`ring`, `orbit`, `column` by looking at them. The Censer's ring is drawn as an
ellipse, because that is exactly how it renders in the world (§5). Free teaching.

### Passives

`Might` (+dmg) · `Haste` (−cooldown) · `Area` (+size) · `Duration` ·
`Swiftness` (+move) · `Magnet` (+pickup radius) · `Growth` (+XP) · `Luck` ·
`Armour` (flat reduction) · `Regen` · `Lantern Oil` (+light radius) · `Revival`

### Evolution

Max a weapon (lv8), **own** the paired passive — at *any* level, level 1 is
enough — then **open a chest**. The weapon transforms. This is the payoff moment
of the entire run and it should be loud: screen flash, the field goes white for
one frame, a 20×8 card slams up.

> **This rule used to say "hold the paired passive at max," and it made evolution
> unreachable.** I simulated a player doing nothing else — rushing Chain to 8,
> then Might to 8, ignoring every other card. Across three seeds he evolved
> *once*, at **18:50**, with 70 seconds of run left. The other two runs never got
> there. Sixteen of roughly thirty picks spent on two items, playing badly on
> purpose, and the payoff still didn't land.
>
> Owning the passive is the genre standard, and it's right: the weapon is the
> commitment, the passive is the key. Evolutions should land around **12:00–15:00**,
> leaving a third of the run to enjoy them.

**An evolved weapon is level 9.** Each weapon has exactly one evolution, so the
mapping is 1:1 and needs no new table: `weapons.tsv` carries a level-9 row per
weapon, and a weapon reads it when — and only when — it has evolved. Level-up
cards must never offer level 9.

Evolving is **a whole tier, not a level**: `damage ×1.70`, `cooldown ×0.75`,
`area ×1.30`, infinite pierce, *plus* the clause. It used to be the clause alone,
which meant the payoff moment of the run granted a behaviour change and **no
numbers at all** — the Chain evolved into Ouroboros and hit exactly as hard as it
had a second earlier. It has to be *felt*.

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

### The readability law

*Added 2026-07-10, after the owner reported "XP is hard to see, it's almost like
it goes under the blood" and "so many red things on the ground it's hard to make
out." Both were true, and both were my fault.*

Two rules, not negotiable, because breaking them makes the game unreadable no
matter how good the art is:

1. **The floor may never be brighter than the things standing on it.** Fresh gore
   was `R` (`#ff3b3b`), brighter than most enemies. The XP mote was `b`
   (`#2c4bd8`), luminance **0.105 against the blood's 0.247**. The mote was
   literally dimmer than the blood it lay on. It didn't *look like* it went under
   the blood — perceptually, it went under the blood.
2. **A glyph means one thing, and a hue means one thing.** `*` was the Blood
   Wisp, *and* gore aged 20–40s, *and* the bolt from your starting weapon. `%`
   was gore *and* the Beggar. `.` was gore *and* Cinder Trail's embers.

**The palette, by owner:**

| Hue | Belongs to |
|---|---|
| bright white `W` | **the player**, and nothing else, ever |
| bright cyan `C` | **XP**, all three tiers |
| bright yellow `Y` | reward — gold, chests, and the Gravewarden who drops them |
| bright red `R` | the Blood Wisp, and the Countess |
| bright green `G` | healing |
| grey · bone · white · yellow · magenta · red | ghoul · rat · wight · rattlejack · stalker · bat |
| dark red → black | **the floor.** Never anything else. |

### The Gore — the floor remembers

A **decal layer** underneath everything. Gore is **shading, not symbols** — `▒`
and `░`, which nothing else uses — and it fades toward black rather than glowing.
Three stages over **60 seconds**:

`▒` fresh (dark red) → `░` (dark red) → `░` (near black) → gone

**Only `gore_chance` (0.35) of kills leave a mark at all.** Every kill used to. A
weapon build lands 11,442 kills; at ~40 kills/sec with a 90-second decay that is
~3,600 decals on a 10,800-cell field — **a third of the screen, solid red**. At
0.35 and 60s it settles near **8%**: still a carpet of your kills, still thickest
where you fought hardest, but the floor stops shouting.

Decals never block movement, never collide, never think. It is a character grid
and a timestamp grid. By minute 18 the field is a red-brown carpet that thins
out where you haven't walked. **This is the single best-looking thing in the
game and it costs nothing.**

Decals are anchored in **world space**, not the viewport, and the layer is bounded
by eviction (~24k cells) rather than by clipping. *This corrects my original
spec, which said to cap it to the viewport — John pointed out that viewport-capped
decals smear as the camera scrolls under them, and that walking back over old
ground should show you your own carpet. He's right; it's the whole point of §10's
Dusk phase.*

## 10. The bestiary

Enemies are **multi-cell animated ASCII sprites**, sized by tier.

> **I was wrong about this, and it's worth recording why.** My original rule was
> "every enemy is exactly one glyph," on the grounds that 300 multi-cell sprites
> would be an unreadable smear. John proposed a tiered size table in his very
> first note and I overruled him. The owner has overruled me.
>
> The arithmetic that convinced me: at the late-game head-count, these tiers
> average **8 cells per enemy**. On the old 100×34 terminal grid that's **71% of
> the screen** — I was right that it doesn't work *in a terminal*. On the 180×60
> canvas grid (§5.0) it's **16%**, which is a wall of bodies you can still read.
> The size rule and the platform were never separate questions. I'd argued the
> conclusion without noticing it depended on a premise I could change.

| Sprite | Name | HP | Speed | Power | From | Behaviour |
|---|---|---|---|---|---|---|
| `2×1` | **Grave Rat** | 2 | 14 | 2 | 0:30 | Packs of 12+. Dies to a stiff breeze. Scurries. |
| `3×1` | **Bat** | 5 | 26 | 3 | 2:00 | Faster than you. Sine-wave drift, so it *misses*. Wings flap. |
| `3×2` | **Ghoul** | 10 | 9 | 4 | 0:00 | Walks straight at you. The bread and butter. Shambles. |
| `3×2` | **Rattlejack** | 16 | 11 | 6 | 8:00 | On death, splits into two Grave Rats. |
| `3×2` | **Blood Wisp** | 12 | 16 | 5 | 12:00 | Ignores enemy collision. Floats through the pile. |
| `5×3` | **Wight** | 40 | 6 | 9 | 4:00 | Slow, tanky, hits hard. Advances in a line. |
| `5×3` | **Stalker** | 30 | 18 | 12 | 14:00 | **Invisible outside your light.** Rare, deadly, telegraphed by a `?` at the light's edge one second before it enters. |
| `9×5` | **Gravewarden** *(elite)* | ×20 | 7 | 16 | scripted | Bold, bright, HP bar above. Drops a chest. 5:00, 10:00, 15:00 (×2). |
| `28×11` | **The Countess** *(boss)* | 9000 | — | 25 | 19:00 | See below. |

Rules that keep this readable at 220 enemies:

- **Size is threat.** A player must be able to read danger from silhouette alone,
  at a glance, with no colour. Chaff is small. Tanks are big.
- **Every mob animates**, minimum 2 frames. A field of 220 static sprites is a
  wallpaper; a field of 220 breathing ones is a horde. This is most of what the
  owner is asking for.
- **Sprite size is cosmetic. The hitbox is a circle in wu** — the `hit_rad`
  column of `glyphs.tsv`, never the sprite's bounding box. Big sprites must not
  become unfair sprites: the 9×5 Gravewarden gets a torso, not a reach.
- **The player's hitbox is smaller than the player.** 1.2 wu inside a 3×3 sprite.
  Getting hit should feel like being *caught*, not like being *near*. Every
  survivors game that feels good cheats here, and cheats in the player's favour.
- **Draw order is by world y**, so the horde overlaps like a crowd rather than a
  spreadsheet.
- **The player must never be lost.** The `@` at the player's heart stays the only
  bright-white glyph in the game.

Machine-readable stats: `assets/glyphs.tsv`. Art: `assets/sprites/mobs/*.txt`,
`assets/sprites/elites/*.txt`, `assets/sprites/countess.txt`. The `glyph` column in
`glyphs.tsv` survives as the **loader fallback** when a sprite file is missing —
which is exactly how we ship a half-drawn bestiary without breaking the build.

### The boss: THE COUNTESS

*Data: `assets/countess.tsv`. Art: `assets/sprites/countess.txt` (16×5, 2 frames
@ 4fps — the wings flap; the body is column-locked so she doesn't wobble).*

The one multi-cell creature in the game. Anchored at her centre, drawn above all
decals, always at full brightness.

She arrives at **19:00**, and two things happen at once: **the clock freezes**
and **the ambient spawn director halts.** Nothing on the field but the Countess
and what she summons. The night doesn't end on a timer — it ends when she dies.

| Phase | HP | Move | Attack | Cadence |
|---|---|---|---|---|
| **Court** | 100→70% | stationary | summons 12 Bats in a ring around herself | 4.0s |
| **Hunt** | 70→25% | 10 wu/s | charges the player | 3.0s |
| **Dusk** | 25→0% | 14 wu/s | charges the player | 2.0s |

**Court.** She doesn't move. Bats erupt from her in closing rings. Kill them or
drown in them — and the whole time, she isn't the thing hurting you.

**Hunt.** She charges: an **0.8s telegraph** where she glows, then **52 wu/s** in
a straight line — more than twice your speed. You cannot outrun a charge, so
don't; her turn rate is **90°/s**, which is slow. Sidestep late. She leaves a
trail of `▓` that burns for 4s and does 8 damage/second, so the arena fills with
her own exhaust and the space you're allowed to stand in shrinks.

**Dusk.** At 25% the field goes black beyond your lantern — *even with
`--no-dark`*, because this is the one moment the darkness is the mechanic and not
the mood. She's faster and she charges every 2 seconds.

And here is the payoff for the gore layer (§9). Nineteen minutes of killing have
painted a carpet across the ground recording everywhere you've been. In the dark,
with a boss you can only see when she's on top of you, **that carpet is the only
thing telling you where you are.** The decals stop being decoration and become
navigation. That's the whole game arriving at its own ending.

If she's still alive after **2 minutes** she enrages — charge cadence up 50%. You
cannot stall her out. Kill her, and the sun comes up.

## 11. The spawn director

*Data: `assets/director.tsv`. Don't hardcode any of this.*

The director is a **closed loop on head-count**, not a spend-down budget.

```
target(t) = 3 + 217 × (t/1200)^1.5      enemies alive: 3 at 0:00 → 220 at 20:00
cap(t)    = 15 + 45  × (t/1200)         max spawns/sec: 15 → 60
each tick: spawn min(target(t) − alive, cap(t)) enemies just outside the viewport
```

*(300 → 220 because enemies are no longer one cell each. At the §10 tiers, 220
enemies average 8 cells apiece = ~16% of a 180×60 field, before they clump on the
player. Perf is not the constraint here — John measured 10× headroom — legibility
is. This is one number in `director.tsv`; I'll raise it the moment it looks thin.)*

**Why not a budget.** I specced one first — `budget += 1.0 + minutes × 0.9`,
spend it on enemies by `cost` — and then simulated it. It's open-loop: population
is whatever `spawns − kills` integrates to, which depends entirely on the
player's build. A normal build ends the run with **~8,400 enemies alive**. A
strong one ends on an empty field. Two players, two different games, and no way
to tune it for both.

The closed loop holds within ~7 enemies of target across every build I
simulated, from a deliberately awful one to a 4× overtuned one. Its failure mode
is graceful: a build so strong it out-kills 60 spawns/sec thins the field, and
that's a signal I've mis-tuned a weapon, not a crash.

**Composition** is its own axis, in the `mix` rows. Weights lerp from *early* to
*late* over the run and are gated by a first-appearance time. I originally
weighted spawn choice by each enemy's `cost` — which made the **Stalker**, the
rare invisible one, the single most common enemy at 20:00. Exactly backwards.
Rarity is not cost. (`cost` in `glyphs.tsv` survives only as an advisory threat
rating; it is no longer the spawn currency.)

| | 0:00 | 10:00 | 15:00 | 20:00 |
|---|---|---|---|---|
| Ghoul | 100% | 39% | 25% | 9% |
| Grave Rat | | 24% | 16% | 7% |
| Bat | | 18% | 17% | 18% |
| Wight | | 11% | 17% | 27% |
| Rattlejack | | 8% | 13% | 20% |
| Blood Wisp | | | 10% | 16% |
| Stalker | | | 2% | 4% |

The Ghoul is the whole game at 0:00 and a rounding error at 20:00. The Wight
becomes the backbone. **The Stalker stays rare on purpose** — it's the only
invisible enemy, so it must be a shock, not a tax.

**Scripted beats** sit on top of the ambient director and ignore the target.
These are the moments the player learns to dread:

| Time | Beat |
|---|---|
| 0:30 | First rat swarm |
| 2:00 | **Bat flock** — 40 bats cross the screen on one axis. Get out of the way. |
| 4:00 | **The Wight Wall** — a solid line of Wights advances from one edge. |
| 5:00 | ELITE: Gravewarden |
| 7:00 | **The Ring** — 60 ghouls spawn as a closing circle around you. Punch out. Radius is a circle in **wu**, *inscribed* in the viewport (`min(half_w, half_h) × 0.95`), so all 60 are visible. It draws as an ellipse. A circle in *cells* would put half the ring off-screen, and the beat would read as a band closing from the sides. |
| 10:00 | ELITE + rat swarm |
| 12:00 | Blood Wisps enter the pool |
| 15:00 | ELITE ×2 |
| 17:00 | **The Tide** — head-count target ×2, from every edge, for 90 seconds. |
| 19:00 | **THE COUNTESS.** Clock stops. |

## 12. Screens, HUD, and where the art goes

**HUD, top line:** `HP ████████░░ 82/100   LV 14   T 12:43   K 1,847   $ 312`
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

**The boot screen — and the boot *failure* screen.**

The page currently ships a bare `loading the night…` that stays on screen
forever if the game never starts. On 10.07 that string *was the entire game* as
far as the owner was concerned; he reported it as `the game just loads "...."`.

A spinner that cannot fail is a lie. Two rules:

1. **The loading text must never be the last thing on screen.** If the game has
   not drawn a frame within ~5 seconds, the page replaces the loader with a
   failure panel *by itself*, whether or not any JavaScript ran.
2. **The failure panel is written for the owner, not for us.** Not a stack
   trace. It names the likely cause and the one action that fixes it:

```
   THE LONG NIGHT could not start.

   If you opened this file directly from your computer, browsers
   block games from loading their art that way.

   Run it with:   npm start
   Or play the hosted build:   <url>

   (technical detail, for John: <the actual error>)
```

The technical detail goes *last* and *small*. The owner should never have to
read it, and John should never have to ask for it.

## 13. Meta progression — The Crossroads

*Data: `assets/crossroads.tsv`. Art: `assets/ui/crossroads.txt`.*

Gold drops from chests, elites, and 1-in-50 ordinary kills. It persists between
runs. Between runs you stand at a signpost and spend it, and it never comes back.

`cost(level) = cost_base × cost_growth^(level−1)`, rounded to the nearest 10.

| | Levels | Effect | From |
|---|---|---|---|
| **Might** | 5 | +5% damage | 100g |
| **Vigour** | 5 | +10 max HP | 80g |
| **Armour** | 3 | +1 flat reduction | 200g |
| **Luck** | 4 | +5% luck | 150g |
| **Greed** | 5 | +10% gold | 120g |
| **Reroll** | 3 | +1 level-up reroll | 250g |
| **Banish** | 3 | +1 banish | 250g |
| **Revival** | 2 | come back once at 50% HP | 1000g |
| **The Ashling** | — | unlock | 400g |
| **The Beggar** | — | unlock | 900g |

### The one rule that keeps this honest

> **Meta-progression may make a bad run survivable. It may never make a good run
> trivial.**

Nothing at the Crossroads touches weapon damage *scaling* or the spawn curve. It
moves the floor, never the ceiling. A player who has bought every upgrade should
still lose to the Countess if they build badly — otherwise the game stops being
about the twenty minutes and starts being about the grind, and every run before
the last one is a chore you do to skip the game.

This is why Might caps at +25% and Revival costs 1000g for one extra life.

**Endless mode** unlocks when you first see dawn — with achievement, not gold.
The sun never rises, the head-count target never stops climbing, and at 30:00 the
Reapers come and they cannot be killed. Nobody survives Endless. That's the point.

---

## Open questions / assumptions I'm running with

Tracked live in `jane.md`. Anything settled gets promoted **into this file** and
mirrored to `meetings.md`.
