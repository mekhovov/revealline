import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  openSync,
  writeSync,
  closeSync,
  renameSync,
  readFileSync,
  statSync,
  lstatSync,
  realpathSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const HEAP_RETAINER_PROTOCOL = 'retry797-first-last-v1';
export const HEAP_RETAINER_SOURCE = '797e03f28743921842df6aa57520a72016ba3dfc';
export const HEAP_RETAINER_RECIPE =
  '77458b3992e1f40b565bd57912bdc2b4e79ddadb8ce07b617456e220853fe9d1';
export const HEAP_RETAINER_LIMITS = Object.freeze({
  snapshots: 2,
  perSnapshotBytes: 32 * 1024 ** 2,
  chunkBytes: 2 * 1024 ** 2,
  chunks: 2048,
  nodes: 1000000,
  edges: 5000000,
  samples: 24,
  pathDepth: 64,
});
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (url) =>
  url.protocol === 'http:' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
  !url.username &&
  !url.password;

/** Opt-in source-bound fixture only. Never inspect public sessions or existing user profiles. */
export function qualificationHeapRetainerOptions(
  flags,
  { engine, profileMode, contextMode, scenarioBytes, sourceRevision, address },
) {
  const selected = flags.filter((flag) => flag.startsWith('--heap-retainers'));
  if (!selected.length) return null;
  assert.deepEqual(selected, [`--heap-retainers=${HEAP_RETAINER_PROTOCOL}`]);
  assert.equal(engine, 'chromium');
  assert.equal(profileMode, 'memory-profile');
  assert.equal(contextMode, 'ephemeral');
  assert.equal(sourceRevision, HEAP_RETAINER_SOURCE);
  assert.equal(scenarioBytes.length, 4556);
  assert.equal(sha(scenarioBytes), HEAP_RETAINER_RECIPE);
  assert(
    flags.includes('--server-fixture-access'),
    'Heap capture requires the fresh server fixture',
  );
  assert(
    !flags.some(
      (flag) =>
        flag === '--baseline-runtime' ||
        flag === '--fixture-access' ||
        flag.startsWith('--public-url') ||
        flag.startsWith('--manifest') ||
        flag.startsWith('--cpu-profile') ||
        flag.startsWith('--audio-proof') ||
        flag.startsWith('--frame-trace'),
    ),
    'Incompatible heap capture scope',
  );
  assert(local(new URL(address)), 'Heap capture refuses public or credentialed transport');
  return Object.freeze({
    protocol: HEAP_RETAINER_PROTOCOL,
    sourceRevision: HEAP_RETAINER_SOURCE,
    scenarioSHA256: HEAP_RETAINER_RECIPE,
    origin: new URL(address).origin,
  });
}

export function heapRetainerProfileTimeout(deadlineAt, now = Date.now()) {
  assert(
    Number.isFinite(deadlineAt) && Number.isFinite(now) && deadlineAt > now,
    'Heap profile has no remaining owner deadline',
  );
  return Math.min(10000, deadlineAt - now);
}

function heapGraph(path, expected) {
  const stat = statSync(path);
  assert(
    stat.isFile() &&
      stat.size === expected.bytes &&
      stat.size <= HEAP_RETAINER_LIMITS.perSnapshotBytes,
    'Heap file identity or size mismatch',
  );
  const bytes = readFileSync(path);
  assert.equal(sha(bytes), expected.sha256, 'Heap file digest mismatch');
  const heap = JSON.parse(bytes);
  const meta = heap.snapshot?.meta;
  assert(meta && Array.isArray(meta.node_fields) && Array.isArray(meta.edge_fields));
  const fields = Object.fromEntries(meta.node_fields.map((name, index) => [name, index]));
  const edgeFields = Object.fromEntries(meta.edge_fields.map((name, index) => [name, index]));
  for (const name of ['type', 'name', 'id', 'edge_count'])
    assert(Number.isInteger(fields[name]), `Missing heap node field ${name}`);
  for (const name of ['type', 'name_or_index', 'to_node'])
    assert(Number.isInteger(edgeFields[name]), `Missing heap edge field ${name}`);
  const stride = meta.node_fields.length,
    edgeStride = meta.edge_fields.length;
  const count = heap.snapshot.node_count,
    edgeCount = heap.snapshot.edge_count;
  assert(Number.isSafeInteger(count) && count > 0 && count <= HEAP_RETAINER_LIMITS.nodes);
  assert(
    Number.isSafeInteger(edgeCount) && edgeCount >= 0 && edgeCount <= HEAP_RETAINER_LIMITS.edges,
  );
  assert(Array.isArray(heap.nodes) && heap.nodes.length === count * stride);
  assert(Array.isArray(heap.edges) && heap.edges.length === edgeCount * edgeStride);
  assert(Array.isArray(heap.strings) && heap.strings.every((value) => typeof value === 'string'));
  const types = meta.node_types[fields.type],
    edgeTypes = meta.edge_types[edgeFields.type];
  assert(Array.isArray(types) && Array.isArray(edgeTypes));
  const starts = new Uint32Array(count + 1),
    ids = new Set();
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const offset = i * stride,
      id = heap.nodes[offset + fields.id];
    const name = heap.nodes[offset + fields.name],
      type = heap.nodes[offset + fields.type];
    const edges = heap.nodes[offset + fields.edge_count];
    assert(Number.isSafeInteger(id) && id >= 0 && !ids.has(id), 'Invalid or duplicate heap ID');
    assert(Number.isSafeInteger(name) && name >= 0 && name < heap.strings.length);
    assert(Number.isSafeInteger(type) && type >= 0 && type < types.length);
    assert(Number.isSafeInteger(edges) && edges >= 0);
    ids.add(id);
    starts[i] = cursor;
    cursor += edges;
    assert(cursor <= edgeCount);
  }
  starts[count] = cursor;
  assert.equal(cursor, edgeCount);
  for (let i = 0; i < edgeCount; i++) {
    const offset = i * edgeStride,
      target = heap.edges[offset + edgeFields.to_node];
    const type = heap.edges[offset + edgeFields.type],
      name = heap.edges[offset + edgeFields.name_or_index];
    assert(
      Number.isSafeInteger(target) &&
        target >= 0 &&
        target < heap.nodes.length &&
        target % stride === 0,
    );
    assert(Number.isSafeInteger(type) && type >= 0 && type < edgeTypes.length);
    assert(Number.isSafeInteger(name) && name >= 0);
    assert(['element', 'hidden'].includes(edgeTypes[type]) || name < heap.strings.length);
  }
  return { heap, fields, edgeFields, stride, edgeStride, count, types, edgeTypes, starts, ids };
}

const nodeInfo = (graph, index) => {
  const { heap, fields, stride, types } = graph,
    offset = index * stride;
  const detached =
    fields.detachedness === undefined ? null : heap.nodes[offset + fields.detachedness];
  return {
    id: heap.nodes[offset + fields.id],
    type: types[heap.nodes[offset + fields.type]],
    name: heap.strings[heap.nodes[offset + fields.name]].slice(0, 200),
    detachedness: Number.isSafeInteger(detached) ? detached : null,
  };
};

function initialNativeIndex(graph) {
  const nodes = new Map();
  for (let i = 0; i < graph.count; i++) {
    const node = nodeInfo(graph, i);
    if (node.type === 'native') nodes.set(node.id, node.name);
  }
  return nodes;
}

/** Run only after the observed browser closes. Paths exclude explicit weak edges;
 * they do not prove dominators, ephemeron ownership, an app leak or total native memory. */
export function compareQualificationHeaps(firstPath, lastPath, first, last) {
  assert.deepEqual(first.identity, last.identity, 'Heap identity changed');
  const before = initialNativeIndex(heapGraph(firstPath, first));
  const graph = heapGraph(lastPath, last),
    after = new Map(),
    groups = new Map(),
    added = [];
  const group = (name) => {
    if (!groups.has(name)) groups.set(name, { name, before: 0, after: 0, added: 0, removed: 0 });
    return groups.get(name);
  };
  for (const name of before.values()) group(name).before++;
  for (let i = 0; i < graph.count; i++) {
    const node = nodeInfo(graph, i);
    if (node.type !== 'native') continue;
    after.set(node.id, node.name);
    group(node.name).after++;
    if (!before.has(node.id)) {
      group(node.name).added++;
      added.push(i);
    }
  }
  for (const [id, name] of before) if (!after.has(id)) group(name).removed++;
  assert.equal(nodeInfo(graph, 0).type, 'synthetic', 'Unrecognized heap root');
  const parent = new Int32Array(graph.count).fill(-1),
    parentEdge = new Uint32Array(graph.count);
  const queue = new Uint32Array(graph.count);
  parent[0] = 0;
  let head = 0,
    tail = 1;
  queue[0] = 0;
  while (head < tail) {
    const from = queue[head++];
    for (let edge = graph.starts[from]; edge < graph.starts[from + 1]; edge++) {
      const offset = edge * graph.edgeStride;
      if (graph.edgeTypes[graph.heap.edges[offset + graph.edgeFields.type]] === 'weak') continue;
      const to = graph.heap.edges[offset + graph.edgeFields.to_node] / graph.stride;
      if (parent[to] !== -1) continue;
      parent[to] = from;
      parentEdge[to] = edge;
      queue[tail++] = to;
    }
  }
  added.sort(
    (a, b) =>
      Number(nodeInfo(graph, b).detachedness === 2) -
        Number(nodeInfo(graph, a).detachedness === 2) ||
      nodeInfo(graph, a).id - nodeInfo(graph, b).id,
  );
  const samples = added.slice(0, HEAP_RETAINER_LIMITS.samples).map((index) => {
    const path = [];
    let current = index;
    while (
      current !== 0 &&
      parent[current] !== -1 &&
      path.length < HEAP_RETAINER_LIMITS.pathDepth
    ) {
      const offset = parentEdge[current] * graph.edgeStride;
      const type = graph.edgeTypes[graph.heap.edges[offset + graph.edgeFields.type]];
      const name = graph.heap.edges[offset + graph.edgeFields.name_or_index];
      path.push({
        from: nodeInfo(graph, parent[current]),
        edge: {
          type,
          name: ['element', 'hidden'].includes(type)
            ? String(name)
            : graph.heap.strings[name].slice(0, 200),
        },
        to: nodeInfo(graph, current),
      });
      current = parent[current];
    }
    return {
      node: nodeInfo(graph, index),
      path: path.reverse(),
      pathStatus:
        current === 0 ? 'root-reached' : parent[current] === -1 ? 'no-nonweak-path' : 'depth-limit',
    };
  });
  const changes = [...groups.values()]
    .filter((value) => value.added || value.removed)
    .sort((a, b) => b.added - a.added || a.name.localeCompare(b.name));
  return {
    status: 'observed',
    nativeBefore: before.size,
    nativeAfter: after.size,
    nativeAdded: added.length,
    nativeRemoved: [...before.keys()].filter((id) => !after.has(id)).length,
    groups: changes.slice(0, 128),
    omittedGroups: Math.max(0, changes.length - 128),
    samples,
    omittedSamples: Math.max(0, added.length - samples.length),
    verdict: 'requires-retainer-review',
    scope:
      'Same-document native heap IDs and non-weak-edge paths only. No app-leak, dominator, performance or total-browser-memory clearance.',
  };
}

export function createQualificationHeapRetainers({
  cdp,
  output,
  options,
  fileSystem = { openSync, writeSync, closeSync, renameSync },
}) {
  const report = {
    format: 'SoloHeapRetainersV1',
    protocol: options.protocol,
    sourceRevision: options.sourceRevision,
    scenarioSHA256: options.scenarioSHA256,
    status: 'pending',
    completedBoundaries: 0,
    captures: [],
    performanceQualification: 'excluded-memory-profiling',
    limits: HEAP_RETAINER_LIMITS,
    analysis: null,
  };
  let identity = null,
    stopped = false,
    activeStop = null;
  const paths = [];
  async function observe(row, { signal, verifyPhase }) {
    if (!row || row.group !== 'completed') return null;
    assert(!stopped, 'Heap retainer owner stopped');
    const ordinal = ++report.completedBoundaries;
    assert(ordinal <= 20, 'More than twenty completed Retry boundaries');
    assert(
      ['paused', 'picture', 'result'].includes(row.phase),
      'Heap capture requires completed non-playing boundary',
    );
    assert.equal(row.application?.sourceRevision, HEAP_RETAINER_SOURCE);
    if (ordinal !== 1 && ordinal !== 20) return null;
    signal.throwIfAborted();
    const label = ordinal === 1 ? 'first' : 'last';
    const path = join(dirname(output), basename(output) + `.${label}.heapsnapshot`);
    const partial = path + '.partial';
    const record = {
      ordinal,
      phase: row.phase,
      action: row.action,
      status: 'capturing',
      file: basename(partial),
      bytes: 0,
      chunks: 0,
      progressComplete: false,
      fileClosed: false,
      listenersRemoved: false,
      identity: null,
      sha256: null,
    };
    report.captures.push(record);
    let fd,
      ended = false,
      terminalError = null,
      rejectCapture;
    const hash = createHash('sha256');
    const failure = new Promise((_, reject) => {
      rejectCapture = reject;
    });
    const fail = (error) => {
      if (ended || terminalError) return;
      terminalError = error instanceof Error ? error : new Error(String(error));
      rejectCapture(terminalError);
    };
    const current = () => {
      signal.throwIfAborted();
      assert(!ended && !terminalError, 'Heap capture no longer owns this request');
    };
    const abort = () => fail(signal.reason ?? new Error('Heap capture aborted'));
    const onChunk = ({ chunk }) => {
      if (ended || terminalError) return;
      try {
        signal.throwIfAborted();
        assert(typeof chunk === 'string' && chunk.length > 0);
        const bytes = Buffer.from(chunk);
        assert(bytes.length <= HEAP_RETAINER_LIMITS.chunkBytes, 'Heap chunk exceeds bound');
        assert(++record.chunks <= HEAP_RETAINER_LIMITS.chunks, 'Heap chunk count exceeds bound');
        assert(
          record.bytes + bytes.length <= HEAP_RETAINER_LIMITS.perSnapshotBytes,
          'Heap bytes exceed bound',
        );
        let offset = 0;
        while (offset < bytes.length) {
          const written = fileSystem.writeSync(fd, bytes, offset, bytes.length - offset);
          assert(written > 0, 'Heap file write made no progress');
          hash.update(bytes.subarray(offset, offset + written));
          offset += written;
          record.bytes += written;
        }
      } catch (error) {
        fail(error);
      }
    };
    const onProgress = ({ done, total, finished }) => {
      if (ended || terminalError) return;
      try {
        assert(
          Number.isSafeInteger(done) && Number.isSafeInteger(total) && done >= 0 && total >= done,
        );
        assert(
          finished === undefined || typeof finished === 'boolean',
          'Invalid heap progress completion',
        );
        if (finished) {
          assert.equal(done, total);
          record.progressComplete = true;
        }
      } catch (error) {
        fail(error);
      }
    };
    const readIdentity = async () => {
      current();
      assert.equal(await verifyPhase(), row.phase, 'Heap boundary changed phase');
      current();
      const [isolate, frame] = await Promise.all([
        cdp.send('Runtime.getIsolateId'),
        cdp.send('Page.getFrameTree'),
      ]);
      current();
      const root = frame.frameTree?.frame,
        url = new URL(root?.url);
      assert(
        local(url) && url.origin === options.origin && url.pathname.endsWith('/game/'),
        'Heap document is outside the local fixture',
      );
      assert(
        typeof isolate.id === 'string' &&
          isolate.id &&
          typeof root.id === 'string' &&
          root.id &&
          typeof root.loaderId === 'string' &&
          root.loaderId,
      );
      return {
        isolate: isolate.id,
        frame: root.id,
        loader: root.loaderId,
        urlSHA256: sha(url.href),
      };
    };
    signal.addEventListener('abort', abort, { once: true });
    activeStop = abort;
    try {
      const work = (async () => {
        record.identity = await readIdentity();
        if (identity)
          assert.deepEqual(record.identity, identity, 'Heap capture changed document/isolate');
        else {
          identity = record.identity;
          await cdp.send('HeapProfiler.enable');
        }
        current();
        fd = fileSystem.openSync(partial, 'wx', 0o600);
        cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
        cdp.on('HeapProfiler.reportHeapSnapshotProgress', onProgress);
        await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: true });
        current();
        assert(
          record.progressComplete && record.chunks > 0 && record.bytes > 0,
          'Incomplete heap stream',
        );
        assert.deepEqual(
          await readIdentity(),
          record.identity,
          'Heap document changed during capture',
        );
      })();
      work.catch(() => {});
      await Promise.race([work, failure]);
      record.sha256 = hash.digest('hex');
      record.status = 'retained-unvalidated';
    } catch (error) {
      record.status = 'failed';
      record.failure = String(error.message).slice(0, 2048);
      record.sha256 ??= hash.digest('hex');
      report.status = 'failed';
      stopped = true;
      throw error;
    } finally {
      ended = true;
      activeStop = null;
      signal.removeEventListener('abort', abort);
      cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
      cdp.off('HeapProfiler.reportHeapSnapshotProgress', onProgress);
      record.listenersRemoved = true;
      if (fd !== undefined) {
        try {
          fileSystem.closeSync(fd);
          record.fileClosed = true;
        } catch (error) {
          record.status = 'failed';
          record.closeFailure = String(error.message).slice(0, 2048);
          report.status = 'failed';
          stopped = true;
          throw error;
        }
      }
    }
    try {
      fileSystem.renameSync(partial, path);
    } catch (error) {
      record.status = 'failed';
      record.renameFailure = String(error.message).slice(0, 2048);
      report.status = 'failed';
      stopped = true;
      throw error;
    }
    record.file = basename(path);
    paths.push(path);
    return record;
  }
  async function finish({ browserClosed, deadlineAt }) {
    stopped = true;
    activeStop?.();
    report.browserTransportClosed = browserClosed === true;
    const end = Math.min(Date.now() + 10000, deadlineAt);
    let timer;
    try {
      assert(
        Number.isFinite(end) && end > Date.now(),
        'Heap finish has no remaining owner deadline',
      );
      // Browser closure is the existing outer owner's responsibility. Detach never
      // replaces that proof, and no parsing starts while the observed page can run.
      await Promise.race([
        cdp.detach().then(
          () => {
            report.cdpDetached = true;
          },
          () => {
            report.cdpDetached = 'browser-transport-already-closed';
          },
        ),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Heap CDP detach deadline expired')),
            end - Date.now(),
          );
        }),
      ]);
      clearTimeout(timer);
      assert.equal(browserClosed, true, 'Observed browser did not close');
      assert(Date.now() < end, 'Heap finish owner deadline expired');
      assert.equal(report.completedBoundaries, 20);
      assert.equal(report.captures.length, 2);
      assert(
        report.captures.every(
          (entry) =>
            entry.status === 'retained-unvalidated' &&
            entry.fileClosed &&
            entry.listenersRemoved &&
            entry.progressComplete,
        ),
      );
      report.analysis = compareQualificationHeaps(
        paths[0],
        paths[1],
        report.captures[0],
        report.captures[1],
      );
      assert(
        Date.now() < end,
        'Post-closure heap analysis exceeded its remaining ten-second bound',
      );
      for (const entry of report.captures) entry.status = 'validated';
      report.status = 'complete-diagnostic';
    } catch (error) {
      report.status = 'failed';
      report.failure = String(error.message).slice(0, 2048);
    } finally {
      clearTimeout(timer);
    }
    return report;
  }
  return { report, observe, finish };
}

/** Independent file readback after the row-owned qualifier process has closed. */
export function verifyQualificationHeapRetainerReport(output, report) {
  assert.equal(report?.protocol, HEAP_RETAINER_PROTOCOL);
  assert.equal(report.sourceRevision, HEAP_RETAINER_SOURCE);
  assert.equal(report.scenarioSHA256, HEAP_RETAINER_RECIPE);
  assert.equal(report.performanceQualification, 'excluded-memory-profiling');
  assert.equal(report.status, 'complete-diagnostic');
  assert.equal(report.completedBoundaries, 20);
  assert.equal(report.browserTransportClosed, true);
  assert([true, 'browser-transport-already-closed'].includes(report.cdpDetached));
  assert.deepEqual(report.limits, HEAP_RETAINER_LIMITS);
  assert.equal(report.analysis?.status, 'observed');
  assert.equal(report.analysis?.verdict, 'requires-retainer-review');
  assert.equal(report.captures?.length, 2);
  assert.deepEqual(
    report.captures.map((record) => record.ordinal),
    [1, 20],
  );
  assert.deepEqual(report.captures[0].identity, report.captures[1].identity);
  const identities = [];
  for (const [index, record] of report.captures.entries()) {
    const path = join(
      dirname(output),
      basename(output) + (index ? '.last' : '.first') + '.heapsnapshot',
    );
    assert.equal(record.file, basename(path));
    assert.equal(record.status, 'validated');
    assert(record.fileClosed && record.listenersRemoved && record.progressComplete);
    assert(
      Number.isSafeInteger(record.chunks) &&
        record.chunks > 0 &&
        record.chunks <= HEAP_RETAINER_LIMITS.chunks,
    );
    const info = lstatSync(path);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.equal(realpathSync(path), path);
    assert(
      info.size > 0 &&
        info.size === record.bytes &&
        info.size <= HEAP_RETAINER_LIMITS.perSnapshotBytes,
    );
    const bytes = readFileSync(path);
    assert.equal(sha(bytes), record.sha256);
    identities.push({ file: record.file, bytes: bytes.length, sha256: record.sha256 });
  }
  return { status: 'verified', captures: identities, verdict: 'requires-retainer-review' };
}
