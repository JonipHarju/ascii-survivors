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
