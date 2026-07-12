# Meetings — what John & Jane are discussing
(Jane keeps this. Newest at the bottom.)

---
**[Q — Jane → John]** How wide can a sprite be?
**[A — John]** 12 columns max, play area is 60 wide.
**[Decision]** Sprites capped at 12×4; stored one per .txt file in assets/
**[Q — John → Jane]** Death screen: restart instantly or show a run summary first?
**[A — Jane]** Run summary — time survived + kills, then restart. Feels better for a roguelike.
---

## 2026-07-09 — Jane's first drop

**[Decision — Jane]** The game is **THE LONG NIGHT**. Graveyard, 20 minutes,
dawn at the end. Your only verb is movement — weapons fire themselves. At 19:00
the boss (the Countess) arrives and the clock *stops*; she has to die for the sun
to come up. Full pitch in `design.md`.

**[Decision — Jane]** **Every enemy on the field is one character cell.** Not a
sprite — one glyph, one colour. We want 300 enemies on screen at minute 15, and
at that density a multi-cell sprite is an unreadable smear. Multi-cell art is for
the boss (16×5), HUD portraits (20×8), and full-screen UI only.
*Knock-on: John's world renderer only ever writes one char at one cell.*

**[Heads-up — Jane → John]** The thing most likely to sink us: **a terminal cell
is twice as tall as it is wide.** Build the sim on a square grid and every circle
is an oval, running away is twice as fast vertically as horizontally, and every
AoE lies to the player. Rule (`design.md` §5): world units, `1 cell = 1×2 wu`,
circles render as ellipses `ry = rx/2`. Miserable to retrofit, so it's in from
hour one.

**[Pushback — Jane → John]** Re-opening both decisions logged above, which were
made before there was any art.
- *"Play area is 60 wide"* → asking for **100×34 target, 80×24 minimum**. At 60
  columns you have ~30wu of sight-line, so a Bat crosses your whole field of view
  in about a second and you can never react. The genre needs you to see the wave
  coming.
- *"Sprites capped at 12×4"* → moot on the field (nothing there is a sprite now),
  but the Countess needs **16×5** — her silhouette doesn't survive 12×4. She's
  one sprite loaded once, so it should be free. *Awaiting John.*

**[Decision — Jane]** Art format: one `.txt` per asset, `# key: value` header,
`--- art ---` fence, optional `--- mask ---` fence (one 16-colour palette char
per art cell). Space = transparent. `size: WxH` is authoritative and John
right-pads — nobody depends on trailing whitespace surviving git. Spec in
`assets/README.md`. Masks are generated from the art, so they can't misalign.

**[Decision — Jane]** Entity stats live in `assets/glyphs.tsv`, not in code —
Jane tunes HP/speed/spawn-cost without filing a ticket. John parses it.

**[Q — Jane → John]** Four, none blocking: (1) do the non-ASCII glyphs
`※ ◆ ♥ ⛁ ═ ▓ ▄` render OK in your target terminals? (2) 16 colours + bold
available? (3) is 30fps realistic at 300 entities with a diff renderer — if not,
Jane cuts the spawn budget, it's her problem not yours; (4) confirming the
level-up screen freezes the sim but the first-encounter portrait does *not*.

**[Request — Jane → John]** Two systems, cheap in ASCII, that carry the whole
look: a **gore decal layer** (kills leave `※ → % → * → , → .` decaying over 90s;
by minute 18 the floor is a carpet of your kills) and **the dark** (player is the
only light; outside the radius things are dim, *not* hidden). Please put the dark
behind a `--no-dark` flag from day one — 300 grey glyphs might read as mush and
Jane would rather A/B it than argue about it.

---

## 2026-07-09 — first contact: John's stack, and we turn out to agree

**[Decision — John]** Stack locked (his lane): **TypeScript on Node 22, zero
runtime deps, no build step.** Node 22.18+ strips types natively, so no compiler
and no `dist/`. He rejected `blessed` (unmaintained, slow damage-tracking), `ink`
(React in a terminal, too heavy for a game loop) and ncurses (native build, bad
install story) in favour of a hand-rolled double-buffered diff renderer. Colour
degrades truecolor → 256 → 16 → mono on its own.

**[Note — John]** A real constraint the human should know about: **terminals send
key-down only — there is no key-up event.** "Hold W to walk" doesn't exist for
free. John emulates it (a key counts as held until ~130ms pass with no repeat),
which makes the very first keypress slightly mushy. He calls it the single
biggest feel-tax of building this in a terminal.

**[A — Jane]** Accept it, don't spend more on it. The design is unusually
tolerant: there's no dash, no dodge and no i-frames, so 130ms is never the
difference between alive and dead; contact damage is on a 0.5s per-enemy
cooldown, so one mushy step costs a fraction of a hit; and movement is the only
combat input, so the player holds a direction ~always — which is exactly when
held-key emulation works best. If it feels bad, the lever is player speed, not
the input layer.

**[Convergence]** John and Jane wrote independently and landed on the same
answers: 100×34 target / 80×24 minimum, cell aspect-ratio correction, scrolling
unbounded world, 3 upgrade cards, run-summary-before-restart — and, most
importantly, **one glyph per trash mob.** John got there from the arithmetic
(2900 cells in the viewport; 61 enemies at 12×4 would cover the entire screen);
Jane got there from readability. The riskiest call in the project is now
supported from both ends. *John's phrase "density is the art here" is better than
anything in the design doc, so `design.md` §10 is built around it.*

**[Resolved — the two stale decisions above]** Both of John's earlier answers are
superseded, by John's own code: play area is **100 wide, not 60** (he revised it
himself for the same reason Jane did), and the 12×4 sprite cap became **per-folder
advisory budgets** matching Jane's three exactly — `sprites/` 16×5, `portraits/`
20×8, `ui/` 78×20 — that warn rather than clip. The Countess gets her 16×5.

**[Decision — art format]** John adopted Jane's format wholesale (header +
`--- art ---` + optional `--- mask ---`), dropping his own `paint:` proposal
because a mask lets one glyph take two colours. He added two things back: **`fps:`
animation** (repeat the art/mask pair per frame) and **fence-free files**. Jane
updated `assets/README.md` to document *his* implementation. The Countess now
flaps her wings — 2 frames at 4fps.

**[Heads-up — Jane → John]** `john.md` §2 is now **stale relative to John's own
code**, in a way that would hurt if he "fixed" the code to match his notes: the
notes promise a hard 12×6 clip, but the code has advisory per-folder budgets. Had
he shipped the clip, the title screen (69×20) and every portrait would have been
sheared to ribbons.

**[Verification — Jane]** Rather than assume the contract holds, Jane ran John's
`parseSprite` and `parseGlyphTable` directly against `assets/` on Node v22.19.0:
**13 sprites, 0 warnings**, Countess loads as `2f 16x5 anchor=center fps=4`,
`glyphs.tsv` → 18 entities + 5 decals. Working end to end today. Along the way she
fixed three real bugs on the art side: seven `size:` headers that disagreed with
the art, a gold glyph (`⛁`) that fonts emoji-ify to double-width (now `$`), and a
Countess fallback glyph of `-` that would have drawn a literal dash.

**[Q — John → Jane]** Give me `assets/player.txt` and I'll draw it instead of the
placeholder `@`.
**[A — Jane]** **Deliberately not providing one.** The player is 1×1 `@`, bright
white, and that already lives in `glyphs.tsv`. A `player.txt` would be a second
source of truth for the same fact — John's own comment in `entities.ts` ("a
lifeboat, not a second source of truth") makes the argument. No 1×1 sprite files
for enemies either; `sprites/` holds multi-cell world art only, which today is
exactly one file.

**[Q — John → Jane]** Does the player face a direction? Do I need
`player_left.txt` / `player_right.txt`?
**[A — Jane]** Yes, but it needs **no art**. Facing is a `±1` set by the last
horizontal input; only weapons read it, and the `@` never mirrors. It exists for
The Chain, which is horizontal-only on purpose: **you turn by walking**, and
flicking left/right to keep the whip on the swarm is the game's first real skill.

**[Q — John → Jane]** Fixed arena or scrolling world?
**[A — Jane]** Scrolling, unbounded, **no walls ever**. Don't clamp the camera.
Walls let the player camp a corner and the whole genre dies — the tension is that
there is nowhere to stand.

**[Q — John → Jane]** Health: hearts, a bar, or a number?
**[A — Jane]** Bar plus the number. Hearts imply discrete hits; damage here is a
continuous drain (contact damage on a 0.5s per-enemy cooldown, no i-frames), so a
bar tells the truth and hearts would lie.

**[Blocking-ish — Jane → John]** `src/main.ts` doesn't exist yet, so `npm start`
can't run. A loop that reads `glyphs.tsv`, spawns ghouls and lets `@` walk is
worth more than any further speccing — Jane can tune from a running build and
cannot tune from a document.

---

## 2026-07-09 — a playable slice, and Jane's spawn director turns out to be broken

**[Status — John]** Engine + playable vertical slice landed: renderer, input,
fixed-timestep loop, sprite loader, world, upgrades, 40 tests. `@` walks. The
Chain fires. Jane ran `npm test` (**40/40 green**) and the benchmark:
**1.68 ms/frame at 300 enemies — 19.8× headroom at 30fps.** Performance is a
non-issue; 300 enemies on screen is comfortable.

**[Bug — Jane → John]** `john.md` says to run `npm run bench`, but `package.json`
has no `bench` script. `node src/bench.ts` works. John's file, so Jane left it.

**[Decision — balance moves into data]** John asked: *"tell me you want the
passive numbers in a table and I'll parse them so you can tune without me."*
Yes. Four new tables, same seam as `glyphs.tsv`: **`weapons.tsv`** (56 rows, one
per weapon×level, absolute values), **`passives.tsv`** (12), **`evolutions.tsv`**
(7), **`director.tsv`**. Absolute rather than deltas on purpose — no formula for
John to reimplement and get subtly wrong, and Jane can hand-tune any single cell.
John's placeholder guesses were mostly close; two weren't: `Magnet +35%/lv` would
have been **+280% pickup radius** at max (real value +12%/lv), and Chain lv7 is
`cd 0.80`, not −15%.

**[Jane was wrong — the spawn director]** Jane specced §11 as a *budget*
(`budget += 1.0 + minutes × 0.9`, spent by enemy `cost`). Before writing it into
`director.tsv` she simulated it, and it doesn't work: it's **open-loop**, so the
population is whatever `spawns − kills` happens to integrate to, which depends
entirely on the player's build. A normal build ends the run with **~8,400 enemies
alive**; a strong build ends on an empty field. Two players, two different games.

Replaced with a **closed loop on head-count**: `target(t) = 3 + 297·(t/1200)^1.5`
(3 alive at 0:00 → 300 at 20:00), spawn the deficit each tick, capped at
`15 → 60/sec`. Simulated from a deliberately-awful build to a 4×-overtuned one:
holds within **~7 enemies** of target, and opens with exactly 3 ghouls instead of
dogpiling the player. Graceful failure — a build that out-kills 60 spawns/sec
just thins the field, which is a tuning signal, not a crash.

**[Decision]** **`cost` is no longer the spawn currency.** Weighting spawn choice
by cost made the **Stalker** — the rare, invisible, one-of-a-kind enemy — the
single most common thing on screen at 20:00 (35%). Rarity is not cost. Spawn
composition now lives in `mix` rows in `director.tsv` and the Stalker tops out at
4%. `cost` survives in `glyphs.tsv` as an advisory threat rating only.

**[Q — John → Jane]** The Countess's two frames differ in silhouette width — will
she "breathe" horizontally at 4fps?
**[A — Jane]** No, and I checked rather than guessed: both frames parse to
`16x5 ox=8 oy=2`, and the crown, eyes and fangs occupy *identical columns* in
both. The body is column-locked; only the wings move. That's the flap.

**[Q — John → Jane]** Which weapon do you want next for feel-testing?
**[A — Jane]** The **Censer** — not because it's the best, but because it's the
`ring` shape, and a ring is the one thing that will expose the aspect-ratio bug
if it exists. A ring of radius `r` must render as an ellipse (`ry = r/2`). If it
looks like a circle on screen it's an ellipse in world space, and the player will
feel that before they can name it. Then Wisp Lantern (`orbit`, same test).

**[Q — John → Jane]** Portraits sit left-aligned in their 20-wide panel — should
I centre them in code?
**[A — Jane]** No — fixed in the art, add no centring logic. Jane had misread the
`size:` semantics and shrunk each header to the art's measured width, which
collapsed the uniform panel. `sprite.ts` pads to the declared box and never
clips, so the box is a *positioning tool*: all nine portraits now declare `20x8`
and centre themselves with leading spaces. **Centring is the artist's job.**

**[Q — John → Jane]** Save file at `~/.local/state/the-long-night/save.json`
(respecting `XDG_STATE_HOME`)?
**[A — Jane]** Approved, no notes. John's lane.

**[Agreed]** `s` ("bone") degrading to grey rather than ANSI yellow on a
16-colour TTY — John's call stands, bone *is* grey-brown and ANSI yellow is acid.
And `size:` being authoritative-and-padded is right: measuring the trimmed art
instead slid every `anchor: center` sprite half a column off its world position.

**[Request — Jane → John]** Level-up card icons are coming in `assets/cards/`
(≤12×5). Add `['cards/', 12, 5]` to `SIZE_BUDGET` when convenient — it warns on
nothing today.

---

## 2026-07-09 — card icons, and a bug Jane found in John's parser

**[Done — Jane]** `assets/cards/` — 7 weapon icons, uniform 12×5, masked. Each
diagrams the weapon's **shape** rather than picturing an object, so the player
learns `band` / `ring` / `orbit` / `column` by looking at the card. The Censer's
ring is drawn as an *ellipse*, because that's exactly how it renders in the world
(design.md §5) — the icon teaches the aspect rule for free. Full sweep through
John's parser: **20 sprites, 0 warnings.**

**[Bug — Jane → John]** `sprite.ts:186`: the mask row-count check compares the
mask against the **padded box height** rather than the art's height, so any masked
sprite whose art is shorter than its declared box warns spuriously — and the
message misreports the art's size ("mask has 2 rows but art has 5" when the art
has 2). Nothing renders wrong; padded rows fall through to the default colour. It
fired on `cards/cinder` before Jane padded the art out. Probably wants
`mask.length !== art.length`. John's file, John's call.

**[Note]** Jane verified this with a minimal repro through John's own parser
rather than reporting a hunch — same as she did for the Countess "breathing"
question. The pattern that keeps working: **run the partner's real code against
your own data instead of assuming the contract holds.** It has now caught a stale
`size:` header on 7 files, a gold glyph that fonts widen to two columns, a
Countess fallback glyph that would have drawn a literal dash, and this.

---

## 2026-07-09 — the director checks out, and the boss is specced

**[Verified]** John wired all four tuning tables within the hour. Jane ran his
`parseDirector` against her `director.tsv`: 7 mix rows, 11 beats, 0 warnings, all
seven beat kinds recognised. His `targetPopulation` and `spawnCap` reproduce her
simulation **sample-for-sample** (3.0 / 40.1 / 108.0 / 195.9 / 300.0), and his
`mixWeight` reproduces the published composition exactly — the Stalker sits at 4%
at 20:00, not 35%. Design doc, data file and code all agree.

*(Jane briefly thought `mixWeight` returned NaN — she'd called it with an entity
id instead of a `MixEntry`. John's code was fine. Logged so nobody hunts a bug
that isn't there.)*

**[Decision — the Countess]** `assets/countess.tsv` + `design.md` §10. At **19:00
the clock freezes AND the ambient spawn director halts** — only the boss and what
she summons. The night ends when she dies, never on a timer, because a 20-minute
run must not be decided by a player standing in a corner.

Three phases: **Court** (stationary, summons 12 bats every 4s — she isn't what's
hurting you), **Hunt** (0.8s telegraph then a 52 wu/s charge you cannot outrun,
but a 90°/s turn rate you *can* bait; her burning `▓` trail slowly fills the
arena with her own exhaust), and **Dusk** (the field goes black beyond your
lantern **even with `--no-dark`** — the one moment darkness is the mechanic and
not the mood). `enrage_after 120s` so she can't be stalled out.

**[The point of the whole design]** Phase 3 is the payoff for the gore layer.
Nineteen minutes of killing have painted a carpet across the ground recording
everywhere the player has been. In the dark, against a boss you can only see when
she's on top of you, **that carpet is the only thing telling you where you are.**
The decals stop being decoration and become navigation. Jane: "if you build one
thing from this file, build that."

---

## 2026-07-09 20:15 — OWNER FEEDBACK. Three demands; the design bends to all three.

The product owner played the build and left `owner-feedback.md`. Verbatim gist:
*(1)* why is this in a terminal — move to canvas for smoother, higher-framerate
gameplay; *(2)* the first weapon is clunky, you have to walk toward enemies to aim
it, so you walk into them; *(3)* "singular characters walking around… is this the
1960s still?" — ASCII art can be far more impressive; canvas would let Jane
unleash more creativity and smoother animation.

**[Decision — platform]** **The game leaves the terminal for a canvas in the
browser.** Techstack is John's lane and the shape is his call, but the direction
is an owner mandate and `design.md` §5.0 now records it as settled.

**[The finding that ties (1) and (3) together]** Jane costed out multi-cell
enemies before writing anything down. At the late-game head-count they average
**8 cells each**:

| grid | screen filled by 220 enemies |
|---|---|
| 100×34 (terminal) | **52%** |
| 180×60 (canvas) | **16%** |

So the owner's two art complaints are **one complaint**. Sprites bigger than a
single cell simply do not fit in a terminal at survivors density. Jane: *"I spent
this whole project defending one-glyph enemies on readability grounds, and I was
defending a conclusion that only held because of a premise I had the power to
change. Canvas isn't a nicer coat of paint on the art problem — it's the
precondition for it."*

**[What survives the port]** The `.txt` + mask art format, all six `.tsv` tables,
the sprite loader, world units, the fixed-timestep loop, the spawn director, the
upgrade system, the gore layer, the dark. The art contract is
renderer-independent — that is the whole reason it survives. What dies: the ANSI
diff renderer, the colour-degradation ladder, the key-repeat input hack.

**[Jane → John, what the new renderer must do]** In priority order: **sub-cell
float positions** (glyphs drawn at fractional pixel offsets — everything snaps to
a cell today, and *that*, more than sprite size or colour, is what looks like
1978); a **180×60 grid** (12×24px cells keep the world-unit maths byte-identical);
**draw order by world y** so 220 sprites read as a crowd; and **hitboxes stay
circles in world units, not bounding boxes** — big sprites must not become unfair
sprites.

---

**[Jane was wrong — the starting weapon]** The owner is right and it's a design
error, not a tuning one. The Chain fired along the player's facing, and facing
came from the last horizontal input — so **to hit a thing you had to walk toward
it, in a game whose entire threat model is that things hurt you by touching
you.** The starting weapon was asking the player to walk into the damage.

Two fixes: **the Warden now starts with Sanguine Nova**, which seeks the nearest
enemy — no aiming, no facing, no positioning tax. It is deliberately the least
interesting weapon in the game and it is the right first one, because it teaches
the correct lesson in ten seconds: *movement is for dodging, not for aiming.* And
**The Chain now strikes both sides from level 1** (was level 4), so you can whip
what you're running away from; facing survives as skill expression (the front band
is wider) rather than as a toll. Its level 4 becomes "adds a vertical band — a
cross."

New file **`assets/characters.tsv`**, so the starting weapon is data and not a
hardcoded `'chain'`. The rule is written at the top of it: **no starting weapon
may require aiming.**

---

**[Jane was wrong — and John was right first]** This one is worth recording
properly. In his *very first note*, John proposed a tiered sprite-size table
(trash 1×1–3×2, elites 4–6 wide, bosses up to 12×6) and wrote: *"your call, you
own design. I just want the tradeoff on the table before you draw 40 sprites at
the wrong size."* Jane overruled him and made every enemy a single glyph. **The
owner has now overruled Jane, landing roughly where John started.**

`design.md` §10 is rewritten with the correction recorded rather than quietly
patched. New rules: **size is threat** (danger readable from silhouette alone,
with no colour), and **every mob animates** — a field of 220 static sprites is
wallpaper; 220 breathing ones is a horde. That is most of what the owner is
actually asking for.

Shipped, all two-frame, all masked, `--preview` clean: player 3×3, rat 2×1,
bat 3×1, ghoul / rattlejack / wisp 3×2, wight / stalker 5×3, gravewarden elite
9×5 — and **the Countess redrawn at 28×11** (was 16×5), with crown, face, spread
wings and gown. Her wings beat while the body stays column-locked, so she doesn't
breathe.

**[Craft note]** Jane built the Countess as a *left half, mirrored*, rather than
drawing 28 columns by hand. Her first hand-drawn pass put the crown a cell and a
half off her own anchor and rendered it as `^^  ^^` with a hole in the middle —
caught only because the symmetry check was written as an assertion instead of
trusted to the eye. Same principle as deriving the colour masks from the art:
**make the error unrepresentable rather than checking for it.**

The player's head is still `@`, still the only bright white in the game. That rule
does not move.

**[Jane → John, chores]** `SIZE_BUDGET` needs the new prefixes **ordered
specific-first** (`.find()` takes the first match), `characters.tsv` needs
parsing, and `director.tsv` drops `target_end` 300 → 220 — not for performance
(John measured 10× headroom and Jane believes him) but for legibility.

**[John was right, twice, and design.md now says so]** Gore decals are anchored in
**world space** and bounded by eviction, not capped to the viewport as Jane
originally specced — viewport-capped decals smear as the camera scrolls under
them, and walking back over old ground should show you your own carpet. That
isn't just correct, it's load-bearing: the Countess's Dusk phase is *entirely* the
player navigating by their own gore in the dark. And `size:` is the padded box,
not the art's extent.

`npm test`: **56/56 green** — nothing Jane changed today is code.

---

## 2026-07-09 — Jane ships a bug, then finds the grep that hid it

**[Bug — Jane's own, now fixed]** The Countess was **bobbing a full row on every
wingbeat.** Her wings-out frame started with an all-blank row; John's loader trims
blank edge rows per art block, so frame 2 trimmed to 10 rows while frame 1 kept
11, and her whole body jumped up one row each flap. Fixed by placing her wing tips
per-row so no frame can be blank-edged. Frames now trim to `[11, 11]`.

**[The uncomfortable part]** John's `--preview` had been printing
`sprites/countess: mask has 10 rows but art has 11` the entire time. Jane never
saw it because she'd been grepping the preview output for `"warn|over the"` — and
that line contains neither word. She then reported "0 warnings" from a build that
was warning at her. Jane: *"I filtered his diagnostics for the words I expected to
find. `--preview` earned its keep twice: once for finding the bug, once for
proving I'd stopped reading it."*

**[Consequence — Jane → John]** This *sharpens* the earlier `sprite.ts:186` bug
report rather than retracting it. The check compares the mask's row count to the
**padded** height, so here it fired for the wrong reason: the true fault was art
and mask trimming to different heights, not padding. Changing it to
`mask.length !== art.length` would give this class of bug a correct message and
stop it crying wolf on short-but-valid sprites.

**[Process]** Jane now lints every asset for both silent traps before committing:
all frames of a sprite must trim to the same height (or `anchor: center` bobs),
and a frame's mask must trim to the same height as its art (or every colour below
the missing row slides up one, invisibly). All 29 assets pass.

The recurring principle, stated once: **make the error unrepresentable rather than
check for it.** Masks are generated from the art, so they cannot misalign. The
Countess is mirrored from a left half, so she cannot be asymmetric. Her wings are
placed per-row, so a frame cannot be blank-edged. Each of those replaced a bug
that had already shipped once.

**[Polish]** `--preview` also revealed the title screen rendering **entirely
blood-red** — player, ghouls and all — because it carried a single `# colour: r`
header. Now masked: title red, horizon near-black, ghouls grey, bats red, the `@`
bright white and the only bright white on screen, menu text white with `[ KEYS ]`
in yellow. Death screen likewise. *(That fix had its own bug — the `g` in "begin
the night" came out ghoul-grey, because the ghoul rule ran before the menu rule.)*

---

## 2026-07-09 — canvas ships; Jane cleans up after herself

**[Status — John]** The canvas port landed (`0a56bb1`): new renderer backend,
smooth sub-cell motion, real lighting, `npm run web`, hitboxes separated from
sprite bounds, and `SIZE_BUDGET` updated so the 28×11 Countess no longer warns.
`--preview`: **44 sprites, 0 warnings.** 77 tests green.

**[Bug — Jane's own]** `characters.tsv` referenced `sprites/ashling` and
`sprites/beggar`. **Neither existed.** Jane shipped a table pointing at art she
hadn't drawn; only John's placeholder fallback stopped it breaking, and the
Ashling would have rendered as the letter `A`. Both drawn now — 3×3, two frames,
the same silhouette as the Warden so they read as the same class of creature, with
the head glyph (`&`, `%`) the only thing that differs and still the only bright
white on the field. Jane now checks every id in her own tables against the
filesystem before committing.

**[Near-miss — also Jane's own]** Generating the Crossroads screen, she imported
her own `banner.py` for its block font. It writes files at module scope, so **the
import silently rewrote `title.txt`, `death.txt` and `dawn.txt`**, discarding the
masks she'd added an hour before. Spotted because the script printed three lines
it had no business printing; restored from git before it reached a commit. Second
time this session a trusted script did something unasked.

**[New]** Two character sprites; **19 level-up card icons** (7 weapons diagram a
*shape*, 12 passives diagram a *verb* — a fist for Might, an hourglass for
Duration, rings pushing outward for Area, so the player tells them apart without
reading); `ui/crossroads.txt`; and `assets/crossroads.tsv`.

**[Decision — the meta-progression rule]** Written into `design.md` §13:
**meta-progression may make a bad run survivable. It may never make a good run
trivial.** It moves the floor, never the ceiling — nothing at the Crossroads
touches weapon damage scaling or the spawn curve. A player who has bought every
upgrade should still lose to the Countess if they build badly, or the game stops
being about the twenty minutes and becomes about the grind.

**[Numbers, measured not asserted]** Full unlock costs 15,230g. Jane first wrote
"roughly 15–20 runs" in the file, then computed it and corrected herself: a
**winning** run yields 1,365g (**11 runs**), a losing run around 15:00 yields 432g
(35 runs), and a Beggar with maxed Greed yields 3,071g (5 runs). The 11-vs-35
spread is deliberate — winning is the fast path, so the meta rewards getting good
over grinding losses. The Beggar collapsing it to 5 is also deliberate; "weak
damage, rich runs" is his identity, and at 900g you can only take that shortcut
once the meta is underway. *The gold economy had to be written down first: until
the drop rates existed, the cost curve was a number with no denominator.*

**[Jane → John, unwired assets]** `cards/` is loaded but **never drawn** — it
appears in exactly one place in `src/`, the `SIZE_BUDGET` table — so the level-up
screen has no art despite 19 icons sitting on disk. Ids are `cards/<weaponId>` and
`cards/passives/<passiveId>`, matching the `id` columns of `weapons.tsv` and
`passives.tsv` exactly. Also `ui/death` is unused (the death *state* exists, the
banner just isn't drawn), and `countess.tsv` / `crossroads.tsv` aren't parsed yet.

**[Credit]** John wired `portraits/${id}` for the first-encounter panel and built
`hitbox.ts` so hitboxes stay off the sprite bounds — the thing Jane cared most
about after sub-cell motion — without being asked twice.

---

## 2026-07-09 — the last balance constant leaves the code

**[Status — John]** Canvas port verified in the browser, not just in tests. Sub-cell
motion, 180×60 grid, draw order by world y, hitboxes from sprite mass, lantern glow
and real light falloff. `npm run web`. The terminal build still runs and shares
100% of the game code. **The sim never knew what a terminal was**, so `world.ts`,
`render.ts`, the loader and all six `.tsv` tables were byte-for-byte unchanged by
the pivot — he extracted one `Surface` interface and wrote a second implementation
behind it.

**[John changed his own fix in favour of Jane's]** He had already shipped an
*auto-face* for the Chain — after 0.25s without horizontal input, the whip turned
toward the nearest enemy. It solves the owner's complaint. He's made it
**default-off**, because Jane's fix (Nova opens; the Chain hits both sides from
level 1) keeps facing as *skill* where auto-face would have quietly erased it.
It survives as a one-line A/B behind `?autoface`. Jane agrees, and expects it
won't be needed: the Chain isn't the opener any more, so by the time a player
picks it, Nova is covering the angles behind them.

**[John, on the warning Jane missed]** *"The check compared the mask's rows to the
padded box height, not the art's. It fired on every sprite where `size:` was taller
than the art — pure noise — and the one time it was telling the truth it was
indistinguishable from the noise it always emitted. A warning that cries wolf is a
warning nobody reads."* Fixed; it now compares mask rows to art rows and names the
real failure. `--preview` reports zero warnings.

**[Two bugs found only by looking at pixels]** Neither showed in 77 passing tests.
`--start 15:00` prewarmed the horde before the surface was measured, dumping 200
enemies into a tight ball. And **the Countess never appeared** — John spawned her
just off-viewport like any other enemy, but her Court phase is *stationary*, so she
sat in the dark summoning bats at an empty graveyard forever. Jane's §10 phase
design caught John's spawn code. Neither would have found it in the sim.

**[Q — John → Jane]** `MASS_SCALE = 0.62` in `hitbox.ts` is my guess, and it's the
only balance constant left in code. Want it as a `hit_radius` column in
`glyphs.tsv`?
**[A — Jane]** Yes — taken. New `hit_rad` column, in world units. John's derived
values were close, so this mostly makes them *editable*. Two deliberate departures
from his formula:
- **The player is 1.2 wu inside a 3×3 sprite** — smaller than he looks. Getting hit
  should feel like being *caught*, not like being *near*. Every survivors game that
  feels good cheats here, in the player's favour. An equal-area formula would have
  made the player's own size a liability the moment Jane drew him bigger — exactly
  the trap hiding inside "size is threat."
- **The Wight is 2.2 and the Stalker 2.0, from the same 5×3 box.** The Wight is a
  wall you go around; the Stalker is a knife that should feel dodgeable once you
  finally see it. No formula can produce that distinction — it's what the enemies
  are *for*.

**[A — Jane, on John's other three]** The Crossroads is **already specced and
drawn** (committed while he was asking) — wire `C` to it, don't build a
placeholder. `sprites/ashling` / `sprites/beggar` **already drawn**, same commit.
Save file: `localStorage` on canvas, JSON on terminal, his call where — but it may
store *only* gold, purchased levels, unlocks and achievements, **never balance
numbers**, or `passives.tsv` stops being the source of truth. And it needs a
`version` int that throws the save away on mismatch: a wiped save is a bad day, a
save that silently half-applies is a week of chasing ghosts.

**[Still unwired]** `cards/` — 19 icons on disk, referenced nowhere but
`SIZE_BUDGET`. The level-up screen has no art.

---

## 2026-07-09 — a false alarm worth writing down

**[Near-miss]** Jane committed the `hit_rad` column, ran `npm test`, and saw **42
failures**. Her first assumption was that shifting a column had broken John's
build. It hadn't: the failures reproduce identically with the *previous*
`glyphs.tsv`, and John's working tree has uncommitted edits to `world.ts`,
`app.ts` and `gamedata.ts` plus four new files — he is mid-write on the Crossroads
and the save file. Verified by checking `HEAD` out into a throwaway git worktree
and running the suite there: **77/77 green.**

**[Process — for the human as much as for John]** Two agents share one working
tree, so **`npm test` measures the union of both uncommitted states**, and a red
suite says nothing about who caused it. Jane now verifies against a clean `HEAD`
worktree before reporting any breakage to John, and asks the same in reverse: if
the art looks suddenly broken, check whether she is halfway through regenerating
a sprite before debugging the loader.

Jane: *"That's the third time today something I trusted did something I didn't ask
— `banner.py` rewriting three files on import, `--preview` warnings I'd grepped
away, and now a red suite that wasn't mine. The tooling is fine. Believing the
first plausible story is the problem, and checking is cheap."*

---

## 2026-07-09 — Jane plays the game (headlessly) and finds her own design broken

Unable to open a browser, Jane drove John's sim directly — `World` +
`generateCards`, 180×60 viewport, god mode, a kiting player and an auto-picker —
for three full 20-minute runs at HEAD. Better than watching, because it let her
replay the same build across seeds.

**[Verified — John's director is exact]** Alive-count tracks `target(t)` nearly to
the enemy (81 vs 80 at 10:00; 130 vs 130 at 14:00), and every overshoot was a
scripted beat doing its job. At 18:00 the Tide puts **381 enemies and 40% of the
field** under sprite-cells. The rest of the run sits at 8–15%. It reads as a horde,
not soup.

**[Jane was wrong — evolution was unreachable]** The gate required *weapon lv8 +
paired passive lv8*, and John implemented it exactly as written. Jane simulated a
player who does nothing but rush Chain→8 then Might→8, taking no other card ever:
across three seeds he evolved **once, at 18:50**, with 70 seconds left; the other
two never got there. In the three *normal* runs, **nothing evolved in any build**.
The payoff moment of the entire run was unreachable.

New gate: **weapon at level 8 + the paired passive merely OWNED (level ≥ 1)** —
the genre standard. The weapon is the commitment; the passive is the key.
Evolutions should now land 12:00–15:00. *Needs a code change in `evolutions.ts`.*

**[Jane was wrong — a focused build can be starved by the shuffle]** On one seed
the player took the Chain card whenever offered for twenty minutes and **never
reached level 8**, because it wasn't offered often enough. New rule (`design.md`
§8): **every hand of three must contain at least one card that levels something
you already own.** The other two stay random. *"That isn't difficulty, it's a slot
machine."*

**[Bug — The Ring, and it's Jane's spec]** `world.ts:686` uses a ring radius of
`max(halfWidth, 40) × 0.95` = 85.5 wu. The viewport half is 90 wu wide but only
**60 wu tall** (cells are 1×2), so **half the 60 ghouls spawn off-screen** and the
player sees a band closing from the sides, not a ring closing around them. §11 only
ever said "a closing circle." It now specifies a circle in wu *inscribed* in the
viewport — `min(half_w, half_h) × 0.95` = 57 wu — which draws as a 57×28 ellipse
with all 60 ghouls visible. New `param ring_radius_frac` in `director.tsv`.

**[Jane was wrong — the gold economy was calibrated on an invented number]**
`crossroads.tsv` assumed ~3,000 kills per run. Measured: passive-hungry **1,317**,
greedy **6,404**, weapon-hungry **11,442**. A weapon build kills nine times what a
passive build does. *"The kill count isn't a constant, so nothing may be tuned
against it as if it were"* — which is why gold-per-kill must be small. Retuned to
`0.02 × 2g`, restoring the intended 11-winning-runs / 32-losing-runs spread.

**[Checked, and NOT reported]** `pendingChests` read 0 in every run, which looked
like elites failing to drop chests. They don't fail: a chest is a walk-over pickup
and Jane's circle-kiting harness never touched one. John's code was fine.

**[Q — Jane → John]** The one thing the sim cannot answer: **does the Censer's
ring render as an ellipse?** A ring of radius `r` must draw `rx = r`, `ry = r/2`
cells. If it comes out circular on the canvas, the aspect rule has slipped in the
new backend, and it will feel wrong long before anyone can name why. Screenshot it
at `?play&god&start=12:00` and compare against the `cards/censer` icon, which is
drawn as the ellipse it ought to be.

---

## 2026-07-10 — owner feedback #2: the game was unreadable, and Jane wrote the bug

The owner played again at 23:03 and left four things: a crash, "why is this still
in a terminal," **"XP is hard to see and it's almost like it goes under the
blood,"** and **"there are soo many red things on the ground at times that it's
hard to make out."** Plus: 120fps, and it must deploy to Vercel/Coolify.

**[Crash — not reproducible at HEAD]** Jane drove the real `App` headlessly and
rendered every screen (title, Crossroads, level-up, pause, death, dawn) at three
viewport sizes and three start times: **~30,000 frames, no crash.** `renderer.ts`
is untouched since the canvas port, so either John fixed the caller or it needs
`term.onResize`, which can't be reached headlessly.

**[The real answer to "why is it still in a terminal"]** It isn't. `npm start`
already runs `serve.ts` — John had fixed it before the owner wrote the note. The
owner was running an old build. *Worth John saying so plainly in his next update.*

**[Jane was wrong — the XP really did go under the blood]** Not "almost like."
The XP mote was `#2c4bd8`, luminance **0.105**. Fresh gore was `#ff3b3b`,
luminance **0.247**. The most important pickup in the game was less than half as
bright as the corpse stain it lay on, and the stain was drawn in *bright* red.
Draw order was never at fault — Jane checked `render.ts` before blaming John.

**[Jane was wrong — three glyphs each meant three things]** `*` was the Blood
Wisp *and* gore aged 20–40s *and* the bolt from the starting weapon. `%` was gore
*and* the Beggar. `.` was gore *and* Cinder Trail's embers. And every kill stained
the floor for 90 seconds: at a weapon build's **11,442 kills**, roughly 3,600
decals on a 10,800-cell field — **a third of the screen, permanently red.**

**[Decision — the readability law, now in `design.md` §9]**
> 1. **The floor may never be brighter than the things standing on it.**
> 2. **A glyph means one thing, and a hue means one thing.**

Gore is now *shading* (`▒`, `░`) that nothing else uses, three stages over 60s,
fading to black. Only `gore_chance = 0.35` of kills stain at all, taking late-game
coverage from ~33% to ~8% — still a carpet of your kills, still thickest where you
fought, but it stops shouting. XP is **bright cyan**, 4.8× contrast against gore
(was 1.9×), with the tier reading from the glyph rather than the colour.

**[The palette pass, and a rule Jane broke herself]** One hue, one meaning. The
audit found `rattlejack` painted `W` — **bright white, the colour Jane reserved
for the player and told John to reserve too.** Fixed. And the Wight had to give up
bright cyan so XP could own it: *an enemy that kills you must never share a hue
with the thing you are running toward.* Bright white → the player alone; bright
cyan → XP; bright yellow → gold, chests and the Gravewarden who drops them; dark
red → the floor, and nothing else.

**[Request — Jane → John]** The floor wants dried-blood maroons and the 16-colour
palette has none: it jumps from `#b22222` straight to `#101010`. Either add one
letter (`d` = `#5a1616`) to `PALETTE`, or let the `colour` column take `#rrggbb`
(`parseColor` already exists). Shipped and legible without it; beautiful with it.

**[Still John's]** 120fps (free if render runs on `rAF` and interpolates between
fixed sim ticks) and a plain statement of the deploy story — `npm run build` /
`npm run preview` look like they already emit a static bundle, which is exactly
what the owner is asking for.

`npm test`: **108/108** against clean HEAD with the new tables.

---

## 10.07 — Owner feedback round 3, and the reason it exists

**Owner (`owner-feedback.md`, 10:10):**
> The focus is now way too much on late game.
> Polish the core game before you work on any more later features!!!!
> Currently the game just loads "....".
> PLEASE MAKE SURE ALSO ABOVE CHANGES ARE MADE

**Jane:** I chased the `"...."` first, because it makes the other two lines make
sense. `....` is our own `loading the night…` placeholder. The game never starts.

**Reproduced:** `npm run build`, then double-click `dist/index.html`. Hangs
forever. Served over http (`npm start`, `npm run preview`) it boots fine — I
checked all four cases in headless Chrome before saying a word to John.

**Cause:** a `<script type="module">` loaded from `file://` has origin `null`
and the browser blocks it. The module body never runs. And our only error
handler lives *inside* that module — so nothing throws, nothing reports, and the
page just sits on the loading string.

**Q (Jane → John):** can `file://` work at all, or do we tell him "use the hosted
URL"? Either answer is fine, but the page has to *speak* when it fails.
**A (pending).** My ask: one plain inline `<script>` (not a module, no imports)
that swaps the loader for a real message if no frame has drawn in ~5s. For
double-click-to-play we'd need a single self-contained `index.html` with
`assets.json` inlined — John's call, it's his techstack.

**Decision (Jane, design.md §12):** *a loading message that cannot fail is a lie.*
The failure panel is written for the owner — plain sentence, the one command that
fixes it, stack trace last and small. Copy is in §12.

**Two more, found while reading the deploy configs:**
- `/dist/` is served `immutable, max-age=31536000` but the filenames aren't
  content-hashed, while `assets.json` revalidates every load. A returning browser
  can pair a year-old `boot.js` with today's tables. Flagged to John.
- `nginx.conf`'s `try_files … /index.html` also catches `/dist/`, so a missing
  `boot.js` returns `index.html` with a 200. The browser parses HTML as
  JavaScript, and you get the same silent hang from a completely different cause.

### The thing worth writing down

I audited every complaint from rounds 1 and 2 against the actual tree. **All of
them are already fixed:** browser build, 120fps (John measured 1.76ms/frame),
static hosting, XP legibility, the gore carpet, the clunky aiming starting weapon
(the Warden opens with the seeking Nova now), and the "singular characters" —
every mob is a multi-cell animated sprite and I verified none of them fall back
to a bare glyph.

So *"PLEASE MAKE SURE ALSO ABOVE CHANGES ARE MADE"* is not a request to redo the
work. **It's the owner unable to see that we did it.** We built a boss, seven
evolutions and a meta-progression economy behind a front door that doesn't open.

That is also the answer to *"too much focus on late game."* He's right, and the
`....` is the proof.

**Decision (Jane, design.md §0 — new section at the top of the file):**
*Feel before content.* The core is the first five minutes: it opens, walking
feels good, things die without aiming, you can see yourself / the XP / the threat,
and a card reads in two seconds. **Frozen until that's signed off:** endless mode
and the Reapers, new weapons, new evolutions, new passives, new Crossroads
upgrades, any bestiary past minute 10.

**Jane → John, on his open list:** freeze #3 (endless). #1 (card art) and #2
(reroll/banish buttons) are *core* — the level-up screen is the only screen that
stops the game, so it has to read instantly; please do those. #4 (juice): damage
numbers and hit-flash are core because they tell the player the build works;
screen shake on a Countess charge is minute nineteen and can wait.

**Jane → John, minor:** `world.ts:328` falls back to `weapons.order[0]` — which
is `chain`, the one weapon `characters.tsv` forbids as an opener. Harmless today,
but a typo in my table would silently reinstate the owner's worst complaint.
Fall back to something that seeks, or refuse to start. Now written into §7.

---

## 10.07 — Core polish, finding #1: the XP the player earns doesn't reach them

**Jane:** Acting on §0 (*polish the core*), I simulated the first ninety seconds
of a real run — real tables, a player kiting in a circle — instead of reasoning
about it from the design.

**The first level-up card arrives 46.7 seconds into the run.** The first card is
where the game teaches its own loop, and it was taking a tenth of the run to show
up.

**Cause:** the base pickup radius is 6 wu. Weapons kill at *range* (a Nova bolt
travels up to 80 wu), so enemies die far from the player and drop motes where
they fall. 6 wu never reaches them. **29 of 39 motes were stranded on the floor.**

| base pickup radius | first card | level @90s | motes stranded | kills |
|---|---|---|---|---|
| 6 wu (shipped) | 46.7s | 3 | 29 of 39 | 39 |
| **12 wu** | **20.6s** | 5 | 9 | 39 |
| 24 wu | 17.8s | 6 | 0 | 39 |

Kills were identical at every radius — the number does not touch combat at all.
It only decides whether earned XP is ever received.

**Decision (Jane, design.md §6): base pickup radius 6 → 12 wu.**
Rule, so it survives us: **you collect what you can see.** The lantern lights
14 wu; pickup sits just inside it. `Magnet` then pulls motes *out of the dark*.
Not 24 — past 12 the returns flatten and you lose the pleasure of walking back
over your own trail of motes.

**Jane → John:** the base constant lives in `world.ts:1541`, not in a table, so
this one needs your hands. Also, it's written **twice** — `get pickupRadius()` at
:446 and a local `const radius = 6 * stats.pickup_radius` at :1541, and the
collection loop uses the local one, not the getter. (I discovered this by
overriding the getter to sweep the value and getting four identical rows.) Change
one without the other and the magnet pulls from a radius the player can't see.

**Note:** this is exactly the kind of thing §0 exists to catch. It was found by
playing minute one, not by building minute twenty.

---

## 10.07 — Core polish, finding #2: the cards were showing the player our column names

**Jane:** `upgrades.ts` prints the `note` column of `weapons.tsv` verbatim as the
effect line on a level-up card. I didn't know that, and I'd been using `note` as
a scratchpad for John and me. So the game has been introducing four of its seven
weapons like this:

> **Wisp Lantern** — *"ax = orbit radius, ay = hit radius, pspeed = deg/s"*
> **The Chain** — *"bands BOTH sides from lv1 (front band wider). no longer the starting weapon."*
> **Censer** — *"persistent damaging ring; ax = radius"*
> **Cinder Trail** — *"burning embers behind you; dur = ember lifetime"*

On the one screen that stops the game to be read. This is mine, start to finish.

**Fixed (Jane, no code change needed):** nothing machine-parses `note` — I checked
all four call sites. All 28 weapon notes and all 12 passive notes are now player
copy, and both table headers now state in capitals that the column is printed on
the card. `npm test` 124/124.

**Near miss worth recording:** `passiveEffect()` falls back to `note` when a level
has no value. `Revival` is capped at 2 and its note read `CAPS AT LEVEL 2`. It
never reached a player, because `passiveMaxLevel()` refuses to offer level 3 —
but the guard was in John's file and the loaded string was in Jane's. Unloaded now.

**Decision (Jane, design.md §12): a card says what it does, then what it costs
you to know.** Sentence first; numbers second and dimmed. Today a passive card
reads only `cooldown -6%`, and a first-time player cannot tell whether that is
good.

**Jane → John (design.md §12):** two changes in `upgrades.ts` — (1) passives
should use `note` as the effect line always, not just as a null fallback, with
the percentage on a dimmed second line; (2) a weapon level-up with a blank note
should still show that weapon's sentence above its numbers. With your open item
#1 (the `assets/cards/` art — all 26 pieces are drawn and packed), that closes the
level-up screen.

**Rule, now in §12:** *any field the player can see is copy, and copy is Jane's.*

---

## 10.07 — Core polish, finding #3: the player was drawn out of the same characters as the monsters

*Jane, from a headless frame dump of a real run. `design.md` §9 and §10 updated.*

**The acceptance criterion under test** (§0, item 4): *"You can see the three
things that matter: you, the XP, and what is about to touch you."*

**It was failing.** Three ghouls closing on the player at t=180 — shipping build
on the left, after the fix on the right:

```
   ░▒░   \o/ ░              ░▒░   (o) ░
         /o/o\"                   (o(o)"
   ▒ @//o\|| ░              ▒ @((o))) ░
      /|\|||                   /|\())
      ./"\                     ./"\
```

**Cause 1 — the mobs were made of the player.** The Ghoul was `\o/` over `/ \`;
its bottom row was character-for-character identical to the player's. Seven of
the nine mobs used `/`, `\` or `|`. The Bat was `\v/`, and a Bat moves at 26 wu/s
— the thing that crosses the player's sprite most often in the whole game was
built from the player's limbs.

> **John's code was already correct here, and it's worth saying why it didn't
> help.** He draws the player last, on top of everything. Painter's order
> separates you from what's *behind* you. It cannot separate you from a crowd
> that is *made of you*. Z-order was the wrong tool.

**Decision (Jane, design.md §10) — the Warden's alphabet.** `@ / \ |` belong to
the player; nothing else in the game may use them. Every monster family gets its
own shape language, and each one survives with the colour switched off, which is
the real test: parentheses `( )` rot, square brackets `[ ]` are armoured, dashes
`- ~ ^ v` are vermin. All seven offending sprites redrawn. Sprites over 5×3 are
exempt — the Countess is 28×11 and her size already tells you what she is.

**Cause 2 — the horde was brighter than the XP.** Every mob's head was masked `w`
(`#c7c7c7`, luminance **0.78**). An XP mote is **0.74**. The player is 1.00. So
when twelve Grave Rats arrive at 0:30, twelve rat heads were the brightest things
on the field after the `@` — each brighter than every mote it stood on. The Wight
was `w` across all fifteen cells of its body.

> When the owner said *"XP is hard to see"* (09.07, 23:03) we both looked at the
> floor. John fixed the floor, and fixed it correctly — gore now measures
> 0.01–0.14. **Half the problem was never on the floor.** It was the horde.

**Decision (Jane, design.md §9) — the luminance ladder**, and a third readability
rule: *nothing an enemy is made of may be brighter than an XP mote.*

| player `@` | XP | enemies | ground | gore |
|---|---|---|---|---|
| 1.00 | 0.74 | ≤ 0.55 | 0.26 | ≤ 0.15 |

Elites and the boss are the **named** exception — the Gravewarden's bright-yellow
eyes are 0.93 on purpose. There is one of it, it has a health bar, and it is what
you are supposed to be looking at. *An exception you can name is a design; an
exception you can't is a bug.*

`npm test` 124/124. §0 item 4 signed off.

**Jane → John, three asks (`jane.md` [24]):**
1. **Two asserts**, over `sprites/mobs/*` and `sprites/elites/*`: no art cell is
   `@ / \ |`; no mask cell is `w` or `W`. Both laws are mechanical. *"I'd rather
   the build caught me than the owner did."* This would have failed the day the
   Ghoul was drawn.
2. **`# opaque: true` sprite header** — paint a sprite's transparent cells as
   background rather than skipping them. Only the player gets it: a 3×3 dark card
   under him so the horde parts around him. Today ground texture shows *through*
   his boots (`./"\` above — that `"` is dirt inside the player).
3. **`drawGround` (`render.ts:142`) has art hardcoded in it**, and its `.`
   scatter is one codepoint from the XP mote `·`. Not urgent — hue and luminance
   currently separate them — but drop `.` and the ambiguity is gone. Offered:
   move the scatter into `director.tsv` and Jane owns it. John's call, he owns
   the techstack.

**Still open from 10.07 earlier:** passive level-up cards still print only
`cooldown -6%` with no sentence (`jane.md` [22]). John's `icon` field for the
`cards/` art is in flight.

**Jane next:** §0 item 5 (a card read in under two seconds) and item 2 (*"you
walk, and it feels good to walk"*) — which has never once been measured.

---

## 10.07 — Core polish, finding #4: the game kills you for standing still and starves you for walking

*Jane. `design.md` §6 sharpened; `director.tsv` gains one param. This is the most
important thing found today and it is still shipping.*

**First, an error of mine.** `git show 6bf8bd6` — the commit titled *"Pickup
radius 6 → 12 wu"* — is Jane's, and it touches `design.md`, `jane.md`,
`meetings.md` and `passives.tsv`. **It never touched `world.ts`.** The literal `6`
is still there. Jane wrote the number into the design, read the design back, and
believed it. John has been on the crash, the browser build and the card art, all
of which mattered more.

**Second, the original measurement was wrong** — it simulated exactly one player,
a kiting one. Re-run across the four things a survivors player actually does with
the keys (6 seeds × 2 minutes). **Time to the first level-up card:**

| Base radius | stand still | walk a straight line | kite wide | kite tight |
|---|---|---|---|---|
| **6 wu** *(what ships)* | 18.5s | **6m 36s** | 3m 43s | 37.7s |
| **12 wu** *(design.md §6)* | 17.1s | 1m 13s | 56.6s | **19.1s** |
| 24 wu | 13.9s | 35.2s | 34.7s | 16.8s |

Kills are **flat at every radius** — 43 walking / 51 kiting / 54 standing, at 6 wu
and 24 wu alike. The dial touches nothing but whether earned XP is *received*.

**The contradiction.** Jane's own note in `jane.md` [20]: *"Standing perfectly
still kills you at ~40s. Movement is the verb."* Now read the 6 wu row. A player
doing the one thing the game is built to teach waits six and a half minutes for
the card that would teach it. Weapons kill at range — Nova's bolt travels 80 wu —
so the corpses, and their motes, are behind you the moment you move.

The magnet itself is fine: `MOTE_MAGNET_SPEED` is 46 against a player speed of 20,
so a mote that *starts* homing always catches you. The whole bug is the 6 wu
capture radius. Walking at 20 wu/s you sweep a 12-wu corridor and everything you
killed outside it is gone forever.

**Why 12 and not 24 (design.md §6).** At 12 wu the contradiction resolves *into a
skill*: kite tight over your kills → 100% collected; kite wide → 27%. Staying near
your dead becomes something the player learns to want. And **Magnet stops being a
stat and becomes a verb** — ×1.96 carries 12 → 23.5 wu, and wide kiting goes 27%
→ 66%. *Reaching past what you can see*, which is what §6 always promised. The
lantern is 14 wu; you collect what you can see.

**Jane → John:** `assets/director.tsv` now carries `param pickup_radius_base 12`.
`param()` already falls back to `DEFAULT_PARAMS` when a table is silent, so the row
is **inert and the build is green with it in** (`npm test` 124/124). Replace the
literal `6` at `world.ts:1541` and at `:447` and read the param instead. They are
one number with two call sites — `:1541` decides where the magnet pulls from,
`:447` decides the circle that gets drawn. If they disagree, the magnet reaches
out of a circle the player cannot see. Balance lives in Jane's tables, per the
pattern John set with `gore_level` and `mote_lift`.

**John → Jane, answered.** *`john.md` [16]: "your palette has `mote1` as `b`
(blue); I'm only brightening it at draw time."* Stale — Jane changed it to bright
cyan `C` in `c1018d0`, before that note was written. So `mote_lift 0.35` was
lifting an already-cyan mote to luminance 0.78, above the §9 ladder. It is `0.10`
now, and a mote measures **0.740** in a real frame — exactly the rung §9 wants.
John's instinct to do the finding-the-eye work with **motion** (`mote_pulse`)
rather than brightness is why the ladder holds.

**Scoreboard against §0.** Items 1 (it opens), 3 (things die without aiming — the
Warden starts with Nova, first kill at 2.2s standing still, never facing anything)
and 4 (you can see yourself) now hold. Item 2 is this finding, one line of John's
from being true. Item 5 is the card — `jane.md` [22] plus John's `cards/` art.

---

## 10.07 — Core polish, finding #5: the level-up card is 24 columns wide and Jane's sentences were forty characters long

*Jane. `design.md` §12 rewritten. All 58 player-facing strings rewritten to budget.*

**First, John landed the pickup radius.** `world.ts:459` now reads
`pickup_radius_base` from `director.tsv`, and `DEFAULT_PARAMS` carries 12 so the
stub tables in tests are safe. **§0 item 2 closes.** `npm test` went red for one
run on *"vacuums motes inside the pickup radius"* and green at 127/127 shortly
after — that was John's mid-edit tree, not a bug, and it is the exact hazard
recorded in `a17e0f4`. Jane reproduced the mote's flight against the live tree
before saying anything: 3.0 wu → 1.37 → 0.41 → collected at t=0.05s.

**Now the finding, and it means Jane fixed the wrong half of the card on 10.07.**

`app.ts:504` calls `truncate(card.effect, cardW - 4)`. The card is 24 columns, so
a sentence gets **20 characters**. Seventeen of the 28 weapon notes were cut —
**including every level-1 introduction**, the one line whose whole job is to
explain a weapon the player has never seen:

```
   Fires a seeking bolt at the nearest enemy.   ->  "Fires a seeking bo…"
   A wisp orbits you, burning what it touches.  ->  "A wisp orbits you,…"
```

The copy so carefully rewritten in the last session never once reached a player
intact. **Three of Jane's columns get truncated, not one:** the level-up card (20
chars), the evolution slam (24), and the Crossroads shop list (24).

`evolutions.tsv`'s `effect` column was player-facing and read **`bands on BOTH
sides, always, no facing check`** — displayed at the payoff moment of the entire
run, cut to `bands on BOTH sides, a…`. It also prefixed the evolved name, which
`app.ts` already draws on the line above, so `BONEMEAL` printed twice.
`crossroads.tsv` was telling the player Revival is `expensive on purpose`, which
is a note from Jane to John.

**Decision (Jane, design.md §12): 36 characters, and it must word-wrap into two
lines of twenty.** All 58 strings rewritten and machine-checked by wrapping them;
zero spill to a third line. Deleted rationale survives as `#` comments next to the
rows it explains. *The budget is a gift, not a tax:* `Fires a seeking bolt at the
nearest enemy.` became `A bolt seeks the nearest enemy.` and it is better copy.

### The one that no `note` could ever have fixed

Found by generating a real hand from a real `World` instead of reading the table.
`upgrades.ts:49` builds a passive's effect line as
`` `${def.stat.replace(/_/g, ' ')} +${value}` `` — which prints **John's
`StatName` union** to the player. All twelve passives do it:

```
   [+] REGEN    NEW          [»] ARMOUR   NEW         [~] GROWTH   NEW
       hp per sec +0.25          flat reduce +1           xp gain +6%
```

Same disease as `ax = orbit radius, ay = hit radius` — and it survived that fix
entirely, **because the string is generated.** Rewriting the `note` column could
never have caught it. Same lesson as the Warden's alphabet earlier today: *the
thing that fails is never quite the thing you were looking at.*

**Decision:** `passives.tsv` gains a **`label`** column (index 13, appended so
`note` stays at `f[12]` and nothing shifts). `flat_reduce` → *armour*.
`hp_per_sec` → *HP per second*. `xp_gain` → *XP gained*. `npm test` 127/127 with
it in; the column is inert until John reads it.

**Jane → John — five small things, and then §0 is signed off:**
1. Read `passives.tsv`'s new `label` column instead of `stat.replace(/_/g,' ')`.
   At their widest levels all twelve fit the 20-column card; the longest string in
   the game is `movement speed +40%`, at 19.
2. **Word-wrap, don't truncate**, at all three sites. Two lines, `cardH` +1. *A `…`
   in the middle of a sentence is the game admitting it lost.*
3. **Card width should follow the field**, clamped `[24, 40]`. `MIN_COLS` is 80 and
   `3×24 + 2×3 = 78`, so 24 is forced on a terminal — but §5.0 targets a **180×60**
   canvas, *and that is where the owner plays.* Three 24-column cards use 78 of 180
   columns: the cards are sized for a terminal nobody is playing on.
4. The evolution box is 28 wide; make it **44**. It is the payoff screen, drawn alone.
5. The weapon fallback `${dmg} damage · ${cd}s cooldown` is 25 chars and truncates
   to `9 damage · 1.34s co…`. Drop the trailing word — the `s` already says it is a
   time.

### Scoreboard against §0, the core

| | | |
|---|---|---|
| 1 | It opens | **done** (John) |
| 2 | It feels good to walk | **done** (John landed `pickup_radius_base` today) |
| 3 | Things die without aiming | **done** — verified: the Warden starts with Nova, first kill at **2.2s standing perfectly still**, never facing anything |
| 4 | You can see you, the XP, the threat | **done** (Jane, the Warden's alphabet + the luminance ladder) |
| 5 | A card reads in two seconds | five small items on John's desk, above |

None of it is in §13. The frozen list stays frozen.

---

## 10.07 — Two corrections to Jane's own work

**A hole in the Warden's alphabet, closed.** `│` (U+2502) is `|` to the eye, and
`╱ ╲ ⁄ ∕` are `/ \`. A rule that bans only the four ASCII codepoints can be walked
around without ever being broken. The reserved set is now *those four characters
and anything that renders like them* (`design.md` §10, `assets/README.md`). Zero
violations across all 51 art files — checked before writing it down, not after.

**`design.md` §10 was lying about the Countess.** It called her `16×5` in the prose
and `28×11` in the table, and described her as *"the one multi-cell creature in the
game"* — true until the owner overruled the one-glyph rule on 09.07. She is 28×11,
2 frames @ 3fps. Her wings are `/` and `\`, and she is now written up as the
**named** exception to the alphabet rather than an unmentioned violation of it: at
28×11 nothing confuses her with a 3×3 player, and when she is on the field the
ambient director has stopped, so there is no crowd for the rule to protect against.

**Evidence for the `opaque` request** (`jane.md` [24] item 2), from a real frame at
t=240 with the new art:

```
   @▒       ░  .
  /|\(o)))
  /(\o(o)))░░░
  o)o,())((░
```

The `@` reads instantly — finding #3 working. But the third row is `/(\`: a ghoul's
parenthesis sitting **inside the player's boots**, in the transparent cell between
`/` and `\`. Transparency is correct for monsters and wrong for exactly one sprite
in the game. A `# opaque: true` header would give the player a 3×3 dark card and
the horde would part around him. Nothing else needs the flag.

---

## 10.07 — Juice gets a design before John gets to guess

### John → Jane: "these three numbers are balance-adjacent and they're in my code"

> *"`gore_level`, `mote_lift` and `mote_pulse` are currently constants in `render.ts`.
> If you want them, say so and I'll move them into a table — or just tell me
> different numbers and I'll set them."*

**Jane:** I want them, and they're already in `director.tsv` as `param` rows. Two of
his three numbers changed once they were mine: `mote_lift` came down from **0.35 to
0.10** (he set 0.35 when the mote was dark blue; it's bright cyan now, and at +35%
a mote reaches 78% of the *player's* luminance — the player must not have to hunt
for himself inside his own XP). `gore_level 0.55` was right; kept. And `mote_pulse`
he'd described but never actually implemented, so it now exists.

**John, since:** all of them read from the table. Also the ring, `pickup_radius_base`,
and the decal lifetime, which had been hardcoded to 90s while Jane's decay chain
ends at 60 — dead decals were holding cells for thirty seconds after going invisible.

### John → Jane: a correction, and it was a good one

> *"`evolutions.tsv` line 2 still says 'weapon at level 8 + paired passive at level 8'.
> The code and design.md §8 both say the passive only has to be **owned**."*

**Jane:** Correct, the header was stale — my own simulation is why the rule changed
and I never went back to the comment. Fixed.

### Jane → John: juice was next on his list and had no design at all

John's [17] ends with *"Juice: damage numbers, screen shake, ember particles. This is
the core-game polish the owner is asking for, and it's next."* It had no spec. That
meant he was about to choose a dozen numbers by taste — and in this system **the
numbers are the taste.**

So: **`design.md` §14** and **`assets/juice.tsv`**, which is his to parse.

The important reframe, and it goes back to the owner's very first complaint:

> *"Singular characters walking around… is this the 1960s still? ASCII art can be
> made much more impressive nowadays."*

We read that as *draw better sprites*, and we did, and he was right anyway. **The
sprites were never the problem. Nothing in this game reacts.** You hit a ghoul and
the ghoul doesn't notice; it dies and it simply stops being there. A `g` that
flinches when you hit it beats a `g` drawn in three colours, and it costs no art.

Four decisions worth recording:

| Decision | Why |
|---|---|
| Every value in **seconds**, never frames | He asked for 120fps. A "2-frame" flash runs 2× fast at 120. That's why old ports feel wrong. |
| **One damage number per enemy**, accumulating | One-per-*event* is the gore bug in digits. We already shipped that bug once and he reported it. |
| Shake in **fractions of a cell**; the HUD never moves | A grid can only shake a whole cell = an earthquake. Sub-cell offsets are what leaving the terminal bought us. |
| Hit stop only when the **player** is hit | At 40 kills/sec, on-enemy-hit stop judders forever and nobody can say why it feels bad. |

The accumulating number is also how the game gets a crit *feel* with **no crit
system**. It doesn't have one. §0 says feel before content, so we're not building one.

### Jane → John: the Blood Wisp was drawn out of the player's own bolt

The find of the day, and it came out of specifying the numbers layer.

`render.ts` draws the starting bolt as `*`, fading to `.` as it dies. `wisp.txt` was
`(*)` over `'.'`. So from **12:00** — the exact minute the field is fullest — the one
enemy that ignores enemy-enemy collision, and is therefore the one thing that reaches
you *through* the pile, was drawn with both characters of the projectile you fire at
it. Mistaking your own bolt for an incoming enemy is §0 item 4 ("you can see what is
about to touch you") failing outright.

**The alphabet grew the clause it should have had first:**

> Everything the player *emits* is part of the Warden's alphabet. `*` the bolt, `°` a
> Cinder ember, `═ ─` a band. A bolt is as much *you* as the `@` is.

The wisp moved, not the bolt — the bolt is in every run from second zero, the wisp
arrives at 12:00 in some of them. Blood spirits speak in **braces** now, and the
shell flickers out on the second frame, which is a better wisp than the old one.

Two more sprites paid, and the second is the interesting one:

- **`ashling.txt`** — her trailing embers were `.` and `,`: the retired dot, and the
  Grave Rat's tail. They're `'` now, which is the ember glyph in `juice.tsv`, which
  is what they always were.
- **`stalker.txt`** — her eye was the digit **`0`**. *Damage numbers need the digits,
  and a field sprite had one.* Found only by grepping the art for `[0-9]` **after**
  deciding the numbers layer existed. Her head is `<¤>` now: a lamp of an eye held in
  mandibles, rather than a hole. It also gives the Ghoul her parentheses back.

`.` is retired from the whole game. At a glance a baseline dot **is** `·`, and `·` is
an XP mote, and the owner has already told us once that he cannot find his XP.

Zero violations across all 12 field sprites, machine-checked; `npm test` 139/139.
The check also caught `assets/README.md` asserting the Countess is the only sprite
over 5×3. **The Gravewarden is 9×5.** The rule and the roster disagreed, and the rule
was the one that was wrong.

### Standing asks to John (unchanged, none blocking)
1. `label` column → the level-up screen still prints `hp_per_sec +0.25` at the player.
2. Card width should follow the field, clamped `[24,40]`; evolution box `28` → `44`.
3. Passives should show their `note` as the effect line, numbers dimmed underneath.
4. `# opaque: true` on `player.txt` — a ghoul's parenthesis is inside the Warden's boots.

---

## 10.07 — the last §0 criterion, audited: the first minute had no shape

### John → Jane: the card speaks English (`61ca984`)

Landed while Jane was writing her juice note: the `label` column is read (so the
level-up screen no longer says `hp_per_sec +0.25` at the player), card width follows
the field clamped `[24,40]`, the evolution box grew `28 → 44`, and the weapon
fallback dropped its trailing word so it stops truncating. Every item from Jane's
[27] is closed.

### Jane → John: "One ghoul. Then three. Then a lull." was never true

§0 lists six acceptance criteria and says *"I will play the build and check each one
by hand."* Five had been checked. This was the sixth:

> *"The first minute has a shape. One ghoul. Then three. Then a lull. The player must
> feel the tide breathe before it drowns them."*

**Jane dumped `target(t)` out of her own table:**

| t | enemies alive (target) |
|---|---|
| 0:00 | **3.00** |
| 0:30 | 3.86 |
| 1:00 | 5.43 |

The player has never met one ghoul — he is dropped in front of three. And there is
no lull *anywhere in the run*, at any minute, because
`target(t) = 3 + 217·(t/1200)^1.5` is **monotone increasing by construction**.

> **A closed loop chasing a monotone target cannot exhale.**

Jane specified breathing, then specified a curve that forbids it, and the two lived
four hundred lines apart in the same file for a week. That is now the third time the
same shape of error has surfaced — the Warden's alphabet, the luminance ladder, and
now the tide. In all three the rule was fine; the thing the rule was *about* was
somewhere else, and only dumping the real numbers found it.

**The fix: `open` rows.** The first ninety seconds are authored by hand, linearly
interpolated, then the formula takes over. The closed loop is the right instrument
for minute six and the wrong one for minute zero, where every enemy on screen is a
sentence in a tutorial nobody is reading.

```
0:00   ONE ghoul. It walks at you. You do not aim, and it dies. The whole
       game, taught in eight seconds, with nothing else on the screen.
0:14   Three. Killing was never the constraint. Position is.
0:28   One. THE LULL — the most important row in the table.
0:30   Twelve rats: the swarm `beat` finally has a silence to land in.
1:30   Hand off. formula(90s) = 7.46, the last row is 7, no step.
```

Silence is what makes the next noise loud, and 0:28 is the only moment before 17:00
where the player has room to notice he is enjoying himself.

**The one rule this depends on, flagged to John as the easy thing to get wrong:**

> The target is a **spawn gate, never a despawn order.** Above target the director
> spawns nothing; it never *kills* to meet the number. The lull is not "eight enemies
> vanish" — that would look like the engine leaking. It is "you kill the three in
> front of you, and for six seconds the dark does not send more."

A falling target makes `target − alive` go negative for the first time in the
project's life. John's spawn call has never seen a negative deficit. Clamp it.

### Where §0 stands now

| # | Criterion | |
|---|---|---|
| 1 | It opens — double-clicked, or hosted | John, done (single-file build) |
| 2 | It feels good to walk | John, done (`pickup_radius_base`) |
| 3 | Things die without aiming | verified by simulation: first kill at 2.2s, standing still |
| 4 | You can see you, the XP, the threat | Jane, done — one lever left (`opaque` on the player) |
| 5 | A card reads in two seconds | John, done (`61ca984`) |
| 6 | **Hitting a thing looks like hitting it** | specced today (§14); John's next |
| 7 | **The first minute has a shape** | specced today (§11 `open` rows); John's next |

Nothing outstanding is late-game. Endless mode, the Reapers and new Crossroads
upgrades all stay frozen.

---

## 10.07, evening — "Stick figures." The art gets a body.

**Owner (feedback 22:27):** the game runs well, good job — but the characters look
like stick figures. Make it look like an actual game; take inspiration from
**Effulgence RPG**. Stay in ASCII (open to leaving it, but prefers to stay).

**Jane:** He's right, and it isn't a pivot. We left the terminal for a 180×60
canvas back on 09.07 (§5.0) *specifically* so sprites could be real drawings (§10),
and I never redrew the field — the `@ /|\` player and `(o)` ghoul are terminal-era
leftovers. This is §0 core polish, not a feature.

The fix, written up as **design.md §10.5**: *volume is glyph **density**, not colour
brightness.* The luminance ladder (§9) caps how bright an enemy is coloured, never
how much ink a glyph puts in its cell — so a ghoul's gut can be a solid `▓` and a
Wight's core a `█`, still dim grey, still under the XP mote, and suddenly they have
bodies instead of outlines. The second axis was free the whole time.

**Shipped:** player redrawn 5×5 (hooded, cloaked, a lantern that swings as he
walks — the sprite the owner named); Ghoul / Wight / Grave Rat reshaded with mass.
Bat, Rattlejack, Blood Wisp, Stalker and the alt characters are the next batch,
same principle. Machine-checked: zero alphabet violations, all masks aligned.

**Jane → John (the one dependency):** we're on canvas, so this rides entirely on
whether John's canvas font renders the block glyphs `█ ▓ ▐ ▌ ▄ ▀`, the hood
`╭ ╮`, and the lantern `◆` filling their cells cleanly. Asked John to screenshot
the player + a ghoul and name the font in `john.md`; I'll fall back within
whatever the font has (e.g. `┌ ┐` for the hood) if anything renders wrong.

**On the record, no action:** `▒`/`░` belong to the gore layer (they already do in
`glyphs.tsv`); I wrote that reservation into the art contract so no future sprite
of mine steals the floor's texture. Enemy fill is `█ ▓` + half-blocks only.

| # | Owner ask, 22:27 | Status |
|---|---|---|
| a | Look like an actual game, not stick figures (Effulgence) | player + 3 mobs reshaded; §10.5 written; rest queued |
| b | `npm run dev` = developer mode w/ cheats; `npm start` = browser game | John's lane |
| c | `npm start` crashed at localhost; worked from built `dist/index.html` | John's lane |
| d | Make it look visually more impressive | §10.5 is the plan; the reshade is step one |

---

## 10.07, late — the two halves of 22:27 meet in the middle

**John (john.md [16], commit `2ccb4b9`):** did the code half of 22:27. `npm run dev`
is now a cheat panel (god / level-up / kill / gold / skip-time), `npm start` is the
browser build with the crash fixed, and the **juice reached the screen** — hit-
flash, damage numbers, hit-pops, sparks, screen shake (Jane's §14 spec). He handed
the art explicitly back to Jane and offered to loosen any techstack constraint the
Effulgence style needs.

**Jane:** no constraint needed loosening, and the one open question answered itself.
John's XP bar renders eighth-blocks (`▁..█`) and his charset note already blessed
`◆ ▓ ▄`, so **block elements provably render on the canvas** — the reshade's whole
dependency. The only glyph Jane had used that he hadn't shown drawing was the
rounded hood `╭ ╮`; she removed it (the Warden's hood is a `▄▄▄` cowl over `▐@▌`
now, only confirmed glyphs). So there's **no open font question and nothing for
John to change.**

**Where the art landed this pass — the whole character-facing surface:**
- **Player** → 5×5 hooded lantern-bearer (the sprite the owner named).
- **Ghoul, Wight, Grave Rat, Bat, Rattlejack** → bodies with mass (density, not
  brightness — ladder intact). Every enemy from 0:00–8:00 upgraded.
- **Blood Wisp, Stalker** → deliberately left thin (*mass is for the corporeal*).
- **Ashling, Beggar** → 5×5, up to the Warden's fidelity, each with its own read.
- **Title screen** → an illustrated lantern-bearer ringed by eyes in the dark,
  replacing the flat mote-scatter — the first frame on boot now sells the game.

**Deferred (not blocked):** heavier shading on the Gravewarden/Countess and the
dawn/death/crossroads banners — held until the owner reacts to this batch, since
over-drawing the boss can cost the legibility the field depends on.

**Update, same evening — the hero tier got drawn after all.** Jane reconsidered:
the legibility worry is a *field* worry, and the Countess **fights alone** (the
director halts and the clock freezes at 19:00), so there's no crowd for a big
sprite to smear into. So she drew both:
- **Countess** — from a moth-ish outline to a membrane-winged vampire: wings that
  fill with `▓` and flap, a pale face with glowing red eyes and white fangs, a
  crimson gown. Still 28×11, 2-frame, body column-locked (no wobble).
- **Gravewarden** — from an outline skull to a riveted, helmed golem with a solid
  core; the Wight's bracket language scaled up and armoured, bright-`Y` eyes kept.

So the **entire cast — chaff to boss — is now on the new fidelity.** Only the
dawn/death/crossroads FIGlet banners remain, and those aren't figures. Jane's desk
is clear of the 22:27 ask; next move is the owner's reaction.

---

## 11.07, 00:03 — the owner pivoted the game to space, and the reaction never came

**Owner (`owner-feedback.md`, 11.07 00:03):** a customer decided ASCII art
isn't the direction, bought a full space-game asset pack (now in
`assets/space-assets/`), and wants the setting moved to space. Same note: the
game has no sound and that makes it unfun — a complaint that's been sitting
unaddressed since 09.07.

**Jane:** so the hero-tier art from the previous entry above never got its
owner reaction — this landed twelve hours after "the whole cast is on the new
fidelity" instead. Read literally, it's a reskin, not a redesign: the loop,
the clock, weapons, XP/leveling/evolution, the spawn director, crossroads, and
the whole juice system are untouched. What moves is the sprite layer (ASCII
`.txt` glyphs → the purchased PNG pack), the setting's dressing (graveyard →
derelict debris sector), and — genuinely new — audio.

Full writeup is `design.md` §15: an asset survey of the whole pack (ships,
five enemy-tier colour variants, elites, a boss with a built-in second form,
a weapon-effects pack, backgrounds, a GUI kit, and ~40 audio files), a roster
mapping table (old bestiary tier → new pack file), the old ASCII legibility
laws (§9/§10/§10.5) marked superseded but kept as the historical record —
translated instead of deleted, since the space skin has to solve the same
readability problems again. `design.md` §1 and §6 (the pitch and the player)
are rewritten in place; the rest of the superseded sections got pointer
banners rather than a full rewrite, on purpose — see the phasing note below.

**The one thing genuinely new, not a reskin:** sound. Jane's audio proposal
(§15.4) deliberately hangs every SFX cue off juice events John already built
(`hit_flash`, death pop, `levelup_flash`, hitstop) rather than inventing a
parallel system, and ties the ambient-to-combat music swell to the spawn
director's existing target-population number — no new tuning surface either
side has to build from scratch.

**Jane → John, the contract ask (`jane.md` [33], mirroring the original
09.07 ASCII contract):** three open questions before the new pipeline can be
built — (1) are the `Galactica Ranger` ship's 15 numbered files loadout tiers
or animation frames, (2) what footprint in world units does a sprite get now
that there's no character-cell grid, and does the "cell is 2:1" rule go away,
(3) what plays the audio, and can it crossfade a loop under a one-shot sting.
Not blocking on the answer — Jane starts phase 2 (a vertical-slice proof:
Ranger + one enemy tier + a background) on a reasonable assumption the moment
she has one, same as always.

**Explicitly parked, on the record:** the pack also bundles a full
tower-defense sub-pack (walls, gates, turrets) — not routing that into the
survivors roster; that's scope creep unless the owner asks for base-building
specifically. And a proposed boss second-form (the pack ships ready-made
"Evo" art for the Overlord) is written up as a want, not a commitment — it
needs phase-trigger plumbing that doesn't exist yet, and today's `[0]` rule
is still "polish the core first."

**Phasing, so this doesn't become a redo-everything-badly scramble:** doc +
mapping + contract ask (today) → one vertical slice as tech proof → full
field roster + weapon/passive card art → audio wiring. Same shape as the
original ASCII-to-canvas migration (§5.0), which proved itself on one sprite
before the full reshade.

| # | Owner ask, 11.07 00:03 | Status |
|---|---|---|
| a | Move art direction + setting to the purchased space pack | design.md §15 written; roster mapped; contract ask posted to John; no engine changes yet — that's phase 2, John's lane once the contract answers land |
| b | Add sound, currently unfun without it | proposal written (§15.4), wired to existing juice/director hooks; needs John's audio-engine answer before it's buildable |

---

## 11.07, later — the pivot's contract got answered, wired, and actually looked at

**Jane:** went looking for whether John had started before he'd written
anything up, and he had — `images.tsv`/`audio.tsv` parsers, the raster and
audio engines, all wired into `App`/`World`, all built and waiting for data
files that didn't exist yet. His code answered all three open contract
questions from the last entry: sprites are one static image per id (no
frames/tiers), world units stay isotropic with the same 2:1 cell convention
as before (a guess of Jane's that turned out wrong, corrected), and audio is
Web Audio with one active music loop plus unlimited overlapping one-shots —
no crossfade yet, so the ambient-to-combat swell Jane proposed needs a real
follow-up code change, not just data.

Wrote `assets/images.tsv` (the Ranger + 5 mob tiers, sized off each PNG's
real pixel aspect ratio) and `assets/audio.tsv` (all 13 sound events `World`
already raises, plus the music bed), both pointing at the tracked
`assets/space/` folder per the owner's earlier call, never the gitignored
vendor pack. `npm test`: 142/142. `npm run build`: copied exactly the 20
files referenced, nothing more.

**Then Jane actually looked**, rather than trusting the test suite — ran the
real build in a headless browser and screenshotted it. The Ranger renders,
correctly positioned, no errors. But two things a passing test can't catch
showed up immediately: the player ship is nearly invisible against the black
field (no glow/outline — "the player must never be lost" failing on the
first sprite shipped), and the curated starfield background is committed but
never drawn (no code path for a full-field background exists yet — a
different kind of ask than the per-entity `images.tsv`). Both written up as
concrete asks for John in `todo.md`, ahead of curating more roster art.

| # | Owner ask, 11.07 00:03 | Status |
|---|---|---|
| a | Move art direction + setting to the purchased space pack | Ranger + 5 mob tiers wired and rendering; player-legibility and background-layer gaps found and queued; rest of roster (elites, Overlord, weapons) still to curate |
| b | Add sound | 13 SFX events + 1 music track mapped and loaded; ambient-to-combat intensity swell still needs a code hook that doesn't exist yet |

---

## 11.07, later still — the boss renders, the background almost does, elites are curated

**John independently found and fixed both gaps Jane flagged** (`john.md`
[33]/[34]): the player ship now has a reserved-white glow so it reads
against any background (the raster equivalent of the old rule that only the
`@` may be bright white), and he built the full background contract
(`backgrounds.tsv` — id/path/parallax/tileWu) rather than hardcoding a
choice, asking Jane the one genuinely creative call: should the starfield
sit pinned to the screen or drift with the world? He'd also already built
the ambient-to-combat music crossfade from her original proposal, reusing
the spawn director's existing intensity curve for free.

**Jane's call:** parallax 0.15 — drifts enough to sell motion (the game's
whole pitch), stays inert enough not to compete with anything that matters,
same spirit as the luminance-ladder legibility law. Wrote the actual data
row, split the music table into three tracks matching the ambient/combat/
boss ids John built, and — since the elite/boss code path turned out to
need zero new work — curated art for both: the Gravewarden (a riveted
artillery platform) and the renamed Overlord (a radial crystalline horror,
replacing the vampire Countess).

**Verified it in a real boss encounter, not just a test pass:** jumped to
19:00 in a browser and watched. The Overlord renders exactly as intended —
big, purple, unmistakable. But the starfield still isn't drawing, even with
everything wired — Jane traced the actual bug this time rather than
re-flagging the symptom: `boot.ts` never hands the background's image path
to the thing that preloads images, so it's permanently "not loaded yet." One
line for John, not a mystery anymore.

142 → 144 tests passing across the session. Both agents are now converging
independently on the same problems before the other has to ask — the
loop's working as designed.

---

## 11.07, later still — the title screen stopped looking like the old game

Small, fast fix, no code dependency: `ui/title.txt` is still the same ASCII
pipeline as everything else, so Jane redrew the boot screen's figure
directly — the hooded lantern-bearer became a small ship silhouette
(nosecone, cockpit, hull, twin engine flares), using the same
reserved-alphabet convention (`@` still marks the player) so it stays
consistent with every other rule in the art contract. Also fixed the death
screen's "the night takes another lantern-bearer" line, now "another pilot."
The dawn and crossroads screens turned out to be genre-neutral already (a
sunburst, a market stall) and didn't need touching.

Meanwhile the field roster is fully curated and confirmed working end to
end — player, 5 mob tiers, the Gravewarden elite, the Overlord boss, the
starfield background, and audio all render correctly in a real browser run,
including a full boss encounter. Remaining open threads: weapon-effect art
(a contract question with John, since the live effects are drawn
procedurally and there's no sprite id for them yet) and an optional boss
second-form using the pack's ready-made "Evo" art, both parked as proposals
rather than commitments.

---

## 12.07, 12:42 — owner: "why is the ship on its place," and wants "the full graphical overhaul" next visit

**Owner (`owner-feedback.md`):** *"Why is the ship on its place! Space ships
turn and move and do epic stuff. this gameplay is now weird for a space
game! Next time the customer comes back they want to see the full graphical
overhaul!!"*

**Jane:** two asks, handled separately. Full writeup `design.md` §15.11
(rotation) / §15.12 (the overhaul checklist), contract ask `jane.md` [45],
mirrored to `todo.md`.

On the ship: confirmed by reading the actual render call that
`render.ts:167` never passes an `angle` to `drawImage`, even though John
built full rotation support into the canvas backend during the raster pivot
and left himself a note that it was unused "kept so that's additive later."
Later is now. Design call: derive the sprite's heading from the player's
real movement vector (already computed each frame in `movePlayer`), not
from `world.facing` — that variable is gameplay-only (what The Chain fires
along) and touching it risks reopening the "walking into damage" bug from
§7. Smooth the turn (proposed ~480°/s cap) so it reads as a bank rather than
a twitch at swarm density, and hold the last heading at rest instead of
snapping to a default. Also checked the Ranger's own source art before
asking John to guess: nose points up, so `angle: 0` should already line up
correctly.

On "the full graphical overhaul": rather than leave that as one vague ask,
gathered every open visual thread already sitting in `design.md`/`todo.md`
into one ranked checklist (§15.12) — ship rotation first, then the disabled
card-icon bug, the still-fully-ASCII GUI chrome (the largest remaining
"still looks like the old game" surface), the deliberately-procedural
weapon effects (listed as *closed*, not missed), a proposed thrust-flare
follow-on, and the parked boss phase-2 swap. Not a commitment to clear all
six before the next visit — a shared map so both agents and the owner are
working off the same picture of what "finished" covers.

Not blocking on John's answer — Jane's moving to work the checklist into
concrete next picks while this sits with him.

---

## 12.07, later — the ship turns (shipped), and John asks whether the swarm should too

**John:** picked up the rotation ask independently before reading Jane's
`jane.md` [45] — same design, arrived at separately: heading derived from
movement, not `facing`; capped turn rate, not a snap; holds at rest;
confirmed the Ranger noses up. Built it, verified all four cardinal
directions in a real browser. One number differed — his 720°/s by eye vs.
Jane's 480°/s written into `design.md` §15.11 — and since the design file is
the source of truth, he reconciled to hers. Left one thing open rather than
guess: `moveEnemies` already computes a velocity for every mob, so the same
rotation is mechanically just as cheap, but he didn't know whether the mob
art was actually drawn nose-up — a bug sprite spinning around an axis
nobody drew it for reads as broken, not epic. Correctly called that an art
question, not a code one, and handed it back instead of assuming.

**Jane:** looked at the actual sprite files rather than guess back.
`spacebug_*.png` (all 5 palette-swap tiers) and `gravewarden.png` both have
a clear "nose" — a raised turret/head breaking the radial symmetry at the
top, legs splayed symmetrically behind it, the same visual grammar as the
Ranger. Both turn correctly. The Overlord needs nothing — she already has a
90°/s `bossHeading` mechanic from her charge attack, unrelated to this
thread entirely. Decision: yes, extend movement-based rotation to the mob
roster and the Gravewarden; suggested a faster turn rate than the player's
for trash mobs (small, erratic swarm feel) but left the actual number to
John, same division of labour as the player's turn rate was. Posted
`jane.md` [46]/`design.md` §15.11.1.

Two independent convergences on the same design in one session now — the
loop's holding up under real pressure, not just the easy cases.

---

## 12.07, later still — Jane scopes the GUI overhaul, finds it's blocked everywhere, catches John already fixing it

**Jane:** picked up `todo.md`'s "GUI is still 100% ASCII" item. Before
picking any art, checked every screen that draws a UI panel (`app.ts`'s
`drawBox` callers: pause, level-up card, level-up header, death screen) —
all four sit on the identical bug that made the level-up cards render blank
(§15.10): the panel's own background fill always paints over any raster art
meant to sit in front of it. So the card fix everyone's been treating as a
card fix is actually the one blocker for the entire GUI overhaul — worth
saying plainly before it gets rediscovered screen by screen.

Then checked John's working tree before writing that up as still-open, and
caught him already mid-build on it: an opt-in flag that defers UI raster
draws to paint after every buffered fill, rather than flipping the field's
draw-order rule globally. Better fix than what Jane would have asked for —
the field's existing "raster sits under glyphs" law (keeps ground/decals/HUD
legible over a ship) stays untouched everywhere it's currently correct.

With that unblocking everything, Jane proposed the actual art: dark
brushed-metal panel textures from the vendor pack's `Round-Rect` set for
the level-up card frame and pause/death panels (on-theme, no baked-in
text), a plain 3-state button parked until there's an actual clickable menu
to attach it to (today's input is keyboard-only). Phased so the cheapest
win — re-enabling the 7 already-picked card icons — lands first and
doubles as confirmation the fix works.

`design.md` §15.13, `jane.md` [47], mirrored to `todo.md`.

---

## 12.07, later still — the level-up cards actually show art now

**John** shipped the `onTop` fix (`john.md` [46]) and, notably, verified it
himself before handing it back: temporarily uncommented the same 7 `cards/*`
rows Jane had parked, screenshotted a real level-up screen, confirmed the
icons render, then reverted the file with a clean `git checkout` rather
than commit into Jane's file.

**Jane** made it permanent: uncommented the 7 rows for real, ran the suite
(146/146), then drove a headless browser against the actual dev server
herself rather than take the fix on faith twice — forced a level-up,
screenshotted it. Sanguine Nova's card shows its blue-orb icon sitting
correctly inside the box, in front of the background. Passive cards on the
same screen (no `cards/*` row) still show their ASCII diagrams, confirming
the fallback still works too. Zero console errors.

The card-icon thread that opened back on 11.07 (`jane.md` [43]) is closed.
Next up in `design.md` §15.13's phasing: the level-up card frame's own
background, using the `Round-Rect` panel texture Jane already picked.

---

## 12.07, later still — the Overlord's phase-2 art, decided (and not where the todo item guessed)

**Jane** closed the last undecided item on the pivot's original roster
list: whether the boss deserves a second look partway through the fight.
Looked at all three `OverlordEvoSample` files before picking — one reads
decorative (ruled out), one reads noticeably more venomous than the current
purple (the pick, curated to `assets/space/boss/overlord_hunt.png`).

More interesting than the art pick itself: the trigger point. The original
todo item guessed "50% HP" before the fight's actual phase table
(Court/Hunt/Dusk) existed in this much detail. Jane checked it against the
real boundaries instead of taking the round number at face value — 25%
(Dusk) is when the screen goes black *even with `--no-dark`*, so a recolor
there would be invisible; 70% (Hunt) is when she stops being stationary and
starts charging, the biggest behavioural swing in the fight, while the
arena's still lit. Swap at Hunt, not at an arbitrary halfway point nobody
in the fight would actually notice.

Flagged as a want, not a blocker (`jane.md` [49]) — needs a phase parameter
John hasn't built yet on the boss's sprite lookup, pick it up whenever
nothing more urgent is queued.

---

## 12.07, later still — a continuity break nobody had flagged: the ship still carried a lantern

**Jane**, checking a level-up screenshot for something else, noticed a
passive called "Lantern Oil" ("The lantern burns brighter.") — unchanged
since before the pivot. Chased how far it ran rather than fix it in
isolation: exactly two player-facing strings describe a literal lantern
object that stopped existing once the player became a ship. Renamed both,
term-for-term rather than redesigned — `passives.tsv`'s "Lantern Oil"
became "Reactor Fuel," `weapons.tsv`'s "Wisp Lantern" became "Ion Wisp"
(kept "Wisp," it isn't the broken word; kept the evolution name "Corona,"
already reads sci-fi). Internal ids left alone, same reasoning as keeping
`countess.tsv`'s filename. Deliberately did not touch the much larger
"lantern" vocabulary running through `design.md`'s own mechanic prose, or
a Dusk-phase flavour line in `countess.tsv` — checked that one first and
confirmed it's parsed but never actually shown to a player, so it's
documentation language, not a live bug.

Verified against the real parser rather than a screenshot this time — the
level-up draw is randomised and wasn't converging in a live browser in
reasonable time, so imported `parseWeapons`/`parsePassives` directly and
printed the output. Zero warnings, both names correct.

## 12.07, later still — the last piece of §15.13 closes: the panel texture, picked and wired

**John** built the plumbing before the art existed (`john.md` [47]): a
`panelImg` option on `drawBox`, one shared backdrop id (`panels/frame`)
behind pause, the level-up card frame, the evolution screen, and the death
summary — verified with no regression while the id was still unresolved.
Also (`john.md` [48]) extended ship rotation to the entire mob roster and
the Gravewarden, the open question from two entries ago: two turn rates,
900°/s for erratic trash mobs and 480°/s (matching the player) for the
Gravewarden, split on the same `elite` flag that already means "heavy,
deliberate machine." Verified both tiers in a real browser.

**Jane** closed the loop: picked the `Round-Rect` panel texture surveyed in
§15.13, curated it into `assets/space/ui/panel_frame.png`, wired the row.
Screenshotted both shapes the backdrop has to cover — the level-up cards
and the pause box — texture stretches cleanly on both, nothing unreadable.
One honest note rather than a silent ship: stretched across a full card the
texture reads brighter and busier than it did in isolation, worth a possible
tint pass later, not treated as a defect now.

§15.13's whole thread — traced 11.07, fixed and re-enabled today, panel
texture wired today — is closed.

---

## 12.07, later still — the boss phase-art thread closes, and a real testing limit gets documented

**John** built the phase-trigger plumbing (`john.md` [49]): the boss's
sprite lookup now tries `sprites/countess/<phase>` before falling back to
the base art, pinned with three unit tests. While testing it live he
briefly considered reverting his working tree with `git checkout` and
caught himself — Jane had uncommitted work in the same file at that exact
moment (the panel-texture row) — so he backed out only his own added test
line by hand instead of risking a blind wipe.

**Jane** wired the actual row (`sprites/countess/hunt`), sized off the
art's real pixel proportions rather than copy the base row's height
verbatim. Tried to get a live screenshot of the Hunt-phase swap, the
standard held everywhere else this session, and hit a real wall instead of
a bug: the dev `?sim=` fast-forward silently caps at 20,000 ticks no matter
what's requested (`boot.ts:145`) — about 5:33 of simulated time, enough to
reach the boss's arrival but not enough combat afterward for a weak
character to dent a 9000 HP pool down to the 70% trigger. Documented it
rather than chase a code change for it; the actual question at stake (does
the right art id get picked for a given phase) is exactly the kind of thing
John's unit tests already answer more precisely than a screenshot could. A
sim screenshot taken during the attempt did land one free bonus: it
incidentally reconfirmed "Ion Wisp"/"Reactor Fuel" rendering correctly in a
level-25 mid-run context, a second, independent confirmation of the earlier
rename.

Every thread opened today — ship rotation, mob rotation, the card z-order
bug, the GUI panel texture, the lantern-naming continuity break, and the
boss phase art — is now closed.

---

## 12.07, later still — the checklist's last item, closed out as a proposal

**Jane** worked through the final open line on the graphical-overhaul
checklist opened at the top of today's session: a thrust/engine-flare
visual. Checked the vendor pack for exhaust art first — nothing there —
and ruled out raster for the same reason weapon effects stayed procedural
back when John answered that question: there's still no animation contract
for a raster sprite, and a flare that can't flicker just reads as a
sticker glued to the hull. Proposed a new procedural particle stream
instead, reusing the mechanism (not the emitter) behind the existing
ember/spark system that already powers Reactor Fuel's visual — gated on
movement so it's off at rest, spawned at the ship's tail using the heading
value shipped earlier today, cyan to stay visually distinct from Reactor
Fuel's amber.

Flagged explicitly as not urgent — her own addition, not something the
owner asked for or a bug, real payoff for cheap but polish on already-
shipped work. With this, every item on the checklist opened at 12:42 today
is either shipped or sitting with the other agent as a scoped, specific
ask — nothing vague left on the board.

---

## 12.07, later still — the old XP-legibility flag gets an actual verdict, and a fix curated for it

With the day's checklist closed, **Jane** went back to a much older item
that had been sitting flagged as "at risk" since the pivot itself (11.07):
whether XP pickups would stay readable now that everything else on the
field is a full raster sprite. Rather than leave it flagged a second time,
she checked. The mote's own legibility fix — reserved bright cyan plus a
motion pulse — is real and predates the pivot, solving the exact problem
the owner reported on 09.07 ("XP is hard to see... goes under the blood").
But it was never re-tested against what the pivot changed: every mob went
from a single character to a full sprite with real visual weight, and the
mote didn't. A screenshot of a dense, fought-over patch confirmed it — the
mote is hard to pick out at a glance, not because of colour (cyan still
can't collide with anything) but because a lone glyph cell now sits next
to a field of much bigger, brighter raster art. Checked the decal floor
too before blaming it: the "one decal per cell" rule is still enforced, so
the red mass on screen is legitimate fight history, not a new bug — though
the screenshot came from a stationary, sim-compressed test that likely
piles kills tighter than normal play, a caveat worth keeping in mind.

Curated a fix rather than hand back a bare re-flag: a small glowing cyan
orb from the vendor pack, `assets/space/pickups/xp_orb.png`. It needs real
code, confirmed before asking — `drawPickups` has never called
`imageFor()`, the same gap weapon effects had before that question got
answered. Posted as a proposal, not urgent, but not something to leave
parked indefinitely either, since it's the owner's original complaint from
three days into the project.

---

## 12.07, 13:14 — fresh owner feedback lands: "ship is so slow, boring" and "why is menu screen long night"

**Owner:** *"Space ship si so slow this is boring. Why is menu screen long
night???"*

**John** got there first and split it correctly into three separate
things rather than guess at one (`john.md` [52]): the player's turn rate
(his lane — bumped 480°/s to 720°/s, verified live, since the visual
catch-up between an instant input and a still-turning sprite was plausibly
reading as sluggish), raw movement speed (flagged to Jane rather than
changed on one sentence's literal reading — a real balance number with
real difficulty-curve consequences), and the title itself (flagged as a
naming call, not a bug, with the four code-owned spots already found and
waiting).

**Jane** closed out both of her pieces. Move speed: checked against the
actual mob roster before picking a number — the Bat (26 wu/s) is the one
enemy deliberately designed to outrun the player, everything else sits
well under the old 20 — raised the player to 24, close enough to matter,
not so much it breaks the Bat's identity as the one real chase threat or
trivializes dodging. Title: renamed "THE LONG NIGHT" to "LONE NIGHT" — the
specific Game-of-Thrones echo, not "night" as a word, is almost certainly
what read as leftover fantasy branding, since the whole survive-until-dawn
structure was already checked and kept during the pivot. Redrew the title
banner by cutting and reassembling the game's own already-drawn letters
(L, O, N, E) rather than freehand new ones — a bigger rename like "Last
Light" is still on the table later, deliberately deferred because it needs
letters (A, S) the banner's font doesn't have yet, and a first-frame,
highly-visible asset was worth getting right over getting fast.

**Meanwhile John had independently already built the two things Jane
proposed earlier** — the thrust trail (§15.17) and raster XP motes
(§15.18) — both to spec, both tested, both verified live before Jane even
finished her reply. He flagged that the thrust trail in particular was
good timing: a visible engine effort sells "fast" independent of the
actual speed number, which is probably closer to what "boring" was asking
for than the balance change alone. Jane wired the last piece of each —
the actual `images.tsv` rows for the XP orbs — and confirmed clean via
the parser.

Every piece of the 13:14 feedback is now either shipped or sitting as one
scoped, specific handoff (the four title strings in John's files).

---

## 12.07, later still — title fully swept, and two silent raster regressions caught: the boss telegraph and hit-flash

**John** finished the title rename same-day, and found more than the four
spots Jane had flagged: `serve-static.ts`'s banner (the actual `npm start`
path a real player sees, more visible than the dev-only banner), the
terminal build's own strings, and the root `README.md` heading, which he
fixed himself as build documentation rather than leave for Jane, flagging
the call so she can override it if she'd rather own it.

Then, checking his own old code comments instead of trusting them, he
found two real gaps that had been silently broken since raster took over
the roster: the boss's charge telegraph (the pulsing red warning before an
un-outrunnable 52 wu/s charge) had no raster equivalent at all — the tint
math only ever existed on the ASCII fallback path — and ordinary hit-flash,
the flinch cue on every single hit in the game, had the identical problem.
Neither ever showed up in a screenshot because both only exist for a
60-800ms window, invisible to the very verification method this whole
session has otherwise relied on. Fixed both by reusing the `glow` param
originally built for the player's own halo — one mechanism now carries
three jobs (player halo, boss telegraph, hit-flash) rather than three
separate compositing tricks.

Jane confirmed both are restorations of already-approved behaviour, not
new design calls — nothing came back to her file.
