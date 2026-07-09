/**
 * Fixed-timestep game loop with a decoupled render.
 *
 * Simulation runs at a fixed 60Hz so physics, spawn timers and damage ticks are
 * deterministic and framerate-independent (important: a seeded run should play
 * out identically). Rendering happens once per wake-up, no more often than the
 * target frame rate.
 *
 * If the process stalls (terminal blocked, GC pause), we cap how many catch-up
 * steps we run. Otherwise a long stall makes the sim try to simulate all the
 * missed time at once, which takes even longer, which misses more time — the
 * classic spiral of death.
 */

import { MAX_CATCHUP_STEPS, TICK_DT, TICK_MS } from './tick.ts';

export { TICK_DT, TICK_HZ, TICK_MS } from './tick.ts';

export type LoopCallbacks = {
  /** Advance the simulation by exactly `dt` seconds. */
  update(dt: number): void;
  /** Draw. `alpha` is the 0..1 interpolation factor into the next tick. */
  render(alpha: number): void;
  /** Return true to stop the loop. Checked once per wake-up. */
  shouldStop(): boolean;
};

export class GameLoop {
  private readonly cb: LoopCallbacks;
  private readonly frameMs: number;

  private running = false;
  private accumulator = 0;
  private last = 0;
  private timer: NodeJS.Timeout | null = null;

  // Rolling stats, surfaced by the debug overlay.
  private fpsSamples: number[] = [];
  private _fps = 0;
  private _tickCount = 0;

  constructor(cb: LoopCallbacks, targetFps = 60) {
    this.cb = cb;
    this.frameMs = 1000 / targetFps;
  }

  get fps(): number {
    return this._fps;
  }

  get ticks(): number {
    return this._tickCount;
  }

  start(): Promise<void> {
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;

    return new Promise<void>((resolve) => {
      const step = (): void => {
        if (!this.running || this.cb.shouldStop()) {
          this.stop();
          resolve();
          return;
        }

        const now = performance.now();
        let elapsed = now - this.last;
        this.last = now;

        // Track instantaneous FPS over a short window.
        if (elapsed > 0) {
          this.fpsSamples.push(1000 / elapsed);
          if (this.fpsSamples.length > 30) this.fpsSamples.shift();
          this._fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
        }

        // Clamp: a huge elapsed means we were suspended (laptop lid, SIGSTOP).
        // Pretend no time passed rather than fast-forwarding the whole run.
        if (elapsed > MAX_CATCHUP_STEPS * TICK_MS) elapsed = TICK_MS;

        this.accumulator += elapsed;

        let steps = 0;
        while (this.accumulator >= TICK_MS && steps < MAX_CATCHUP_STEPS) {
          this.cb.update(TICK_DT);
          this.accumulator -= TICK_MS;
          this._tickCount++;
          steps++;
        }

        this.cb.render(this.accumulator / TICK_MS);

        // Sleep the remainder of the frame. setTimeout's floor is ~1ms, which
        // is fine: we want to yield the CPU, not busy-wait a terminal game.
        const spent = performance.now() - now;
        const delay = Math.max(1, this.frameMs - spent);
        this.timer = setTimeout(step, delay);
      };

      step();
    });
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
