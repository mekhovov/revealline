import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { waitFor } from './helpers/wait-for.mjs';
function fixture(t, chapters) {
  const doc = new Document();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  const panel = attachOptionalChaptersPanel({
    document: doc,
    getLibrary: () => ({ packs: [] }),
    sourceChapters: chapters,
    loadCatalog: async () => ({ format: 'revealline-optional-chapters.v1', packs: [] }),
  });
  t.after(() => panel.dispose());
  return { panel, $: (id) => doc.getElementById(`optional-worlds-${id}`) };
}
const chapter = (id, extra = {}) => ({
  id,
  name: id,
  description: `Exact ${id}`,
  sourceOnly: false,
  bytes: 1024,
  inspect: async () => ({ status: 'absent' }),
  choose: async () => {},
  ...extra,
});
test('only the chosen card supplies native files and shared busy blocks every other card until explicit Choose', async (t) => {
  let finish,
    seen,
    ready = false,
    selected = 0;
  const f = fixture(t, [
    chapter('a', {
      inspect: async () => ({ status: ready ? 'installed' : 'absent' }),
      install: async (files) => {
        seen = files;
        await new Promise((r) => {
          finish = r;
        });
        ready = true;
      },
      choose: async () => {
        selected++;
      },
    }),
    chapter('b', { install: () => assert.fail('other card must remain blocked') }),
  ]);
  await f.panel.open();
  const pack = new Blob(['a']),
    media = new Blob(['image-a']);
  f.$('source-a-pack').files = [pack];
  f.$('source-a-media').files = [media];
  const pending = f.$('source-a-install').onclick();
  assert.deepEqual(seen, { pack, media });
  assert(f.$('source-b-install').disabled);
  assert(f.$('source-a-choose').disabled);
  await f.$('source-b-install').onclick();
  assert.equal(selected, 0);
  finish();
  await pending;
  assert.equal(f.$('source-a-choose').disabled, false);
  assert.equal(f.$('source-b-choose').disabled, true);
  assert(f.$('dialog').open);
  await f.$('source-a-choose').onclick();
  assert.equal(selected, 1);
  assert.equal(f.$('dialog').open, false);
});
test('Back cancels old download; reopening then completing another card never publishes stale first-card readiness', async (t) => {
  let finish, signal;
  const f = fixture(t, [
    chapter('a', {
      download: async (o) => {
        signal = o.signal;
        await new Promise((r) => {
          finish = r;
        });
      },
      inspect: async () => ({ status: 'absent' }),
    }),
    chapter('b', { download: async () => {}, inspect: async () => ({ status: 'installed' }) }),
  ]);
  await f.panel.open();
  const pending = f.$('source-a-download').onclick();
  assert.match(f.$('status').textContent, /Downloading/);
  f.$('top-back').click();
  assert(signal.aborted);
  await f.panel.open();
  const current = f.$('status').textContent;
  finish();
  await pending;
  assert.equal(f.$('status').textContent, current);
  assert.equal(f.$('source-a-choose').disabled, true);
  assert.equal(f.$('source-b-choose').disabled, false);
});
test('late inspection from an old multi-card open cannot clear the new card readiness or busy owner', async (t) => {
  const jobs = [];
  let first = true;
  const f = fixture(t, [
    chapter('a'),
    chapter('b', {
      inspect: async ({ signal }) =>
        first ? { status: 'absent' } : new Promise((resolve) => jobs.push({ resolve, signal })),
    }),
  ]);
  await f.panel.open();
  f.panel.close();
  first = false;
  const old = f.panel.open();
  await waitFor(() => jobs.length === 1);
  f.panel.close();
  const fresh = f.panel.open();
  await waitFor(() => jobs.length === 2);
  jobs[0].resolve({ status: 'installed' });
  await old;
  assert(f.$('reload').disabled);
  assert.equal(f.$('source-b-choose').disabled, true);
  jobs[1].resolve({ status: 'installed' });
  await fresh;
  assert.equal(f.$('source-b-choose').disabled, false);
});
