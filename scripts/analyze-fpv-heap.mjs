import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

export const FPV_HEAP_LIMITS = Object.freeze({
  bytes: 128 * 1024 * 1024,
  nodes: 1_000_000,
  edges: 8_000_000,
});
const CONSTRUCTORS = new Set([
  'WebGLRenderer',
  'Scene',
  'Group',
  'Mesh',
  'PerspectiveCamera',
  'MeshStandardMaterial',
  'LineBasicMaterial',
  'CanvasTexture',
  'DataTexture',
  'BoxGeometry',
  'BufferGeometry',
  'WebGLRenderingContext',
  'WebGL2RenderingContext',
  'WebGLTexture',
  'WebGLProgram',
]);
const CLOSURES = new Set([
  'mountFlightApp',
  'mountRadioSetup',
  'mountFlightNotebook',
  'mountFlightStudio',
  'drawSticks',
  'frame',
  'paint',
  'render',
  'setLocale',
  'onFreeze',
]);
const fail = (message) => {
  throw new TypeError(`Flight heap: ${message}`);
};
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const label = (value) =>
  String(value)
    .replace(/https?:\/\/[^ /)]+/g, '[origin]')
    .slice(0, 180);

/** Offline snapshot analysis. Shallow sizes and strong paths are not dominator
 * retained sizes, exclusive ownership, native decoder accounting or GPU bytes. */
export function analyzeFlightHeap(input) {
  return {
    ...analyzeNamedHeap(input, { constructors: CONSTRUCTORS, closures: CLOSURES }),
    format: 'FlightHeapAnalysis.v1',
  };
}

/** Shared offline parser. Callers select actual runtime names, not new runtime
 * instrumentation. The existing flight adapter retains its exact output. */
export function analyzeNamedHeap(input, { constructors = [], closures = [] } = {}) {
  const names = (values) => {
    const result = new Set(values);
    if (
      result.size > 64 ||
      [...result].some(
        (value) => typeof value !== 'string' || !/^[A-Za-z_$][\w$]{0,79}$/.test(value),
      )
    )
      fail('invalid named cohorts');
    return result;
  };
  const selectedConstructors = names(constructors),
    selectedClosures = names(closures);
  const meta = input?.snapshot?.meta,
    nodes = input?.nodes,
    edges = input?.edges,
    strings = input?.strings;
  if (!meta || !Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(strings))
    fail('missing snapshot arrays');
  const nf = meta.node_fields,
    ef = meta.edge_fields;
  if (
    !Array.isArray(nf) ||
    !Array.isArray(ef) ||
    new Set(nf).size !== nf.length ||
    new Set(ef).size !== ef.length
  )
    fail('invalid field descriptors');
  const field = (fields, name) => {
    const index = fields.indexOf(name);
    if (index < 0) fail(`missing ${name}`);
    return index;
  };
  const nt = field(nf, 'type'),
    nn = field(nf, 'name'),
    ni = field(nf, 'id'),
    ns = field(nf, 'self_size'),
    nc = field(nf, 'edge_count'),
    nd = nf.indexOf('detachedness');
  const et = field(ef, 'type'),
    en = field(ef, 'name_or_index'),
    to = field(ef, 'to_node');
  const nodeTypes = meta.node_types?.[nt],
    edgeTypes = meta.edge_types?.[et];
  if (
    !Array.isArray(nodeTypes) ||
    !Array.isArray(edgeTypes) ||
    !nf.length ||
    !ef.length ||
    nodes.length % nf.length ||
    edges.length % ef.length
  )
    fail('malformed widths/types');
  const count = nodes.length / nf.length,
    edgeCount = edges.length / ef.length;
  if (
    !count ||
    count > FPV_HEAP_LIMITS.nodes ||
    edgeCount > FPV_HEAP_LIMITS.edges ||
    strings.length > 2_000_000
  )
    fail('snapshot exceeds bounded graph');
  if (input.snapshot.node_count !== count || input.snapshot.edge_count !== edgeCount)
    fail('declared graph counts differ');
  if (strings.some((value) => typeof value !== 'string')) fail('invalid strings');
  const starts = new Uint32Array(count + 1),
    selected = [],
    cohorts = new Map(),
    byType = new Map();
  let usedEdges = 0,
    shallowBytes = 0,
    detached = 0;
  const ids = new Set();
  const cohortFor = (type, name) => {
    if (type === 'object' && selectedConstructors.has(name)) return `object:${name}`;
    if (type === 'closure' && selectedClosures.has(name)) return `closure:${name}`;
    if (type === 'native') {
      const dom =
        name.match(/^(?:Detached )?(HTML\w+|SVG\w+|Document|Window)(?:\b|$)/) ??
        name.match(/^(?:Detached )?(<[^\s>]+)/);
      if (dom) return `native:${dom[1]}`;
    }
    return null;
  };
  for (let i = 0; i < count; i++) {
    const at = i * nf.length;
    for (const f of [nt, nn, ni, ns, nc]) if (!integer(nodes[at + f])) fail('invalid node number');
    const type = nodeTypes[nodes[at + nt]],
      name = strings[nodes[at + nn]],
      id = nodes[at + ni];
    if (typeof type !== 'string' || typeof name !== 'string' || ids.has(id))
      fail('invalid node descriptor/id');
    ids.add(id);
    starts[i] = usedEdges;
    usedEdges += nodes[at + nc];
    if (usedEdges > edgeCount) fail('node edges exceed graph');
    shallowBytes += nodes[at + ns];
    if (!Number.isSafeInteger(shallowBytes)) fail('invalid shallow sum');
    const row = byType.get(type) ?? { type, count: 0, shallowBytes: 0 };
    row.count++;
    row.shallowBytes += nodes[at + ns];
    byType.set(type, row);
    if (nd >= 0) {
      if (![0, 1, 2].includes(nodes[at + nd])) fail('unknown detachedness');
      if (nodes[at + nd] === 2) detached++;
    }
    const group = cohortFor(type, name);
    if (group) {
      const value = cohorts.get(group) ?? {
        name: group,
        count: 0,
        shallowBytes: 0,
        ids: [],
        paths: [],
      };
      value.count++;
      value.shallowBytes += nodes[at + ns];
      value.ids.push(id);
      if (value.count <= 2) selected.push({ index: i, row: value });
      cohorts.set(group, value);
    }
  }
  starts[count] = usedEdges;
  if (usedEdges !== edgeCount) fail('edge count does not close');
  for (let e = 0; e < edges.length; e += ef.length) {
    if (
      !integer(edges[e + et]) ||
      typeof edgeTypes[edges[e + et]] !== 'string' ||
      !integer(edges[e + to]) ||
      edges[e + to] % nf.length ||
      edges[e + to] >= nodes.length
    )
      fail('invalid edge target/type');
    const type = edgeTypes[edges[e + et]],
      name = edges[e + en];
    if (
      !integer(name) ||
      (!['element', 'hidden'].includes(type) && typeof strings[name] !== 'string')
    )
      fail('invalid edge name');
  }
  const parent = new Int32Array(count).fill(-1),
    parentEdge = new Int32Array(count).fill(-1),
    queue = new Uint32Array(count);
  let head = 0,
    tail = 1;
  queue[0] = 0;
  parent[0] = 0;
  while (head < tail) {
    const i = queue[head++];
    for (let j = starts[i]; j < starts[i + 1]; j++) {
      const at = j * ef.length;
      if (edgeTypes[edges[at + et]] === 'weak') continue;
      const next = edges[at + to] / nf.length;
      if (parent[next] !== -1) continue;
      parent[next] = i;
      parentEdge[next] = at;
      queue[tail++] = next;
    }
  }
  const describe = (i) => ({
    id: nodes[i * nf.length + ni],
    type: nodeTypes[nodes[i * nf.length + nt]],
    name: label(strings[nodes[i * nf.length + nn]]),
  });
  for (const { index, row } of selected) {
    if (parent[index] < 0) {
      row.paths.push({ target: describe(index), strongPath: null });
      continue;
    }
    const path = [];
    let at = index;
    while (at !== 0 && path.length < 80) {
      const edge = parentEdge[at],
        type = edgeTypes[edges[edge + et]],
        name = edges[edge + en];
      path.push({
        node: describe(at),
        via: { type, name: label(['element', 'hidden'].includes(type) ? name : strings[name]) },
      });
      at = parent[at];
    }
    path.push({ node: describe(at), via: null });
    row.paths.push({ target: describe(index), truncated: at !== 0, strongPath: path.reverse() });
  }
  return {
    format: 'NamedHeapAnalysis.v1',
    nodeCount: count,
    edgeCount,
    strongReachableNodes: tail,
    shallowBytes,
    detachedNodes: nd < 0 ? null : detached,
    byType: [...byType.values()].sort((a, b) => a.type.localeCompare(b.type)),
    cohorts: [...cohorts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    limitations: [
      'Forced-GC diagnostic; not natural runtime pacing.',
      'Shallow sizes are not retained/dominator or exclusive application bytes.',
      'At most two sampled shortest strong paths per named cohort; weak edges excluded.',
      'DOM/native wrappers do not measure GPU allocations, browser-process memory or decoders.',
    ],
  };
}

export async function readFlightHeap(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > FPV_HEAP_LIMITS.bytes) fail('file exceeds128MiB');
  const bytes = await readFile(file);
  if (bytes.length > FPV_HEAP_LIMITS.bytes) fail('file grew beyond128MiB');
  return {
    file: { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    ...analyzeFlightHeap(JSON.parse(bytes.toString('utf8'))),
  };
}

export function compareFlightHeaps(before, after) {
  const names = [...new Set([...before.cohorts, ...after.cohorts].map((row) => row.name))].sort();
  return {
    shallowByteDelta: after.shallowBytes - before.shallowBytes,
    detachedNodeDelta:
      before.detachedNodes === null || after.detachedNodes === null
        ? null
        : after.detachedNodes - before.detachedNodes,
    cohorts: names.map((name) => {
      const first = before.cohorts.find((row) => row.name === name),
        last = after.cohorts.find((row) => row.name === name),
        ids = new Set(first?.ids ?? []);
      return {
        name,
        before: first?.count ?? 0,
        after: last?.count ?? 0,
        delta: (last?.count ?? 0) - (first?.count ?? 0),
        survivingIds: (last?.ids ?? []).filter((id) => ids.has(id)).length,
        addedIds: (last?.ids ?? []).filter((id) => !ids.has(id)).length,
      };
    }),
    qualification: false,
  };
}
