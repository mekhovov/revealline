import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import {
  createTeamArenaPreference,
  TEAM_ARENA_PREFERENCE_KEY,
} from '../couch/team-arena-preference.mjs';

const pack = COOP_STARTER_PACK;
const first = pack.levels[0].id;
const second = pack.levels[1].id;
const record = (levelId = second, overrides = {}) => ({
  version: 'revealline-team-arena.v1',
  packId: pack.id,
  packRevision: pack.revision,
  levelId,
  ...overrides,
});

function storageFixture(raw = null) {
  const unrelated = [
    ['revealline.library.dev.v1', 'retained Solo progress'],
    ['revealline.session.dev.v1', 'retained paused Solo attempt'],
    ['revealline.display.v1', 'retained shared reading preferences'],
  ];
  const values = new Map(unrelated);
  if (raw !== null) values.set(TEAM_ARENA_PREFERENCE_KEY, raw);
  const writes = [],
    reads = [],
    warnings = [];
  const hooks = { writable: null, getStorage: null, getItem: null };
  const invoke = (key) => {
    const hook = hooks[key];
    hooks[key] = null;
    hook?.();
  };
  const storage = {
    getItem(key) {
      assert.equal(key, TEAM_ARENA_PREFERENCE_KEY, 'Read only the separate Team arena key.');
      reads.push(key);
      invoke('getItem');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      assert.equal(key, TEAM_ARENA_PREFERENCE_KEY, 'Write only the separate Team arena key.');
      assert.equal(typeof value, 'string');
      writes.push([key, value]);
      values.set(key, value);
    },
    removeItem() {
      assert.fail('Arena preference does not erase stored records.');
    },
    clear() {
      assert.fail('Arena preference does not clear player storage.');
    },
  };
  const options = {
    pack,
    getStorage() {
      invoke('getStorage');
      return storage;
    },
    writable() {
      invoke('writable');
      return true;
    },
    onWarning: (warning) => warnings.push(warning),
  };
  return {
    values,
    storage,
    reads,
    writes,
    warnings,
    hooks,
    options,
    unchangedOtherKeys() {
      for (const [key, value] of unrelated) assert.equal(values.get(key), value);
      assert.ok(
        [...values.keys()].every(
          (key) => key === TEAM_ARENA_PREFERENCE_KEY || unrelated.some(([other]) => other === key),
        ),
      );
    },
  };
}

test('exports the separate versioned Team arena key and restores an exact built-in choice without writing', () => {
  assert.equal(TEAM_ARENA_PREFERENCE_KEY, 'revealline.team-arena.v1');
  const raw = JSON.stringify(record());
  const f = storageFixture(raw);
  const preference = createTeamArenaPreference(f.options);
  assert.equal(preference.current(), second);
  assert.equal(preference.current(), second);
  assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.warnings, []);
  f.unchangedOtherKeys();
  preference.dispose();
  assert.deepEqual(f.writes, []);
});

test('an absent record uses the first built-in arena without persisting a default', () => {
  const f = storageFixture();
  const preference = createTeamArenaPreference(f.options);
  assert.equal(preference.current(), first);
  assert.equal(f.values.has(TEAM_ARENA_PREFERENCE_KEY), false);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.warnings, []);
  preference.dispose();
});

test('only an explicit known choice writes the complete exact built-in identity', () => {
  const f = storageFixture();
  const preference = createTeamArenaPreference(f.options);
  assert.equal(preference.choose(second), second);
  assert.equal(preference.current(), second);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(JSON.parse(f.writes[0][1]), record(second));
  assert.equal(preference.choose(first), first);
  assert.equal(preference.current(), first);
  assert.deepEqual(JSON.parse(f.values.get(TEAM_ARENA_PREFERENCE_KEY)), record(first));
  f.unchangedOtherKeys();
  preference.dispose();
});

for (const [label, overrides] of [
  ['another pack', { packId: 'imported-team-pack' }],
  ['an older pack revision', { packRevision: Math.max(0, pack.revision - 1) }],
  ['a newer pack revision', { packRevision: pack.revision + 1 }],
]) {
  test(`${label} is ignored on restore and replaced only by a deliberate built-in choice`, () => {
    const raw = JSON.stringify(record(second, overrides));
    const f = storageFixture(raw);
    const preference = createTeamArenaPreference(f.options);
    assert.equal(preference.current(), first);
    assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
    assert.deepEqual(f.writes, []);
    assert.equal(preference.choose(second), second);
    assert.deepEqual(JSON.parse(f.values.get(TEAM_ARENA_PREFERENCE_KEY)), record(second));
    assert.equal(f.writes.length, 1);
    f.unchangedOtherKeys();
    preference.dispose();
  });
}

test('unknown and imported arena IDs cannot replace the current built-in choice or persist', () => {
  const raw = JSON.stringify(record(second));
  const f = storageFixture(raw);
  const preference = createTeamArenaPreference(f.options);
  for (const levelId of ['imported-arena', '', null, undefined, { id: first }]) {
    assert.throws(() => preference.choose(levelId), TypeError);
    assert.equal(preference.current(), second);
    assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
    assert.deepEqual(f.writes, []);
  }
  f.unchangedOtherKeys();
  preference.dispose();
});

test('a stored unknown arena cannot restore an imported or absent built-in level', () => {
  const raw = JSON.stringify(record('imported-arena'));
  const f = storageFixture(raw);
  const preference = createTeamArenaPreference(f.options);
  assert.equal(preference.current(), first);
  assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
  assert.deepEqual(f.writes, []);
  preference.dispose();
});

for (const [label, raw] of [
  ['unknown record version', JSON.stringify(record(second, { version: 'future-team-arena.v2' }))],
  ['extra fields', JSON.stringify({ ...record(second), unrelatedFutureField: 'preserve me' })],
  ['malformed JSON', '{"version":"revealline-team-arena.v1",'],
  ['oversized valid JSON', ' '.repeat(65536) + JSON.stringify(record(second))],
  ['non-object JSON', JSON.stringify(['revealline-team-arena.v1', second])],
]) {
  test(`${label} remains byte-for-byte intact after a local choice and produces a warning`, () => {
    const f = storageFixture(raw);
    const preference = createTeamArenaPreference(f.options);
    assert.equal(preference.current(), first);
    assert.equal(preference.choose(second), second);
    assert.equal(preference.current(), second);
    assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
    assert.deepEqual(f.writes, []);
    assert.ok(f.warnings.length > 0, 'An unsaved local choice needs an actionable warning.');
    f.unchangedOtherKeys();
    preference.dispose();
  });
}

test('a protected record arriving after initial read is not overwritten by an explicit local choice', () => {
  const f = storageFixture();
  const preference = createTeamArenaPreference(f.options);
  const newer = JSON.stringify(record(second, { version: 'future-team-arena.v2' }));
  f.values.set(TEAM_ARENA_PREFERENCE_KEY, newer);
  assert.equal(preference.choose(second), second);
  assert.equal(preference.current(), second);
  assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), newer);
  assert.deepEqual(f.writes, []);
  assert.ok(f.warnings.length > 0);
  preference.dispose();
});

for (const denied of ['getStorage', 'getItem']) {
  test(`${denied} denial leaves a usable local arena choice, warns and performs no write`, () => {
    const f = storageFixture();
    if (denied === 'getStorage')
      f.options.getStorage = () => {
        throw new Error('Read denied.');
      };
    else
      f.storage.getItem = () => {
        throw new Error('Read denied.');
      };
    const preference = createTeamArenaPreference(f.options);
    assert.equal(preference.current(), first);
    assert.equal(preference.choose(second), second);
    assert.equal(preference.current(), second);
    assert.deepEqual(f.writes, []);
    assert.ok(f.warnings.length > 0);
    f.unchangedOtherKeys();
    preference.dispose();
  });
}

test('failed storage writes retain the explicit local arena and the prior durable record', () => {
  const raw = JSON.stringify(record(first));
  const f = storageFixture(raw);
  let attempts = 0;
  f.storage.setItem = (key) => {
    assert.equal(key, TEAM_ARENA_PREFERENCE_KEY);
    attempts++;
    throw new Error('Quota denied.');
  };
  const preference = createTeamArenaPreference(f.options);
  assert.equal(preference.choose(second), second);
  assert.equal(preference.current(), second);
  assert.equal(attempts, 1);
  assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
  assert.ok(f.warnings.length > 0);
  f.unchangedOtherKeys();
  preference.dispose();
});

test('read-only ownership keeps a local choice and can save a later explicit choice after recovery', () => {
  const raw = JSON.stringify(record(first));
  const f = storageFixture(raw);
  let writable = false;
  f.options.writable = () => writable;
  const preference = createTeamArenaPreference(f.options);
  assert.equal(preference.choose(second), second);
  assert.equal(preference.current(), second);
  assert.deepEqual(f.writes, []);
  assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
  assert.ok(f.warnings.length > 0);
  writable = true;
  assert.equal(preference.choose(first), first);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(JSON.parse(f.writes[0][1]), record(first));
  f.unchangedOtherKeys();
  preference.dispose();
});

test('disposal is idempotent and blocks later choice writes', () => {
  const raw = JSON.stringify(record(first));
  const f = storageFixture(raw);
  const preference = createTeamArenaPreference(f.options);
  preference.dispose();
  preference.dispose();
  assert.throws(() => preference.choose(second), /disposed/i);
  assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
  assert.deepEqual(f.writes, []);
  f.unchangedOtherKeys();
});

for (const boundary of ['writable', 'getStorage', 'getItem']) {
  test(`disposal reentered from ${boundary} prevents an older choose from writing`, () => {
    const raw = JSON.stringify(record(first));
    const f = storageFixture(raw);
    const preference = createTeamArenaPreference(f.options);
    let fired = false;
    f.hooks[boundary] = () => {
      fired = true;
      preference.dispose();
    };
    preference.choose(second);
    assert.equal(fired, true, 'The relevant public storage/ownership boundary was reached.');
    assert.deepEqual(f.writes, []);
    assert.equal(f.values.get(TEAM_ARENA_PREFERENCE_KEY), raw);
    f.unchangedOtherKeys();
  });

  test(`a newer choice reentered from ${boundary} wins without an older stale write`, () => {
    const f = storageFixture(JSON.stringify(record(first)));
    const preference = createTeamArenaPreference(f.options);
    let fired = false;
    f.hooks[boundary] = () => {
      fired = true;
      assert.equal(preference.choose(first), first);
    };
    preference.choose(second);
    assert.equal(fired, true);
    assert.equal(preference.current(), first, 'The newer deliberate choice owns local state.');
    assert.equal(f.writes.length, 1);
    assert.deepEqual(JSON.parse(f.writes[0][1]), record(first));
    assert.deepEqual(JSON.parse(f.values.get(TEAM_ARENA_PREFERENCE_KEY)), record(first));
    f.unchangedOtherKeys();
    preference.dispose();
  });
}
