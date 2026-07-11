/**
 * Where sound goes. Platform-agnostic on purpose, same split as `SaveStore` and
 * `InputSource`: `World` and `App` run under `node --test` and in the terminal
 * build, neither of which has an `AudioContext`. The real player
 * (`WebAudioSink`) lives in `web/audio.ts`; the terminal build never
 * constructs one, and `World` never imports either — it only ever pushes
 * event-id strings onto `World.sfx` (see `game/world.ts`), which `App` drains
 * into whichever `AudioSink` it was given.
 *
 * `play(id)` for an id with no row in `audio.tsv` — or on `NULL_AUDIO_SINK` —
 * is silently a no-op, same philosophy as a missing sprite or a missing image:
 * the game must never crash, or even warn mid-run, because a sound hasn't been
 * hooked up yet.
 */

export interface AudioSink {
  /**
   * Trigger `id`. For a one-shot (`audio.tsv` `loop` column unset) this fires
   * and forgets, and can overlap itself — several hits landing in the same
   * tick each get their own sound. A looping id started this way just plays
   * at its `audio.tsv` volume with no crossfade; use `setMusic` for the
   * layered beds described below.
   */
  play(id: string): void;

  /**
   * design.md §15.4: the ambient bed crossfades to combat music on the same
   * curve the spawn director already climbs, and the boss beat hard-swaps in
   * at 19:00 — a continuous mix, not a track switch. `weights` is `loop id ->
   * 0..1`; a real sink ramps each currently-known loop's gain toward
   * `audio.tsv`'s volume times its weight, calling this every frame with a
   * smoothly changing number is the whole crossfade. IDs with no row, or
   * whose file hasn't decoded yet, are silently skipped — `App` calls this
   * every tick, so a still-loading track catches up on a later call rather
   * than needing its own retry logic.
   */
  setMusic(weights: Readonly<Record<string, number>>): void;

  /** Mute/unmute everything this sink plays. Wired to a dev cheat, not exposed to the player yet. */
  setMuted(muted: boolean): void;
}

export const NULL_AUDIO_SINK: AudioSink = {
  play: () => {},
  setMusic: () => {},
  setMuted: () => {},
};
