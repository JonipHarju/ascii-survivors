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
