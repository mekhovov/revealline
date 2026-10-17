// Recheck the saved native exports against the current, pinned implementation.
// This verifies recorded evidence; it does not automate or claim a new UI run.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { replayAdvancedRecording } from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';

const root = new URL('../../', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const staging = await read('../fpv-native-post-publication-staging.json');
for (const [name, expected] of Object.entries(staging.sourceHashes))
  assert.equal(sha256(await readFile(new URL(name, root))), expected, name);

const first = await read('first-session.json');
const second = await read('second-session.json');
const saved = first.samples.at(-1).library;
assert.deepEqual(saved, second.samples[0].library);
assert.deepEqual(saved, second.samples.at(-1).library);
assert.equal(saved.revision, 7);
const profile = saved.profiles.find((item) => item.id === saved.defaultProfileId);
assert.equal(profile.response.rates.axes.roll.rate, 91);
const imported = saved.profiles.find((item) => item.provenance);
assert.equal(imported.response.rates.axes.roll.rate, 88);
assert.equal(imported.provenance.operation, 'patch');
assert.equal(imported.provenance.firmware.version, '2026.6.2');
assert.equal(imported.provenance.review.ignored.total, 1);
assert.match(imported.provenance.review.ignored.entries[0], /p_roll/);
assert.equal(saved.setups.length, 2);
assert.equal(
  saved.setups.find((item) => item.id === saved.selectedSetupId).name,
  'Native setup 34 copy',
);
for (const setup of saved.setups) {
  assert.deepEqual(setup.camera, { tilt: 34, verticalFov: 106 });
  assert.equal(setup.profileId, null);
}
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
assert.ok(first.samples.some((item) => item.label === 'ui:Restart practice'));
assert.ok(second.samples.some((item) => item.label === 'disposed'));
const recordings = [];
for (const [file, rate] of [
  ['first-arena.json', 88],
  ['reopened-arena.json', 91],
]) {
  const recording = await read(file);
  assert.equal(recording.config.configuration.rateProfile.axes.roll.rate, rate);
  assert.equal(recording.scored, false);
  const replay = await replayAdvancedRecording(recording);
  assert.equal(replay.verified, true);
  assert.equal(replay.verificationScope, 'complete');
  recordings.push({
    file,
    verified: replay.verified,
    missionTicks: recording.missionTicks,
    finalHash: recording.finalHash,
    frequency: recording.config.frequency,
    rollRate: rate * 10,
    format: recording.format,
  });
}
console.log(
  JSON.stringify(
    {
      pass: true,
      node: process.version,
      sourceHashCount: Object.keys(staging.sourceHashes).length,
      sourceStable: true,
      libraryExactlyRetained: true,
      librarySha256: sha256(JSON.stringify(saved)),
      recordings,
    },
    null,
    2,
  ),
);
