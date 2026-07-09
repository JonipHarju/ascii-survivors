# assets/ — the art contract

*Owner: Jane. John reads this, never writes it. If the format fights your loader,
say so in `john.md` and I'll change it — I'd rather redraw than have you write a
parser you hate.*

---

## Folders

| Folder | What | Max size |
|---|---|---|
| `sprites/mobs/` | Ordinary enemies, drawn **in the world**. Animated. | **5 w × 3 h** |
| `sprites/elites/` | Elites. Animated. | **9 w × 5 h** |
| `sprites/` | Player (3×3) and the boss (28×11). | **28 w × 11 h** |
| `portraits/` | Bestiary cards, first-encounter panels, evolution slams. | **20 w × 8 h** |
| `cards/` | Level-up card icons — a diagram of each weapon's *shape*. | **12 w × 5 h** |
| `ui/` | Title, dawn, death banners. Full-width. | **78 w × 20 h** |

> ⚠️ **John:** `SIZE_BUDGET` in `sprite.ts` must match, and its `.find()` is
> first-match, so the **specific prefixes have to come before the general one**:
> `sprites/mobs/` and `sprites/elites/` before `sprites/`. Today the whole tree is
> capped at the old `16×5`, so the Countess warns (and draws anyway, correctly).

Everything on the field is a **multi-cell animated sprite** now, tiered by threat
(`design.md` §10). This replaces the old one-glyph-per-enemy rule, which only ever
worked because the field was 100×34; at 180×60 it's just small. **Size is threat**
— a player reads danger from silhouette alone, with no colour.

The `glyph` column in `glyphs.tsv` survives as the **loader fallback** for any mob
whose sprite file doesn't exist yet, so a half-drawn bestiary still ships.

And the tuning tables, which are data, not art — John parses them, Jane owns the
numbers, and neither of us needs the other to change a value:

| File | What |
|---|---|
| `glyphs.tsv` | Every entity: glyph, colour, hp, speed, power, xp. Plus the gore decay table. |
| `weapons.tsv` | One row per (weapon, level). Absolute values, distances in wu. |
| `passives.tsv` | One row per passive, `lv1..lv8`. |
| `evolutions.tsv` | weapon + passive → evolved weapon. |
| `director.tsv` | Spawn director: `param` / `mix` / `beat` rows. |

Everything on the *field* except the Countess is a single glyph from
`glyphs.tsv`. That's a deliberate rendering decision, not a shortcut — see
`design.md` §10.

## File format

One asset per `.txt` file. A header block of `# key: value` lines, then a
`--- art ---` fence, then optionally a `--- mask ---` fence.

The sprite's **id is its path** under `assets/`, minus `.txt` —
`assets/portraits/ghoul.txt` → `portraits/ghoul`.

```
# name: The Countess
# size: 16x5
# anchor: center
# fps: 4
# colour: R
--- art ---
  \\   ^^^^   //
 \ \ ( oo ) / /
--- mask ---
  ee   YYYY   ee
 e e e RR e e e
```

### Rules

- **A space in `art` is transparent.** The background (or gore layer) shows
  through. There is no "opaque black" — if I want black I'll draw a glyph.
- **`mask` is optional.** Same dimensions as `art`. Each cell is a palette char
  (below) giving that art cell's colour. Where the mask is a space, or where
  there is no mask block at all, use the file's `# colour:` header, defaulting
  to `w` (white). *I generate masks from the art programmatically, so they
  cannot drift out of alignment with it.*
- **`size: WxH` is the box the art is drawn inside**, not the art's extent. The
  loader pads short lines out to it and *never clips*; it warns only if the art
  overflows the box. So the box is a positioning tool: every `portraits/` file
  declares `20x8` and centres its own art with **leading** spaces. Nothing
  depends on *trailing* whitespace surviving a git round-trip, because it won't.
  Centring is the artist's job — there is no centring logic in the renderer.
- **Animation:** repeat the `--- art ---` (+ optional `--- mask ---`) pair, once
  per frame, and set `# fps: 4`. Frames may differ in size; they're aligned by
  `anchor`. The Countess flaps her wings this way.
- **Fences are optional.** A file with no `--- art ---` fence is one art block,
  and bare `---` lines separate animation frames. Handy for a throwaway sprite.
- `anchor: center | topleft | bottom` — where the sprite's world position sits.
  Bosses are `center`; portraits and UI are `topleft`.
- `# colour:` and `# color:` both work. Unknown header keys are ignored, never
  fatal, so `# hp: 12` as a note-to-self is safe.
- The per-folder sizes above are **advisory budgets** — over-size art warns and
  draws anyway rather than getting clipped.
- Files are UTF-8. Art may use box-drawing and a *small* set of symbols
  (`※ ◆ ♥ ═ ─ ▓ ▄ ·`). All of those are Unicode *Ambiguous* width, which every
  mainstream terminal renders as one column. Avoid emoji and anything in the
  misc-symbols block that fonts like to emoji-ify — that's why gold is a plain
  `$` and not `⛁`.

### Palette (mask chars → 16-colour ANSI)

Chosen so it degrades cleanly to a 16-colour terminal and needs no 256-colour
support. Lowercase = normal, uppercase = bright/bold.

| | | | | | | |
|---|---|---|---|---|---|---|
| `k` black | `e` grey (dim) | `w` white | `W` **bright white** |
| `r` red | `R` **bright red** | `g` green | `G` **bright green** |
| `y` yellow | `Y` **bright yellow** | `b` blue | `B` **bright blue** |
| `m` magenta | `M` **bright magenta** | `c` cyan | `C` **bright cyan** |
| `s` "bone" — maps to yellow-dim; use for skeletons, rats, sand |

**Reserved:** bright white `W` belongs to the player and nothing else. If a
portrait needs a highlight, use `C` or `Y`.

## The one thing that will bite us

A terminal cell is **twice as tall as it is wide**. Art drawn on a square mental
grid comes out stretched vertically. Everything in here is drawn *knowing* that —
these portraits look correct on screen and squashed in your editor. Don't
"fix" them.

The same fact governs the whole simulation. `design.md` §5 is the rule: world
units, `1 cell = 1×2 wu`, circles render as ellipses `ry = rx/2`.
