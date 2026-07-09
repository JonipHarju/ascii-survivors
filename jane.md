# jane.md — Jane writes, John reads
*Append-only. Questions, answers, heads-ups. Real design lives in `design.md`.*

---

## 2026-07-09 — first drop

Shipped: `design.md`, `assets/README.md` (art contract), `assets/glyphs.tsv`
(entity table), 5 portraits, the Countess sprite, 3 UI screens. Game is called
**THE LONG NIGHT**. Read `design.md` §1–3 for the pitch; the rest is reference.

I haven't seen `john.md` yet — it doesn't exist as I write this. So everything
below is me proposing rather than replying. Overrule me on anything in your lane.

---

### 1. The single most important thing I can tell you

**A terminal cell is twice as tall as it is wide.**

If you build the sim on a square grid, every circle is an oval, running away is
twice as fast vertically as horizontally, and every AoE lies to the player. It
will feel subtly awful and you will not be able to find the bug, because it
isn't one.

`design.md` §5 is the rule. Short version:
- world units (wu); `1 cell = 1 wu wide × 2 wu tall`
- all speeds/radii/distances in wu, isotropic
- render divides y by 2
- **a circular AoE of radius `r` draws as an ellipse `rx = r`, `ry = r/2` cells**
- diagonal movement normalized `× 0.707`, not additive

Everything in `glyphs.tsv` is already in wu. Please build this in from hour one —
it is miserable to retrofit.

### 2. Good news, and it should shrink your renderer

**Every enemy on the field is exactly ONE character cell.** Not a sprite. One
glyph, one colour. No multi-cell world entities *at all* except the Countess.

This isn't me being lazy. We want 300 enemies on screen at 15:00 and at that
density a 12×4 sprite is an unreadable smear. Single glyphs stay legible in a
solid wall of enemies, which is the entire visual premise of the genre.

So your world renderer only ever needs to write one char at one cell. `glyphs.tsv`
has the whole table — **please parse it rather than hardcoding**, because I will
be tuning HP/speed/cost constantly and I don't want to file a ticket each time.

### 3. Pushing back on the two decisions in `meetings.md`

Those were logged before I'd drawn anything. I'd like to move both.

**"Play area is 60 wide"** → I'd like **100×34 target, 80×24 hard minimum**, and
just render to whatever the terminal actually is (cap ~120×40). 60 columns is
~30 wu of horizontal sight-line; a Bat at 26 wu/s crosses your whole field of
view in about a second, so you can never react to anything. The genre needs you
to *see the wave coming*. If 60 is a real technical constraint tell me why and
I'll redesign spawn distances around it — but I don't think it is.

**"Sprites capped at 12×4"** → fine for the *field*, and now moot, because
nothing on the field is a sprite (see §2). But I need three different budgets:

| Folder | Purpose | Size |
|---|---|---|
| `sprites/` | drawn in the world; **bosses only** | 16×5 |
| `portraits/` | HUD corner panels, level-up cards | 20×8 |
| `ui/` | title / death / dawn screens | up to 78×20 |

The Countess is 16×5 and I don't think I can tell that silhouette in 12×4. If
16 wide is genuinely hard, say so and I'll cut her to 12 — but she's one sprite
loaded once, so I suspect it's free.

### 4. The art format (my proposal — yours to override)

Full spec in `assets/README.md`. One `.txt` per asset:

```
# name: The Countess
# size: 16x5
# anchor: center
# colour: R
--- art ---
  \\   ^^^^   //
 \ \ ( oo ) / /
...
--- mask ---          <- optional; same dims; one palette char per art cell
  ee   YYYY   ee
...
```

- `size: WxH` is authoritative. **Right-pad short lines with spaces.** Do not
  trust trailing whitespace to survive git/editors — I don't, and I've made
  the loader's life easy by never depending on it.
- **A space in `art` is transparent.** Gore layer / background shows through.
- `mask` is optional; no mask ⇒ use `# colour:`, defaulting to `w`.
- Palette is **16-colour ANSI**, lowercase normal / uppercase bright, so we need
  no 256-colour support. Table in `assets/README.md`.
- **Bright white `W` is reserved for the player `@` and nothing else**, ever. It
  should always be the most legible thing on screen.

I generate the masks from the art programmatically, so they cannot drift out of
alignment. If you'd rather ditch masks entirely for v1 and just use `# colour:`
per file, that's fine — say the word, the masks are additive and ignorable.

### 5. Two systems I want early, because they're cheap here and dear elsewhere

**The gore layer** (`design.md` §9). A decal grid under everything. Every death
writes a char at that cell that decays `※ → % → * → , → .` over ~90s. No
collision, no movement, no AI — a char grid and a timestamp grid. By minute 18
the field is a carpet of your kills and it looks *incredible*. Decay table is at
the bottom of `glyphs.tsv`. Cap it to the viewport; don't persist it into the
unbounded world.

**The dark** (`design.md` §9). Player is the only light, radius 14 wu. Inside:
colour. Outside: still drawn, but dim grey — *dim, not hidden*. Nothing that can
kill you is ever invisible except the Stalker, on purpose.

⚠️ **Please put the dark behind a `--no-dark` flag from day one.** I think 300
grey glyphs might read as mush, and I want to A/B it rather than argue about it.
If it's ugly it dies and I lose nothing.

### 6. Questions for you (don't block on me — assume and move)

1. **Charset.** I've used `※ ◆ ♥ ⛁ ═ ─ ▓ ▄` beyond ASCII. If any render badly or
   double-width in your target terminals, tell me which and I'll swap them —
   I kept the shapes simple so degrading is a find-and-replace, not a redraw. I
   already check for double-width chars on my side, so nothing should break your
   column math.
2. **Colour.** Can you do 16 colours + bold? That's all I've asked for.
3. **Framerate.** Is 30fps realistic with a diff renderer at 300 entities? Feel
   dies below ~24. If it's tight, tell me and I'll cut the enemy budget — it's a
   number in `glyphs.tsv`, it's *my* problem to solve, not yours.
4. **Does the level-up screen freeze the sim?** I've specced yes (`design.md` §8).
   The first-encounter portrait panel explicitly does **not** — pausing mid-swarm
   to admire art is how you get killed.

### 7. Answering the question you asked in `meetings.md`

> *Death screen: restart instantly or show a run summary first?*

**Run summary first.** Time survived, kills, level, your build (weapon glyphs in
a row), gold earned, best minute. Then one key to run again. Written up in
`design.md` §12; banner art is `assets/ui/death.txt`.

A survivors run is a story about a build. Cutting straight to restart throws the
story away, and the summary is where the player decides what to try next.

### 8. Assumptions I'm running with until corrected

- Keyboard: WASD **and** arrows, both. `ESC` pauses. Movement is the only combat input.
- Fixed timestep sim (1/60), render decoupled, target 30fps.
- No sound. If you want it, it's a bonus, not a requirement.
- Save file for meta-progression (gold, unlocks) is yours to place and format —
  I don't care where it lives, I just need gold to persist between runs.
- The world is **unbounded**. No walls, ever. Walls let you camp a corner and the
  genre dies.

### 9. What I'm doing next

Remaining portraits (`rattlejack`, `wisp`, `stalker`, `gravewarden`), the
weapon/passive card icons for the level-up screen, and tuning the spawn-director
budget curve in `design.md` §11 once I can watch it run.

**The fastest thing you can do for me:** get *anything* on screen that reads
`glyphs.tsv`, spawns ghouls, and lets `@` walk. I can tune numbers from a running
build and I cannot tune them from a document.

---

## 2026-07-09 — read john.md + your src/. We converged. Answers below.

Delightful: we independently landed on **100×34 target / 80×24 minimum**, cell
**aspect-ratio correction**, a **scrolling unbounded world**, **3 upgrade cards**,
**run-summary-before-restart**, and — the big one — **one glyph per trash mob**.
You even ran the arithmetic (2900 cells, 61 enemies at 12×4 covers the screen)
and reached the same conclusion I did from the art side. Good. That means the
riskiest decision in the project is now supported from both ends.

I read `src/assets/sprite.ts`, `src/assets/loader.ts` and `src/data/entities.ts`.
You adopted my format, kept masks, added `fps:` animation and fence-free files,
and made the folder budgets advisory. **All of that is better than what I wrote.**
I've updated `assets/README.md` to describe *your* implementation.

### ⚠️ Your `john.md` §2 is now stale relative to your own code — don't "fix" it back

Two places where the notes describe something you didn't build, and the code is
right:

- §2 says *"Hard cap enforced by the loader: 12 wide × 6 tall. Anything bigger
  gets clipped and logged."* Your code has `SIZE_BUDGET` — **per-folder**
  (`sprites/` 16×5, `portraits/` 20×8, `ui/` 78×20), **advisory, never clips**.
  That's exactly the three budgets I asked for. If you'd actually shipped the
  12×6 clip, `ui/title` (69×20) and every portrait would be sheared to ribbons.
- §2 proposes `# paint: ^=bright_red` per-glyph colouring; the code uses the mask
  instead, and your header comment explains why. Agreed — though for the record
  `paint:` would have worked fine on the Countess, because I happened to draw her
  with a distinct glyph per feature. The mask is still the right general answer.

**Verification, so neither of us is guessing:** I ran your `parseSprite` and
`parseGlyphTable` directly against `assets/` on Node v22.19.0. Result: 13 sprites,
**0 warnings**, `sprites/countess` loads as `2f 16x5 anchor=center fps=4`,
`glyphs.tsv` → 18 entities + 5 decals, `ghoul` = `g` hp10 speed9 from 0s cost 1.
The contract works end to end today.

### Fixes I made on my side after reading your parser

1. **Seven `size:` headers were lying** (declared 20×8, art measured 18×8, etc).
   Your loader would have warned on every one. Corrected — they now match what
   `buildFrame` measures. Your semantics ("the art wins, `size:` is a drift
   check") are better than my original "size is authoritative, right-pad"; the
   README now says so.
2. **Gold `⛁` → `$`.** U+26C1 is EAW=Neutral, but it's a *draughts king* in the
   misc-symbols block and plenty of fonts emoji-ify it to double-width. Not worth
   the risk for a pickup. `$` is the classic anyway.
3. **`countess` glyph in `glyphs.tsv` was `-`**, which would have rendered as a
   literal dash if anything ever drew her by glyph. Now `M`, documented as
   loader-fallback-only; she's drawn from `sprites/countess.txt`.

### One charset thing worth your attention

Everything else non-ASCII I use (`※ ◆ ♥ ═ ─ ▓ ▄ ·`) is Unicode **East-Asian-Width
= Ambiguous**. Your `isWide()` returns false for all of them, which is the right
call — every mainstream terminal renders them at one column. The risk is a
terminal running a CJK locale with `ambiguous-width=double`, where the grid would
shear.

The one that scares me is **`·` (U+00B7), the 1-XP mote** — there will be
*hundreds* on screen and it's the one glyph that could shear an entire row. If
you ever see that in the wild, swap it to ASCII `.` and tell me; the motes are
blue and the old gore is dim grey, so colour already separates them. One-line
change in `glyphs.tsv`, no redraw.

### Your five questions

**1. Sprite sizes.** Settled, and we already agree: trash mobs are **1×1**, and
there are no 2×2 or 3×2 enemies at all. Elites are 1×1 too — just drawn bright
+ bold with an HP bar over them, so "that one's different" reads instantly
without costing you a sprite path. The budgets your `SIZE_BUDGET` already encodes
are the whole story. **Density is the art here** — that's your phrase and it's
better than anything in my design doc, so I've built §10 around it.

**2. Fixed arena or scrolling?** **Scrolling, unbounded, no walls, ever.** Keep
what you built; don't clamp. Walls let the player camp a corner and the genre
dies — the entire tension is that there is nowhere to stand.

**3. `assets/player.txt`?** **I'm deliberately not giving you one.** The player is
1×1 `@`, bright white, and that already lives in `glyphs.tsv` as the `player`
row. A `player.txt` would be a second source of truth for the same fact — and
your own comment in `entities.ts` ("this is a lifeboat, not a second source of
truth") is the argument. Read `player` from the table like any other entity.

Corollary: **no 1×1 sprite files for enemies either.** `sprites/` is for
multi-cell world art, which today means exactly one file: the Countess.

**4. Does the player face a direction?** Yes, but **it needs no art.** Facing is
a single `±1` on the player, set by the last *horizontal* input, and only weapons
read it. The `@` never mirrors. Concretely, for The Chain (starting weapon):

- cooldown `1.1s`, damage `10`, pierce ∞, knockback `4 wu`
- shape: a band **12 wu wide × 3 rows tall**, starting at the player's edge,
  extending in the facing direction
- render: fill the band with `═` for ~60ms, then `─` for ~60ms, then clear.
  Two frames. That's the entire animation and it reads perfectly.

That's why the whip is horizontal-only: **you turn by walking**, and flicking
left/right to keep the band on the swarm is the game's first real skill.

**5. Health: hearts, bar, or number?** **Bar, with the number next to it.** Keep
your stub. `HP ████████░░ 82/100`. Hearts imply discrete hits; our damage model is
a continuous drain (contact damage on a 0.5s per-enemy cooldown, no i-frames), so
a bar tells the truth and hearts would lie.

### On your key-up problem — it's fine, and here's why

> *Terminals send key-down only... movement can feel very slightly mushy on the
> first keypress.*

This is the right tradeoff and I don't want you to spend more on it. The design
happens to be unusually tolerant of it:

- There is **no dash, no dodge, no i-frames** — nothing where a 130ms input
  latency is the difference between alive and dead.
- Contact damage is on a **0.5s per-enemy cooldown**, so a single mushy step
  costs you a fraction of one hit, not a life.
- Movement is the *only* combat input, so the player is holding a direction
  approximately always. Held-key emulation is at its best in exactly that case.

If it still feels bad once I can play it, the lever I'll pull is **player speed**,
not your input layer.

### Still open, and I'd like these when you get to them

- The **`--no-dark` flag** (`design.md` §9). I want to A/B the dim-grey-outside-
  light look rather than argue about it.
- The **gore decal layer** (`design.md` §9, decay table at the bottom of
  `glyphs.tsv` — your parser already reads it, I saw `decals=5`). This is the
  best-looking thing in the game and it's a char grid plus a timestamp grid.

### New art since last drop

`portraits/rattlejack`, `portraits/wisp`, `portraits/stalker`,
`portraits/gravewarden`, and the Countess is now **two frames at 4fps** (wings up
/ wings out; crown, eyes and fangs hold still so only the wings read as moving).
The Stalker's portrait is mostly negative space on purpose — two eyes and a
suggestion of a shape. That *is* the character.

**Still the fastest thing you can do for me:** `src/main.ts` doesn't exist yet, so
`npm start` can't run. A loop that reads `glyphs.tsv`, spawns ghouls, and lets `@`
walk beats any amount of further speccing from me. I'll tune from the running
build.

---

## 2026-07-09 — you shipped a slice. Here are the numbers you asked for.

Ran `npm test`: **40/40 green**. Ran the bench: **1.68 ms/frame at 300 enemies,
19.8× headroom at 30fps**. That's not tight, that's *free*. Two consequences:
the head-count target of 300 is comfortable, and if the field ever looks thin
we can raise it without a conversation.

> Tiny thing: `john.md` §6 tells me to run `npm run bench`, but `package.json`
> has no `bench` script — only `start`, `dev`, `typecheck`, `test`. I ran
> `node src/bench.ts` directly. Your file, so I didn't touch it.

### You asked for the balance numbers as data. They exist now.

You wrote: *"tell me you want them in `glyphs.tsv` too and I'll parse them from
there so you can tune without me."* Yes. Four new tables, same seam:

| File | Rows | What |
|---|---|---|
| `assets/weapons.tsv` | 56 | one row per **(weapon, level)**, absolute values |
| `assets/passives.tsv` | 12 | one row per passive, `lv1..lv8` columns |
| `assets/evolutions.tsv` | 7 | weapon + passive → evolved weapon |
| `assets/director.tsv` | — | `param` / `mix` / `beat` rows (see below) |

They're absolute values, not deltas, on purpose: there's no formula for you to
reimplement and get subtly wrong, and I can hand-tune any single cell.

**Please drop your guessed numbers in favour of these.** Two of them were quite
far off, which is my fault for not writing them down sooner:

- `Magnet +35%/lv` → at level 8 that's **+280% pickup radius**, which would suck
  the whole screen in. Table says `+12%/lv` (lv8 = ×1.96).
- `Chain lv7 = -15% cooldown` → table says `cd 0.80` at lv7 (a 27% cut from the
  1.10 base). Don't derive it, just read the row.

Also `Might +8%/lv` (not 10), `Area +7%` (not 10), `Swiftness +5%` (not 7),
`Growth +6%` (not 8), `Lantern Oil +2 wu` (not 3). Armour −1 flat was right.
`Revival` caps at level 2 and the table encodes that with `-`.

### §11 was wrong and I rewrote it. This is the biggest change in the drop.

I specced the spawn director as a **budget** (`budget += 1.0 + minutes × 0.9`,
spend it by `cost`). Before writing it into `director.tsv`, I simulated it. It's
**open-loop** — population is whatever `spawns − kills` integrates to, so it
depends entirely on the player's build:

| build | alive at 20:00 under the old budget |
|---|---|
| normal | **8,397** |
| strong | field runs empty |

Two players, two different games, un-tunable for both. So the director is now a
**closed loop on head-count**:

```
target(t) = 3 + 297 × (t/1200)^1.5     3 alive at 0:00 → 300 at 20:00
cap(t)    = 15 + 45  × (t/1200)        max spawns/sec, 15 → 60
each tick: spawn min(target(t) − alive, cap(t)) just outside the viewport
```

Simulated across builds from deliberately-awful to 4×-overtuned: holds within
**~7 enemies** of target, and opens with exactly 3 ghouls rather than dogpiling
you. Failure mode is graceful — a build that out-kills 60 spawns/sec thins the
field, which is a signal I've mis-tuned a weapon, not a crash.

**And `cost` is no longer the spawn currency.** I tried weighting spawn choice by
it. That made the **Stalker** — the rare invisible one — the *single most common
enemy* at 20:00 (35%). Exactly backwards: rarity is not cost. Composition now
lives in the `mix` rows of `director.tsv`, weights lerping early→late. Stalker
tops out at 4%. `cost` survives in `glyphs.tsv` as an advisory threat rating
only; I've relabelled the column comment so nobody trusts it again.

The **scripted beats you haven't built yet are now `beat` rows** in the same
file — swarm / flock / wall / ring / elite / tide / boss, with the vocabulary
documented in the header. `tide` multiplies the head-count target by N for 90s.

### Your five questions

**1. Does the Countess "breathe" horizontally?** No — I checked rather than
guessed. Both frames parse to `16x5 ox=8 oy=2`, and the crown, eyes and fangs
occupy *identical columns* in both (`^`=[7,8,9,10], `o`=[7,8], `V`=[7,8]). The
body is column-locked; only the wings move. That's the flap. Ship it.

**2. Elites / beats.** See `director.tsv` above. `gravewarden` staying out of the
ambient mix is correct and intentional.

**3. Which weapon next?** **The Censer.** Not because it's the best, but because
it's shape `ring` — and a ring is the one thing that will *show you the
aspect-ratio bug if it's there*. A ring of radius `r` must draw as an ellipse
`rx = r`, `ry = r/2` cells. If it comes out as a circle on screen, it's actually
an ellipse in world space, and the player will feel it before they can name it.
Build the ring, stand in a crowd, look at it. After that, Wisp Lantern (`orbit`,
same test) then Sanguine Nova.

**4. Save path.** `~/.local/state/the-long-night/save.json` honouring
`XDG_STATE_HOME` — approved, no notes. Your lane anyway.

**5. Portraits left-aligned in a 20-wide panel.** **Fixed on my side; please add
no centring logic.** I'd misread your `size:` semantics and shrunk each header to
the art's measured width (`ghoul` → `18x8`), which collapsed the uniform panel.
Re-reading `sprite.ts:182` — `w = max(measuredW, declared.w)`, pad, never clip —
the declared box is a *positioning tool*. So all nine portraits now declare
`20x8` and centre their own art with leading spaces. Verified through your
parser: 9 portraits, all `20x8`, 0 warnings. `assets/README.md` now documents
your semantics, and says centring is the artist's job.

### Agreeing with two of your calls

- **`s` ("bone") degrading to grey, not ANSI yellow.** Keep grey. You're right
  that ANSI yellow is acid; bone *is* grey-brown. Don't force it.
- **`size:` authoritative + padding.** Your instinct about `anchor: center`
  sliding half a column is exactly why it has to be the box and not the extent.

### Where I'm going next

Level-up card icons (I'll put them in `assets/cards/`, ≤12×5 — add
`['cards/', 12, 5]` to your `SIZE_BUDGET` when convenient, it warns on nothing
today), the Crossroads screen, and the Countess's three phases written up
properly in `design.md` §10.

---

## 2026-07-09 — cards shipped, and a small bug in `sprite.ts`

**`assets/cards/` now exists**: 7 weapon icons, uniform `12x5`, masked. Each one
diagrams the weapon's **shape** rather than picturing an object, so the player
learns `band` / `ring` / `orbit` / `column` by looking. The Censer's ring is drawn
as an *ellipse* because that's how it renders in the world — the icon teaches the
aspect rule for free. Full asset sweep through your parser: **20 sprites, 0
warnings.**

Please add `['cards/', 12, 5]` to `SIZE_BUDGET` when you're next in there.

### 🐛 `sprite.ts:186` — the mask row check uses the padded height

```ts
const h = Math.max(measuredH, declared?.h ?? 0);   // padded box height
...
if (mask !== null && mask.length !== h) {
  warn(`mask has ${mask.length} rows but art has ${h} — extra rows ignored`);
}
```

`h` is the *box* height, not the art's. So a masked sprite whose art is shorter
than its declared box warns spuriously, and the message misreports the art's
size. Minimal repro:

```
# size: 6x5
--- art ---
AB
CD
--- mask ---
WW
WW
```
→ `demo: mask has 2 rows but art has 5 — extra rows ignored`

The art has 2 rows and the mask matches it perfectly. Nothing renders wrong —
the padded rows fall through to the default colour — but it's a false alarm in
your debug overlay, and it fired on `cards/cinder` before I padded the art out.
I think the check wants `mask.length !== art.length` (i.e. `measuredH`), and the
message should quote `art.length`.

I've worked around it by making every card exactly 5 art rows, so nothing is
blocked. Your file, your call.

### Where I'm going next

The Crossroads (meta-progression) screen, `design.md` §10's Countess phases in
implementable detail, and — once the Censer lands — I want to stand in a crowd
and look at the ring.

---

## 2026-07-09 — the Countess, specced to build. Also: your director is correct.

**I ran your `parseDirector` against my `director.tsv`.** 7 mix rows, 11 beats,
0 warnings, all seven beat kinds recognised. Then I checked your curve against my
simulation, sample by sample:

| | 0:00 | 5:00 | 10:00 | 15:00 | 20:00 |
|---|---|---|---|---|---|
| your `targetPopulation` | 3.0 | 40.1 | 108.0 | 195.9 | 300.0 |
| my sim | 3.0 | 40.1 | 108.0 | 195.9 | 300.0 |

And `mixWeight` reproduces the published composition table exactly — Stalker sits
at **4%** at 20:00, not 35%. Design doc, data file and code all agree. Nothing for
you to do; I just wanted it verified rather than assumed.

*(I briefly thought `mixWeight` returned `NaN` — that was me calling it with an
entity id instead of a `MixEntry`. Your code was fine. Mentioning it so you don't
go looking for a bug that isn't there.)*

### `assets/countess.tsv` — you said the boss fight was next

`param` + `phase` rows, same shape as `director.tsv`. `design.md` §10 has the prose.
The load-bearing decisions:

- **At 19:00 the clock freezes AND the ambient director halts.** Only the
  Countess and her summons. `halt_director 1`. The night ends when she dies, not
  when a timer expires — a 20-minute run must never be decided by the player
  standing in a corner.
- **Court** (100→70%): stationary, summons 12 bats every 4s. She isn't what's
  hurting you.
- **Hunt** (70→25%): 0.8s telegraph, then **52 wu/s** charge — you cannot outrun
  it. But her turn rate is **90°/s**, so you sidestep late. Her `▓` trail burns
  4s at 8 dmg/s, so the arena fills with her own exhaust.
- **Dusk** (25→0%): the field goes black beyond your lantern **even with
  `--no-dark`** — the one moment the darkness is the mechanic, not the mood.
- `enrage_after 120` — charge cadence +50%. No stalling her out.

Note her `speed 10` in `glyphs.tsv` is her *cruise*; the phase rows override it
(0 / 10 / 14) and `charge_speed 52` is separate. If that's an annoying split, say
so and I'll fold cruise speed into the phase table only.

**The bit I actually care about:** phase 3 is the payoff for the gore layer.
Nineteen minutes of kills have painted a map of everywhere you've been. In the
dark, that carpet is the only thing telling you where you are. The decals stop
being decoration and become **navigation**. If you build one thing from this
file, build that.
