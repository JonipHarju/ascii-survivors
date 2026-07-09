/**
 * The fixed timestep, shared by the terminal loop and the browser's rAF loop.
 *
 * The simulation always advances in these increments so a seeded run plays out
 * identically regardless of how fast the display happens to refresh.
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
export const TICK_DT = 1 / TICK_HZ;

/** Never run more than this many sim steps in one wake-up (spiral-of-death guard). */
export const MAX_CATCHUP_STEPS = 5;
