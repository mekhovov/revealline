import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSnakeStudioPlay } from '../studio/snake-play-launch.mjs';
import { createSnakeStudioStorageLifecycle } from '../studio/snake-storage-lifecycle.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { createClassicSnakeCommunityLibrary } from '../snake/classic-community.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { captureStudioActionFocus } from '../studio/action-focus.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  classicSnakePackageIdentity,
  classicSnakePackageEntries,
  exportClassicSnakePackage,
  importClassicSnakePackage,
} from '../snake/classic-community.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const defer = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function source() {
  return {
    format: CLASSIC_PACKAGE_FORMAT,
    title: { en: 'Launch ownership', uk: 'Власність запуску' },
    entries: CLASSIC_SNAKE_LEVELS.filter(
      (entry) => entry.level.version === 'classic-snake-level.v3',
    )
      .slice(0, 2)
      .map(({ title, description, level }) => structuredClone({ title, description, level })),
  };
}
const installed = (pack) => ({
  identity: classicSnakePackageIdentity(pack),
  entries: classicSnakePackageEntries(pack),
});
const settings = () => ({
  source: source(),
  selectedIndex: 1,
  mode: 'solo',
  locale: 'uk',
  baseURL: 'https://game.example/revealline/game/studio/snake.html?lang=uk',
  isCurrent: () => true,
});

test('Studio Play pins the exact portable package and selected mission before installation yields', async () => {
  for (const mode of ['solo', 'versus', 'team']) {
    const setup = { ...settings(), mode },
      before = structuredClone(setup.source),
      gate = defer();
    let accepted;
    const pending = prepareSnakeStudioPlay({
      ...setup,
      install: async (pack, options) => {
        assert.deepEqual(options, { owner: 'studio' });
        accepted = pack;
        await gate.promise;
        // The same native portable validator is used by a real import/install.
        const roundTrip = await importClassicSnakePackage(exportClassicSnakePackage(pack));
        assert.deepEqual(roundTrip, before);
        return installed(roundTrip);
      },
    });
    setup.selectedIndex = 0;
    setup.source.entries.reverse();
    setup.source.entries[0].level.goal++;
    assert.deepEqual(accepted, before, 'The installed edition owns an immutable native snapshot.');
    gate.resolve();
    const url = new URL(await pending),
      result = installed(before);
    assert.equal(url.pathname, '/revealline/game/snake/play.html');
    assert.equal(url.searchParams.get('level'), result.entries[1].id);
    assert.equal(url.searchParams.get('community'), result.identity);
    assert.equal(url.searchParams.get('mode'), mode);
    assert.equal(url.searchParams.get('lang'), 'uk');
    assert.equal(url.searchParams.get('studio'), 'snake');
  }
});

test('invalid or retired selections never start a Studio installation', async () => {
  let calls = 0;
  const setup = { ...settings(), install: () => calls++ };
  for (const selectedIndex of [-1, 2, 0.5, NaN])
    await assert.rejects(prepareSnakeStudioPlay({ ...setup, selectedIndex }), /Choose a Snake/);
  await assert.rejects(prepareSnakeStudioPlay({ ...setup, mode: 'unknown' }), /Invalid Snake/);
  assert.equal(await prepareSnakeStudioPlay({ ...setup, isCurrent: () => false }), null);
  assert.equal(calls, 0);
});

test('newer Play or draft ownership retires earlier success and failure without undoing installation', async () => {
  let revision = 0;
  const launches = [];
  const start = () => {
    const ticket = ++revision,
      gate = defer(),
      promise = prepareSnakeStudioPlay({
        ...settings(),
        isCurrent: () => revision === ticket,
        install: async (pack) => {
          await gate.promise;
          return installed(pack);
        },
      });
    launches.push({ gate, promise });
  };
  start();
  start();
  launches[1].gate.resolve();
  assert.match(await launches[1].promise, /\/snake\/play\.html\?/);
  launches[0].gate.resolve();
  assert.equal(await launches[0].promise, null);
  start();
  revision++; // A draft edit or page retirement invalidates the pending owner.
  launches[2].gate.reject(new Error('Retired storage failure'));
  assert.equal(await launches[2].promise, null);
  start();
  launches[3].gate.reject(new Error('Current storage failure'));
  await assert.rejects(launches[3].promise, /Current storage failure/);
});

test('the shared Studio foreground lease prevents late navigation after input, blur or pagehide', async () => {
  for (const retirement of [
    'focus',
    'pointerdown',
    'keydown',
    'wheel',
    'blur',
    'hidden',
    'pagehide',
  ]) {
    const document = new Document(),
      play = document.createElement('button'),
      other = document.createElement('select');
    document.body.append(play, other);
    play.focus();
    const focus = captureStudioActionFocus(play),
      gate = defer(),
      pending = prepareSnakeStudioPlay({
        ...settings(),
        isCurrent: focus.current,
        install: async (pack) => {
          await gate.promise;
          return installed(pack);
        },
      });
    assert.equal(focus.current(), true);
    if (retirement === 'focus') other.focus();
    else if (retirement === 'hidden') {
      document.hidden = true;
      document.emit('visibilitychange');
      document.hidden = false;
    } else if (retirement === 'blur' || retirement === 'pagehide')
      document.defaultView.emit(retirement);
    else document.emit(retirement);
    // Returning focus does not restore authorization from the old gesture.
    play.focus();
    gate.resolve();
    assert.equal(await pending, null, retirement);
    focus.cancel();
    const freshFocus = captureStudioActionFocus(play);
    const fresh = await prepareSnakeStudioPlay({
      ...settings(),
      isCurrent: freshFocus.current,
      install: async (pack) => installed(pack),
    });
    assert.match(fresh, /\/snake\/play\.html\?/, retirement);
    freshFocus.cancel();
  }
});

test('Studio closes live database connections and reopens once after a cached Back or freeze', async () => {
  const document = new Document(),
    window = new Events(),
    memory = managedIndexedDB();
  let retired = 0,
    created = 0;
  const storage = createSnakeStudioStorageLifecycle({
    document,
    window,
    retire: () => retired++,
    create: () => {
      created++;
      return {
        drafts: createProfileRecordBackend({
          key: 'studio-lifecycle-test',
          empty: () => ({ draft: null }),
          validate: (value) => value,
          indexedDB: memory.indexedDB,
        }),
        library: createClassicSnakeCommunityLibrary({ indexedDB: memory.indexedDB }),
      };
    },
  });
  const original = storage.capture(),
    pack = source();
  await original.drafts.update(() => ({ draft: pack }));
  const saved = await original.library.install(pack, { owner: 'studio' });
  const closed = memory.closed;
  window.emit('pagehide', { persisted: true });
  assert.ok(
    memory.closed > closed,
    'Actual profile and library connections close before history freeze.',
  );
  assert.equal(original.current(), false);
  await assert.rejects(original.drafts.read(), /closed/);
  assert.throws(() => storage.capture(), /suspended/);
  document.emit('freeze');
  assert.equal(retired, 1);
  window.emit('pageshow', { persisted: true });
  document.emit('resume');
  assert.equal(created, 2, 'Overlapping restore signals create one set of lazy owners.');
  const restored = storage.capture();
  assert.equal(original.current(), false, 'Restoring the page cannot revive an old operation.');
  assert.deepEqual((await restored.drafts.read()).draft, pack);
  assert.equal((await restored.library.load(saved.identity)).identity, saved.identity);
  await restored.drafts.update(() => ({ draft: null }));
  assert.equal((await restored.drafts.read()).draft, null);
  document.emit('freeze');
  document.emit('resume');
  assert.equal(created, 3);
  window.emit('pagehide', { persisted: false });
  window.emit('pageshow', { persisted: true });
  document.emit('resume');
  assert.equal(created, 3, 'A final page exit cannot reopen its disposed owners.');
  assert.throws(() => storage.capture(), /suspended/);
  storage.dispose();
});

test('an old installation cannot launch the restored Studio owner', async () => {
  const document = new Document(),
    window = new Events(),
    gate = defer();
  let retired = 0;
  const storage = createSnakeStudioStorageLifecycle({
    document,
    window,
    retire: () => retired++,
    create: () => ({ library: { close() {} } }),
  });
  const old = storage.capture();
  const pending = prepareSnakeStudioPlay({
    ...settings(),
    isCurrent: old.current,
    install: async (pack) => {
      await gate.promise;
      return installed(pack);
    },
  });
  window.emit('pagehide', { persisted: true });
  window.emit('pageshow', { persisted: true });
  assert.equal(retired, 1);
  gate.resolve();
  assert.equal(await pending, null);
  assert.equal(storage.capture().current(), true);
  storage.dispose();
});

test('freezing first-use library migration closes every primary and temporary owner', async () => {
  for (const stopAtOpen of [1, 2, 3]) {
    const document = new Document(),
      window = new Events(),
      memory = managedIndexedDB();
    let storage,
      opens = 0;
    const indexedDB = {
      open(...args) {
        const request = memory.indexedDB.open(...args);
        if (++opens === stopAtOpen)
          queueMicrotask(() => window.emit('pagehide', { persisted: true }));
        return request;
      },
    };
    storage = createSnakeStudioStorageLifecycle({
      document,
      window,
      retire() {},
      create: () => ({ library: createClassicSnakeCommunityLibrary({ indexedDB }) }),
    });
    const operation = storage.capture(),
      pending = operation.library.install(source(), { owner: 'studio' });
    await assert.rejects(pending, /closed/);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(operation.current(), false);
    assert.equal(opens, stopAtOpen, 'Retirement must not start another migration connection.');
    assert.equal(memory.closed, opens, 'Every already requested connection is eventually closed.');
    window.emit('pageshow', { persisted: true });
    const restored = storage.capture(),
      installed = await restored.library.install(source(), { owner: 'studio' });
    assert.equal((await restored.library.load(installed.identity)).identity, installed.identity);
    storage.dispose();
    assert.equal(memory.closed, opens);
  }
});
