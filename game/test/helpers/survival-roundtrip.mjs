// F04a assessment only. This lossless graph oracle accepts trusted test-owned
// simulation state, not player files. It is deliberately outside runtime imports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pauseOverflight } from '../../overflight/core.mjs';

const format = 'SurvivalRoundTripAssessmentV1';
const typed = { Int32Array, Uint32Array, Uint16Array, Float64Array };
export const MAX_ASSESSMENT_BYTES = 8 * 1024 * 1024;

function encodeGraph(root) {
  const seen = new Map(),
    nodes = [];
  function value(item) {
    if (item === undefined) return { scalar: 'undefined' };
    if (typeof item === 'number') {
      if (Object.is(item, -0)) return { scalar: '-0' };
      if (!Number.isFinite(item)) {
        assert(!Number.isNaN(item), 'NaN simulation state');
        return { scalar: String(item) };
      }
    }
    if (item === null || ['string', 'boolean', 'number'].includes(typeof item)) return item;
    assert.equal(typeof item, 'object', 'Unsupported executable state');
    if (seen.has(item)) return { ref: seen.get(item) };
    assert(nodes.length < 40000, 'Assessment node limit');
    const id = nodes.length;
    seen.set(item, id);
    nodes.push(null);
    let node;
    if (item instanceof Set) node = { type: 'Set', values: [...item].map(value) };
    else if (item instanceof Map)
      node = { type: 'Map', values: [...item].map(([key, entry]) => [value(key), value(entry)]) };
    else if (ArrayBuffer.isView(item)) {
      assert(Object.hasOwn(typed, item.constructor.name), 'Unsupported typed array');
      node = { type: item.constructor.name, values: [...item].map(value) };
    } else if (Array.isArray(item)) node = { type: 'Array', values: item.map(value) };
    else {
      const prototype = Object.getPrototypeOf(item);
      assert(prototype === Object.prototype || prototype === null, 'Non-data simulation object');
      const entries = Reflect.ownKeys(item).map((key) => {
        assert.equal(typeof key, 'string', 'Symbol simulation key');
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        assert(descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'Accessor state');
        return [key, value(descriptor.value)];
      });
      node = { type: prototype === null ? 'NullObject' : 'Object', values: entries };
    }
    nodes[id] = node;
    return { ref: id };
  }
  return { root: value(root), nodes };
}

function decodeGraph(graph) {
  const nodes = graph.nodes.map(({ type, values }) => {
    if (type === 'Array') return [];
    if (type === 'Object') return {};
    if (type === 'NullObject') return Object.create(null);
    if (type === 'Set') return new Set();
    if (type === 'Map') return new Map();
    assert(Object.hasOwn(typed, type), 'Unsupported graph node');
    return new typed[type](values.length);
  });
  const value = (item) => {
    if (item === null || typeof item !== 'object') return item;
    if (Object.hasOwn(item, 'ref')) {
      assert(Number.isSafeInteger(item.ref) && item.ref >= 0 && item.ref < nodes.length);
      return nodes[item.ref];
    }
    assert(['undefined', '-0', 'Infinity', '-Infinity'].includes(item.scalar));
    return { undefined: undefined, '-0': -0, Infinity: Infinity, '-Infinity': -Infinity }[
      item.scalar
    ];
  };
  graph.nodes.forEach(({ type, values }, index) => {
    const target = nodes[index];
    if (type === 'Object' || type === 'NullObject')
      for (const [key, entry] of values)
        Object.defineProperty(target, key, {
          value: value(entry),
          enumerable: true,
          writable: true,
          configurable: true,
        });
    else if (type === 'Set') for (const entry of values) target.add(value(entry));
    else if (type === 'Map')
      for (const [key, entry] of values) target.set(value(key), value(entry));
    else
      values.forEach((entry, at) => {
        target[at] = value(entry);
      });
  });
  return value(graph.root);
}

function supported(run) {
  assert(/^OverflightCompiledV[1234]$/.test(run.compiled?.format), 'Unsupported Survival rules');
  assert([1, 3].includes(run.airframes), 'Unsupported airframe setting');
  assert(
    !run.fixture && !run.review && !run.riy && !run.hunt && !run.raidVariant && !run.upgradePolicy,
    'Unsupported host',
  );
  assert(['playing', 'upgrade', 'paused'].includes(run.phase), 'Only unfinished active attempts');
  assert(['playing', 'upgrade'].includes(run._resumePhase), 'Unsupported resume phase');
}

export function assessmentIdentity(run, build) {
  assert.match(build, /^[a-f0-9]{64}$/, 'Exact build identity required');
  return {
    build,
    project: run.compiled.projectIdentity,
    compiled: createHash('sha256').update(JSON.stringify(run.compiled)).digest('hex'),
  };
}

export function encodeSurvivalAssessment(run, identity) {
  supported(run);
  assert.equal(run.phase, 'paused', 'Capture only at a paused fixed-step boundary');
  assert.deepEqual(identity, assessmentIdentity(run, identity.build));
  const source = JSON.stringify({ format, identity, graph: encodeGraph(run) });
  assert(Buffer.byteLength(source) <= MAX_ASSESSMENT_BYTES, 'Assessment byte limit');
  return source;
}

export function decodeSurvivalAssessment(source, expected) {
  assert(Buffer.byteLength(source) <= MAX_ASSESSMENT_BYTES, 'Assessment byte limit');
  const document = JSON.parse(source);
  assert.equal(document.format, format, 'Unsupported assessment format');
  assert.deepEqual(document.identity, expected, 'Incompatible build or content');
  assert(document.graph.nodes.length <= 40000, 'Assessment node limit');
  const run = decodeGraph(document.graph);
  supported(run);
  assert.equal(run.phase, 'paused', 'Restore must remain paused');
  assert.deepEqual(expected, assessmentIdentity(run, expected.build));
  assert.equal(run._grid.records, run.enemies, 'Grid owner must remain the restored enemy pool');
  return run;
}

export function pauseAssessment(run, build) {
  pauseOverflight(run);
  return encodeSurvivalAssessment(run, assessmentIdentity(run, build));
}

export function assessmentDigest(run) {
  return createHash('sha256')
    .update(JSON.stringify(encodeGraph(run)))
    .digest('hex');
}
