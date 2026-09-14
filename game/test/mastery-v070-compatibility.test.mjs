import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  verifyReplayAsync,
  takeReplayMasteryObserver,
  authoritativeCheckpoint,
  recordInput,
  recordRelease,
  exportReplay,
} from '../replay.mjs';
import { STEADY_SIGNAL, masteryDefinitionIdentity, captureMasteryFacts } from '../mastery.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey, importLibrary, exportLibrary } from '../library.mjs';
import { pictureMasteries } from '../ui/mastery-view.mjs';

// Golden outputs came only from manifest-checked v0.7.0 source.tar modules.
// No archive, Git, fixture generator or old runtime is needed by these tests.
// Do not regenerate this baseline to accommodate a new definition dispatcher.
const bytes = await readFile(new URL('./fixtures/mastery-v070.json', import.meta.url));
const fixture = JSON.parse(bytes);
const canonical = (value) =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`;
const copy = (value) => structuredClone(value);
const request = (entry) => ({
  definition: copy(fixture.definition),
  campaignId: fixture.campaign.id,
  campaignKey: fixture.campaignKey,
  runId: entry.preview.setup.runId,
});

test('v0.7 Steady baseline has pinned archive provenance and independent bounded golden data', () => {
  assert.equal(fixture.format, 'revealline-mastery-compatibility.v070.v1');
  assert.equal(fixture.source.version, 'v0.7.0');
  assert.equal(fixture.source.sourceRevision, '1d4a8d9636428122cca857533dff68c7ee65ac88');
  assert.equal(
    fixture.source.sourceArchiveSha256,
    'd22895233c1754dd1a69dd736bf4609252211e89b92c5a86ecf60d04351b9317',
  );
  assert.equal(fixture.source.files.length, 23);
  assert.ok(fixture.source.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.equal(fixture.cases.length, 4);
  assert.equal(fixture.cases.filter((entry) => entry.suspended).length, 2);
  assert.ok(bytes.length < 160 * 1024);
  assert.equal(
    createHash('sha256').update(canonical(fixture)).digest('hex'),
    '5cc7f2b8f7680df351437c5b6b6f008db98ccacbab09b9ccdf9e2772e83dde23',
  );
});

test('Steady definition and shipped campaign retain the exact v0.7 identities', async () => {
  assert.deepEqual(STEADY_SIGNAL, fixture.definition);
  assert.equal(masteryDefinitionIdentity(STEADY_SIGNAL), fixture.definitionIdentity);
  assert.equal(fixture.definitionIdentity, 'mastery-v1-2e6aae3f42f3d3c2');
  const pack = JSON.parse(
    await readFile(new URL('../content/packs/homeward-skies.json', import.meta.url), 'utf8'),
  );
  const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  assert.deepEqual(campaign, fixture.campaign);
  assert.equal(campaignKey(campaign), fixture.campaignKey);
});

for (const entry of fixture.cases) {
  test(`${entry.id}: old replay result and complete Steady preview remain exact`, async () => {
    const recording = copy(entry.recording),
      before = copy(recording);
    const ordinary = await verifyReplayAsync(recording);
    assert.equal(ordinary.match, true);
    assert.equal(Object.hasOwn(ordinary, 'masteryPreview'), false);
    assert.equal(takeReplayMasteryObserver(ordinary), null);
    const observed = await verifyReplayAsync(recording, { mastery: request(entry) });
    assert.equal(observed.match, true);
    assert.deepEqual(observed.actual, ordinary.actual);
    assert.deepEqual(observed.masteryPreview, entry.preview);
    assert.deepEqual(authoritativeCheckpoint(observed.state), entry.recording.checkpoint);
    const observer = takeReplayMasteryObserver(observed);
    assert.deepEqual(observer.snapshot(), entry.preview);
    assert.equal(takeReplayMasteryObserver(observed), null);
    assert.deepEqual(recording, before);
  });

  test(`${entry.id}: qualified or unqualified wrapper result and record remain exact`, async () => {
    const result = await verifyMasteryRun({
      replay: copy(entry.recording),
      campaign: copy(fixture.campaign),
      definition: copy(fixture.definition),
      runId: entry.preview.setup.runId,
      earnedAt: '2026-09-12T12:00:00.000Z',
    });
    assert.deepEqual(result, entry.verified);
    assert.deepEqual(verifiedMasteryRecord(result), entry.record);
  });

  if (entry.suspended)
    test(`${entry.id}: restored open cut, resave and continuation match the old runtime`, async () => {
      const golden = entry.suspended,
        saved = copy(golden.session),
        before = copy(saved);
      const restored = await restoreSession(saved, {
        campaign: copy(fixture.campaign),
        campaignKey: fixture.campaignKey,
        masteryDefinition: copy(fixture.definition),
      });
      assert.deepEqual(restored.masteryObserver.snapshot(), golden.preview);
      assert.deepEqual(authoritativeCheckpoint(restored.run), golden.checkpoint);
      assert.deepEqual(suspendSession({ ...restored, ...restored.session }), golden.resaved);
      assert.deepEqual(saved, before);
      let index = 0;
      const start = restored.run.tick;
      for (const segment of entry.recording.segments) {
        if (segment.releaseBefore && index >= start) {
          releaseInputs(restored.run);
          recordRelease(restored.recorder);
        }
        for (let n = 0; n < segment.ticks; n++) {
          if (index++ < start) continue;
          stepRun(restored.run, segment.input, FIXED_DT);
          recordInput(restored.recorder, segment.input);
          restored.masteryObserver.observe(
            captureMasteryFacts(restored.run, { runId: restored.session.runId }),
          );
        }
      }
      assert.deepEqual(restored.masteryObserver.snapshot(), golden.continuedPreview);
      assert.deepEqual(exportReplay(restored.recorder, restored.run), golden.continuedReplay);
    });
}

test('v0.7 opaque future-hash metadata remains portable and archived without becoming proof', () => {
  const old = fixture.opaqueFuture;
  assert.equal(old.definition.version, 'xonix-mastery-definition.v2');
  assert.equal(old.definitionUnsupported, true, 'The archived runtime rejected this definition.');
  assert.match(old.record.definitionHash, /^mastery-v1-[a-f0-9]{16}$/);
  assert.equal(old.library.format, 'xonix-library.v2');
  assert.deepEqual(old.library.masteries, [old.record]);
  assert.equal(old.labels[0].name, 'Archived seal: supply-line');
  const current = importLibrary(exportLibrary(copy(old.library)));
  assert.equal(Object.hasOwn(current.preferences, 'controllerBoostMode'), true);
  assert.equal(current.preferences.controllerBoostMode, 'hold');
  const owned = copy(current);
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
  // Preference migration cannot change any older metadata or its archive label.
  delete owned.preferences.controllerBoostMode;
  assert.deepEqual(owned, old.library);
  assert.deepEqual(pictureMasteries(current.masteries, old.picture, null), old.labels);
  assert.throws(() => verifiedMasteryRecord(current.masteries[0]), /verification is required/);
});
