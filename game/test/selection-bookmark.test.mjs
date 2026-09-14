import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionBookmark, resolveSelectionBookmark } from '../selection-bookmark.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createDifficultyNavigation } from '../difficulty-navigation.mjs';
import { emptyLibrary, progressFor } from '../library.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'selected-world',
  revision: '1',
  levels: [1, 2].map((n) => ({
    version: 'xonix-level.v1',
    id: `map-${n}`,
    revision: '1',
    name: `Map ${n}`,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    enemies: [{ id: 'east', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0 }],
    goal: { coverage: 0.3 },
  })),
};
const catalog = createExecutionCatalog([{ campaign, themes: [{ id: 'ukraine' }] }]);
const key = catalog.entries[0].baseCampaignKey;
const selection = { campaignKey: key, levelId: 'map-1', themeId: 'ukraine' };
function fixture() {
  const values = new Map([
    ['progress', 'untouched'],
    ['saved-flight', 'unchanged'],
  ]);
  let writes = 0;
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem(k, v) {
      writes++;
      values.set(k, v);
    },
  };
  return { values, storage, writes: () => writes };
}
function resolve(record, mode = 'standard', entries = catalog) {
  const library = emptyLibrary();
  const navigation = createDifficultyNavigation();
  const before = JSON.stringify(library);
  const result = resolveSelectionBookmark(record, {
    select: (k) => entries.select(k, mode),
    playable: (entry, index) =>
      navigation.playable(entry, library.campaigns, progressFor(library, entry.campaign), index),
  });
  assert.equal(JSON.stringify(library), before);
  return result;
}

test('remembered chapter survives a new host without touching saves or progress', () => {
  const f = fixture();
  const first = createSelectionBookmark({ storage: f.storage, key: 'menu', canWrite: () => true });
  assert.deepEqual(first.read(), { status: 'empty', selection: null });
  assert.equal(first.remember(selection), true);
  assert.equal(first.remember(selection), true);
  assert.equal(f.writes(), 1);
  const next = createSelectionBookmark({ storage: f.storage, key: 'menu' });
  const loaded = next.read();
  assert.equal(loaded.status, 'ready');
  const selected = resolve(loaded.selection, 'gentle');
  assert.equal(selected.entry.difficulty, 'gentle');
  assert.equal(selected.levelId, 'map-1');
  assert.equal(selected.themeId, 'ukraine');
  assert.equal(f.values.get('progress'), 'untouched');
  assert.equal(f.values.get('saved-flight'), 'unchanged');
});

test('locked and removed maps fall back to ordinary continuation without granting access', () => {
  const f = fixture();
  const bookmark = createSelectionBookmark({
    storage: f.storage,
    key: 'menu',
    canWrite: () => true,
  });
  for (const levelId of ['map-2', 'removed-map']) {
    assert.equal(bookmark.remember({ ...selection, levelId }), true);
    const result = resolve(bookmark.read().selection);
    assert.equal(result.entry.baseCampaignKey, key);
    assert.equal(result.levelId, undefined);
  }
});

test('same-name replacement revision never inherits the old menu selection', () => {
  const f = fixture();
  const bookmark = createSelectionBookmark({
    storage: f.storage,
    key: 'menu',
    canWrite: () => true,
  });
  bookmark.remember(selection);
  const replacement = createExecutionCatalog([
    {
      campaign: { ...campaign, revision: '2' },
      themes: [{ id: 'ukraine' }],
    },
  ]);
  assert.equal(resolve(bookmark.read().selection, 'standard', replacement), null);
  assert.equal(bookmark.read().status, 'ready');
});

test('unknown cosmetic falls back to the authored theme without changing campaign choice', () => {
  const f = fixture();
  const bookmark = createSelectionBookmark({
    storage: f.storage,
    key: 'menu',
    canWrite: () => true,
  });
  bookmark.remember({ ...selection, themeId: 'removed-theme' });
  const result = resolve(bookmark.read().selection);
  assert.equal(result.levelId, 'map-1');
  assert.equal(result.themeId, undefined);
});

test('read-only/training authorization and failed storage preserve all existing bytes', () => {
  const f = fixture();
  f.values.set('menu', 'prior');
  const denied = createSelectionBookmark({
    storage: f.storage,
    key: 'menu',
    canWrite: () => false,
  });
  assert.equal(denied.remember(selection), false);
  assert.equal(f.values.get('menu'), 'prior');
  assert.equal(f.writes(), 0);
  const failed = createSelectionBookmark({
    storage: {
      getItem() {
        throw new Error('blocked');
      },
    },
    key: 'menu',
    canWrite: () => true,
  });
  assert.equal(failed.read().status, 'unavailable');
  assert.equal(failed.remember(selection), false);
});

test('malformed, oversized and coercible stored bookmarks remain untouched', () => {
  const f = fixture();
  const bookmark = createSelectionBookmark({
    storage: f.storage,
    key: 'menu',
    canWrite: () => true,
  });
  const valid = { format: 'revealline-selection.v1', ...selection };
  for (const raw of [
    '{',
    ' '.repeat(1025),
    'null',
    '[]',
    JSON.stringify({ ...valid, campaignKey: [key] }),
    JSON.stringify({ ...valid, levelId: ['map-1'] }),
    JSON.stringify({ ...valid, themeId: ['ukraine'] }),
    JSON.stringify({ ...valid, extra: 'unknown' }),
  ]) {
    f.values.set('menu', raw);
    assert.deepEqual(bookmark.read(), { status: 'unavailable', selection: null });
    assert.equal(f.values.get('menu'), raw);
  }
  assert.equal(f.writes(), 0);
});
