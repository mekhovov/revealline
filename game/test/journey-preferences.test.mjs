import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JOURNEY_PREFERENCES_KEY as key,
  JOURNEY_PREFERENCES_VERSION as format,
  createJourneyPreferences,
  validateJourneyPreferences,
} from '../journey/preferences.mjs';
import { emptyJourneyProfile, validateJourneyProfile } from '../journey/profile.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';

const encode = (difficulty = 'standard') => JSON.stringify({ format, difficulty });
function fixture(raw) {
  const data = new Map(raw === undefined ? [] : [[key, raw]]),
    writes = [],
    window = new EventTarget();
  let readFailure = false,
    writeFailure = false;
  const storage = {
    getItem(name) {
      if (readFailure) throw new Error('Read denied.');
      return data.get(name) ?? null;
    },
    setItem(name, value) {
      if (writeFailure) throw new Error('Quota exceeded.');
      writes.push([name, value]);
      data.set(name, value);
    },
  };
  const options = { getStorage: () => storage, window },
    preferences = createJourneyPreferences(options);
  return {
    data,
    writes,
    options,
    preferences,
    failRead(value) {
      readFailure = value;
    },
    failWrite(value) {
      writeFailure = value;
    },
    event(raw, overrides = {}) {
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key,
          newValue: raw,
          storageArea: storage,
          ...overrides,
        }),
      );
    },
    restore(persisted = true) {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
    },
  };
}

test('Journey preferences are independent of release, progress and Legacy records', () => {
  const f = fixture();
  const legacy = '{"preferences":{"campaignDifficulty":"gentle"}}';
  const profile = JSON.stringify(emptyJourneyProfile());
  f.data.set('revealline.player', legacy);
  f.data.set('profile-evidence', profile);
  assert.deepEqual(f.preferences.snapshot(), {
    difficulty: 'standard',
    revision: 0,
    durable: true,
    error: '',
  });
  assert.deepEqual(f.writes, []);
  for (const difficulty of ['expert', 'gentle', 'standard']) {
    assert.equal(f.preferences.choose(difficulty).difficulty, difficulty);
    const reopened = createJourneyPreferences(f.options);
    assert.equal(reopened.snapshot().difficulty, difficulty);
    reopened.dispose();
  }
  assert.deepEqual(
    f.writes.map(([name]) => name),
    [key, key, key],
  );
  assert.equal(f.data.get('revealline.player'), legacy);
  assert.equal(f.data.get('profile-evidence'), profile);
  assert.deepEqual(validateJourneyProfile(profile), emptyJourneyProfile());
});

test('only the exact versioned three-preset record is accepted without invoking accessors', () => {
  for (const source of [
    null,
    [],
    {},
    { format },
    { format, difficulty: null },
    { format, difficulty: 'constructor' },
    { format: 'JourneyPreferencesV2', difficulty: 'expert' },
    { format, difficulty: 'expert', release: '0.69.0' },
    ' '.repeat(257),
    {
      format,
      get difficulty() {
        throw new Error('Getter must not run.');
      },
    },
  ]) {
    assert.throws(() => validateJourneyPreferences(source), TypeError);
  }
  assert.deepEqual(validateJourneyPreferences(encode('expert')), { format, difficulty: 'expert' });
});

test('damaged or future records are never silently overwritten, including after a local choice', () => {
  for (const raw of ['broken', '{"format":"JourneyPreferencesV2","difficulty":"expert"}']) {
    const f = fixture(raw);
    assert.equal(f.preferences.snapshot().durable, false);
    assert.equal(f.preferences.choose('gentle').difficulty, 'gentle');
    assert.equal(f.preferences.retry().durable, false);
    assert.equal(f.data.get(key), raw);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(validateJourneyPreferences(f.preferences.export()), {
      format,
      difficulty: 'gentle',
    });
    f.data.set(key, encode('standard'));
    assert.equal(f.preferences.retry().durable, true);
    assert.equal(f.data.get(key), encode('gentle'));
  }
});

test('save failure preserves local intent, warns truthfully, exports and retries it', () => {
  const f = fixture(encode('standard'));
  f.failWrite(true);
  const current = f.preferences.choose('expert');
  assert.equal(current.durable, false);
  assert.match(current.error, /session.*Retry.*export.*Quota/);
  assert.equal(f.data.get(key), encode('standard'));
  f.data.set(key, encode('gentle'));
  f.event(encode('gentle'));
  f.restore();
  assert.equal(f.preferences.snapshot().difficulty, 'expert');
  f.failWrite(false);
  assert.equal(f.preferences.retry().durable, true);
  assert.equal(f.data.get(key), encode('expert'));
  assert.equal(f.preferences.snapshot().error, '');
});

test('late, foreign and unrelated storage events cannot replace next-attempt intent', () => {
  const f = fixture(encode('standard'));
  f.data.set(key, encode('expert'));
  f.event(encode('gentle'));
  f.event(encode('expert'), { storageArea: {} });
  f.event(encode('expert'), { key: 'revealline.player' });
  assert.equal(f.preferences.snapshot().difficulty, 'standard');
  f.event(encode('expert'));
  assert.equal(f.preferences.snapshot().difficulty, 'expert');
  assert.equal(f.preferences.snapshot().revision, 1);
  assert.deepEqual(f.writes, []);
  f.data.delete(key);
  f.event(null);
  assert.equal(f.preferences.snapshot().difficulty, 'standard');
});

test('restored page rereads current storage without resetting an active execution', () => {
  const f = fixture(encode('gentle'));
  const captured = f.preferences.snapshot();
  f.data.set(key, encode('expert'));
  f.restore(false);
  assert.deepEqual(f.preferences.snapshot(), captured);
  assert.equal(f.preferences.snapshot().difficulty, 'gentle');
  f.restore();
  assert.equal(f.preferences.snapshot().difficulty, 'expert');
  assert.equal(captured.difficulty, 'gentle');
  assert.equal(Object.isFrozen(captured), true);
  assert.deepEqual(f.writes, []);
});

test('storage read denial and later corruption never overwrite recoverable bytes', () => {
  const f = fixture(encode('standard'));
  f.failRead(true);
  assert.equal(f.preferences.choose('expert').durable, false);
  f.failRead(false);
  f.data.set(key, 'preserve this');
  assert.equal(f.preferences.retry().durable, false);
  assert.equal(f.data.get(key), 'preserve this');
  assert.deepEqual(f.writes, []);
  const unavailable = createJourneyPreferences({ getStorage: () => null });
  assert.equal(unavailable.snapshot().durable, false);
  assert.equal(unavailable.choose('gentle').difficulty, 'gentle');
  unavailable.dispose();
});

test('invalid choices do not mutate state or storage; observers cannot discard newer intent', () => {
  const f = fixture();
  const before = f.preferences.snapshot();
  assert.throws(() => f.preferences.choose('extreme'));
  assert.deepEqual(f.preferences.snapshot(), before);
  assert.deepEqual(f.writes, []);
  let redirect = true;
  const seen = [];
  f.preferences.subscribe((state) => {
    if (state.difficulty === 'expert' && redirect) {
      redirect = false;
      f.preferences.choose('gentle');
    }
  });
  f.preferences.subscribe(() => {
    throw new Error('Broken UI.');
  });
  const unsubscribe = f.preferences.subscribe((state) => seen.push(state.difficulty));
  assert.equal(f.preferences.choose('expert').difficulty, 'gentle');
  assert.equal(f.data.get(key), encode('gentle'));
  assert.equal(seen.at(-1), 'gentle');
  unsubscribe();
  f.preferences.dispose();
  f.data.set(key, encode('expert'));
  f.event(encode('expert'));
  assert.equal(f.preferences.snapshot().difficulty, 'gentle');
  assert.throws(() => f.preferences.choose('standard'), /disposed/);
  assert.throws(() => f.preferences.retry(), /disposed/);
});

test('next-attempt preset selects exact shared compiler executions, never reprojects or edits the active one', () => {
  const f = fixture();
  const catalog = createContentExecutionCatalog(createOpeningCandidates(), {
    packIds: ['journey-opening'],
  });
  const first = catalog.journey().missions[0];
  const active = catalog.select(
    first.packId,
    first.campaignId,
    f.preferences.snapshot().difficulty,
  );
  const before = JSON.stringify(active);
  f.preferences.choose('expert');
  const next = catalog.select(first.packId, first.campaignId, f.preferences.snapshot().difficulty);
  assert.equal(active.campaign.levels[0].rules.lives, 3);
  assert.equal(next.campaign.levels[0].rules.lives, 2);
  assert.equal(active.campaign.levels[0].rules.moveSpeed, next.campaign.levels[0].rules.moveSpeed);
  assert.equal(JSON.stringify(active), before);
  assert.notEqual(active.executionKey, next.executionKey);
  assert.equal(next.officialProgressEligible, false);
  assert.deepEqual(catalog.journey('expert').missions, catalog.journey('standard').missions);
});
