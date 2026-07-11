/**
 * Browser `AudioSink`, backed by the Web Audio API rather than `<audio>` tags.
 *
 * Why not `<audio>`: a hit lands on several enemies inside the same tick late
 * in a run, and an `<audio>` element can only play one thing at a time — the
 * second hit would cut the first off. `AudioBufferSourceNode` is fire-and-
 * forget; a dozen can overlap for free, which is what "250 enemies on screen"
 * actually needs. And `setMusic` (design.md §15.4's ambient-to-combat
 * crossfade) needs two loops mixing simultaneously, which a single `<audio>`
 * tag can't do at all.
 *
 * Decoding is lazy and cached per path (several ids can share a file) and
 * nothing here ever awaits inside a call from `App` — a sound or a music bed
 * whose file hasn't finished decoding yet is silently skipped for that call,
 * same "never block a frame" rule as `WebImageSource`. `App` calls both
 * `play()` and `setMusic()` every tick it's relevant, so a still-decoding
 * track just catches up on a later call.
 */

import type { AudioTable } from '../data/audio.ts';
import type { AudioSink } from '../engine/audio.ts';

/** How long a `setMusic` weight change takes to land. Long enough to not zipper, short enough to track the spawn director's own ramp. */
const CROSSFADE_S = 0.6;

export class WebAudioSink implements AudioSink {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly table: AudioTable;
  private readonly baseUrl: string;

  /** path -> decoded buffer, or a promise while it's in flight. Shared across ids that point at the same file. */
  private readonly buffers = new Map<string, AudioBuffer | Promise<AudioBuffer | null>>();
  /** id -> the currently-playing loop source. Populated the first time `setMusic` sees that id with decoded audio. */
  private readonly activeMusic = new Map<string, GainNode>();

  constructor(table: AudioTable, baseUrl: string) {
    this.table = table;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor!();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);

    // Kick decoding off early for every loop bed, so by the time the spawn
    // director's pressure actually calls for combat music, it's not waiting
    // on a fetch. One-shots decode lazily, on their first play().
    for (const entry of table.byId.values()) if (entry.loop) this.getBuffer(entry.path);
  }

  /**
   * Browsers refuse to run an `AudioContext` before a user gesture. `boot.ts`
   * calls this from the first keydown/click; calling it any other time (or
   * more than once) is harmless.
   */
  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.master.gain.value = muted ? 0 : 1;
  }

  play(id: string): void {
    const entry = this.table.byId.get(id);
    if (entry === undefined) return; // no row for this event yet — silence, not an error

    const buf = this.getBuffer(entry.path);
    if (buf === undefined) return; // still decoding; this call missed the boat

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = entry.loop;

    const gain = this.ctx.createGain();
    gain.gain.value = entry.volume;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  setMusic(weights: Readonly<Record<string, number>>): void {
    const now = this.ctx.currentTime;

    for (const [id, rawWeight] of Object.entries(weights)) {
      const weight = Math.max(0, Math.min(1, rawWeight));
      const entry = this.table.byId.get(id);
      if (entry === undefined) continue;

      const active = this.activeMusic.get(id);
      if (active !== undefined) {
        active.gain.linearRampToValueAtTime(entry.volume * weight, now + CROSSFADE_S);
        continue;
      }

      const buf = this.getBuffer(entry.path);
      if (buf === undefined) continue; // still decoding — App calls setMusic every tick, it'll catch up

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      // Start silent and ramp in, even for the first frame it's heard: a hard
      // jump-to-volume on a freshly started loop is audible as a click.
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(entry.volume * weight, now + CROSSFADE_S);
      src.connect(gain);
      gain.connect(this.master);
      src.start();
      this.activeMusic.set(id, gain);
    }
  }

  /** Synchronous cache lookup; kicks off (and caches) a decode on first miss. */
  private getBuffer(path: string): AudioBuffer | undefined {
    const cached = this.buffers.get(path);
    if (cached instanceof Promise || cached === undefined) {
      if (cached === undefined) {
        const pending = this.decode(path);
        this.buffers.set(path, pending);
        void pending.then((buf) => {
          // Resolve to the real buffer, or drop the cache entry entirely so a
          // later retry (a flaky fetch) can still succeed.
          if (buf !== null) this.buffers.set(path, buf);
          else this.buffers.delete(path);
        });
      }
      return undefined;
    }
    return cached;
  }

  private async decode(path: string): Promise<AudioBuffer | null> {
    try {
      const url = `${this.baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(bytes);
    } catch {
      return null; // a bad file must cost one sound, never the run
    }
  }
}
