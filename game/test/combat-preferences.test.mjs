import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatPreferences,
  validateCombatPreferences,
  COMBAT_PREFERENCES_KEY as key,
  COMBAT_PREFERENCES_VERSION as format,
} from '../combat-preferences.mjs';

const encode = (mode = 'authored', showScrap = true) => JSON.stringify({ format, mode, showScrap });
function fixture(raw) {
  const data = new Map(raw === undefined ? [] : [[key, raw]]),
    writes = [],
    window = new EventTarget();
  let failWrite = false;
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem(k, v) {
      if (failWrite) throw new Error('Quota exceeded');
      writes.push([k, v]);
      data.set(k, v);
    },
  };
  const options = { getStorage: () => storage, window };
  return {
    data,
    writes,
    options,
    pref: createCombatPreferences(options),
    fail: (v) => {
      failWrite = v;
    },
    event(raw, extra = {}) {
      window.dispatchEvent(
        Object.assign(new Event('storage'), { key, storageArea: storage, newValue: raw, ...extra }),
      );
    },
    restore(persisted = true) {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
    },
  };
}

test('default is authored, load never writes, stable key is independent of release/music/progress', () => {
  const f = fixture();
  f.data.set('music-ledger', 'revision50');
  assert.deepEqual(f.pref.snapshot(), {
    mode: 'authored',
    showScrap: true,
    revision: 0,
    gameplayRevision: 0,
    durable: true,
    error: '',
  });
  assert.deepEqual(f.writes, []);
  for (const mode of ['on', 'off', 'authored']) {
    f.pref.choose(mode);
    const reopened = createCombatPreferences(f.options);
    assert.equal(reopened.snapshot().mode, mode);
    reopened.dispose();
  }
  assert.equal(f.data.get('music-ledger'), 'revision50');
  assert(f.writes.every(([k]) => k === key));
});

test('scrap is cosmetic, mode is next-attempt intent, old snapshots remain immutable', () => {
  const f = fixture(),
    captured = f.pref.snapshot();
  f.pref.setScrap(false);
  assert.equal(f.pref.snapshot().gameplayRevision, 0);
  assert.equal(f.pref.snapshot().revision, 1);
  f.pref.choose('off');
  assert.equal(f.pref.snapshot().gameplayRevision, 1);
  assert.equal(f.pref.snapshot().revision, 2);
  f.pref.choose('off');
  assert.equal(f.pref.snapshot().gameplayRevision, 1);
  assert.equal(captured.mode, 'authored');
  assert.equal(captured.showScrap, true);
  assert(Object.isFrozen(captured));
});

test('strict bounded data rejects future records, coercion and accessors without executing them', () => {
  let calls = 0;
  for (const value of [
    null,
    [],
    {},
    { format, mode: 'off' },
    { format, mode: 'unknown', showScrap: true },
    { format, mode: 'on', showScrap: 1 },
    { format: 'CombatPreferencesV2', mode: 'off', showScrap: true },
    { format, mode: 'off', showScrap: true, build: '0.78' },
    ' '.repeat(257),
    {
      format,
      get mode() {
        calls++;
        return 'on';
      },
      showScrap: true,
    },
  ])
    assert.throws(() => validateCombatPreferences(value));
  assert.equal(calls, 0);
  assert.deepEqual(validateCombatPreferences(encode('off', false)), {
    format,
    mode: 'off',
    showScrap: false,
  });
});

test('future/corrupt records survive choices and retries; local intent remains exportable', () => {
  for (const raw of ['broken', '{"format":"CombatPreferencesV2"}']) {
    const f = fixture(raw);
    assert.equal(f.pref.snapshot().durable, false);
    f.pref.choose('off');
    f.pref.setScrap(false);
    f.pref.retry();
    assert.equal(f.data.get(key), raw);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(validateCombatPreferences(f.pref.export()), {
      format,
      mode: 'off',
      showScrap: false,
    });
    f.data.set(key, encode());
    assert.equal(f.pref.retry().durable, true);
    assert.equal(f.data.get(key), encode('off', false));
  }
});

test('failed save warns, preserves local choice against other tabs and retries without losing it', () => {
  const f = fixture(encode('on'));
  f.fail(true);
  assert.match(f.pref.choose('off').error, /session-only.*Retry.*export.*Quota/);
  f.data.set(key, encode('authored'));
  f.event(encode('authored'));
  f.restore();
  assert.equal(f.pref.snapshot().mode, 'off');
  f.fail(false);
  assert.equal(f.pref.retry().durable, true);
  assert.equal(f.data.get(key), encode('off'));
});

test('storage events must be current, same storage and same key; restored page reconciles without a write', () => {
  const f = fixture();
  f.data.set(key, encode('off', false));
  f.event(encode('on'));
  f.event(encode('off', false), { storageArea: {} });
  f.event(encode('off', false), { key: 'different' });
  assert.equal(f.pref.snapshot().mode, 'authored');
  f.event(encode('off', false));
  assert.equal(f.pref.snapshot().mode, 'off');
  assert.equal(f.pref.snapshot().gameplayRevision, 1);
  f.data.set(key, encode('on'));
  f.restore(false);
  assert.equal(f.pref.snapshot().mode, 'off');
  f.restore();
  assert.equal(f.pref.snapshot().mode, 'on');
  f.data.delete(key);
  f.event(null);
  assert.equal(f.pref.snapshot().mode, 'authored');
  assert.deepEqual(f.writes, []);
});

test('invalid choices and disposed mutators cannot change preferences; throwing views do not discard saves', () => {
  const f = fixture(),
    before = f.pref.snapshot();
  assert.throws(() => f.pref.choose(false));
  assert.throws(() => f.pref.setScrap('false'));
  assert.deepEqual(f.pref.snapshot(), before);
  assert.deepEqual(f.writes, []);
  const stop = f.pref.subscribe(() => {
    throw Error('view');
  });
  assert.equal(f.pref.choose('off').durable, true);
  stop();
  f.pref.dispose();
  assert.throws(() => f.pref.choose('on'));
  assert.throws(() => f.pref.retry());
  assert.throws(() => f.pref.subscribe(() => {}));
  assert.throws(() => f.pref.setScrap(false));
  assert.equal(f.data.get(key), encode('off'));
});

test('unavailable storage permits session-only preference without touching any run', () => {
  const pref = createCombatPreferences({
    getStorage: () => {
      throw Error('Storage denied');
    },
  });
  assert.equal(pref.snapshot().durable, false);
  assert.equal(pref.choose('off').mode, 'off');
  assert.equal(pref.setScrap(false).showScrap, false);
  assert.match(pref.snapshot().error, /Storage denied/);
  pref.dispose();
});
