/**
 * The Countess. She's the only fight in the game, and everything that makes her
 * fair is a number in `countess.tsv`: an 0.8s telegraph you can read, a 90 deg/s
 * turn rate you can bait, a charge you cannot outrun.
 *
 * These tests exist because "she is baitable" is a property, not an opinion.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

import { countessParam, parseCountess, phaseFor } from '../data/countess.ts';

const REAL = parseCountess(readFileSync(new URL('../../assets/countess.tsv', import.meta.url), 'utf8'));

describe('countess.tsv', () => {
  it('parses without warnings', () => {
    assert.deepEqual(REAL.warnings, []);
    assert.equal(REAL.phases.length, 3);
  });

  it('reads her params, including the non-numeric trail glyph', () => {
    assert.equal(countessParam(REAL, 'telegraph'), 0.8);
    assert.equal(countessParam(REAL, 'charge_speed'), 52);
    assert.equal(countessParam(REAL, 'turn_rate'), 90);
    assert.equal(countessParam(REAL, 'trail_life'), 4);
    assert.equal(REAL.trailGlyph, '▓');
  });

  it('orders phases from full health downward', () => {
    assert.deepEqual(REAL.phases.map((p) => p.id), ['court', 'hunt', 'dusk']);
  });

  it('maps an hp fraction onto the right phase, at every boundary', () => {
    assert.equal(phaseFor(REAL, 1.0)?.id, 'court');
    assert.equal(phaseFor(REAL, 0.71)?.id, 'court');
    assert.equal(phaseFor(REAL, 0.70)?.id, 'hunt', 'the boundary belongs to the phase below');
    assert.equal(phaseFor(REAL, 0.26)?.id, 'hunt');
    assert.equal(phaseFor(REAL, 0.25)?.id, 'dusk');
    assert.equal(phaseFor(REAL, 0.0)?.id, 'dusk', 'dying is still dusk');
  });

  it('gives Court a stationary speed — she is not what is hurting you', () => {
    const court = REAL.phases[0]!;
    assert.equal(court.speed, 0);
    assert.equal(court.action, 'summon_ring');
    assert.equal(court.count, 12);
  });

  it('makes her charge faster than the player can run', () => {
    // The player moves at 20 wu/s (glyphs.tsv). Outrunning her must be impossible.
    assert.ok(countessParam(REAL, 'charge_speed') > 20 * 2, 'you dodge, you do not flee');
  });

  it('makes her turn slowly enough to sidestep', () => {
    // 90 deg/s means a full reversal takes 2s while she covers 104wu. That gap
    // between her speed and her agility IS the fight.
    const turn = countessParam(REAL, 'turn_rate');
    assert.ok(turn <= 120, `${turn} deg/s would let her track the player`);
    assert.ok(turn >= 45, `${turn} deg/s would make her harmless`);
  });

  it('refuses to let her be stalled out', () => {
    assert.ok(countessParam(REAL, 'enrage_after') > 0);
  });

  it('freezes the clock and halts the ambient director', () => {
    assert.equal(countessParam(REAL, 'freeze_clock'), 1);
    assert.equal(countessParam(REAL, 'halt_director'), 1);
  });

  it('falls back to something inert rather than throwing', () => {
    const empty = parseCountess('');
    assert.equal(empty.phases.length, 0);
    assert.equal(phaseFor(empty, 0.5), null);
    assert.match(empty.warnings[0]!, /no phases/);
  });

  it('warns on an unknown action instead of silently dropping the fight', () => {
    const t = parseCountess('phase\tx\t100\t0\t5\tteleport\t1\t1');
    assert.match(t.warnings[0]!, /unknown action 'teleport'/);
  });
});
