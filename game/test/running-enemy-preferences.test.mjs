import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RUNNING_ENEMY_PREFERENCES_KEY as key,
  createRunningEnemyPreferences,
} from '../hunt/running-enemy-preferences.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { createEncounterDisplayPreferences } from '../encounter-display-preferences.mjs';
import { createReactionPreferences } from '../journey/reaction-preferences.mjs';

const successorKey = 'revealline.running-enemies.v2';
const successor = (enabled, style = 'original') =>
  JSON.stringify({ format: 'RunningEnemyPreferencesV2', enabled, style });
const encode = (enabled) => JSON.stringify({ format: 'RunningEnemyPreferencesV1', enabled });
function fixture(stored) {
  const data = new Map(stored === undefined ? [] : [[key, stored]]),
    writes = [],
    window = new EventTarget();
  let denyWrites = false;
  const storage = {
    getItem: (name) => data.get(name) ?? null,
    setItem(name, value) {
      if (denyWrites) throw new Error('Storage is full.');
      writes.push([name, value]);
      data.set(name, value);
    },
  };
  const options = { getStorage: () => storage, window };
  const preferences = createRunningEnemyPreferences(options);
  return {
    data,
    writes,
    storage,
    window,
    options,
    preferences,
    deny(value) {
      denyWrites = value;
    },
    storageEvent(newValue, { name = key, area = storage } = {}) {
      window.dispatchEvent(
        Object.assign(new Event('storage'), { key: name, storageArea: area, newValue }),
      );
    },
    restore() {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    },
  };
}

test('running enemies default Off, read without writes and remember an explicit choice', () => {
  const f = fixture();
  assert.deepEqual(f.preferences.snapshot(), { enabled: false, style: 'original', durable: true });
  assert.deepEqual(f.writes, []);
  f.preferences.set(true);
  assert.deepEqual(f.writes, [[successorKey, successor(true)]]);
  const later = createRunningEnemyPreferences({ ...f.options, window: new EventTarget() });
  assert.deepEqual(later.snapshot(), { enabled: true, style: 'original', durable: true });
  assert.equal(f.writes.length, 1, 'Loading never repairs or rewrites a preference.');
  for (const invalid of [null, undefined, 0, 1, 'true', { enabled: true }])
    assert.throws(() => later.set(invalid), TypeError);
  assert.equal(f.writes.length, 1);
  later.dispose();
  f.preferences.dispose();
});

test('corrupt and future records survive a session choice and retry until storage is repaired', () => {
  for (const stored of [
    'not JSON',
    '{"format":"RunningEnemyPreferencesV2","enabled":true}',
    '{"format":"RunningEnemyPreferencesV1","enabled":"true"}',
    'x'.repeat(257),
  ]) {
    const f = fixture(stored);
    assert.deepEqual(f.preferences.snapshot(), {
      enabled: false,
      style: 'original',
      durable: false,
    });
    f.preferences.set(true);
    f.preferences.retry();
    assert.deepEqual(f.preferences.snapshot(), {
      enabled: true,
      style: 'original',
      durable: false,
    });
    assert.equal(f.data.get(key), stored);
    assert.deepEqual(f.writes, []);
    f.data.delete(key);
    f.restore();
    assert.equal(f.preferences.snapshot().enabled, true, 'Pending explicit intent is retained.');
    assert.deepEqual(f.preferences.retry(), { enabled: true, style: 'original', durable: true });
    assert.equal(f.data.get(successorKey), successor(true));
    f.preferences.dispose();
  }
});

test('same-page settings share choices and retire disposed observers', () => {
  const f = fixture(),
    peer = createRunningEnemyPreferences(f.options),
    observations = [];
  const acceptedBeforeChoice = f.preferences.snapshot();
  peer.subscribe((state) => observations.push(state.enabled));
  f.preferences.set(true);
  assert.deepEqual(peer.snapshot(), { enabled: true, style: 'original', durable: true });
  assert.deepEqual(observations, [false, true]);
  assert.equal(acceptedBeforeChoice.enabled, false, 'An earlier accepted snapshot is unchanged.');
  peer.set(false);
  assert.equal(f.preferences.snapshot().enabled, false);
  peer.dispose();
  f.preferences.set(true);
  assert.deepEqual(observations, [false, true, false]);
  f.preferences.dispose();
});

test('cross-tab synchronization requires current bytes and storage, and clear resets Off', () => {
  const f = fixture();
  f.data.set(key, encode(true));
  f.storageEvent(encode(true), { area: {} });
  f.storageEvent(encode(false));
  assert.equal(f.preferences.snapshot().enabled, false);
  f.storageEvent(encode(true));
  assert.equal(f.preferences.snapshot().enabled, true);
  f.data.clear();
  f.storageEvent(null, { name: null });
  assert.deepEqual(f.preferences.snapshot(), { enabled: false, style: 'original', durable: true });
  f.data.set(key, encode(true));
  f.restore();
  assert.equal(f.preferences.snapshot().enabled, true);
  f.preferences.dispose();
  f.data.set(key, encode(false));
  f.storageEvent(encode(false));
  assert.equal(f.preferences.snapshot().enabled, true, 'Disposed listeners no longer refresh.');
});

test('failed saves remain session-only across panels and external events until explicit retry', () => {
  const f = fixture(),
    peer = createRunningEnemyPreferences(f.options);
  f.deny(true);
  f.preferences.set(true);
  assert.deepEqual(peer.snapshot(), { enabled: true, style: 'original', durable: false });
  f.data.set(key, encode(false));
  f.storageEvent(encode(false));
  assert.equal(f.preferences.snapshot().enabled, true);
  assert.equal(peer.snapshot().enabled, true);
  f.deny(false);
  peer.retry();
  assert.deepEqual(f.preferences.snapshot(), { enabled: true, style: 'original', durable: true });
  assert.equal(f.data.get(successorKey), successor(true));
  peer.dispose();
  f.preferences.dispose();
});

test('blood, remains and reactions neither enable enemies nor change when enemies are enabled', () => {
  const f = fixture(),
    destruction = createDestructionPreferences(f.options),
    remains = createEncounterDisplayPreferences(f.options),
    reactions = createReactionPreferences(f.options);
  destruction.set({ brutal: true, blood: true });
  remains.set(true);
  reactions.choose(true);
  assert.equal(f.preferences.snapshot().enabled, false);
  assert.equal(f.storage.getItem(key), null);
  f.data.set('revealline.suspended.example', 'accepted attempt kept');
  const before = new Map(f.data);
  f.writes.length = 0;
  f.preferences.set(true);
  assert.deepEqual(f.writes, [[successorKey, successor(true)]]);
  for (const [name, value] of before) assert.equal(f.data.get(name), value);
  assert.equal(destruction.snapshot().brutal, true);
  assert.equal(destruction.snapshot().blood, true);
  assert.equal(remains.snapshot().showRemains, true);
  assert.equal(reactions.snapshot().enabled, true);
  destruction.dispose();
  remains.dispose();
  reactions.dispose();
  f.preferences.dispose();
});

test('varied preference migrates prospectively and peers keep frozen earlier choices', () => {
  const f = fixture(encode(true));
  const peer = createRunningEnemyPreferences(f.options);
  const accepted = f.preferences.snapshot();
  assert.equal(accepted.style, 'original');
  f.preferences.setStyle('varied');
  assert.equal(f.data.get(key), encode(true), 'The historical bytes remain intact.');
  assert.equal(f.data.get(successorKey), successor(true, 'varied'));
  assert.equal(peer.snapshot().style, 'varied');
  assert.equal(accepted.style, 'original');
  const later = createRunningEnemyPreferences({ ...f.options, window: new EventTarget() });
  assert.equal(later.snapshot().style, 'varied');
  for (const invalid of ['shield', 'brutal', null, true])
    assert.throws(() => later.setStyle(invalid));
  later.dispose();
  peer.dispose();
  f.preferences.dispose();
});
