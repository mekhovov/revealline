import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCOUNTER_DISPLAY_PREFERENCES_KEY as key,
  createEncounterDisplayPreferences,
  validateEncounterDisplayPreferences,
} from '../encounter-display-preferences.mjs';

const format = 'EncounterDisplayPreferencesV1';
const encode = (showRemains = true) => JSON.stringify({ format, showRemains });
const failed = 'common:preferences.encounterSaveFailed';
const sessionOnly = 'common:preferences.encounterSessionOnly';

function fixture({ stored, writable, onWarning, unavailable = false } = {}) {
  const data = new Map(stored === undefined ? [] : [[key, stored]]);
  const writes = [],
    warnings = [],
    window = new EventTarget(),
    handlers = new Map(),
    hooks = {};
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  window.addEventListener = (name, callback) => {
    handlers.set(name, callback);
    add(name, callback);
  };
  window.removeEventListener = (name, callback) => {
    assert.equal(handlers.get(name), callback);
    handlers.delete(name);
    remove(name, callback);
  };
  const once = (name) => {
    const callback = hooks[name];
    delete hooks[name];
    callback?.();
  };
  let failure = '';
  const storage = {
    getItem(name) {
      assert.equal(this, storage);
      once('getItem');
      if (failure === 'read') throw new Error('denied');
      return data.get(name) ?? null;
    },
    setItem(name, value) {
      assert.equal(this, storage);
      once('setItem');
      if (failure === 'quota') throw new Error('quota');
      writes.push([name, value]);
      if (failure !== 'silent') data.set(name, value);
    },
  };
  const preferences = createEncounterDisplayPreferences({
    window,
    writable,
    getStorage() {
      once('getStorage');
      if (unavailable) throw new Error('unavailable');
      return storage;
    },
    onWarning: onWarning ?? ((message, warningKey) => warnings.push([message, warningKey])),
  });
  return {
    preferences,
    data,
    writes,
    warnings,
    storage,
    handlers,
    hooks,
    fail(value = '') {
      failure = value;
    },
    restore(persisted = true) {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
    },
    event(newValue, { eventKey = key, area = storage } = {}) {
      window.dispatchEvent(
        Object.assign(new Event('storage'), { key: eventKey, storageArea: area, newValue }),
      );
    },
  };
}

test('strict record validates owned bounded data without invoking getters or coercion', () => {
  let invoked = 0;
  const accessor = Object.defineProperty({ format }, 'showRemains', {
    enumerable: true,
    get() {
      invoked++;
      return true;
    },
  });
  const valid = { format, showRemains: false };
  const result = validateEncounterDisplayPreferences(valid);
  assert.deepEqual(result, valid);
  assert.notStrictEqual(result, valid);
  assert.equal(Object.isFrozen(result), true);
  for (const invalid of [
    null,
    [],
    {},
    { format },
    { showRemains: true },
    { format: 'EncounterDisplayPreferencesV2', showRemains: true },
    { format, showRemains: 1 },
    { ...valid, revision: 1 },
    { ...valid, [Symbol('extra')]: true },
    Object.create(valid),
    Object.defineProperty({ format }, 'showRemains', { value: true }),
    accessor,
    {
      ...valid,
      toJSON() {
        invoked++;
      },
    },
    'not JSON',
    ' '.repeat(257) + encode(),
    '{"format":"EncounterDisplayPreferencesV1","showRemains":true,"__proto__":{}}',
  ])
    assert.throws(() => validateEncounterDisplayPreferences(invalid), TypeError);
  assert.equal(invoked, 0);
});

test('default and saved intent load synchronously without writes to any record', () => {
  for (const stored of [undefined, encode(false), encode(true)]) {
    const f = fixture({ stored });
    assert.deepEqual(f.preferences.snapshot(), {
      showRemains: stored !== encode(false),
      durable: true,
      warningKey: '',
      revision: 0,
    });
    assert.equal(Object.isFrozen(f.preferences.snapshot()), true);
    const seen = [];
    const off = f.preferences.subscribe((state) => seen.push(state));
    assert.strictEqual(seen[0], f.preferences.snapshot());
    assert.equal(f.preferences.retry(), f.preferences.snapshot());
    assert.equal(seen.length, 1);
    assert.deepEqual(f.writes, []);
    off();
    f.preferences.dispose();
  }
});

test('corrupt or future raw bytes survive load, explicit choice and retry until repaired', () => {
  for (const stored of [
    'broken',
    'null',
    '[]',
    '{}',
    '{"format":"EncounterDisplayPreferencesV2","showRemains":false}',
    '{"format":"EncounterDisplayPreferencesV1","showRemains":"false"}',
    '{"format":"EncounterDisplayPreferencesV1","showRemains":false,"extra":1}',
    ' '.repeat(257) + encode(),
  ]) {
    const f = fixture({ stored });
    assert.equal(f.preferences.snapshot().showRemains, true);
    assert.equal(f.preferences.snapshot().durable, false);
    assert.equal(f.preferences.snapshot().warningKey, failed);
    f.preferences.set(false);
    f.preferences.retry();
    assert.equal(f.preferences.snapshot().showRemains, false);
    assert.equal(f.data.get(key), stored);
    assert.deepEqual(f.writes, []);
    f.data.set(key, encode());
    f.restore();
    f.event(encode());
    assert.equal(f.preferences.snapshot().showRemains, false, 'Unsaved local intent wins.');
    f.preferences.retry();
    assert.equal(f.data.get(key), encode(false));
    assert.equal(f.preferences.snapshot().durable, true);
    assert.equal(f.preferences.snapshot().warningKey, '');
    f.preferences.dispose();
  }
});

test('set accepts only boolean intent and saves only the separate cosmetic record', () => {
  const f = fixture();
  for (const other of ['revealline.display.v1', 'revealline.player', 'replay', 'scenario'])
    f.data.set(other, `retained:${other}`);
  const before = f.preferences.snapshot();
  for (const invalid of [null, undefined, 0, 1, '', 'false', [], {}, { showRemains: false }])
    assert.throws(() => f.preferences.set(invalid), TypeError);
  assert.strictEqual(f.preferences.snapshot(), before);
  assert.deepEqual(f.writes, []);
  const result = f.preferences.set(false);
  assert.strictEqual(result, f.preferences.snapshot());
  assert.equal(result.showRemains, false);
  assert.equal(result.durable, true);
  assert.deepEqual(f.writes, [[key, encode(false)]]);
  for (const other of ['revealline.display.v1', 'revealline.player', 'replay', 'scenario'])
    assert.equal(f.data.get(other), `retained:${other}`);
  f.preferences.dispose();
  const later = createEncounterDisplayPreferences({ getStorage: () => f.storage });
  assert.equal(later.snapshot().showRemains, false);
  assert.equal(f.writes.length, 1);
  later.dispose();
});

test('storage events require the exact key, current storage area and still-current raw bytes', () => {
  const f = fixture(),
    seen = [];
  f.preferences.subscribe((state) => seen.push(state));
  f.event(encode(false));
  f.data.set(key, encode(false));
  f.event(encode(false), { eventKey: 'another' });
  f.event(encode(false), { area: {} });
  f.event(encode());
  assert.equal(f.preferences.snapshot().showRemains, true);
  f.event(encode(false));
  assert.equal(f.preferences.snapshot().showRemains, false);
  const accepted = f.preferences.snapshot();
  f.event(encode(false));
  f.restore();
  assert.strictEqual(f.preferences.snapshot(), accepted);
  assert.equal(seen.length, 2);
  f.data.delete(key);
  f.event(null);
  assert.equal(f.preferences.snapshot().showRemains, true, 'Deletion restores the default.');
  f.data.set(key, 'broken');
  f.event('broken', { area: {} });
  assert.equal(f.preferences.snapshot().durable, true);
  f.event('broken');
  assert.equal(f.preferences.snapshot().showRemains, true);
  assert.equal(f.preferences.snapshot().durable, false);
  assert.equal(f.preferences.snapshot().warningKey, failed);
  assert.deepEqual(f.writes, []);
  f.preferences.dispose();
});

test('persisted restoration reconciles current records; ordinary pageshow is inert', () => {
  const f = fixture();
  f.data.set(key, encode(false));
  f.restore(false);
  assert.equal(f.preferences.snapshot().showRemains, true);
  f.restore();
  assert.equal(f.preferences.snapshot().showRemains, false);
  f.data.set(key, 'future data');
  f.restore();
  assert.equal(f.preferences.snapshot().showRemains, false, 'Keep the last valid visual choice.');
  assert.equal(f.preferences.snapshot().durable, false);
  f.data.delete(key);
  f.restore();
  assert.equal(f.preferences.snapshot().showRemains, true);
  assert.equal(f.preferences.snapshot().durable, true);
  assert.deepEqual(f.writes, []);
  f.preferences.dispose();
});

test('storage clear requires the same area and a still-absent record, and preserves pending intent', () => {
  const f = fixture({ stored: encode(false) });
  f.event(null, { eventKey: null });
  assert.equal(
    f.preferences.snapshot().showRemains,
    false,
    'A stale clear cannot replace a record.',
  );
  f.data.clear();
  f.event(null, { eventKey: null, area: {} });
  assert.equal(f.preferences.snapshot().showRemains, false);
  f.event(null, { eventKey: null });
  assert.equal(f.preferences.snapshot().showRemains, true);
  assert.equal(f.preferences.snapshot().durable, true);
  assert.deepEqual(f.writes, []);
  f.fail('quota');
  f.preferences.set(false);
  f.event(null, { eventKey: null });
  assert.equal(f.preferences.snapshot().showRemains, false);
  assert.equal(f.preferences.snapshot().durable, false);
  f.preferences.dispose();
});

test('read-only hosts retain local intent through events and restore, then explicit retry saves', () => {
  let allowed = false;
  const f = fixture({ stored: encode(), writable: () => allowed });
  f.preferences.set(false);
  assert.equal(f.preferences.snapshot().durable, false);
  assert.equal(f.preferences.snapshot().warningKey, sessionOnly);
  f.preferences.retry();
  f.event(encode());
  f.restore();
  assert.equal(f.preferences.snapshot().showRemains, false);
  assert.deepEqual(f.writes, []);
  allowed = true;
  const result = f.preferences.retry();
  assert.equal(result.durable, true);
  assert.equal(result.warningKey, '');
  assert.deepEqual(f.writes, [[key, encode(false)]]);
  assert.deepEqual(
    f.warnings.map(([, warningKey]) => warningKey),
    [sessionOnly, ''],
  );
  f.preferences.dispose();
});

for (const failure of ['quota', 'silent', 'read'])
  test(`${failure} storage failure retains intent and retry verifies the saved bytes`, () => {
    const f = fixture({ stored: encode() });
    f.fail(failure);
    f.preferences.set(false);
    assert.equal(f.preferences.snapshot().showRemains, false);
    assert.equal(f.preferences.snapshot().durable, false);
    assert.equal(f.preferences.snapshot().warningKey, failed);
    f.fail();
    f.event(encode());
    f.restore();
    assert.equal(f.preferences.snapshot().showRemains, false);
    f.preferences.retry();
    assert.equal(f.data.get(key), encode(false));
    assert.equal(f.preferences.snapshot().durable, true);
    f.data.set(key, encode());
    f.event(encode());
    assert.equal(f.preferences.snapshot().showRemains, true, 'Successful retry restores sharing.');
    f.preferences.dispose();
  });

test('unavailable storage and failed feedback keep the true default and usable local choices', () => {
  const f = fixture({
    unavailable: true,
    onWarning() {
      throw new Error('View detached');
    },
  });
  assert.equal(f.preferences.snapshot().showRemains, true);
  assert.equal(f.preferences.snapshot().warningKey, failed);
  f.preferences.set(false);
  f.preferences.retry();
  f.restore();
  assert.equal(f.preferences.snapshot().showRemains, false);
  assert.equal(f.preferences.snapshot().durable, false);
  assert.deepEqual(f.writes, []);
  f.preferences.dispose();
});

test('reentrant observers publish current intent and a failing observer cannot block persistence', () => {
  const f = fixture(),
    seen = [];
  f.preferences.subscribe((state) => {
    if (!state.showRemains) f.preferences.set(true);
  });
  f.preferences.subscribe(() => {
    throw new Error('View failed');
  });
  f.preferences.subscribe((state) => seen.push(state));
  const result = f.preferences.set(false);
  assert.strictEqual(result, f.preferences.snapshot());
  assert.equal(result.showRemains, true);
  assert.equal(result.durable, true);
  assert.equal(
    seen.every((state) => state.showRemains),
    true,
  );
  assert.equal(f.data.get(key), encode());
  f.preferences.dispose();
});

test('warning callbacks can choose newer intent without stale notifications or writes', () => {
  let preferences;
  const f = fixture({
    writable: () => false,
    onWarning() {
      preferences.set(true);
    },
  });
  preferences = f.preferences;
  const seen = [];
  preferences.subscribe((state) => seen.push(state));
  const result = preferences.set(false);
  assert.strictEqual(result, preferences.snapshot());
  assert.equal(result.showRemains, true);
  assert.equal(result.warningKey, sessionOnly);
  assert.equal(
    seen.every((state) => state.showRemains),
    true,
  );
  assert.deepEqual(f.writes, []);
  preferences.dispose();
});

test('reentrant storage reads cannot adopt older external state over new local intent', () => {
  for (const hook of ['getStorage', 'getItem']) {
    for (const restore of [false, true]) {
      const f = fixture();
      f.data.set(key, encode(false));
      f.hooks[hook] = () => f.preferences.set(true);
      if (restore) f.restore();
      else f.event(encode(false));
      assert.equal(f.preferences.snapshot().showRemains, true);
      assert.equal(f.preferences.snapshot().durable, true);
      assert.equal(f.data.get(key), encode());
      f.preferences.dispose();
    }
  }
});

test('reentrant storage writes retain newer unsaved intent until an explicit retry', () => {
  const f = fixture();
  f.hooks.setItem = () => f.preferences.set(true);
  const result = f.preferences.set(false);
  assert.strictEqual(result, f.preferences.snapshot());
  assert.equal(result.showRemains, true);
  assert.equal(result.durable, false, 'An older completed write cannot mark newer intent saved.');
  assert.equal(result.warningKey, failed);
  assert.equal(f.data.get(key), encode(false));
  assert.equal(f.writes.length, 1, 'Storage callbacks do not recursively write.');
  f.event(encode(false));
  f.restore();
  assert.equal(f.preferences.snapshot().showRemains, true);
  f.preferences.retry();
  assert.equal(f.preferences.snapshot().durable, true);
  assert.equal(f.data.get(key), encode());
  f.preferences.dispose();
});

test('readback cannot clear newer intent accepted inside the storage callback', () => {
  const f = fixture();
  f.hooks.setItem = () => {
    f.hooks.getItem = () => f.preferences.set(true);
  };
  const result = f.preferences.set(false);
  assert.equal(result.showRemains, true);
  assert.equal(result.durable, false);
  assert.equal(result.warningKey, failed);
  assert.equal(f.data.get(key), encode(false));
  f.preferences.retry();
  assert.equal(f.data.get(key), encode());
  assert.equal(f.preferences.snapshot().durable, true);
  f.preferences.dispose();
});

test('a reentrant pre-write read or writable guard cannot persist obsolete intent', () => {
  for (const hook of ['getStorage', 'getItem']) {
    const f = fixture();
    f.hooks[hook] = () => f.preferences.set(true);
    f.preferences.set(false);
    assert.equal(f.preferences.snapshot().showRemains, true);
    assert.equal(f.preferences.snapshot().durable, false);
    assert.deepEqual(f.writes, []);
    f.preferences.retry();
    assert.equal(f.data.get(key), encode());
    f.preferences.dispose();
  }
  let preferences;
  const f = fixture({
    writable: () => {
      preferences.dispose();
      return true;
    },
  });
  preferences = f.preferences;
  preferences.set(false);
  assert.deepEqual(f.writes, []);
  assert.equal(f.handlers.size, 0);
});

test('same-value retries notify durability recovery without duplicate restore notifications', () => {
  const f = fixture(),
    seen = [];
  f.preferences.subscribe((state) => seen.push(state));
  f.fail('quota');
  f.preferences.set(true);
  assert.equal(seen.at(-1).durable, false);
  const failedRevision = seen.at(-1).revision;
  f.fail();
  f.preferences.retry();
  assert.equal(seen.at(-1).showRemains, true);
  assert.equal(seen.at(-1).durable, true);
  assert.ok(seen.at(-1).revision > failedRevision);
  f.restore();
  f.event(encode());
  assert.equal(seen.length, 3);
  f.preferences.dispose();
});

test('disposal and unsubscription stop observers, late events and future mutation', () => {
  const f = fixture();
  let calls = 0;
  const listener = () => calls++;
  const off = f.preferences.subscribe(listener);
  assert.throws(() => f.preferences.subscribe(listener), /already subscribed/);
  assert.throws(() => f.preferences.subscribe(null), TypeError);
  off();
  f.preferences.set(false);
  assert.equal(calls, 1);
  f.preferences.dispose();
  f.preferences.dispose();
  assert.equal(f.handlers.size, 0);
  const before = f.preferences.snapshot();
  f.data.set(key, encode());
  f.event(encode());
  f.restore();
  assert.strictEqual(f.preferences.snapshot(), before);
  assert.throws(() => f.preferences.set(true), /disposed/);
  assert.throws(() => f.preferences.retry(), /disposed/);
  assert.throws(() => f.preferences.subscribe(listener), /disposed/);
});

test('disposal during storage access or notification prevents subsequent writes and observers', () => {
  for (const hook of ['getStorage', 'getItem']) {
    const f = fixture();
    f.hooks[hook] = () => f.preferences.dispose();
    f.preferences.set(false);
    assert.deepEqual(f.writes, []);
    assert.equal(f.handlers.size, 0);
  }
  const f = fixture();
  let later = 0;
  f.preferences.subscribe((state) => {
    if (!state.showRemains) f.preferences.dispose();
  });
  f.preferences.subscribe(() => later++);
  f.preferences.set(false);
  assert.equal(later, 1);
  assert.equal(f.handlers.size, 0);
  assert.deepEqual(f.writes, [[key, encode(false)]]);
});
