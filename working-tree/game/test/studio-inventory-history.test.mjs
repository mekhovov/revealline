import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStudioInventoryHistory,
  normalizeStudioInventoryView,
  STUDIO_INVENTORY_HISTORY_KEY as KEY,
} from '../../authoring/asset-studio/inventory-history.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';

const document = createDefaultThemeBundle();
const presentation = resolvePresentation(document);
const scout = 'player.scout.detailed';
const host = (state = null) => ({
  history: {
    state,
    calls: [],
    replaceState(next, ...rest) {
      this.calls.push([next, ...rest]);
      this.state = structuredClone(next);
    },
    pushState() {
      assert.fail('Inventory changes must not create history entries.');
    },
  },
});

test('entry hint preserves exact valid selection, including a filtered-out inspector', () => {
  for (const query of ['player', 'no matching slot at all']) {
    const view = normalizeStudioInventoryView({ selected: scout, query }, document, presentation);
    assert.equal(view.selected, scout);
    assert.equal(view.query, query);
  }
});

test('missing selection uses actual matching slots; empty results retain a valid inspector', () => {
  const view = normalizeStudioInventoryView(
    { selected: 'removed.slot', query: 'player' },
    document,
    presentation,
  );
  assert.match(view.selected, /^player\./);
  assert.equal(
    normalizeStudioInventoryView(
      { selected: 'removed.slot', query: 'no matching slot at all' },
      document,
      presentation,
    ).selected,
    document.slots[0].id,
  );
});

test('malformed and unavailable filters normalize without accepting foreign workspace data', () => {
  const before = JSON.stringify(document);
  const view = normalizeStudioInventoryView(
    {
      selected: {},
      query: 'x'.repeat(513),
      screen: 'removed-screen',
      state: 'removed-state',
      kind: 'video',
      quality: 'approved',
      workspace: 'foreign',
    },
    document,
    presentation,
  );
  assert.deepEqual(view, {
    version: 1,
    selected: document.slots[0].id,
    query: '',
    screen: '',
    state: '',
    kind: '',
    quality: '',
  });
  assert.equal(JSON.stringify(document), before);
  assert.deepEqual(normalizeStudioInventoryView(null, document, presentation), view);
});

test('history updates only its versioned key, preserving foreign state and URL', () => {
  const h = host({ route: { keep: ['exact', 17] }, unrelated: new Map([['a', 1]]) });
  const history = createStudioInventoryHistory(h);
  const view = normalizeStudioInventoryView(
    { selected: scout, query: 'player', quality: 'unfinished' },
    document,
    presentation,
  );
  assert.equal(
    history.write({ ...view, assetBytes: 'must never persist', theme: 'not a view filter' }),
    true,
  );
  assert.deepEqual(h.history.state.route, { keep: ['exact', 17] });
  assert.deepEqual(h.history.state.unrelated, new Map([['a', 1]]));
  assert.deepEqual(history.read(), view);
  assert.equal(h.history.calls.length, 1);
  assert.equal(h.history.calls[0].length, 2, 'No URL replacement or push is requested.');
  assert.deepEqual(Object.keys(h.history.state[KEY]).sort(), Object.keys(view).sort());
  const original = structuredClone(history.read());
  history.read().query = 'different';
  assert.deepEqual(history.read(), original);
});

test('missing, malformed, future and inaccessible history is optional and never overwritten', () => {
  for (const state of [null, {}, { [KEY]: [] }, { [KEY]: { version: 2 } }, { [KEY]: 'foreign' }])
    assert.equal(createStudioInventoryHistory(host(state)).read(), null);
  for (const state of [7, 'foreign', [], new Date(0)]) {
    const h = host(state);
    assert.equal(createStudioInventoryHistory(h).write({ selected: scout }), false);
    assert.equal(h.history.state, state);
    assert.equal(h.history.calls.length, 0);
  }
  for (const h of [
    {},
    {
      history: {
        get state() {
          throw Error('Unavailable');
        },
      },
    },
    {
      history: {
        state: null,
        replaceState() {
          throw Error('Quota');
        },
      },
    },
  ]) {
    const history = createStudioInventoryHistory(h);
    assert.equal(history.read(), null);
    assert.equal(history.write({ selected: scout }), false);
  }
});
