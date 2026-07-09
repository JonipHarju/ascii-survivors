/**
 * Tests for the canvas backend, driven against a stubbed 2D context.
 *
 * We can't assert pixels headlessly, but every bug I actually care about here is
 * a bookkeeping bug: wrong grid size, glyphs drawn at the wrong cell, the glyph
 * cache thrashing, the lantern surviving a `clear()`. Those are all observable
 * from the sequence of context calls.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { CanvasSurface } from '../web/canvas.ts';

type DrawCall = { x: number; y: number; w: number; h: number };

class StubContext {
  fillStyle = '';
  font = '';
  textAlign = '';
  textBaseline = '';
  shadowColor = '';
  shadowBlur = 0;

  fillRects: DrawCall[] = [];
  drawImages: DrawCall[] = [];
  gradients = 0;
  texts: string[] = [];

  setTransform(): void {}
  scale(): void {}
  fillText(s: string): void {
    this.texts.push(s);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.fillRects.push({ x, y, w, h });
  }
  drawImage(_img: unknown, x: number, y: number, w: number, h: number): void {
    this.drawImages.push({ x, y, w, h });
  }
  createRadialGradient(): { addColorStop(): void } {
    this.gradients++;
    return { addColorStop: () => {} };
  }
}

/** Every `document.createElement('canvas')` is one glyph tile being rasterized. */
let tilesCreated = 0;

class StubCanvas {
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  ctx = new StubContext();
  clientWidth: number;
  clientHeight: number;

  constructor(clientWidth = 0, clientHeight = 0) {
    this.clientWidth = clientWidth;
    this.clientHeight = clientHeight;
  }

  getContext(): StubContext {
    return this.ctx;
  }
}

function install(): void {
  tilesCreated = 0;
  const g = globalThis as unknown as Record<string, unknown>;
  g['devicePixelRatio'] = 1;
  g['innerWidth'] = 800;
  g['innerHeight'] = 600;
  g['document'] = {
    createElement(tag: string) {
      assert.equal(tag, 'canvas');
      tilesCreated++;
      return new StubCanvas();
    },
  };
}

/** Cell is 10 wide, 20 tall -> a 40x15 grid inside 400x300 css pixels. */
function makeSurface(cssW = 400, cssH = 300) {
  const canvas = new StubCanvas(cssW, cssH);
  const box = { width: cssW, height: cssH };
  const surface = new CanvasSurface(canvas as unknown as HTMLCanvasElement, {
    cellWidth: 10,
    glow: 0,
    background: 0x000000,
    measure: () => box,
  });
  return { surface, canvas, ctx: canvas.ctx, box };
}

describe('CanvasSurface', () => {
  beforeEach(install);

  it('sizes the grid to whole cells, with a 1x2 cell aspect', () => {
    const { surface } = makeSurface(400, 300);
    assert.equal(surface.cellW, 10);
    assert.equal(surface.cellH, 20, 'a cell is twice as tall as it is wide');
    assert.equal(surface.width, 40);
    assert.equal(surface.height, 15);
  });

  it('advertises the capabilities the game branches on', () => {
    const { surface } = makeSurface();
    assert.deepEqual(surface.caps, { smoothLight: true, subCell: true });
  });

  it('draws one tile per non-blank cell, at that cell', () => {
    const { surface, ctx } = makeSurface();
    surface.clear();
    surface.set(3, 2, 'g', 0xff0000);
    surface.flush();

    assert.equal(ctx.drawImages.length, 1, 'blank cells cost nothing');
    assert.deepEqual({ x: ctx.drawImages[0]!.x, y: ctx.drawImages[0]!.y }, { x: 30, y: 40 });
  });

  it('nudges a sub-cell glyph by its fractional offset', () => {
    const { surface, ctx } = makeSurface();
    surface.clear();
    // Half a cell right, quarter of a cell down.
    surface.setF(3.5, 2.25, 'g', 0xff0000);
    surface.flush();

    assert.equal(ctx.drawImages.length, 1);
    // Rounds to cell (4, 2), then offsets by -0.5 cells and +0.25 cells.
    assert.equal(ctx.drawImages[0]!.x, (4 - 0.5) * 10);
    assert.equal(ctx.drawImages[0]!.y, (2 + 0.25) * 20);
  });

  it('rounds sub-cell writes into the grid so getChar still works', () => {
    const { surface } = makeSurface();
    surface.clear();
    surface.setF(3.4, 2.6, 'g');
    assert.equal(surface.getChar(3, 3), 'g');
  });

  it('drops out-of-bounds writes rather than corrupting the grid', () => {
    const { surface, ctx } = makeSurface();
    surface.clear();
    assert.doesNotThrow(() => {
      surface.set(-1, -1, 'x');
      surface.set(999, 999, 'x');
      surface.setF(-4.2, 0, 'x');
    });
    surface.flush();
    assert.equal(ctx.drawImages.length, 0);
  });

  it('caches glyph tiles per (character, colour)', () => {
    const { surface } = makeSurface();
    surface.clear();
    for (let i = 0; i < 20; i++) surface.set(i, 0, 'g', 0xff0000);
    surface.set(0, 1, 'g', 0x00ff00); // same glyph, new colour
    surface.set(0, 2, 'w', 0xff0000); // new glyph, same colour
    surface.flush();

    assert.equal(tilesCreated, 3, 'twenty red ghouls must rasterize exactly once');

    const before = tilesCreated;
    surface.clear();
    surface.set(5, 5, 'g', 0xff0000);
    surface.flush();
    assert.equal(tilesCreated, before, 'the cache survives across frames');
  });

  it('places the lantern and forgets it on the next clear', () => {
    const { surface, ctx } = makeSurface();
    surface.clear();
    surface.setLight(10, 5, 14);
    surface.flush();
    assert.equal(ctx.gradients, 1, 'the dark is a real radial falloff');

    surface.clear();
    surface.flush();
    assert.equal(ctx.gradients, 1, 'clear() drops the light; no stale lantern');
  });

  it('reallocates and drops stale tiles when the window resizes', () => {
    const { surface, box } = makeSurface(400, 300);
    surface.clear();
    surface.set(0, 0, 'g', 0xff0000);
    surface.flush();
    assert.equal(tilesCreated, 1);

    box.width = 800;
    box.height = 600;
    assert.equal(surface.resize(), true, 'a changed grid reports true');
    assert.equal(surface.width, 80);
    assert.equal(surface.height, 30);

    // Tiles are rasterized at a device pixel ratio; a resize may change it.
    surface.clear();
    surface.set(0, 0, 'g', 0xff0000);
    surface.flush();
    assert.equal(tilesCreated, 2, 'the glyph cache was dropped');

    assert.equal(surface.resize(), false, 'an unchanged grid reports false');
  });
});
