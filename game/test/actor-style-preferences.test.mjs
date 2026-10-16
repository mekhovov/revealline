import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTOR_STYLE_PREFERENCES_KEY,
  createActorStylePreferences,
} from '../actor-style-preferences.mjs';

const encode = (actorStyle = 'fpv') => JSON.stringify({ actorStyle });
function fixture({ stored, writable, getStorage, onWarning } = {}) {
  const data = new Map(stored === undefined ? [] : [[ACTOR_STYLE_PREFERENCES_KEY, stored]]);
  const writes = [],
    warnings = [],
    window = new EventTarget();
  let failure = false;
  const storage = {
    getItem(key) {
      assert.equal(this, storage);
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      assert.equal(this, storage);
      if (failure) throw new Error('quota');
      writes.push([key, value]);
      data.set(key, value);
    },
  };
  const preferences = createActorStylePreferences({
    window,
    writable,
    getStorage: getStorage ?? (() => storage),
    onWarning: onWarning ?? ((message) => warnings.push(message)),
  });
  return {
    data,
    storage,
    writes,
    warnings,
    preferences,
    fail(value = true) {
      failure = value;
    },
    restore(persisted = true) {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
    },
    event(newValue, { key = ACTOR_STYLE_PREFERENCES_KEY, area = storage } = {}) {
      window.dispatchEvent(
        Object.assign(new Event('storage'), { key, storageArea: area, newValue }),
      );
    },
  };
}

test('fresh default and stored choice are synchronous, immutable and never auto-save', () => {
  for (const stored of [undefined, encode('campaign')]) {
    const f = fixture({ stored });
    assert.deepEqual(f.preferences.snapshot(), {
      actorStyle: stored === undefined ? 'fpv' : 'campaign',
      revision: 0,
    });
    assert.equal(Object.isFrozen(f.preferences.snapshot()), true);
    const seen = [];
    const off = f.preferences.subscribe((state) => seen.push(state));
    assert.strictEqual(seen[0], f.preferences.snapshot());
    assert.deepEqual(f.writes, []);
    off();
    f.preferences.dispose();
  }
});

test('invalid stored records stay untouched and do not migrate other settings', () => {
  for (const stored of [
    'bad JSON',
    'null',
    '[]',
    '{}',
    '{"actorStyle":"fpv","revision":1}',
    '{"actorStyle":"latest"}',
    '{"palette":"auto"}',
    ' '.repeat(129) + encode(),
  ]) {
    const f = fixture({ stored });
    assert.equal(f.preferences.snapshot().actorStyle, 'fpv');
    assert.equal(f.data.get(ACTOR_STYLE_PREFERENCES_KEY), stored);
    assert.deepEqual(f.writes, []);
    f.preferences.dispose();
  }
});

test('explicit selection updates controls immediately and saves only the dedicated record', () => {
  const f = fixture();
  for (const key of ['revealline.display.v1', 'revealline.menu-style.v1', 'profile', 'media'])
    f.data.set(key, `retained:${key}`);
  let observed;
  f.preferences.subscribe((state) => {
    observed = state;
    assert.equal(f.writes.length, 0);
  });
  const next = f.preferences.set({ actorStyle: 'campaign' });
  assert.strictEqual(observed, next);
  assert.deepEqual(f.writes, [[ACTOR_STYLE_PREFERENCES_KEY, encode('campaign')]]);
  for (const key of ['revealline.display.v1', 'revealline.menu-style.v1', 'profile', 'media'])
    assert.equal(f.data.get(key), `retained:${key}`);
  f.preferences.dispose();
  const later = createActorStylePreferences({ getStorage: () => f.storage });
  assert.equal(later.snapshot().actorStyle, 'campaign');
  assert.equal(f.writes.length, 1);
  later.dispose();
});

test('unsupported patches, symbols and accessors reject without executing getters', () => {
  const f = fixture(),
    first = f.preferences.snapshot();
  let accessed = false;
  const accessor = Object.defineProperty({}, 'actorStyle', {
    enumerable: true,
    get() {
      accessed = true;
      return 'campaign';
    },
  });
  for (const value of [
    {},
    null,
    [],
    'campaign',
    { actorStyle: 'bad' },
    { actorStyle: undefined },
    { actorStyle: 'fpv', themeId: 'fpv' },
    { actorStyle: 'fpv', [Symbol('extra')]: 1 },
    Object.create({ actorStyle: 'fpv' }),
    Object.defineProperty({}, 'actorStyle', { value: 'fpv' }),
    accessor,
  ])
    assert.throws(() => f.preferences.set(value), TypeError);
  assert.equal(accessed, false);
  assert.strictEqual(f.preferences.snapshot(), first);
  assert.deepEqual(f.writes, []);
  f.preferences.dispose();
});

test('storage events must match current storage, area and exact key without resaving', () => {
  const f = fixture(),
    next = encode('campaign');
  f.event(next);
  assert.equal(f.preferences.snapshot().actorStyle, 'fpv');
  f.data.set(ACTOR_STYLE_PREFERENCES_KEY, next);
  f.event(next, { key: 'other' });
  f.event(next, { area: {} });
  f.event(encode());
  assert.equal(f.preferences.snapshot().actorStyle, 'fpv');
  f.event(next);
  assert.equal(f.preferences.snapshot().actorStyle, 'campaign');
  const revision = f.preferences.snapshot().revision;
  f.event(next);
  assert.equal(f.preferences.snapshot().revision, revision);
  assert.deepEqual(f.writes, []);
  f.preferences.dispose();
});

test('failed saves preserve session intent through storage and restoration; explicit retry recovers', () => {
  const f = fixture({ stored: encode() });
  f.fail();
  f.preferences.set({ actorStyle: 'campaign' });
  assert.match(f.preferences.getWarning(), /session.*save/);
  f.event(encode());
  f.restore();
  assert.equal(f.preferences.snapshot().actorStyle, 'campaign');
  f.fail(false);
  f.preferences.set({ actorStyle: 'campaign' });
  assert.equal(f.preferences.getWarning(), '');
  f.data.set(ACTOR_STYLE_PREFERENCES_KEY, encode());
  f.event(encode());
  assert.equal(f.preferences.snapshot().actorStyle, 'fpv');
  f.preferences.dispose();
});

test('read-only and unavailable storage remain usable without feedback owning the choice', () => {
  for (const options of [
    { writable: () => false },
    {
      getStorage() {
        throw new Error('denied');
      },
    },
  ]) {
    const f = fixture({
      ...options,
      onWarning() {
        throw new Error('detached status');
      },
    });
    f.preferences.set({ actorStyle: 'campaign' });
    assert.equal(f.preferences.snapshot().actorStyle, 'campaign');
    assert.match(f.preferences.getWarning(), /session/);
    assert.deepEqual(f.writes, []);
    f.preferences.dispose();
  }
});

test('back/forward restoration accepts only current valid stored intent', () => {
  const f = fixture();
  f.data.set(ACTOR_STYLE_PREFERENCES_KEY, encode('campaign'));
  f.restore(false);
  assert.equal(f.preferences.snapshot().actorStyle, 'fpv');
  f.restore();
  assert.equal(f.preferences.snapshot().actorStyle, 'campaign');
  f.data.set(ACTOR_STYLE_PREFERENCES_KEY, 'broken');
  f.restore();
  assert.equal(f.preferences.snapshot().actorStyle, 'campaign');
  assert.deepEqual(f.writes, []);
  f.preferences.dispose();
});

test('listener failure cannot suppress other subscribers or saving accepted intent', () => {
  const f = fixture();
  let seen;
  f.preferences.subscribe((state) => {
    if (state.revision) throw new Error('listener');
  });
  f.preferences.subscribe((state) => {
    seen = state.actorStyle;
  });
  assert.throws(() => f.preferences.set({ actorStyle: 'campaign' }), AggregateError);
  assert.equal(seen, 'campaign');
  assert.deepEqual(f.writes, [[ACTOR_STYLE_PREFERENCES_KEY, encode('campaign')]]);
  f.preferences.dispose();
});

test('disposal removes observers and rejects future actions', () => {
  const f = fixture();
  let seen = 0;
  f.preferences.subscribe(() => seen++);
  f.preferences.dispose();
  f.preferences.dispose();
  f.data.set(ACTOR_STYLE_PREFERENCES_KEY, encode('campaign'));
  f.event(encode('campaign'));
  f.restore();
  assert.equal(seen, 1);
  assert.equal(f.preferences.snapshot().actorStyle, 'fpv');
  assert.throws(() => f.preferences.set({ actorStyle: 'campaign' }), /disposed/);
  assert.throws(() => f.preferences.subscribe(() => {}), /disposed/);
  assert.deepEqual(f.writes, []);
});
