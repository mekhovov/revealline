import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { campaignContinuation, campaignSelection, savedFlightPreview } from '../continuation.mjs';
import { emptyProgress, awardCompletion } from '../progress.mjs';
import { campaignKey } from '../library.mjs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

const campaign = JSON.parse(fs.readFileSync(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = CLASSES;
function progressWith(indices) {
  const progress = emptyProgress(campaign);
  for (const index of indices) progress.clears[campaign.levels[index].id] = { medals: 1 };
  return progress;
}
test('a new campaign offers its first accessible mission without changing any progress', () => {
  const progress = emptyProgress(campaign),
    before = structuredClone(progress);
  assert.deepEqual(campaignContinuation(progress, campaign), {
    complete: false,
    completed: 0,
    total: campaign.levels.length,
    levelIndex: 0,
  });
  assert.deepEqual(progress, before);
});
test('ordinary bronze clears continue at the first unfinished mission, without mastery gates', () => {
  assert.equal(campaignSelection(progressWith([0, 1, 2]), campaign).levelIndex, 3);
});
test('sparse and inherited clear records cannot skip the actual first unfinished mission', () => {
  const progress = progressWith([2, 5]);
  assert.equal(campaignContinuation(progress, campaign).levelIndex, 0);
  Object.setPrototypeOf(progress.clears, { [campaign.levels[0].id]: { medals: 3 } });
  assert.equal(campaignContinuation(progress, campaign).levelIndex, 0);
  assert.equal(campaignContinuation(progress, campaign).completed, 2);
});
test('a completed campaign produces an overview with no next mission or implicit first-level replay', () => {
  const progress = progressWith(campaign.levels.map((_, i) => i));
  const next = campaignContinuation(progress, campaign);
  assert.equal(next.complete, true);
  assert.equal(next.levelIndex, null);
  const selected = campaignSelection(progress, campaign);
  assert.equal(selected.overview, true);
  assert.equal(selected.explicit, false);
  assert.equal(selected.levelIndex, campaign.levels.length - 1);
});
test('explicit gallery replay selection wins over suggested continuation or completed overview', () => {
  for (const progress of [
    progressWith([0, 1, 2]),
    progressWith(campaign.levels.map((_, i) => i)),
  ]) {
    const result = campaignSelection(progress, campaign, { levelId: campaign.levels[1].id });
    assert.equal(result.levelIndex, 1);
    assert.equal(result.overview, false);
    assert.equal(result.explicit, true);
  }
});
test('an explicit validated restoration target is retained even if a separate profile lacks its earlier clears', () => {
  const result = campaignSelection(emptyProgress(campaign), campaign, {
    levelId: campaign.levels[4].id,
  });
  assert.equal(result.levelIndex, 4);
  assert.equal(result.explicit, true);
});
test('an obsolete selection falls back to current campaign progress; unknown clear IDs do not count', () => {
  const progress = progressWith([0]);
  progress.clears.removed = { medals: 3 };
  assert.equal(campaignSelection(progress, campaign, { levelId: 'removed' }).levelIndex, 1);
  assert.equal(campaignContinuation(progress, campaign).completed, 1);
});
test('invalid or empty continuation inputs reject rather than manufacturing completion', () => {
  assert.throws(() => campaignContinuation({}, campaign), /readable campaign progress/);
  assert.throws(
    () => campaignContinuation({ clears: {} }, { levels: [] }),
    /campaign with missions/,
  );
});
test('saved-flight previews are bounded metadata, not validation or trusted imported names', () => {
  assert.equal(savedFlightPreview(null), null);
  assert.deepEqual(savedFlightPreview({}), {
    title: 'Saved flight',
    note: 'Verified before loading; flight stays paused.',
  });
  const candidate = {
    campaignKey: campaignKey(campaign),
    replay: {
      level: { id: campaign.levels[0].id, name: '<untrusted>' },
      summary: { coverage: 0.2 },
    },
  };
  const before = structuredClone(candidate);
  const preview = savedFlightPreview(candidate, [{ key: campaignKey(campaign), campaign }]);
  assert.ok(preview.title.includes(campaign.levels[0].name));
  assert.ok(!preview.title.includes('<untrusted>'));
  assert.match(preview.note, /Recorded 20%/);
  assert.deepEqual(candidate, before);
  candidate.replay.summary.coverage = Infinity;
  assert.ok(!savedFlightPreview(candidate).note.includes('Infinity'));
});
for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`actual ${turnPolicy} completion advances navigation without changing core rules`, () => {
    const run = createRun(campaign.levels[0], {
      classId: 'scout',
      classRecipes: CLASSES,
      turnPolicy,
    });
    for (let tick = 0; tick < 3000 && run.status === 'running'; tick++)
      stepRun(run, { direction: 'down' }, FIXED_DT);
    assert.equal(run.status, 'won');
    const before = authoritativeCheckpoint(run);
    const progress = awardCompletion(emptyProgress(campaign), campaign, getSummary(run), {
      runId: `continuation-${turnPolicy}`,
    });
    assert.equal(campaignSelection(progress, campaign).levelIndex, 1);
    assert.deepEqual(authoritativeCheckpoint(run), before);
  });
  test(`saved-flight preview preserves the existing verified live-cut restoration: ${turnPolicy}`, async () => {
    const options = { classId: 'scout', classRecipes: CLASSES, turnPolicy };
    const run = createRun(campaign.levels[0], options),
      recorder = createRecorder(campaign.levels[0], options, 'continuation-test');
    for (let tick = 0; tick < 100; tick++) {
      const input = { direction: 'down' };
      stepRun(run, input, FIXED_DT);
      recordInput(recorder, input);
    }
    const session = suspendSession({
      run,
      recorder,
      campaignKey: campaignKey(campaign),
      themeId: 'fpv',
      bodyId: 'fpv-body',
      runId: `continue-${turnPolicy}`,
    });
    const original = structuredClone(session),
      checkpoint = authoritativeCheckpoint(run);
    assert.ok(savedFlightPreview(session));
    const restored = await restoreSession(session, {
      campaign,
      campaignKey: campaignKey(campaign),
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
    assert.deepEqual(session, original);
    const altered = structuredClone(session);
    altered.replay.summary.score++;
    assert.ok(savedFlightPreview(altered));
    await assert.rejects(
      restoreSession(altered, { campaign, campaignKey: campaignKey(campaign) }),
      /verification failed/,
    );
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  });
}
