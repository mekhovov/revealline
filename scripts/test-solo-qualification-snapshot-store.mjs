import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import {
  createQualificationSnapshotStore,
  readQualificationSnapshotReport,
} from './solo-qualification-snapshot-store.mjs';
import {
  qualificationSnapshotStorage,
  validateQualification,
  resourceStability,
  memoryProfileSummary,
} from './solo-qualification.mjs';
import { sustainedSnapshotStorage, sustainedArguments } from './solo-remote-sustained.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encoded = (value) => JSON.stringify(value) + '\n';
const normalized = (value) => JSON.parse(JSON.stringify(value));
const bounds = {
  maximumBytes: 32768,
  maximumIndexBytes: 8192,
  maximumSnapshotBytes: 2048,
  maximumSnapshots: 32,
};
const snapshot = (index) => ({
  group: 'result',
  index,
  application: {
    failure: null,
    intervals: [33, 50, 100, 250, 618],
    histogram: [0, 3, 4],
    nested: [{ zero: 0, disabled: false, text: '河 🎮', omit: undefined }],
    absent: undefined,
  },
  probe: {
    samples: [
      [1, 2],
      [null, undefined],
    ],
    finite: Infinity,
  },
});
const report = () => ({
  format: 'SoloQualificationReportV1',
  status: 'running',
  actions: [],
  snapshots: [snapshot(0), snapshot(1)],
  failure: null,
});
async function fixture(t, options = bounds) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'solo-snapshot-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'report.json');
  const writer = await createQualificationSnapshotStore(path, options);
  const value = report();
  await writer.save(value);
  const index = JSON.parse(await readFile(path, 'utf8'));
  return {
    root,
    path,
    writer,
    value,
    index,
    directory: join(root, index.snapshotStorage.directory),
    chunk: join(root, index.snapshotStorage.directory, index.snapshotStorage.chunks[0].file),
  };
}

test('chunked snapshots hydrate every original JSON value and do not rewrite prior snapshot bytes', async (t) => {
  const f = await fixture(t);
  const firstBytes = await readFile(f.chunk),
    firstStat = await stat(f.chunk);
  assert.deepEqual(await readQualificationSnapshotReport(f.path, bounds), normalized(f.value));
  for (let index = 2; index < 20; index++) {
    f.value.snapshots.push(snapshot(index));
    f.value.actions.push({ status: index === 15 ? 'fail' : 'pass', index });
    await f.writer.save(f.value);
  }
  f.value.status = 'failed';
  f.value.failure = { reason: 'Retain the original failure', intervals: [618] };
  await f.writer.save(f.value);
  assert.deepEqual(await readQualificationSnapshotReport(f.path, bounds), normalized(f.value));
  assert.deepEqual(await readFile(f.chunk), firstBytes);
  const finalStat = await stat(f.chunk);
  for (const key of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'])
    assert.equal(finalStat[key], firstStat[key]);
  const metrics = f.writer.metrics();
  assert.equal(metrics.snapshotWrites, 20);
  assert.equal(metrics.indexWrites, 20);
  assert.equal(metrics.snapshotBytesWritten, metrics.chunkBytes);
  assert(metrics.indexBytes <= bounds.maximumIndexBytes);
  assert(metrics.chunkBytes + 2 * metrics.indexBytes < bounds.maximumBytes);
  assert(metrics.peakLogicalBytes <= bounds.maximumBytes);
  assert.deepEqual(
    (await readdir(f.directory)).sort(),
    Array.from({ length: 20 }, (_, index) => `snapshot-${String(index).padStart(6, '0')}.json`),
  );
  assert.equal(
    Object.hasOwn(await readQualificationSnapshotReport(f.path, bounds), 'snapshotStorage'),
    false,
  );
});

test('published snapshot values are frozen deeply but later report metadata and snapshots remain appendable', async (t) => {
  const f = await fixture(t);
  assert.throws(() => {
    f.value.snapshots[0].application.intervals[0] = 0;
  }, TypeError);
  assert.throws(() => {
    f.value.snapshots[0].application.nested[0].zero = 5;
  }, TypeError);
  f.value.snapshots.push(snapshot(2));
  await f.writer.save(f.value);
  assert.equal((await readQualificationSnapshotReport(f.path, bounds)).snapshots.length, 3);
});

for (const [name, mutation] of Object.entries({
  replacement: (value) => {
    value.snapshots[0] = normalized(value.snapshots[0]);
  },
  reorder: (value) => value.snapshots.reverse(),
  truncation: (value) => value.snapshots.pop(),
  format: (value) => {
    value.format = 'invented';
  },
  metadata: (value) => {
    value.snapshotStorage = {};
  },
  count: (value) => {
    value.snapshots.push(...Array.from({ length: 31 }, (_, i) => snapshot(i + 2)));
  },
  oversized: (value) => {
    value.snapshots.push({ text: 'x'.repeat(2048) });
  },
  cycle: (value) => {
    const v = {};
    v.self = v;
    value.snapshots.push(v);
  },
  accessor: (value) => {
    value.snapshots.push({
      get illegal() {
        return 1;
      },
    });
  },
  function: (value) => {
    value.snapshots.push({ toJSON: () => ({ hidden: true }) });
  },
}))
  test(`writer rejects ${name} and never implicitly retries after failure`, async (t) => {
    const f = await fixture(t);
    const oldBytes = await readFile(f.path);
    mutation(f.value);
    await assert.rejects(f.writer.save(f.value));
    await assert.rejects(f.writer.save(report()), /busy or failed/);
    assert.deepEqual(await readFile(f.path), oldBytes);
  });

test('writer rejects overlapping saves and any preexisting target, temporary or chunk directory', async (t) => {
  const f = await fixture(t);
  const pending = f.writer.save(f.value);
  await assert.rejects(f.writer.save(f.value), /busy/);
  await pending;
  await assert.rejects(createQualificationSnapshotStore(f.path, bounds));
  for (const suffix of ['.partial', '.snapshots']) {
    const path = join(f.root, `occupied-${suffix.length}.json`);
    await writeFile(path + suffix, 'retained');
    await assert.rejects(createQualificationSnapshotStore(path, bounds));
    assert.equal(await readFile(path + suffix, 'utf8'), 'retained');
  }
});

test('writer rejects index growth and prospective transient copies before exceeding the declared budget', async (t) => {
  const f = await fixture(t);
  f.value.actions.push('x'.repeat(bounds.maximumIndexBytes));
  await assert.rejects(f.writer.save(f.value), /index byte bound/);
  const small = {
    maximumBytes: 1024,
    maximumIndexBytes: 512,
    maximumSnapshotBytes: 512,
    maximumSnapshots: 4,
  };
  const path = join(f.root, 'bounded.json');
  const writer = await createQualificationSnapshotStore(path, small);
  await assert.rejects(
    writer.save({ format: 'SoloQualificationReportV1', snapshots: [{ text: 'x'.repeat(400) }] }),
    /store byte bound/,
  );
  assert.deepEqual(await readdir(path + '.snapshots'), []);
});

test('an interrupted publication retains every chunk and rejects the stale index instead of claiming a complete report', async (t) => {
  const f = await fixture(t);
  f.value.snapshots.push(snapshot(2));
  f.value.actions.push('x'.repeat(bounds.maximumIndexBytes));
  await assert.rejects(f.writer.save(f.value), /index byte bound/);
  assert.equal((await readdir(f.directory)).length, 3);
  assert.equal(JSON.parse(await readFile(f.path)).snapshotStorage.count, 2);
  await assert.rejects(readQualificationSnapshotReport(f.path, bounds), /extra or partial/);
});

test('caps cannot be increased, made nonintegral, or larger than the whole evidence budget', async (t) => {
  const f = await fixture(t);
  for (const options of [
    { maximumBytes: 128 * 1024 ** 2 + 1 },
    { maximumSnapshots: 513 },
    { maximumSnapshotBytes: 1024 ** 2 + 1 },
    { maximumIndexBytes: 4 * 1024 ** 2 + 1 },
    { maximumSnapshots: 1.2 },
    { maximumBytes: 0 },
    { maximumBytes: 100, maximumIndexBytes: 101 },
  ]) {
    await assert.rejects(createQualificationSnapshotStore(join(f.root, 'invalid.json'), options));
    await assert.rejects(readQualificationSnapshotReport(f.path, options));
  }
});

const indexMutations = {
  unknownFormat: (index) => {
    index.snapshotStorage.format = 'invented';
  },
  unknownKey: (index) => {
    index.snapshotStorage.ignored = true;
  },
  nonemptyInlineSnapshots: (index) => {
    index.snapshots.push({ hidden: 1 });
  },
  countMismatch: (index) => {
    index.snapshotStorage.count++;
  },
  negativeCount: (index) => {
    index.snapshotStorage.count = -1;
  },
  duplicate: (index) => {
    index.snapshotStorage.chunks[1] = index.snapshotStorage.chunks[0];
  },
  reordered: (index) => index.snapshotStorage.chunks.reverse(),
  traversal: (index) => {
    index.snapshotStorage.chunks[0].file = '../snapshot-000000.json';
  },
  absolute: (index) => {
    index.snapshotStorage.chunks[0].file = '/snapshot-000000.json';
  },
  directoryTraversal: (index) => {
    index.snapshotStorage.directory = '../report.json.snapshots';
  },
  wrongSize: (index) => {
    index.snapshotStorage.chunks[0].bytes++;
  },
  wrongHash: (index) => {
    index.snapshotStorage.chunks[0].sha256 = '0'.repeat(64);
  },
  excessiveSize: (index) => {
    index.snapshotStorage.chunks[0].bytes = 2049;
  },
  invalidHash: (index) => {
    index.snapshotStorage.chunks[0].sha256 = 'invalid';
  },
};
for (const [name, mutation] of Object.entries(indexMutations))
  test(`reader rejects ${name}`, async (t) => {
    const f = await fixture(t);
    mutation(f.index);
    await writeFile(f.path, encoded(f.index));
    await assert.rejects(readQualificationSnapshotReport(f.path, bounds));
  });

for (const [name, mutate] of Object.entries({
  missing: (f) => rm(f.chunk),
  extra: (f) => writeFile(join(f.directory, 'extra.json'), '{}'),
  partialChunk: (f) => writeFile(f.chunk + '.partial', '{}'),
  partialIndex: (f) => writeFile(f.path + '.partial', '{}'),
  changed: (f) => writeFile(f.chunk, '{}'),
  oversized: (f) => writeFile(f.chunk, 'x'.repeat(2049)),
  symlinkChunk: async (f) => {
    const target = join(f.root, 'redirected.json');
    await rename(f.chunk, target);
    await symlink(target, f.chunk);
  },
  symlinkDirectory: async (f) => {
    const target = join(f.root, 'redirected-directory');
    await rename(f.directory, target);
    await symlink(target, f.directory);
  },
  symlinkReport: async (f) => {
    const target = join(f.root, 'redirected-report.json');
    await rename(f.path, target);
    await symlink(target, f.path);
  },
}))
  test(`reader rejects ${name} evidence files`, async (t) => {
    const f = await fixture(t);
    await mutate(f);
    await assert.rejects(readQualificationSnapshotReport(f.path, bounds));
  });

for (const [name, bytes] of [
  ['invalid JSON', Buffer.from('{')],
  ['invalid UTF8', Buffer.from([123, 34, 255, 34, 58, 49, 125])],
  ['nonobject snapshot', Buffer.from('[1,2]\n')],
])
  test(`reader rejects hash-matched ${name}`, async (t) => {
    const f = await fixture(t);
    await writeFile(f.chunk, bytes);
    Object.assign(f.index.snapshotStorage.chunks[0], { bytes: bytes.length, sha256: sha(bytes) });
    await writeFile(f.path, encoded(f.index));
    await assert.rejects(readQualificationSnapshotReport(f.path, bounds));
  });

test('reader enforces aggregate and index limits independently of chunk digests', async (t) => {
  const f = await fixture(t);
  const indexBytes = (await stat(f.path)).size;
  await assert.rejects(
    readQualificationSnapshotReport(f.path, { ...bounds, maximumIndexBytes: indexBytes - 1 }),
  );
  await assert.rejects(
    readQualificationSnapshotReport(f.path, {
      ...bounds,
      maximumBytes: indexBytes + 1,
      maximumIndexBytes: indexBytes,
      maximumSnapshotBytes: 512,
    }),
  );
});

test('empty and legacy inline reports preserve their shape with bounded ordinary-file checks', async (t) => {
  const f = await fixture(t);
  const path = join(f.root, 'empty.json'),
    value = { format: 'SoloQualificationReportV1', snapshots: [], failure: 'retained' };
  const writer = await createQualificationSnapshotStore(path, bounds);
  await writer.save(value);
  assert.deepEqual(await readQualificationSnapshotReport(path, bounds), value);
  const legacy = join(f.root, 'legacy.json');
  await writeFile(legacy, encoded(f.value));
  assert.deepEqual(await readQualificationSnapshotReport(legacy, bounds), normalized(f.value));
  await assert.rejects(
    readQualificationSnapshotReport(legacy, {
      ...bounds,
      maximumBytes: 100,
      maximumIndexBytes: 100,
      maximumSnapshotBytes: 100,
    }),
  );
  const aliasRoot = join(f.root, 'alias');
  await symlink(f.root, aliasRoot);
  await assert.rejects(readQualificationSnapshotReport(join(aliasRoot, basename(legacy)), bounds));
  await writeFile(legacy + '.partial', '{}');
  await assert.rejects(readQualificationSnapshotReport(legacy, bounds));
});

test('chunk storage requires matching explicit recipe and CLI scope with unchanged lifecycle kind', async () => {
  const original = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-remote-sustained/soak.qualification.fixture',
        import.meta.url,
      ),
    ),
  );
  assert.equal(qualificationSnapshotStorage([], original), null);
  assert.throws(
    () => qualificationSnapshotStorage(['--snapshot-chunks'], original),
    /matching explicit/,
  );
  const recipe = { ...original, evidenceStorage: 'snapshot-chunks-v1' };
  assert.equal(validateQualification(recipe).kind, original.kind);
  const options = qualificationSnapshotStorage(['--snapshot-chunks'], recipe);
  assert.equal(options.maximumBytes, 96 * 1024 ** 2);
  assert.throws(() => qualificationSnapshotStorage([], recipe), /matching explicit/);
  for (const flags of [['--snapshot-chunks=1'], ['--snapshot-chunks', '--snapshot-chunks']])
    assert.throws(() => qualificationSnapshotStorage(flags, recipe));
  for (const change of [
    { evidenceStorage: 'invented' },
    { kind: 'performance' },
    { kind: 'recovery' },
    { timeoutMs: 10000 },
    { actions: [{ type: 'wait', ms: 1 }] },
  ])
    assert.throws(() => validateQualification({ ...recipe, ...change }));
  assert.throws(
    () => sustainedSnapshotStorage({ frozenTools: [], adapterInputs: [] }, recipe),
    /frozen snapshot-store/,
  );
  const mode = sustainedSnapshotStorage(
    { frozenTools: [{ path: 'scripts/solo-qualification-snapshot-store.mjs' }], adapterInputs: [] },
    recipe,
  );
  assert.deepEqual(mode, options);
  const context = {
    here: '/tools',
    plan: { phase: 'soak', candidate: { revision: 'a'.repeat(40) } },
    modeState: { recipePath: '/recipe.json', cpu: 1, snapshotStorage: mode },
  };
  const row = { source: 'candidate', engine: 'chromium' };
  assert(
    sustainedArguments(context, row, 'http://localhost/game/', '/output').includes(
      '--snapshot-chunks',
    ),
  );
  context.modeState.snapshotStorage = null;
  assert(
    !sustainedArguments(context, row, 'http://localhost/game/', '/output').includes(
      '--snapshot-chunks',
    ),
  );
});

test('terminal memory/resource summaries read frozen completed snapshots without mutation', async (t) => {
  const f = await fixture(t);
  for (const index of [2, 3]) {
    const row = snapshot(index);
    row.application.resources = { bytes: 100 + index };
    row.memory = {
      after: {
        heap: {
          usedSize: 1000 + index,
          totalSize: 2000,
          embedderHeapUsedSize: 20,
          backingStorageSize: 10,
        },
        dom: { documents: 1, nodes: 30, jsEventListeners: 4 },
      },
    };
    f.value.snapshots.push(row);
  }
  await f.writer.save(f.value);
  const original = normalized(f.value.snapshots);
  const rules = [{ group: 'result', path: 'resources.bytes', last: 2, maxRange: 0 }];
  assert.deepEqual(resourceStability(f.value.snapshots, rules), resourceStability(original, rules));
  assert.equal(resourceStability(f.value.snapshots, rules)[0].status, 'fail');
  assert.deepEqual(memoryProfileSummary(f.value.snapshots, 2), memoryProfileSummary(original, 2));
  assert.equal(memoryProfileSummary(f.value.snapshots, 2)[0].samples, 2);
  assert.deepEqual(normalized(f.value.snapshots), original);
  f.value.memory = memoryProfileSummary(f.value.snapshots);
  f.value.resources = resourceStability(f.value.snapshots);
  f.value.failure = 'original terminal failure';
  await f.writer.save(f.value);
  assert.deepEqual(await readQualificationSnapshotReport(f.path, bounds), normalized(f.value));
});
