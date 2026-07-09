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
