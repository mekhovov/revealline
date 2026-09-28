import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMissionGoalPreferences,
  validateMissionGoal,
  MISSION_GOAL_FORMAT,
} from '../mission-library/goal-preferences.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { Events } from './helpers/couch-dom.mjs';

const record = (missionId, editionId = 'museum', mode = 'solo') => ({
  format: MISSION_GOAL_FORMAT,
  editionId,
  mode,
  missionId,
});
test('mission goals are bounded opaque preferences isolated by stable edition and mode without completion data', () => {
  const storage = memoryStorage(),
    eventTarget = new Events();
  const make = (editionId = 'museum', mode = 'solo') =>
    createMissionGoalPreferences({
      editionId,
      mode,
      getStorage: () => storage,
      window: eventTarget,
    });
  const a = make(),
    b = make('museum', 'team'),
    c = make('other');
  assert.deepEqual(storage.writes, []);
  const id = JSON.stringify(['custom/owner', 'edition', 'campaign', 'Місія 🧵', 'revision']);
  assert.equal(a.choose(id).durable, true);
  assert.equal(make().snapshot().missionId, id);
  assert.equal(b.snapshot().missionId, null);
  assert.equal(c.snapshot().missionId, null);
  assert.deepEqual(JSON.parse(storage.getItem(a.key)), record(id));
  assert.equal(a.choose(null).missionId, null);
  assert.equal(make().snapshot().missionId, null);
  for (const invalid of ['', 'x'.repeat(2049), '\u0000bad', '\ud800', 42, { complete: true }])
    assert.throws(() => a.choose(invalid), /bounded mission/);
  for (const patch of [
    { format: 'future' },
    { editionId: 'other' },
    { mode: 'team' },
    { completed: true },
    { url: 'https://example.org' },
  ])
    assert.throws(() =>
      validateMissionGoal({ ...record(id), ...patch }, { editionId: 'museum', mode: 'solo' }),
    );
  const bytes = JSON.stringify(storage.writes);
  a.dispose();
  a.choose('ignored');
  assert.equal(JSON.stringify(storage.writes), bytes);
});

test('failed and corrupt saves remain session-only, preserve original bytes and recover explicitly', () => {
  const storage = memoryStorage(),
    options = {
      editionId: 'museum',
      mode: 'solo',
      getStorage: () => storage,
      window: new Events(),
    };
  const first = createMissionGoalPreferences(options);
  first.choose('old');
  first.dispose();
  const key = first.key,
    original = storage.getItem(key),
    write = storage.setItem;
  let writable = false;
  storage.setItem = (...args) => {
    if (!writable) throw Error('full');
    write(...args);
  };
  const goals = createMissionGoalPreferences(options);
  assert.equal(goals.choose('new').durable, false);
  assert.equal(goals.snapshot().missionId, 'new');
  assert.equal(storage.getItem(key), original);
  writable = true;
  assert.equal(goals.retry().durable, true);
  assert.equal(JSON.parse(storage.getItem(key)).missionId, 'new');
  for (const raw of [
    '{broken',
    JSON.stringify({ ...record('future'), format: 'future' }),
    JSON.stringify(record('other', 'foreign')),
  ]) {
    storage.map.set(key, raw);
    const corrupted = createMissionGoalPreferences(options);
    assert.equal(corrupted.snapshot().durable, false);
    assert.equal(corrupted.choose('local').missionId, 'local');
    assert.equal(storage.getItem(key), raw);
    corrupted.dispose();
  }
  const denied = createMissionGoalPreferences({
    ...options,
    getStorage: () => ({
      getItem() {
        throw Error('denied');
      },
      setItem() {
        throw Error('must not write');
      },
    }),
  });
  assert.equal(denied.choose('memory').durable, false);
});

test('cross-tab changes require exact current storage bytes and never discard an unsaved local goal', () => {
  const storage = memoryStorage(),
    events = new Events(),
    options = { editionId: 'museum', mode: 'solo', getStorage: () => storage, window: events },
    a = createMissionGoalPreferences(options),
    b = createMissionGoalPreferences(options);
  let notifications = 0;
  const stop = b.subscribe(() => notifications++);
  a.choose('first');
  const raw = storage.getItem(a.key);
  events.emit('storage', { key: a.key, storageArea: storage, newValue: raw });
  assert.equal(b.snapshot().missionId, 'first');
  events.emit('storage', { key: a.key, storageArea: {}, newValue: raw });
  assert.equal(notifications, 2);
  events.emit('storage', {
    key: a.key,
    storageArea: storage,
    newValue: JSON.stringify(record('stale')),
  });
  assert.equal(notifications, 2);
  const write = storage.setItem;
  storage.setItem = () => {
    throw Error('full');
  };
  b.choose('pending');
  storage.setItem = write;
  a.choose('remote');
  events.emit('storage', { key: a.key, storageArea: storage, newValue: storage.getItem(a.key) });
  assert.equal(b.snapshot().missionId, 'pending');
  assert.equal(b.retry().durable, true);
  assert.equal(JSON.parse(storage.getItem(a.key)).missionId, 'pending');
  stop();
  a.dispose();
  b.dispose();
  assert.equal(events.listeners.get('storage').size, 0);
  assert.equal(events.listeners.get('pageshow').size, 0);
});
