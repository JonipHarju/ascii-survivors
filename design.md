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
| Base move | 24 wu/s *(raised from 20, 12.07 — see §15.19)* |
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
| The Warden (player) | **The Ranger** | `Galactica Ranger/` (15 numbered variants + an `_Extreme`) — shipped as `Galactica_Ranger_A.png`, `images.tsv` | Resolved by §15.5: John's loader takes one static image per id, not frames or tiers. The other 14 variants are just unused options now — good raw material for a character-select skin later, not a mechanic today. |
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

### 15.5 The contract — answered, from John's own code, before he'd written a word

I posted three open questions here originally. John was already mid-build when
I went looking (`src/data/images.ts`, `src/assets/imagesource.ts`,
`src/data/audio.ts`, `src/engine/audio.ts`, `src/web/audio.ts`, and the
`images`/`audio` wiring into `gamedata.ts`/`app.ts`/`world.ts`) — the contract
was already answered in working code, just not narrated yet. Reading it
instead of waiting was faster than asking twice:

1. **Sprite loading — answered: one static image per id, no frames, no
   sheets.** `images.tsv` is `id / path / w / h`, one row per sprite id
   (`sprites/player`, `sprites/mobs/<id>`, …), one PNG. It **shadows** the
   glyph sprite of the same id — if the row exists and the image has decoded,
   raster wins; otherwise the ASCII glyph draws, same as always. So my "are
   the 15 numbered Ranger files frames?" question dissolves: they're not
   frames *or* tiers in the current contract, they're just fifteen options —
   I pick one. Used `Galactica_Ranger_A.png`. No animation contract exists yet
   for raster (a real gap vs. the old `# fps:` sprites — noted in todo.md, not
   blocking).
2. **Coordinate system — answered: still isotropic wu, still `WU_PER_ROW=2`,
   nothing about §5.1 changed.** `render.ts`'s `imageFor()` takes `images.tsv`'s
   `w` directly as the column count and divides `h` by `WU_PER_ROW` for the row
   count — i.e. both columns are plain wu, and the engine still draws a wu-tall
   unit as half as many rows as a wu-wide unit is columns, exactly like every
   glyph on the field. My "does the 2:1 cell aspect go away since pixels are
   square" guess was **wrong** — it doesn't, because "cell" was never about
   pixels being square, it's the world's own aspect convention, and that
   didn't change. I sized every row in `images.tsv` by taking each PNG's real
   pixel aspect ratio at a chosen wu width, so nothing I ship looks stretched.
3. **Audio engine — answered: Web Audio, id-keyed, one active loop per id,
   unlimited overlapping one-shots.** `WebAudioSink` decodes and caches per
   path, `play(id)` on a playing loop is a no-op (so `App` can call
   `play('music/theme')` on every restart for free), and one-shots are
   fire-and-forget `AudioBufferSourceNode`s that stack without cutting each
   other — built specifically so 40 simultaneous hits don't fight over one
   channel. **What it does not do yet: crossfade, or hold more than one active
   music id at a time.** My §15.4 ambient-to-combat swell needs both a second
   music id and a call site that watches the director's target population —
   that's a real, still-open code ask, now precise instead of vague. Tracked
   in `todo.md`.

**Shipped against this, this pass:** `assets/images.tsv` (player + the 5
mob-tier ids that have art) and `assets/audio.tsv` (all 13 of `World`'s
`playSfx` ids, plus `music/theme`), both pointing at `assets/space/` — never
`assets/space-assets/`. `npm test` still 142/142 with both tables in place.

**A docstring example pointed at the vendor pack; the actual code doesn't
care.** `images.ts`'s comment path (`space-assets/Top Down SpaceShips/...`)
made it look like `tools/build.ts` expected rows to reference the vendor pack
directly. Read `tools/media.ts` to check before flagging it as a real
mismatch: `copyReferencedMedia` just copies whatever paths `images.tsv`/
`audio.tsv` name, relative to `assets/`, with zero hardcoding of
`space-assets/`. Ran `npm run build` to confirm rather than trust the read —
it copied exactly the 20 files both tables reference, all correctly under
`dist/assets/space/...`. So: no code change needed, the stale docstring
example is the only leftover, and pointing every row at the tracked `space/`
folder (owner's call, §15.2) Just Works with John's existing build tool.

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

### 15.7 The vertical slice, actually looked at — two problems the tables couldn't have caught

`npm test` passing and `npm run build` copying the right files both check
that the *pipeline* works. Neither checks that the result looks like a game.
Ran the real build in a headless browser and looked — the Ranger genuinely
renders, centred, no console errors, exactly where `images.tsv` says it
should. And immediately, two problems that only exist because I looked:

1. **The player is nearly lost against the void.** This is the *exact* law
   §15.3.1 restated — "the player must never be lost" — and it's failing
   already, on the very first sprite. The Ranger is a fine-detail greyscale
   ship with no glow, outline, or colour separating it from a black
   background; at a glance it reads as part of the scenery, not the thing
   you're piloting. The old ASCII player solved this with a reserved
   bright-white `@` nothing else could use. Raster has no equivalent
   mechanism yet — `drawImage` just blits pixels, no highlight pass. This
   needs a code answer (a rim-light/outline treatment John draws under or
   around the player's raster sprite, the raster equivalent of "bright white
   reserved to the player"), not an art answer — a differently-lit PNG alone
   won't fix "must always read against *any* background," a bloom/outline
   layer will. **Flagging as the top of the raster-legibility list**, ahead
   of curating more roster art — the owner has now made this exact complaint
   about ASCII XP once already; shipping the same failure in a new medium
   would be a real miss.
2. **The curated background never draws.** `assets/space/backgrounds/
   starfield_01.png` exists, is committed, and is never referenced by
   anything — `images.tsv` only maps *entity* ids (`sprites/player`,
   `sprites/mobs/*`), and there's no "world background" concept in the
   contract at all. The field the Ranger flies in is still the old ASCII
   void (a sparse scatter of `"` glyphs on black). This is a **new code ask**,
   not a data-table gap: a full-field background blit is a different shape
   of problem than a per-entity sprite (it has to tile or cover the whole
   viewport, sit under literally everything, and probably shouldn't move
   with the camera the same way a positioned entity does). Not filed against
   `images.tsv` — that table's shape is right for what it does, this is
   something else. Written up as a fresh ask in `todo.md`.

Both are real, both are now precise instead of hypothetical, and both landed
because looking at a screenshot costs five minutes and catches things a
passing test suite structurally cannot. Enemies did spawn and die during the
15-second natural-play check (kill counter reached 5) — I didn't manage to
catch a live Spacebug in the same frame as a screenshot (they die fast
against even an unlevelled starting weapon), so the mob-tier raster art is
wired the same way the player's is but not yet visually confirmed. Next look
should catch one mid-frame, ideally with god-mode + a slower kill rate so
there's time to compose the shot.

### 15.8 Both §15.7 gaps closed by John, converging independently; a design call answered; elites and the boss curated

Went back for another look and found John had read [35]/§15.7 before I'd
have had to ask twice (`john.md` [33]/[34]): he'd independently found and
fixed the same two problems, plus built the crossfade music system from
§15.4, plus caught his own docstrings pointing at `space-assets/` and
corrected them. In order:

1. **Player legibility — fixed.** `Surface.drawImage` grew an optional
   `glow: Color` param; the player's draw call passes `PLAYER_COLOR`
   (bright white) and nothing else's does. Confirmed by eye in a browser
   check of my own — the Ranger now reads immediately against pure black.
   `@`'s reserved-bright-white law has a raster equivalent now.
2. **Background — built the full contract, asked me one design question.**
   Not another `images.tsv` row (correctly — he'd independently reached the
   same "different shape of problem" conclusion I had). `backgrounds.tsv`:
   `id / path / parallax / tileWu`. He asked the one thing that's actually
   mine to decide — pinned vs. drifting. **Decision, written into
   `assets/backgrounds.tsv`: parallax 0.15, tile 40wu.** Not 0 (fully
   pinned reads as flat wallpaper in a game whose whole pitch is motion,
   §1/§2) and not near 1 (a starfield that tracks the camera as fast as a
   ship competes for attention it shouldn't have — the luminance ladder's
   spirit, restated). 0.15 sells "you are moving" while staying inert
   scenery. Tile size picked so a seam sits well outside the light radius
   a player is actually looking at.
3. **Music — the crossfade is built.** `AudioSink.setMusic(weights)` ramps
   several loops' gain continuously (0.6s) instead of hard-cutting;
   `World.musicIntensity` reuses `targetPopulation()` normalized against
   `target_end` — literally §15.4's "same curve the horde already climbs,"
   for free. Rewrote `audio.tsv`'s single `music/theme` into `music/ambient`
   (`DeepSpaceA`), `music/combat` (`DynamicFight_1`), `music/boss`
   (`dark2`) — the exact tracks I'd already curated for this in §15.4,
   just re-keyed. `boss_phase`/`DubStepDropBoom` stays a one-shot layered
   on top, not a bed of its own.

**Curated this pass (§15.2's Phase 3, pulled forward since the elite/boss
code path needed zero new work — `spriteIdFor()`/`imageFor()` already cover
`sprites/elites/<id>` and `sprites/countess`):** Gravewarden →
`ArtBoard Special Units/big_berta.png` (a riveted, plated artillery
platform — the closest thing in the pack to "armoured golem," matching the
old brief). The Overlord (ex-Countess) → `OverLord_Nightmare/
OverlordNightmare6Cropable1_01.png` — a radial crystalline horror, instantly
distinct from anything else on the field. Added rows to `images.tsv`, sized
off each PNG's real aspect ratio. Verified in a real boss encounter
(`?start=18:55`, headless browser) — **it renders exactly as intended,** big,
purple, unmistakable, HP bar and all.

**Found one more real bug doing that verification:** the background still
doesn't draw, even with `backgrounds.tsv` populated and `drawBackground()`
fully wired in `render.ts`. Traced it — `src/web/boot.ts:112` constructs
`WebImageSource` with only `data.images` (the entity table), never
`data.backgrounds`, so the starfield's path is never requested and
`this.images.get(entry.path)` in `drawBackground()` is always `undefined`.
Silent, correct fallback to the old scatter, exactly per spec — just missing
one wire. Filed precisely in `todo.md` rather than as a vague "background
doesn't show" repeat of §15.7.

`npm test`: 144/144 (backgrounds.ts added 2). `npm run build`: 25 media
files copied, all accounted for.

### 15.9 Weapon effects — a proposal, not a curation, and here's why

Went looking at `!WEAPON PACK!/Weapons/` (`Bullets/`, `LaserBeams/`, `Beam,
Jet/`, `Lunar/`, `MainWeapons/`) to pick per-weapon art for the 7 weapons
(§7's table: Chain, Sanguine Nova, Censer, Grave Salt, Wisp Lantern, Silver
Rain, Cinder Trail). Stopped short of actually picking files, on purpose:

1. **There's no code path for this yet, at all.** §7 is explicit — weapons
   resolve as *procedural shapes* (`band`/`bolt`/`ring`/`arc`/`orbit`/
   `column`/`trail`), drawn by `drawBands`/`drawBolts`/etc. off `juice.tsv`
   glyphs and colours, never a sprite id. `drawPickups` (checked while
   confirming the XP-legibility risk from §15.3) confirms the pattern: it
   reads straight from `glyphs.tsv`, no `imageFor()` call at all. Curating
   art for a draw path that doesn't consult `images.tsv` would just be dead
   weight sitting in `assets/space/` until someone builds the plumbing.
2. **The pack's files don't have names I can act on.** Unlike the roster
   (`spacebug_blue.png`, `battlecruiser_shiny.png` — self-describing), this
   folder is `bullets1_0020_Circle---.png`, `beams_0112_Rectangle---.png`,
   `weapon_0064_Package---.png` — hundreds of numbered spritesheet slices
   with no content in the filename. Picking "the right one" means opening
   dozens of images per weapon, and doing that before question 1 has an
   answer risks picking against a contract that doesn't match what gets
   built (single static image? a strip meant for the `loop compatible`
   beams? `MainWeapons/` clearly has real props mixed in — `Rocket_34x75
   .png`, `bulletGlow.png` — worth a second, more careful pass once there's
   a shape to pick *for*).

**What I will commit to now — the folder-level mapping, cheap to write and
useful even before file-level picks exist:**

| Weapon | Shape (§7) | Candidate folder | Why |
|---|---|---|---|
| Sanguine Nova | `bolt`, homing | `Bullets/` | A single homing round — the pack's plainest bullet category. |
| The Chain | `band`, facing | `LaserBeams (for loop compatible)/` | A band reads as a beam more than a bullet; "loop compatible" suggests it's built to stretch/tile along a length, which is exactly what a band needs. |
| Censer | `ring`, persistent | `Lunar/` | Circular glyphs (`_Circle_` in every filename), a persistent ring around the player — orbital naming fits the orbital shape. |
| Grave Salt | `arc`, lobbed | `MainWeapons/` (`Rocket_*`) | The only category with an actual lobbed-projectile silhouette (a rocket), matching "lobs upward, falls, shatters." |
| Wisp Lantern | `orbit` | `Lunar/` | Same reasoning as Censer — orbiting motes, orbital-named folder. |
| Silver Rain | `column` | `Beam, Jet/` | A falling column reads as a beam/jet coming down, not a bullet. |
| Cinder Trail | `trail` | `MainWeapons/` (`bulletGlow.png`) or a new small-embers pick | Needs a soft glow/ember look, not a hard-edged bullet or beam — the one row I'm least sure of. |

This is a **proposal for John**, posted to `jane.md`, not a spec: does a
`shape`-resolving weapon even get a raster treatment the same way an entity
does, or does the visual effect stay procedural (glyph/colour, no sprite id)
forever and only the **level-up card icon** (`cards/<id>`, a static,
non-moving UI element) gets raster art? The second option is far cheaper —
same shape as `images.tsv`, no new rendering concept — and given `images.tsv`
already shadows `sprites/*` ids generically, `cards/<id>` might already be
one row away from working if the card-drawing code calls `imageFor()`.
Asked, not assumed.

### 15.10 Answered — decisively, and portraits got the same treatment

John (`john.md` [41]/[42]): **weapon effects stay procedural, permanently —
a real architectural call, not "later."** Every effect draw function
computes geometry live off current weapon math (a band's live sweep angle,
a ring's current radius); making that read as raster would mean either
distorting fixed art per-axis or hand-building a geometry-to-pixels redraw
per *shape*, seven separate problems. The procedural effects already have
the full juice stack (hit flash, shake) and were never what "stick figures"
meant — that was static entities, and that's solved. **Correction to this
section: don't curate `!WEAPON PACK!/` files against a live-effect target,
ever** — there's nowhere for that art to land.

**Card icons (`cards/<id>`) — built, not just confirmed cheap.** Same
`resolveImage()` three-tier fallback as everything else. One real unit
difference from every other row in `images.tsv`: cards (and, same commit,
portraits) are screen-space UI, not world entities — `w`/`h` are **cells**,
not wu, no `WU_PER_ROW` division. Curated all 7 weapons' icons (picks and
reasoning: `assets/images.tsv`'s own comment block) and added the rows.

**Portraits — the same question, asked once, answered for both surfaces at
once.** `drawPortrait` now tries raster first too. Confirmed the "free
reuse" instinct from §15.2/`jane.md` [41]: `portraits/ghoul` points at the
exact file `sprites/mobs/ghoul` already uses — no second art pass. Rows
added for all 5 curated mob tiers plus the Gravewarden.

**Then a real bug, found by actually looking (again) — not yet fixed.**
Card icons load correctly (confirmed via a page-level `fetch()`, not just
curl) but don't render: `drawBox`'s background fill is a buffered `set()`
call that paints every interior cell of the card, called *before*
`drawCardArt`, and `Surface.drawImage`'s own documented rule is that raster
always composites **under** buffered glyphs regardless of call order — right
for the field (keeps ground/decals/HUD legible over a ship, §15.3), wrong
for a card where the box is supposed to sit *behind* the icon. Traced, not
fixed — `jane.md` [43], `todo.md`. Portraits don't hit this because nothing
draws a buffered fill over the portrait panel first.

### 15.11 The Ranger has to turn — a design call plus a contract ask, and the plumbing's half-built already

Owner, 12.07 12:42: *"Why is the ship on its place! Space ships turn and move
and do epic stuff. this gameplay is now weird for a space game!"* Fair hit —
every entity in the game, including the player, still renders as a single
static image nailed to one orientation while it slides around underneath.
That reads fine for a hooded figure walking (§9 never asked the old sprite to
turn either), but a spaceship that never points where it's going looks
broken, not stylised, because "which way is the nose pointing" is the one
thing every player's eye checks on a ship instantly.

**This is a rendering concern, not a `facing` change — deliberately.**
`world.facing: 1 | -1` (`world.ts:233`) is a gameplay variable: it's what The
Chain fires along, it's set by explicit horizontal input, and it auto-turns
toward the nearest enemy after a 0.25s idle grace (`faceNearestEnemy`,
`world.ts:678`) so the whip has something sane to aim at while standing
still. None of that should change — it's tuned, it's in §7, touching it risks
the exact "walking into damage" regression §7 already fixed once. What the
owner's asking for is purely visual: the sprite's drawn angle should track
where the player is actually **moving**, continuously, not the binary
weapon-aim side. Two different questions that happen to both be called
"facing" in casual conversation — worth being precise about so the fix
doesn't accidentally reopen the Chain's old bug.

**The hook already exists and has never been called.** `Surface.drawImage`
(`engine/surface.ts:91`) has taken an optional `angle` parameter since the
raster pivot; the canvas backend implements it fully — real
`ctx.translate`/`ctx.rotate` around the sprite's own center
(`web/canvas.ts:220-257`) — and its own doc comment says the quiet part
out loud: *"unused by any caller yet (v1 ships don't turn to face their
heading), kept so that's additive later, not a signature break."* Later is
now. The player's draw call (`render.ts:167`) simply never passes a third
argument. This is about as cheap as a "next time the customer comes back
they want to see the full graphical overhaul" ask gets to be — no new art,
no new plumbing layer, one derived number threaded through a call that
already accepts it.

**The design call — how it should feel, not just that it should work:**

- **Derive heading from actual movement, not from `facing`.** `movePlayer`
  (`world.ts:646`) already computes a normalized `(nx, ny)` every frame
  before applying speed — that vector *is* the heading, in the one place
  that already does the trig. `facing` only flips on a >0.2 horizontal
  threshold and idles into auto-aim; using it for the sprite would mean the
  ship silently reorients to face a monster while the player is holding
  still, which isn't "turning," it's "spinning for no visible reason."
  Movement and aim read as different verbs to a player and should stay
  different values in code.
- **Smooth the turn — snapping to the raw velocity angle every frame will
  look like a twitch, not a bank.** At swarm density the input vector
  reverses constantly (dodging is the whole game, §9/§14); an unsmoothed
  angle will flicker the ship back and forth like a broken compass needle.
  Cap the turn rate instead of setting the angle directly — propose
  **~480°/s** (a full reversal in a third of a second: fast enough to read
  as "arcade spaceship," not slow enough to feel like the ship is fighting
  the player's own input). Tune by eye once it's live; the number's a
  starting point, not a commitment.
- **Hold the last heading at rest, don't snap to a default.** When the input
  vector is zero (`len === 0`, `world.ts:666`, returns before moving), the
  ship should keep pointing wherever it last pointed, not reset to "up" or
  "right." A ship that un-banks itself the instant you release a key is the
  same twitchy problem as no smoothing at all, just at the other edge of the
  input.
- **Confirm the Ranger art's own "up.".** `angle: 0` means "the image's own
  up" (`web/canvas.ts:210`'s doc comment) — I haven't confirmed which way
  `Galactica_Ranger_A.png`'s nose actually points in the source file. If
  it's not drawn nose-up, the fix needs a fixed offset added to the computed
  angle, not a code bug — I'll check the source art and post the offset (or
  "0, it's already nose-up") to `jane.md` rather than have John guess and
  ship a ship that flies sideways.
- **Out of scope for this pass, flagged so it doesn't get assumed:** a
  thrust/engine-flare visual cue when accelerating (cheap follow-on once
  heading exists, pairs well with it, but is a new visual element, not this
  fix) and applying the same rotation to enemy sprites (mobs don't currently
  have a "nose," and the owner's complaint named the ship specifically —
  separate ask if it comes up).

Contract ask posted to `jane.md` [45] for John: where the smoothed-heading
state should live (`World` alongside `facing`, or local to the renderer) is
his call, not mine — techstack is his lane. My ask is the derivation (from
velocity, not `facing`), the turn-rate cap, and the idle-hold behaviour;
everything else is his to build against.

### 15.11.1 Ship rotation, shipped — and John's open question answered: yes, mobs and the Gravewarden too

John built and shipped §15.11 (`john.md` [44]/[45]) — `World.heading`,
480°/s (reconciled to this file's own number over his initial 720°/s guess),
holds at rest, verified against all four cardinal directions in a real
browser. Not repeating that writeup; it's done.

He left one open question rather than guess at it: `moveEnemies` already
computes a per-frame velocity for every mob, so the same treatment is
mechanically as cheap as the player's was — but he didn't know whether the
mob/elite art was actually drawn nose-up the way the Ranger was, and a
sprite rotating around an axis nobody drew it for reads as broken, not
epic. That's exactly an art call, so I looked rather than guessed back:

- **`spacebug_*.png`** (all 5 palette variants — rat/ghoul/bat/rattlejack/
  wight are the same base sculpt, different colour, per `images.tsv`'s own
  comment) — clear nose-up read. A raised turret/head structure breaks the
  radial symmetry at the top; four legs splay symmetrically to the sides
  and back, same visual grammar as a horseshoe crab or spider viewed from
  above. Turning to face its direction of travel will read correctly.
- **`gravewarden.png`** — same shape family, same verdict: a central
  cannon/head at top, four claw-limbs splayed around it. Nose-up, turns
  correctly.
- **The Overlord doesn't need this ask at all** — checked design.md's own
  Hunt/Dusk phase table (above, §12-ish): she already has a **90°/s
  `bossHeading`** turn mechanic tied to her charge attack, predating this
  whole thread. John's [45] confirmed he reused that exact `turnToward`
  pattern for the player. Nothing new needed there.

**Decision: yes, extend movement-vector rotation to the regular mob roster
and the Gravewarden**, same mechanism as the player (derive from the
per-mob velocity `moveEnemies` already has, cap the turn rate, hold at
rest) — this is a field full of little ships/turtles banking to face where
they're scuttling, which is exactly the "epic space" swarm read the owner's
after, and it's cheap because the pattern and the plumbing both already
exist twice over (player + boss). One tuning note, not a hard number: trash
mobs are small and read as fast/erratic already (§9's swarm feel), so a
**faster** turn rate than the player's 480°/s (they're bugs, not a ship
with inertia) will probably read better than reusing the same constant
verbatim — John's call on the actual figure, same as the player's was.
Posted to `jane.md` [46].

### 15.12 What "the full graphical overhaul" should mean at the next check-in — a checklist, not new scope

Owner, same message: *"Next time the customer comes back they want to see
the full graphical overhaul!!"* Rather than treat that as one undefined ask,
gathering what's actually open across every visual thread already tracked in
this file and `todo.md`, so there's one list to work down instead of
scattered open items rediscovered under pressure right before a demo:

1. **Ship rotation (§15.11, above)** — the most visible single gap right
   now, and the one named explicitly. Top of the list.
2. **Card icons render blank** (§15.10, `jane.md` [43]/[44]) — traced, not
   fixed, currently disabled behind a working ASCII fallback so it isn't an
   active regression. This is the difference between "level-up screen looks
   finished" and "level-up screen looks unfinished" and it's a real,
   understood bug, not undiscovered work.
3. **The GUI is still 100% ASCII** (`todo.md`, carried over) — title and
   death screens got a five-minute reskin (§15's last entry before this
   one) but menus/HUD chrome/the level-up frame itself are untouched. This
   is the largest remaining "still looks like the old game" surface and the
   one most likely to be the first thing a customer's eye catches after the
   ship itself.
4. **Weapon effects stay procedural, permanently** (§15.10) — not a gap,
   a decided architectural boundary. Listing it here so it reads as
   "closed, on purpose" at the next check-in rather than as an oversight
   someone re-asks about.
5. **Thrust/engine-flare on acceleration** — new idea, surfaced by §15.11's
   rotation work rather than requested yet. Cheap once heading exists
   (same derived vector), real "epic" payoff for very little new surface.
   Proposing it here rather than building it unasked.
6. **Boss phase-2 art swap** (`OverlordEvoSample`, `todo.md`) — parked as a
   want, needs John's phase-trigger plumbing first, not started.

Not a commitment to do all six before the next visit — a shared map of what
"finished" covers, so whichever subset gets done, both of us (and the
owner) are working off the same picture of what's left.

### 15.13 Scoping the GUI overhaul — a real prerequisite found, plus a folder-level proposal

Working `todo.md`'s open item: "the GUI is still 100% ASCII... the largest
remaining 'still looks like the old game' surface." Same discipline as
§15.9's weapon-effect pass — scope it properly before picking files, don't
guess blind.

**Every raster panel in this game is one bug away from repeating the card
fiasco.** Checked every `drawBox` caller (`app.ts`), since that's the
function whose buffered fill caused §15.10's card-icon bug: the pause
overlay (647), the level-up card frame (681), the level-up header (755),
and the death screen (768) *all* call it. `drawBox`'s background fill is a
buffered `set()` over the whole interior, and `Surface.drawImage`'s
documented rule is that raster always composites under buffered glyphs —
so any of these four panels that gets a raster background or icon today
would render invisible, exactly like the cards did, for the identical
reason. **This means the z-order fix John's already sitting on (`jane.md`
[43]/[44], `todo.md`) isn't just a card-icon fix — it's the one blocker for
the entire GUI overhaul.** Worth saying plainly so it doesn't get
re-discovered panel by panel.

**Update, same session — he's already on it, and it's the right shape.**
Checked his working tree while writing this up (not yet in `john.md`, still
mid-build): an opt-in `onTop` param on `drawImage`, deferred to paint after
every buffered glyph/fill in `flush()`, rather than flipping the global
ordering rule. That's the better fix — the field's "raster sits under
glyphs" law (§15.3, keeps ground/decals/HUD legible over a ship) stays
exactly as it is everywhere it's currently correct, and only UI callers that
explicitly ask for front-of-panel compositing get it. One blocker, one
surgical fix, not a redesign of the whole draw order.

**What's actually in the vendor pack, checked rather than assumed
(`!GUI!/`, 162+ files in `GUI Items/` alone):** same numbered-slice problem
as the weapon pack (`GUI_Items_0032_Package---.png`, no content in the
name) for most of it, but three named, checked-by-eye exceptions are
immediately usable:

- **`GUI Items/*Round-Rect*`** — dark brushed-metal/glass panel textures,
  no text or icon baked in. Sampled one directly: reads as a proper sci-fi
  console panel, on-theme with the Ranger/starfield already shipped. Good
  candidate for the level-up card frame and the pause/death panel
  backgrounds — replaces `drawBox`'s flat fill, not the box-drawing
  border/title logic, which stays ASCII (design.md's whole "raster shadows
  glyph" law, §15.2's README framing).
- **`ButtonsWithText/buttonOriginal.png` (+ `buttonHoovered`/
  `buttonPressed`)** — a clean 3-state button shape, also no baked-in text.
  Confirmed by eye. This matters for the z-order fix specifically: since
  there's no text on the art itself, a button's label stays a code-drawn
  string on top, same as everything else — no new "raster panel with
  unreadable baked-in text" failure mode to design around.
- **`Arrows/`** — not opened yet; flagged as the likely pick for level-up
  card pagination/selection cursor if that ever gets a visual upgrade, not
  scoped further this pass.

**What I'm deliberately not doing yet:** picking exact numbered files out
of the other 150+ `GUI Items/Package`/`Path`/`Text` entries. Same call as
§15.9's weapon pack — opening dozens of anonymously-numbered slices before
there's a confirmed rendering target (i.e. before the z-order fix lands) is
picking blind against a contract that might not match what gets built.

**Proposed phasing, cheapest-and-most-visible first:**

1. Root-cause z-order fix (John's, already traced, unblocks everything
   below).
2. Re-enable the 7 already-picked `cards/*` rows (`images.tsv`, commented
   out) — zero new curation, immediate payoff, confirms the fix.
3. Level-up card frame background → a `Round-Rect` panel texture behind the
   existing ASCII border/title (same "raster shadows glyph" pattern as
   every entity row, not a rebuild).
4. Pause and death-screen panels → same treatment, lower priority (seen far
   less often than the level-up screen, which fires every single level).
5. Buttons — only relevant once there's an actual clickable menu (there
   isn't one yet; input is keyboard-driven per `input.ts`). Parked, not
   forgotten — flagging the asset exists for whenever John/the input model
   supports it.

Posted to `jane.md` [47] as a proposal, not a spec — same as §15.9, John
confirms what's actually buildable against the fix once it lands.

### 15.14 The Overlord's phase-2 art — decided, and not at the HP number `todo.md` originally guessed

Closing out the open item: "is the Overlord's `OverlordEvoSample` art worth
a 50%-HP phase-2 swap?" Looked at all three samples
(`OverLord_Nightmare/Samples/OverlordEvoSample_0{1,2,3}.png`) before
deciding anything:

- **`_01`** — purple/teal with a cyan core. Essentially the same palette as
  the currently-live `overlord_01.png` (Court phase). Not a swap target,
  it's what's already on screen.
- **`_02`** — warm gold/pink, floral patterning. Reads *decorative*, not
  *threatening* — wrong direction for an escalation. Ruled out.
- **`_03`** — olive/black/deep-blue, harder-edged patterning. Reads
  noticeably more venomous/alien than the purple. **This one.**

**Decided against 50% HP as the trigger point — the fight's own phase table
(above, Court/Hunt/Dusk) already has two real boundaries, and one of them
is a far better fit than an arbitrary round number nobody in the fight
would notice.** The actual candidates:

- **Dusk, 25% HP** — tempting, since it's already the "everything gets
  worse" moment. Rejected on inspection: Dusk's whole mechanic is the field
  going black *even with `--no-dark`*, "you can only see her when she's on
  top of you" (this file, boss section, above). A recolor nobody can see
  because the screen is already dark is wasted art.
- **Hunt, 70% HP — the pick.** This is where she stops being stationary and
  starts charging: the single biggest behavioural swing in the fight, and
  it happens while the arena is still fully lit, so a palette swap actually
  gets seen at the exact moment the fight gets scarier. "She just changed
  colour *and* started charging me" reads as one escalation, not two
  disconnected events.

**Decision: swap `sprites/countess` to `_03`'s palette at the Court→Hunt
transition (70% HP), not at 50%, and not at Dusk.** Curated the pick into
the tracked folder (`assets/space/boss/overlord_hunt.png`, matching
`overlord_01.png`'s naming) rather than leave it pointing at the gitignored
vendor drop. Not committing to the Dusk transition getting its own third look
Dusk transition getting its own third look — the darkness already carries
that moment on its own, per §9/this file's existing "the carpet is the only
thing telling you where you are" beat; adding art there risks competing
with a mechanic that's already doing the work.

**Still needs John's phase-trigger plumbing, unchanged from `todo.md`'s
original framing** — `drawBossBar`'s `imageFor(r, w, 'sprites/countess')`
call (`render.ts:519`) resolves one fixed id today, no phase parameter.
Posted as a want, not a blocker, in `jane.md` [49] — the fight is fully
functional without this, it's polish, and John should only pick it up if
nothing on §15.12's list is more urgent.

**Closed.** John built the plumbing (`john.md` [49]) — `bossImage()` tries
`sprites/countess/<w.bossPhase>` first, falls back to the base id, pinned
with 3 unit tests (id priority, both fallback paths). Added the row:
`sprites/countess/hunt → space/boss/overlord_hunt.png`, sized 16×13.3 off
the art's own pixel aspect (220×183, not quite the base crop's 261×235, so
reusing the base row's `h` verbatim would have squashed it slightly).
Verified via the real parser: zero warnings, both new rows (`countess/hunt`,
`panels/frame`) resolve correctly. **Didn't get a live Hunt-phase
screenshot** — tried, and hit a real engine constraint worth recording:
`boot.ts`'s `?sim=` fast-forward hard-caps at 20,000 ticks
(`Math.min(20000, simTicks)`, `boot.ts:145`) regardless of what's requested,
which is ~5:33 of simulated time. That's enough to reach the boss's 19:00
arrival from a late `--start` (John's approach) but not enough combat time
afterward for a level-1-ish arrival to dent a 9000 HP pool down to 70%, and
starting earlier to arrive stronger just spends the same fixed budget
before the boss even shows up. Not chasing a code change for this — it's a
deliberate dev-tooling limit, not a bug, and the question this row answers
("does the right id get picked for a given phase") is exactly the kind of
deterministic logic John's 3 unit tests already pin more precisely than a
screenshot would. Got one honest, unplanned bonus instead: a sim screenshot
taken while chasing this (level 25, `sim` capped mid-run) happened to show
both §15.15's renamed cards — "Ion Wisp" and "Reactor Fuel" — rendering
correctly in a completely different context than their first confirmation.

### 15.15 A continuity break nobody had flagged: the player still carries a "lantern"

Found while looking at something else — not on any checklist. A level-up
screenshot happened to show a passive called "Lantern Oil" ("The lantern
burns brighter."), which is still exactly what it said pre-pivot. Checked
how far this runs: `grep -i lantern` across every `.tsv` and `ui/*.txt`.
Two genuinely player-facing strings, both broken the same way — they
describe upgrading or orbiting a **physical lantern object that no longer
exists in the fiction.** The player is a ship now (§15.3.1's reserved-glow
law replaced the literal lantern prop); nobody carries one.

- `passives.tsv`, `oil` — name "Lantern Oil", note "The lantern burns
  brighter." Renamed to **"Reactor Fuel"** / "The reactor burns brighter." —
  a direct term-for-term swap (lantern→reactor, oil→fuel), not a redesign;
  the light-radius mechanic and the ember/spark VFX it drives (§9/§14, "the
  lantern throws sparks that rise, cool, and die") are completely unchanged,
  just no longer narrated as a literal flame.
- `weapons.tsv`, `lantern` (all 9 level rows) — name "Wisp Lantern", one
  note "A burning wisp orbits you." Renamed to **"Ion Wisp"** / "A charged
  wisp orbits you." Kept "Wisp" (it's an abstract mote name, not a lantern
  reference) and its evolution name "Corona" (already reads as sci-fi,
  solar-flare-coded — no change needed).

**Scope, drawn deliberately narrow, same discipline as the Overlord
rename:** only fixed what a player actually reads on a card. Internal ids
(`oil`, `lantern` — read by `characters.tsv`'s `start_weapon` column,
`evolutions.tsv`, and John's code) are untouched, same "not worth the
coordination cost" call as keeping `countess.tsv`'s filename. Also
deliberately **not** touching design.md's own mechanic-description prose
("the pickup radius is tied to the lantern," "sparks rise off the lantern,"
etc., §9/§14 and elsewhere) or `countess.tsv`'s Dusk-phase flavour line
("the field goes black beyond your lantern") — checked whether that last
one even reaches the player first (`render.ts`/`app.ts`: `Phase.note` is
parsed but never drawn anywhere today, purely internal) and confirmed it
doesn't, so it's documentation language, not a player-facing bug. A full
"lantern → reactor/running-lights" sweep through this file's own prose is a
real follow-on if the term ever needs to disappear from *our* vocabulary
too, but that's a much bigger, lower-value pass than fixing the two strings
a player actually sees — not doing it speculatively.

Verified past the diff: `npm test` clean at every step (careful about one
TSV mechanic while editing — a row's trailing empty `note` cell has to
either keep its trailing tab or be genuinely absent, both parse to `''` via
`weapons.ts`'s `f[15] ?? ''`, confirmed in `src/data/tsv.ts`'s own doc
comment before touching the file). Then, since the level-up draw is
randomised and chasing it in a live browser wasn't converging, verified the
same way the code itself will read the file: imported `parseWeapons`/
`parsePassives` directly against the real `.tsv` files and printed the
parsed rows — zero warnings, `Ion Wisp`/`Reactor Fuel` both come out
exactly as written, notes intact. Same standard as a screenshot (actually
looking at what the code produces), just aimed at the data layer since the
UI layer is already proven by every other renamed string this session.

### 15.16 §15.13 phase 3, closed — the panel texture, picked and wired end to end

John built the plumbing ahead of the art (`john.md` [47]): `drawBox` grew
an optional `panelImg`, one shared id `panels/frame` wired into all four
panel screens (pause, level-up card, evolution, death), zero regression
with no row present. Picked the file and closed the loop: curated
`!GUI!/GUI Items/GUI_Items_0000_Round-Rect...png` (the dark brushed-metal
texture surveyed in §15.13) to `assets/space/ui/panel_frame.png`, added
the `panels/frame` row to `images.tsv`.

**One real wrinkle, worth recording so it isn't rediscovered:** this id's
`w`/`h` columns are inert. `panelImage()` (`app.ts`) reads only `.img` off
the row; `drawBox` stretches the texture to each call site's own box rect
(`draw.ts:139`), so there's no "footprint" for this id the way every other
row has one. Filled the columns with the source PNG's real pixel size
(64x64) for hygiene, documented in `images.tsv` itself that nothing reads
them.

`npm test`: 151/151. Screenshotted both shapes this backdrop has to work
for — the level-up card frame (three side-by-side cards) and the pause
panel (a single centered box, different aspect ratio) — texture stretches
cleanly on both, card icons and text both stay legible on top, zero console
errors. **One honest note, not a blocker:** stretched across a full card
the texture reads brighter/busier than it did in isolation, a bit more
prominent than the otherwise near-black UI chrome elsewhere. Real result,
works, on-theme — flagging the brightness as a possible tint/darken pass
later rather than treating this as wrong. §15.13's phasing is now fully
closed (fix → cards → panel texture); nothing left queued on that thread.

### 15.17 The last §15.12 item — a thrust trail, proposed procedural for the same reason weapon effects are

Closing the checklist. Same question §15.9 already had to answer for
weapon effects: raster or procedural? Checked the pack first rather than
assume — `grep -i "exhaust|thrust|flare|engine"` across
`space-assets/` turns up nothing; the closest candidates
(`!EXTRA PARTS.../SpaceShip Builder Pro`) are hull-component sprites, not
particle/glow art. Even if something existed, **there's still no animation
contract for raster sprites** (`todo.md`'s long-open item — `images.tsv` is
one static image per id, no frames) and a thrust flare that doesn't
flicker/pulse reads as a sticker, not an engine. Same conclusion as §15.10
for the weapon shapes: this is a live, per-frame effect, and procedural is
the only medium that can actually do it today.

**Proposal, not a spec — reusing the existing ember/spark *mechanism*
(`world.ts`'s `updateSparks`/`Spark`, `juice.tsv`'s `ember_*` params), not
the existing *emitter*.** Deliberately a new, separate particle stream, not
a repurpose of Reactor Fuel's sparks: those are an always-on annulus around
the player tied to light radius (a passive's visual payoff, §15.15/§9's
"the reactor throws sparks" line, still accurate post-rename) — gating
that stream on movement would break the passive's whole premise. A thrust
trail is the opposite shape — off at rest, on while
accelerating, anchored to the ship's tail:

- **Trigger:** `movePlayer`'s `len > 0` (the same "is there input" check
  that already gates `heading`'s target angle) — on while thrusting, off
  the instant input stops. No idle-hold needed here, unlike heading; a
  stopped engine should stop visibly, not coast.
- **Spawn point:** the tail, using `World.heading` (already exists,
  `world.ts:233`+) — offset behind the ship along `-heading`, roughly at
  the hull's rear edge (~2-2.5 wu behind centre, the Ranger's own
  `images.tsv` footprint is 6×8.6 wu). Cheap because the exact number this
  session already needed for rotation is the same number this needs.
- **Colour:** cyan, not the Reactor Fuel embers' amber — matches the title
  screen's own engine-flare pick (`jane.md` [40], `▀ ▀` cyan glyphs) and
  keeps the two particle streams visually distinct rather than blurring
  into one "the ship is sparkly" effect.
- **Starting numbers, comparing against the ember system's own tuning
  (`juice.tsv` above) rather than guessing blind:** faster rate (~15-20/s,
  it's a constant thrust jet, not an ambient shower), shorter life (~0.4s,
  it should read as a jet trailing off, not linger like a rising ember),
  no upward drift — it should trail backward along `-heading` and fade,
  not rise. Real numbers are a tuning pass once it exists, not a design
  commitment now.

**Not proposing this as urgent.** Everything else on this checklist was
either an explicit owner ask or a bug; this is Jane's own addition, real
"epic space" payoff for cheap, but it's polish layered on already-shipped
rotation, not something broken. Posted to `jane.md` [53] — John's call
when to pick it up, same framing as the boss phase-art "want."

**§15.12's checklist is now fully worked through.** Ship rotation, mob
rotation, the card z-order bug, the GUI panel texture, the lantern
continuity fix, the boss phase art, and this proposal — every item either
shipped or is a scoped, posted ask waiting on the other agent's lane.

### 15.18 Checked §15.3 point 5's "at risk" flag — still at risk, and here's the actual evidence

Not on today's checklist — went looking at `todo.md`'s other still-open item
("XP pickup readability at density... don't let the reskin reintroduce it")
since everything from the 12:42 feedback was closed. Wanted a verdict, not
another flag, so I actually looked rather than re-flag it a second time.

**What I found.** `drawPickups`' own comment (`render.ts:416`) says the
legibility problem was already solved once, pre-pivot: a mote is reserved
**bright cyan** (`C` = `0x4ff0f0` in `sprite.ts`'s `PALETTE` — objectively
brighter than the decal floor's `r` = `0xb22222` or its aged `k` = near-
black) and it pulses (`mote_pulse`/`mote_pulse_hz`/`mote_lift`,
`director.tsv`) so the eye catches motion even without extra brightness.
That fix is real and still runs, untouched by the pivot. But it was never
re-validated against what the pivot actually changed: **every other actor
on the field went from a single glyph cell to a multi-cell raster sprite**
with real visual weight — the mote didn't. Screenshotted a dense, fought-
over patch (`?start=8:00&sim=8000&god`) to check rather than reason about
it in the abstract: the wreckage/scorch floor (§9's "one decal per cell"
rule, confirmed still in force in `world.ts` — not stacking, so this isn't
a regression there) can legitimately blanket a wide screen area after a
hot fight, and against that field plus a dozen full-size Spacebug sprites,
the tiny `·`/`+`/`◆` glyph mote is genuinely hard to pick out at a glance —
not a hue problem (cyan still can't collide with anything), a **visual
weight class** problem. Small honest caveat: that screenshot used a
stationary god-mode auto-fight (sim-compressed, kills piling in one spot),
which likely concentrates decals more than normal moving play would — but
the core comparison (one glyph cell vs. a field of full sprites) holds
regardless of exactly how dense the floor gets.

**Verdict: still at risk, matches the original 09.07 complaint's shape
closely enough to take seriously, not resolved by the pre-pivot fix.**

**Curated the fix rather than just re-flag it.** `!GIFT!/Special Orbs,
Planets/Orbs/OrbsWithoutOutline_0035_Circle.png` — a small glowing orb,
bright cyan core fading to a dark blue rim, no outline. Checked several
alternatives in the same folder before picking (`design.md` doesn't need
the full survey, just the result): most read as decorative planet textures
or the wrong hue (green, gold); this one is the closest match to the
reserved-cyan law already in place, with real bloom a glyph can't have.
Curated to `assets/space/pickups/xp_orb.png`.

**This needs a real code hook, not a data row — checked before proposing
it, same discipline as every other raster ask this session.**
`drawPickups` never calls `imageFor()`/`resolveImage()` — confirmed by
reading it, not assuming (§15.9 already found the same gap for weapon
effects). Proposal for John: same three-tier fallback every other id
already gets (raster → glyph, no ASCII-sprite middle tier needed since
motes never had one), keep the existing pulse math driving the raster
version's scale or glow instead of retiring it — motion is still the
actual mechanism that sells "this is alive," the sprite just gives it
something worth pulsing. Same reuse-one-asset-scaled-by-tier convention as
the mob roster: one orb file, sized up for `mote5`/`mote20` the way width
already carries "size is threat" for mobs. Posted to `jane.md` [54].

**Closed.** John built it to spec (`john.md` [54]) — `drawPickups` tries
`pickups/<id>` raster first, glyph second, world-space wu (a genuine unit
fork worth knowing about: unlike cards/portraits, a mote lives *on the
field*, not in screen-space UI, so this is the third different unit
convention this one table now carries across three id namespaces). The
pulse still scales the drawn sprite rather than being retired — motion
stays the actual mechanism, exactly as asked. Wired the three rows myself
(`pickups/mote1`/`5`/`20` → `xp_orb.png`, sized `1.4`/`2.0`/`2.6` wu,
matching the values John had already live-tested and reverted). Verified
via the direct parser: zero warnings, all three resolve. Didn't get my own
fresh screenshot of a loose mote — my stress-test setup (stationary
god-mode player, large pickup radius, kills piling on top of it)
vacuums motes up almost the instant they spawn, so the exact frame I
captured just didn't have one on the ground. Not chasing that further:
John's own live pass (temporarily-added rows, since reverted) already
confirmed "the orbs read as distinct glowing cyan circles against the
mob/decal field," and two of his new unit tests pin the raster/glyph
fallback exactly. Between his live check and mine at the data layer,
confidence is solid without needing to re-derive his screenshot.

### 15.19 Fresh owner feedback, 12.07 13:14 — "ship is so slow, boring": the move-speed half

John split this feedback three ways (`john.md` [52]) and correctly stopped
at the part that wasn't his to guess: turn rate (his lane, already bumped
to 720°/s) versus raw `wu/s` (a balance number, flagged to me rather than
changed on a single sentence's literal reading).

**Decision: raised `playerDef.speed` 20 → 24 wu/s (+20%).** Checked it
against the roster before picking a number, not guessed: the Bat (26 wu/s)
is the one enemy explicitly designed to outrun the player (§9's genre rule
— *something* should occasionally out-pace you, that's tension); everything
else is well below even the old 20 (Rat 14, Rattlejack 11, Ghoul 9, Wight
6). 24 keeps that shape intact — still slower than the Bat, now more
clearly faster than the rest of the swarm — while giving the base movement
itself more presence, which is what "the ship is so slow" reads as most
literally. A much bigger jump risked doing to dodging what over-tuning
usually does to this genre: trivializing the one input that matters.

**Kept proportional, not just changed in isolation.** `glyphs.tsv`'s
`ashling`/`beggar` rows aren't read at runtime for movement (`World.
playerDef` always resolves the `player` row specifically; character
scaling happens via `characters.tsv`'s `move` multiplier applied on top,
`world.ts:596`) but they're kept as a documented reference, so I updated
them to stay honest: Ashling 28.8 (still her 1.2x), Beggar 24 (still 1.0x).

**John's own note is doing real work here too, not a coincidence.** He
flagged that the thrust trail (§15.17, since shipped — `john.md` [53])
would likely address the *feel* of "boring" better than a bare number
change, since a visible effort cue sells speed independent of the actual
wu/s. Both landed the same day: a modest, careful balance change plus a
visual one that doesn't touch balance at all. Together they're a more
complete answer to one sentence of feedback than either alone would be.

### 15.20 Fresh owner feedback, 12.07 13:14 — "why is menu screen long night": the title, renamed

**THE LONG NIGHT → LONE NIGHT.** John correctly named this as the biggest
version of the continuity-break pattern this whole session kept finding
(Lantern/Overlord, now the game's own name) and correctly didn't guess at
a replacement himself (`john.md` [52]) — that's the Countess→Overlord
precedent, and picking names is design, not code.

**Why this exact rename, not a bigger one.** "THE LONG NIGHT" is
specifically recognizable as a *Game of Thrones* phrase — that specific,
famous echo is more likely what read as leftover-fantasy-branding than
"night" as a generic word. The dawn/crossroads screens, the whole survive-
until-dawn structure, and "night" as the run's own framing were already
checked and kept during the pivot (§15.2: "genre-neutral... left alone") —
that call still holds, a spaceship crew can absolutely be surviving a long
shift in the dark. So the fix is surgical: break the specific recognizable
phrase, keep the vocabulary that was already vetted as fine. Considered
bigger swaps (`LAST LIGHT` — ties nicely into the reserved-glow/reactor
theme, `DEEP SPACE`-flavoured options) and set them aside for a real
reason, not just caution: they need brand-new hand-drawn letterforms in
`ui/title.txt`'s block-letter font (this session already found two new
letters it doesn't have — A, S), and getting a highly visible, first-frame
asset's font subtly wrong is a worse outcome than a smaller, confident fix
shipped today. "LONE" reuses only letters the banner already draws
correctly (L, O, N, E — cut and reassembled from the existing "LONG" and
"THE" blocks, verified column-for-column, zero freehand drawing). If the
owner's next look says this doesn't go far enough, a bigger rename is a
same-day job with the letterform work done properly, not blocked on
anything.

**What actually changed:**
- `ui/title.txt`'s banner block (Jane's file) — "THE LONG" became "LONE",
  "NIGHT" untouched. Screenshotted the real title screen to confirm it
  renders cleanly, correctly centered, no artifacts.
- Every `assets/*.tsv` file header comment ("# THE LONG NIGHT — ...") —
  updated for consistency across all twelve tables. Purely internal
  documentation, not player-facing, but cheap and in Jane's own files, so
  no reason to leave them stale the way `countess.tsv`'s filename stays
  stale on purpose (that one has a real coordination cost against John's
  code; a comment line does not).
- **Not touched, deliberately internal:** `countess.tsv`'s own filename,
  and every in-code identifier — same boundary as every other rename this
  session.

**Four code-owned spots John already found and flagged (`john.md` [52]) —
posted back to him now that a name exists:** the browser tab `<title>`
(`web/index.html`), the dev server's startup banner (`serve.ts`), and two
hardcoded fallback strings in `app.ts` (`drawTooSmall`, `drawTitle`'s
placeholder-art branch). `jane.md` [55].

## 16. Owner feedback 12.07 16:10 — "this is not an ASCII game anymore": the field goes fully raster

The 16:10 feedback is one complaint wearing eight hats: the pivot moved the
*actors* to raster art but left every *effect* — and a few surfaces — drawn
in glyphs. The owner sees a space game with ASCII confetti stuck to it. This
section is the full ruling; jane.md [57] carries the asks to John.

### 16.1 The audit — every ASCII survivor on the field, enumerated

Went and read the render pass (render.ts) instead of guessing. Glyph art
still draws in exactly these places:

1. **Thrust trail** — cyan APOSTROPHES (`drawThrust`, `'` hardcoded). Also
   the "not center to ship" complaint, two real causes: spawn is a constant
   2.25 wu behind centre while the hull's rear edge sits at h/2 (was 4.3 wu
   on the Ranger — the jet ignited *mid-hull*), and a glyph anchors to its
   1×2 wu cell rather than the exact point, adding wobble the rotating
   raster ship doesn't share.
2. **Death pop** (`drawPops`) — flashes the dead enemy's ASCII SPRITE from
   the glyph bank, white. This is, verbatim, "when i kill an enemy a ascii
   thing flashed below it." Every kill, all game long.
3. **Weapon effects** — bands `═`/`─` fills, bolts as per-weapon glyphs,
   the Ion Wisp's orbiting `o`s, Gravesalt's `^`, Silver Rain's `|`
   columns, the boss's exhaust-trail hazard glyphs.
4. **Particles** — Reactor Fuel's ember glyphs, hit sparks.
5. **Floor decals** — the red/near-black wreckage glyph blocks.
6. **Passive card diagrams** — weapons got raster icons in §15.9; passives
   (Might, Regen, Armour, Revival, …) still draw ASCII diagrams. Caught
   live this session on a real level-up screen.
7. **Title banner** — ui/title.txt's block letterforms (and the small ship
   figure) are ASCII art on the single most-seen screen in the game.

NOT on the list, deliberately: HUD text, damage numbers, card body text,
menus. Text rendered as text is typography, not ASCII art — no owner has
ever complained about a number being made of digits. The ruling below is
about *pictures made of characters*, not about writing.

### 16.2 The ruling — three rendering classes, and which each effect joins

The field renders **zero glyph art** once John's pass lands. Every current
glyph effect joins one of three classes:

- **(a) Particles → canvas primitives.** Thrust, embers, sparks become
  filled circles (radial alpha fade, wu-sized, the colours they already
  have). NOT sprites: they're sub-wu, motion-dominant, and numerous — a
  textured blit per spark buys nothing a 2-3px glowing dot doesn't. John's
  §15.9 architecture answer ("weapon effects are 7 different geometry
  problems, not 1") STANDS — this changes how a shape is rasterised, not
  who owns the geometry.
- **(b) Point projectiles → raster sprites.** Bolts, the Wisp's orbs,
  salts get `projectiles/<weapon id>` rows (world units — they live on the
  field; same unit rule as sprites/ and pickups/, the table comment says
  so). Directional ones rotate to velocity, same drawImage angle the ships
  already use. Glyph fallback stays, as everywhere. First row is already
  curated and waiting: the Wisp (see 16.4).
- **(c) Area/beam shapes → translucent primitives.** Bands, rings, Silver
  Rain columns, boss hazards keep their exact geometry but draw as
  glowing translucent rects/arcs/lines instead of glyph fills. The pack's
  `LaserBeams (for loop compatible)` strips are noted as a future upgrade
  for beams specifically — not required for this pass.
- Death pop: class (b) spirit — flash the enemy's own RASTER sprite
  (same imageFor() the live enemy just used, white glow, scale-and-fade
  over the same death_flash window). Glyph fallback for rows that lack
  raster, exactly like the live path.
- Floor decals: `decals/debris1..3` rows (curated, committed, commented in
  images.tsv) — grey asteroid rubble, deliberately dark/desaturated so the
  luminance ladder (§9) keeps scenery under actors. John picks per-decal
  at spawn (stable pseudo-random by position is fine; variety is the
  point of three files).

### 16.3 Thrust centring — the fix rides on 16.2(a)

Primitive dots kill the glyph-anchor wobble; the spawn point moves to the
resolved player image's OWN h/2 (not a constant) — required now, not just
nice, because per-character ships are live (16.6) and each hull has a
different tail. Numbers otherwise unchanged from §15.17 (rate/life/speed
were never the complaint; position and glyph-ness were).

### 16.4 The Wisp mismatch — card and effect now share one file

Owner: "Charged wisp image does not at all match the ascii effect." Both
directions were wrong: the card showed a purple arc-swoosh (nothing like
the effect), the effect was a letter `o` (nothing like any art). Fix:
`bulletGlow.png` (a glowing cyan-blue plasma orb) is now BOTH
`cards/lantern` (row live, resized 9×4.1 for the square-ish source) AND
the pending `projectiles/lantern` row — one file, two rows, card and
effect literally cannot drift apart again. Its blue-white core sits far
enough from the XP mote's flat cyan+dark-rim orb to keep the reserved-cyan
law honest; if they read too close on the field the wisp is the one that
changes (XP legibility outranks a weapon's colour, §15.18).

### 16.5 The light mechanic — "so pointless" is correct, and here's the salvage

The owner is right about the symptom: in normal play the darkness is a mild
0.4 dim outside a radius nobody can see the edge of, over a starfield, on
raster sprites that stay perfectly legible anyway. It costs attention and
gives nothing back — a vestige of the gothic-lantern game this used to be.

**Ruling: normal play is FULLY LIT.** The browser default flips (lit unless
`?dark` asks for the old look); `w.dusk` still forces the collapse. Dusk —
the boss's phase-3 blackout — is the one moment the mechanic was ever
dramatic, and it keeps it: the arena going black at 25% HP with only your
sensor bubble left is a finale beat, not a chronic tax.

**`light_radius` is not dead — it's reframed as SENSOR RANGE**, which is
what it already mostly was in code: it gates how far out the Bat's charge
tell renders (render.ts:563 — a real, live gameplay effect), it sizes the
reactor's ember ring (the passive's visible payoff), and it sizes your
Dusk visibility (the endgame payoff). Reactor Fuel's player-facing text
updated to match ("The reactor feeds the sensors." / "sensor range") —
stat id untouched, passives.tsv comment explains.

### 16.6 "You have a huge asset pack and are barely utilizing it" — fair; here's the utilization pass

Landed this session (my lane, live now):
- **New hero ship.** The grey Ranger_A retires ("this ship looks stupid" —
  he's not wrong; it read as a grey brick at field size). The Warden flies
  `Starship_A`: classic fighter silhouette, dark hull, glowing blue engine
  stripe that visually mates with the cyan thrust trail. Verified live —
  reads instantly against the starfield inside the white halo. Ranger
  folder trimmed to the single retired file for reference.
- **Per-character ships, live for the first time.** The hook was ALREADY
  in code (`w.character?.sprite ?? 'sprites/player'`) and characters.tsv
  already named `sprites/ashling`/`sprites/beggar` — nobody had ever fed
  it rows. Ashling: ornate red cruiser ("burns the floor behind her").
  Beggar: TinyCruiser_Yellow, the gold junker ("rich runs") — source art
  is nose-down; the committed file is rotated 180° so it obeys the same
  nose-up contract as everything else. Buying a pilot at the crossroads
  now buys a visibly different SHIP, which is what that screen always
  wanted to sell.
- **Debris decals + two parallax star layers** curated and committed,
  rows staged (commented) pending John's hooks — multi-layer
  `drawBackground` (`field.0`, `field.1`, … drawn far→near, each with its
  own parallax) is the single cheapest "the void has depth" win in the
  whole pack.

Next curation pass (mine, no code dependency): **raster icons for all
passive cards** (16.1 item 6) — same `cards/<id>` contract the weapons
already use, if John confirms drawCardArt keys passives by id the same
way (asked in jane.md [57]; strongly implied by the shared code path).

### 16.7 The title screen (P2, after the field is clean)

The banner's block letterforms are ASCII art on the most-seen screen in
the game. Ruling: the wordmark becomes REAL TYPOGRAPHY — canvas text at
display size (bold, tight tracking, the reserved-white/cyan accent
palette), with the hero ship's raster art composed beside it. That kills
the last big ASCII surface, ends the letterform-inventory problem that
constrained the LONE NIGHT rename (§15.20 — a canvas wordmark has every
letter, so a future rename is a one-line change), and costs no curated
art. ui/title.txt retires to fallback duty (terminal build keeps it —
the terminal is allowed to look like a terminal).

### 16.8 Priorities, so core-first stays honest (owner, 10.07)

- **P0 (the complaints, verbatim):** 16.2(a) particles incl. thrust fix,
  16.2 death pop, 16.2(b)+(c) weapon effects, 16.5's default flip. All
  John; jane.md [57].
- **P1 (utilization, cheap):** decal rows hook, multi-layer background
  hook (both have art committed and rows staged); my passive-icon pass.
- **P2 (polish):** title wordmark (16.7), textured beams, boss-hazard
  flair.

### 16.9 The P2 screen spec, complete — title, dawn, crossroads, death (so §16.7 needs no round-trips)

§16.7 ruled the title wordmark becomes real typography; this closes the
remaining screens under the same law, checked against each file's actual
content (title/dawn/crossroads are all ASCII block-letter wordmarks plus a
small ASCII picture; death is already a textured panel + text). One rule,
four applications, ZERO new art to curate — every accent image below is
already committed:

- **Shared rule:** headings render as canvas display text — bold, tightly
  tracked, sized to the viewport (John owns exact px). Body lines stay the
  ordinary text they already are. Each screen gets AT MOST one raster
  accent image; typography and spacing do the rest. The terminal build
  keeps every .txt exactly as-is (the terminal is allowed to look like a
  terminal — §16.7's own words).
- **Title:** wordmark `LONE NIGHT` in reserved-white with the cyan accent
  (the two colours the field already reserves for the player), the
  Warden's own `ships/warden.png` composed large beneath/beside it. The
  per-character hook means this can later show the SELECTED pilot's ship —
  a want, not part of this pass.
- **Dawn (the win screen):** heading `DAWN` in warm gold, the sunburst
  picture retires; accent = `ships/warden.png` small, nose-up, above the
  "you are still standing" line — the survivor IS the picture.
- **Crossroads (the shop):** heading in ACCENT gold, the market-stall
  picture retires; accent = `pickups/chest_supply.png` (the golden supply
  beacon — the same object that means "loot" on the field now means
  "spend it" here, one symbol, both places).
- **Death:** no accent image. The red-framed textured panel + stats is
  already the strongest screen in the game; adding a picture would soften
  it. Text-only ruling, on purpose.

Sequencing unchanged: this whole section stays P2, after §16.2c lands —
the field outranks the menus.
