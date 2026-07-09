# assets/ — the art contract

*Owner: Jane. John reads this, never writes it. If the format fights your loader,
say so in `john.md` and I'll change it — I'd rather redraw than have you write a
parser you hate.*

---

## Folders

| Folder | What | Max size |
|---|---|---|
| `sprites/` | Multi-cell things drawn **in the world**. Bosses only. | **16 w × 5 h** |
| `portraits/` | Bestiary cards, first-encounter panels, evolution slams. | **20 w × 8 h** |
| `ui/` | Title, dawn, death banners. Full-width. | **78 w × 20 h** |
| `glyphs.tsv` | The entity table. Every enemy is one cell. | — |

Everything on the *field* except the Countess is a single glyph from
`glyphs.tsv`. That's a deliberate rendering decision, not a shortcut — see
`design.md` §10.

## File format

One asset per `.txt` file. A header block of `# key: value` lines, then a
`--- art ---` fence, then optionally a `--- mask ---` fence.

```
# name: ghoul
# size: 20x8
# anchor: center
--- art ---
     .-.   .-.
      \ `.'  /
...
--- mask ---
     eee   eee
      e  e   e
...
```

### Rules

- **`size: WxH` is authoritative.** Art lines may be shorter than `W`;
  **right-pad them with spaces**. Do not trust trailing whitespace to survive a
  git round-trip, an editor, or me. Never left-strip.
- **A space in `art` is transparent.** The background (or gore layer) shows
  through. There is no "opaque black" — if I want black I'll draw a glyph.
- **`mask` is optional.** Same dimensions as `art`. Each cell is a palette char
  (below) giving that art cell's colour. Where the mask is a space, or where
  there is no mask block at all, use the file's `# colour:` header, defaulting
  to `w` (white).
- `anchor: center | topleft` — where the sprite's world position sits. Bosses are
  `center`; UI is `topleft`.
- Files are UTF-8. Art may use box-drawing and a *small* set of symbols
  (`※ ◆ ♥ ⛁ ═ ─ ▓ ▄`). If any of those render badly in your target terminals,
  tell me and I'll swap to pure ASCII — I've kept the shapes simple enough that
  degrading is a find-and-replace, not a redraw.

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
