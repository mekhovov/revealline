import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { analyzeFlightHeap, analyzeNamedHeap } from './analyze-fpv-heap.mjs';
import { analyzeDiscoveryRetention, DISCOVERY_HEAP_COHORTS } from './analyze-discovery-heap.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
// Synthetic V8-shaped graphs test the reader. They are never browser evidence.
function heap({ closureId = 7, detached = true } = {}) {
  return {
    snapshot: {
      node_count: 4,
      edge_count: 3,
      meta: {
        node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'detachedness'],
        node_types: [
          ['synthetic', 'object', 'closure', 'native'],
          'string',
          'number',
          'number',
          'number',
          'number',
        ],
        edge_fields: ['type', 'name_or_index', 'to_node'],
        edge_types: [['property', 'weak'], 'string_or_number', 'node'],
      },
    },
    strings: ['root', 'Mesh', 'releaseMedia', 'HTMLImageElement', 'scene', 'callback', 'preview'],
    nodes: [
      0,
      0,
      1,
      0,
      1,
      0,
      1,
      1,
      3,
      32,
      1,
      0,
      2,
      2,
      closureId,
      64,
      1,
      0,
      3,
      3,
      9,
      24,
      0,
      detached ? 2 : 1,
    ],
    edges: [0, 4, 6, 0, 5, 12, 0, 6, 18],
  };
}
function fixture() {
  const files = new Map();
  const file = (path, value) => {
    const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
    files.set(path, bytes);
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  };
  const binding = {
    artifactSha256: 'a'.repeat(64),
    manifestSha256: 'b'.repeat(64),
    sourceRevision: 'c'.repeat(40),
    sourceTree: 'd'.repeat(40),
    editionId: 'fpv-learning',
    gameplayId: 'exact-gameplay',
  };
  const environment = {
    userAgent: 'Synthetic fixture',
    platform: 'test',
    width: 1280,
    height: 800,
    dpr: 1,
  };
  const instrumentation = ['capture.mjs', 'observer.mjs', 'runner.mjs', 'analyzer.mjs'].map(
    (name) => file(name, 'fixture:' + name),
  );
  const context = {
    binding,
    instrumentationSha256: digest(
      JSON.stringify(
        [...instrumentation].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      ),
    ),
    isolateId: 'synthetic-isolate',
    timeOrigin: 10000,
  };
  const closed = { rewardViewer: false, wonResult: false, collection: false, openDialogIds: [] };
  const cycles = () => {
    const records = [];
    const add = (value) => records.push({ atMs: records.length + 1, qualified: false, ...value });
    for (let ordinal = 1; ordinal <= 20; ordinal++) {
      for (const surface of ['rewardViewer', 'result']) add({ kind: 'cycle', ordinal, surface });
      add({
        kind: 'checkpoint',
        label: `closed result ${ordinal}`,
        state: closed,
        resources: {
          rewardDialogs: 1,
          rewardShelves: 1,
          rewardResults: 1,
          connectedVideo: 0,
          connectedBlobMedia: 0,
          uniqueConnectedBlobURLs: 0,
        },
      });
    }
    return {
      format: 'revealline-discovery-desktop-cycles.v1',
      qualified: false,
      kind: 'earned-result',
      observation: {
        format: 'revealline-discovery-observation.v1',
        qualified: false,
        binding: {
          label: 'Synthetic fixture',
          deviceLabel: 'fixture',
          editionId: binding.editionId,
          gameplayId: binding.gameplayId,
          inputProtocol: 'ordinary-controls',
          settingsIdentity: 'same-settings',
          sourceKind: 'compiled-artifact',
          sourceIdentity: binding.artifactSha256,
        },
        environment,
        cycles: { result: 20, rewardViewer: 20, collection: 0 },
        records,
      },
    };
  };
  const manifest = {
    format: 'revealline-discovery-retention-capture.v1',
    qualified: false,
    binding,
    environment,
    instrumentation,
    snapshots: ['warm', 'after20', 'after40'].map((phase, index) => ({
      phase,
      context: structuredClone(context),
      forcedGC: true,
      atMs: index * 300,
      closed: structuredClone(closed),
      heap: file(`${phase}.heapsnapshot`, heap({ closureId: index === 0 ? 7 : 11 })),
    })),
    intervals: [0, 1].map((index) => ({
      context: structuredClone(context),
      startMs: index * 300 + 10,
      endMs: index * 300 + 200,
      report: file(`cycles-${index}.json`, cycles()),
    })),
  };
  return { manifest, files, file, read: async (entry) => files.get(entry.path), cycles };
}

test('two ordinary twenty-cycle intervals bind snapshots and describe survival without a leak-free verdict', async () => {
  const f = fixture();
  const result = await analyzeDiscoveryRetention(f.manifest, f);
  assert.equal(result.qualified, false);
  assert.equal(result.intervals.length, 2);
  assert(result.intervals.every((row) => row.lifecycle.closedCheckpoints === 20));
  const before = result.firstInterval.cohorts.find((row) => row.name === 'closure:releaseMedia');
  assert.deepEqual(before, {
    name: 'closure:releaseMedia',
    before: 1,
    after: 1,
    delta: 0,
    survivingIds: 0,
    addedIds: 1,
  });
  assert.equal(
    result.secondInterval.cohorts.find((row) => row.name === before.name).survivingIds,
    1,
  );
  assert.equal(result.snapshots[0].detachedNodes, 1);
  assert.match(result.limits.join(' '), /not dominator/);
  assert(!JSON.stringify(result).includes('strongPath'));
  assert(!JSON.stringify(result).includes('"ids"'));
});

test('named reward cohorts come from the existing runtime and preserve legacy flight output', async () => {
  for (const [file, names] of Object.entries(DISCOVERY_HEAP_COHORTS)) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    for (const name of names)
      assert.match(source, new RegExp(`(?:function|const) ${name}\\b`), `${file}:${name}`);
  }
  const legacy = analyzeFlightHeap(heap());
  assert.equal(legacy.format, 'FlightHeapAnalysis.v1');
  assert(legacy.cohorts.some((row) => row.name === 'object:Mesh'));
  assert(!legacy.cohorts.some((row) => row.name === 'closure:releaseMedia'));
  assert.equal(
    digest(JSON.stringify(legacy)),
    'baaaeada5776eee99224a79c3f26cbb4722716341f332e99b2a214bdfeeee345',
  );
  assert.equal(
    analyzeNamedHeap(heap(), { closures: ['releaseMedia'] }).format,
    'NamedHeapAnalysis.v1',
  );
  assert.throws(
    () => analyzeNamedHeap(heap(), { closures: ['private/unbounded/path'] }),
    /invalid named cohorts/,
  );
});

test('different artifact, source, isolate, document, instrumentation or settings cannot be compared', async () => {
  for (const mutate of [
    (f) => {
      f.manifest.snapshots[1].context.binding.artifactSha256 = 'e'.repeat(64);
    },
    (f) => {
      f.manifest.snapshots[1].context.binding.sourceRevision = 'e'.repeat(40);
    },
    (f) => {
      f.manifest.snapshots[1].context.isolateId = 'another';
    },
    (f) => {
      f.manifest.snapshots[1].context.timeOrigin++;
    },
    (f) => {
      f.manifest.snapshots[1].context.instrumentationSha256 = 'e'.repeat(64);
    },
    (f) => {
      f.manifest.intervals[1].context.isolateId = 'another';
    },
    (f) => {
      const report = f.cycles();
      report.observation.binding.settingsIdentity = 'changed';
      f.manifest.intervals[1].report = f.file('changed.json', report);
    },
    (f) => {
      const report = f.cycles();
      report.observation.environment.width++;
      f.manifest.intervals[1].report = f.file('changed.json', report);
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(analyzeDiscoveryRetention(f.manifest, f), /differ/);
  }
});

test('missing, duplicated, out-of-order, open or connected-media checkpoints fail closed', async () => {
  for (const mutate of [
    (r) => r.observation.records.splice(2, 1),
    (r) => {
      r.observation.records[2].label = 'closed result 2';
    },
    (r) => {
      r.observation.records[2].state.rewardViewer = true;
    },
    (r) => {
      r.observation.records[2].resources.connectedBlobMedia = 1;
    },
    (r) => {
      r.observation.records[0].ordinal = 2;
    },
    (r) => {
      r.observation.records[1].atMs = 0;
    },
    (r) => {
      r.observation.cycles.result = 19;
    },
  ]) {
    const f = fixture(),
      report = f.cycles();
    mutate(report);
    f.manifest.intervals[0].report = f.file('changed.json', report);
    await assert.rejects(analyzeDiscoveryRetention(f.manifest, f));
  }
});

test('capture windows, exact bytes, bounds and closed snapshot state are mandatory', async () => {
  for (const mutate of [
    (f) => {
      f.manifest.snapshots[1].forcedGC = false;
    },
    (f) => {
      f.manifest.snapshots[1].closed.openDialogIds = ['completion-reward-dialog'];
    },
    (f) => {
      f.manifest.intervals[0].endMs = 400;
    },
    (f) => {
      f.manifest.intervals[0].endMs = 40;
    },
    (f) => {
      f.manifest.snapshots[1].heap = f.manifest.snapshots[0].heap;
    },
    (f) => {
      f.files.set('after20.heapsnapshot', Buffer.from('{}'));
    },
    (f) => {
      f.manifest.snapshots[1].heap.bytes = 128 * 1024 * 1024 + 1;
    },
    (f) => {
      f.manifest.snapshots[1].heap.path = '../escape';
    },
    (f) => {
      f.manifest.instrumentation.push(f.manifest.instrumentation[0]);
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(analyzeDiscoveryRetention(f.manifest, f));
  }
});
