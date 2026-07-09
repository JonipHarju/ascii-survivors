/**
 * Tests for the parts of the engine where a subtle bug is invisible on screen
 * but ruins the feel: the sprite format, the diff renderer, and colour depth.
 *
 * Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectDepth, parseColor, rgb } from '../engine/color.ts';
import { Renderer } from '../engine/renderer.ts';
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
