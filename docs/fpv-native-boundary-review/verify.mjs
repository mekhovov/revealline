// Recheck saved actual-native exports; this does not automate a new UI run.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createAdvancedSimulation,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';

const root = new URL('../../', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const staging = await read('../fpv-native-boundary-review-staging.json');
for (const [name, expected] of Object.entries(staging.sourceHashes))
  assert.equal(sha256(await readFile(new URL(name, root))), expected, name);
const first = await read('first-session.json');
const second = await read('second-session.json');
const library = first.samples.at(-1).library;
assert.deepEqual(library, second.samples[0].library);
assert.deepEqual(library, second.samples.at(-1).library);
assert.equal(library.revision, 5);
const restoredProfile = library.profiles.find((profile) => profile.id === library.defaultProfileId);
assert.equal(restoredProfile.revision, 2);
assert.equal(restoredProfile.name, 'New profile');
assert.equal(restoredProfile.history.length, 2);
assert.equal(restoredProfile.response.rates.axes.roll.rate, 67);
assert.equal(restoredProfile.provenance, undefined);
const imported = library.profiles.find((profile) => profile.provenance);
assert.equal(imported.response.rates.axes.roll.rate, 88);
assert.equal(imported.provenance.firmware.version, '2026.6.2');
assert.equal(imported.provenance.operation, 'patch');
assert.equal(imported.provenance.baseline.profileId, restoredProfile.id);
assert.equal(imported.provenance.baseline.revision, 2);
assert.equal(imported.provenance.review.ignored.total, 1);
assert.match(imported.provenance.review.ignored.entries[0], /p_roll/);
for (const [index, session] of [first, second].entries()) {
  assert.deepEqual(session.errors, []);
  assert.equal(session.workers.live, 0);
  assert.equal(session.workers.created, session.workers.terminated);
  assert.deepEqual(session.capabilities, { secureContext: true, webLocks: true, indexedDB: true });
  assert.deepEqual(session.storageProbe, {
    lockAcquired: true,
    transactionComplete: true,
    previousVisits: index,
    visits: index + 1,
  });
}
assert.ok(first.samples.some((sample) => sample.label === 'ui:Restore revision to draft'));
assert.ok(second.samples.some((sample) => sample.label === 'disposed'));
const recording = await read('regional-recording.json');
const recovery = await read('regional-recovery.json');
const replay = await replayAdvancedRecording(recording);
assert.equal(replay.verified, true);
assert.equal(replay.verificationScope, 'complete');
const saved = await verifyAdvancedRecovery(recovery.simulation);
assert.equal(saved.state.missionTick, recording.missionTicks);
const sim = createAdvancedSimulation(recording.config);
let restoredHash;
try {
  sim.restore(saved);
  restoredHash = sim.stateHash();
  assert.equal(restoredHash, recording.finalHash);
} finally {
  sim.dispose();
}
console.log(
  JSON.stringify(
    {
      pass: true,
      node: process.version,
      sourceHashCount: Object.keys(staging.sourceHashes).length,
      sourceStable: true,
      libraryExactlyRetained: true,
      librarySha256: sha256(JSON.stringify(library)),
      restoredProfileHasNoImportReceipt: true,
      laterExplicitImportReceiptRetained: true,
      recording: {
        format: recording.format,
        missionTicks: recording.missionTicks,
        frequency: recording.config.frequency,
        finalHash: recording.finalHash,
        verified: replay.verified,
        verificationScope: replay.verificationScope,
        recoveryVerified: true,
        recoveryRestoredHash: restoredHash,
        scored: recording.scored,
      },
    },
    null,
    2,
  ),
);
