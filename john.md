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

---

## [34] Read your [35]/§15.7 before you'd have had to ask twice — the player's halo is fixed.

Went back to `jane.md`/`design.md` right after posting [33] and found your own
browser check had landed in between mine: you caught the exact two problems I'd
flagged as gaps in [33] (no background, player unreadable) independently, plus
curated all 13 SFX files against `audio.tsv` — good convergence, and thanks for
not waiting on my write-up either.

**Player visibility (§15.7 point 1) — fixed, your call on the mechanism was
right.** `Surface.drawImage` grew an optional `glow: Color` parameter; a real
backend haloes the sprite's own alpha silhouette in that colour via
`ctx.shadowBlur` — the exact mechanism the glyph tile cache already uses for its
glow, just applied live instead of pre-baked, since it's one call a frame, not
thousands. `GameView` passes `PLAYER_COLOR` (`0xffffff`) on the player's
`drawImage` call and nothing else's — bright white stays reserved to the player,
raster or glyph. Screenshotted it (`?play&sim=200&god&debug`): the Ranger now
reads immediately against pure black, no ambiguity. Nothing for you to change —
this was squarely the code answer you scoped it as.

**Background (§15.7 point 2) — still open, now it's actually asked for.** Saw
your `todo.md` write-up. Agree it's a different shape of problem (full-field,
under everything, camera-relative parallax vs. a positioned entity) and agree
it's not `images.tsv`'s job. Haven't started it this pass — flagging so it
doesn't silently slip: next thing on my desk once I've re-read whatever you add
to `todo.md`/`design.md` about how you want it to move relative to the camera
(pinned starfield vs. drifting parallax is a feel call, not a technical one).

**Your 13 curated SFX** (`audio.tsv`, `assets/space/audio/sfx_*`) — all 13 ids
match what `World.playSfx` actually pushes, one-for-one. Only outstanding ask
from me is still the `music/theme` -> `music/ambient`/`music/combat`/`music/boss`
split from [33], for the crossfade. Everything else in that table is ready to
go as-is.

142/142 still, typecheck clean, this commit is just the halo fix on top of [33].

---

## [35] The background mechanism (§15.7 point 2) — built, needs one row from you.

Didn't wait on the feel call — built the mechanism with a default and you can
retune the one number that's actually taste. New table, `assets/backgrounds.tsv`
(your file, I don't write it), separate from `images.tsv` exactly because you're
right that it's a different shape:

```
# id      path                    parallax  tileWu
field     space/backgrounds/starfield_01.png  0.5   40
```

- **`id`** — only `field` is looked up today. Room for e.g. a `dusk` id later
  (the boss's phase-3 blackout) without a new table, if that's ever worth doing.
- **`parallax`** (0..1) — **this is your feel call**, I picked `0.5` as the
  starting guess (drifts at half world-speed, reads as "distant" without feeling
  static). `0` pins it to the screen and it never moves; `1` scrolls exactly
  with the world like a positioned ship. Pure number, safe to retune without
  touching anything else.
- **`tileWu`** — the image's edge length in world units; it repeats at that
  spacing to cover the field regardless of window size. `40` is a guess for
  `starfield_01.png` (haven't seen how dense that PNG's own stars are at that
  scale) — if it reads too sparse or too busy, this is the knob, not a redraw.

Mechanically: it's a tiled raster blit, own draw pass, sitting exactly where the
old procedural `"`/`,`/`` ` `` scatter used to (replaces it outright when a
`field` row resolves to a loaded image; falls back to the old scatter untouched
if the row or the image isn't there yet — same "never block on the other side"
shape as everything else in this pipeline). The lantern darkness still applies
correctly on top of it for free — `paintLight()` is a full-canvas overlay drawn
last, it doesn't care whether what's under it is glyphs or pixels.

Covered by two new tests (`world.test.ts`, "tiles a mapped background..."/"falls
back to the procedural scatter...") against a fake raster surface, since a real
`CanvasSurface` needs a DOM `node --test` doesn't have — same reason
`canvas.test.ts` stubs its context instead of using a real canvas. Didn't get a
browser screenshot of this one specifically: doing that honestly needs a real
`backgrounds.tsv` row, which is your file to add, not mine to fake temporarily.
Once you add the row above (or your own numbers), `?play&sim=200&god&debug`
should show it — tell me if the density or drift feels wrong and I'll expose
whatever else needs tuning.

144/144 tests now, typecheck clean.

---

## [36] Your `backgrounds.tsv` row exposed a real bug — found it by actually looking, fixed it.

You'd already written the real row (`field 0.15 40`, with a genuinely good
rationale for `0.15` in the comment — agree with all three of your bullets,
keeping the default) before I got to verify [35] in a browser. Good thing I did
anyway: your row was correct and the starfield still didn't draw.

**The bug:** `WebImageSource` (the thing that turns a path into a loaded pixel
buffer) was only ever constructed from `data.images` — `images.tsv`'s manifest.
It never knew `backgrounds.tsv` had a path to preload at all, so
`GameView.imageFor`'s `this.images.get('space/backgrounds/starfield_01.png')`
was permanently `undefined`, not "still decoding" — nothing had ever asked the
browser to fetch it. `drawBackground` correctly fell back to the old scatter,
exactly as designed, which is also exactly why this didn't throw or warn
anywhere: a silent, correct-looking fallback is precisely what hid it. Only
reason I caught it is I screenshotted after wiring the row, instead of trusting
the unit tests (which pass a fake `ImageSource` that always resolves — they
tested `drawBackground`'s tiling math, not the real loader wiring, and couldn't
have caught this).

**The fix:** `WebImageSource`'s constructor now takes a plain set of paths
instead of `images.tsv`'s specific shape, and `boot.ts` hands it the union of
every path `images.tsv` *and* `backgrounds.tsv` name. One cache, fed by however
many tables end up naming raster files — adding a third later (elites art, a
`dusk` background variant) won't need this fixed again.

Screenshotted it for real this time (`?play&sim=200&god&debug`): the field is
covered edge-to-edge in your starfield, the Ranger's halo and the ground clutter
both still read fine on top of it, HUD untouched. `0.15` parallax reads exactly
like you described — drifts enough to sell motion, stays inert enough to not
compete with anything alive. One thing worth a look on your end when you play
it, not a blocker: fps dropped from a steady 120 to ~66 in the same debug corner
with the background on (more `drawImage` calls per frame, one per visible tile).
Still comfortably above 60; flagging in case it matters more once the field is
also full of raster mobs.

144/144, typecheck clean, this is the fix on top of [35].

Also: the 120->66fps drop I flagged had an easy chunk of it back. `drawImage`
was doing a `ctx.save()`/`ctx.restore()` on *every* call, background tiles
included, to protect state (`shadowBlur`, the rotation matrix) that only the
glow/angle path ever touches. Skipped it on the common case — no angle, no
glow, which is every background tile and most mobs. Same screenshot setup:
66fps -> 94fps. Still short of the original 120 (rendering ~60 tiles a frame is
real work a single-glyph scatter never did), but comfortably clear of 60, and
this was the free part of that gap.

---

## [41] Answering [39] — a decisive one, not a "maybe both": weapon effects stay procedural, card icons go raster now.

Read [37]/[38]/[39]/[40] and the elites+boss verification — genuinely great
sequence, and thank you for pulling phase 3 forward on your own read of
"nothing new for John, just rows." The Overlord and Big Berta screenshot
description made me grin. Answering [39] properly rather than leaving you
blocked on a design.md §15.9 table you can't act on:

**Weapon effects (`drawBands`/`drawBolts`/`drawRings`/`drawOrbs`) stay
procedural.** Not "for now, revisit later" — a real architectural call. Every
one of those draw functions computes its own geometry every frame off live
weapon math: a band's width and current sweep angle, a ring's radius at this
instant, a bolt's travel direction. A raster sprite is a fixed picture; making
one *read* as "the same band, now 40% wider because the passive levelled" needs
either non-uniform per-axis scaling (stretches the art, looks wrong on
anything with detail) or a from-scratch redraw of the geometry-to-pixels math
per weapon *shape*, not per weapon — seven different problems, not one. Against
that: the procedural effects already work, are already juiced (hit flash,
screen shake, the whole `juice.tsv` stack), and were never what the owner's
"stick figures" complaint was about — that was static entities reading as
placeholder art, and it's solved. Converting live effects is real, scoped,
weapon-by-weapon engineering — worth asking for explicitly if it's ever wanted,
not worth guessing at today. **Don't curate `!WEAPON PACK!/` files against a
live-effect target — that work has nowhere to land right now.**

**Card icons (`cards/<id>`) — cheap, and built, not just confirmed cheap.**
You guessed right that it was "maybe already one row away" — it wasn't quite,
`drawCardArt` had never called anything image-related, so I wired it rather
than send you curating against a path that would've silently no-op'd. Same
three-tier fallback `GameView` already has for entities (raster ->
ASCII sprite -> glyph), reusing the exact `imageFor` mechanism — pulled the
shared bit into `resolveImage()` (`src/assets/imagesource.ts`) so it's one
function backing both, not two copies drifting apart. **One real difference
from entity rows, so you don't size these wrong:** `cards/*` icons are
screen-space UI, not world entities — no world position, no camera, nothing
for wu to be isotropic *in*. So for a `cards/*` id, `images.tsv`'s `w`/`h`
columns mean **cells directly**, not wu — don't divide by anything, don't think
about `WU_PER_ROW`. The old ASCII `cards/` budget was `12x5` cells; aim
similar for raster so it fits the card the same way.

Screenshotted the level-up screen with `?cards` to confirm zero regression
before handing this back — still exactly the ASCII/glyph icons today, correctly,
since no `cards/*` row exists yet. The moment you add one, it should just
appear; ping me if it doesn't and I'll chase it the way I chased the
background wire.

144/144, typecheck clean.

---

## [42] Your [41]/[42]: portraits wired the same way, and the boss bar says THE OVERLORD.

**[42], the one-line fix — done, `render.ts`:** `'THE COUNTESS'` ->
`'THE OVERLORD'` on the HP bar. Left every other `Countess`/`countess.tsv`
reference alone, matching exactly what you scoped — those are file names and
internal identifiers, not something a player reads. Screenshotted the actual
encounter to confirm (`?start=18:55&sim=300&god` — real time / `--start`
alone kept landing a beat too late or too early to catch the freeze-frame,
`sim` ticks past it deterministically instead): boss bar reads **THE
OVERLORD**, clock's frozen and red at 19:00, her purple crystalline sprite
renders exactly as your [37] described it. Good fight to look at.

**[41], portraits — wired, not just agreed with your reasoning.** You were
right not to hand-redraw 9 ASCII portraits against a target that might get
thrown away — `drawPortrait` now tries `portraits/<id>` as raster first
(same `resolveImage` from [41]/card icons, so it's the third caller of one
function, not a third copy), falls back to the ASCII portrait, falls back to
nothing (matches today's behaviour when neither exists — no placeholder glyph
for a missing panel, same as always). Same screen-space-UI unit rule as cards:
`w`/`h` in `images.tsv` are cells for a `portraits/*` id, not wu. Confirmed the
fallback still works with a real screenshot (`?start=18:55&sim=300`, no
raster row yet): the RATTLEJACK first-encounter panel popped in top-right,
still the ASCII art, exactly as before. The free reuse you described —
`portraits/ghoul` -> the same file `sprites/mobs/ghoul` already points at —
should just work the moment you add the row; it's reading the same
`images.tsv`, no second table.

144/144, typecheck clean.

---

## [43] Finally closed out [22] — the weapon half, not just the passive half.

Not pivot work — picked this off `todo.md`'s "still open, not touched by the
pivot" list, since it's been sitting since your original [22] and nothing was
blocking it. Turns out only half of it was actually done: the passive side
(`effect: def.note, detail: numbers`) was already live in `upgrades.ts` — I
must have shipped that in an earlier pass and only tracked it loosely as "the
top of my desk." The weapon side wasn't: `weapons.tsv` has a note on maybe a
third of the rows (chain: levels 1/4/8/9, blank everywhere else — checked the
real file, not just the fixture), so levelling an *owned* weapon into a blank
level showed pure numbers, no sentence, exactly your original complaint —
"the player may be seeing this weapon's card for the first time even at LV 4."

Fixed in `upgrades.ts`: a level-up with no note of its own now borrows the
weapon's level-1 sentence for `effect`, and — going a little further than your
literal ask, but matching your own card mockup in [22], which shows a sentence
*and* numbers together — keeps *this* level's actual numbers as `detail`
instead of dropping them. So a returning player gets both "what this weapon
does" and "what just changed," not one or the other. `Card.detail`'s doc
comment updated; it used to claim weapons never carry one, that's no longer
quite true.

New test (`cards.test.ts`) against a small fixture shaped like `nova`'s real
row (note on level 1, blank on 2): confirms `effect` is the level-1 sentence
and `detail` is level 2's own damage/cooldown. Didn't chase a fresh screenshot
for this one — the rendering path (`drawCards`/`drawCardArt` reading
`card.effect`/`card.detail`) is unchanged and already confirmed working in the
`?cards` shot from [41] (that one happened to be a passive card, but it's the
identical code path a weapon card goes through).

145/145, typecheck clean.

## [44] Owner feedback 12.07 12:42 — the player ship never turned. Fixed: it now banks toward its own heading.

"Why is the ship on its place! Space ships turn and move and do epic stuff.
this gameplay is now weird for a space game!" Read literally, not
metaphorically: `render.ts` passed a hardcoded `angle: 0` into `drawImage` for
the player, every frame, regardless of movement — `world.ts`'s only notion of
orientation was `facing` (`1 | -1`, a horizontal flip), which exists purely to
aim the Chain (§7, the comment block above it is explicit this is a design
call, not a rendering gap). Visually the ship never rotated at all; it just
mirrored left/right like the old ASCII figure did. That's the "stuck in
place" the owner's describing.

The hook for this already existed and was unused: `Surface.drawImage`'s
`angle` param (`surface.ts`), and the canvas backend's own doc comment said
so outright — *"unused by any caller yet (v1 ships don't turn to face their
heading)"* (`canvas.ts`). Not a new mechanism, just wiring one that was built
ahead of need.

**What changed:**
- `World.heading` (radians, `world.ts`) — the ship's visual orientation,
  separate from `facing`. `facing` still drives the Chain's aim exactly as
  before; nobody touched that mechanic.
- `movePlayer` computes the input direction's target angle
  (`atan2(nx, -ny)` — confirmed against the actual sprite: `Galactica_Ranger
  _A.png` noses "up" in the file, and `up`/`w` decrements `y`, so 0 = no
  rotation = nose already pointing the way you're walking) and turns
  `heading` toward it via the same `turnToward(from, to, maxStep)` the boss's
  `bossHeading` already uses (`world.ts` ~1480) — same pattern, not a new one.
  720°/s: fast enough that small direction changes look instant, slow enough
  that a hard reversal is a visible ~0.25s bank, not a teleporting flip.
- Idle: heading holds its last value. A coasting ship keeps its nose where it
  was, it doesn't snap back to some default — matches how the rest of the
  physics already works (no drag, no idle animation).
- `render.ts`'s player `drawImage` call now passes `w.heading` instead of `0`.

Verified in a real browser (`?play&god`), not just reasoning about the math:
screenshotted idle (nose up), holding D (rotated 90° to face right), holding
S (180°, upside-down, nose down), a frame mid-turn while reversing from
down-facing to A/left (caught it visibly mid-bank, not snapped), and holding
W (back to nose-up). All four cardinal headings and the transition read
correctly. `console --errors` clean. 145/145, typecheck clean (both configs).

**Scope call — didn't touch enemies.** `moveEnemies` already computes a
per-frame velocity for every mob (homing, `vx`/`vy`), so extending the same
`atan2`+rotate treatment to them is mechanically just as cheap. Didn't do it:
unlike the Ranger, I don't know that every mob's art was drawn nose-up with
rotation in mind — a bug or wisp sprite might read as broken/upside-down
rotated the same way a ship reads as banking. That's an art call, not a code
one. Flagging it as an open option in `jane.md` rather than guessing at
which mobs it'd look right on.

Not the "full graphical overhaul" the owner's asking to see next time
(that's real scope, Jane's call on direction) — this is the one concrete,
literal thing in the 12:42 note that was a code bug with a already-half-built
hook sitting right there. Picked it up without waiting since it didn't touch
anything Jane owns.

## [45] Your [45]/design.md §15.11 landed while I was mid-build — same call, one number reconciled.

Good sign, not a collision: you and I independently reached the identical
design (derive heading from `movePlayer`'s own `(nx, ny)`, not `facing`; cap
the turn rate rather than snap; hold last heading at rest; confirmed
`Galactica_Ranger_A.png` noses up so `angle: 0` needs no offset) before either
of us had read the other's file. [44] (above) is already built, tested, and
screenshotted against exactly this shape.

One number differed: I'd picked 720°/s by eye, you wrote **480°/s** into
`design.md` §15.11 itself, not just a note. Since design.md is the source of
truth, not my own eyeballing, changed `World.TURN_RATE` to match — 480°/s,
full reversal in a third of a second. Re-ran the test suite after, still
145/145. Didn't re-screenshot; the only change is how fast the same
already-verified turn completes, not the mechanism.

State lives on `World` (`heading: number`, next to `facing`), your call to
make per [45] — went there because it's exactly the pattern `bossHeading`
already uses, not a new shape.

Left enemies alone, same as your §15.11 scope note — no per-mob "nose"
confirmed, and the owner named the ship specifically. If that's ever wanted
it's a real ask (per-mob turn rates, and someone needs to eyeball whether
Spacebug/Gravewarden art was drawn with an "up" at all), not a silent
extension of this.

145/145, typecheck clean (both configs).

## [46] The card-icon z-order bug from your [43]/[44] — fixed, not just traced.

Picked this off the checklist you pulled together in design.md §15.12 (#2)
rather than wait — it was already fully traced on your side, a real code
bug, and nothing about the fix touches your files.

**The bug, confirmed the way you left it:** `drawBox` (`draw.ts:129`) fills
every interior cell with a buffered `r.set(x+i, y+j, ' ', fg, bg)`. `flush()`
paints that buffered background in a coalesced pass that runs at the very
end of the frame — strictly after any `drawImage()` call made during
`render()`, since `drawImage` (without the change below) paints straight to
the canvas immediately. So a card's own background fill always lands on top
of its icon, regardless of which one the calling code draws first. Your
trace had this exactly right.

**Fix — `Surface.drawImage` grew a third bool, `onTop` (`surface.ts`,
`canvas.ts`).** Default `false` preserves every existing call (field
entities, portraits, the player) exactly as-is — still paints immediately,
still sits under whatever glyphs land on top of it that frame, which is the
correct rule for the field (ground decals/HUD staying legible over a ship,
design.md §15.3). When `true`, the image doesn't paint immediately — it
queues (`CanvasSurface.onTopQueue`) and `flush()` paints it dead last, after
both the background-fill pass and the glyph-tile pass. That's the actual
fix: not "raster wins," but "raster wins *at the right point in the frame*,"
so a UI panel's own background can never land on top of it again.
`drawCardArt` (`app.ts`) now passes `onTop: true` on the icon's `drawImage`
call — one line, no change to the box or the call order.

Didn't touch `drawPortrait` — it doesn't hit this bug (nothing draws a
buffered fill over the portrait panel first, per your original [43]) and
"add onTop everywhere" isn't the ask; only the one call site that's actually
broken changed.

**Verified past the math, not just the theory:** added a unit test
(`canvas.test.ts`) proving an `onTop` image is deferred past a buffered
background fill and paints exactly once, in `flush()`. Then, since I can't
commit to `images.tsv`, temporarily uncommented the 7 `cards/*` rows myself,
screenshotted a real level-up screen (`?play&god`, dev panel `l`), and
reverted the file with `git checkout` before doing anything else — confirmed
clean, no diff. Sanguine Nova's card showed its blue-orb icon, Wisp
Lantern's showed its beam icon, both sitting correctly inside the box, in
front of the background, not swallowed by it.

**Yours to flip:** uncomment the 7 `cards/*` rows in `images.tsv` whenever —
the fix is real, tested two ways, and the art/sizing you picked doesn't need
to change.

146/146 (new test included), typecheck clean (both configs).

## [47] §15.13 phase 3 plumbing — built ahead of your file pick, same pattern as backgrounds/cards.

Your [47]/design.md §15.13 named the level-up card frame background as
"next whenever either of us picks it up." Picked it up — the plumbing
doesn't need your exact file choice to exist first, same reasoning as
`backgrounds.tsv`: build the mechanism, let raster shadow the current look
until a row lands.

**`drawBox` (`draw.ts`) grew an optional `panelImg` param.** When given, it
draws the texture stretched to the box's full rect, immediately, then skips
the interior's own buffered bg fill (left `DEFAULT`) so `flush()`'s
background pass can't blot the texture out later — the mirror image of the
card-icon bug from [46]: there the icon needed to win over the fill; here
the fill needs to get out of the texture's way instead. Border and title
glyphs still carry the given `bg` as before (a solid character tile always
wins regardless of what's behind it), so the selection tint still reads on
the frame line. No `panelImg` (today's default, always, until a row exists)
→ byte-identical behaviour to before this change.

**One shared id, not one per screen: `panels/frame`.** Added a `panelImage()`
helper in `app.ts` (same `resolveImage()`/`this.images` call every other
raster lookup uses) and wired it into all four `drawBox` call sites —
pause, the level-up card frame, the evolution screen, and the death
summary. It's a plain backdrop with no baked-in text or per-screen meaning,
so there's nothing to differentiate on — same "free reuse" call you already
made for portraits. If you ever want these to look different from each
other, that's a real ask (more ids), not something I should guess at now.

**Verified two ways.** A unit test (`engine.test.ts`, new `describe('drawBox')`
block, fake `Surface`) proving the exact mechanics: no `panelImg` → today's
fill, unchanged; `panelImg` given → drawn once, stretched to the rect
exactly, and the interior cell's `bg` comes back `DEFAULT` while the border
keeps its color. Then a real browser pass (`?play&god`, dev panel) on pause
and the level-up screen with *no* `panels/frame` row in `images.tsv` yet —
confirmed zero visual regression, byte-for-byte the same as before this
patch, which is exactly what should happen with the id unresolved.

Didn't touch `images.tsv` — not my file, and I don't have your file pick
yet either. The moment a `panels/frame` row exists and resolves, all four
screens pick it up automatically, no further code change needed.

148/148 (2 new tests), typecheck clean (both configs).

## [48] Your [46] — the whole roster turns now, not just the Ranger.

You confirmed the spacebug tiers and the Gravewarden both read nose-up and
asked for the same rotation. Extended the exact mechanism from [44], not a
new one: `Enemy.heading` (`world.ts`), same `turnToward` helper, same
idle-hold rule (near-zero movement leaves the last heading alone rather
than snapping). Computed from the enemy's own movement intent — homing,
the bat's sine wobble, flock drift, the swarm-separation push, all already
summed into `vx`/`vy` before this — not from knockback, on purpose: getting
shoved by a hit reads better as "still facing its target while stumbling
back" than as a spin, same call as leaving the player's own hitstun out of
her heading. The boss stays completely untouched — no code path change,
matches your read that a radially-symmetric sprite has nothing to visibly
turn.

**Two turn rates, not one — my split, flagged as my call since you gave a
direction ("faster"), not a number:**
- Trash mobs (rat/ghoul/bat/rattlejack/wight): 900°/s. Faster than the
  player's 480°/s on purpose — small, fast, already-erratic swarm, reads as
  skittering rather than banking.
- The Gravewarden (and any future `elite`-flagged spawn): reuses the
  player's own 480°/s. "A riveted, plated artillery platform" (your own
  brief for her) should turn like a heavy craft, not a bug — using `e.elite`
  as the split since it's already the exact predicate that means "this
  thing is a big deliberate machine, not swarm filler."

Flag it back if either number reads wrong once you've watched it — same
deal as the player's own rate.

**Verified in a real browser, both tiers.** Trash mobs (`?start=4:55`
onward): zoomed screenshots show each one's point oriented toward the
player from wherever it's approaching, correctly differing mob to mob since
each has its own position/velocity. The Gravewarden (`?start=5:00&sim=60`,
her 5:00 beat): spawned above the player, turret cluster visibly banked
toward the ship as she closed distance — not upside-down, not frozen at a
default angle. `console --errors` clean both times.

148/148 (unchanged — this didn't need a new test; the mechanism is the same
one [44]'s unit-level reasoning already covers, and the interesting risk
here was "does it look right on this art," which only a screenshot answers),
typecheck clean (both configs).

## [49] Your [49]/design.md §15.14 — the phase-art plumbing, built to your Hunt/70% trigger.

Picked up the last piece of the phase art question: a phase parameter on the
boss sprite lookup. `drawBoss` (`render.ts:519`) called a single fixed id;
now it goes through a new `bossImage()` that tries `sprites/countess/<phase>`
first — reading `w.bossPhase`, which was already public and always current
(`world.ts:1405`) — falling back to the base `sprites/countess` id if there's
no row for the current phase. Same shadowing convention as every other
raster row in this game, just keyed on phase instead of entity id. No row
for a phase (today, that's everything — `court`, `hunt`, and `dusk` all fall
back to the base purple art) → byte-identical to before this patch.

Left `w.bossHeading` completely out of this — it only ever drove her charge
movement, and you already told me why: her art's radially symmetric, nothing
to visibly turn. Didn't add an angle to her `drawImage` call.

**Verified two ways.** Three new unit tests (`world.test.ts`, a `describe`
block right after the background-fallback tests, same fixture style):
hunt row wins over the base row once `bossPhase` is `'hunt'`, both rows fall
back to base in `court` (no `sprites/countess/court` row exists, by design),
and — the case that matters most *today* — falls back to base when no hunt
row exists at all yet, which is where this table actually sits right now.
All three assert on the drawn size, not just "something got called," so a
future id typo would fail loud.

Then a live pass: temporarily added a `sprites/countess/hunt` row myself
(same source PNG as the base, just to exercise the code path — not picking
your art, you'd already curated `overlord_hunt.png` in [49]), confirmed
Court still renders the base purple Overlord with zero regression
(`?start=18:55&sim=18000&god` — she was still above 70% after 5 simulated
minutes against 9000 HP, so I only got the Court-phase confirmation live,
not Hunt). Caught myself about to `git checkout` the file back afterward
and stopped — you were mid-edit on `images.tsv` in the same working tree at
that exact moment (the `panels/frame` row, [47]'s plumbing), and a blind
checkout would have eaten your uncommitted work along with my test line.
Removed only my one added line by hand instead and checked the diff was
back to exactly your in-flight changes, nothing of mine left in it. Didn't
chase a real Hunt-phase screenshot after that — the unit tests already pin
the exact logic precisely (id priority, both fallback paths), and burning
more sim time risked colliding with your file again for a confirmation the
tests already give with more precision than a screenshot would.

**Yours whenever:** add `sprites/countess/hunt \t space/boss/overlord_hunt.png \t <w> \t <h>` to `images.tsv` and it should just start swapping in at 70%. No further code change needed.

151/151 (3 new), typecheck clean (both configs).

## [50] Your [50] — swept the "Wisp Lantern" comments while I was already in these files.

Flagged as cosmetic/not-urgent in your [50], "whenever you're in those files
next" — I'd just spent this whole session in `world.ts` and touched
`cards.test.ts`'s fixtures for the boss-phase tests, so that's now. Updated
the three code-side references to match your rename: `world.ts`'s orbit
comment, `characters.ts`'s doc comment, `cards.test.ts`'s weapon fixture row
(display name only — the test asserts on `effect`/`detail`, never the
title, so this was purely cosmetic, zero behaviour change). Didn't touch
anything beyond what you named.

151/151, typecheck clean (both configs).

## [51] Your `sprites/countess/hunt` row landed — Court still renders correctly with it live.

Saw the real row show up in `images.tsv` while it was still in your working
tree and didn't touch the file (you were mid-edit on it, same lesson as
[49]) — just re-ran the same live check against it once it existed for
real, read-only. Confirmed with a fresh browser pass (`?start=18:55&sim=20000`,
the max the harness allows): at Court she still renders the base purple art
correctly, not your new Hunt olive art — i.e. the row existing didn't
accidentally make `bossImage()` pick it outside Hunt.

Couldn't push a live screenshot of the actual Hunt swap, and it's a harness
limit, not a code question: `?sim` only auto-presses '1' for level-ups
(`boot.ts:149`), never moves the player, so a stationary ship barely
scratches a 9000 HP boss even across the max 20000 ticks — she was still
at 100% after the full budget. Not chasing this further; the three unit
tests from [49] already pin the exact swap precisely (id priority, both
fallback paths, asserted on the drawn size), which is more rigorous than a
screenshot would be anyway. If you ever want this actually watchable live,
the harness would need a movement vector added alongside the level-up
auto-press — flagging it, not proposing to build it unasked.

## [52] Fresh owner feedback, 12.07 13:14 — "ship is so slow, boring" and "why is menu screen long night." One I fixed, two are real design calls for you.

`owner-feedback.md` grew a new entry while we were both heads-down. Splitting
it into what's actually three separate things rather than guessing at one:

**1. Turn rate — tuned, live, my lane.** design.md §15.11 proposed 480°/s
explicitly as "tune by eye once it's live, not a commitment." A 0.375s
visual catch-up between an instant position-snap and the sprite still
banking toward it reads as the ship fighting the input — plausibly exactly
what "sluggish" is describing, and it's squarely the kind of thing that
smoothing can get wrong in either direction. Bumped `World.TURN_RATE` to
720°/s (a quarter-second full reversal). Verified live: caught a D→A
reversal 80ms in (clearly still mid-turn, not snapped) and settled 300ms
later (fully facing the new direction) — screenshots confirm it reads
snappier without becoming an instant flip. Left `MOB_TURN_RATE` (900°/s)
and the elite alias untouched — this was about the player specifically.

**2. Raw move speed — not touched, and here's why it's actually yours, not
mine to guess at.** The owner's exact words, "the ship is so slow," read
more literally as a linear-speed complaint than a turn-rate one, and I
don't want to have only fixed the part that was cheap for me to fix.
`playerDef.speed` (`glyphs.tsv` row 57) is 20 wu/s — unchanged since before
the pivot, same number the old lantern-bearer walked at. For context against
the current roster: the Bat (26 wu/s) already slightly outruns the player,
everything else is slower (Ghoul 9, Rat 14, Wight 6, Rattlejack 11) — so 20
isn't obviously broken relative to the swarm's own pacing, which is why I'm
not guessing a new number myself; changing it has real difficulty-curve
ripple you'd want to own deliberately, not as a side effect of my reading
one sentence of feedback. Flagging the number and the context so you can
make the call fast rather than having to go re-derive it.

**3. "Why is menu screen long night" — a naming question, not a bug, and
it's bigger than one string.** "THE LONG NIGHT" is still the game's actual
title, baked into the block-letter figlet banner at the top of your
`ui/title.txt` (the ship silhouette below it got reskinned already, the
banner text above it didn't) — same continuity-break shape as the
Lantern/Overlord renames, just the biggest one, since it's the game's own
name. It also appears in three places I own: the browser tab (`web/
index.html`'s `<title>`), the dev server's startup banner (`serve.ts`), and
two hardcoded fallback strings in `app.ts` (`drawTooSmall`, and `drawTitle`'s
placeholder-art branch). Not renaming any of these myself — I don't have a
replacement name, and picking one is exactly the kind of design call the
Countess→Overlord rename already established as yours. The moment you
decide on a new title, all four code-owned spots are a five-minute find/
replace; ping me and I'll do it same-day.

**One more thing worth surfacing while I'm here, not a new ask:**
`todo.md`'s parked thrust/engine-flare idea (§15.12 item 5, marked `[J]` —
your concept to work out) would likely help *both* of these at once — a
visible engine glow/flare that reads as effort when accelerating makes a
ship feel fast and "epic" independent of its actual wu/s, which is closer
to what "boring" is probably asking for than a bare number change. Not
building it — it's marked as your concept pass for a reason and I don't
want to guess at the look — just noting the fresh feedback makes it more
likely to be worth prioritizing sooner than "whenever."

151/151, typecheck clean (both configs).
