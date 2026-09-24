import assert from 'node:assert/strict';
import { authoritativeCheckpoint } from '../../replay.mjs';

// Integration-test evidence only. Public checkpoints and replay verification keep
// their exact floating-point state. Linux x64 and macOS ARM64 collision steering
// differed by at most 4.27e-14 in these witnessed movement scalars. Normalize only
// those paths, on a copy, so every other authoritative field stays exact.
export const ROUTE_EVIDENCE_FORMAT = 'RouteEvidenceCheckpointV1';
export const ROUTE_EVIDENCE_DECIMALS = 12;
export const ROUTE_EVIDENCE_PATHS = Object.freeze([
  'player.x',
  'player.y',
  'enemies[].x',
  'enemies[].y',
  'enemies[].vx',
  'enemies[].vy',
  'classic.actorTime',
]);
export function expectedRouteEvidence(evidence, id) {
  assert.equal(evidence.format, ROUTE_EVIDENCE_FORMAT);
  assert.equal(evidence.decimalPlaces, ROUTE_EVIDENCE_DECIMALS);
  assert.deepEqual(evidence.paths, ROUTE_EVIDENCE_PATHS);
  assert.match(evidence.checkpoints[id], /^[0-9a-f]{16}$/);
  return evidence.checkpoints[id];
}
export function routeEvidenceCheckpoint(run) {
  const copy = structuredClone(run);
  const round = (owner, key) => {
    if (typeof owner?.[key] === 'number' && Number.isFinite(owner[key]))
      owner[key] = Number(owner[key].toFixed(ROUTE_EVIDENCE_DECIMALS));
  };
  for (const key of ['x', 'y']) round(copy.player, key);
  for (const enemy of copy.enemies) {
    for (const key of ['x', 'y', 'vx', 'vy']) round(enemy, key);
  }
  round(copy.classic, 'actorTime');
  return authoritativeCheckpoint(copy);
}
