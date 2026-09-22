import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../content-design/mode-href.mjs';
import {
  missionLibraryHref,
  readMissionLibraryHandoff,
  createMissionLibrarySessionState,
  MISSION_LIBRARY_STATE_PREFIX,
} from '../mission-library/handoff.mjs';

const opaque = '["classic/pack","edition #1","campaign/1/key","same name ?&=% 🛸"]';
const baseURL =
  'https://example.test/releases/v0.83.0/site/game/index.html?pack=old&practice=1&save=old#old';
const href = (options = {}) =>
  missionLibraryHref({
    baseURL,
    currentMode: 'solo',
    mode: 'solo',
    journey: 'whole-spatial-v5',
    missionId: opaque,
    ...options,
  });

test('fixed destinations preserve release prefix across every current/destination mode', () => {
  const current = { solo: 'index.html', versus: 'couch/', team: 'couch/relay-rescue.html' };
  const destination = { solo: '', versus: 'couch/', team: 'couch/relay-rescue.html' };
  for (const [currentMode, from] of Object.entries(current))
    for (const [mode, to] of Object.entries(destination)) {
      const journey = mode === 'team' ? 'team-spatial-originals-1' : 'whole-spatial-v5';
      const actual = new URL(href({ baseURL: new URL(from, baseURL), currentMode, mode, journey }));
      assert.equal(actual.origin, 'https://example.test');
      assert.equal(actual.pathname, `/releases/v0.83.0/site/game/${to}`);
      assert.equal(actual.hash, '');
      assert.deepEqual([...actual.searchParams.keys()], ['journey', 'library-mission']);
      assert.equal(actual.searchParams.get('journey'), journey);
      assert.equal(readMissionLibraryHandoff(actual.searchParams), opaque);
    }
});

test('HTTP and file deployments retain their own directories and encoded identifiers', () => {
  for (const base of [
    'http://127.0.0.1:8768/game/',
    'file:///Users/player/My%20Game/site/game/index.html',
  ]) {
    const actual = new URL(href({ baseURL: base, mode: 'versus', journey: 'legacy' }));
    assert.equal(actual.protocol, new URL(base).protocol);
    assert.equal(actual.pathname, `${new URL('./', base).pathname}couch/`);
    assert.equal(actual.searchParams.get('journey'), 'legacy');
    assert.equal(readMissionLibraryHandoff(actual.searchParams), opaque);
  }
});

test('builder admits only known authored routes, explicit Legacy and supported host modes', () => {
  for (const journey of AUTHORED_JOURNEY_ROUTE_IDS)
    for (const mode of ['solo', 'versus'])
      assert.equal(new URL(href({ journey, mode })).searchParams.get('journey'), journey);
  for (const mode of ['solo', 'versus', 'team'])
    assert.equal(new URL(href({ mode, journey: 'legacy' })).searchParams.get('journey'), 'legacy');
  for (const journey of [
    '',
    undefined,
    '../admin',
    'https://other.test/',
    '1',
    'unknown',
    'team-spatial-originals-1',
  ])
    assert.throws(() => href({ journey }), /registered/);
  assert.throws(() => href({ mode: 'team', journey: 'whole-spatial-v5' }), /registered/);
  for (const mode of ['', 'online', '../']) {
    assert.throws(() => href({ mode }), /mode/);
    assert.throws(() => href({ currentMode: mode }), /mode/);
  }
  for (const base of [
    'javascript:alert(1)',
    'data:text/html,no',
    'ftp://example.test/game/',
    'https://name:secret@example.test/game/',
  ])
    assert.throws(() => href({ baseURL: base }), /HTTP or file/);
});

test('opaque query reader distinguishes absent, malformed and duplicate requests', () => {
  assert.equal(readMissionLibraryHandoff(new URLSearchParams('pack=old')), null);
  assert.throws(() => readMissionLibraryHandoff({ get: () => opaque }), /URLSearchParams/);
  assert.throws(
    () => readMissionLibraryHandoff(new URLSearchParams('library-mission=a&library-mission=a')),
    /Duplicate/,
  );
  for (const id of [
    '',
    '   ',
    'x'.repeat(2049),
    'nul\0id',
    'line\nid',
    'delete\x7fid',
    'control\u0085id',
    'unpaired\ud800id',
  ]) {
    assert.throws(() => href({ missionId: id }), /identity/);
    // URLSearchParams replaces an unpaired surrogate before our reader sees it;
    // the builder must reject it so it never redirects to a different identity.
    if (!id.includes('\ud800'))
      assert.throws(
        () => readMissionLibraryHandoff(new URLSearchParams({ 'library-mission': id })),
        /identity/,
      );
  }
  const id = 'x'.repeat(2048);
  assert.equal(readMissionLibraryHandoff(new URL(href({ missionId: id })).searchParams), id);
  // Parsing never resolves authority or interprets an ID as a URL.
  assert.equal(
    readMissionLibraryHandoff(new URLSearchParams({ 'library-mission': 'https://other.test/' })),
    'https://other.test/',
  );
});

const state = (extra = {}) => ({
  search: 'woven',
  collection: 'Classic',
  campaign: 'qualified campaign',
  mode: 'solo',
  selectedId: opaque,
  scroll: 125,
  ...extra,
});
function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('session state is stable across releases, isolated by host mode and touches only its key', () => {
  const storage = memoryStorage();
  storage.values.set('revealline.profile', 'untouched');
  const solo = createMissionLibrarySessionState({ mode: 'solo', storage });
  const versus = createMissionLibrarySessionState({ mode: 'versus', storage });
  assert.equal(solo.key, `${MISSION_LIBRARY_STATE_PREFIX}.solo`);
  assert.notEqual(solo.key, versus.key);
  assert.equal(solo.read(), null);
  assert.equal(solo.write(state()), true);
  assert.deepEqual(createMissionLibrarySessionState({ mode: 'solo', storage }).read(), state());
  assert.equal(versus.read(), null);
  assert.equal(storage.values.get('revealline.profile'), 'untouched');
  const copy = solo.read();
  copy.search = 'not shared';
  assert.equal(solo.read().search, 'woven');
  assert.equal(
    solo.write(state({ mode: 'team' })),
    true,
    'Filter mode may differ from the hosting mode.',
  );
});

test('failed storage retains an in-memory copy and malformed data never deletes other content', () => {
  const unavailable = {
    getItem() {
      throw new Error('Denied');
    },
    setItem() {
      throw new Error('Quota');
    },
  };
  const session = createMissionLibrarySessionState({ mode: 'team', storage: unavailable });
  assert.equal(session.write(state()), false);
  assert.deepEqual(session.read(), state());
  const storage = memoryStorage();
  const reader = createMissionLibrarySessionState({ mode: 'solo', storage });
  for (const raw of [
    'bad JSON',
    'x'.repeat(32769),
    JSON.stringify(state({ scroll: -1 })),
    JSON.stringify({ ...state(), extra: 'unknown' }),
  ]) {
    storage.values.set(reader.key, raw);
    assert.equal(reader.read(), null);
    assert.equal(storage.values.get(reader.key), raw);
  }
  assert.throws(() => reader.write(state({ search: 'x'.repeat(513) })), /state/);
  assert.throws(() => reader.write(state({ selectedId: 'bad\0id' })), /state/);
  assert.throws(() => createMissionLibrarySessionState({ mode: 'online' }), /mode/);
});

test('a failed newer write cannot be replaced by older readable storage', () => {
  const storage = memoryStorage();
  const session = createMissionLibrarySessionState({ mode: 'solo', storage });
  session.write(state({ search: 'old' }));
  const originalSet = storage.setItem;
  storage.setItem = () => {
    throw new Error('Quota');
  };
  assert.equal(session.write(state({ search: 'new' })), false);
  assert.equal(session.read().search, 'new');
  assert.equal(JSON.parse(storage.values.get(session.key)).search, 'old');
  storage.setItem = originalSet;
  assert.equal(session.write(session.read()), true);
  assert.equal(JSON.parse(storage.values.get(session.key)).search, 'new');
});
