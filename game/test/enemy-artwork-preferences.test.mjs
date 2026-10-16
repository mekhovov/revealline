import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMY_ARTWORK_PREFERENCES_KEY as key,
  createEnemyArtworkPreferences,
  sharedEnemyArtwork,
  runtimeActorArtRevision,
  actorArtReviewRevision,
} from '../hunt/preferences.mjs';

const encode = (style) => JSON.stringify({ format: 'EnemyArtworkPreferencesV1', style });

function fixture(stored) {
  const data = new Map(stored === undefined ? [] : [[key, stored]]),
    writes = [],
    window = new EventTarget();
  let denied = false;
  const storage = {
    getItem: (name) => data.get(name) ?? null,
    setItem(name, value) {
      if (denied) throw new Error('Storage is full.');
      writes.push([name, value]);
      data.set(name, value);
    },
  };
  const preferences = createEnemyArtworkPreferences({ window, getStorage: () => storage });
  return {
    data,
    writes,
    storage,
    preferences,
    deny(value) {
      denied = value;
    },
    event(newValue, { name = key, area = storage } = {}) {
      window.dispatchEvent(
        Object.assign(new Event('storage'), { key: name, storageArea: area, newValue }),
      );
    },
    restore() {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    },
  };
}

test('enemy artwork defaults to authored and reads valid saved styles without writing', () => {
  assert.equal(key, 'revealline.enemy-art.v1');
  for (const style of [undefined, 'authored', 'military']) {
    const f = fixture(style === undefined ? undefined : encode(style));
    try {
      assert.deepEqual(f.preferences.snapshot(), {
        style: style ?? 'authored',
        durable: true,
        revision: 0,
      });
      assert.ok(Object.isFrozen(f.preferences.snapshot()));
      assert.deepEqual(f.writes, []);
    } finally {
      f.preferences.dispose();
    }
  }
  assert.equal(sharedEnemyArtwork(), sharedEnemyArtwork());
});

test('explicit artwork choices persist only their dedicated key and reject invalid patches', () => {
  const f = fixture();
  for (const name of [
    'revealline.actor-appearance.v1',
    'revealline.encounter-variant.v1',
    'revealline.destruction.v1',
    'revealline.running-enemies.v2',
  ])
    f.data.set(name, `retained:${name}`);
  const otherRecords = new Map(f.data),
    initial = f.preferences.snapshot();
  try {
    for (const style of ['military', 'authored']) {
      const result = f.preferences.set({ style });
      assert.equal(result.style, style);
      assert.equal(result.durable, true);
      assert.equal(f.data.get(key), encode(style));
    }
    assert.equal(initial.style, 'authored');
    assert.equal(initial.revision, 0);
    assert.deepEqual(f.writes, [
      [key, encode('military')],
      [key, encode('authored')],
    ]);
    for (const [name, value] of otherRecords) assert.equal(f.data.get(name), value);
    const before = f.preferences.snapshot();
    for (const patch of [
      { style: 'unknown' },
      { style: true },
      { style: undefined },
      { style: 'military', cast: 'tactical' },
    ])
      assert.throws(() => f.preferences.set(patch), TypeError);
    assert.equal(f.preferences.snapshot(), before);
    assert.equal(f.writes.length, 2);
  } finally {
    f.preferences.dispose();
  }
});

test('corrupt and unsupported stored versions remain untouched through local choice and retry', () => {
  for (const stored of [
    'not JSON',
    '{"format":"EnemyArtworkPreferencesV2","style":"military"}',
    '{"format":"EnemyArtworkPreferencesV1","style":"unknown"}',
    '{"format":"EnemyArtworkPreferencesV1","style":"military","enabled":true}',
  ]) {
    const f = fixture(stored);
    try {
      assert.equal(f.preferences.snapshot().style, 'authored');
      assert.equal(f.preferences.snapshot().durable, false);
      f.preferences.set({ style: 'military' });
      f.preferences.retry();
      assert.equal(f.preferences.snapshot().style, 'military');
      assert.equal(f.preferences.snapshot().durable, false);
      assert.equal(f.data.get(key), stored);
      assert.deepEqual(f.writes, []);
      f.data.delete(key);
      f.restore();
      assert.equal(f.preferences.snapshot().style, 'military');
      assert.equal(f.preferences.retry().durable, true);
      assert.equal(f.data.get(key), encode('military'));
    } finally {
      f.preferences.dispose();
    }
  }
});

test('cross-tab updates require matching current bytes and storage and stop after disposal', () => {
  const f = fixture(),
    observations = [];
  f.preferences.subscribe((state) => observations.push(state.style));
  try {
    f.event(encode('military'));
    assert.equal(f.preferences.snapshot().style, 'authored');
    f.data.set(key, encode('military'));
    f.event(encode('military'), { name: 'other' });
    f.event(encode('military'), { area: {} });
    f.event(encode('authored'));
    assert.equal(f.preferences.snapshot().style, 'authored');
    f.event(encode('military'));
    assert.equal(f.preferences.snapshot().style, 'military');
    const revision = f.preferences.snapshot().revision;
    f.event(encode('military'));
    assert.equal(f.preferences.snapshot().revision, revision);
    f.data.set(key, 'invalid');
    f.event('invalid');
    assert.equal(f.preferences.snapshot().style, 'military');
    f.data.clear();
    f.event(null, { name: null });
    assert.equal(f.preferences.snapshot().style, 'authored');
    assert.deepEqual(observations, ['authored', 'military', 'authored']);
    assert.deepEqual(f.writes, []);
    f.preferences.dispose();
    f.data.set(key, encode('military'));
    f.event(encode('military'));
    f.restore();
    assert.equal(f.preferences.snapshot().style, 'authored');
    assert.throws(() => f.preferences.set({ style: 'military' }), /disposed/);
  } finally {
    f.preferences.dispose();
  }
});

test('failed saves retain session artwork across external updates until retry succeeds', () => {
  const f = fixture();
  try {
    f.deny(true);
    f.preferences.set({ style: 'military' });
    assert.equal(f.preferences.snapshot().durable, false);
    f.data.set(key, encode('authored'));
    f.event(encode('authored'));
    f.restore();
    assert.equal(f.preferences.snapshot().style, 'military');
    f.deny(false);
    assert.equal(f.preferences.retry().durable, true);
    assert.equal(f.data.get(key), encode('military'));
  } finally {
    f.preferences.dispose();
  }
});

test('explicit URL review pins outrank runtime artwork while navigation remains URL-only', () => {
  const location = (query = '') => ({ href: `https://example.test/game/${query}` });
  for (const revision of ['industrial-pilot-v1', 'industrial-overhead-v2', 'industrial-roster-v3'])
    for (const style of ['authored', 'military']) {
      const url = location(`?artReview=${revision}`);
      assert.equal(runtimeActorArtRevision(url, { style }), revision);
      assert.equal(actorArtReviewRevision(url), revision);
    }
  for (const url of [
    location(),
    location('?artReview=unknown'),
    location('?artReview=industrial-roster-v3&artReview=industrial-roster-v3'),
    { href: 'invalid' },
    null,
  ]) {
    assert.equal(runtimeActorArtRevision(url, { style: 'military' }), 'industrial-roster-v3');
    assert.equal(runtimeActorArtRevision(url, { style: 'authored' }), null);
    assert.equal(actorArtReviewRevision(url), null);
  }
  assert.equal(
    runtimeActorArtRevision(location()),
    sharedEnemyArtwork().snapshot().style === 'military' ? 'industrial-roster-v3' : null,
  );
});
