import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, readdir, realpath, writeFile } from 'node:fs/promises';
import { openSync, writeSync, closeSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  HEAP_RETAINER_PROTOCOL,
  HEAP_RETAINER_SOURCE,
  HEAP_RETAINER_LIMITS,
  qualificationHeapRetainerOptions,
  createQualificationHeapRetainers,
  compareQualificationHeaps,
  heapRetainerProfileTimeout,
  verifyQualificationHeapRetainerReport,
} from './solo-qualification-heap-retainers.mjs';

const recipe = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-remote-sustained/retry-first-return-anchored.qualification.fixture',
    import.meta.url,
  ),
);
const flags = [
  `--heap-retainers=${HEAP_RETAINER_PROTOCOL}`,
  '--memory-profile',
  '--server-fixture-access',
];
const settings = {
  engine: 'chromium',
  profileMode: 'memory-profile',
  contextMode: 'ephemeral',
  scenarioBytes: recipe,
  sourceRevision: HEAP_RETAINER_SOURCE,
  address: 'http://127.0.0.1:12345/game/',
};
const options = qualificationHeapRetainerOptions(flags, settings);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function heap(extra = 0, weak = false) {
  const strings = [
    '(root)',
    'FixtureOwner',
    'HTMLDivElement',
    'HTMLSpanElement',
    'owner',
    'child',
    'additional',
  ];
  const nodes = [0, 0, 1, 1, 0, 2, 1, 3, 1 + extra, 0, 1, 2, 5, 0, 0];
  const edges = [0, 4, 5, 0, 5, 10];
  for (let i = 0; i < extra; i++) {
    nodes.push(1, 3, 7 + i * 2, 0, 2);
    edges.push(weak ? 1 : 0, 6, (3 + i) * 5);
  }
  return JSON.stringify({
    snapshot: {
      meta: {
        node_fields: ['type', 'name', 'id', 'edge_count', 'detachedness'],
        node_types: [['synthetic', 'native', 'object'], 'string', 'number', 'number', 'number'],
        edge_fields: ['type', 'name_or_index', 'to_node'],
        edge_types: [['property', 'weak'], 'string_or_number', 'node'],
      },
      node_count: 3 + extra,
      edge_count: 2 + extra,
    },
    nodes,
    edges,
    strings,
  });
}

class Session extends EventEmitter {
  calls = [];
  captures = 0;
  detached = false;
  constructor({ capture, identity } = {}) {
    super();
    this.capture = capture;
    this.identity = identity;
  }
  async send(method, args) {
    this.calls.push([method, args]);
    if (method === 'Runtime.getIsolateId') return { id: this.identity?.() ?? 'fixture-isolate' };
    if (method === 'Page.getFrameTree')
      return {
        frameTree: {
          frame: {
            id: 'fixture-frame',
            loaderId: 'fixture-loader',
            url: 'http://127.0.0.1:12345/game/?performance=1',
          },
        },
      };
    if (method === 'HeapProfiler.enable') return {};
    if (method === 'HeapProfiler.takeHeapSnapshot') {
      this.captures++;
      assert.deepEqual(args, { reportProgress: true });
      if (this.capture) return this.capture(this);
      this.emit('HeapProfiler.addHeapSnapshotChunk', { chunk: heap(this.captures === 1 ? 0 : 2) });
      this.emit('HeapProfiler.reportHeapSnapshotProgress', { done: 5, total: 5, finished: true });
      return {};
    }
    throw new Error('Unexpected protocol call ' + method);
  }
  async detach() {
    this.detached = true;
  }
}
async function owner(t, session = new Session(), fileSystem) {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'solo-retainers-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = createQualificationHeapRetainers({
    cdp: session,
    output: join(dir, 'report.json'),
    options,
    fileSystem,
  });
  return { ...result, dir, session };
}
const row = (action = '8.0.3') => ({
  group: 'completed',
  phase: 'result',
  action,
  application: { sourceRevision: HEAP_RETAINER_SOURCE },
});
const controls = () => ({
  signal: new AbortController().signal,
  verifyPhase: async () => 'result',
});
const finish = (app, browserClosed = true) =>
  app.finish({ browserClosed, deadlineAt: Date.now() + 10000 });

test('heap opt-in is absent by default and accepts only the original local source797 Retry recipe', () => {
  assert.equal(qualificationHeapRetainerOptions([], settings), null);
  assert.equal(options.protocol, HEAP_RETAINER_PROTOCOL);
  for (const malformed of [
    [...flags, flags[0]],
    ['--heap-retainers', ...flags.slice(1)],
    ['--heap-retainers=other', ...flags.slice(1)],
    [...flags, '--baseline-runtime'],
    [...flags, '--public-url=https://example.com/game/'],
    [...flags, '--fixture-access'],
    [...flags, '--manifest=anything'],
    [...flags, '--audio-proof'],
    [...flags, '--cpu-profile'],
    [...flags, '--frame-trace=anything'],
    flags.filter((value) => value !== '--server-fixture-access'),
  ])
    assert.throws(() => qualificationHeapRetainerOptions(malformed, settings));
  for (const change of [
    { engine: 'webkit' },
    { profileMode: null },
    { contextMode: 'persistent' },
    { sourceRevision: 'a'.repeat(40) },
    { scenarioBytes: Buffer.concat([recipe, Buffer.from(' ')]) },
    { address: 'https://example.com/game/' },
    { address: 'http://user:secret@127.0.0.1/game/' },
  ])
    assert.throws(() => qualificationHeapRetainerOptions(flags, { ...settings, ...change }));
});

test('exact twenty completed boundaries capture only first and last and analyze after closed-browser proof', async (t) => {
  const app = await owner(t);
  await app.observe({ group: 'prepared' }, controls());
  for (let i = 0; i < 20; i++) await app.observe(row(`8.${i}.3`), controls());
  assert.equal(app.session.captures, 2);
  assert.equal(app.report.analysis, null);
  assert(app.report.captures.every((capture) => capture.fileClosed && capture.listenersRemoved));
  assert.equal(app.session.listenerCount('HeapProfiler.addHeapSnapshotChunk'), 0);
  assert.equal(app.session.listenerCount('HeapProfiler.reportHeapSnapshotProgress'), 0);
  const report = await finish(app);
  assert.equal(report.status, 'complete-diagnostic');
  assert.equal(
    verifyQualificationHeapRetainerReport(join(app.dir, 'report.json'), report).status,
    'verified',
  );
  assert.equal(report.performanceQualification, 'excluded-memory-profiling');
  assert.equal(report.analysis.nativeBefore, 1);
  assert.equal(report.analysis.nativeAfter, 3);
  assert.equal(report.analysis.nativeAdded, 2);
  assert.equal(report.analysis.verdict, 'requires-retainer-review');
  assert(
    report.analysis.samples.every(
      (sample) =>
        sample.pathStatus === 'root-reached' &&
        sample.path.length === 2 &&
        sample.node.detachedness === 2,
    ),
  );
  assert.deepEqual(
    report.captures.map((capture) => capture.ordinal),
    [1, 20],
  );
  assert.deepEqual((await readdir(app.dir)).sort(), [
    'report.json.first.heapsnapshot',
    'report.json.last.heapsnapshot',
  ]);
  assert.equal(app.session.detached, true);
  assert.equal(app.session.calls.filter(([name]) => name === 'HeapProfiler.enable').length, 1);
  assert(
    !app.session.calls.some(([name]) =>
      /prepareForLeakDetection|getObjectByHeapObjectId|addInspectedHeapObject|Runtime.evaluate/.test(
        name,
      ),
    ),
  );
});

test('active, wrong-source and changed-phase boundaries cannot take a heap', async (t) => {
  for (const change of [{ phase: 'running' }, { application: { sourceRevision: 'wrong' } }]) {
    const app = await owner(t);
    await assert.rejects(app.observe({ ...row(), ...change }, controls()));
    assert.equal(app.session.captures, 0);
  }
  const app = await owner(t);
  await assert.rejects(app.observe(row(), { ...controls(), verifyPhase: async () => 'running' }));
  assert.equal(app.session.captures, 0);
  assert.equal(app.session.listenerCount('HeapProfiler.addHeapSnapshotChunk'), 0);
});

test('hidden document replacement between captures is rejected instead of comparing unrelated heaps', async (t) => {
  let identity = 'first';
  const app = await owner(t, new Session({ identity: () => identity }));
  await app.observe(row(), controls());
  for (let i = 1; i < 19; i++) await app.observe(row(), controls());
  identity = 'replacement';
  await assert.rejects(app.observe(row(), controls()), /document\/isolate/);
  assert.equal(app.session.captures, 1);
  assert.equal((await finish(app)).status, 'failed');
  assert.equal(app.report.analysis, null);
});

test('incomplete progress is a retained failure with removed listeners and a closed partial file', async (t) => {
  const app = await owner(
    t,
    new Session({
      capture: (session) => {
        session.emit('HeapProfiler.addHeapSnapshotChunk', { chunk: heap() });
      },
    }),
  );
  await assert.rejects(app.observe(row(), controls()), /Incomplete heap stream/);
  assert.equal(app.report.captures[0].fileClosed, true);
  assert.equal(app.report.captures[0].listenersRemoved, true);
  assert.deepEqual(await readdir(app.dir), ['report.json.first.heapsnapshot.partial']);
  assert.equal((await finish(app)).status, 'failed');
});

test('oversize chunks fail before writing and cannot produce a valid heap', async (t) => {
  const app = await owner(
    t,
    new Session({
      capture: (session) => {
        session.emit('HeapProfiler.addHeapSnapshotChunk', {
          chunk: 'x'.repeat(HEAP_RETAINER_LIMITS.chunkBytes + 1),
        });
      },
    }),
  );
  await assert.rejects(app.observe(row(), controls()), /chunk exceeds bound/);
  assert.equal(app.report.captures[0].bytes, 0);
  assert.equal(app.report.captures[0].fileClosed, true);
  assert.equal(app.session.listenerCount('HeapProfiler.addHeapSnapshotChunk'), 0);
});

test('the existing profile abort cancels collection without late chunk writes or browser handles', async (t) => {
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const app = await owner(
    t,
    new Session({
      capture: () => {
        started();
        return new Promise(() => {});
      },
    }),
  );
  const controller = new AbortController();
  const pending = app.observe(row(), { ...controls(), signal: controller.signal });
  await ready;
  controller.abort(new Error('Pause-only memory profile exceeded10s'));
  await assert.rejects(pending, /exceeded10s/);
  const retained = app.report.captures[0].bytes;
  app.session.emit('HeapProfiler.addHeapSnapshotChunk', { chunk: heap() });
  assert.equal(app.report.captures[0].bytes, retained);
  assert.equal(app.report.captures[0].fileClosed, true);
  assert.equal(app.session.listenerCount('HeapProfiler.addHeapSnapshotChunk'), 0);
  assert.equal((await finish(app)).status, 'failed');
});

test('missing terminal capture, open browser and malformed heap data never qualify the diagnostic', async (t) => {
  const app = await owner(t);
  await app.observe(row(), controls());
  assert.equal((await finish(app)).status, 'failed');
  assert.equal(app.report.analysis, null);
  const open = await owner(t);
  for (let i = 0; i < 20; i++) await open.observe(row(), controls());
  assert.equal((await finish(open, false)).status, 'failed');
  assert.equal(open.report.analysis, null);
  const bad = await owner(
    t,
    new Session({
      capture: (session) => {
        session.emit('HeapProfiler.addHeapSnapshotChunk', { chunk: '{"not":"a heap"}' });
        session.emit('HeapProfiler.reportHeapSnapshotProgress', {
          done: 1,
          total: 1,
          finished: true,
        });
      },
    }),
  );
  for (let i = 0; i < 20; i++) await bad.observe(row(), controls());
  assert.equal((await finish(bad)).status, 'failed');
  assert.equal(bad.report.analysis, null);
});

test('post-closure comparisons verify digests and exclude weak retaining paths', async (t) => {
  const app = await owner(t);
  const first = join(app.dir, 'first'),
    last = join(app.dir, 'last');
  const a = heap(),
    b = heap(1, true);
  await writeFile(first, a);
  await writeFile(last, b);
  const identity = { isolate: 'same', frame: 'same', loader: 'same', urlSHA256: 'same' };
  const firstMeta = { bytes: Buffer.byteLength(a), sha256: hash(a), identity };
  const lastMeta = { bytes: Buffer.byteLength(b), sha256: hash(b), identity };
  const report = compareQualificationHeaps(first, last, firstMeta, lastMeta);
  assert.equal(report.nativeAdded, 1);
  assert.equal(report.samples[0].pathStatus, 'no-nonweak-path');
  assert.throws(
    () =>
      compareQualificationHeaps(first, last, firstMeta, { ...lastMeta, sha256: '0'.repeat(64) }),
    /digest/,
  );
  assert.throws(
    () =>
      compareQualificationHeaps(first, last, firstMeta, {
        ...lastMeta,
        identity: { ...identity, isolate: 'other' },
      }),
    /identity/,
  );
});

test('the inherited pause deadline is capped at ten seconds and never extends the scenario', () => {
  assert.equal(heapRetainerProfileTimeout(60000, 10000), 10000);
  assert.equal(heapRetainerProfileTimeout(10050, 10000), 50);
  assert.equal(heapRetainerProfileTimeout(10000.5, 10000), 0.5);
  for (const deadline of [10000, 9999, Infinity, NaN])
    assert.throws(() => heapRetainerProfileTimeout(deadline, 10000), /remaining owner deadline/);
});

test('aggregate bytes and chunk count fail closed at their separate limits', async (t) => {
  for (const mode of ['total-bytes', 'chunk-count']) {
    const session = new Session({
      capture: (session) => {
        const total = mode === 'total-bytes' ? 17 : HEAP_RETAINER_LIMITS.chunks + 1;
        const chunk = mode === 'total-bytes' ? 'x'.repeat(HEAP_RETAINER_LIMITS.chunkBytes) : 'x';
        for (let i = 0; i < total; i++)
          session.emit('HeapProfiler.addHeapSnapshotChunk', { chunk });
        session.emit('HeapProfiler.reportHeapSnapshotProgress', {
          done: 1,
          total: 1,
          finished: true,
        });
      },
    });
    const app = await owner(t, session);
    await assert.rejects(
      app.observe(row(), controls()),
      mode === 'total-bytes' ? /bytes exceed/ : /chunk count exceeds/,
    );
    const record = app.report.captures[0];
    assert.equal(
      record.bytes,
      mode === 'total-bytes' ? HEAP_RETAINER_LIMITS.perSnapshotBytes : HEAP_RETAINER_LIMITS.chunks,
    );
    assert.equal(record.fileClosed, true);
    assert.equal(record.listenersRemoved, true);
    assert.equal(record.status, 'failed');
  }
});

test('malformed progress cannot manufacture a completed heap stream', async (t) => {
  for (const progress of [
    { done: -1, total: 1 },
    { done: 2, total: 1 },
    { done: 0.5, total: 1 },
    { done: 1, total: 2, finished: true },
    { done: 1, total: 1, finished: 'true' },
  ]) {
    const app = await owner(
      t,
      new Session({
        capture: (session) => {
          session.emit('HeapProfiler.addHeapSnapshotChunk', { chunk: heap() });
          session.emit('HeapProfiler.reportHeapSnapshotProgress', progress);
        },
      }),
    );
    await assert.rejects(app.observe(row(), controls()));
    assert.equal(app.report.captures[0].status, 'failed');
    assert.equal(app.report.captures[0].listenersRemoved, true);
    assert.equal(app.report.captures[0].fileClosed, true);
  }
});

test('close and rename failures remain explicit failed evidence with no leaked listeners', async (t) => {
  for (const mode of ['close', 'rename']) {
    const fs = {
      openSync,
      writeSync,
      closeSync(fd) {
        closeSync(fd);
        if (mode === 'close') throw new Error('modeled close failure');
      },
      renameSync(a, b) {
        if (mode === 'rename') throw new Error('modeled rename failure');
        renameSync(a, b);
      },
    };
    const app = await owner(t, new Session(), fs);
    await assert.rejects(app.observe(row(), controls()), /modeled (close|rename) failure/);
    assert.equal(app.report.status, 'failed');
    assert.equal(app.report.captures[0].status, 'failed');
    assert.equal(app.report.captures[0].listenersRemoved, true);
    assert.equal(app.session.listenerCount('HeapProfiler.addHeapSnapshotChunk'), 0);
    assert.deepEqual(await readdir(app.dir), ['report.json.first.heapsnapshot.partial']);
    assert.equal((await finish(app)).status, 'failed');
  }
});

test('finish cannot use a fresh ten-second budget after the original owner deadline', async (t) => {
  const app = await owner(t);
  for (let i = 0; i < 20; i++) await app.observe(row(), controls());
  const report = await app.finish({ browserClosed: true, deadlineAt: Date.now() - 1 });
  assert.equal(report.status, 'failed');
  assert.match(report.failure, /remaining owner deadline/);
  assert.equal(report.analysis, null);
});
