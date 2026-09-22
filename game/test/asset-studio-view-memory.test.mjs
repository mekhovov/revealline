import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStudioViewMemory,
  resolveStudioView,
  STUDIO_VIEW_KEY,
} from '../../authoring/asset-studio/view-memory.mjs';

const filters = {
  query: 'play',
  screen: 'flight',
  state: 'default',
  kind: 'image',
  quality: 'reviewed',
};
function fixture(state = null) {
  const calls = [];
  const history = {
    state,
    replaceState(value, title, ...url) {
      this.state = structuredClone(value);
      calls.push({ title, url });
    },
  };
  return { history, calls, memory: createStudioViewMemory(() => history) };
}

test('history position retains foreign state without adding entries, changing URLs or storing workspace data', () => {
  const { history, calls, memory } = fixture({ toolReturn: { screen: 'workshop' } });
  assert.equal(memory.read(), null);
  assert.equal(memory.write('icon.play', filters), true);
  assert.deepEqual(history.state.toolReturn, { screen: 'workshop' });
  assert.deepEqual(calls, [{ title: '', url: [] }]);
  assert.deepEqual(memory.read(), { version: 1, selected: 'icon.play', filters });
  const copy = memory.read();
  copy.filters.query = 'changed';
  assert.equal(memory.read().filters.query, 'play');
});

test('removed slots and filter options reconcile independently without changing the remembered record', () => {
  const { memory } = fixture();
  memory.write('icon.play', filters);
  const saved = memory.read();
  assert.deepEqual(
    resolveStudioView(saved, ['icon.pause'], {
      screen: [''],
      state: ['default'],
      kind: ['image'],
      quality: [''],
    }),
    {
      selected: null,
      filters: { ...filters, screen: '', quality: '' },
    },
  );
  assert.deepEqual(memory.read(), saved);
  assert.equal(resolveStudioView(null, [], {}), null);
});

test('unreadable, malformed, oversized and future history records do not break authoring or overwrite future data', () => {
  for (const value of [
    null,
    [],
    {},
    { version: 1, selected: 'icon.play', filters: {} },
    { version: 1, selected: 'x'.repeat(161), filters },
    { version: 1, selected: 'icon.play', filters: { ...filters, query: 'x'.repeat(161) } },
  ]) {
    assert.equal(fixture({ [STUDIO_VIEW_KEY]: value }).memory.read(), null);
  }
  const future = { [STUDIO_VIEW_KEY]: { version: 2, data: ['retained'] } };
  const { memory, history, calls } = fixture(future);
  assert.equal(memory.read(), null);
  assert.equal(memory.write('icon.play', filters), false);
  assert.deepEqual(history.state, future);
  assert.equal(calls.length, 0);
  for (const getHistory of [
    () => {
      throw Error('denied');
    },
    () => ({
      get state() {
        throw Error('denied');
      },
    }),
    () => ({
      state: null,
      replaceState() {
        throw Error('denied');
      },
    }),
  ]) {
    const unavailable = createStudioViewMemory(getHistory);
    assert.equal(unavailable.read(), null);
    assert.equal(unavailable.write('icon.play', filters), false);
  }
  assert.equal(fixture('foreign opaque value').memory.write('icon.play', filters), false);
});
