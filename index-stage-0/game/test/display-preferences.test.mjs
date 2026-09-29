import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_PREFERENCES_KEY, createDisplayPreferences } from '../display-preferences.mjs';

const defaults = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
const encode = (patch = {}) => JSON.stringify({ ...defaults, ...patch });
const rawState = (preferences) => {
  const { textFace, textSize, reducedEffects } = preferences.snapshot();
  return { textFace, textSize, reducedEffects };
};
function fixture({ stored, reduced = false, legacyPreferences, writable, onWarning } = {}) {
  const data = new Map(stored === undefined ? [] : [[DISPLAY_PREFERENCES_KEY, stored]]),
    writes = [],
    warnings = [],
    window = new EventTarget(),
    media = Object.assign(new EventTarget(), { matches: reduced });
  let failure = null;
  const storage = {
    getItem(key) {
      assert.equal(this, storage);
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      assert.equal(this, storage);
      if (failure) throw failure;
      writes.push({ key, value, state: preferences.snapshot() });
      data.set(key, value);
    },
  };
  window.matchMedia = function (query) {
    assert.equal(this, window);
    assert.equal(query, '(prefers-reduced-motion: reduce)');
    return media;
  };
  const preferences = createDisplayPreferences({
    window,
    getStorage: () => storage,
    legacyPreferences,
    writable,
    onWarning: onWarning ?? ((message) => warnings.push(message)),
  });
  return {
    preferences,
    storage,
    data,
    writes,
    warnings,
    media,
    failSave(error) {
      failure = error;
    },
    motion(value) {
      media.matches = value;
      media.dispatchEvent(new Event('change'));
    },
    event(value, { key = DISPLAY_PREFERENCES_KEY, area = storage } = {}) {
      const event = new Event('storage');
      Object.assign(event, { key, storageArea: area, newValue: value });
      window.dispatchEvent(event);
    },
  };
}

test('shared display record overrides legacy synchronously and startup never writes', () => {
  const f = fixture({
    stored: encode({ textFace: 'plain', reducedEffects: true }),
    legacyPreferences: { textFace: 'pixel', textSize: 'large', reducedEffects: false },
  });
  assert.deepEqual(f.preferences.snapshot(), {
    textFace: 'plain',
    textSize: 'standard',
    reducedEffects: true,
    effectiveReducedEffects: true,
    revision: 0,
  });
  assert.equal(f.preferences.adoptLegacy(defaults), false);
  assert.deepEqual(f.writes, []);
});

for (const stored of [
  'not json',
  'null',
  '[]',
  '{"textFace":"plain","textSize":"large"}',
  encode({ textFace: 'serif' }),
  encode({ textSize: 'huge' }),
  encode({ reducedEffects: 1 }),
  JSON.stringify({ ...defaults, effectiveReducedEffects: true }),
  JSON.stringify({ ...defaults, revision: 3 }),
  ' '.repeat(257) + encode(),
])
  test(`invalid stored value preserves original bytes and legacy fallback: ${stored.slice(0, 55)}`, () => {
    const legacyPreferences = { ...defaults, textSize: 'large', musicEnabled: true },
      before = JSON.stringify(legacyPreferences),
      f = fixture({ stored, legacyPreferences });
    assert.deepEqual(rawState(f.preferences), { ...defaults, textSize: 'large' });
    assert.equal(JSON.stringify(legacyPreferences), before);
    assert.equal(f.data.get(DISPLAY_PREFERENCES_KEY), stored);
    assert.deepEqual(f.writes, []);
  });

test('legacy seed reads only display fields; explicit change saves three fields before navigation', () => {
  const f = fixture(),
    legacy = { ...defaults, textFace: 'plain', textSize: 'large', masterVolume: 0.1 };
  f.data.set('revealline.player', 'unchanged profile bytes');
  assert.equal(f.preferences.adoptLegacy(legacy), true);
  assert.deepEqual(f.writes, []);
  const state = f.preferences.set({ reducedEffects: true });
  assert.equal(state.effectiveReducedEffects, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].key, 'revealline.display.v1');
  assert.equal(
    f.writes[0].value,
    encode({ textFace: 'plain', textSize: 'large', reducedEffects: true }),
  );
  assert.equal(f.writes[0].state, state, 'The display changes before the save.');
  assert.equal(f.data.get('revealline.player'), 'unchanged profile bytes');
  f.preferences.dispose();
  const next = createDisplayPreferences({ getStorage: () => f.storage });
  assert.deepEqual(rawState(next), rawState(f.preferences));
  assert.equal(f.writes.length, 1, 'Navigation does not resave a record.');
  next.dispose();
});

test('late legacy snapshots cannot replace explicit same-value intent or a newer seed', () => {
  const f = fixture(),
    initial = f.preferences.snapshot().revision;
  f.preferences.set({ textFace: 'pixel' });
  assert.equal(f.preferences.snapshot().revision, initial + 1);
  assert.equal(
    f.preferences.adoptLegacy({ ...defaults, textSize: 'large' }, { expectedRevision: initial }),
    false,
  );
  const g = fixture();
  assert.equal(g.preferences.adoptLegacy({ ...defaults, textSize: 'large' }), true);
  assert.equal(g.preferences.adoptLegacy(defaults), false);
  assert.equal(g.preferences.snapshot().textSize, 'large');
  assert.deepEqual(g.writes, []);
});

test('a current shared record wins a delayed legacy read even before its storage event', () => {
  const f = fixture();
  f.data.set(DISPLAY_PREFERENCES_KEY, encode({ textFace: 'plain' }));
  assert.equal(f.preferences.adoptLegacy({ ...defaults, textSize: 'large' }), false);
  assert.equal(f.preferences.snapshot().textFace, 'plain');
  assert.equal(f.preferences.snapshot().textSize, 'standard');
  assert.deepEqual(f.writes, []);
});

test('system reduction combines conservatively without changing raw intent or saving', () => {
  const f = fixture({ reduced: true }),
    seen = [],
    off = f.preferences.subscribe((state) => seen.push(state));
  assert.equal(seen[0].effectiveReducedEffects, true);
  assert.equal(seen[0].reducedEffects, false);
  f.motion(false);
  assert.equal(seen.at(-1).effectiveReducedEffects, false);
  assert.equal(seen.at(-1).revision, 0);
  assert.equal(f.preferences.adoptLegacy({ ...defaults, reducedEffects: true }), true);
  f.motion(true);
  f.motion(false);
  assert.equal(f.preferences.snapshot().effectiveReducedEffects, true);
  assert.equal(f.preferences.snapshot().reducedEffects, true);
  assert.equal(seen.length, 3, 'An unchanged effective policy does not notify twice.');
  assert.deepEqual(f.writes, []);
  f.motion(true);
  f.preferences.set({ reducedEffects: false });
  assert.equal(f.preferences.snapshot().effectiveReducedEffects, true);
  assert.equal(JSON.parse(f.writes[0].value).reducedEffects, false);
  assert.equal(Object.hasOwn(JSON.parse(f.writes[0].value), 'effectiveReducedEffects'), false);
  off();
});

test('injected and legacy media query APIs use current matches and detach on disposal', () => {
  const listeners = new Set(),
    media = {
      matches: false,
      addListener(fn) {
        listeners.add(fn);
      },
      removeListener(fn) {
        listeners.delete(fn);
      },
    },
    p = createDisplayPreferences({
      window: new EventTarget(),
      getStorage: () => null,
      matchMedia: (query) => {
        assert.equal(query, '(prefers-reduced-motion: reduce)');
        return media;
      },
    });
  assert.equal(listeners.size, 1);
  media.matches = true;
  for (const fn of listeners) fn({ matches: false });
  assert.equal(p.snapshot().effectiveReducedEffects, true, 'Current media state owns the event.');
  p.dispose();
  assert.equal(listeners.size, 0);
});

test('missing media query capability still permits explicit reduction', () => {
  for (const matchMedia of [
    undefined,
    () => {
      throw new Error('Not supported');
    },
  ]) {
    const p = createDisplayPreferences({
      window: new EventTarget(),
      getStorage: () => null,
      matchMedia,
    });
    assert.equal(p.snapshot().effectiveReducedEffects, false);
    p.set({ reducedEffects: true });
    assert.equal(p.snapshot().effectiveReducedEffects, true);
    p.dispose();
  }
});

test('storage events require exact key, area and still-current bounded raw bytes', () => {
  const f = fixture(),
    old = encode({ textFace: 'plain' }),
    current = encode({ textSize: 'large' });
  f.data.set(DISPLAY_PREFERENCES_KEY, current);
  f.event(current, { key: 'another.preference' });
  f.event(current, { area: {} });
  f.event(old);
  assert.deepEqual(rawState(f.preferences), defaults);
  f.event(current);
  assert.equal(f.preferences.snapshot().textSize, 'large');
  assert.equal(f.preferences.adoptLegacy(defaults), false);
  f.data.delete(DISPLAY_PREFERENCES_KEY);
  f.event(null);
  f.data.set(DISPLAY_PREFERENCES_KEY, 'broken');
  f.event('broken');
  assert.equal(f.preferences.snapshot().textSize, 'large');
  assert.deepEqual(f.writes, []);
});

test('practice mode changes memory with a warning and protects unsaved intent', () => {
  const f = fixture({ stored: encode(), writable: () => false });
  f.preferences.set({ textFace: 'plain', reducedEffects: true });
  f.data.set(DISPLAY_PREFERENCES_KEY, encode({ textSize: 'large' }));
  f.event(f.data.get(DISPLAY_PREFERENCES_KEY));
  assert.deepEqual(rawState(f.preferences), {
    ...defaults,
    textFace: 'plain',
    reducedEffects: true,
  });
  assert.match(f.preferences.getWarning(), /only to this session/);
  assert.deepEqual(f.writes, []);
});

test('quota failures preserve memory, and a later successful save restores sharing', () => {
  const f = fixture({ stored: encode() });
  f.failSave(new Error('Quota exceeded'));
  f.preferences.set({ textSize: 'large' });
  f.event(encode());
  assert.equal(f.preferences.snapshot().textSize, 'large');
  assert.match(f.preferences.getWarning(), /could not be saved/);
  f.failSave(null);
  f.preferences.set({ textFace: 'plain' });
  assert.equal(f.preferences.getWarning(), '');
  f.data.set(DISPLAY_PREFERENCES_KEY, encode({ reducedEffects: true }));
  f.event(f.data.get(DISPLAY_PREFERENCES_KEY));
  assert.deepEqual(rawState(f.preferences), { ...defaults, reducedEffects: true });
});

test('unavailable storage and throwing warning callbacks cannot undo display intent', () => {
  const p = createDisplayPreferences({
    getStorage: () => {
      throw new Error('Denied');
    },
    onWarning: () => {
      throw new Error('Notice unavailable');
    },
  });
  p.set({ textFace: 'plain', textSize: 'large' });
  assert.deepEqual(rawState(p), { ...defaults, textFace: 'plain', textSize: 'large' });
  assert.match(p.getWarning(), /could not be saved/);
  p.dispose();
});

test('patch validation is atomic and rejects accessors, symbols and hidden or unknown fields', () => {
  const f = fixture(),
    before = f.preferences.snapshot();
  let getters = 0;
  const accessor = {
    get textSize() {
      getters++;
      return 'large';
    },
  };
  const hidden = Object.defineProperty({}, 'textSize', { value: 'large' });
  for (const invalid of [
    null,
    [],
    {},
    { textSize: 'huge' },
    { reducedEffects: 0 },
    { textFace: 'plain', textSize: 'huge' },
    { revision: 1 },
    { effectiveReducedEffects: true },
    { [Symbol('textSize')]: 'large' },
    Object.create({ textSize: 'large' }),
    accessor,
    hidden,
  ])
    assert.throws(() => f.preferences.set(invalid), TypeError);
  assert.equal(getters, 0);
  assert.equal(f.preferences.snapshot(), before);
  assert.deepEqual(f.writes, []);
  assert.equal(f.preferences.adoptLegacy({ ...defaults, textSize: 'large' }), true);
});

test('subscribers see immutable current state and newer reentrant intent reaches storage', () => {
  const f = fixture(),
    seen = [];
  let changed = false;
  f.preferences.subscribe((state) => {
    assert.equal(Object.isFrozen(state), true);
    if (state.textSize === 'large' && !changed) {
      changed = true;
      f.preferences.set({ textFace: 'plain' });
    }
  });
  f.preferences.subscribe((state) => seen.push(state));
  const final = f.preferences.set({ textSize: 'large' });
  assert.equal(final, f.preferences.snapshot());
  assert.deepEqual(rawState(f.preferences), { ...defaults, textFace: 'plain', textSize: 'large' });
  assert.equal(seen.at(-1), final);
  assert.equal(
    seen.filter((state) => state.textSize === 'large').every((state) => state.textFace === 'plain'),
    true,
  );
  assert.equal(
    f.data.get(DISPLAY_PREFERENCES_KEY),
    encode({ textFace: 'plain', textSize: 'large' }),
  );
});

test('a failed observer does not block other observers or persistence', () => {
  const f = fixture();
  let applied = false;
  f.preferences.subscribe((state) => {
    if (state.textSize === 'large') throw new Error('View failed');
  });
  f.preferences.subscribe((state) => {
    applied = state.textSize === 'large';
  });
  assert.throws(() => f.preferences.set({ textSize: 'large' }), AggregateError);
  assert.equal(applied, true);
  assert.equal(f.data.get(DISPLAY_PREFERENCES_KEY), encode({ textSize: 'large' }));
});

test('reentrant explicit intent during legacy adoption wins and reports the seed superseded', () => {
  const f = fixture();
  let chosen = false;
  f.preferences.subscribe((state) => {
    if (state.textSize === 'large' && !chosen) {
      chosen = true;
      f.preferences.set({ textFace: 'plain' });
    }
  });
  assert.equal(f.preferences.adoptLegacy({ ...defaults, textSize: 'large' }), false);
  assert.equal(f.preferences.snapshot().textFace, 'plain');
  assert.equal(
    f.data.get(DISPLAY_PREFERENCES_KEY),
    encode({ textFace: 'plain', textSize: 'large' }),
  );
});

test('disposal detaches both event sources and rejects later mutation or subscription', () => {
  const f = fixture(),
    seen = [];
  const off = f.preferences.subscribe((state) => seen.push(state));
  assert.throws(() => f.preferences.subscribe(null), TypeError);
  off();
  f.preferences.dispose();
  f.preferences.dispose();
  const before = f.preferences.snapshot();
  f.data.set(DISPLAY_PREFERENCES_KEY, encode({ textSize: 'large' }));
  f.event(f.data.get(DISPLAY_PREFERENCES_KEY));
  f.motion(true);
  assert.equal(f.preferences.snapshot(), before);
  assert.equal(f.preferences.adoptLegacy(defaults), false);
  assert.throws(() => f.preferences.set({ textFace: 'plain' }), /disposed/);
  assert.throws(() => f.preferences.subscribe(() => {}), /disposed/);
  assert.equal(seen.length, 1);
  assert.deepEqual(f.writes, []);
});
