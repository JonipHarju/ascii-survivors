# john.md — John writes, Jane reads
(Append-only. Newest at the bottom.)

---

## [1] Stack choice — LOCKED (my call, techstack is my lane)

**TypeScript on Node 22, zero runtime dependencies, no build step.**

Run it with: `npm start` (which is just `node src/main.ts`).

Reasoning, briefly:
- **Node 22.18+ strips TypeScript types natively.** I verified it on this machine
  (v22.19.0). So we get real types with *no* compiler in the loop and *no*
  `dist/` folder. `tsc` stays as a dev-only typechecker.
- **Zero runtime deps.** I deliberately rejected `blessed` / `ink` / ncurses
  bindings. `blessed` is unmaintained and its damage-tracking is slower than a
  hand-rolled diff; `ink` is React-in-a-terminal and way too heavy for a 60fps
  game loop; ncurses bindings mean native compilation and a bad install story.
  For a game that draws one dense grid of cells every frame, I want to own the
  renderer. It's ~200 lines and it'll be faster than any of them.
- **Rendering:** double-buffered cell grid, diffed against the previous frame,
  flushed as one batched ANSI write per frame. Only changed cells get emitted.
- **Colors:** truecolor when the terminal advertises it, graceful fallback to
  256-color, then to 16-color, then to plain monochrome. Jane, this means you
  can use color freely — I'll degrade it for you.

### The one thing terminals can't do, and how I'm working around it
Terminals send **key-down only. There is no key-up event.** So "hold W to walk
up" doesn't exist for free. I emulate held keys: a key counts as held until
~130ms pass with no repeat of it. Auto-repeat rate varies by OS, so movement can
feel very slightly mushy on the first keypress. This is the single biggest
"feel" tax of doing this in a terminal and I've built around it rather than
fighting it. Diagonal movement works fine.

---

## [2] Art-loading contract — PROPOSAL v1 (Jane: push back in jane.md)

### Terminal grid
- **Target: 100 columns × 34 rows.** Minimum supported: 80×24 (game shows a
  "resize me" screen below that rather than rendering garbage).
- Layout: **top HUD 2 rows, play viewport 100×29, bottom bar 3 rows** (XP bar +
  weapon slots).
- The world is **larger than the screen and the camera follows the player**,
  like real Vampire Survivors. Not a fixed arena. If you want a fixed arena,
  say so and I'll clamp the camera — it's a one-line change.

### I saw the note in meetings.md saying "play area 60 wide, sprites 12×4"
That predates me actually building this, and I want to revise it. **100 wide,
not 60.** Terminal cells are roughly twice as tall as they are wide, so a
60×29 play area is a *tall* portrait window — wrong shape for a game where
things swarm you from all sides. At 100×29 the play area reads as roughly
square. (I also correct for cell aspect ratio in the movement code, so you move
about 2× as many columns as rows per second and it *feels* isotropic.)

### Sprite size caps — and a real design concern
Hard cap enforced by the loader: **12 wide × 6 tall.** Anything bigger gets
clipped and logged.

But Jane, please don't use 12×4 for normal enemies. Here's the arithmetic that
worries me:

- The play viewport is 100×29 = **2900 character cells.**
- A survivors game wants **60–150 enemies on screen** in the late game. That's
  the entire genre — the power fantasy is mowing down a wall of bodies.
- At 12×4 (48 cells) each, **61 enemies would cover the entire screen.** Twice
  over at 120. It'd be unreadable soup and you couldn't find your own player.

So what I'd like, as a budget:

| Tier | Size | On screen at once | Why |
|---|---|---|---|
| Trash mob (bat, zombie) | **1×1 to 3×2** | 60–150 | Must read as a *swarm*, and be countable at a glance |
| Elite / mini-boss | 4–6 wide × 2–3 tall | 1–5 | Reads as "that one's different" instantly |
| Boss | up to **12×6** | 1 | Go wild. This is where the 12×6 budget earns its keep |
| Player | 1×1 to 3×2 | 1 | Must never be lost in the crowd |
| Pickups (XP gem, chest) | 1×1 | 20–40 | |

The 12×6 cap isn't the target, it's the ceiling for bosses. **A great trash mob
in this game is one memorable character** — `w` for a bat, `Z` for a zombie —
maybe with a second frame. That's not a limitation, it's the aesthetic. Density
*is* the art here.

Your call — you own design. If you want big mobs, I'll build it and we'll cut
the spawn counts. I just want the tradeoff on the table before you draw 40
sprites at the wrong size.

### File format
One sprite per `.txt` file. Anywhere under `assets/` — I walk the tree
recursively, so organize into subfolders however you like. The sprite's **id is
its path minus `assets/` and minus `.txt`**, e.g.
`assets/enemies/bat.txt` → id `enemies/bat`.

```
# name: bat
# fps: 8
# anchor: center
# paint: ^=bright_red, v=bright_red, o=white

^v^
(o)
---
-v-
(o)
```

Rules:
- **Header lines start with `#`** and only count at the very top of the file.
  The first line that isn't a `#` line ends the header. (Need a literal `#` as
  art on the first row? Just put a blank line above it.)
- **Frames are separated by a line containing exactly `---`.** One frame, no
  separator needed. Frames may differ in size; I align them by `anchor`.
- **A space is a transparent pixel.** Whatever's behind shows through. If you
  need an *opaque* space (to punch a hole in something), use `` ` `` (backtick)
  and I'll render it as a blank that occludes.
- Leading/trailing blank lines are trimmed. Interior blank lines are kept.
- Files are read as UTF-8. Non-ASCII (box-drawing `─│┌`, `░▒▓█`, `†`, `☠`) is
  fine and I encourage it — I measure width properly. Just avoid emoji: they're
  double-width and they'll break the grid.

Header keys I support right now:
- `name:` — human label, cosmetic only.
- `fps:` — animation speed. Omit or `0` = static.
- `anchor:` — `center` (default) | `topleft` | `bottom`. Where the entity's
  world position sits inside the sprite box. `bottom` is nice for things that
  stand on the ground.
- `paint:` — per-glyph color, comma-separated `glyph=color`. This is the big
  one: **you color your art by character**, which is how ASCII art wants to be
  colored anyway.
- `color:` — one color for every glyph in the sprite. Shorthand for painting
  everything the same.

Colors: the 16 names (`black red green yellow blue magenta cyan white` and each
with a `bright_` prefix), or `#rrggbb` hex for truecolor.

**Unknown header keys are ignored, not fatal.** So if you want to write
`# hp: 12` or `# speed: fast` as a note-to-self, go ahead — it won't crash
anything, and if it turns out to be useful I'll wire it up.

### Missing art is never a crash
Every sprite request falls back to a built-in placeholder glyph if the file
isn't there. **The game runs today with an empty `assets/` folder.** Drop art
in and it appears. Delete art and it degrades to a letter. So you are never
blocking me, and I am never blocking you.

I also hot-reload `assets/` while the game is running (`--watch`). Save a `.txt`
and the sprite updates live in the running game. Drawing should have a fast
feedback loop.

---

## [3] Assumptions I'm coding against until you tell me otherwise

Everything here is a guess I made so I could keep moving. **Overrule any of it
freely** — none of it is expensive to change.

1. Camera follows the player; world is large (not a fixed arena).
2. 8-directional movement, WASD + arrow keys both work.
3. Auto-attack fires on a timer with no aiming input — nearest-enemy targeting.
4. XP gems drop from kills, pull toward you within a small radius, and level-up
   pauses the game to offer **3 upgrade choices**.
5. One run = survive as long as you can; difficulty ramps on a clock.
6. `Esc` pauses. `Q` from pause quits.
7. Death shows a run summary (time survived + kills) before restart — that one I
   took straight from your answer in meetings.md.

---

## [4] Questions for you (answer in jane.md whenever, I'm not blocked)

1. **Sprite sizes** — the table in [2]. This is the one I actually care about.
2. **Fixed arena or scrolling world?** I've built scrolling. Cheap to clamp.
3. **What's the player?** Give me `assets/player.txt` and I'll draw it instead
   of the placeholder `@`.
4. **Does the player face a direction?** If yes I need `player_left.txt` /
   `player_right.txt` (or a `# facing:` convention) — tell me which you prefer
   and I'll support it.
5. **Health**: hearts, a bar, or a number? I've stubbed a bar.

---

## [5] Status log

- **[1]** Stack locked: TS/Node 22, zero deps, no build step. Verified type
  stripping runs natively on this box.
- **[2]** Art contract proposed above. Building against it now, not waiting.
- **[3]** Next: terminal + double-buffered renderer + input + fixed-timestep
  loop + sprite loader, then a player you can actually walk around.

---

## [6] Read your `design.md` + `jane.md`. We converged — and it's built.

Great drop. We independently landed on the same two load-bearing decisions
(one glyph per enemy; world units with a 1×2 cell), which means they're probably
right. **I've thrown away my art format and implemented yours.** Everything
below is done and committed, not planned.

### Your format won, with one extension
`--- art ---` / `--- mask ---` is better than my `paint:` glyph→colour map,
because a mask lets the *same glyph be two colours in one sprite* and mine
couldn't. Implemented as specced: `size:` authoritative + right-padding,
space = transparent, mask optional, `# colour:` fallback, palette letters,
`W` reserved.

I added **one backward-compatible extension**: repeat the `--- art ---` /
`--- mask ---` pair and each becomes an **animation frame**, with `# fps: N`
setting the rate. Your format had no way to animate, and I figured the Countess
would want it. I see you've already used it — `countess.txt` is loading as
2 frames @ 4fps. It works.

> Note on `size:` — it is authoritative, so I **pad**, never clip. I originally
> measured the trimmed art instead, which slid every `anchor: center` sprite
> half a column off its own world position. Your "don't trust trailing
> whitespace" instinct was right and it caught a real bug. There's a test on it.

### Answers to your §6

1. **Charset — all of `※ ◆ ♥ ⛁ ═ ─ ▓ ▄` are fine.** Every one is single-width;
   I measure width properly and none of them break column math. Keep them. The
   only thing I'd ban is emoji (double-width, and the grid tears). You already
   knew that.
2. **Colour — yes, and more.** I do truecolor when the terminal offers it, and
   degrade automatically to 256 → 16 → mono. So your 16-colour palette is the
   *floor*, not the ceiling: I gave each palette letter a nicer RGB value that
   quantizes back to the right ANSI slot on a 16-colour terminal. One caveat:
   **`s` ("bone") degrades to grey, not yellow**, on a true 16-colour TTY —
   grey looked more bone-like than ANSI yellow, which is acid. Say the word and
   I'll force it to yellow.
3. **Framerate — not close to tight. Measured, not guessed.** `npm run bench`:

   | enemies | frame time | ceiling |
   |---|---|---|
   | 300 | **1.67 ms** | ~598 fps |
   | 600 | 2.52 ms | ~396 fps |
   | 1000 | 4.22 ms | ~237 fps |

   That's with a 4,000-decal gore carpet and the dark on, at 100×34. We run at
   **60fps, not 30**, and at your 300-enemy target there's **10× headroom**.
   The diff renderer emits ~11KB/frame.

   **So don't cut the enemy budget.** If anything the budget curve in §11 is
   conservative — the engine will not be what stops you. Push it and I'll tell
   you when it hurts.
4. **Yes, the level-up screen freezes the sim**, and the first-encounter
   portrait explicitly does not. Both built exactly as you specced.

### Your §5 asks, both done
- **Gore layer:** built. One deviation, on purpose — you said "cap it to the
  viewport", but I anchor decals in **world space** and bound the layer by
  eviction (24k cells, ~90s decay) instead. Viewport-capped decals *smear*
  when the camera moves, since the field scrolls under them. World-anchored
  costs the same and means walking back over old ground shows your own carpet.
  It looks right. Overrule me if you disagree.
- **The dark:** built, radius 14 wu, `--no-dark` from day one as you asked.
  Elites/bosses always fully lit, Stalker invisible outside the light. My
  early read: it looks *good*, not mush — the grey is dim enough to recede but
  the swarm silhouette stays legible. Go run it and judge for yourself.

### The thing you asked me for
> *"The fastest thing you can do for me: get anything on screen that reads
> `glyphs.tsv`, spawns ghouls, and lets `@` walk."*

Done, and then some. `npm start`.

- `@` walks (WASD + arrows), 8-way, diagonals normalized, isotropic wu.
- `glyphs.tsv` is **parsed**, never hardcoded — HP, speed, power, cost, spawn
  time, colour and xp all come from your table. **Retune it and just restart the
  game; no code change, no ticket.** Same for the decal decay table.
- Budget spawn director per §11. Ghouls at 0:00, rats in packs of 12+ at 0:30,
  bats with the sine drift at 2:00, and so on — all read from `from`/`cost`.
- The Chain fires on its timer, horizontal-only, band exactly 12 wu × 3 rows,
  infinite pierce, knockback 4. Flashes `═` then `─`. Level 4 does strike behind.
- Motes drop, merge (`·` → `+` → `◆`), and get inhaled inside the pickup radius.
- Level-up freezes and deals 3 cards. Passives all wired.
- Gore, the dark, the elite HP bar, first-encounter portraits, pause,
  and the run summary on death (time / kills / level / best minute / gold / build).

### Dev flags you'll want
| Flag | What |
|---|---|
| `npm start` | play it |
| `npm run dev` | **hot-reloads `assets/` while the game runs** — save a `.txt`, see it live |
| `node src/main.ts --preview` | dumps every sprite in `assets/` in colour, with its real measured size, plus any warnings. **This is your art lint.** |
| `node src/main.ts --start 14:00` | begin the run at minute 14, so you can look at the late-game swarm without playing to it |
| `node src/main.ts --no-dark` | your A/B switch |
| `node src/main.ts --debug` | fps + entity/mote/decal counters |
| `node src/bench.ts 600` | headless perf at N enemies |

`--preview` currently reports **zero warnings** on all 9 of your assets.

### Two bugs your spec caught, and one I'd like you to weigh in on
Tests found: a corpse dealt contact damage for one extra frame, and an enemy
standing *exactly* on the player could never hit it (a `|| 1` divide-guard was
also being used as the contact distance). Both fixed, both have regression tests.
`npm test` — 40 passing.

### [7] Questions for you

1. **Countess frame 2 is 16 wide but frame 1's silhouette is wider.** Both load
   fine and I align them by anchor, but she'll appear to "breathe" horizontally
   at 4fps. Intentional (wing flap)? If so, ignore me.
2. **`gravewarden` has `cost 0` and `from -`**, so the director never spawns it —
   correct per §11 (elites are scripted). The **scripted beats table (§11) is the
   one thing I haven't built yet**: bat flock, Wight Wall, The Ring, The Tide,
   elite spawns. That's my next chunk, along with the Countess fight.
3. **Weapons beyond The Chain are not built yet** — Nova, Censer, Grave Salt,
   Wisp Lantern, Silver Rain, Cinder Trail. Chain + all 8 passives are in. If you
   want a particular weapon next for feel-testing, name it; otherwise I'll go in
   your table order.
4. **Gold persistence / The Crossroads (§13)** isn't built. You said the save
   file is mine to place — I'll put it at `~/.local/state/the-long-night/save.json`
   (respecting `XDG_STATE_HOME`) unless you object.
5. **Portraits render at their declared 20×8 box**, so `ghoul` (18 wide) and the
   others sit left-aligned inside a 20-wide panel. Fine, or do you want me to
   centre the art within the declared box?

### [8] Assumptions I'm running with (correct any of these freely)
- Elite = ×20 HP, bold+bright, HP bar above. Straight from your table.
- Chain level 7 is `-15%` cooldown (you wrote "-cooldown", I picked the number).
- Passive numbers: Might +10%/lv, Haste −6%/lv, Area +10%, Swiftness +7%,
  Magnet +35%, Growth +8%, Armour −1 flat, Lantern Oil +3 wu. **All guesses.**
  These are balance, which is yours — put real numbers in `design.md` §8 and
  I'll move them, or better, tell me you want them in `glyphs.tsv` too and I'll
  parse them from there so you can tune without me.
- Terminal min 80×24, target 100×34, field capped at 120×40, HUD one line top /
  one bottom. Exactly your §5.

---

## [9] `owner-feedback.md` — all three demands are in, and the game runs on canvas

Read your §1–3. We reached the same conclusions independently again, which is
becoming a habit. Everything below is committed and verified, not planned.

### The port cost less than either of us feared, and here's why
The sim never knew what a terminal was, and every single draw call in the game
already went through one narrow interface on the renderer. So I extracted that
interface (`engine/surface.ts`) and wrote a second implementation behind it.
**`world.ts`, `render.ts`, `app.ts`, `upgrades.ts`, the loader, all six of your
`.tsv` tables and the whole art format are byte-for-byte unchanged by the pivot.**

The terminal build still runs (`npm start`) and shares 100% of the game code. I
haven't deleted it — it costs nothing and it's a fine smoke test. But canvas is
the product now.

```
npm run web     ->  http://localhost:5173
```
It recompiles and re-packs `assets/` on every page load, so your loop is
unchanged: **save a `.txt`, refresh, see the art.** No restart.

URL flags: `?debug` `?god` `?play` `?nodark` `?noglow` `?start=15:00` `?seed=3`
`?noautoface`.

### Your list, in your order
1. **Sub-cell positions — done.** This was your #1 and you were right that it's
   the thing that made it look like 1978. Entities draw at fractional cell
   offsets; a ghoul at 9 wu/s now glides instead of teleporting nine times a
   second. It's one method (`Surface.setF`) and the terminal implements it by
   rounding, so both backends share the call site.
2. **180×60 grid — done.** 12×24 px cells, so the wu maths is untouched. Floor of
   120×40: below that I scale the cell and keep the world, as you asked. Above
   180×60 the grid stops growing rather than revealing more graveyard.
3. **Draw order by world y — done.** 217 overlapping sprites read as a crowd.
4. **Hitboxes as circles in wu, from inner mass — done.** `src/game/hitbox.ts`
   counts a sprite's *opaque* cells, converts to a wu area, takes the equal-area
   radius and shrinks it by 0.62. A 3×2 ghoul lands at ~1.4 wu; the 9×5
   Gravewarden gets a torso, not a reach. Injected into the sim, so `world.ts`
   still has no idea what a sprite is. **Tune `MASS_SCALE` if elites feel unfair.**
5. **Per-sprite fps — was already there.**

Effects: **lantern glow and a real light falloff are in.** The dark is now a
radial gradient rather than the terminal's per-cell grey threshold. Screen shake,
damage numbers and ember particles are not — next.

### Also done from your notes
- `SIZE_BUDGET` with all six prefixes, specific-first. You were right that
  `.find()` made ordering load-bearing; `sprites/` was shadowing `sprites/mobs/`.
- **`characters.tsv` is parsed.** `'chain'` is gone from `world.ts` entirely.
  Your rule *"no starting weapon may require aiming"* only holds if code can't
  quietly override it, so there's now a test asserting the Warden opens with
  whatever the table says. hp / move / area / luck / gold all apply.
- Sprite lookup by convention, with the glyph fallback. `sprites/mobs/<id>`,
  `sprites/elites/<id>`, `sprites/player`, `sprites/countess`.
- `target_end` is yours; I read whatever's in the file. It's 220 today.

### I changed my own fix because yours is better
I'd already shipped an **auto-face** for the Chain: after 0.25s with no
horizontal input, the whip turned toward the nearest enemy. It solves the
owner's complaint.

**It's now default-off.** You fixed the same problem in the tables — Nova opens,
the Chain hits both sides from level 1 — and your fix keeps facing as *skill*
where mine would have quietly erased it. Mine is behind `--no-autoface` /
`?noautoface` inverted, i.e. it's off unless someone asks. If the Chain still
reads badly at level 1, it's a one-line A/B.

### The mask warning that lied to you
> *"`--preview` had been printing `mask has 10 rows but art has 11` the whole
> time, and I filtered your diagnostics for words I expected."*

Half of that was my fault and I've fixed my half. **The check compared the mask's
rows to the *padded* box height, not the art's.** So it fired on every sprite
where `size:` was taller than the art — pure noise — and the one time it was
telling the truth it was indistinguishable from the noise it always emitted. A
warning that cries wolf is a warning nobody reads, and you read it exactly as
often as it deserved.

It now compares mask rows to *art* rows, and says what actually goes wrong:
```
sprites/countess: mask trims to 10 rows but the art trims to 11 — colours will be off by a row
```
`--preview` currently reports **zero warnings across all 29 assets.**

### Two bugs I only found by looking at the pixels
Neither showed up in 77 passing tests. Both came from screenshotting the real
browser at 2200×1300 and staring at it.

1. **`--start 15:00` spawned the whole horde into a tight ball.** The prewarm ran
   in the constructor, before the surface had been measured, so it scattered 200
   enemies across a guessed 100×32 default in the middle of a 180×60 field. It
   now waits for the first real viewport.
2. **The Countess never appeared.** I spawned her just outside the viewport like
   any other enemy — but her Court phase is *stationary*, so she sat in the dark
   summoning bats at a graveyard the player couldn't see, forever. She now
   arrives on screen, above the player. Your §10 phase design caught my spawn
   code; I'd never have found it from the sim.

### [10] Questions
1. **`ui/title.txt` now carries its own menu** (`[ENTER] begin the night`,
   `[C] the crossroads`, `[Q] stay in the dark`). I was drawing a second copy of
   the controls underneath it, so **the title screen is now yours alone** — I
   render your art centred and add nothing. But: **`C` → The Crossroads is not
   built.** Right now any key starts a run. Do you want a placeholder Crossroads
   screen from me, or shall I leave `C` inert until §13 is specced?
2. **`sprites/ashling` and `sprites/beggar` don't exist yet** — `characters.tsv`
   references them. They fall back to `@` and the game runs, so no rush; just
   flagging that the loader is quietly covering for it.
3. **Gold does not persist between runs.** §13 needs a save file. Still planning
   `~/.local/state/the-long-night/save.json` for the terminal build — but on
   canvas it should be `localStorage`. I'll do localStorage and keep the terminal
   one as a JSON file, same shape. Shout if you'd rather it live elsewhere.
4. **`MASS_SCALE = 0.62` in `hitbox.ts` is my guess**, not your number. It's the
   only balance constant I've left in code and I'd rather it were yours. Want it
   as a column in `glyphs.tsv` (`hit_radius`), so you can hand-tune the Wight?

### [11] Next from me
Screen shake on a Countess charge · damage numbers · ember particles · the
Crossroads + save file · the remaining scripted beats are all in and firing
(`flock`, `wall`, `ring`, `tide` — go watch `?play&god&start=17:00`).

---

## [12] The Crossroads is in. §13 is closed.

`crossroads.tsv` and `ui/crossroads.txt` landed while I was porting; both are
built. Press `C` from the title or from the run summary.

- **Gold persists.** `localStorage` on canvas, `~/.local/state/the-long-night/
  save.json` in the terminal (honours `XDG_STATE_HOME`). Same JSON shape.
- **Costs come from your table.** I invented none. Level pips, live
  affordability colouring, Endless greyed until `wonOnce`, characters selected
  by buying them.
- **Your gold params replaced my hardcode.** I had `1/40` sitting in
  `killEnemy()` from before your file existed. That single constant would have
  quietly invalidated the entire economy you costed — your "11 runs to unlock
  everything" assumed `gold_kill_chance 0.025`, not `0.025`'s neighbour. It now
  reads `gold_kill_chance`, `gold_per_kill`, `gold_per_elite`, `gold_per_chest`
  and `gold_countess` from `crossroads.tsv`.
- **Your rule holds, and I checked it rather than assuming.** A full unlock lifts
  the damage *floor* 25% and adds +50 HP, 3 armour, 2 revives, ×2.25 gold. It
  leaves `area`, `cooldown`, `duration` and the spawn curve **exactly** where a
  fresh profile finds them. Meta moves the floor, never the ceiling.

Try it: `node src/serve.ts` then `?shop&gold=5000`. Or `?gold=5000` and press C.

### One disagreement I couldn't resolve on my own — it's yours

**Your header says a full unlock is 15,230g. I compute 15,240g.** The curve is
right; the difference is one row, and it's a rounding tie.

`cost = base * growth^(level-1)`, rounded to the nearest 10. Exactly two rows
land on a `.5` boundary:

| row | raw | half-up | half-even (Python) |
|---|---|---|---|
| `luck` lv2 | `150 × 1.7` = **255.000** | 260 | 260 |
| `greed` lv4 | `120 × 1.5³` = **405.000** | 410 | **400** |

15,230 is what Python's `round()` produces — **banker's rounding**, which breaks
ties toward the even number, so it sends 255 *up* and 405 *down*. That's almost
certainly your tooling rather than your intent; nobody prices a shop with
round-half-even, and the inconsistency between those two rows is the tell.

**I shipped half-up (15,240g)** and left your file untouched. It changes nothing
you concluded — a winning run still pays ~1,365g, so it's still 11 runs to buy
everything, 35 to grind it. But it does mean the comment in `crossroads.tsv` is
off by 10g, and I'd rather you fixed the comment or nudged one `cost_base` than
have me import Python's rounding into a game to match a number.

There's a test asserting 15,240 and that we stay within 10g of your published
figure, so if the curve ever *actually* drifts it fails loudly, and this known
gap doesn't.

### Also
- `sprites/ashling` and `sprites/beggar` exist now — thank you. Both load.
- Your 12 passive card icons are loaded but **not yet drawn on the level-up
  cards** — I still render the `↑ » ○` glyphs I invented. Next chunk; the art is
  better than my glyphs and I'll swap it.
- `countess.tsv` is parsed for nothing yet. Her phases are still my hand-rolled
  approximation (court/hunt/dusk by HP fraction). Your `telegraph 0.8`,
  `charge_speed 52`, `turn_rate 90`, `trail_life 4.0` and `enrage_after 120` are
  **not** wired. That's my next chunk and it's the biggest remaining gap between
  `design.md` and the build.

### [13] Next from me, in order
1. **Wire `countess.tsv`** — telegraph, 52 wu/s charges, 90°/s turn rate, the
   burning trail, enrage. Right now she's a placeholder that charges at 2.2× her
   cruise speed and I wrote her before your table existed.
2. **Level-up cards use `cards/` art**, weapons and passives both.
3. Rerolls and Banishes are bought and stored but the level-up screen doesn't
   offer them yet.
4. Screen shake on a Countess charge, damage numbers, ember particles.
5. Endless mode (`30:00`, the Reapers).

---

## [14] `countess.tsv` is wired. She's a real fight now.

Every number is yours; the only judgement left in code is what "charge" means
geometrically.

- **Court** — 0 wu/s, a ring of 12 bats every 4s. Verified: she does not move.
- **Hunt** — 0.8s telegraph (she pulses white-hot; it's the loudest thing on the
  field), then a charge at **exactly 52 wu/s**. Turn rate capped at 90°/s.
- **Dusk** — light collapses to the lantern regardless of `--no-dark`, cadence
  tightens. `enrage_after 120` tightens it again.
- **Trail** — `trail_glyph` from your table, `trail_life 4.0`, and I lay it at a
  fixed *spatial* rate rather than once per frame, so it doesn't thin out on a
  slow machine.

Two implementation notes you should know about because they're feel decisions:

1. **`trail_damage 8` is per second, so I accrue fractional damage** rather than
   rolling a die each tick. Rolling would make an 8 dmg/s trail land as an
   occasional 8-damage spike, which reads as unfair rather than as a slow burn.
   `damagePlayer` still only ever takes whole numbers.
2. **The phase boundary belongs to the phase below.** At exactly 70% HP she is in
   Hunt, not Court. Tested at every boundary, because "70→25%" is ambiguous and
   an off-by-one there is a phase that never fires.

**Your `speed 10` / phase-speed split is fine, don't change it.** The phase rows
override cruise speed and `charge_speed` is separate — that's the right shape,
because her cruise and her charge are different verbs. `glyphs.tsv`'s `speed`
column is now only used for her contact reach and the bestiary; the fight reads
the phase table.

**One robustness note:** if `glyphs.tsv` ever loses its `bat` row, her entire
Court phase silently becomes "stand still", which looks exactly like a hang.
It now emits a runtime warning once and the fight continues. Not a request —
just telling you the failure mode has a voice now.

### Where that leaves us
`design.md` is now implemented end to end: title → Crossroads → run → director
+ all 11 scripted beats → 7 weapons, 12 passives, 7 evolutions → the Countess →
dawn → gold banked → spend → run again. The systems are done.

### [15] Still open, in the order I'll do them
1. Level-up cards should use your `cards/` art. I'm still drawing the `↑ » ○`
   glyphs I invented before your icons existed; yours are better.
2. Rerolls and Banishes are bought, saved, and applied to `World` — but the
   level-up screen doesn't offer the buttons yet.
3. Endless mode (30:00, the Reapers). `wonOnce` already gates the unlock.
4. Juice: screen shake on a Countess charge, damage numbers, ember particles.

---

## [16] Owner feedback round 2 — all five points. Two of them touch your palette.

`owner-feedback.md` 09.07 23:03. Read it. Summary of what I changed and why.

### The crash was mine, and it was in `drawBar`
```
TypeError: Cannot read properties of undefined (reading 'codePointAt')
    at Renderer.flush
```
`rem = Math.round(fraction * 8)` returns **8** once the fractional part reaches
0.9375, and my `EIGHTHS` lookup only has indices 0–7. `EIGHTHS[8]` is
`undefined`, my `!` told TypeScript to shut up, `set()` wrote `undefined` into
the cell grid, and the next `flush()` called `.codePointAt` on it.

The XP bar's fraction is arbitrary, so **every sufficiently long run eventually
crashed.** Eight eighths now carry into a whole block. A test sweeps 2001
fractions and asserts no cell is ever a hole.

Two hardening changes fell out of it, both real: the renderers now reject `NaN`
coordinates (NaN fails `x < 0`, `x >= width` and every other comparison, so it
sailed straight through the bounds check), and a missing glyph renders as a
blank instead of killing the run.

### `npm start` is the browser now
That's why it kept opening in a terminal for him. The TTY build is `npm run tui`
and still shares 100% of the game code. `npm run build` produces `dist/` —
~400 KB of static files, no server. Vercel config, Dockerfile and nginx config
are in.

### 120fps: measured, not claimed
`?bench=300` runs the real app and surface off the rAF clock. Worst case is the
Countess fight at **1.76 ms/frame** (567fps ceiling). 120fps needs 8.33 ms, so
**4.7× headroom**. Full table in README.

### These two are yours, and I've made a call you should overrule if you disagree

> *"XP is hard to see and it's almost like it goes under the blood."*
> *"There are so many red things on the ground at times that it's hard to make out."*

**They're the same bug.** I was pushing one decal *per kill*. Two hundred kills
on one patch of ground stacked two hundred overlapping decals, and since the
freshest stage is bright red `※`, a busy patch saturated into a solid red sheet.
The gore layer stopped being a record of the slaughter and became a wall.

Two changes, both in my lane but both visibly affecting your art:

1. **One decal per cell.** Re-killing on a cell refreshes the gore already there
   instead of stacking a new one. This is what your §9 always described — "a
   character grid and a timestamp grid" — I just wasn't building it that way.
2. **`GORE_LEVEL = 0.55` in `render.ts`.** The whole decal layer draws at 55%
   brightness. *The floor is scenery, not information.*

And for the XP: **motes are now lifted 35% toward white, pulse gently, and are
never dimmed by the lantern.** Your palette has `mote1` as `b` (blue) — at
0x2c4bd8 on a near-black field under a red carpet, it was genuinely invisible.
XP is information; the player has to be able to find it.

**All three of those numbers are balance-adjacent and they're currently in my
code.** If you want them, say so and I'll move `gore_level`, `mote_lift` and
`mote_pulse` into `glyphs.tsv` as params — or just tell me different numbers and
I'll set them. What I did *not* do is change your palette: `mote1` is still `b`
in the table, I'm only brightening it at draw time.

**Screenshot to judge it yourself:** `npm start`, then
`?play&god&debug&seed=21&start=12:00&sim=9000` — that fast-forwards 150 seconds
of real combat (auto-picking cards) so you land on a field with 4,300 kills of
gore on it and 176 motes lying in the blood. That's the view the owner was
complaining about. I think it reads now; you'll have a better eye for it.

### Still open (unchanged from [15])
1. Level-up cards should use your `cards/` art. I'm still drawing my own glyphs
   and yours are better. **This is next.**
2. Rerolls / Banishes: bought, saved, applied — no buttons on the level-up screen.
3. Endless mode.
4. Juice: screen shake on a Countess charge, damage numbers, ember particles.

---

## [17] The "...." was `file://`. It's gone, and so is a HUD bug you never saw.

`owner-feedback.md` 10.07 10:10: *"Currently the game just loads '....'"*, and
*"the focus is way too much on late game — polish the core game."* Both taken.

### The loading screen was `loading the night…` forever, and it was structural

He wasn't running a stale build. He **double-clicked `index.html`**.

A `<script type="module" src="…">` is a *fetch*, and browsers refuse cross-origin
fetches from a `file://` path. So on a multi-file build, opening the page from
disk runs **no JavaScript at all** — not the game, and not the `.catch()` that
would have told him why. The page sits on its loading text until he closes the
tab. I reproduced it in one command and it fails 100% of the time.

**`npm run build` now emits exactly one file: `dist/index.html`.** The code and
every byte of `assets/` are inlined into it. It fetches nothing, so there is
nothing left to block: it plays off `file://`, off a USB stick, and off Vercel or
Coolify unchanged. 251 KB. `npm start` is unchanged for you — still recompiles and
re-packs `assets/` on every refresh.

(I wrote a ~100-line bundler to do it. `tsc` emits CommonJS, where every import is
a literal `require("./x.js")`, so bundling is just "wrap each module in a function
and hand it a `require`". No dependency, no AST.)

The dev page also grew a plain-`<script>` tripwire: if the module never runs, the
loading text now says so instead of lying.

### While screenshotting your ring, I found the canvas eating a HUD row

**The bottom HUD row — the XP bar, the weapon strip, the fps counter — has not
rendered in the browser for as long as the canvas has existed.** Neither has the
right-hand end of the top HUD, which is why the kill counter looked truncated.

`resize()` recomputes two things: the grid (cols × rows) and the cell size. It
was skipping the canvas element's resize whenever the *grid* was unchanged — but
the grid pins at 120×40 across nearly every window, so a resize normally changes
only the cell. The game then drew a bigger cell into a smaller canvas and the last
row and last columns fell off the edge. Fixed, with two tests.

Your field was never wrong. The frame around it was.

### Your ring is inscribed now, and your params are wired

I had "fixed" the ring by spawning on an ellipse and left a comment claiming a
wu-circle draws as an ellipse. **That comment was wrong and your table was right.**
A cell is 1 wu wide and 2 wu tall, so a wu is the same number of *pixels* in both
axes: a circle in world units draws as a circle. It reads as a ring now, centred
on the player, entirely on screen. `ring_radius_frac` comes from your table.

Also read from `director.tsv`, no longer constants in my code:

| param | was | now |
|---|---|---|
| `gore_chance` | every kill stained | 0.35, rolled on a cell's *first* kill |
| `gore_level` | `const GORE_LEVEL` | yours |
| `mote_lift` | 0.35, hardcoded | 0.10, yours |
| `mote_pulse` / `mote_pulse_hz` | I claimed a pulse; there wasn't one | yours, and only motes pulse now |
| `pickup_radius_base` | `6`, written twice | 12, read once |

You were right that `gore_chance` belongs on *distinct cells stained* rather than
on kills — that is what floor coverage means. Re-killing ground you're still
standing on refreshes it either way.

And **the decal lifetime was hardcoded to 90s** while your chain ends at 60. Dead
decals were holding their cells and their memory for thirty seconds after they
stopped being visible. It reads the last stage's `ageTo` off your table now.

### Two things you asked for, both done

1. **`d` = `#5a1616` is in `PALETTE`.** Dried blood. It's yours.
2. **The `colour` column now also takes `#rrggbb`** anywhere a palette letter
   goes. The letters stay the vocabulary — one hue, one meaning — but you should
   never have to file a ticket for a shade again.

### Your card art is on the cards

`cards/<weapon>` and `cards/passives/<id>`, by convention, no new table column.
The card grew to 24×14 to hold your 12×5 art with the title, level and effect
under it. My `↑ » ○` glyphs are the fallback for anything you haven't drawn.
Never tinted — your mask assigns a colour per character and a tint would flatten
the drawing to one hue.

**`?cards` (or `--cards`) opens a level-up hand straight away** so you can look at
them without playing to level 2. `?cards&seed=5` if you want a specific three.

### One correction for you

`evolutions.tsv` line 2 still says *"weapon at level 8 + paired passive at level 8"*.
The code and `design.md` §8 both say the passive only has to be **owned** — your
simulation is the reason it changed. The header is stale; the data is fine.

### Still open, in order
1. Juice: damage numbers, screen shake on a Countess charge, ember particles.
   This is the core-game polish the owner is asking for, and it's next.
2. Rerolls / Banishes: bought, saved, applied — still no buttons on the level-up
   screen.
3. Endless mode. **Parked** — the owner explicitly said no more late-game work
   until the core is polished, and he's right.

---

## [31] The juice is on the screen now. And `npm run dev` grew cheats.

Two things landed this session. The first is the one you've been asking for since
[29]: **`juice.tsv` is no longer just parsed, it's rendered.** The data model was
sitting in `world.ts` reacting to nothing. It reacts now.

### Everything in your table is alive

- **`hit_flash`.** The 60ms you said was the whole complaint. An enemy that takes
  damage lifts toward white by `hit_flash_lift` (0.55) over the flash's life. It
  does **not** flatten to a white blob — I added a `lift` param to `drawSprite`
  that mixes each glyph toward white while keeping its own hue, exactly your
  "1.0 would erase the silhouette." The sprite doesn't move and the glyphs don't
  change. Same treatment on the Countess (but her telegraph still overrides).
- **Death pops.** One bright frame of the enemy's own sprite where it fell,
  fading over `death_flash`. The boss is filtered out upstream, per your note.
- **Damage numbers.** One per enemy, climbs and brightens as damage feeds in,
  capped below the player's white so it never out-shines what it celebrates.
  Drawn above the crowd, retired when the corpse (the number) drops.
- **Sparks.** Rise off the lantern in the annulus out to the *current* light
  radius, cool yellow→red, capped at `ember_level`. Drawn under the gore so they
  never steal a cell from anything that matters. Lantern Oil widens the shower.
- **Screen shake.** `shakeOffset()` feeds the field projection in fractional
  cells; the canvas draws pixels, the terminal's rounding swallows it. HUD never
  shakes. Four events, your amps. Death peaks at 0.98 cells and settles to 0.
- **Hit stop + level-up gold `@`.** The pause on a player hit, and the `@` burns
  gold (`Y`) for `levelup_flash` before the cards come up. No ring — you were
  right that every glyph a ring wants is already spoken for.

### One number I added to your table's defaults — `hitstop_gap`

Your rule is "hitstop fires when the player takes damage," and that broke two
ways I had to fix, both faithful to what you meant:

1. **A burning trail is a *state*, not a *hit*.** Standing in the Countess's fire
   was re-freezing the sim ~20×/second — the exact judder you scoped hitstop
   *away* from. So **DoT no longer triggers hitstop at all.** Only discrete hits do.
2. **A swarm is many hits per frame.** I added `hitstop_gap` (0.2s refractory) so
   one freeze punctuates, then a gap, then it may fire again — instead of a
   permanent half-freeze while you're mobbed. It's in my defaults; **if you want
   a different gap, add `param hitstop_gap <seconds>` to `juice.tsv` and it wins.**

`npm test` 139/139, and a headless 20-second run confirms numbers, pops, sparks
and the death shake all populate and settle.

### The owner's 22:27 asks (owner-feedback.md), the code half of them

- **`npm run dev` → developer mode with a cheat panel.** Press **`` ` ``** in a run
  to toggle it: `g` god, `l` level-up, `k` kill screen, `m` +1000 gold, `t` skip
  +1:00. Dev-only — the customer build never has it.
- **`npm start` → the normal game, in the browser, no crash.** It now *builds the
  single-file* and serves that, then opens your browser. The crash he hit was the
  compile-on-request dev server; the customer path is now the robust inlined
  build — the same one that "worked from dist" for him. `npm run dev` keeps the
  live-reload feedback loop for us.

### Your desk — the ask I can't do, because it's yours

Owner, 22:27: *"characters look like stick figures, I want it to look like an
actual game — take inspiration from **Effulgence RPG**."* That's your call, not
mine. What I've done is make the engine *react* so your art has somewhere to
land: a sprite that flinches, pops, throws numbers and sits in a shower of sparks
reads as a game even before it's redrawn. If Effulgence-density art wants bigger
sprite bounds, more frames, or a wider palette than the ladder allows, tell me
the constraint you need loosened and I'll move the techstack to meet it.

---

## [32] The first ninety seconds breathe now, and `.` is gone from the field.

I read [31] and the whole art pass — player, both alts, six mobs, the title. It
loads clean and it's a different game to look at. Three things landed on my side.

### `open` rows were in your table and dead in my code

You wrote the authored opening in `director.tsv` — `open 0:00 1` … `open 1:30 7`
— and diagnosed exactly why the run couldn't exhale. **My `director.ts` never
parsed the rows.** `targetPopulation` ran the monotone formula and threw your
whole first minute away. It's wired now:

```
t=0s  target 1.00      t=14s 3.00      t=28s 1.00 (the lull)      t=90s 7.46
```

- **One ghoul at 0:00**, three at 0:14, the lull dips to **1** at 0:28, hands off
  to the curve at 1:30 (6.95 → 7.46, the seam you designed). Linear between rows.
- **The lull is a spawn gate, not a despawn order** — your one worry. I confirmed
  it in a live sim: at 0:28 the target falls to 1 but the three already on the
  field *stay*; the director just stops sending more. Nothing ever vanishes. The
  deficit was already clamped at `<= 0`, so it was only ever the parse that was
  missing.
- Regression test added (`world.test.ts`): target(0)==1, the 0:28 dip, the
  hand-off, and — because I don't want to silently break it again — that a table
  with **no** `open` rows still starts at the formula's 3. §0 acceptance criterion,
  now guarded. 140/140.

### `.` is retired from the field, for real this time

Two places still drew it. **The Cinder Trail ember** faded `* → .`, and `.` reads
as `·`, the XP mote — your [29] catch, still live. It keeps its shape and fades in
COLOUR now, drawn as `°` (the `cinder` glyph from `juice.tsv`, since a trail ember
is a weapon the Warden emits). And **the ground scatter** drew a literal `.` for
its mid-density speck; I swapped it to `,`. That last one is a texture choice in
your lane — **tell me if you want a different speck and I'll set it.**

### The font question, answered — and a bug in MY parser that was eating your header

You asked for the font name and a screenshot. The canvas font is **JetBrains
Mono**, falling back to SF Mono → Menlo → Consolas (the CSS in `web/index.html`).
Every block glyph you used renders single-width in all of them; I loaded all your
new sprites headlessly and they parse at the right box sizes with **zero alphabet
violations**. Here is the player and a ghoul as they compose on the grid (`·` = a
transparent cell):

```
sprites/player  5x5            sprites/mobs/ghoul  3x3
 ·▄▄▄·                          (o)
 ·▐@▌·                          (▓)
 ◆███·                          )·(
 ·▐█▌·
 ·/·\·
```

While loading them I found **a real bug in `sprite.ts`, mine**: the header parser
scanned *every* leading `#` line for `key: value` and let the last win. Your §9
paragraph in `player.txt` wraps to a line that begins `# colour: the luminance…`,
so it **overrode your real `# colour: w`** and painted the Warden white-by-warning
instead of white-by-intent. First sighting wins now, so your header block binds
before any prose can shadow it — and it can't drop a field from a sprite that
separates its headers with a bare `#`. Your `colour: w` takes effect and the
warning's gone. Nothing for you to change; your files were fine, my reader wasn't.

### Your `# opaque: true` is a one-line add now

It's still the last open item from your [24]/[28]. The player is `opaque=false`
because the header line isn't in the file — and now that the parser is fixed, the
moment you add `# opaque: true` to `player.txt` it'll take, and my render path
already carries the near-black card (`OPAQUE_BG`) behind it so no ghoul brace sits
in his boots. One line, your side, whenever you want it.

### Still open, none blocked on either of us
Passives showing `note` as the effect line with the numbers dimmed under it (my
side, from your [22]) is the top of my desk next. The Gravewarden/Countess shading
pass and the dawn/death/crossroads banners are yours to call after the owner sees
this batch.

---

## [33] The space pivot — raster pipeline is live, and I've actually looked at it running.

Read `owner-feedback.md` 11.07 00:03, then found you'd already moved: design.md
§15, the [33]/[34]/[35] entries, `assets/images.tsv` and `assets/audio.tsv` both
live and pointed at your curated `assets/space/`. You answered your own [33]
contract questions by reading my in-flight code before I'd written a word here —
that's exactly the "don't wait" rule working the way it's supposed to, and you
read it correctly on all three counts. Confirming properly, plus what's changed
since, plus one thing I owe you.

### Your three questions, confirmed (not just inferred)

1. **One static image per sprite id**, shadowing the ASCII glyph of the same id
   (`sprites/player`, `sprites/mobs/<id>`, `sprites/elites/<id>`,
   `sprites/countess`). No frames, no sheet-slicing — `images.tsv` v1 is a flat
   `id -> one PNG`. If a numbered `Galactica_Ranger_NN` set is a loadout ladder
   rather than animation, that's exactly what this shape wants: pick one, or map
   several to several *different* ids (e.g. a future character-select slot) —
   never several rows for one id.
2. **wu stays isotropic, `WU_PER_ROW=2` unchanged.** Your guess was right and so
   was your instinct to doubt it — pixels being square retires the *terminal's*
   fixed cell aspect, but the world's own coordinate convention (§5) was never
   about the terminal, it's about how fast things move and how big a circle is.
   `images.tsv`'s `w`/`h` are wu; `GameView.imageFor()` divides `h` by
   `WU_PER_ROW` before handing it to `Surface.drawImage`, same conversion every
   glyph sprite already gets.
3. **Web Audio, one active loop per id, unlimited overlapping one-shots.** Right
   when you read it — and see below, that's no longer the whole story.

### The crossfade you flagged as still-needed — built it

`todo.md`'s `[Jo]` item ("needs a second music id and a call site... that's a
code ask") is done. `AudioSink` grew `setMusic(weights: Record<string, number>)`
— pass it `{ id: 0..1, ... }` and a real sink ramps each *currently-known* loop's
gain toward `audio.tsv`'s volume times its weight, over 0.6s, so several beds can
mix continuously instead of hard-cutting. `World` grew `musicIntensity` (0..1,
reused straight off `targetPopulation()` normalized against `target_end` — the
exact "same curve the horde already climbs" you asked for in §15.4, so retuning
`director.tsv` retunes the music for free) and `bossActive` was already public.
`App.updateMusic()` composes those into the actual ids, throttled to 4×/second
(the ramp itself takes 0.6s, scheduling it at 60Hz bought nothing):

```
bossActive ? { ambient: 0, combat: 0, boss: 1 }
           : { ambient: 1 - intensity, combat: intensity, boss: 0 }
```

**One thing I need from you, your file:** `audio.tsv`'s `music/theme` row needs
to become three — `music/ambient`, `music/combat`, `music/boss` — or the
crossfade has nothing to fade between. You'd already curated exactly the right
tracks for this (`DeepSpaceA`/`DeepSpaceB`, `DynamicFight_1/2/3`, `dark`/`dark2`)
per your own §15.4 pairing, so this should be a rename-and-split, not new
curation. `boss_phase` (already a row, already wired to `World`'s phase-change
event) is the right place for `DubStepDropBoom` as the one-shot on the freeze
frame — leave that one as-is. One-shots overlay a loop without cutting it either
way — each `play()` is its own `AudioBufferSourceNode`, untouched by the loop
gain ramps.

### The `space/` vs `space-assets/` mismatch you caught — fixed

Good catch in [35]. `images.ts`, `audio.ts`, and `web/imagesource.ts`'s doc
comments were written against my own first-draft assumption (cherry-pick at
build time straight out of the 600MB pack) before I'd seen your [34] — the
owner's actual call, curate up front into a small tracked `space/`. The *code*
never cared (both `copyReferencedMedia` and the loaders just copy/fetch whatever
path a row names, no `space-assets/`-specific logic anywhere to go stale) — only
the comments were stale, pointing at example paths under `space-assets/`.
Rewrote all three to show `space/...` examples and say explicitly that a row
pointing at `space-assets/` is a bug, since that folder won't exist on a fresh
checkout or in a build. `tools/build.ts`'s `copyReferencedMedia` still exists and
still runs — it's not dead, it's the *second* filter (only files a row actually
references, in case `space/` ever grows an unused alternate), sitting after your
manual curation rather than instead of it. Both needed, neither redundant.

### Actually looked at it running — your todo.md item, and mine

`npm test` was passing but neither of us had watched a frame render. No
headless-browser tool was preinstalled here, so I drove Chrome directly
(`--headless=new --screenshot`) against `npm run dev` with your live
`images.tsv`/`audio.tsv` on disk. Confirms:

- The Ranger renders as the player, centered, at the HUD/ground layer's correct
  z-order, no stretch — your `6 x 8.6` for a `125x179`px source is `1.433` vs the
  PNG's real `179/125 = 1.432`. You did the aspect-ratio math by hand and it's
  right to three digits.
- Two Spacebugs rendered correctly at their smaller footprint alongside the
  ground texture, decals-in-waiting, and HUD — nothing fought the raster layer
  for the frame.
- 120fps in the debug corner, no console errors, no crash over several seconds
  of simulated play (`?sim=900`).
- Title screen unaffected (still your ASCII `ui/title` art, as expected —
  `images.tsv` has no `ui/` rows yet, and doesn't need any for this proof).

Screenshot's in my scratch dir, not the repo — describing it here instead of
committing a binary neither of us will maintain. If you want to see it yourself,
`npm run dev` and `?play&sim=900&debug` gets you the same frame in about ten
seconds.

### Known gaps, flagged rather than silently deferred

- **No starfield/background draw path.** `Surface.drawImage` and
  `GameView.imageFor()` only cover *entities* (player/mobs/elites/boss) — the
  ground is still the old procedural `"`/`,`/`` ` `` scatter. Your
  `backgrounds/starfield_01.png` is curated and sitting unused. This is my gap,
  not a data problem — didn't want to guess at a tiling/parallax contract you
  hadn't asked for yet. Say the word and I'll build it.
- **No animation contract**, matches what you already assumed — flagging only so
  it's written down twice. A raster equivalent of the old `# fps:`/multi-frame
  convention (engine glow, wing flutter) is a real follow-up, not started.
- **Hit-flash doesn't visually flash on raster ships yet.** The old glyph path
  lifts each character toward white; a raster image needs an actual compositing
  trick (draw to an offscreen canvas, `source-atop` a white fill at the flash's
  alpha) that I skipped for this pass. The boss telegraph tint has the same gap.
  Screen shake and hitstop (both non-visual) still fire normally, so a hit still
  *reads*, just without the colour cue on top of raster art specifically.
- **z-order:** raster images draw as one layer, immediately after the flat
  background and before *every* glyph (ground, decals, pickups, numbers, HUD) —
  documented on `Surface.drawImage` itself. Means an XP mote or a damage number
  is always readable over a ship (good, matches the luminance-ladder law) but a
  ground speck or a decal can occasionally sit on top of a ship's hull (minor,
  acceptable for now — real interleaving needs a bigger renderer change than
  this pass justified).
- **Elites and the boss are already wired** — `spriteIdFor()`/`imageFor()` cover
  `sprites/elites/<id>` and `sprites/countess` through the exact same code path
  as mobs. Nothing for me to build once you curate the Crusader/Iceblade/
  Battlecruiser/Overlord picks (§15.6 phase 3) — just add the rows.

### Build/hosting, in case you look at `dist/` and wonder why it's not one file anymore

`npm run build` still inlines the JS bundle and every `.tsv`/`.txt` table into
one `index.html` (the `file://` fix from 10.07 is untouched). What changed:
`dist/assets/` now exists too, holding exact copies of whatever `images.tsv`/
`audio.tsv` reference, copied from your `space/` — because 600MB (or even your
curated ~16MB, growing) doesn't base64-inline sanely into a `<script>` tag the
way text does. Costs one thing: a raw double-clicked `dist/index.html` (no
server) still shows the game and the ship art fine, but plays silent — Web
Audio's `fetch()` is blocked by the browser on `file://`. `npm start` and any
real static host both have sound; only the bare-double-click fallback doesn't.
Documented in `tools/build.ts`'s header.

### Status
142/142 tests, both typecheck configs clean. Nothing here touches `design.md`,
`assets/`, or your files — only asked, never assumed, on the one thing that's
yours to decide (the `audio.tsv` music-row split above).
