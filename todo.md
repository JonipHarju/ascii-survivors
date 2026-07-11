# todo.md — task log (Jane is sole author, gathers from jane.md + john.md)

Newest block at top. `[J]` Jane's, `[Jo]` John's. Struck through = done.

## 11.07 — THE SPACE PIVOT (owner, 00:03)

Full design writeup: `design.md` §15. Contract ask: `jane.md` [33].

- [x] `[Jo]`/`[J]` Contract ask from `jane.md` [33] — answered, by reading
      John's in-flight code rather than waiting (`design.md` §15.5): one
      static image per sprite id (no frames/sheets), wu stays isotropic with
      `WU_PER_ROW=2` unchanged (§5.1 does NOT go away), Web Audio with one
      active loop per id + unlimited overlapping one-shots, no crossfade yet.
- [x] `[J]` Wrote `assets/images.tsv` (player + 5 mob tiers) and
      `assets/audio.tsv` (all 13 `playSfx` ids + `music/theme`), both
      pointing at `assets/space/`. `npm test` 142/142 with both tables live.
- [ ] `[Jo]` **Real gap, not blocking:** no animation contract for raster
      sprites yet (`images.tsv` is one static image per id — the old `.txt`
      pipeline's `# fps:`/multi-frame animation has no raster equivalent).
      The Ranger and every Spacebug currently render as a static image. Not
      urgent for the vertical-slice proof; will matter before this looks
      finished.
- [ ] `[Jo]` **Real gap, not blocking:** `WebAudioSink` holds one active loop
      per id and has no crossfade. §15.4's ambient-to-combat swell needs a
      second music id (e.g. `music/combat`) and a call site in
      `world.ts`/`app.ts` that watches the spawn director's target
      population and switches — that's a code ask, not a data-table one.
      `DynamicFight_1/2/3`, `dark`/`dark2`, `DubStepDropBoom` are already
      curated into `assets/space/audio/` waiting on this.
- [ ] `[Jo]` **Mismatch to reconcile:** `images.ts`'s docstring example and
      `web/imagesource.ts`'s `tools/build.ts` comment both assume rows point
      into `space-assets/` with cherry-picking at build time. Every row I
      wrote points at the tracked `space/` instead (owner's call). If
      `tools/build.ts` has space-assets-specific cherry-pick logic, it now
      has nothing to do — worth a look so it doesn't silently no-op. Flagged
      in `jane.md` [35].
- [x] `[J]` Phase 2: vertical-slice proof — actually looked, in a headless
      browser against the real build. The Ranger renders correctly, centred,
      zero console errors. Found two real problems doing this (below) that
      no test suite would have caught.
- [ ] `[Jo]` **Top of the raster-legibility list.** The player ship is nearly
      invisible against the black field — no glow/outline/rim-light, so
      "the player must never be lost" (design.md §15.3.1) is already failing
      on the first sprite shipped. Raster has no equivalent of the old
      reserved-bright-white-`@` mechanism. Needs a highlight pass under or
      around the player's `drawImage` call — this is a rendering ask, an art
      reskin alone can't fix "must read against any background." design.md
      §15.7.
- [ ] `[Jo]` **New code ask, not a data gap.** No full-field background blit
      exists — `assets/space/backgrounds/starfield_01.png` is curated,
      committed, and currently unused; the field is still the old ASCII void.
      `images.tsv` is the wrong shape for this (it's per-entity); this needs
      its own mechanism — something that covers the viewport, sits under
      everything, probably doesn't track the camera 1:1 like a positioned
      entity does. design.md §15.7.
- [ ] `[J]` Catch a live Spacebug in an actual screenshot — confirmed kills
      are happening (director spawns, weapon auto-fires, kill counter moved)
      but didn't catch one on screen before it died. Wire up god-mode +
      slower time in the next visual check to compose the shot.
- [ ] `[J]` Phase 3: rest of the field roster (5 Spacebug tiers — done;
      elites, the Overlord still to curate + map) + weapon/passive card art
      reskin (design.md §15.2 table).
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
