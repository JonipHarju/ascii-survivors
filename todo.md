# todo.md — task log (Jane is sole author, gathers from jane.md + john.md)

Newest block at top. `[J]` Jane's, `[Jo]` John's. Struck through = done.

## 12.07, 16:10 — "THIS IS NOT AN ASCII GAME ANYMORE" (owner; 8 complaints, one root cause)

Full ruling: `design.md` §16. Handoff: `jane.md` [57]. The pivot moved the
actors to raster; every *effect* still draws in glyphs. Field goes 100%
raster.

- [x] `[J]` Audit — every ASCII survivor on the field enumerated (§16.1):
      thrust apostrophes, death-pop ASCII sprite flash, all weapon effects,
      ember/spark glyphs, floor decals, passive card diagrams, title banner.
- [x] `[J]` New hero ship — Ranger_A retired ("this ship looks stupid"),
      Warden flies `Starship_A` (dark fighter, blue engine stripe that
      mates with the cyan trail). Verified live in a real browser.
- [x] `[J]` Per-character ships live for the first time — the code hook
      existed, nobody had fed it rows. Ashling: red ornate cruiser.
      Beggar: gold TinyCruiser (source art nose-down; committed file
      rotated 180° to obey the nose-up contract). Crossroads now sells
      visibly different ships.
- [x] `[J]` Wisp mismatch fixed at the root (§16.4): `bulletGlow.png` is
      now BOTH the card icon and the staged projectile row — one file,
      can't drift. Old purple-arc card was my miss, owned in [57].
- [x] `[J]` Light mechanic ruling (§16.5): normal play fully lit; Dusk
      keeps its blackout finale; `light_radius` reframed as sensor range
      (already gates stalker tells in code). passives.tsv text updated.
- [x] `[J]` Curated + committed, rows staged: 3 debris decals (raster
      floor), 2 parallax star layers, wisp orb projectile.
- [ ] `[Jo]` **P0** Particles → canvas primitives (thrust/embers/sparks),
      incl. the traced thruster-centring fix: spawn at resolved player
      image h/2, NOT a constant (per-char hulls differ). §16.2a/§16.3.
- [ ] `[Jo]` **P0** Death pop → enemy's own raster sprite, white glow,
      scale-fade. The literal "ascii thing flashed below it." §16.2.
- [ ] `[Jo]` **P0** Weapon effects: `projectiles/<weapon id>` raster hook
      (bolts/orbs/salts; `projectiles/lantern` row staged); bands/rings/
      columns/hazards as glowing translucent primitives. §16.2b/c.
- [ ] `[Jo]` **P0** Light default flip: browser lit by default, `?dark`
      opt-in, `w.dusk` still forces. §16.5.
- [ ] `[Jo]` **P1** Decal raster hook (`decals/debris1..3` staged, pick
      per spawn) + multi-layer parallax background (`field.0/1` staged).
- [ ] `[Jo]` **P1** Answer: does drawCardArt key passive cards through
      `cards/<id>` like weapons? If yes, Jane's icon pass is rows-only.
- [x] `[J]` **P1** Passive card icons — done ahead of the answer: all 12
      curated (energy-orb "system cores", one hue per meaning) with LIVE
      rows — inert if drawCardArt skips passives, lights up if not.
      Nothing to lose either way post-z-order-fix. `jane.md` [58].
- [x] `[J]` **P1 bonus, unplanned:** full mob-roster resculpt — every tier
      its own silhouette (Buggy/Scorpion_Evo/Stalker_Neon/SpikeEvil/
      MotherShip), portraits track, hues keep old tier instincts. The
      images.tsv "later phase" promise, cashed. `jane.md` [58].
- [ ] `[J]` Live owner's-eye screenshot pass of roster + cards once
      John's P0 lands (dev server was mid-compile on his bolt-id work).
- [ ] `[Jo]`/`[J]` **P2** Title wordmark as real canvas typography + hero
      ship art on the title screen; ui/title.txt retires to terminal
      fallback. §16.7.

## 12.07, 13:14 — "SHIP IS SO SLOW, BORING" + "WHY IS MENU SCREEN LONG NIGHT" (owner)

Full design writeup: `design.md` §15.19 (speed) / §15.20 (title). John's
triage: `john.md` [52]. Contract ask: `jane.md` [55].

- [x] `[Jo]` Turn rate bumped 480°/s → 720°/s — his lane, tuned and
      verified live, since a 0.375s visual catch-up read as the ship
      fighting the input.
- [x] `[J]` Move speed decided: 20 → 24 wu/s. Checked against the roster
      (Bat 26 stays the one thing that outruns you; everything else well
      under 20) rather than pick a number blind. Kept `ashling`/`beggar`'s
      unused-but-documented `glyphs.tsv` rows proportional.
- [x] `[Jo]` Thrust trail — built to spec (`john.md` [53]), 4 new tests,
      verified live. Not a coincidence this landed same-day as the speed
      fix: a visible effort cue addresses the *feel* of "boring" that a
      bare number change alone wouldn't.
- [x] `[J]` Title renamed: **THE LONG NIGHT → LONE NIGHT.** Surgical fix —
      breaks the specific *Game of Thrones* echo, keeps the already-vetted
      "night"/dawn survival framing. Redrew `ui/title.txt`'s banner by
      cutting and reassembling existing verified letterforms (L, O, N, E),
      zero freehand drawing — bigger renames need new letters (A, S) the
      font doesn't have yet, deliberately deferred. Updated every
      `assets/*.tsv` header comment for consistency.
- [x] `[Jo]` Title fully swept — **shipped** (`john.md` [55]). The four
      flagged spots plus two more he found himself (`serve-static.ts`'s
      `npm start` banner, the terminal build's strings) and the root
      `README.md` heading. Confirmed live: browser tab reads `LONE NIGHT`.
- [x] `[Jo]` **Real bug, not cosmetic — the boss charge telegraph had no
      raster equivalent, invisible for every real player.** Fixed
      (`john.md` [56]): reuses the `glow` drawImage param for the pulsing
      warning tint, plus wired the two never-called `countess_charge`/
      `countess_land` screen shakes from `juice.tsv`. 5 new tests.
- [x] `[Jo]` **Real bug, bigger — ordinary hit-flash was silently dropped
      for the entire raster roster.** Fixed (`john.md` [57]): same `glow`
      mechanism now also carries the hit-flash flinch cue. Every hit in
      the game had lost this cue since raster took over; neither gap
      showed up in a screenshot since both windows are 60-800ms. 2 new
      tests.

## 12.07 — SHIP ROTATION + "FULL GRAPHICAL OVERHAUL" CHECKLIST (owner, 12:42)

Full design writeup: `design.md` §15.11/§15.11.1 (rotation) and §15.12 (the
checklist). Contract asks: `jane.md` [45], [46].

- [x] `[Jo]` **Ship rotation — shipped.** `World.heading`, derived from
      `movePlayer`'s `(nx, ny)`, NOT `world.facing` (untouched, still the
      Chain's aim). Turn rate reconciled to design.md's 480°/s (John's
      initial build used 720°/s by eye, corrected to match). Holds last
      heading at rest. Verified against all four cardinal directions in a
      real browser. `john.md` [44]/[45].
- [x] `[J]` Checked `Galactica_Ranger_A.png`'s own orientation so John isn't
      guessing: nose points up, cockpit near the top, engine flare at the
      bottom. `angle: 0` lines up with "moving up the screen," confirmed
      correct once wired — no offset needed.
- [ ] `[Jo]` **New: extend the same rotation to the mob roster + Gravewarden.**
      John flagged this as open rather than guess at it (art call, not
      code) — answered: `spacebug_*.png` (all 5 palette tiers) and
      `gravewarden.png` both read clearly nose-up (turret/head breaks the
      radial symmetry, legs splay to the sides), same grammar as the
      Ranger. Turns correctly. **The Overlord needs nothing new** — she
      already has her own 90°/s `bossHeading` charge-attack turn,
      unrelated to this thread. Suggested a faster-than-player turn rate
      for trash mobs (erratic swarm feel) but left the number to John.
      `design.md` §15.11.1, `jane.md` [46].
- [x] `[Jo]` Card-icon z-order fix — **shipped**: an opt-in `onTop` param on
      `drawImage`, deferred to paint after every buffered glyph in
      `flush()`. Better than a global ordering flip — the field's "raster
      under glyphs" law stays correct everywhere it currently is. New unit
      test in `canvas.test.ts`. `john.md` [46].
- [x] `[J]` Re-enabled the 7 `cards/*` rows in `images.tsv` for real.
      `npm test` 146/146; drove a real headless browser to a level-up
      screen and screenshotted it — Sanguine Nova's card shows its icon
      correctly, in front of the box, zero console errors. `jane.md` [48].
      §15.13 phase 3 (card frame background → `Round-Rect` panel texture)
      is next.
- [x] `[J]` Scoped the GUI overhaul (`design.md` §15.13, `jane.md` [47]):
      checked every `drawBox` caller (pause/level-up card/level-up header/
      death screen) — all four hit the identical z-order bug as the cards,
      so John's fix above unblocks the whole GUI, not just cards. Folder-
      level picks: `GUI Items/*Round-Rect*` (dark panel textures, on-theme,
      no baked-in text) for card/panel backgrounds, `ButtonsWithText/
      buttonOriginal.png` (+states) for a future clickable menu — parked,
      `input.ts` is keyboard-only today, nothing to attach a button to yet.
      Phasing: fix -> re-enable the 7 parked `cards/*` rows (free payoff,
      confirms the fix) -> level-up card frame -> pause/death panels.
- [x] `[J]` Boss phase-2 art call — decided, `design.md` §15.14. Not 50%
      HP as originally guessed: swap at the Court→Hunt boundary (70%),
      since that's when she starts charging (arena still lit, biggest
      behavioural swing) rather than at Dusk (25%, screen goes black
      anyway — a recolor nobody would see). Pick: `OverlordEvoSample_03`
      (olive/black/deep-blue, reads more venomous than the current
      purple), curated to `assets/space/boss/overlord_hunt.png`.
- [~] `[Jo]` Needs a phase parameter on the boss's `imageFor(r, w,
      'sprites/countess')` call (`render.ts:519`) — resolves one fixed id
      today. Want, not a blocker. `jane.md` [49]. **In progress**: caught
      a `sprites/countess/hunt` row already added to `images.tsv` pointing
      at the curated art — John's building this.
- [x] `[Jo]` Rotation extended to the whole mob roster + Gravewarden
      (`john.md` [48]): `Enemy.heading`, same mechanism as the player. Two
      turn rates, his split: 900°/s trash mobs (erratic swarm), 480°/s
      elites via `e.elite` (heavy craft, same as the player). Verified in a
      real browser, both tiers. Boss untouched, matches Jane's read that a
      radially-symmetric sprite has nothing to visibly turn.
- [x] `[Jo]` §15.13 phase-3 plumbing built ahead of the art pick
      (`john.md` [47]): `drawBox` grew `panelImg`, one shared id
      `panels/frame` wired into all four panel screens, zero regression
      with no row present.
- [x] `[J]` Closed [47]'s open half: picked the `Round-Rect` texture,
      curated to `assets/space/ui/panel_frame.png`, added the `panels/frame`
      row. `npm test` 151/151; screenshotted the level-up card frame and
      the pause panel — texture stretches cleanly on both, zero console
      errors. `design.md` §15.16, `jane.md` [51]. §15.13 is fully closed.
- [x] `[J]` Found and fixed a continuity break nobody had flagged: two
      player-facing strings still described a physical lantern that
      stopped existing at the pivot. `passives.tsv`'s `oil`: "Lantern
      Oil"→**"Reactor Fuel"**. `weapons.tsv`'s `lantern`: "Wisp
      Lantern"→**"Ion Wisp"**. Internal ids unchanged. Verified via the
      real parser (zero warnings) since the level-up draw is randomised.
      `design.md` §15.15, `jane.md` [50].
- [x] `[Jo]` Boss phase-art plumbing — shipped (`john.md` [49]):
      `bossImage()` tries `sprites/countess/<w.bossPhase>` first, falls
      back to base, pinned with 3 unit tests. Caught himself mid-`git
      checkout` to avoid eating Jane's in-flight `images.tsv` edit —
      manually backed out just his own test line instead.
- [x] `[J]` Wired the row: `sprites/countess/hunt`, sized off the art's
      real pixel aspect (16×13.3, not a verbatim reuse of the base row's
      `h`). Verified via the real parser (zero warnings). **Couldn't get a
      live Hunt-phase screenshot** — found and documented why (`design.md`
      §15.14's closing note): `boot.ts:145` hard-caps `?sim=` at 20,000
      ticks regardless of request, not enough combat time for a weak
      arrival to dent a 9000 HP boss to 70%. Not a bug, not chasing a code
      change — the question is deterministic id-selection, already pinned
      more precisely by John's unit tests than a screenshot would add.
      Bonus: an unrelated sim screenshot from this chase incidentally
      reconfirmed the Ion Wisp/Reactor Fuel rename in a fresh context.
      `jane.md` [52]. §15.14 is fully closed.
- [x] `[Jo]` Thrust trail — **shipped** (`john.md` [53]), built to spec,
      4 new tests, verified live. Turned out well-timed: the fresh 13:14
      "boring" feedback made this the "feel fast" half of that fix.
      **§15.12's checklist is fully worked through** — every item from the
      12.07 owner feedback is either shipped or sitting as a scoped ask.

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
- [x] `[Jo]` Background preload bug — fixed same day (`b76b184`), before
      Jane even finished writing it up. `WebImageSource` now takes the union
      of every path `images.tsv` *and* `backgrounds.tsv` name. Re-verified
      in a browser: the starfield renders — soft round dots, replaces the
      old ASCII scatter outright, player halo reads clearly against it.
- [x] `[J]` Curated elites + boss (Phase 3, pulled forward — the code path
      needed zero new work). Gravewarden → `big_berta.png`, Overlord →
      `OverlordNightmare6Cropable1_01.png`. Rows added to `images.tsv`.
      Verified in a real boss encounter (`?start=18:55`): renders correctly,
      big, distinct, HP bar and all.
- [x] `[J]` Live Spacebug — never caught the exact frame (4 attempts,
      varying cadence/seed), but have strong indirect confirmation instead:
      the "GHOUL" first-encounter portrait fires at 00:00 (proves a ghoul
      spawned and was tracked), the kill counter climbs steadily, and mobs
      run through the *identical* `spriteIdFor`/`imageFor` path already
      visually confirmed for the player/Gravewarden/Overlord. Likely
      explanation: the Nova bolt's 80wu range snipes ghouls before they
      cross into the ~60wu-wide viewport. Not worth more time chasing a
      screenshot for a code path with this much indirect + structural
      confirmation already.
- [ ] `[Jo]` **New contract question, posted `jane.md` [39]/design.md §15.9:**
      do weapon effects (procedural shapes, `drawBands`/`drawBolts`/etc, no
      sprite id today) ever get raster art, or does only the level-up
      **card icon** (`cards/<id>`, static) get one — possibly already one
      row away from working if the card UI calls `imageFor()`. Jane's
      holding off picking actual weapon-pack files (hundreds of anonymously
      numbered slices) until the target shape is confirmed, to avoid
      picking blind against the wrong contract. Folder-level guesses are in
      design.md §15.9 ready to act on either way.
- [ ] `[Jo]` **Same question, one more surface:** `drawPortrait` (render.ts
      ~606) reads straight from the ASCII sprite bank (`portraits/<id>`),
      no `imageFor()` call — the first-encounter panel (the "GHOUL" popup)
      is 100% ASCII gothic art today, mismatched against the raster
      Spacebug now on the field. Folded into the same ask rather than a
      third parallel thread: if/when portraits get a raster hook, most
      would be a **free reuse** of art already curated (`portraits/ghoul` →
      the same `spacebug_green.png` as `sprites/mobs/ghoul`) — not 9 new
      ASCII redraws. Deliberately not hand-redrawing all 9 portraits in
      ASCII in the meantime; that'd be throwaway work if raster support
      lands soon after.
- [x] `[Jo]` Answered decisively (`john.md` [41]/[42]): weapon *effects* stay
      procedural for real architectural reasons (7 different geometry
      problems, not 1); card icons AND portraits both go raster, built and
      wired (shared `resolveImage()`), units are cells not wu for both.
      Boss bar fixed too (`'THE OVERLORD'`).
- [x] `[J]` Portrait rows added for all 5 curated mob tiers + Gravewarden —
      free reuse of already-curated sprite art. Verified: the "GHOUL"
      first-encounter panel now shows the actual Spacebug art.
- [x] `[J]` Card icon rows added for all 7 weapons (picks + reasoning in
      design.md §15.9/images.tsv comments).
- [ ] `[Jo]` **Real bug, traced, not fixed, currently disabled to avoid a
      live regression:** card icons don't render even though they load
      correctly — `jane.md` [43] has the full trace. `drawBox`'s background
      fill (`draw.ts`) is a buffered `set()` call covering the whole card
      interior, called *before* `drawCardArt`; `Surface.drawImage`'s own
      documented rule is that raster always composites under buffered
      glyphs regardless of call order (correct for the field, wrong for a
      card where the box is meant to sit *behind* the icon). Likely why
      portraits work and cards don't — nothing draws a buffered fill over
      the portrait panel first. **The 7 `cards/*` rows in `images.tsv` are
      commented out** (`jane.md` [44]) — leaving them live traded a working
      ASCII-diagram fallback for a blank card, an active regression, not a
      no-op. Uncomment once fixed; art/sizing shouldn't need to change.
- [ ] `[Jo]` **Trivial, one line:** `render.ts:689` hardcodes `'THE COUNTESS'`
      for the boss HP bar label — found screenshotting the boss encounter.
      Should be `'THE OVERLORD'`. Jane's file boundary stops her editing it.
- [ ] `[J]` Decide (owner call, propose in `jane.md`): is the Overlord's
      `OverlordEvoSample` art worth a 50%-HP phase-2 swap? Needs `[Jo]` to
      build phase-trigger plumbing first — not started, explicitly a "want,"
      not committed.
- [x] `[J]` Rewrote `assets/README.md`: documented `images.tsv`/`audio.tsv`/
      `backgrounds.tsv` as their own section, corrected the framing from
      "old pipeline superseded" to "two pipelines coexist permanently, raster
      shadows glyph per-id" (matches how the loader actually behaves —
      most of the roster, all UI, still has no raster row and isn't going
      to for a while). Old ASCII contract kept, relabeled as the live
      fallback rather than deprecated.
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
- [x] `[J]` `ui/title.txt` reskinned in ASCII — no raster contract needed,
      it's the same `.txt` pipeline as everything else, and it's the single
      most visible "still looks like the old game" moment (first frame on
      boot). Lantern-bearer figure → a small ship (nosecone/cockpit/hull/
      cyan engine flare), same reserved-alphabet convention. `ui/death.txt`'s
      "another lantern-bearer" line fixed to "another pilot." `dawn.txt`/
      `crossroads.txt` checked — genre-neutral (sunburst, market stall),
      left alone. **Revised plan:** a full `!GUI!/` raster overhaul of these
      screens is still on the table later (design.md §15.2), but this was a
      five-minute fix available right now with zero code dependency — didn't
      want the obvious win to wait on the bigger one.

## Still open, not touched by the pivot (mechanics, not skin)

- [x] `[Jo]` Passives showing `note` as the effect line — **stale entry,
  already done.** `john.md`'s [43] (session start) confirmed the passive
  half of `jane.md` [22] shipped in an earlier pass (`effect: def.note`
  already live in `upgrades.ts`); only the weapon half needed the fix,
  closed the same entry (`7e6d87a`, before this session's log begins).
  Left un-struck here by oversight until now.
- [x] `[J]` XP pickup readability at density — **checked, confirmed still
  at risk, not just re-flagged.** Screenshotted a dense fought-over patch:
  the mote's reserved bright cyan (pre-pivot fix, still runs) never got
  re-validated against every mob now being a full raster sprite instead of
  a glyph — a visual-weight-class gap, not a colour collision. Curated a
  fix: `assets/space/pickups/xp_orb.png` (glowing cyan orb). Needs a real
  code hook — `drawPickups` never calls `imageFor()` today, confirmed by
  reading it. `design.md` §15.18, `jane.md` [54].
- [x] `[Jo]` Wire `drawPickups` through `imageFor()`/`resolveImage()` —
  **shipped** (`john.md` [54]): raster→glyph fallback, pulse still drives
  the raster version's scale. Rows wired (`pickups/mote1`/`5`/`20`,
  `jane.md` [55]). Closes the owner's original 09.07 complaint.
