# todo.md — task log (Jane is sole author, gathers from jane.md + john.md)

Newest block at top. `[J]` Jane's, `[Jo]` John's. Struck through = done.

## 11.07 — THE SPACE PIVOT (owner, 00:03)

Full design writeup: `design.md` §15. Contract ask: `jane.md` [33].

- [ ] `[Jo]` Answer the three-part contract ask in `jane.md` [33]: sprite
      framing (are `Galactica Ranger`'s 15 files tiers or animation frames?),
      coordinate system (pixels replace character cells — what footprint in
      wu per sprite, does the 2:1 cell-aspect rule in §5.1 go away?), audio
      engine choice (needs crossfade + one-shot-over-loop layering for §15.4).
- [ ] `[J]` Phase 2: vertical-slice proof — Ranger + one Spacebug tier + one
      background on screen, same proof-before-full-reshade approach as the
      original canvas migration. Starting on a reasonable assumption for the
      contract ask above; not blocked on John answering first.
- [ ] `[J]` Phase 3: rest of the field roster (5 Spacebug tiers, elites,
      the Overlord) + weapon/passive card art reskin (design.md §15.2 table).
- [ ] `[J]`/`[Jo]` Phase 4: audio wiring per §15.4 — ambient bed crossfading
      with combat intensity off the spawn director's existing target-population
      number; boss-arrival sting off the existing hitstop juice hook; SFX
      routed through existing `juice.tsv` event hooks, not a new event bus.
- [ ] `[J]` Decide (owner call, propose in `jane.md`): is the Overlord's
      `OverlordEvoSample` art worth a 50%-HP phase-2 swap? Needs `[Jo]` to
      build phase-trigger plumbing first — not started, explicitly a "want,"
      not committed.
- [ ] `[J]` Rewrite `assets/README.md`'s folder/size table and the two ASCII
      laws for the new pipeline, once the contract ask above has answers.
- [x] `[J]` Curate the first real picks out of the 600MB vendor pack into a
      tracked `assets/space/` folder (owner's call: don't commit the whole
      pack, only what's decided). Done: Galactica Ranger, 5 Spacebug colour
      variants, 1 background, 8 named audio tracks. `assets/space-assets/`
      is gitignored — John, build against `assets/space/` only.
- Parked, not forgotten: `!TOWER DEFENSE OPTIONS!` sub-pack (walls/gates/
  turrets) — not survivors-genre material, scope creep unless the owner
  explicitly asks for base-building.

## Carried over from before the pivot — superseded by the above

These were mid-flight when the pivot landed. Not deleted, just moot until/
unless we go back to the ASCII skin:

- ~~`[J]` Gravewarden/Countess heavier shading pass~~ — done 10.07, then the
  whole medium moved. No further ASCII art work planned.
- ~~`[Jo]`/`[J]` dawn/death/crossroads FIGlet banners~~ — superseded, these
  become GUI-kit screens now (`design.md` §15.2, `!GUI!/`).

## Still open, not touched by the pivot (mechanics, not skin)

- `[Jo]` Passives showing `note` as the effect line with numbers dimmed
  underneath (from `jane.md` [22], still John's queue per `john.md`'s last
  entry). Unrelated to art medium — carries forward as-is.
- `[J]` XP pickup readability at density — flagged as *at risk* in
  design.md §15.3 point 5 until the new XP sprite is actually picked/drawn.
  This is the same complaint the owner made on 09.07 about ASCII XP; don't
  let the reskin reintroduce it.
