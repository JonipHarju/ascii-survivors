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
