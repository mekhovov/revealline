import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
} from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createTouchPreferences } from '../touch-preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { Soundscape } from '../ui/audio.mjs';

// Run the actual host callbacks against real stores/preference adapters without
// starting a browser or replacing their production API with permissive stubs.
const source = await fs.readFile(new URL('../company-player.mjs', import.meta.url), 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      for (const entry of child) {
        const found = find(entry, predicate);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  return null;
}
function callback(node, context) {
  assert.ok(node, 'production callback must exist');
  return vm.runInNewContext(`(${source.slice(node.start, node.end)})`, context);
}

test('the company host keeps multiple read-only wins in exported progress without writing another tab’s store', async () => {
  const disk = managedIndexedDB(),
    backend = createJourneyBackend({
      ...disk,
      profileKey: 'journey-coupa-adventure',
      canWrite: () => false,
    });
  const profile = createJourneyProfileStore({ backend, canWrite: () => false });
  await profile.load();
  const context = {
    writer: { writable: false },
    profile,
    awarded: false,
    localClears: new Set(),
    companySimulationIdentity: () => 'stable-gameplay',
    report() {
      assert.fail('valid completion should be adopted');
    },
  };
  const creditWin = callback(
    find(tree, (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'creditWin'),
    context,
  );
  for (const missionId of ['first-connection', 'second-connection']) {
    context.awarded = false;
    context.current = {
      run: { status: 'won', levelId: missionId },
      mission: { id: missionId },
      runId: `${missionId}-run`,
      selection: { difficulty: 'standard' },
    };
    creditWin();
    creditWin();
    assert.equal(await profile.flush(), false);
  }
  const exported = JSON.parse(profile.export()).profile;
  assert.deepEqual(Object.keys(exported.clears.solo).sort(), [
    'first-connection',
    'second-connection',
  ]);
  assert.equal(exported.generation, 2, 'an already credited win is not counted twice');
  assert.deepEqual(await backend.read(), emptyJourneyProfile());
  assert.equal(disk.allPuts.length, 0);
});

test('company pagehide uses real preference teardown APIs and preserves a cached page until final navigation', async () => {
  const listeners = new Map(),
    eventTarget = {
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
      },
      removeEventListener(type, callback) {
        listeners.get(type)?.delete(callback);
      },
    };
  const audioMaster = createAudioMaster(),
    sound = new Soundscape({ audioMaster });
  const displayPreferences = createDisplayPreferences({
    window: eventTarget,
    getStorage: () => null,
    matchMedia: () => null,
  });
  const touchPreferences = createTouchPreferences({ eventTarget, storage: null });
  const audioPreferences = createAudioPreferences({
    audioMaster,
    window: eventTarget,
    getStorage: () => null,
  });
  const calls = [];
  const context = {
    displayPreferences,
    touchPreferences,
    audioPreferences,
    audioMaster,
    sound,
    pause: () => calls.push('pause'),
    writer: { release: () => calls.push('release') },
    frame: 123,
    cancelAnimationFrame: (id) => calls.push(`cancel-${id}`),
    input: { destroy: () => calls.push('input') },
    current: { picture: { release: () => calls.push('picture') } },
    host: { preparer: { dispose: () => calls.push('preparer') } },
  };
  const registration = find(
    tree,
    (node) =>
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.object.name === 'window' &&
      node.callee.property.name === 'addEventListener' &&
      node.arguments[0]?.value === 'pagehide',
  );
  const pagehide = callback(registration.arguments[1], context);
  const listenerCount = () =>
    [...listeners.values()].reduce((sum, entries) => sum + entries.size, 0);
  assert.equal(listenerCount(), 6);
  pagehide({ persisted: true });
  assert.deepEqual(calls, ['pause']);
  assert.equal(listenerCount(), 6);
  assert.equal(sound.disposed, false);
  assert.doesNotThrow(() => pagehide({ persisted: false }));
  await Promise.resolve();
  assert.equal(listenerCount(), 0);
  assert.equal(sound.disposed, true);
  assert.throws(() => audioMaster.setMuted(false), /disposed/);
  assert.throws(() => displayPreferences.set({ reducedEffects: true }), /disposed/);
  assert.throws(() => audioPreferences.setMuted(false), /disposed/);
  assert.deepEqual(calls, [
    'pause',
    'pause',
    'release',
    'cancel-123',
    'input',
    'picture',
    'preparer',
  ]);
});

test('Home retires a staged mission and ignores its late abort or response without replacing the current run', async () => {
  for (const late of ['abort', 'resolve', 'reject']) {
    let finish, fail;
    const pending = new Promise((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    const screens = { 'play-screen': { hidden: false }, 'home-screen': { hidden: true } },
      notices = [];
    const oldRun = { id: 'original-run' },
      candidate = { id: 'candidate' };
    let cancelled = 0,
      rendered = 0;
    const context = {
      current: { run: oldRun },
      generation: 0,
      preparing: false,
      unlocked: () => true,
      missionFor: (id) => ({ id }),
      pause() {},
      preferences: { difficulty: 'standard' },
      report: (message) => notices.push(message),
      $: (id) => screens[id],
      renderCampaigns: () => {
        rendered++;
      },
      host: {
        preparer: {
          prepare: () => pending,
          current: (value) => value === candidate,
          cancel() {
            cancelled++;
            if (late === 'abort') fail(new DOMException('Preparation cancelled', 'AbortError'));
          },
          take() {
            assert.fail('Home must prevent stale mission adoption');
          },
        },
      },
    };
    const start = callback(
      find(tree, (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'start'),
      context,
    );
    const home = callback(
      find(tree, (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'showHome'),
      context,
    );
    const loading = start('next-mission');
    assert.equal(context.preparing, true);
    home();
    assert.equal(context.preparing, false);
    assert.equal(screens['home-screen'].hidden, false);
    assert.equal(screens['play-screen'].hidden, true);
    if (late === 'resolve') finish(candidate);
    if (late === 'reject') fail(new Error('old network failure'));
    await assert.doesNotReject(loading);
    assert.equal(context.current.run, oldRun);
    assert.ok(cancelled >= 1);
    assert.equal(rendered, 1);
    assert.deepEqual(notices, ['Preparing the exact mission and its artwork…']);
  }
});

test('an active mission preparation still surfaces a real failure when Home did not cancel it', async () => {
  const context = {
    generation: 0,
    preparing: false,
    unlocked: () => true,
    missionFor: (id) => ({ id }),
    pause() {},
    report() {},
    preferences: { difficulty: 'standard' },
    host: {
      preparer: {
        prepare: async () => {
          throw new Error('current artwork unavailable');
        },
      },
    },
  };
  const start = callback(
    find(tree, (node) => node.type === 'FunctionDeclaration' && node.id?.name === 'start'),
    context,
  );
  await assert.rejects(start('next-mission'), /current artwork unavailable/);
  assert.equal(context.preparing, false);
});
