import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStarterProject } from '../content-design/starter.mjs';
import { forkMissionMap } from '../content-design/drafts.mjs';
import {
  readImageTrace,
  imageTraceOwner,
  assertImageTraceOwner,
  decodeImageTraceReference,
  readImageTraceFile,
} from '../content-design/image-trace.mjs';
import { createImageTraceBackend } from '../content-design/image-trace-storage.mjs';
import { createImageTraceSession } from '../content-design/image-trace-session.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createTraceRecovery } from '../studio/trace-recovery.mjs';

const png = await readFile(
  new URL('../content-design/assets/horizon-r1/first-return.png', import.meta.url),
);
const project = createStarterProject('tracing-test');
const trace = () => ({
  format: 'ContentImageTraceV1',
  ...imageTraceOwner(project, 'nearby-shore'),
  reference: { name: 'Original.png', dataUrl: `data:image/png;base64,${png.toString('base64')}` },
  crop: { x: 200, y: 100, w: 1200, h: 600 },
  rectangles: [{ surface: 'foundations', x: 40, y: 20, w: 5, h: 4 }],
  visible: true,
});

test('portable tracing retains original bytes/crop/queue but carries no publication or Apply authority', () => {
  const input = trace(),
    before = JSON.stringify(project);
  const loaded = readImageTrace(JSON.stringify(input));
  assert.deepEqual(loaded, input);
  assert.notEqual(loaded, input);
  assertImageTraceOwner(loaded, project, 'nearby-shore');
  assert.equal(JSON.stringify(project), before);
  const edited = forkMissionMap(project, 'nearby-shore', {
    foundations: [{ x: 20, y: 12, w: 5, h: 5 }],
  });
  assert.throws(
    () => assertImageTraceOwner(loaded, edited, 'nearby-shore'),
    /different map revision/,
  );
  assert.throws(
    () => assertImageTraceOwner(loaded, { ...project, id: 'other-project' }, 'nearby-shore'),
    /different project/,
  );
  assert.throws(() => imageTraceOwner(project, 'missing'), /missing/);
});

test('tracing validation rejects executable URLs, oversize structures, invalid crop/geometry and extra authority', () => {
  for (const change of [
    { reference: { name: 'Remote', dataUrl: 'https://example.com/image.png' } },
    { reference: { name: 'SVG', dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' } },
    { mapIdentity: 'not-a-map' },
    { mapIdentity: 1234567890123456 },
    { visible: 1 },
    { crop: { x: 0, y: 0, w: 9000, h: 10 } },
    { rectangles: [{ surface: 'walls', x: 0, y: 1, w: 2, h: 2 }] },
    { rectangles: Array(129).fill({ surface: 'walls', x: 1, y: 1, w: 2, h: 2 }) },
    { official: true },
    { inspected: true },
  ])
    assert.throws(() => readImageTrace({ ...trace(), ...change }));
  assert.throws(
    () =>
      readImageTrace({
        get format() {
          throw new Error('must not execute');
        },
      }),
    /accessors/,
  );
});

test('restored image is decoded and dimension-verified through the same bounded reference loader', async () => {
  let image;
  const restored = await decodeImageTraceReference(readImageTrace(trace()), {
    createImage: () =>
      (image = {
        naturalWidth: 1774,
        naturalHeight: 887,
        decode: async () => {},
        removeAttribute() {
          this.disposed = true;
        },
        set src(value) {
          this.url = value;
          queueMicrotask(() => this.onload?.());
        },
      }),
  });
  assert.equal(restored.source.dataUrl, trace().reference.dataUrl);
  assert.equal(restored.source.name, 'Original.png');
  restored.dispose();
  assert.equal(image.disposed, true);
});

test('local tracing storage keeps per-mission revisions and rejects stale writers including after clear', async () => {
  const { indexedDB } = managedIndexedDB();
  const a = createImageTraceBackend({ indexedDB }),
    b = createImageTraceBackend({ indexedDB });
  assert.deepEqual(await a.read('tracing-test', 'nearby-shore'), { revision: null, trace: null });
  const first = await a.save('tracing-test', 'nearby-shore', trace(), null);
  assert.equal(first.revision, 1);
  assert.deepEqual(await b.read('tracing-test', 'nearby-shore'), first);
  await assert.rejects(b.save('tracing-test', 'nearby-shore', trace(), null), {
    code: 'trace-conflict',
  });
  const cleared = await a.save('tracing-test', 'nearby-shore', null, 1);
  assert.deepEqual(cleared, { revision: 2, trace: null });
  await assert.rejects(b.save('tracing-test', 'nearby-shore', trace(), 1), {
    code: 'trace-conflict',
  });
  assert.deepEqual(await a.read('tracing-test', 'other-mission'), { revision: null, trace: null });
  assert.equal((await a.save('tracing-test', 'nearby-shore', trace(), 2)).revision, 3);
});

test('competing tracing writes serialize and exactly one accepts the shared predecessor', async () => {
  const { indexedDB } = managedIndexedDB();
  const a = createImageTraceBackend({ indexedDB }),
    b = createImageTraceBackend({ indexedDB });
  const results = await Promise.allSettled([
    a.save('tracing-test', 'nearby-shore', trace(), null),
    b.save('tracing-test', 'nearby-shore', trace(), null),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    results.find((result) => result.status === 'rejected').reason.code,
    'trace-conflict',
  );
});

test('failed tracing write keeps the prior draft and supports an explicit retry', async () => {
  const storage = managedIndexedDB(),
    backend = createImageTraceBackend({ indexedDB: storage.indexedDB });
  const first = await backend.save('tracing-test', 'nearby-shore', trace(), null);
  storage.failAnyPutAt = 1;
  await assert.rejects(backend.save('tracing-test', 'nearby-shore', null, 1));
  assert.deepEqual(await backend.read('tracing-test', 'nearby-shore'), first);
  storage.failAnyPutAt = null;
  assert.equal((await backend.save('tracing-test', 'nearby-shore', null, 1)).revision, 2);
});

test('missing and hung tracing storage settles without discarding caller-owned data', async () => {
  const before = trace();
  const missing = createImageTraceBackend({ indexedDB: null });
  await assert.rejects(missing.save('tracing-test', 'nearby-shore', before, null), /unavailable/);
  const stalled = createImageTraceBackend({ indexedDB: { open: () => ({}) }, timeoutMs: 5 });
  await assert.rejects(stalled.read('tracing-test', 'nearby-shore'), /open in time/);
  assert.deepEqual(before, trace());
});

const settle = () => new Promise((resolve) => setImmediate(resolve));
function sessionFixture(backend) {
  const restored = [];
  const session = createImageTraceSession({
    backend,
    restore: async (value) => restored.push(value),
  });
  session.select('tracing-test', 'nearby-shore');
  return { session, restored };
}
const memoryBackend = () => createImageTraceBackend({ indexedDB: managedIndexedDB().indexedDB });

test('tracing autosave coalesces edits arriving during a write and clear retains its revision', async () => {
  const backend = memoryBackend();
  let release,
    held = true;
  const { session } = sessionFixture({
    read: backend.read,
    save: async (...args) => {
      if (held) {
        held = false;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
      return backend.save(...args);
    },
  });
  await settle();
  session.change(trace());
  await settle();
  const newer = { ...trace(), visible: false };
  session.change(newer);
  release();
  await session.flush();
  assert.deepEqual((await backend.read('tracing-test', 'nearby-shore')).trace, newer);
  assert.equal(session.hasUnsaved(), false);
  session.change(null);
  await session.flush();
  assert.deepEqual(await backend.read('tracing-test', 'nearby-shore'), {
    revision: 3,
    trace: null,
  });
});

test('reload offers a saved trace without silently restoring or overwriting it', async () => {
  const backend = memoryBackend();
  await backend.save('tracing-test', 'nearby-shore', trace(), null);
  const { session, restored } = sessionFixture(backend);
  const newer = { ...trace(), visible: false };
  session.change(newer); // Edits made while the initial read is pending.
  await settle();
  assert.equal(session.status().needsChoice, true);
  assert.deepEqual(restored, []);
  assert.deepEqual((await backend.read('tracing-test', 'nearby-shore')).trace, trace());
  await session.replace();
  assert.deepEqual((await backend.read('tracing-test', 'nearby-shore')).trace, newer);
  await session.restore();
  assert.deepEqual(restored, [newer]);
  assert.equal(session.hasUnsaved(), false);
});

test('stale tab conflicts retain both drafts and require a fresh read and explicit replacement', async () => {
  const backend = memoryBackend();
  const a = sessionFixture(backend).session,
    b = sessionFixture(backend).session;
  await settle();
  a.change(trace());
  await a.flush();
  const newer = { ...trace(), visible: false };
  b.change(newer);
  await b.flush();
  assert.equal(b.status().error.code, 'trace-conflict');
  assert.equal(b.hasUnsaved(), true);
  await assert.rejects(b.replace(), /Read the saved/);
  await b.reload();
  assert.deepEqual(b.status().saved, trace());
  assert.deepEqual(b.pending(), newer);
  assert(b.status().needsChoice);
  await b.replace();
  assert.equal(b.hasUnsaved(), false);
  assert.deepEqual((await backend.read('tracing-test', 'nearby-shore')).trace, newer);
});

test('storage failure preserves session draft and retry does not silently replace an uncertain save', async () => {
  const storage = managedIndexedDB(),
    backend = createImageTraceBackend({ indexedDB: storage.indexedDB });
  const { session } = sessionFixture(backend);
  await settle();
  storage.failAnyPutAt = 1;
  session.change(trace());
  await session.flush();
  assert(session.status().error);
  assert.deepEqual(session.pending(), trace());
  storage.failAnyPutAt = null;
  await session.reload();
  assert(session.status().needsChoice);
  assert.equal((await backend.read('tracing-test', 'nearby-shore')).trace, null);
  await session.replace();
  assert.equal(session.hasUnsaved(), false);
});

test('mission switching never clears the previous draft and late reads report only the active owner', async () => {
  const backend = memoryBackend(),
    statuses = [];
  let release;
  const session = createImageTraceSession({
    backend: {
      ...backend,
      read: async (...args) => {
        if (args[1] === 'nearby-shore')
          await new Promise((resolve) => {
            release = resolve;
          });
        return backend.read(...args);
      },
    },
    restore: async () => {},
    onStatus: (state) => statuses.push(state?.missionId),
  });
  session.select('tracing-test', 'nearby-shore');
  session.change(trace());
  session.select('tracing-test', 'other-mission');
  await settle();
  statuses.length = 0;
  release();
  await settle();
  assert.deepEqual(statuses, []);
  assert.deepEqual((await backend.read('tracing-test', 'nearby-shore')).trace, trace());
  assert.equal(session.status().missionId, 'other-mission');
  await assert.rejects(session.restore(trace()), /different project or mission/);
  session.select('tracing-test', 'nearby-shore');
  assert.deepEqual(session.pending(), trace());
});

test('portable tracing file reads are bounded and stalled reads leave the draft intact', async () => {
  const text = JSON.stringify(trace());
  assert.deepEqual(
    await readImageTraceFile({ size: text.length, text: async () => text }),
    trace(),
  );
  await assert.rejects(
    readImageTraceFile({ size: 6 * 1024 * 1024 + 1, text: async () => text }),
    /at most/,
  );
  await assert.rejects(
    readImageTraceFile({ size: 10, text: () => new Promise(() => {}) }, { timeoutMs: 5 }),
    /timed out/,
  );
  await assert.rejects(
    readImageTraceFile({ size: 10, text: async () => '{}' }),
    /ContentImageTraceV1/,
  );
});

function recoveryFixture() {
  const elements = new Map(),
    restored = [],
    exported = [];
  let missionId = 'nearby-shore',
    current = null;
  const $ = (id) => {
    if (!elements.has(id))
      elements.set(id, { disabled: false, textContent: '', files: [], value: '' });
    return elements.get(id);
  };
  const recovery = createTraceRecovery({
    document: { getElementById: $ },
    backend: memoryBackend(),
    getSource: () => project,
    getMission: () => ({ id: missionId }),
    workbench: {
      snapshot: () => current,
      restore: async (draft) => {
        assertImageTraceOwner(draft, project, missionId);
        restored.push(draft);
        current = draft;
      },
    },
    exportFile: async (draft, name) => {
      exported.push({ draft, name });
      return { status: 'requested', message: 'Download requested, not verified as saved.' };
    },
  });
  recovery.sync();
  return {
    $,
    recovery,
    restored,
    exported,
    select(id) {
      missionId = id;
      current = null;
      recovery.sync();
    },
  };
}

test('recovery UI separates backup inspection, explicit restoration, export and map Apply', async () => {
  const { $, recovery, restored, exported } = recoveryFixture();
  await settle();
  const text = JSON.stringify(trace());
  $('trace-import').files = [{ size: text.length, text: async () => text }];
  await $('trace-import').onchange();
  assert.equal(restored.length, 0);
  assert.equal($('trace-import-restore').disabled, false);
  assert.match($('trace-status').textContent, /No geometry has changed/);
  await $('trace-import-restore').onclick();
  assert.deepEqual(restored, [trace()]);
  assert.equal(recovery.hasUnsaved(), false);
  assert.match($('trace-status').textContent, /Local tracing revision 1/);
  await $('trace-export').onclick();
  assert.deepEqual(exported[0].draft, trace());
  assert.match(exported[0].name, /tracing-test-nearby-shore-tracing.json/);
  assert.match($('trace-status').textContent, /not verified as saved/);
  await $('trace-export-saved').onclick();
  assert.deepEqual(exported[1].draft, trace());
});

test('a late backup inspection cannot populate restore controls for a different mission', async () => {
  const { $, select, restored } = recoveryFixture();
  await settle();
  let release;
  $('trace-import').files = [
    {
      size: 100,
      text: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  ];
  const loading = $('trace-import').onchange();
  select('other-mission');
  release(JSON.stringify(trace()));
  await loading;
  assert.equal($('trace-import-restore').disabled, true);
  await $('trace-import-restore').onclick();
  assert.equal(restored.length, 0);
  assert.match($('trace-status').textContent, /Inspect a tracing backup first/);
});
