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
