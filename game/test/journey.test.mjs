import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyCatalog, journeyMissionId } from '../journey/catalog.mjs';
import {
  applyJourneyEvent,
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
  validateJourneyProfile,
} from '../journey/profile.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const campaigns = [
  {
    id: 'shore',
    title: 'Horizon School',
    levels: [
      { id: 'one', name: 'First cut' },
      { id: 'two', name: 'Two regions' },
    ],
  },
  {
    id: 'garden',
    title: 'Border Bloom',
    packId: 'bloom',
    levels: [{ id: 'one', name: 'Border bonus' }],
  },
  { id: 'team', title: 'Together', modes: ['team'], levels: [{ id: 'one', name: 'Two routes' }] },
];
const id = journeyMissionId({ campaignId: 'shore', levelId: 'one' });
const select = { type: 'select', mode: 'solo', missionId: id };
const complete = {
  ...select,
  type: 'complete',
  runId: 'run-1',
  gameplayId: 'exact-revision-1',
  difficulty: 'standard',
};

test('Journey navigation crosses campaigns, excludes incompatible modes and ends without wrapping', () => {
  const catalog = createJourneyCatalog(campaigns);
  assert.equal(catalog.missions.length, 4);
  assert.equal(catalog.next(id).levelId, 'two');
  assert.equal(catalog.next(catalog.missions[1].id).packId, 'bloom');
  assert.equal(catalog.next(catalog.missions[2].id), null);
  assert.equal(catalog.next('missing'), null);
  assert.equal(catalog.forMode('team').length, 1);
  assert.deepEqual(
    catalog.search('bloom BONUS').map((mission) => mission.name),
    ['Border bonus'],
  );
  assert.equal(catalog.search('cut', { campaignId: 'garden' }).length, 0);
  assert.throws(() => catalog.forMode('coop'), /Unknown/);
  assert.throws(() => createJourneyCatalog([campaigns[0], campaigns[0]]), /duplicate/);
  assert.throws(() => journeyMissionId({ campaignId: '../escape', levelId: 'one' }), /stable/);
});

test('catalog owns its data and stable IDs survive renaming or reordering', () => {
  const source = structuredClone(campaigns),
    catalog = createJourneyCatalog(source);
  source[0].levels[0].name = 'Renamed';
  source.reverse();
  assert.equal(catalog.find(id).name, 'First cut');
  assert.equal(createJourneyCatalog(source).find(id).name, 'Renamed');
  assert.ok(Object.isFrozen(catalog.find(id).modes));
});

test('skipping never grants a clear; exact legal completion removes skip and is idempotent', () => {
  const initial = emptyJourneyProfile();
  const skipped = applyJourneyEvent(initial, { ...select, type: 'skip' });
  assert.equal(Object.keys(skipped.clears.solo).length, 0);
  const cleared = applyJourneyEvent(skipped, complete);
  assert.deepEqual(cleared.skipped.solo, []);
  assert.deepEqual(applyJourneyEvent(cleared, complete), cleared);
  assert.throws(
    () => applyJourneyEvent(cleared, { ...complete, gameplayId: 'different' }),
    /identity/,
  );
  assert.equal(initial.generation, 0);
  assert.throws(() => validateJourneyProfile({ ...initial, format: 'future' }), /Unsupported/);
  assert.throws(
    () => applyJourneyEvent(initial, { ...complete, difficulty: 'invented' }),
    /receipt/,
  );
});

test('Journey profile and storage errors follow the active locale', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const invalid = { ...emptyJourneyProfile(), format: 'future' };
  const unsupported = { ...emptyJourneyProfile(), future: true };
  const malformed = null;
  const validateUnsupportedLater = () => validateJourneyProfile(unsupported);
  setLocale('uk', { persist: false });
  assert.throws(() => validateJourneyProfile(invalid), /Профіль Подорожі пошкоджений/);
  assert.throws(() => validateJourneyProfile(malformed), /Дані Подорожі мають бути об’єктом/);
  assert.throws(validateUnsupportedLater, /непідтримуване поле: future/);
  await assert.rejects(
    createJourneyBackend({ indexedDB: null }).read(),
    /Сховище Подорожі недоступне/,
  );
  setLocale('en', { persist: false });
  assert.throws(() => validateJourneyProfile(invalid), /Unsupported or damaged Journey profile/);
  assert.throws(() => validateJourneyProfile(malformed), /Journey data must be an object/);
  assert.throws(validateUnsupportedLater, /unsupported field: future/);
});

test('IndexedDB progress survives store recreation and merges concurrent tab writes atomically', async () => {
  const memory = managedIndexedDB();
  const a = createJourneyProfileStore({ backend: createJourneyBackend(memory) });
  const b = createJourneyProfileStore({ backend: createJourneyBackend(memory) });
  await Promise.all([a.load(), b.load()]);
  a.record(complete);
  b.record({ ...complete, missionId: `${id}-two`, runId: 'run-2' });
  await Promise.all([a.flush(), b.flush()]);
  const nextRelease = createJourneyProfileStore({ backend: createJourneyBackend(memory) });
  assert.equal(Object.keys((await nextRelease.load()).clears.solo).length, 2);
  assert.equal(nextRelease.status().durable, true);
});

test('batched navigation validates every event before adopting an atomic cursor/skip transition', async () => {
  const observed = [];
  const store = createJourneyProfileStore({
    backend: createJourneyBackend(managedIndexedDB()),
    onStatus: () => observed.push(store.snapshot()),
  });
  await store.load();
  observed.length = 0;
  const before = store.snapshot();
  assert.throws(() =>
    store.recordMany([
      { ...select, type: 'skip' },
      { ...select, type: 'invalid' },
    ]),
  );
  assert.deepEqual(store.snapshot(), before);
  assert.equal(observed.length, 0);
  assert.throws(() => store.recordMany([]));
  assert.throws(() => store.recordMany(Array(257).fill(select)));
  const events = [
    { ...select, type: 'skip' },
    { ...select, missionId: 'next-mission' },
  ];
  store.recordMany(events);
  events[1].missionId = 'mutated-after-adoption';
  assert.equal(observed.length, 1);
  assert.equal(observed[0].cursors.solo, 'next-mission');
  assert.deepEqual(observed[0].skipped.solo, [id]);
  assert.deepEqual(observed[0].clears.solo, {});
  assert(await store.flush());
  assert.equal(store.snapshot().cursors.solo, 'next-mission');
});

test('unavailable storage stays session-only, exports progress and retries without losing events', async () => {
  let saved = emptyJourneyProfile(),
    failing = true;
  const store = createJourneyProfileStore({
    backend: {
      async read() {
        if (failing) throw new Error('Storage unavailable');
        return saved;
      },
      async commit(events) {
        if (failing) throw new Error('Quota');
        saved = events.reduce(applyJourneyEvent, saved);
        return saved;
      },
    },
  });
  await store.load();
  assert.equal(await store.flush(), false);
  store.record(complete);
  assert.equal(await store.flush(), false);
  assert.equal(store.snapshot().clears.solo[id].runId, 'run-1');
  assert.equal(JSON.parse(store.export()).profile.clears.solo[id].runId, 'run-1');
  failing = false;
  assert.equal(await store.flush(), true);
  assert.equal(saved.clears.solo[id].runId, 'run-1');
  assert.equal(store.status().pending, 0);
});

test('a slow initial read cannot overwrite a clear recorded during loading', async () => {
  let resolveRead,
    saved = emptyJourneyProfile();
  const store = createJourneyProfileStore({
    backend: {
      read: () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
      async commit(events) {
        saved = events.reduce(applyJourneyEvent, saved);
        return saved;
      },
    },
  });
  const loading = store.load();
  store.record(complete);
  await Promise.resolve();
  resolveRead(emptyJourneyProfile());
  await loading;
  assert.equal(store.snapshot().clears.solo[id].runId, 'run-1');
  assert.equal(store.status().durable, true);
});

test('unresponsive storage has a bounded wait and late reads cannot erase session progress', async () => {
  let resolveOld,
    first = true,
    saved = emptyJourneyProfile();
  const store = createJourneyProfileStore({
    operationTimeoutMs: 10,
    backend: {
      read() {
        if (first) {
          first = false;
          return new Promise((resolve) => {
            resolveOld = resolve;
          });
        }
        return Promise.resolve(saved);
      },
      async commit(events) {
        saved = events.reduce(applyJourneyEvent, saved);
        return saved;
      },
    },
  });
  await store.load();
  assert.equal(store.status().durable, false);
  assert.match(store.status().error, /taking too long/);
  store.record(complete);
  assert.equal(await store.flush(), true);
  resolveOld(emptyJourneyProfile());
  await Promise.resolve();
  assert.equal(store.snapshot().clears.solo[id].runId, 'run-1');
});

test('corrupt durable data is never overwritten by a session event', async () => {
  let commits = 0;
  const store = createJourneyProfileStore({
    backend: {
      async read() {
        return { format: 'future-format' };
      },
      async commit() {
        commits++;
        return emptyJourneyProfile();
      },
    },
  });
  await store.load();
  store.record(select);
  assert.equal(await store.flush(), false);
  assert.equal(commits, 0);
  assert.equal(store.snapshot().cursors.solo, id);
});
