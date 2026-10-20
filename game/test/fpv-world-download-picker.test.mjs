import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  mountWorldLibrary,
  WORLD_LIBRARY_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-library.mjs';
import { worldSHA256 } from '../../optional-practice/civilian-fpv/world-content.mjs';

function fixture(t, rows, response) {
  const doc = new Document();
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    Object.defineProperty(node, 'previousElementSibling', {
      get() {
        const items = this.parentElement?.children ?? [];
        return items[items.indexOf(this) - 1] ?? null;
      },
    });
    return node;
  };
  const parent = doc.createElement('div'),
    before = doc.createElement('h2');
  doc.body.append(before, parent);
  const oldWorker = globalThis.Worker;
  globalThis.Worker = class {
    postMessage(message) {
      if (message.type === 'world-read')
        queueMicrotask(() =>
          this.onmessage?.({ data: { type: 'world-done', bytes: response(message) } }),
        );
    }
    terminate() {}
  };
  t.after(() => {
    if (oldWorker) globalThis.Worker = oldWorker;
    else delete globalThis.Worker;
  });
  const installations = [];
  const ui = mountWorldLibrary({
    parent,
    initialRows: rows,
    txt: (en) => en,
    el(tag, text, className) {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    },
    begin: async () => 17,
    async install(bytes, row, options) {
      installations.push({ bytes, row, options });
      options.signal.throwIfAborted();
      options.commit();
      options.saved();
    },
  });
  t.after(() => ui.dispose());
  return { ui, installations };
}

test('Every published route is searchable before downloading world scenery', (t) => {
  const f = fixture(t, WORLD_LIBRARY_CATALOGUE, () => {
    throw new Error('Browsing must not download scenery');
  });
  const missions = f.ui.missions();
  assert.equal(missions.length, 41);
  assert.equal(
    new Set(missions.map(({ row, index }) => `${row.sha256}:${index}`)).size,
    missions.length,
  );
  assert.ok(
    missions.every(
      ({ level }) => level?.id && level.title.length === 2 && level.title.every(Boolean),
    ),
  );
  assert.equal(f.installations.length, 0);
});

test('Common picker installs only verified exact world bytes and respects cancellation', async (t) => {
  const bytes = new TextEncoder().encode('exact verified pack fixture');
  const row = {
    ...WORLD_LIBRARY_CATALOGUE[0],
    bytes: bytes.length,
    sha256: await worldSHA256(bytes),
  };
  const f = fixture(t, [row], () => bytes);
  const offered = f.ui.missions()[0].row;
  await f.ui.prepareMission(offered, { signal: new AbortController().signal });
  assert.equal(f.installations.length, 1);
  assert.equal(f.installations[0].row.sha256, row.sha256);
  assert.equal(f.installations[0].options.generation, 17);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(f.ui.prepareMission(offered, { signal: cancelled.signal }), {
    name: 'AbortError',
  });
  assert.equal(f.installations.length, 1);
});

test('Corrupt world bytes cannot be installed through the common picker', async (t) => {
  const expected = new TextEncoder().encode('expected pack');
  const row = {
    ...WORLD_LIBRARY_CATALOGUE[0],
    bytes: expected.length,
    sha256: await worldSHA256(expected),
  };
  const f = fixture(t, [row], () => new TextEncoder().encode('corrupt bytes'));
  await assert.rejects(
    f.ui.prepareMission(f.ui.missions()[0].row, { signal: new AbortController().signal }),
    /Invalid world download/,
  );
  assert.equal(f.installations.length, 0);
});
