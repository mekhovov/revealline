import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  authoritativeCheckpoint,
  verifyReplay,
  verifyReplayAsync,
} from '../replay.mjs';
import { restoreSession } from '../sessions.mjs';
import {
  campaignKey,
  emptyLibrary,
  recordLibraryCompletion,
  exportLibrary,
  importLibrary,
  progressFor,
} from '../library.mjs';
import { completionVariantKey, appearanceMilestones } from '../progress.mjs';
import { campaignContinuation, campaignSelection } from '../continuation.mjs';

// Independently emitted by manifest-verified v0.10.0 archived modules before
// encounter consumer edits. Only a retired cosmetic unlock is projected out; see
// docs/migrations/compatibility-fixture.json. Never regenerate replay expectations from current modules.
const bytes = await readFile(new URL('./fixtures/compatibility-v0100.json', import.meta.url));
const fixture = JSON.parse(bytes);
test('v0.10 replay/profile oracle is pinned and usable without an installed archive', () => {
  assert.equal(fixture.source.revision, '40ae9d23ad8737c4f77f9cc07923948133b7c09d');
  assert.equal(
    createHash('sha256').update(canonicalJSON(fixture)).digest('hex'),
    'ac779b280e0c14270f0aa48abb503c7d233bacd66ba9edb6a6cea0df94c80e8f',
  );
  assert.equal(createHash('sha256').update(canonicalJSON(fixture.cases)).digest('hex'), 'bbb5103f4edc314932ed71ef391b58cc977a690bc52c01c7d354cae8b8b60844');
  assert.equal(createHash('sha256').update(canonicalJSON(fixture.library)).digest('hex'), '2aa0f794781f332755df7370b7f7cf1d0a35eccb3047723f051c27dde4d4d931');
  assert.ok(bytes.length < 100 * 1024);
  assert.equal(fixture.cases.length, 2);
});
for (const entry of fixture.cases) {
  const { recording, suspended } = entry;
  test(`v0.10 ${recording.options.turnPolicy}: normal inputs retain complete replay bytes`, () => {
    const run = createRun(recording.level, recording.options);
    const recorder = createRecorder(recording.level, recording.options, recording.build);
    for (const segment of recording.segments) {
      if (segment.releaseBefore) {
        releaseInputs(run);
        recordRelease(recorder);
      }
      for (let i = 0; i < segment.ticks; i++) {
        stepRun(run, segment.input, FIXED_DT);
        recordInput(recorder, segment.input);
      }
    }
    assert.deepEqual(exportReplay(recorder, run), recording);
    assert.equal(completionVariantKey(recording.summary), entry.variant);
    assert.equal(verifyReplay(recording).match, true);
  });
  test(`v0.10 ${recording.options.turnPolicy}: async verification and suspended live cut preserve authority`, async () => {
    assert.equal((await verifyReplayAsync(recording)).match, true);
    const restored = await restoreSession(suspended, {
      campaign: fixture.campaign,
      campaignKey: fixture.campaignKey,
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), suspended.replay.checkpoint);
    assert.deepEqual(exportReplay(restored.recorder, restored.run), suspended.replay);
  });
}
test('v0.10 profile export, chapter continuation, rewards and campaign identity remain exact', () => {
  const campaign = fixture.campaign;
  assert.equal(campaignKey(campaign), fixture.campaignKey);
  let library = emptyLibrary();
  for (const { recording } of fixture.cases)
    library = recordLibraryCompletion(library, {
      campaign,
      result: recording.summary,
      runId: `old-win-${recording.options.turnPolicy}`,
      themeId: 'fpv',
      bodyId: 'fpv-body',
      completedAt: '2026-09-12T12:00:00.000Z',
    });
  // Optional preferences migrate forward; every older field stays exact.
  for (const exported of [
    exportLibrary(library),
    exportLibrary(importLibrary(fixture.library, { campaigns: [campaign] })),
  ]) {
    const owned = JSON.parse(exported);
    assert.equal(Object.hasOwn(owned.preferences, 'touchControls'), true);
    assert.equal(owned.preferences.touchControls, null);
    delete owned.preferences.touchControls;
    assert.equal(Object.hasOwn(owned.preferences, 'textFace'), true);
    assert.equal(owned.preferences.textFace, 'pixel');
    delete owned.preferences.textFace;
    assert.equal(Object.hasOwn(owned.preferences, 'screenSteeringHand'), true);
    assert.equal(owned.preferences.screenSteeringHand, 'left');
    delete owned.preferences.screenSteeringHand;
    assert.equal(Object.hasOwn(owned.preferences, 'screenControls'), true);
    assert.equal(owned.preferences.screenControls, 'auto');
    delete owned.preferences.screenControls;
    assert.equal(Object.hasOwn(owned.preferences, 'textSize'), true);
    assert.equal(owned.preferences.textSize, 'standard');
    delete owned.preferences.textSize;
    assert.equal(Object.hasOwn(owned.preferences, 'campaignDifficulty'), true);
    assert.equal(owned.preferences.campaignDifficulty, 'standard');
    delete owned.preferences.campaignDifficulty;
    assert.equal(owned.preferences.controllerBoostMode, 'hold');
    delete owned.preferences.controllerBoostMode;
    assert.deepEqual(owned, fixture.library);
  }
  const progress = progressFor(library, campaign);
  assert.deepEqual(campaignContinuation(progress, campaign), fixture.continuation);
  assert.deepEqual(campaignSelection(progress, campaign), fixture.selection);
  assert.deepEqual(appearanceMilestones(progress, campaign), fixture.appearanceMilestones);
});
