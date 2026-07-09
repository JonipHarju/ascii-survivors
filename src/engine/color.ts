/**
 * Color handling.
 *
 * A color is just an RGB int (0xRRGGBB), or DEFAULT for "terminal's default".
 * We resolve down to whatever escape codes the terminal actually supports at
 * startup, so art authored in truecolor still looks sane on a 16-color TTY.
 */

export type Color = number;

/** Sentinel meaning "don't emit a color, use the terminal default". */
export const DEFAULT: Color = -1;

export type ColorDepth = 'truecolor' | 'ansi256' | 'ansi16' | 'mono';

export function rgb(r: number, g: number, b: number): Color {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

const R = (c: Color): number => (c >> 16) & 0xff;
const G = (c: Color): number => (c >> 8) & 0xff;
const B = (c: Color): number => c & 0xff;

/**
 * The 16 classic ANSI colors, as the values most terminals actually render.
 * Index is the ANSI index (0-7 normal, 8-15 bright).
 */
const ANSI16: readonly Color[] = [
  0x000000, 0xcd0000, 0x00cd00, 0xcdcd00, 0x0000ee, 0xcd00cd, 0x00cdcd, 0xe5e5e5,
  0x7f7f7f, 0xff0000, 0x00ff00, 0xffff00, 0x5c5cff, 0xff00ff, 0x00ffff, 0xffffff,
];

const NAMES: Readonly<Record<string, Color>> = {
  black: ANSI16[0]!,
  red: ANSI16[1]!,
  green: ANSI16[2]!,
  yellow: ANSI16[3]!,
  blue: ANSI16[4]!,
  magenta: ANSI16[5]!,
  cyan: ANSI16[6]!,
  white: ANSI16[7]!,
  bright_black: ANSI16[8]!,
  bright_red: ANSI16[9]!,
  bright_green: ANSI16[10]!,
  bright_yellow: ANSI16[11]!,
  bright_blue: ANSI16[12]!,
  bright_magenta: ANSI16[13]!,
  bright_cyan: ANSI16[14]!,
  bright_white: ANSI16[15]!,
  // A few aliases that art authors reach for.
  grey: ANSI16[8]!,
  gray: ANSI16[8]!,
  orange: 0xff8700,
  purple: 0x8700d7,
  pink: 0xff87d7,
  brown: 0x875f00,
};

/**
 * Parse a color from a sprite header: a name, or `#rgb` / `#rrggbb` hex.
 * Returns null when we don't recognize it, so the caller can warn rather than
 * silently paint something wrong.
 */
export function parseColor(raw: string): Color | null {
  const s = raw.trim().toLowerCase();
  if (s === '' || s === 'default') return DEFAULT;

  const named = NAMES[s];
  if (named !== undefined) return named;

  const hex = s.startsWith('#') ? s.slice(1) : s;
  if (/^[0-9a-f]{6}$/.test(hex)) return parseInt(hex, 16);
  if (/^[0-9a-f]{3}$/.test(hex)) {
    // #abc -> #aabbcc
    const r = parseInt(hex[0]! + hex[0]!, 16);
    const g = parseInt(hex[1]! + hex[1]!, 16);
    const b = parseInt(hex[2]! + hex[2]!, 16);
    return rgb(r, g, b);
  }
  return null;
}

export function colorNames(): string[] {
  return Object.keys(NAMES);
}

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * Read the process environment without assuming there is one. This module is
 * shared with the browser build, where `process` does not exist.
 */
function ambientEnv(): Env {
  const p = (globalThis as { process?: { env?: Env } }).process;
  return p?.env ?? {};
}

/** Detect what the current terminal can do. Honors FORCE_COLOR / NO_COLOR. */
export function detectDepth(env: Env = ambientEnv()): ColorDepth {
  if (env['NO_COLOR'] !== undefined && env['NO_COLOR'] !== '') return 'mono';

  const forced = env['FORCE_COLOR'];
  if (forced !== undefined) {
    if (forced === '0' || forced === 'false') return 'mono';
    if (forced === '1') return 'ansi16';
    if (forced === '2') return 'ansi256';
    if (forced === '3' || forced === 'true') return 'truecolor';
  }

  const colorterm = (env['COLORTERM'] ?? '').toLowerCase();
  if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor';

  const term = (env['TERM'] ?? '').toLowerCase();
  if (term === 'dumb' || term === '') return 'mono';
  if (term.includes('direct')) return 'truecolor';
  if (term.includes('256')) return 'ansi256';
  if (/screen|xterm|vt100|color|ansi|cygwin|linux|tmux|rxvt/.test(term)) return 'ansi16';
  return 'ansi16';
}

/** Squared distance in RGB. Crude but plenty good for quantizing 16 buckets. */
function dist2(a: Color, b: Color): number {
  const dr = R(a) - R(b);
  const dg = G(a) - G(b);
  const db = B(a) - B(b);
  return dr * dr + dg * dg + db * db;
}

function toAnsi16(c: Color): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < 16; i++) {
    const d = dist2(c, ANSI16[i]!);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Map RGB into the xterm-256 cube (or its grayscale ramp, whichever is closer). */
function toAnsi256(c: Color): number {
  const r = R(c);
  const g = G(c);
  const b = B(c);

  // Grayscale ramp: indices 232..255.
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return 232 + Math.round(((r - 8) / 247) * 24);
  }

  // 6x6x6 color cube: indices 16..231.
  const q = (v: number): number => (v < 48 ? 0 : v < 114 ? 1 : Math.min(5, Math.round((v - 35) / 40)));
  return 16 + 36 * q(r) + 6 * q(g) + q(b);
}

/**
 * Build the SGR *parameters* (not the full escape) for a foreground color.
 * Kept as a factory so the depth lookup happens once at startup, not per cell.
 */
export function makeFgEncoder(depth: ColorDepth): (c: Color) => string {
  switch (depth) {
    case 'truecolor':
      return (c) => `38;2;${R(c)};${G(c)};${B(c)}`;
    case 'ansi256':
      return (c) => `38;5;${toAnsi256(c)}`;
    case 'ansi16':
      return (c) => {
        const i = toAnsi16(c);
        return i < 8 ? `${30 + i}` : `${90 + (i - 8)}`;
      };
    case 'mono':
      return () => '';
  }
}

export function makeBgEncoder(depth: ColorDepth): (c: Color) => string {
  switch (depth) {
    case 'truecolor':
      return (c) => `48;2;${R(c)};${G(c)};${B(c)}`;
    case 'ansi256':
      return (c) => `48;5;${toAnsi256(c)}`;
    case 'ansi16':
      return (c) => {
        const i = toAnsi16(c);
        return i < 8 ? `${40 + i}` : `${100 + (i - 8)}`;
      };
    case 'mono':
      return () => '';
  }
}

/** Linear blend, t=0 gives a, t=1 gives b. Used for flashes and fades. */
export function mix(a: Color, b: Color, t: number): Color {
  if (a === DEFAULT || b === DEFAULT) return t < 0.5 ? a : b;
  const k = Math.max(0, Math.min(1, t));
  return rgb(
    Math.round(R(a) + (R(b) - R(a)) * k),
    Math.round(G(a) + (G(b) - G(a)) * k),
    Math.round(B(a) + (B(b) - B(a)) * k),
  );
}

/** Scale brightness. Handy for depth-cueing and damage flashes. */
export function shade(c: Color, factor: number): Color {
  if (c === DEFAULT) return c;
  const f = Math.max(0, factor);
  return rgb(
    Math.min(255, Math.round(R(c) * f)),
    Math.min(255, Math.round(G(c) * f)),
    Math.min(255, Math.round(B(c) * f)),
  );
}
