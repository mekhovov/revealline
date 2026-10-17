// Verify saved actual-native evidence, not a new UI execution.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { replayAdvancedRecording } from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';

const root = new URL('../../', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const staging = await read('../fpv-input-recovery-native-staging.json');
for (const [name, expected] of Object.entries(staging.sourceHashes))
  assert.equal(sha(await readFile(new URL(name, root))), expected, name);
const session = await read('session.json');
assert.deepEqual(session.errors, []);
assert.deepEqual(session.workers, { created: 2, terminated: 2, live: 0 });
assert.ok(session.samples.some((sample) => sample.label === 'disposed'));
const paused = await read('paused-recording.json');
const resumed = await read('resumed-recording.json');
assert.ok(paused.missionTicks > 0);
assert.ok(resumed.missionTicks > paused.missionTicks);
assert.equal(resumed.identity, paused.identity);
assert.deepEqual(resumed.inputs.slice(0, paused.inputs.length), paused.inputs);
assert.deepEqual(resumed.hashes.slice(0, paused.hashes.length), paused.hashes);
const recordings = [];
for (const [name, recording] of [
  ['paused-recording.json', paused],
  ['resumed-recording.json', resumed],
]) {
  assert.equal(recording.scored, false);
  assert.ok(recording.inputs.every((sample, index) => sample[1] === index));
  const replay = await replayAdvancedRecording(recording);
  assert.equal(replay.verified, true);
  assert.equal(replay.verificationScope, 'complete');
  recordings.push({
    file: name,
    missionTicks: recording.missionTicks,
    finalHash: recording.finalHash,
    frequency: recording.config.frequency,
    verified: replay.verified,
    verificationScope: replay.verificationScope,
    contiguousInputSequences: true,
  });
}
console.log(
  JSON.stringify(
    {
      pass: true,
      node: process.version,
      sourceHashCount: Object.keys(staging.sourceHashes).length,
      sourceStable: true,
      retainedFlightPrefix: true,
      workerCounts: session.workers,
      recordings,
    },
    null,
    2,
  ),
);
