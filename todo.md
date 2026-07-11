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
- [ ] `[Jo]` **Real gap, still open:** no animation contract for raster
      sprites yet (`images.tsv` is one static image per id — the old `.txt`
      pipeline's `# fps:`/multi-frame animation has no raster equivalent).
      The Ranger, every Spacebug, the Gravewarden, and the Overlord all
      currently render as static images. Not urgent, will matter before
      this looks finished.
- [x] `[Jo]` Crossfade — built (`AudioSink.setMusic(weights)`,
      `World.musicIntensity` off `targetPopulation()`). `audio.tsv` re-keyed
      to `music/ambient`/`music/combat`/`music/boss` to match.
- [x] `space-assets/` vs `space/` mismatch — false alarm, confirmed by both
      of us independently. `copyReferencedMedia` never had `space-assets/`-
      specific logic; only doc comments were stale. John fixed the comments.
- [x] `[J]` Phase 2: vertical-slice proof — actually looked, in a headless
      browser against the real build. The Ranger renders correctly, centred,
      zero console errors. Found two real problems doing this (below) that
      no test suite would have caught.
- [x] `[Jo]` Player legibility — fixed. `Surface.drawImage` grew a `glow`
      param; the player's call passes bright white, nothing else's does.
      Confirmed by eye: reads immediately against pure black now.
- [x] `[Jo]` Background contract — built (`backgrounds.tsv`: id/path/
      parallax/tileWu, `drawBackground()` in render.ts, falls back to the
      procedural scatter cleanly if unset). Jane's design call: parallax
      0.15, tile 40wu (design.md §15.8). `assets/backgrounds.tsv` written.
- [ ] `[Jo]` **New bug found verifying the above.** The background still
      doesn't draw — `src/web/boot.ts:112` constructs `WebImageSource` with
      only `data.images`, never `data.backgrounds`, so the starfield's path
      is never requested/preloaded and `drawBackground()`'s `this.images.get()`
      is always `undefined`. Falls back silently and correctly, per spec —
      just missing one wire (`WebImageSource` needs the background path(s)
      merged into its preload set). design.md §15.8.
- [x] `[J]` Curated elites + boss (Phase 3, pulled forward — the code path
      needed zero new work). Gravewarden → `big_berta.png`, Overlord →
      `OverlordNightmare6Cropable1_01.png`. Rows added to `images.tsv`.
      Verified in a real boss encounter (`?start=18:55`): renders correctly,
      big, distinct, HP bar and all.
- [ ] `[J]` Catch a live Spacebug in an actual screenshot — still haven't.
      Confirmed kills are happening (director spawns, weapon auto-fires,
      kill counter moved) but didn't catch one on screen before it died.
- [ ] `[J]` Phase 3 remainder: weapon/passive card art reskin (design.md
      §15.2 table). Field roster (mobs/elites/boss) is now fully curated.
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
