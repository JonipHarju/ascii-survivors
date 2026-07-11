# THE LONG NIGHT
### A survivors game. One night. Kill everything. See the sun.

*Owner: Jane. This file is the source of truth for design. If it's not written here, it isn't decided.*

> ⚠️ **11.07, 00:03 — the setting and art direction pivoted to space. See §15.**
> §1 and §6 below are updated in place. §9, §10, and §10.5 describe the ASCII
> gothic skin and are **superseded** — kept as the historical record of the
> legibility problems they solved, because §15 has to solve the same problems
> again in a new medium and shouldn't re-litigate them from zero. The title
> stays "The Long Night" (a fixed-length run that ends at dawn is genre-neutral);
> everything under the title is the gothic flavor text and that's what's moving.

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
- **Hitting a thing looks like hitting it.** The owner's "is this the 1960s"
  complaint was never about the sprites; it was that nothing in the game reacts.
  A ghoul that flinches beats a ghoul drawn in three colours. This is core, not
  polish-after-the-fact, and it is the last core item outstanding. (§14)

### The rule this section exists to enforce

> **Feel before content.** If a thing already in the game feels bad, no new
> thing may be added until it feels good. Content is the cheapest thing we make
> and the easiest to add later; feel is neither.

## 1. The pitch

*Updated 11.07 — see §15 for why. The shape of this pitch is unchanged; only
the world it's set in is.*

You are a lone pilot dropped into a hostile debris sector. Extraction dawn is
twenty minutes away. You cannot fire — your hardpoints fire themselves. All you
do is **fly**. Everything else, you choose between waves.

The swarm comes in ones, then dozens, then a tide that fills every cell of the
screen. By minute fifteen you are a one-ship battlefleet wading through a field
of your own kills. At 19:00 the Overlord translates in-system and the clock
**stops**. Kill it, and extraction opens.

## 2. Why it's fun (the three things we protect)

1. **Your only verb is movement.** No attack button. Ever. The player's skill is
   positioning, kiting, and knowing when to walk *into* the swarm. The build does
   the killing. This is the genre's soul and we do not compromise it.
2. **The power curve is obscene.** Minute 1: you kill one ghoul per second and
   it's scary. Minute 18: you delete a hundred enemies a second and you are bored
   of being a god. That gap *is* the game.
3. **The floor remembers.** Every kill leaves wreckage on the field that
   lingers. By the end of a run the field is a visible record of the slaughter.
   §9 describes how this worked in the ASCII gore layer; §15.3 is the same law
   translated to a debris/scorch decal layer.

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

- At **19:00** the Overlord spawns and **the clock freezes at 19:00**. (Was the
  Countess — see §15.2 for the reskin. Same trigger, same freeze.)
- Extraction does not open on a schedule. It opens when the boss dies.
- Kill it → `DAWN` → victory screen.

> **Decision:** the boss is a *fight*, not a survival timer. You cannot outlast
> it. A 20-minute run that ends with "you stood in a corner for 60 seconds" is
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

*Visual description superseded 11.07 — the player is now the Ranger ship, not
a hooded figure. See §15.2. Everything below the art description (hitbox,
stats, pickup radius, the "you collect what you can see" law) is unchanged and
still binding — it's stat tuning, not skin.*

~~The player is a **5×5 sprite** (`assets/sprites/player.txt`) — a hooded, cloaked
figure with a lantern that swings as he walks — whose face is the character
**`@`**, in bright white. Nothing else in the game may use bright white. Whatever
else is happening, the player's eye finds the `@` first.~~ The player is now the
**Galactica Ranger** (`assets/space-assets/Galactica Ranger/`), reserved
silhouette + colour per §15.3 — same "the player must never be lost" law, new
enforcement mechanism since there's no `@` glyph to reserve anymore.

*(Was 3×3, a literal stick figure `@ /|\ / \`. The owner named it — "stick
figures ... I want it to look like an actual game," Effulgence RPG as the
reference — and he was right. See §10.5: the fix was volume through glyph density,
not a bigger colour budget, and drawing to the canvas grid we already committed to
in §5.0. His head `@` and legs `/ \` are still his own strokes; the cloak is a
solid `█` core with `▐ ▌` half-block edges, and the lantern is a yellow `◆`.)*

Two frames, a walking cycle. The hitbox is a small circle in wu at the sprite's
centre, not its bounding box.

| | |
|---|---|
| Base HP | 100 |
| Base move | 20 wu/s |
| Base pickup radius | **12 wu** (was 6 — see below) |
| Contact damage taken | enemy `power`, on a 0.5s per-enemy cooldown |
| i-frames | none — damage is a slow drain, not a spike |

You do not get knocked back and you do not get stunned. Losing control in a
swarm feels like a bug even when it isn't.

> **You collect what you can see.** The pickup radius is tied to the lantern
> (light radius 14 wu, §9) and sits just inside it. A mote that lights up is a
> mote you will get. `Magnet` then pulls motes *out of the dark*, which is
> exactly what a magnet should feel like — reaching past what you can see.

**Why it changed, 10.07.** At 6 wu the number was quietly breaking the core loop.
Your weapons kill at range — Nova's bolt travels up to 80 wu — so enemies die
*far away from you*, and their motes drop where they died. A 6 wu radius could
not reach them. I simulated 90 seconds of a kiting player:

| Base pickup radius | First card | Level at 90s | Motes stranded on the floor |
|---|---|---|---|
| **6 wu** (shipped) | **46.7s** | 3 | **29 of 39** |
| 12 wu | 20.6s | 5 | 9 |
| 18 wu | 20.0s | 5 | 5 |
| 24 wu | 17.8s | 6 | 0 |

Kills were **identical (39) at every radius** — this number does not touch
combat. All it decides is whether the player ever *receives* the XP they earned.
Three quarters of it was being left on the ground.

The first level-up card is where the game teaches its own loop, and it was
arriving 47 seconds in. It should arrive around 20. Past 12 wu the returns
flatten and the motes stop being a trail you walk back over, which is a real
pleasure — so **12 wu**, not 24.

### The pickup radius is the dial that decides whether the player is allowed to move

*Second pass, 10.07, and this is the part I missed the first time.* The table
above simulated exactly one player: a kiting one. So I re-ran it across the four
things a survivors player actually does, over two minutes and six seeds. **Time
to the first level-up card:**

| Base radius | stand still | walk a straight line | kite wide | kite tight |
|---|---|---|---|---|
| **6 wu** *(what ships)* | 18.5s | **6m 36s** | 3m 43s | 37.7s |
| **12 wu** *(§6, decided)* | 17.1s | 1m 13s | 56.6s | **19.1s** |
| 18 wu | 15.7s | 59.8s | 46.0s | 17.5s |
| 24 wu | 13.9s | 35.2s | 34.7s | 16.8s |

And the fraction of dropped XP that ever reaches the player:

| Base radius | stand still | walk a straight line | kite wide | kite tight |
|---|---|---|---|---|
| **6 wu** | 60% | **11%** | 15% | 62% |
| **12 wu** | 70% | 25% | 27% | **100%** |
| 24 wu | 93% | 57% | 66% | 100% |

Kills are again **flat across every radius** — 43 walking, 51 kiting, 54 standing.
The dial touches nothing but receipt.

Read the 6 wu row against §0 and against my own note in `jane.md` [20]:

> *Standing perfectly still kills you at ~40s. **Movement is the verb.***

**The game kills you for standing still and starves you for walking.** A player
who does the thing the game is built to teach waits six and a half minutes for
the card that would teach it. That is not a tuning miss; it's the core loop
arguing with itself, and it is worth more than every feature in §13.

At **12 wu** the contradiction resolves, and it resolves *into a skill*: kiting
tight over your own kills collects 100%, kiting wide collects 27%. Staying near
your dead is now something the player learns to want. That is the rule §6 opens
with — *you collect what you can see* — finally doing work, because the lantern
is 14 wu and 12 wu is what you can see.

And **Magnet stops being a stat and becomes a verb.** ×1.12 → ×1.96 carries the
radius from 12 wu to 23.5 wu, which is precisely the 24 wu row: wide kiting goes
27% → 66%. The passive's whole promise is *reaching past what you can see*, and
now the numbers say it out loud.

This was found by playing the first minute instead of building the twentieth.

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

> ⚠️ **Superseded 11.07 — ASCII-specific, kept for the record.** The problems
> this section solves (readability against a dark field, a floor that shows
> its history) still exist in the space skin; §15.3 restates the laws for a
> pixel decal layer instead of an ANSI glyph layer. Don't implement against the
> glyph mechanics below for anything new.

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

Three rules, not negotiable, because breaking them makes the game unreadable no
matter how good the art is:

1. **The floor may never be brighter than the things standing on it.** Fresh gore
   was `R` (`#ff3b3b`), brighter than most enemies. The XP mote was `b`
   (`#2c4bd8`), luminance **0.105 against the blood's 0.247**. The mote was
   literally dimmer than the blood it lay on. It didn't *look like* it went under
   the blood — perceptually, it went under the blood.
2. **A glyph means one thing, and a hue means one thing.** `*` was the Blood
   Wisp, *and* gore aged 20–40s, *and* the bolt from your starting weapon. `%`
   was gore *and* the Beggar. `.` was gore *and* Cinder Trail's embers.
3. **Nothing an enemy is made of may be brighter than an XP mote.** *Added
   2026-07-10, from a frame dump.* Rule 1 only ever policed the floor. It never
   policed the horde, and the horde is where the brightness actually was.

### The luminance ladder

Relative luminance, `0.2126R + 0.7152G + 0.0722B`. This is the whole of rule 3
and it is checkable by machine, which is the point.

| Layer | Luminance | Owns |
|---|---|---|
| **The player** | **1.00** | `@`, bright white `W`. Sole occupant. |
| XP | 0.74 | bright cyan `C`. Must be findable in blood. |
| Enemies | **≤ 0.55** | grey `e`, bone `s`, and the hues below |
| Ground scatter | 0.26 | |
| Gore | ≤ 0.15 | |

**What I found when I measured it.** Every mob's head was masked `w` — plain
white, `#c7c7c7`, luminance **0.78**. That is *above the XP* and a hair under the
player. The Wight was `w` across all fifteen cells of its body. So at 0:30, when
twelve Grave Rats arrive, twelve rat heads were the brightest objects on the
field after the `@` — brighter than every mote they were standing on. The owner
said *"XP is hard to see"* and we both looked at the floor. Half of it was the
horde.

Mob heads are grey now. Nothing in `sprites/mobs/` masks `w` or `W`.

**Elites and the boss are the licensed exception.** The Gravewarden's eyes are
bright yellow `Y` (0.93) on purpose. There is exactly one of it, it has a health
bar over its head, and it is the thing you are supposed to be looking at. An
exception you can name is a design; an exception you can't is a bug.

**The palette, by owner:**

| Hue | Belongs to |
|---|---|
| bright white `W` | **the player**, and nothing else, ever |
| bright cyan `C` | **XP**, all three tiers |
| bright yellow `Y` | reward — gold, chests, and the Gravewarden who drops them |
| bright red `R` | the Blood Wisp, and the Countess |
| bright green `G` | healing |
| bright magenta `M` | the Stalker's eye, and nothing else — you should feel the hue before you read the shape |
| grey · bone · grey · yellow · grey · red | ghoul · rat · wight · rattlejack · stalker · bat |
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

> ⚠️ **Superseded 11.07 — the alphabet law (`@ / \ |`, and the shape-language
> table) is ASCII-specific and does not apply to PNG sprites. §15.3 restates
> "the player must never be lost" and "size is threat" as silhouette/colour
> rules for the space roster. §15.2 is the current bestiary mapping.**

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
| `3×1` | **Grave Rat** | 2 | 14 | 2 | 0:30 | Packs of 12+. Dies to a stiff breeze. Scurries. |
| `3×1` | **Bat** | 5 | 26 | 3 | 2:00 | Faster than you. Sine-wave drift, so it *misses*. Wings flap. |
| `3×3` | **Ghoul** | 10 | 9 | 4 | 0:00 | Walks straight at you. The bread and butter. Shambles. |
| `3×2` | **Rattlejack** | 16 | 11 | 6 | 8:00 | On death, splits into two Grave Rats. |
| `3×2` | **Blood Wisp** | 12 | 16 | 5 | 12:00 | Ignores enemy collision. Floats through the pile. |
| `5×3` | **Wight** | 40 | 6 | 9 | 4:00 | Slow, tanky, hits hard. Advances in a line. |
| `5×3` | **Stalker** | 30 | 18 | 12 | 14:00 | **Invisible outside your light.** Rare, deadly, telegraphed by a `?` at the light's edge one second before it enters. |
| `9×5` | **Gravewarden** *(elite)* | ×20 | 7 | 16 | scripted | Bold, bright, HP bar above. Drops a chest. 5:00, 10:00, 15:00 (×2). |
| `28×11` | **The Countess** *(boss)* | 9000 | — | 25 | 19:00 | See below. |

### The Warden's alphabet

*Added 2026-07-10. §0 item 4 — "you can see **you**" — was failing, and this is why.*

**The characters `@` `/` `\` `|` belong to the player. Nothing else in the game
may be drawn with them.**

I wrote "the player must never be lost" in this section weeks ago and then drew
seven of the nine mobs out of the player's own strokes. The Ghoul was `\o/` over
`/ \`; its bottom row was *character-for-character identical* to the player's.
The Bat was `\v/` — and a Bat moves at 26 wu/s, so the thing crossing the
player's sprite most often in the whole game was made of the player's limbs.

Here is a real frame, three ghouls closing on the `@`, before and after:

```
   ░▒░   \o/ ░              ░▒░   (o) ░
         /o/o\"                   (o(o)"
   ▒ @//o\|| ░              ▒ @((o))) ░
      /|\|||                   /|\())
      ./"\                     ./"\
```

John already draws the player last, on top of everything. It bought us nothing:
**drawing on top does not separate you from a crowd that is made of you.** In the
left-hand frame the `@` has ghoul limbs welded to both shoulders and you cannot
find yourself. In the right-hand frame `/ \ |` occur five times and all five are
the player.

Each family of monster gets its own shape language instead, and the language
survives with the colour switched off — which is the actual test:

| Family | Alphabet | Reads as |
|---|---|---|
| **The Warden** (and Ashling, Beggar) | `@ / \ \|` | upright, straight strokes, symmetric |
| **Rotting flesh** — Ghoul, Blood Wisp | `( ) o *` | round, sagging, bloated |
| **Bone constructs** — Wight, Gravewarden | `[ ] _ = o` | rigid, armoured, does not sag |
| **Vermin** — Rat, Bat, Rattlejack | `- = ~ ^ v x , o` | low, quick, horizontal |
| **Spirits** — Stalker | `^ ~ ( ) 0` | long-limbed, reaching |

The Ghoul's `( )` and the Wight's `[ ]` are the same grey and the same posture at
a glance — soft versus rigid is the entire difference, and it is the difference
between a thing you walk through and a thing that ends you.

**And the lookalikes are reserved too.** `│` (U+2502) is `|` to the eye, and
`╱ ╲ ⁄ ∕` are `/ \`. A rule that only bans the ASCII codepoints is a rule you can
walk around without ever breaking. The reserved set is the four characters *and
anything that renders like them*. (Zero violations across all 51 art files today —
I checked before writing this down, not after.)

**Sprites larger than 5×3 are exempt.** The Countess is 28×11; size has already
told you what you are looking at. An exception you can name is a design.

*John: this is two `assert`s in a test, and I'd rather the build caught me than
the owner did. See `john.md`.*

Rules that keep this readable at 220 enemies:

- **Size is threat.** A player must be able to read danger from silhouette alone,
  at a glance, with no colour. Chaff is small. Tanks are big.
- **Every mob animates**, minimum 2 frames. A field of 220 static sprites is a
  wallpaper; a field of 220 breathing ones is a horde. This is most of what the
  owner is asking for.
- **Sprite size is cosmetic. The hitbox is a circle in wu** — the `hit_rad`
  column of `glyphs.tsv`, never the sprite's bounding box. Big sprites must not
  become unfair sprites: the 9×5 Gravewarden gets a torso, not a reach.
- **The player's hitbox is smaller than the player.** 1.2 wu inside a 5×5 sprite.
  Getting hit should feel like being *caught*, not like being *near*. Every
  survivors game that feels good cheats here, and cheats in the player's favour.
- **Draw order is by world y**, so the horde overlaps like a crowd rather than a
  spreadsheet.
- **The player must never be lost.** The `@` at the player's heart stays the only
  bright-white glyph in the game — *and* the only `@`, and the only thing built
  from `/ \ |`. Colour alone was never enough: at 220 enemies the `@` is one cell
  in nine, and the eye finds the *shape* first.

Machine-readable stats: `assets/glyphs.tsv`. Art: `assets/sprites/mobs/*.txt`,
`assets/sprites/elites/*.txt`, `assets/sprites/countess.txt`. The `glyph` column in
`glyphs.tsv` survives as the **loader fallback** when a sprite file is missing —
which is exactly how we ship a half-drawn bestiary without breaking the build.

### 10.5 Volume through shading — the Effulgence direction

> ⚠️ **Superseded 11.07 — this whole reshade pass was the right fix for the
> ASCII skin and is now moot: the space pack ships real illustrated sprites,
> so "volume through glyph density" doesn't apply. Kept because the underlying
> principle — a sprite needs to read as a body, not an outline, and the fix
> should never come at the cost of legibility — is exactly the bar the space
> roster has to clear too. See §15.**

*Added 2026-07-10, from owner feedback 22:27: "characters currently look like
stick figures ... I want it to look like an actual game. Take inspiration from
Effulgence RPG." He's right, and I want to be exact about what the fix is and —
more importantly — what it is **not**, so it doesn't quietly break the two laws
that keep the field readable at 220 bodies.*

The old sprites were **wireframes**: `(o)` over `) (` is a ghoul drawn as two lines
with air between them. Air has no weight. What makes Effulgence's ASCII read as
*illustration* and not *diagram* is that its forms are **filled and shaded** — the
eye reads a mass, a volume, a thing with a lit side and a dark side. That is the
whole difference, and it costs us **nothing we can't afford**:

> **Volume is glyph DENSITY, not colour brightness.**

The luminance ladder (§9) caps what an enemy is *coloured* — grey `e`, bone `s`,
never brighter than an XP mote. It says nothing about how much *ink* a glyph puts
in its cell. So a ghoul's gut can be a solid `▓` and a Wight's core a `█`, both
still dim grey, and suddenly they have bodies. The ladder and the illustration
were never in conflict; I just hadn't used the second axis.

**The density ramp** (darkest/most-ink → lightest, all available to enemy fill):

```
█  ▓        solid mass, a shaded core
▐ ▌ ▄ ▀     half-blocks: one-sided volume, an edge caught in light
# %         hatching / texture (the Countess's mouth, a Gravewarden's rivets)
[ ] ( ) { } box- and bracket-work: the family silhouette, the OUTLINE of the mass
```

**Reserved away from enemy fill, and why** — this is the trap:

- **`▒` and `░` belong to the gore layer** (§9, the decals). Light shade is the
  floor's texture. An enemy made of `░` would be indistinguishable from the blood
  it's standing in. Enemy shading is `█`/`▓` and the half-blocks; the two lightest
  shades are the ground's, and the division is total.
- **`@ / \ |` (+ lookalikes) stay the Warden's** (§10). A cloak drawn in `█` and
  `▐▌` gives the *player* his volume too, without borrowing anyone.
- **Digits, `·`, `.`** as always (§14, §9): numbers, XP, retired.

**Detail is budgeted by how many are on screen and how long you look at one.**
This is the rule that keeps 220 shaded bodies from becoming 220 smears:

| Tier | On screen | Detail budget |
|---|---|---|
| **Hero** — player, elite, boss | 1, always/long | Genuinely illustrated. The player is 5×5, the Countess 28×11. This is what the owner looks *at*. |
| **Bulk** — Ghoul, Wight | dozens | A shaded core + family silhouette. One `▓`/`█` mass cell earns its keep. |
| **Swarm** — Rat, Bat | scores | Stays small (**size is threat**, §10). Volume is the *pack*, not the individual: a rat gets one `▄` of back, no more. |

**Mass is for the corporeal.** Flesh and bone get bodies; **spirits and spindly
things stay thin on purpose.** The Blood Wisp is two glyphs and a flicker — weight
would stop it being a spirit — and the Stalker's horror is the airy *reach* of its
limbs, which block-shading would make squat. When a sprite's whole read is that it
*lacks* substance, shading it is the bug, not the fix. Both files say so at the top.

So the field doesn't get busier — it gets *heavier*. The same silhouettes,
the same colours, the same head-count, but the bodies have mass. The portraits in
`portraits/*.txt` already draw at this fidelity (20×8, shaded); the field sprites
were just never brought up to meet them. That's the work, and it's §0 core polish,
not a new feature.

*Rollout (all 10.07): player 5×5; Ghoul, Wight, Grave Rat, Bat, Rattlejack given
bodies; Blood Wisp and Stalker left deliberately thin; Ashling and Beggar up to the
Warden's fidelity; the title screen illustrated. Hero tier done too — the
**Gravewarden** is a riveted, helmed golem now, and the **Countess** is a
membrane-winged vampire with a fanged, hollow-eyed face and a crimson gown (below).
The whole character-facing surface is on the new fidelity; only the dawn/death/
crossroads banners remain, and those are FIGlet, not figures.*

### The boss: THE COUNTESS

*Renamed 11.07 to **THE OVERLORD** — see §15.2. This section's fight design
(phases, attacks, telegraphs, the 19:00 trigger and clock-freeze) is mechanics,
not skin, and stays exactly as written; only her name, art, and pronoun change.
`countess.tsv` keeps its filename for now — renaming a data file both of us
read is a coordination cost with zero gameplay upside, so it's staying put
until John has a reason to touch it anyway.*

*Data: `assets/countess.tsv`. Art: `assets/sprites/countess.txt` (**28×11**, 2
frames @ 3fps — the wings flap; the body is column-locked so she doesn't wobble).*

The **largest** creature in the game — nine times the Gravewarden and forty times
a ghoul. Anchored at her centre, drawn above all decals, always at full brightness.
*(This line used to say "16×5" and "the one multi-cell creature in the game." Both
were true before the owner overruled the one-glyph rule on 09.07. Everything on the
field is a multi-cell sprite now; she is merely the biggest.)*

She is the **named exception to the Warden's alphabet** (above). Her wings and body
use `/`, `\` and `|`. At 28×11 nothing about her can be confused with a 3×3 player,
and the rule that protects the `@` in a crowd has no crowd to protect it from: when
she is on the field, the ambient director has stopped and she is the only thing on
it. Size disambiguates her, which is the exemption exactly as §10 states it.

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

…**for everything after 1:30.** The first ninety seconds are hand-authored, and
they have to be. See "The first minute" below.

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

### The first minute — `open` rows

*Added 2026-07-10, after checking §0's last unverified acceptance criterion.*

§0 promised: *"The first minute has a shape. One ghoul. Then three. Then a lull.
The player must feel the tide breathe before it drowns them."* I said I'd verify
each criterion by hand. This one had **never been true**, and it could not have
been:

| t | target |
|---|---|
| 0:00 | **3.00** |
| 0:30 | 3.86 |
| 1:00 | 5.43 |

You don't meet one ghoul. You're dropped in front of three, and over a minute
they become five. And there is no lull *anywhere in the run*, because
`(t/1200)^1.5` is **monotone increasing by construction**.

> **A closed loop chasing a monotone target cannot exhale.**

I specced breathing, then specced a curve that forbids it, and the two lived four
hundred lines apart in the same file for a week. This is the same shape of mistake
as the alphabet (§10) and the ladder (§9): the rule was fine, the *thing the rule
was about* was somewhere else, and only a dump of the real numbers found it.

The closed loop is right for minute six. It is the **wrong instrument for minute
zero**, where every enemy on screen is a sentence in a tutorial nobody is reading.
So the opening is authored by hand, in `open <mm:ss> <headcount>` rows, linearly
interpolated, handing off to the formula at 1:30 (`formula(90s) = 7.46`, and the
last row is 7 — the player never feels the author let go of the wheel):

```
0:00   ONE ghoul. It walks at you. You do not aim, and it dies.
       That is the entire game, taught in eight seconds, with
       nothing else on the screen.
0:14   Three. Now you learn that killing was never the constraint.
       Position is.
0:28   One. THE LULL.
0:30   Twelve rats — the `beat` swarm lands inside that silence.
0:38   And the tide comes back, and never really leaves.
```

The lull is the most important row in the table. **Silence is what makes the next
noise loud**, and it is the only moment before 17:00 where the player is given
room to notice that he is enjoying himself.

One rule this depends on absolutely:

> **The target is a spawn gate, never a despawn order.** Above target, the
> director spawns *nothing*. It never kills to get there. The lull is not "eight
> enemies vanish." The lull is *"you kill the three in front of you, and for six
> seconds the dark does not send more."*

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

**Level-up screen.** Field dims. Three cards. Each card shows the **card art**
from `assets/cards/`, a name, and a one-line effect. It is the only screen that
stops the game, so it is the only screen the player *reads*. It must land in two
seconds.

**The `note` column of `weapons.tsv` and `passives.tsv` is player-facing copy.**
`upgrades.ts` prints it verbatim on the card. This was not written down anywhere
until 10.07, and so it rotted: a player offered the Wisp Lantern was reading

> `ax = orbit radius, ay = hit radius, pspeed = deg/s`

and a player offered The Chain was reading `no longer the starting weapon.` Both
tables now carry real copy, and both headers say what the column is for. *Any
field the player can see is copy, and copy is mine.*

**A card says what it does, then what it costs you to know.** In that order:

```
        ┌──────────────┐
        │   (art)      │   WISP LANTERN            NEW WEAPON
        │              │   A wisp orbits you, burning whatever it touches.
        └──────────────┘   6 damage · 1 wisp
```

- **Line 1 is the sentence.** Always. It is why the player picks the card.
- **Line 2 is the numbers**, dimmed. It is how the player picks *between* two
  cards they already understand.

Today a passive card shows only `cooldown -6%` and a weapon level-up shows only
`9 damage · 1.34s cooldown`. Numbers with no sentence. A first-time player has
no idea whether `cooldown -6%` is good. **Every card gets its sentence** — for a
passive, the `note`; for a weapon level, the `note` if the level changes what the
weapon *does*, and otherwise the weapon's own one-liner. The numbers stay, dim,
underneath. (Requested of John 10.07.)

### The card was 24 columns wide and my sentences were forty characters long

*Found 10.07, second pass, and it means the copy I fixed above never reached the
player intact.*

`app.ts:504` calls `truncate(card.effect, cardW - 4)`. The card is 24 columns, so
the sentence gets **20 characters** and the rest is a `…`. **Seventeen of the 28
weapon notes were cut, including every single level-1 introduction** — the one
line whose entire job is to explain a weapon the player has never seen:

```
   Fires a seeking bolt at the nearest enemy.   ->  "Fires a seeking bo…"
   A wisp orbits you, burning what it touches.  ->  "A wisp orbits you,…"
   Moonlight falls in columns near you.         ->  "Moonlight falls in…"
```

Every passive note was cut too. `Blunts every blow. A hit always draws at least a
little.` became `Blunts every blow. …`, which is not even wrong, just amputated.

**Three of my columns get truncated, not one.** The audit:

| Site | Column | Budget | Was |
|---|---|---|---|
| `app.ts:504` level-up card | `weapons.tsv` / `passives.tsv` `note` | 20 | up to 62 |
| `app.ts:543` evolution slam | `evolutions.tsv` `effect` | 24 | up to 44 |
| `app.ts:458` Crossroads list | `crossroads.tsv` `note` | 24 | up to 111 |

And `evolutions.tsv`'s `effect` had exactly the disease §12 was written to cure —
it is player-facing and it read **`bands on BOTH sides, always, no facing check`**,
shown at the payoff moment of the entire run, cut to `bands on BOTH sides, a…`.
"No facing check" is a sentence about our code. `crossroads.tsv` was telling the
player that Revival is `expensive on purpose`, which is a note from me to John.

#### The rule: 36 characters, and it must survive two lines of twenty

All 58 strings are rewritten to that budget and checked by wrapping them. Why 36:

- **The terminal card cannot get wider.** `MIN_COLS` is 80 and the layout is
  `3 × 24 + 2 × 3 = 78`. Twenty-four columns is forced by the smallest terminal
  we support, so on a terminal the sentence must **word-wrap to two lines of 20**.
- **The browser card should not stay this narrow.** §5.0 targets a **180×60**
  canvas, and the owner plays in the browser. Three 24-column cards use 78 of 180
  columns — the cards are sized for a terminal nobody is playing on. At a card
  width of 40 every sentence in the game fits on one line.

The budget is a gift, not a tax. `Fires a seeking bolt at the nearest enemy.`
became `A bolt seeks the nearest enemy.` and it is better copy. Forty characters
was never a sentence a player reads in two seconds; it was me writing prose into a
spreadsheet cell because nothing pushed back.

### The card was also printing John's variable names, and no `note` could fix it

The third pass found the worst one, in the string the cards *generate* rather than
the string I write. `upgrades.ts` builds a passive's effect line as
`` `${def.stat.replace(/_/g, ' ')} +${value}` ``. Here is a real hand:

```
   [+] REGEN    NEW          [»] ARMOUR   NEW         [~] GROWTH   NEW
       hp per sec +0.25          flat reduce +1           xp gain +6%
```

`hp_per_sec`, `flat_reduce` and `xp_gain` are members of John's `StatName` union.
They are not English. All twelve passives do it — `move speed`, `pickup radius`,
`revives`, `light radius`.

This is exactly the `weapons.tsv` disease from earlier in this section, and it
survived that fix, because **the string is generated.** Rewriting my `note` column
could never have caught it. It's the same lesson as the Warden's alphabet: the
thing that fails is never quite the thing you were looking at.

`passives.tsv` gains a **`label`** column (index 13, appended so nothing shifts) —
the human name of the quantity. `flat_reduce` → *armour*. `hp_per_sec` → *HP per
second*. `xp_gain` → *XP gained*. At their widest levels, all twelve fit the
20-column card; the longest is `movement speed +40%` at 19.

**Jane → John (10.07):**
1. **Word-wrap, don't truncate**, at all three sites. Two lines, `cardH` grows by
   one. A `…` in the middle of a sentence is the game admitting it lost.
2. **Card width should follow the field**, clamped to `[24, 40]`. At 80 columns
   nothing changes; at 180 the cards breathe and every sentence lands on one line.
3. The evolution box (28 wide) should be **44** — it is the payoff screen, it is
   drawn alone, and it can afford it.
4. **Read `passives.tsv`'s new `label` column** instead of `stat.replace(/_/g,' ')`.
5. The weapon fallback `` `${dmg} damage · ${cd}s cooldown` `` is 25 characters and
   truncates mid-word at `9 damage · 1.34s co…`. On the dimmed numbers line, drop
   the trailing word: **`9 damage · 1.34s`**. The `s` already says it's a time.

That, plus the sentence-first rule above, is the whole level-up screen — the only
screen that stops the game, and therefore the only screen the player *reads*.

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

## 14. Juice

*Added 2026-07-10. This is §0 work — the core, not content — and it is the direct
answer to the owner's oldest complaint, which we have not actually answered yet.*

> *"I get that we ordered an ASCII game, but c'mon, singular characters walking
> around… is this the 1960s still? ASCII art can be made much more impressive
> nowadays… so that Jane can unleash her inner creativity and have smoother
> animations."*

We read that as "draw better sprites," and we did, and he was right anyway. The
sprites were never the problem. **Nothing in this game reacts.** You hit a ghoul
and the ghoul does not notice. It dies and it simply stops being there. A `g`
that flinches when you hit it and pops when it dies is more impressive than a `g`
drawn in three colours, and it costs no art at all.

Juice is the difference between reading a battle and being in one.

### The Juice Law

Juice is the **fourth** thing on the screen. The first three — you, the XP, the
thing about to touch you — already have a law (§9's luminance ladder), and juice
does not get to break it just because it's pretty.

> **Juice may never take a cell that would otherwise show the player, an XP mote,
> or an enemy; and it may never be brighter than the thing it is celebrating.**

One licensed exception, bounded to 60 ms: the hit flash. Sixty milliseconds
cannot be hunted through. A permanent brightness can.

### Everything is in seconds. Nothing is in frames.

The owner asked for 120fps. A flash written as *"two frames"* runs twice as fast
at 120 as at 60 — that is exactly why old ports feel wrong on new hardware. Every
constant lives in `assets/juice.tsv` in **seconds**. If the code ever says
`framesLeft--`, the feel is now a function of the frame rate and the table is a
decoration.

### The eight effects

Numbers are in `assets/juice.tsv`; this is the reasoning behind them.

1. **Hit flash** — the enemy lifts toward white for 60 ms. Glyphs don't change,
   the sprite doesn't move. *A flash that changes shape reads as a different
   enemy arriving, not as this one being hurt.* This is the single highest-value
   item in the section.
2. **Damage numbers — at most one per enemy, and it accumulates.** See below.
3. **Death pop** — one frame of the enemy's own glyphs in white, then the decal.
   Costs nothing; it is the frame that sells the kill.
4. **Hit stop** — 50 ms of frozen simulation when *the player* takes damage.
   Rendering continues. Never on enemy hits: at 40 kills/sec the game would
   judder permanently and nobody would be able to say why it felt bad.
5. **Screen shake, in pixels** — see below.
6. **Embers** — the lantern throws sparks that rise, cool, and die. They damage
   nothing and are drawn *under* everything. Spawned out to the **current** light
   radius, so Lantern Oil visibly widens the shower. *A passive you can see is
   worth more than a passive you can read.*
7. **Mote absorption trail** — a two-cell trail, not more brightness. §9's
   doctrine: motion is free contrast.
8. **Level-up** — the `@` burns gold for 120 ms and the world stops for 80. No
   expanding ring: every glyph a ring could use is already owned by the bolt, the
   mote, or the gore. The card is about to fill the screen anyway.

### Why one number per enemy

**I have already made this mistake once, with gore.** We pushed one decal per
kill; two hundred kills on one patch stacked two hundred decals and the floor
saturated into a solid red sheet. The owner reported it as *"so many red things
on the ground it's hard to make out."* One number per damage **event** is that
same bug, in digits — at 14:00 it's ~200 enemies × 4 weapons × their cooldowns,
and the field disappears under its own applause.

So a number is born on an enemy's first damage and rises. Damage taken while it
lives is **added to it**, its life resets, and it gets **brighter**. Two hundred
rats give you two hundred numbers. A rat hit eleven times gives you *one* number
that climbs to 34 and glows.

That brightness-by-accumulation is also why this game gets a crit *feel* without a
crit *system*. It doesn't have one. **Don't build one** — §0, feel before content.

Two more rules: **a kill prints no number — the corpse is the number** (which
halves the count on screen exactly when it's most crowded), and numbers never
draw over the player's own 3×3.

### Why shake is measured in pixels

A character grid can only shake by a whole cell, and a cell is 1 wu — that's an
earthquake. **This is the first thing we get back for leaving the terminal:** the
canvas can offset the field by a fraction of a cell. So amplitudes in `juice.tsv`
are in cells and they're all less than one.

The **field** shakes. **The HUD does not.** A health bar that jitters is a health
bar you can't read at the exact moment you need to read it.

And note what is *not* on the trigger list: ordinary hits. Four shakes in a
twenty-minute run — Countess charge, Countess landing, your revival, your death.
A screen that shakes constantly is a screen you stop reading.

### The alphabet, extended: everything the player emits is the player

§10's Warden's alphabet reserved `@ / \ |`. It was incomplete, and a frame dump
found the hole:

> The Blood Wisp was drawn `(*)` over `'.'`. The starting bolt renders as a `*`
> that fades to a `.`. So from **12:00** — the exact minute the field is fullest —
> the one enemy that ignores enemy collision, and is therefore the one thing that
> reaches you *through* the pile, was drawn out of the projectile you fire at it.

Mistaking your own bolt for an incoming enemy is a failure of §0 item 4. **A bolt,
an ember, a band, a ring — the things you fire are as much "you" as the `@` is,
and no enemy may be drawn with them.** The wisp moved, not the bolt: the bolt is
there from second zero of every run and the wisp arrives at 12:00 in some of them.
Blood spirits speak in **braces** now, and the shell flickers.

The full reservation:

| Reserved to | Characters |
|---|---|
| The Warden | `@ / \ |` + lookalikes `│┃╎┆⎸｜╱╲⁄∕` |
| The Warden's weapons | `*` bolt · `°` Cinder ember · `═ ─` band |
| The numbers layer | the digits `0`–`9` |
| XP | `·` the mote |
| **Retired** | `.` — **nothing in the game draws a baseline dot** |

`.` is retired because at a glance it *is* `·`, and `·` is XP, and the owner has
already told us once that he cannot find his XP. The bolt used to shrink to `.`
as it died; it now fades in colour and keeps its shape. **Fading is what the
canvas is for.** Two sprites paid for this: the wisp, and the Stalker, whose eye
was the digit `0`.

Sprites larger than 5×3 are exempt, as always — the Countess keeps her `.` and her
`'`. At 28×11 nobody has ever mistaken her for an ember.

### Acceptance — how I'll check it

- Hit a ghoul with Nova at 0:05. **It flinches.** Take a screenshot mid-flash and
  the ghoul is still a ghoul, same shape, same place.
- At 14:00 with four weapons, **count the numbers on screen.** If it's over 40,
  or if any enemy carries two, it's wrong.
- Stand still at 0:00. **Sparks rise off the lantern** and not one of them is
  brighter than a mote, and not one is inside the player's cells.
- Walk over a mote. **It streaks to you.**
- Take a hit. **The game stops for a twentieth of a second** and the screen does
  not move.
- Play a whole run without meeting the Countess. **The screen never shakes.**

---

## 15. THE SPACE PIVOT — 11.07, 00:03

Owner directive, verbatim: *"A customer has just decided that ASCII art is not
the way to move forwards. They have purchased a wide variety of space game
assets ... and would want to redirect the art direction of the game to use
these and move the setting to space."* Plus, same note: *"there are no sounds
and that makes the game unfun to play."*

This is a different order of change from 22:27's "stick figures, take
inspiration from Effulgence" — that was a reshade within ASCII, and I did it
(§10.5). This is the owner overruling the *medium* itself, twelve hours after
I finished defending it. Read literally, it's a **reskin, not a redesign**:
the licensed pack replaces the glyph art and adds audio; it does not touch
whether the game is fun, and nothing about "move the setting to space" asks me
to re-derive the loop.

**What survives untouched:** §3 (core loop), §4 (the clock), §7 (weapons —
their *shapes*, not their flavor names), §8 (XP/level/evolution), §11 (spawn
director), §13 (crossroads), §14 (juice — hit flash, damage numbers, hitstop,
shake are colour- and medium-agnostic; every value in there is already
"seconds," not "ANSI cells"). Twelve days of tuning doesn't get thrown out
because the paint changed color, and the owner hasn't asked for that.

**What's changing:** the sprite layer (glyph `.txt` art → the purchased PNG
pack), the world's dressing (graveyard/gothic → derelict debris sector), and —
new, not a reskin — **sound exists now.**

### 15.1 The new pitch

See §1 (updated in place) and §6 (updated in place). Same beats, new coat:
lone pilot, one automated ship, fixed 20-minute clock, boss fight at 19:00,
extraction instead of dawn-on-the-calendar.

### 15.2 The roster — asset survey and mapping

I read the whole pack (`assets/space-assets/`, ~20 top-level folders: ships,
towers/structures, asteroids, a weapon-effects pack, a GUI kit, and
`!SFX + MUSIC!`). This is the mapping I'm building against.

**Curation convention (owner's call, 11.07):** the raw pack is ~600MB and
stays out of git entirely (`.gitignore`) — it's a vendor drop, not something
either of us edits. When a pick below is actually decided, not just surveyed,
I copy *only that file* into `assets/space/`, which mirrors the roster
categories (`ships/ranger/`, `mobs/spacebug/`, `backgrounds/`, `audio/`, more
as phase 3/4 land) and **is** tracked. John: everything under `assets/space/`
is real, decided, and safe to build a loader against; nothing under
`assets/space-assets/` is — that folder won't exist on your checkout unless
you also have the vendor pack locally, so never reference it from code.
Picks curated so far, this pass: the full `Galactica Ranger` set, all 5
`spacebug_*` colour variants, one starfield background, and the 8 named
audio tracks from §15.4. Elites, the Overlord, weapon effects, and the GUI
kit are surveyed below but **not yet curated** — real per-file decisions,
phase 3/4 (§15.6).

| Old (ASCII/gothic) | New (space) | Source | Note |
|---|---|---|---|
| The Warden (player) | **The Ranger** | `Galactica Ranger/` (15 numbered variants + an `_Extreme`) | Numbered files read like a fit-out ladder, not animation frames — my working read is they're colour/loadout skins, not walk-cycle frames. Flagging as an assumption for John (§15.5); if his loader wants frames instead I'll pick differently. |
| Ghoul / Wight / Grave Rat / Bat / Rattlejack (5 chaff tiers) | **Spacebug**, 5 colour variants | `ArtBoard Special Units/spacebug_{blue,purple,brown,green,greenblue}.png` | One base silhouette, five palette swaps — this *is* the old "same shape language, tier by colour" law, already built by the vendor. Cleanest 1:1 in the whole pack. |
| Elites (Wight-tier armoured, Gravewarden) | **Crusader** (7 colour variants), **Iceblade** (5), **Battlecruiser** (5 "shiny" variants), **Big Berta**, **Missile Launcher** | `ArtBoard Special Units/` | More elite variety than the old bestiary had — I'm not using all of them at once; picking a subset per §15.6 phasing so the field doesn't turn into a toy box. |
| The Countess (boss) | **The Overlord** | `OverLord_Nightmare/` — 3 base frames (`OverlordNightmare6Cropable1_0{1,2,3}`) + 3 `NightmareB_0{1,2,3}` + a `Samples/` set that includes `OverlordEvoSample_0{1,2,3}` | The `Evo` samples are a gift: a visual second form for the boss fight is already drawn. Proposing a **phase 2 at 50% HP** that swaps to the Evo art — mechanically a new beat, art-wise it's free. Written as a proposal, not yet in `countess.tsv` — that's John's file to add a phase trigger to, once he's built the phase-swap plumbing (or tells me it's not worth the complexity right now — §0's "polish the core first" cuts both ways). |
| Gore/decal floor (§9) | Wreckage/scorch decals, plus asteroid clutter as terrain | `Asteroids, Meteors/` (28 stones × 2 render styles) | Same "floor remembers" law (§15.3), new sprite source. Asteroids double as passive field texture — not hazards unless we decide we want that later; that'd be a mechanics change and isn't in scope today. |
| Player weapon fire (`*` bolt, Cinder `°`, Chain `═`) | Bullets / laser beams / beam-jet effects | `!WEAPON PACK!/Weapons/{Bullets, LaserBeams (for loop compatible), Beam Jet, Lunar, MainWeapons}/` | §7's weapon *shapes* (radial nova, chain, orbit, etc.) are unchanged; each gets a matching effect sprite from here. Full per-weapon table is phase 3 (§15.6), not today — seven weapons and their evolutions is real drawing-adjacent work and I'd rather do it right than fast. |
| — (new) | Backgrounds | `50+ Repeat Space Backgrounds 200x200 PNG/` + `50+ Repeat More Backgrounds.../` | Tileable, for the field backdrop the ASCII game never had (it had `·`/void). |
| — (new) | Menu/HUD chrome | `!GUI!/` (buttons, arrows, panel pieces) | For the level-up cards, crossroads shop, and title/death/dawn screens — replaces the FIGlet banners §10's rollout note left for later. |

**Deliberately not routing into the core roster (yet):** the whole
`!TOWER DEFENSE OPTIONS!` folder (walls, gates, power stations) — this is a
tower-defense sub-pack bundled into the same purchase, not survivors-genre
material, and pulling it in would be scope creep §0 explicitly told us to stop
doing. Parking it; flag if the owner asks for base-building.

### 15.3 The translated laws (§9/§10's principles, not their glyphs)

1. **The player must never be lost.** Was: the only bright-white glyph, the
   only `@`. Now: the Ranger gets a reserved silhouette + a colour treatment
   (glow/outline) nothing else in the roster uses. Mechanism changes, law
   doesn't — this is John's call on how a canvas draws an "always-on-top,
   always-distinct" treatment; my ask is in §15.5.
2. **Size is threat.** Still true, still free — the pack's own scale
   differences (Spacebug small, Crusader/Battlecruiser bigger, Overlord huge)
   already encode this without me doing anything.
3. **Volume/mass reads as a body, not an outline.** Moot as stated (§10.5 was
   solving a glyph-density problem) — the pack ships fully rendered sprites,
   so this constraint is automatically satisfied. Nothing to enforce.
4. **The floor remembers, and stays under the sprites' brightness.** Decal
   layer (wreckage/scorch) must stay visually duller than any live sprite,
   same as gore had to stay duller than a mob. Same law, new palette.
5. **XP must outshine the ambient field.** Was the luminance ladder pinning
   mob colour under an XP mote's brightness. Now: whatever the XP pickup
   sprite/glow is, it needs to read louder than Spacebug-tier chaff at a
   glance, at 220-on-screen density. This is the one law I'd call **at risk**
   until I've actually picked/drawn an XP pickup — flagging it now so nobody
   ships a swarm that buries it the way the owner already complained about
   once (09.07 feedback: "XP is hard to see").
6. **Damage numbers stay a reserved digit layer**, unaffected by the skin.

### 15.4 Audio — new, not a reskin

The pack's `!SFX + MUSIC!/Audio/` has three folders: `SFX/` (Space/Robotic/
Futuristic, and two 8-bit sets), `Simple Music/` (8 short tracks — `DeepSpaceA`/
`DeepSpaceB`, three `DynamicFight_{1,2,3}`, `DubStepDropBoom`, two
`RhytmicBounce{A,B}`), and `Infinite Loops (Background Music)/` (~35 ambient
loops, including `dark`/`dark2` and ~30 numbered `bgm_*`).

Proposal — deliberately wired to systems that already exist, so this isn't a
new tuning surface:

- **Ambient bed:** `DeepSpaceA`/`DeepSpaceB` loop under the early game,
  crossfading toward a `DynamicFight_*` track as the spawn director's target
  population (§11) climbs. The music escalates on the same curve the horde
  already does — no new director logic, just a second consumer of a number
  that's already computed every frame.
- **Boss beat:** `dark`/`dark2` takes over at 19:00 when the clock freezes;
  `DubStepDropBoom` as the one-shot for the freeze-frame moment itself —
  this is the audio half of the hitstop juice beat (§14) that already exists
  for the player-hit case, reused for the boss-arrival case.
- **SFX split, so combat and menu don't sound identical:** the Space/Robotic/
  Futuristic set for weapon fire, hits, and deaths (fired from the same juice
  hook points §14 already has: `hit_flash`, death pop, `levelup_flash`); the
  8-bit sets reserved for UI — card flip, crossroads purchase, menu nav.
- Every SFX one-shot should hang off an **existing** juice event, not a new
  parallel event bus. If a moment needs a sound and doesn't have a juice hook
  yet, that's a one-line addition to `juice.tsv`, not a new system.

This is a proposal, not yet a spec John can implement against line-by-line —
I don't own the audio engine choice (Web Audio vs an `<audio>` pool vs
something else is squarely tech stack), so the concrete contract is part of
the §15.5 ask.

### 15.5 The one contract to settle first (again) — the ask for John

Same shape as the original ASCII contract in `assets/README.md`: I own the
art and the mapping, John owns how it loads. Posted in full in `john.md`, in
short:

1. **Sprite loading.** Are the numbered `Galactica Ranger` files frames or
   loadout tiers (my assumption above, §15.2)? Single PNGs per entity, or does
   the pack's `!SHEETS - PNG & PSD!` folder mean some of these are actually
   spritesheets I haven't accounted for? What's the animation contract now
   that there's no `# fps:` header on a PNG?
2. **Coordinate system.** Sizes in `assets/README.md` are all in character
   cells (`5×5`, `28×11`) because that was the ASCII grid. Pixels now — what
   footprint (in wu, §5) does a Ranger/Spacebug/Overlord actually occupy, and
   does that math change now that sprites have real proportions instead of a
   fixed cell aspect (§5.1's "a terminal cell is twice as tall as wide" is
   gone; pixels are square)?
3. **Audio engine.** What plays `.mp3` — and can it crossfade (needed for
   §15.4's ambient-to-combat swell) and layer a one-shot over a loop without
   cutting either?
4. Everything else in the old `assets/README.md` contract (the folder/size
   table, the two ASCII laws) is superseded by this pivot; I'm rewriting that
   file's contract section to point at the new roster once #1–2 above have an
   answer, rather than guess at a shape John's loader doesn't want.

### 15.6 Phasing — this is not a one-pass redo

Twelve days of ASCII art doesn't get rebuilt as pixel art in one sitting, and
§0's standing order is still "polish the core before new work" — a full-cast
reskin done sloppily to hit a deadline would just be a new version of the
stick-figure complaint. So:

- **Phase 1 (now):** this section, the roster mapping, the contract ask to
  John. No engine changes are mine to make.
- **Phase 2:** once John answers §15.5, get one full vertical slice on
  screen — Ranger + one Spacebug tier + one background — as the technical
  proof, same way the original canvas migration (§5.0) proved itself on the
  player and one ghoul before the full reshade.
- **Phase 3:** the rest of the field roster (all 5 Spacebug tiers, elites,
  the Overlord + its Evo phase-2 proposal), then weapon/passive card art.
- **Phase 4:** audio wiring per §15.4.

Nothing here is blocked on the other side finishing first — same rule as
always. I start phase 2's art the moment I've made a reasonable assumption
about #1/#2 above, whether or not John has answered yet, and correct it if
he pushes back.

## Open questions / assumptions I'm running with

Tracked live in `jane.md`. Anything settled gets promoted **into this file** and
mirrored to `meetings.md`.
