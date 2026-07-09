/**
 * The Crossroads: parsing, the cost curve, the save file, and the one rule Jane
 * wrote into `crossroads.tsv` — *"meta-progression may make a bad run
 * survivable. It may never make a good run trivial."*
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCrossroads, upgradeCost, fullUnlockCost, crossroadsParam } from '../data/crossroads.ts';
import { emptyProfile, loadProfile, memoryStore, saveProfile, type Profile } from '../game/save.ts';

const SRC = [
  '# comment',
  'param\tgold_per_elite\t100',
  'param\tgold_countess\t500',
  'might\tMight\tcards/passives/might\tdamage\tmult\t0.05\t5\t100\t1.6\t+5% damage per level',
  'revival\tRevival\tcards/passives/revival\trevives\tadd\t1\t2\t1000\t2.5\texpensive on purpose',
  'ashling\tThe Ashling\tsprites/ashling\t-\tunlock\t-\t1\t400\t1.0\tfragile, fast',
].join('\n');

describe('crossroads.tsv', () => {
  const t = parseCrossroads(SRC);

  it('parses params and upgrade rows', () => {
    assert.equal(crossroadsParam(t, 'gold_per_elite'), 100);
    assert.equal(crossroadsParam(t, 'gold_countess'), 500);
    assert.equal(t.upgrades.length, 3);
    assert.deepEqual(t.warnings, []);
  });

  it('keeps file order, because that is the order they are offered in', () => {
    assert.deepEqual(t.upgrades.map((u) => u.id), ['might', 'revival', 'ashling']);
  });

  it('applies cost(level) = base * growth^(level-1), rounded to the nearest 10', () => {
    const might = t.upgrades[0]!;
    assert.equal(upgradeCost(might, 1), 100);
    assert.equal(upgradeCost(might, 2), 160);
    assert.equal(upgradeCost(might, 3), 260); // 256 -> 260
    assert.equal(upgradeCost(might, 5), 660); // 655.36 -> 660
  });

  it('rounds exact ties up, consistently', () => {
    // The only two ties in the real table. Jane's 15,230g figure came from
    // Python's banker's rounding, which sends 255 up but 405 down.
    const greed = parseCrossroads('greed\tGreed\ticon\tgold_gain\tmult\t0.10\t5\t120\t1.5\t').upgrades[0]!;
    assert.equal(upgradeCost(greed, 4), 410, '405 -> 410');
    const luck = parseCrossroads('luck\tLuck\ticon\tluck\tmult\t0.05\t4\t150\t1.7\t').upgrades[0]!;
    assert.equal(upgradeCost(luck, 2), 260, '255 -> 260');
  });

  it('makes Revival deliberately expensive', () => {
    const revival = t.upgrades[1]!;
    assert.equal(upgradeCost(revival, 1), 1000);
    assert.equal(upgradeCost(revival, 2), 2500);
  });

  it('falls back cleanly when the file is missing', () => {
    const empty = parseCrossroads('');
    assert.equal(empty.upgrades.length, 0);
    assert.equal(crossroadsParam(empty, 'gold_per_kill'), 3, 'defaults still answer');
  });

  it('prices the real table within 10g of the total Jane costed against', async () => {
    // She published 15,230g and derived "11 runs to buy everything" from it. We
    // land on 15,240g because two rows tie exactly and we round both up while
    // her tool rounded one of them down. This test exists so that a *real* drift
    // in the curve — which would invalidate her meta maths — fails loudly, while
    // the known 10g rounding gap does not.
    const { readFile } = await import('node:fs/promises');
    const real = parseCrossroads(await readFile(new URL('../../assets/crossroads.tsv', import.meta.url), 'utf8'));

    const total = fullUnlockCost(real);
    assert.equal(total, 15240);
    assert.ok(Math.abs(total - 15230) <= 10, 'the published economy still holds');
  });
});

describe('the save file', () => {
  it('round-trips a profile', () => {
    const store = memoryStore();
    const p = emptyProfile();
    p.gold = 1234;
    p.upgrades['might'] = 3;
    p.wonOnce = true;
    saveProfile(store, p);

    const { profile, warning } = loadProfile(store);
    assert.equal(warning, null);
    assert.equal(profile.gold, 1234);
    assert.equal(profile.upgrades['might'], 3);
    assert.equal(profile.wonOnce, true);
  });

  it('starts fresh on an empty store', () => {
    const { profile, warning } = loadProfile(memoryStore());
    assert.equal(profile.gold, 0);
    assert.equal(warning, null);
  });

  it('never throws on a corrupt save, and says so', () => {
    const store = memoryStore();
    store.write('{not json at all');
    const { profile, warning } = loadProfile(store);
    assert.equal(profile.gold, 0);
    assert.match(warning ?? '', /corrupt/);
  });

  it('refuses a save from a future version rather than misreading it', () => {
    const store = memoryStore();
    store.write(JSON.stringify({ ...emptyProfile(), version: 99, gold: 500 }));
    const { profile, warning } = loadProfile(store);
    assert.equal(profile.gold, 0);
    assert.match(warning ?? '', /version 99/);
  });

  it('sanitizes hostile numbers off disk', () => {
    const store = memoryStore();
    store.write(JSON.stringify({ ...emptyProfile(), gold: -5, upgrades: { might: 'lots', luck: 2.7 } }));
    const { profile } = loadProfile(store);
    assert.equal(profile.gold, 0, 'no negative gold');
    assert.equal(profile.upgrades['might'], undefined, 'NaN levels are dropped');
    assert.equal(profile.upgrades['luck'], 2, 'levels are integers');
  });

  it('survives a store that cannot be written to', () => {
    const readOnly = {
      read: (): string | null => null,
      write: (): void => {
        throw new Error('EROFS');
      },
    };
    assert.doesNotThrow(() => saveProfile(readOnly, emptyProfile() satisfies Profile));
  });
});
