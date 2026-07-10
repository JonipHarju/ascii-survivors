/**
 * Sprite model + parser for Jane's `.txt` art files.
 *
 * The format is Jane's, defined in `assets/README.md`. She'd already drawn six
 * files in it by the time I finished my own proposal, and hers is better where
 * they differ: a separate colour *mask* laid over the art beats my per-glyph
 * `paint:` map, because it lets the same glyph be two colours in one sprite.
 *
 *   # name: The Countess
 *   # size: 16x5
 *   # anchor: center
 *   # colour: R
 *   --- art ---
 *     \\   ^^^   //
 *    \ \ ( o o ) / /
 *   --- mask ---
 *     ee   YYY   ee
 *    e e e R R e e e
 *
 * Two extensions I added on top, both backward-compatible:
 *
 *  - **Animation.** Repeat the `--- art ---` (+ optional `--- mask ---`) pair
 *    and each becomes a frame; `# fps: 8` sets the rate. Jane's format had no
 *    way to animate and the Countess will want it.
 *  - **Fence-free files.** A file with no `--- art ---` fence is treated as one
 *    art block. Cheap to support, and it means a throwaway sprite is just a
 *    few lines of text.
 *
 * Parsing never throws. Bad input yields warnings plus a best-effort sprite,
 * because a typo in an art file must never take the game down mid-run.
 */

import { DEFAULT, parseColor, type Color } from '../engine/color.ts';
import { isWide } from '../engine/text.ts';

/**
 * Jane's colour palette (assets/README.md). Lowercase normal, uppercase bright.
 * Values are tuned to look right in truecolor; the renderer quantizes down.
 */
const PALETTE: Readonly<Record<string, Color>> = {
  k: 0x101010, // black
  e: 0x7f7f7f, // grey (dim)
  w: 0xc7c7c7, // white
  W: 0xffffff, // bright white — reserved for the player
  r: 0xb22222, // red
  R: 0xff3b3b, // bright red
  g: 0x00a000, // green
  G: 0x3aff3a, // bright green
  y: 0xb8a000, // yellow
  Y: 0xffe040, // bright yellow
  b: 0x2c4bd8, // blue
  B: 0x6f8dff, // bright blue
  m: 0xa020a0, // magenta
  M: 0xff5cff, // bright magenta
  c: 0x00a0a0, // cyan
  C: 0x4ff0f0, // bright cyan
  s: 0xc2b280, // "bone" — dim sandy yellow
  d: 0x5a1616, // "dried blood" — the floor. Jane asked; the ramp jumped r -> k.
};

/**
 * Per-folder size budgets. Advisory: we warn, never clip — which is why the
 * canvas pivot cost Jane nothing when the Countess grew from 16x5 to 28x11.
 *
 * Ordered **specific-first**, because the lookup takes the first prefix match
 * and `sprites/` would otherwise shadow `sprites/mobs/`.
 */
const SIZE_BUDGET: ReadonlyArray<readonly [prefix: string, w: number, h: number]> = [
  ['sprites/mobs/', 5, 3],
  ['sprites/elites/', 9, 5],
  ['sprites/', 28, 11], // player + boss
  ['portraits/', 20, 8],
  ['cards/', 12, 5],
  ['ui/', 78, 20],
];

/** Absolute sanity ceiling. Past this something is wrong with the file. */
const HARD_MAX_W = 200;
const HARD_MAX_H = 60;

const FENCE = /^---\s*([a-z]+)\s*---$/i;
const BARE_SEPARATOR = '---';

export type Anchor = 'center' | 'topleft' | 'bottom';

export type SpriteCell = {
  readonly ch: string;
  readonly fg: Color;
};

export type Frame = {
  readonly w: number;
  readonly h: number;
  /** Row-major, length w*h. `null` means transparent. */
  readonly cells: readonly (SpriteCell | null)[];
  /** Cell within the frame that sits on the entity's world position. */
  readonly ox: number;
  readonly oy: number;
};

export type Sprite = {
  readonly id: string;
  readonly name: string;
  readonly fps: number;
  readonly anchor: Anchor;
  readonly frames: readonly Frame[];
  /**
   * `# opaque: true` — the sprite's transparent cells are painted with the
   * background instead of letting the field show through, so nothing can be
   * drawn *inside* the silhouette.
   *
   * Transparency is right for every monster and wrong for exactly one sprite:
   * at a glance a ghoul's `(` in the gap between the player's boots reads as
   * part of the player. jane.md [28].
   */
  readonly opaque: boolean;
  /** Unrecognized header keys, kept verbatim so Jane can annotate freely. */
  readonly meta: Readonly<Record<string, string>>;
  /** True when this was synthesized because no art file existed. */
  readonly placeholder: boolean;
};

export type ParseResult = {
  sprite: Sprite;
  warnings: string[];
};

/**
 * A palette letter, or `#rrggbb` for a colour the 16-letter ramp hasn't got.
 *
 * The letters are the vocabulary — one hue, one meaning, per design.md §9 — and
 * they should stay the common case. But the ramp jumps straight from `r`
 * (#b22222) to `k` (#101010) with nothing in between, and the floor wants the
 * maroons that live in that gap. Escaping to hex beats Jane filing a ticket for
 * every shade.
 */
export function paletteColor(ch: string): Color | undefined {
  const p = PALETTE[ch];
  if (p !== undefined) return p;
  if (!ch.startsWith('#')) return undefined;
  return parseColor(ch) ?? undefined;
}

/** Visible width of a line in terminal columns. */
function lineWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += isWide(ch.codePointAt(0)!) ? 2 : 1;
  return w;
}

function parseAnchor(raw: string, warn: (m: string) => void): Anchor {
  const s = raw.trim().toLowerCase();
  if (s === 'center' || s === 'centre') return 'center';
  if (s === 'topleft' || s === 'bottom') return s;
  warn(`anchor: unknown value '${s}', using 'center'`);
  return 'center';
}

/** Header booleans. Absent is false; anything unrecognized warns and is false. */
function parseBool(raw: string | undefined, warn: (m: string) => void): boolean {
  if (raw === undefined) return false;
  const s = raw.trim().toLowerCase();
  if (s === 'true' || s === 'yes' || s === '1') return true;
  if (s === 'false' || s === 'no' || s === '0' || s === '') return false;
  warn(`opaque: '${raw}' is not a boolean, using false`);
  return false;
}

/** Resolve `# colour:` — a palette letter, a colour name, or hex. */
function parseHeaderColor(raw: string, warn: (m: string) => void): Color {
  const s = raw.trim();
  if (s.length === 1) {
    const p = PALETTE[s];
    if (p !== undefined) return p;
  }
  const c = parseColor(s);
  if (c !== null) return c;
  warn(`colour: unknown value '${s}', using white`);
  return PALETTE['w']!;
}

function anchorOffset(w: number, h: number, anchor: Anchor): { ox: number; oy: number } {
  switch (anchor) {
    case 'topleft':
      return { ox: 0, oy: 0 };
    case 'bottom':
      return { ox: Math.floor(w / 2), oy: h - 1 };
    case 'center':
      return { ox: Math.floor(w / 2), oy: Math.floor(h / 2) };
  }
}

/** Drop leading/trailing all-blank lines; keep interior ones. */
function trimBlankEdges(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a]!.trim() === '') a++;
  while (b > a && lines[b - 1]!.trim() === '') b--;
  return lines.slice(a, b);
}

/**
 * Overlay `mask` onto `art`. A space in art is transparent; a space (or absent
 * cell) in the mask means "use the sprite's default colour".
 *
 * Note we index the mask by *column*, matching how Jane draws it — she lines the
 * mask up under the art visually, so column N of the mask colours column N of
 * the art. Wide glyphs would break that correspondence, so we don't allow them
 * to consume mask columns.
 */
function buildFrame(
  art: readonly string[],
  mask: readonly string[] | null,
  anchor: Anchor,
  defaultColor: Color,
  declared: { w: number; h: number } | null,
  warn: (m: string) => void,
): Frame {
  // `size: WxH` is authoritative (assets/README.md): art lines may be short and
  // get right-padded. This matters for `anchor: center` — measuring the trimmed
  // art instead would slide the sprite half a column off its own world position.
  const measuredH = art.length;
  const measuredW = art.reduce((m, l) => Math.max(m, lineWidth(l)), 0);
  const h = Math.max(measuredH, declared?.h ?? 0);
  const w = Math.max(measuredW, declared?.w ?? 0);
  const cells: (SpriteCell | null)[] = new Array(w * h).fill(null);

  // Compare against the ART's row count, not the padded box. Comparing to `h`
  // fired whenever `size:` was taller than the art — a false alarm — while the
  // real fault it should catch is art and mask trimming to different heights,
  // which silently slides every colour below the missing row up by one.
  if (mask !== null && mask.length !== measuredH) {
    warn(`mask trims to ${mask.length} rows but the art trims to ${measuredH} — colours will be off by a row`);
  }

  for (let y = 0; y < h; y++) {
    const artLine = art[y] ?? ''; // padded row
    const maskLine = mask?.[y] ?? '';
    const maskChars = Array.from(maskLine);

    let x = 0;
    for (const ch of artLine) {
      if (x >= w) break;
      if (ch === ' ') {
        x += 1;
        continue; // transparent
      }

      const maskCh = maskChars[x];
      let fg = defaultColor;
      if (maskCh !== undefined && maskCh !== ' ') {
        const p = PALETTE[maskCh];
        if (p === undefined) warn(`mask: unknown palette char '${maskCh}' at row ${y + 1}, col ${x + 1}`);
        else fg = p;
      }

      cells[y * w + x] = { ch, fg };
      x += isWide(ch.codePointAt(0)!) ? 2 : 1;
    }
  }

  const { ox, oy } = anchorOffset(w, h, anchor);
  return { w, h, cells, ox, oy };
}

type Block = { kind: string; lines: string[] };

/** Split a body into `--- name ---` blocks. No fences => one implicit art block. */
function splitBlocks(body: string[]): Block[] {
  const hasFence = body.some((l) => FENCE.test(l.trim()));

  if (!hasFence) {
    // Fence-free: bare `---` lines separate animation frames.
    const blocks: Block[] = [{ kind: 'art', lines: [] }];
    for (const line of body) {
      if (line.trim() === BARE_SEPARATOR) blocks.push({ kind: 'art', lines: [] });
      else blocks[blocks.length - 1]!.lines.push(line);
    }
    return blocks;
  }

  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of body) {
    const m = FENCE.exec(line.trim());
    if (m !== null) {
      current = { kind: m[1]!.toLowerCase(), lines: [] };
      blocks.push(current);
      continue;
    }
    // Anything before the first fence is preamble; ignore it.
    if (current !== null) current.lines.push(line);
  }
  return blocks;
}

function checkBudget(id: string, w: number, h: number, warn: (m: string) => void): void {
  const budget = SIZE_BUDGET.find(([prefix]) => id.startsWith(prefix));
  if (budget === undefined) return;
  const [, maxW, maxH] = budget;
  if (w > maxW || h > maxH) {
    warn(`is ${w}x${h}, over the ${maxW}x${maxH} budget for ${budget[0]} — drawing it anyway`);
  }
}

export function parseSprite(id: string, source: string): ParseResult {
  const warnings: string[] = [];
  const warn = (m: string): void => {
    warnings.push(`${id}: ${m}`);
  };

  const rawLines = source.split(/\r?\n/);

  // --- header: leading `# key: value` lines ---
  const header = new Map<string, string>();
  let i = 0;
  while (i < rawLines.length && rawLines[i]!.startsWith('#')) {
    const line = rawLines[i]!.slice(1);
    const colon = line.indexOf(':');
    if (colon > 0) header.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
    i++;
  }

  const known = new Set(['name', 'fps', 'anchor', 'colour', 'color', 'size', 'opaque']);
  const meta: Record<string, string> = {};
  for (const [k, v] of header) if (!known.has(k)) meta[k] = v;

  const anchor = header.has('anchor') ? parseAnchor(header.get('anchor')!, warn) : 'center';
  const opaque = parseBool(header.get('opaque'), warn);

  const colourRaw = header.get('colour') ?? header.get('color');
  const defaultColor = colourRaw !== undefined ? parseHeaderColor(colourRaw, warn) : PALETTE['w']!;

  let fps = 0;
  const fpsRaw = header.get('fps');
  if (fpsRaw !== undefined) {
    const n = Number.parseFloat(fpsRaw);
    if (Number.isFinite(n) && n >= 0) fps = n;
    else warn(`fps: '${fpsRaw}' is not a number`);
  }

  // `size: WxH` — the box the art is drawn inside, not necessarily its extent.
  let declared: { w: number; h: number } | null = null;
  const sizeRaw = header.get('size');
  if (sizeRaw !== undefined) {
    const m = /^(\d+)\s*x\s*(\d+)$/i.exec(sizeRaw.trim());
    if (m === null) warn(`size: '${sizeRaw}' is not WxH`);
    else declared = { w: Number.parseInt(m[1]!, 10), h: Number.parseInt(m[2]!, 10) };
  }

  // --- body: art / mask blocks ---
  const blocks = splitBlocks(rawLines.slice(i));

  // Pair each art block with the mask block that follows it, if any.
  const frames: Frame[] = [];
  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b]!;
    if (block.kind !== 'art') {
      if (block.kind !== 'mask') warn(`unknown block '--- ${block.kind} ---', ignored`);
      continue;
    }

    const art = trimBlankEdges(block.lines);
    if (art.length === 0) continue;

    const next = blocks[b + 1];
    // Jane trims her masks the same way she trims her art, so trim both
    // identically or the rows drift out of alignment.
    const mask = next !== undefined && next.kind === 'mask' ? trimBlankEdges(next.lines) : null;

    const measuredW = art.reduce((m, l) => Math.max(m, lineWidth(l)), 0);
    if (art.length > HARD_MAX_H || measuredW > HARD_MAX_W) {
      warn(`frame is implausibly large, skipped`);
      continue;
    }

    // Only an *overflow* is a problem. Short lines are expected: Jane refuses to
    // rely on trailing whitespace surviving git, and she's right to.
    if (declared !== null && (measuredW > declared.w || art.length > declared.h)) {
      warn(`declares size ${declared.w}x${declared.h} but the art measures ${measuredW}x${art.length}`);
    }

    frames.push(buildFrame(art, mask, anchor, defaultColor, declared, warn));
  }

  if (frames.length === 0) {
    warn('no art found in file — using a placeholder');
    return { sprite: placeholderSprite(id), warnings };
  }

  const f0 = frames[0]!;
  checkBudget(id, f0.w, f0.h, warn);

  if (fps > 0 && frames.length === 1) warn(`fps: ${fps} set but the sprite has only one frame`);

  return {
    sprite: {
      id,
      name: header.get('name') ?? id,
      fps: frames.length > 1 ? fps : 0,
      anchor,
      frames,
      opaque,
      meta,
      placeholder: false,
    },
    warnings,
  };
}

/**
 * A stand-in for art that doesn't exist yet. This is what lets the whole game
 * run against a half-finished assets/ folder, so Jane and I never block on
 * each other: I can reference `ui/title` before she's drawn it.
 */
export function placeholderSprite(id: string, ch?: string, fg: Color = DEFAULT): Sprite {
  const base = id.split('/').pop() ?? id;
  const glyph = ch ?? (base[0] ?? '?').toUpperCase();
  return {
    id,
    name: base,
    fps: 0,
    anchor: 'center',
    frames: [{ w: 1, h: 1, cells: [{ ch: glyph, fg }], ox: 0, oy: 0 }],
    opaque: false,
    meta: {},
    placeholder: true,
  };
}

/** Pick the frame to show at time `t` seconds. `offset` de-syncs identical entities. */
export function frameAt(sprite: Sprite, t: number, offset = 0): Frame {
  const n = sprite.frames.length;
  if (n === 1 || sprite.fps <= 0) return sprite.frames[0]!;
  const idx = ((Math.floor(t * sprite.fps + offset) % n) + n) % n;
  return sprite.frames[idx]!;
}
