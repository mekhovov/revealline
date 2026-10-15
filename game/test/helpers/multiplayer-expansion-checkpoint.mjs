import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../../data-json.mjs';
import { localTerminalObservations } from '../../multiplayer-terminal-observation.mjs';

const witnesses = JSON.parse(
  await readFile(
    new URL('../fixtures/multiplayer-expansion/runtime-checkpoints.json', import.meta.url),
  ),
);
assert.equal(witnesses.format, 'multiplayer-expansion-runtime-witnesses.v1');
assert.equal(Object.keys(witnesses.rows).length, 720);

// Exact complete states witnessed on two processors. No rounding, epsilon,
// removed fields or architecture-based skips. Keep the original ARM oracle;
// reject every state other than these finitely reviewed native snapshots.
// Public replay readers and their exact-state/terminal distinction are unchanged.
export function assertExpansionCheckpoint(mode, run, row, group) {
  const key = `${group}/${row.missionId}`;
  const expected = witnesses.rows[key];
  assert(expected, key);
  assert.equal(row.checkpoint, expected.arm64Checkpoint, `${key}: original route witness`);
  const actual = createHash('sha256').update(JSON.stringify(run)).digest('hex');
  assert(
    [expected.arm64Checkpoint, expected.x64Checkpoint].includes(actual),
    `${key}: unknown exact native state ${actual}`,
  );
  assert.equal(
    createHash('sha256')
      .update(canonicalJSON(localTerminalObservations(mode, run)))
      .digest('hex'),
    expected.terminalCheckpoint,
    `${key}: exact portable terminal observations`,
  );
}
