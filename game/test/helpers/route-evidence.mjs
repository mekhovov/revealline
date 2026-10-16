import assert from 'node:assert/strict';
import { authoritativeCheckpoint } from '../../replay.mjs';

// Test evidence only: witnessed Linux x64/macOS ARM64 steering differs by at
// most 7.71e-13. Each fixture names only its observed divergent scalars. Every
// other authoritative field, and all production/public replay hashes, stay exact.
// Events are already excluded by authoritativeCheckpoint; they are not removed here.
export const ROUTE_EVIDENCE_FORMAT = 'RouteEvidenceCheckpointV1';
export const ROUTE_EVIDENCE_MAX_ABSOLUTE_ERROR = 1e-12;
export const ROUTE_EVIDENCE_PATHS = Object.freeze([
  'player.x',
  'player.y',
  'enemies[].x',
  'enemies[].y',
  'enemies[].vx',
  'enemies[].vy',
  'enemies[].perimeter',
  'classic.actorTime',
  'time',
  'result.time',
]);
const allowedPath =
  /^(?:player\.(?:x|y)|enemies\[\d+\]\.(?:x|y|vx|vy|perimeter)|classic\.actorTime|time|result\.time)$/;

export function expectedRouteEvidence(evidence, id) {
  assert.equal(evidence.format, ROUTE_EVIDENCE_FORMAT);
  assert.equal(evidence.maxAbsoluteError, ROUTE_EVIDENCE_MAX_ABSOLUTE_ERROR);
  assert.deepEqual(evidence.paths, ROUTE_EVIDENCE_PATHS);
  const expected = evidence.checkpoints[id];
  assert.match(expected.checkpoint.hash, /^[0-9a-f]{16}$/);
  assert(Array.isArray(expected.scalars));
  return expected;
}

/** The clone retains typed arrays; no projection can change a host or reference. */
export function routeEvidenceCheckpoint(run, paths = []) {
  const copy = structuredClone(run),
    seen = new Set();
  const scalars = paths.map((path) => {
    assert.match(path, allowedPath, `Unreviewed scalar path: ${path}`);
    assert(!seen.has(path), `Duplicate scalar path: ${path}`);
    seen.add(path);
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    const key = parts.pop();
    let owner = copy;
    for (const part of parts) {
      assert(owner && Object.hasOwn(owner, part), `Missing scalar owner: ${path}`);
      owner = owner[part];
    }
    assert(owner && Object.hasOwn(owner, key), `Missing scalar: ${path}`);
    const value = owner[key];
    assert.equal(typeof value, 'number', `Nonnumeric scalar: ${path}`);
    assert(Number.isFinite(value), `Nonfinite scalar: ${path}`);
    owner[key] = 0;
    return { path, value };
  });
  return { checkpoint: authoritativeCheckpoint(copy), scalars };
}

export function assertRouteEvidence(run, expected, label = run.levelId) {
  assert.deepEqual(Object.keys(expected).sort(), ['checkpoint', 'scalars']);
  assert(Array.isArray(expected.scalars));
  for (const scalar of expected.scalars)
    assert.deepEqual(Object.keys(scalar).sort(), ['path', 'value']);
  const actual = routeEvidenceCheckpoint(
    run,
    expected.scalars.map(({ path }) => path),
  );
  assert.deepEqual(actual.checkpoint, expected.checkpoint, `${label}: exact route state`);
  for (let index = 0; index < actual.scalars.length; index++) {
    const { path, value } = expected.scalars[index];
    assert.equal(typeof value, 'number', `${label}: nonnumeric witness ${path}`);
    assert(Number.isFinite(value), `${label}: nonfinite witness ${path}`);
    assert(
      Math.abs(actual.scalars[index].value - value) <= ROUTE_EVIDENCE_MAX_ABSOLUTE_ERROR,
      `${label}: ${path}: expected ${value}, received ${actual.scalars[index].value}`,
    );
  }
  return actual;
}
