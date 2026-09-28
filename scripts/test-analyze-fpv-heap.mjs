import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  analyzeFlightHeap,
  compareFlightHeaps,
  FPV_HEAP_LIMITS,
  readFlightHeap,
} from './analyze-fpv-heap.mjs';

// Tiny synthetic graphs validate analysis semantics, never browser evidence.
function fixture() {
  return {
    snapshot: {
      node_count: 5,
      edge_count: 4,
      meta: {
        node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'detachedness'],
        node_types: [
          ['synthetic', 'object', 'native'],
          'string',
          'number',
          'number',
          'number',
          'number',
        ],
        edge_fields: ['type', 'name_or_index', 'to_node'],
        edge_types: [['property', 'weak', 'internal'], 'string_or_number', 'node'],
      },
    },
    strings: [
      'root',
      'Window / http://127.0.0.1:4444/',
      'Mesh',
      'BoxGeometry',
      'HTMLDivElement',
      'window',
      'scene',
      'geometry',
      'weakCache',
    ],
    nodes: [
      0, 0, 1, 0, 1, 0, 2, 1, 2, 16, 2, 1, 1, 2, 3, 32, 1, 0, 1, 3, 4, 64, 0, 0, 2, 4, 5, 128, 0, 2,
    ],
    edges: [0, 5, 6, 0, 6, 12, 1, 8, 24, 0, 7, 18],
  };
}
test('reports shallow population and exact strong paths without traversing weak-only detached node', () => {
  const result = analyzeFlightHeap(fixture());
  assert.equal(result.shallowBytes, 240);
  assert.equal(result.strongReachableNodes, 4);
  assert.equal(result.detachedNodes, 1);
  const mesh = result.cohorts.find((row) => row.name === 'object:Mesh');
  assert.deepEqual(mesh.ids, [3]);
  assert.deepEqual(
    mesh.paths[0].strongPath.map((entry) => entry.node.id),
    [1, 2, 3],
  );
  assert.equal(mesh.paths[0].strongPath[1].node.name, 'Window / [origin]/');
  assert.equal(
    result.cohorts.find((row) => row.name === 'native:HTMLDivElement').paths[0].strongPath,
    null,
  );
  assert.match(result.limitations.join(' '), /not retained\/dominator/);
});
test('comparison distinguishes same-sized replacement from surviving object identity', () => {
  const before = analyzeFlightHeap(fixture()),
    changed = fixture();
  changed.nodes[14] = 33;
  const report = compareFlightHeaps(before, analyzeFlightHeap(changed));
  const mesh = report.cohorts.find((row) => row.name === 'object:Mesh');
  assert.deepEqual(mesh, {
    name: 'object:Mesh',
    before: 1,
    after: 1,
    delta: 0,
    survivingIds: 0,
    addedIds: 1,
  });
  assert.equal(report.shallowByteDelta, 0);
  assert.equal(report.qualification, false);
});
test('rejects malformed graph widths, missing fields, dangling edges, duplicate IDs and unknown detachedness', () => {
  for (const mutate of [
    (x) => x.nodes.push(0),
    (x) => x.snapshot.meta.node_fields.splice(3, 1),
    (x) => {
      x.edges[2] = 999;
    },
    (x) => {
      x.nodes[14] = 2;
    },
    (x) => {
      x.nodes[5] = 9;
    },
    (x) => {
      x.snapshot.node_count = 900;
    },
    (x) => {
      x.nodes[4] = 0;
    },
    (x) => {
      x.edges[1] = 999;
    },
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => analyzeFlightHeap(value), /Flight heap:/);
  }
});
test('missing detachedness remains explicitly unavailable rather than zero', () => {
  const value = fixture();
  value.nodes = value.nodes.filter((_, index) => index % 6 !== 5);
  value.snapshot.meta.node_fields.pop();
  for (let i = 2; i < value.edges.length; i += 3) value.edges[i] = (value.edges[i] / 6) * 5;
  const result = analyzeFlightHeap(value);
  assert.equal(result.detachedNodes, null);
  assert.equal(compareFlightHeaps(result, result).detachedNodeDelta, null);
});
test('file loader binds exact bytes and rejects oversized sparse input before parsing', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flight-heap-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'fixture.heapsnapshot'),
    bytes = JSON.stringify(fixture());
  await writeFile(file, bytes);
  const result = await readFlightHeap(file);
  assert.equal(result.file.bytes, Buffer.byteLength(bytes));
  assert.match(result.file.sha256, /^[a-f0-9]{64}$/);
  const handle = await open(path.join(directory, 'oversize'), 'w');
  await handle.truncate(FPV_HEAP_LIMITS.bytes + 1);
  await handle.close();
  await assert.rejects(readFlightHeap(path.join(directory, 'oversize')), /exceeds128MiB/);
});
