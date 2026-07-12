/**
 * Tests for the parts of the engine where a subtle bug is invisible on screen
 * but ruins the feel: the sprite format, the diff renderer, and colour depth.
 *
 * Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { drawBar, drawBox, drawSprite } from '../engine/draw.ts';
import { DEFAULT, detectDepth, parseColor, rgb, type Color } from '../engine/color.ts';
import { Renderer } from '../engine/renderer.ts';
import type { Capabilities, Surface } from '../engine/surface.ts';
import { parseGlyphTable } from '../data/entities.ts';
import { frameAt, parseSprite } from '../assets/sprite.ts';

/** Captures what a real terminal would receive. */
class Capture {
  chunks: string[] = [];
  write(s: string): boolean {
    this.chunks.push(s);
    return true;
  }
  get text(): string {
    return this.chunks.join('');
  }
  reset(): void {
    this.chunks = [];
  }
}

const stream = (c: Capture): NodeJS.WritableStream => c as unknown as NodeJS.WritableStream;

describe('sprite parsing', () => {
  it('pads short art lines out to the declared size', () => {
    // Jane refuses to depend on trailing whitespace surviving git, so `size:`
    // is authoritative and short lines get right-padded.
    const { sprite, warnings } = parseSprite('sprites/x', ['# size: 8x3', '--- art ---', 'ab', 'c', 'd'].join('\n'));
    const f = sprite.frames[0]!;
    assert.equal(f.w, 8);
    assert.equal(f.h, 3);
    assert.deepEqual(warnings, []);
  });

  it('centres the anchor on the declared box, not the trimmed art', () => {
    // This is the bug that would slide every centred sprite half a column off
    // its own world position.
    const { sprite } = parseSprite('sprites/x', ['# size: 16x5', '# anchor: center', '--- art ---', 'ab'].join('\n'));
    assert.equal(sprite.frames[0]!.ox, 8);
    assert.equal(sprite.frames[0]!.oy, 2);
  });

  it('warns when art overflows the declared box', () => {
    const { warnings } = parseSprite('sprites/x', ['# size: 2x1', '--- art ---', 'abcdef'].join('\n'));
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /measures 6x1/);
  });

  it('treats a space in art as transparent', () => {
    const { sprite } = parseSprite('x', ['--- art ---', 'a b'].join('\n'));
    const f = sprite.frames[0]!;
    assert.equal(f.cells[0]!.ch, 'a');
    assert.equal(f.cells[1], null);
    assert.equal(f.cells[2]!.ch, 'b');
  });

  it('is transparent unless the header says otherwise', () => {
    assert.equal(parseSprite('x', ['--- art ---', 'a'].join('\n')).sprite.opaque, false);
    assert.equal(parseSprite('x', ['# opaque: true', '--- art ---', 'a'].join('\n')).sprite.opaque, true);
    assert.equal(parseSprite('x', ['# opaque: no', '--- art ---', 'a'].join('\n')).sprite.opaque, false);
  });

  it('warns on an opaque flag it cannot read, and stays transparent', () => {
    const { sprite, warnings } = parseSprite('x', ['# opaque: sometimes', '--- art ---', 'a'].join('\n'));
    assert.equal(sprite.opaque, false);
    assert.match(warnings[0]!, /not a boolean/);
  });

  it('colours each art cell from the mask column beneath it', () => {
    const src = ['# colour: w', '--- art ---', 'ab', '--- mask ---', 'rG'].join('\n');
    const { sprite } = parseSprite('x', src);
    const f = sprite.frames[0]!;
    assert.equal(f.cells[0]!.fg, 0xb22222); // r
    assert.equal(f.cells[1]!.fg, 0x3aff3a); // G
  });

  it('falls back to the header colour where the mask is blank', () => {
    const src = ['# colour: Y', '--- art ---', 'ab', '--- mask ---', 'r '].join('\n');
    const { sprite } = parseSprite('x', src);
    const f = sprite.frames[0]!;
    assert.equal(f.cells[0]!.fg, 0xb22222);
    assert.equal(f.cells[1]!.fg, 0xffe040); // Y
  });

  it('reads repeated art/mask pairs as animation frames', () => {
    const src = ['# fps: 4', '--- art ---', 'a', '--- mask ---', 'r', '--- art ---', 'b', '--- mask ---', 'G'].join('\n');
    const { sprite } = parseSprite('x', src);
    assert.equal(sprite.frames.length, 2);
    assert.equal(sprite.fps, 4);
    assert.equal(frameAt(sprite, 0).cells[0]!.ch, 'a');
    assert.equal(frameAt(sprite, 0.25).cells[0]!.ch, 'b');
    assert.equal(frameAt(sprite, 0.5).cells[0]!.ch, 'a'); // wraps
  });

  it('tolerates a blank line between the header and the first fence', () => {
    // countess.txt has one, and a header parser that stops at the blank line
    // must still find the fence afterwards.
    const { sprite, warnings } = parseSprite('x', ['# name: q', '', '--- art ---', 'z'].join('\n'));
    assert.equal(sprite.name, 'q');
    assert.equal(sprite.frames[0]!.cells[0]!.ch, 'z');
    assert.deepEqual(warnings, []);
  });

  it('warns when art and mask trim to different heights', () => {
    // The bug this catches: a blank first row in one block trims away, every
    // colour below it slides up a row, and nothing looks wrong until you stare.
    const src = ['--- art ---', 'ab', 'cd', '--- mask ---', 'rr'].join('\n');
    const { warnings } = parseSprite('x', src);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /mask trims to 1 rows but the art trims to 2/);
  });

  it('does not warn when `size:` merely pads the art', () => {
    // The old check compared the mask to the padded box, so it cried wolf here.
    const src = ['# size: 6x4', '--- art ---', 'ab', '--- mask ---', 'rr'].join('\n');
    const { warnings } = parseSprite('x', src);
    assert.deepEqual(warnings, []);
  });

  it('picks the most specific folder budget, not the first that prefixes', () => {
    // `sprites/` would otherwise shadow `sprites/mobs/` and never warn.
    const tooBig = ['# size: 9x5', '--- art ---', ...Array(5).fill('#########')].join('\n');
    const mob = parseSprite('sprites/mobs/ghoul', tooBig).warnings;
    assert.equal(mob.length, 1);
    assert.match(mob[0]!, /over the 5x3 budget/);

    const elite = parseSprite('sprites/elites/gravewarden', tooBig).warnings;
    assert.deepEqual(elite, [], '9x5 is exactly the elite budget');
  });

  it('never throws on garbage, and always returns something drawable', () => {
    for (const bad of ['', '# size: nonsense', '--- art ---', '# colour: ✨', '---']) {
      const { sprite } = parseSprite('x', bad);
      assert.ok(sprite.frames.length >= 1);
      assert.ok(sprite.frames[0]!.cells.length >= 1);
    }
  });
});

describe('glyphs.tsv', () => {
  const src = [
    '# comment',
    '',
    'ghoul\tg\tGhoul\te\t10\t9\t4\t1\t0:00\t1\twalks straight at player',
    'countess\t-\tThe Countess\tR\t9000\t10\t25\t0\t-\t200\tBOSS',
    'decal0\t※\tR\t0\t6',
  ].join('\n');

  it('parses entity rows with mm:ss spawn times', () => {
    const t = parseGlyphTable(src);
    const g = t.entities.get('ghoul')!;
    assert.equal(g.glyph, 'g');
    assert.equal(g.hp, 10);
    assert.equal(g.speed, 9);
    assert.equal(g.from, 0);
    assert.equal(g.notes, 'walks straight at player');
  });

  it('treats `-` spawn time as scripted-only', () => {
    const t = parseGlyphTable(src);
    assert.equal(t.entities.get('countess')!.from, null);
  });

  it('parses the decal decay table', () => {
    const t = parseGlyphTable(src);
    assert.equal(t.decals.length, 1);
    assert.equal(t.decals[0]!.glyph, '※');
    assert.equal(t.decals[0]!.ageTo, 6);
  });
});

describe('renderer', () => {
  it('emits nothing when nothing changed', () => {
    const cap = new Capture();
    const r = new Renderer(10, 3, 'truecolor', stream(cap));

    r.clear();
    r.text(0, 0, 'hello', rgb(255, 0, 0));
    r.flush();
    assert.ok(cap.text.length > 0);

    cap.reset();
    r.clear();
    r.text(0, 0, 'hello', rgb(255, 0, 0));
    const bytes = r.flush();
    assert.equal(bytes, 0, 'an identical frame must produce zero output');
    assert.equal(cap.text, '');
  });

  it('repaints everything after invalidate()', () => {
    const cap = new Capture();
    const r = new Renderer(4, 2, 'truecolor', stream(cap));
    r.clear();
    r.flush();

    cap.reset();
    r.invalidate();
    r.clear();
    assert.ok(r.flush() > 0);
  });

  it('only redraws the cells that actually changed', () => {
    const cap = new Capture();
    const r = new Renderer(20, 2, 'mono', stream(cap));
    r.clear();
    r.text(0, 0, 'aaaaaaaaaaaaaaaaaaaa');
    r.flush();

    cap.reset();
    r.clear();
    r.text(0, 0, 'aaaaaaaaaabaaaaaaaaa');
    r.flush();
    // One cursor move plus the single changed glyph, and nothing else.
    assert.ok(cap.text.includes('b'), 'changed cell must be drawn');
    assert.ok(!cap.text.includes('aa'), `expected a minimal diff, got ${JSON.stringify(cap.text)}`);
  });

  it('drops out-of-bounds writes instead of corrupting the grid', () => {
    const cap = new Capture();
    const r = new Renderer(3, 3, 'mono', stream(cap));
    r.clear();
    assert.doesNotThrow(() => {
      r.set(-5, -5, 'x');
      r.set(99, 99, 'x');
      r.set(1, 1, 'o');
    });
    assert.equal(r.getChar(1, 1), 'o');
  });
});

describe('drawSprite', () => {
  const clip = { x: 0, y: 0, w: 10, h: 5 };

  /** `a a` — three cells wide with a transparent hole in the middle. */
  function holed() {
    return parseSprite('x', ['--- art ---', 'a a'].join('\n')).sprite.frames[0]!;
  }

  function field(): Renderer {
    const r = new Renderer(10, 5, 'truecolor', stream(new Capture()));
    r.clear();
    r.fillRect(0, 0, 10, 5, '#'); // stand in for the horde already on the ground
    return r;
  }

  it('lets the field show through a transparent cell', () => {
    const r = field();
    drawSprite(r, holed(), 1, 0, clip);
    assert.equal(r.getChar(1, 0), '#', 'the hole should not have been painted');
  });

  it('paints the hole when given a fill, so nothing can sit inside the sprite', () => {
    const r = field();
    drawSprite(r, holed(), 1, 0, clip, null, DEFAULT, 0x0a0a0a);
    assert.equal(r.getChar(1, 0), ' ');
    assert.equal(r.getChar(0, 0), 'a', 'the art itself must survive the fill');
    assert.equal(r.getChar(3, 0), '#', 'the fill must not spill past the frame');
  });
});

describe('drawBox', () => {
  /** Just enough `Surface` to see what a call did — no rendering, only bookkeeping. */
  class FakeSurface implements Surface {
    readonly width = 40;
    readonly height = 20;
    readonly caps: Capabilities = { smoothLight: false, subCell: true, raster: true };
    cells = new Map<string, { ch: string; fg?: Color; bg?: Color }>();
    images: { cx: number; cy: number; w: number; h: number }[] = [];

    clear(): void {}
    set(x: number, y: number, ch: string, fg?: Color, bg?: Color): void {
      this.cells.set(`${x},${y}`, { ch, fg, bg });
    }
    setF(x: number, y: number, ch: string, fg?: Color): void {
      this.set(Math.round(x), Math.round(y), ch, fg);
    }
    tint(): void {}
    getChar(x: number, y: number): string {
      return this.cells.get(`${x},${y}`)?.ch ?? ' ';
    }
    text(x: number, y: number, s: string, fg?: Color, bg?: Color): number {
      for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i]!, fg, bg);
      return s.length;
    }
    fillRect(x: number, y: number, w: number, h: number, ch: string, fg?: Color, bg?: Color): void {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch, fg, bg);
    }
    inBounds(): boolean {
      return true;
    }
    invalidate(): void {}
    setLight(): void {}
    drawImage(cx: number, cy: number, _img: CanvasImageSource, wCells: number, hCells: number): void {
      this.images.push({ cx, cy, w: wCells, h: hCells });
    }
    flush(): number {
      return 0;
    }
  }

  it('fills the interior with bg when no panel texture is given — today\'s behaviour, unchanged', () => {
    const r = new FakeSurface();
    drawBox(r, { x: 0, y: 0, w: 5, h: 4 }, 0xffffff, 0x101010, undefined);
    assert.equal(r.images.length, 0, 'no texture, no drawImage call');
    assert.equal(r.cells.get('2,2')?.bg, 0x101010, 'interior cell keeps the given bg');
  });

  it('stretches a panel texture to the box and lets it show through the interior', () => {
    const r = new FakeSurface();
    const img = {} as unknown as CanvasImageSource;
    drawBox(r, { x: 10, y: 5, w: 6, h: 5 }, 0xffffff, 0x101010, undefined, img);

    assert.equal(r.images.length, 1, 'the texture is drawn once, stretched to the rect');
    assert.deepEqual(r.images[0], { cx: 13, cy: 7.5, w: 6, h: 5 });

    // The interior fill is skipped (left DEFAULT) so the texture isn't blotted
    // out by flush()'s buffered background pass later (see canvas.ts/surface.ts).
    assert.equal(r.cells.get('12,7')?.bg, DEFAULT, 'interior cell no longer carries the box bg');
    // The border still does — a solid glyph tile always wins regardless.
    assert.equal(r.cells.get('10,5')?.bg, 0x101010, 'border corner keeps the given bg');
  });
});

describe('drawBar', () => {
  // Reported by the owner as a hard crash mid-run:
  //   TypeError: Cannot read properties of undefined (reading 'codePointAt')
  //     at Renderer.flush
  // `rem = Math.round(frac * 8)` returns 8 once the fractional part reaches
  // 0.9375, and EIGHTHS only has indices 0..7.
  function bar(fraction: number, w = 10): Renderer {
    const r = new Renderer(w + 2, 1, 'mono', stream(new Capture()));
    r.clear();
    drawBar(r, 0, 0, w, fraction, 0xffffff, 0x333333);
    return r;
  }

  it('never writes an undefined glyph, at any fraction', () => {
    for (let i = 0; i <= 2000; i++) {
      const r = bar(i / 2000);
      for (let x = 0; x < 10; x++) {
        assert.equal(typeof r.getChar(x, 0), 'string', `fraction ${i / 2000} produced a hole at x=${x}`);
      }
    }
  });

  it('survives a flush at the fraction that used to crash', () => {
    assert.doesNotThrow(() => bar(0.994).flush());
  });

  it('carries eight eighths into a whole block', () => {
    // 0.994 * 10 = 9.94 -> floor 9, rem round(0.94*8) = 8. That is ten blocks.
    const r = bar(0.994);
    assert.equal(r.getChar(9, 0), '█', 'the last cell is full, not a ninth eighth');
  });

  it('still draws partial blocks in between', () => {
    const r = bar(0.55); // 5.5 cells -> five full, then a half block
    assert.equal(r.getChar(4, 0), '█');
    assert.equal(r.getChar(5, 0), '▌');
  });

  it('clamps fractions outside 0..1', () => {
    assert.doesNotThrow(() => bar(-5).flush());
    assert.doesNotThrow(() => bar(99).flush());
    assert.equal(bar(2).getChar(9, 0), '█', 'a full bar is full');
  });

  it('ignores NaN coordinates rather than indexing the grid with them', () => {
    const r = new Renderer(4, 2, 'mono', stream(new Capture()));
    r.clear();
    assert.doesNotThrow(() => {
      r.set(NaN, 0, 'x');
      r.set(0, NaN, 'x');
      r.set(Infinity, Infinity, 'x');
    });
    assert.doesNotThrow(() => r.flush());
  });
});

describe('colour', () => {
  it('parses names, hex, and Jane 3-digit shorthand', () => {
    assert.equal(parseColor('red'), 0xcd0000);
    assert.equal(parseColor('#ff8800'), 0xff8800);
    assert.equal(parseColor('#f80'), 0xff8800);
    assert.equal(parseColor('nonsense'), null);
  });

  it('honours NO_COLOR and FORCE_COLOR', () => {
    assert.equal(detectDepth({ NO_COLOR: '1' }), 'mono');
    assert.equal(detectDepth({ FORCE_COLOR: '3' }), 'truecolor');
    assert.equal(detectDepth({ COLORTERM: 'truecolor' }), 'truecolor');
    assert.equal(detectDepth({ TERM: 'xterm-256color' }), 'ansi256');
    assert.equal(detectDepth({ TERM: 'dumb' }), 'mono');
  });
});
