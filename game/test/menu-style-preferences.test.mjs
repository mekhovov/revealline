import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MENU_STYLE_PREFERENCES_KEY,
  createMenuStylePreferences,
} from '../menu-style-preferences.mjs';
const defaults = { palette: 'auto', ornaments: 'subtle' };
const encode = (value = {}) => JSON.stringify({ ...defaults, ...value });
function fixture({ stored, writable, getStorage, onWarning } = {}) {
  const map = new Map(stored === undefined ? [] : [[MENU_STYLE_PREFERENCES_KEY, stored]]),
    writes = [],
    warnings = [],
    window = new EventTarget();
  let failure;
  const storage = {
    getItem(key) {
      assert.equal(this, storage);
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      assert.equal(this, storage);
      if (failure) throw failure;
      writes.push({ key, value, state: preferences.snapshot() });
      map.set(key, value);
    },
  };
  const preferences = createMenuStylePreferences({
    window,
    getStorage: getStorage ?? (() => storage),
    writable,
    onWarning: onWarning ?? ((message) => warnings.push(message)),
  });
  return {
    map,
    writes,
    warnings,
    preferences,
    storage,
    fail(error) {
      failure = error;
    },
    event(value, { key = MENU_STYLE_PREFERENCES_KEY, area = storage } = {}) {
      const event = Object.assign(new Event('storage'), {
        key,
        storageArea: area,
        newValue: value,
      });
      window.dispatchEvent(event);
    },
  };
}

test('validated menu startup is synchronous, immutable and does not save or read other identities', () => {
  const f = fixture({ stored: encode({ palette: 'ukrainian', ornaments: 'rich' }) });
  assert.deepEqual(f.preferences.snapshot(), {
    palette: 'ukrainian',
    ornaments: 'rich',
    revision: 0,
  });
  assert.equal(Object.isFrozen(f.preferences.snapshot()), true);
  const seen = [];
  const off = f.preferences.subscribe((state) => seen.push(state));
  assert.strictEqual(seen[0], f.preferences.snapshot());
  assert.deepEqual(f.writes, []);
  off();
  f.preferences.dispose();
});
for (const stored of [
  'not JSON',
  'null',
  '[]',
  '{}',
  '{"palette":"auto"}',
  encode({ palette: 'red-black' }),
  encode({ ornaments: 'animated' }),
  encode({ revision: 1 }),
  encode({ textFace: 'plain' }),
  ' '.repeat(257) + encode(),
]) {
  test(`invalid stored menu bytes remain untouched: ${stored.slice(0, 48)}`, () => {
    const f = fixture({ stored });
    assert.deepEqual(f.preferences.snapshot(), { ...defaults, revision: 0 });
    assert.equal(f.map.get(MENU_STYLE_PREFERENCES_KEY), stored);
    assert.deepEqual(f.writes, []);
  });
}

test('explicit partial edits update subscribers before saving only two fields and navigation does not resave', () => {
  const f = fixture();
  f.map.set('revealline.display.v1', 'exact display bytes');
  f.map.set('revealline.library.dev.v1', 'exact profile bytes');
  let applied;
  f.preferences.subscribe((state) => {
    applied = state;
  });
  const next = f.preferences.set({ ornaments: 'off' });
  assert.strictEqual(applied, next);
  assert.strictEqual(f.writes[0].state, next);
  assert.deepEqual(JSON.parse(f.writes[0].value), { ...defaults, ornaments: 'off' });
  assert.equal(f.writes[0].key, MENU_STYLE_PREFERENCES_KEY);
  assert.equal(f.map.get('revealline.display.v1'), 'exact display bytes');
  assert.equal(f.map.get('revealline.library.dev.v1'), 'exact profile bytes');
  f.preferences.dispose();
  const later = createMenuStylePreferences({ getStorage: () => f.storage });
  assert.equal(later.snapshot().ornaments, 'off');
  assert.equal(f.writes.length, 1);
  later.dispose();
});

test('invalid patches reject before callbacks or storage and never execute getters', () => {
  const f = fixture(),
    initial = f.preferences.snapshot();
  let getter = 0;
  const accessor = Object.defineProperty({}, 'palette', {
    enumerable: true,
    get() {
      getter++;
      return 'ukrainian';
    },
  });
  for (const value of [
    {},
    null,
    [],
    { palette: 'auto', ornaments: 'bad' },
    { ornaments: true },
    { revision: 3 },
    Object.create({ palette: 'auto' }),
    { [Symbol('x')]: 1 },
    accessor,
  ])
    assert.throws(() => f.preferences.set(value), TypeError);
  assert.equal(getter, 0);
  assert.strictEqual(f.preferences.snapshot(), initial);
  assert.deepEqual(f.writes, []);
});

test('a denied save keeps local intent and refuses stale cross-page state until a successful explicit save', () => {
  const f = fixture({ stored: encode() });
  f.fail(new Error('quota'));
  f.preferences.set({ palette: 'ukrainian' });
  assert.equal(f.preferences.snapshot().palette, 'ukrainian');
  assert.match(f.preferences.getWarning(), /session.*save/);
  f.event(encode());
  assert.equal(f.preferences.snapshot().palette, 'ukrainian');
  f.fail(null);
  f.preferences.set({ ornaments: 'off' });
  assert.equal(f.preferences.getWarning(), '');
  const next = encode({ palette: 'auto', ornaments: 'rich' });
  f.map.set(MENU_STYLE_PREFERENCES_KEY, next);
  f.event(next);
  assert.equal(f.preferences.snapshot().palette, 'auto');
  assert.equal(f.preferences.snapshot().ornaments, 'rich');
});

test('a read-only host changes only memory and warning failure cannot veto intent', () => {
  const f = fixture({
    writable: () => false,
    onWarning() {
      throw new Error('UI gone');
    },
  });
  f.preferences.set({ ornaments: 'rich' });
  assert.equal(f.preferences.snapshot().ornaments, 'rich');
  assert.match(f.preferences.getWarning(), /saving is disabled/);
  assert.deepEqual(f.writes, []);
});

test('storage access failure falls back and reports a failed explicit save without losing choice', () => {
  const f = fixture({
    getStorage() {
      throw new Error('denied');
    },
  });
  assert.deepEqual(f.preferences.snapshot(), { ...defaults, revision: 0 });
  f.preferences.set({ ornaments: 'off' });
  assert.equal(f.preferences.snapshot().ornaments, 'off');
  assert.match(f.preferences.getWarning(), /could not be saved/);
});

test('storage events require current identity and exact bytes; malformed, clear and unrelated events are inert', () => {
  const f = fixture(),
    next = encode({ ornaments: 'rich' }),
    initial = f.preferences.snapshot();
  f.map.set(MENU_STYLE_PREFERENCES_KEY, next);
  f.event(next, { area: {} });
  f.event(next, { key: 'revealline.display.v1' });
  f.event(encode());
  f.event(null);
  assert.strictEqual(f.preferences.snapshot(), initial);
  f.event(next);
  assert.equal(f.preferences.snapshot().ornaments, 'rich');
  assert.deepEqual(f.writes, []);
  const current = f.preferences.snapshot();
  f.map.set(MENU_STYLE_PREFERENCES_KEY, '{}');
  f.event('{}');
  assert.strictEqual(f.preferences.snapshot(), current);
});

test('reentrant subscribers persist and deliver the newer menu intent, never the superseded outer choice', () => {
  const f = fixture(),
    seen = [];
  let nested = false;
  f.preferences.subscribe((state) => {
    if (state.revision === 1 && !nested) {
      nested = true;
      f.preferences.set({ ornaments: 'off' });
    }
  });
  f.preferences.subscribe((state) => seen.push(state.ornaments));
  const result = f.preferences.set({ palette: 'ukrainian' });
  assert.deepEqual(result, { palette: 'ukrainian', ornaments: 'off', revision: 2 });
  assert.deepEqual(seen, ['subtle', 'off', 'off']);
  assert.ok(f.writes.every(({ value }) => JSON.parse(value).ornaments === 'off'));
});

test('a throwing subscriber cannot suppress persistence or other subscribers, and failed initial subscription is removed', () => {
  const f = fixture();
  let broken = 0,
    seen = 0;
  assert.throws(
    () =>
      f.preferences.subscribe(() => {
        broken++;
        throw new Error('initial');
      }),
    /initial/,
  );
  f.preferences.subscribe((state) => {
    if (state.revision) throw new Error('late');
  });
  f.preferences.subscribe(() => seen++);
  assert.throws(() => f.preferences.set({ ornaments: 'off' }), AggregateError);
  assert.equal(broken, 1);
  assert.equal(seen, 2);
  assert.equal(f.writes.length, 1);
  assert.equal(JSON.parse(f.writes[0].value).ornaments, 'off');
});

test('terminal disposal during notification prevents further writes and ignores later events', () => {
  const f = fixture();
  f.preferences.subscribe((state) => {
    if (state.revision) f.preferences.dispose();
  });
  f.preferences.set({ ornaments: 'off' });
  assert.deepEqual(f.writes, []);
  f.map.set(MENU_STYLE_PREFERENCES_KEY, encode({ ornaments: 'rich' }));
  f.event(encode({ ornaments: 'rich' }));
  assert.equal(f.preferences.snapshot().ornaments, 'off');
  assert.throws(() => f.preferences.set({ ornaments: 'rich' }), /disposed/);
  assert.throws(() => f.preferences.subscribe(() => {}), /disposed/);
  f.preferences.dispose();
});

test('disposal inside an injected permission callback cannot write after its owner closes', () => {
  let preferences;
  const f = fixture({
    writable: () => {
      preferences.dispose();
      return true;
    },
  });
  preferences = f.preferences;
  preferences.set({ ornaments: 'off' });
  assert.deepEqual(f.writes, []);
});
