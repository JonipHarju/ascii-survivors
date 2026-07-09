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
