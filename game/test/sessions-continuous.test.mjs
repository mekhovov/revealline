import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  authoritativeCheckpoint,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import {
  suspendSession,
  restoreSession,
  snapshotSession,
  CONTINUOUS_SESSION_FORMAT,
} from '../sessions.mjs';
import { campaignKey } from '../library.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = CLASSES;
function flight(turnPolicy = 'grid-center') {
  const options = { classId: 'scout', classRecipes: CLASSES, turnPolicy };
  const run = createRun(campaign.levels[0], options);
  const recorder = createRecorder(campaign.levels[0], options);
  const tick = (direction) => {
    const command = { direction, boost: false, action: false, pickup: false };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
  };
  for (let n = 0; n < 13; n++) tick('down');
  tick('right');
  return {
    run,
    recorder,
    tick,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'continuous-test',
  };
}

test('v2 saves and restores the exact off-center buffered turn without release mutations', async () => {
  const f = flight();
  assert.equal(f.run.player.queuedDirection, 'right');
  const before = authoritativeCheckpoint(f.run),
    recording = structuredClone(f.recorder);
  const saved = suspendSession({ ...f, continuation: { direction: 'right' } });
  assert.equal(saved.format, CONTINUOUS_SESSION_FORMAT);
  assert.deepEqual(authoritativeCheckpoint(f.run), before);
  assert.deepEqual(f.recorder, recording);
  assert.equal(verifyReplay(saved.replay).match, true);
  const restored = await restoreSession(saved, { campaign, campaignKey: f.campaignKey });
  assert.deepEqual(authoritativeCheckpoint(restored.run), before);
  assert.equal(restored.run.player.queuedDirection, 'right');
  assert.equal(restored.session.continuation.direction, 'right');
  for (let i = 0; i < 40; i++) {
    const command = {
      direction: restored.session.continuation.direction,
      boost: false,
      action: false,
      pickup: false,
    };
    f.tick('right');
    stepRun(restored.run, command, FIXED_DT);
    recordInput(restored.recorder, command);
  }
  assert.deepEqual(
    exportReplay(restored.recorder, restored.run).checkpoint,
    exportReplay(f.recorder, f.run).checkpoint,
  );
  assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
});

test('new direction selected immediately before pause is future intent, not rewritten history', async () => {
  const f = flight('immediate');
  const before = exportReplay(f.recorder, f.run);
  const saved = suspendSession({ ...f, continuation: { direction: 'down' } });
  assert.deepEqual(saved.replay, before);
  const restored = await restoreSession(saved, { campaign, campaignKey: f.campaignKey });
  assert.equal(restored.session.continuation.direction, 'down');
  assert.deepEqual(authoritativeCheckpoint(restored.run), before.checkpoint);
});

test('v1 remains released; v2 requires strict owned cardinal-or-null continuation', () => {
  const f = flight();
  const saved = suspendSession({ ...f, continuation: { direction: null } });
  assert.equal(snapshotSession(JSON.stringify(saved)).continuation.direction, null);
  for (const continuation of [
    {},
    { direction: 'diagonal' },
    { direction: 'up', action: true },
    null,
  ]) {
    assert.throws(() => snapshotSession({ ...saved, continuation }));
  }
  assert.throws(() => snapshotSession({ ...saved, format: 'xonix-session.v1' }));
  const legacy = suspendSession(f);
  assert.equal(legacy.format, 'xonix-session.v1');
  assert.equal(f.run.player.queuedDirection, null);
  assert.equal(verifyReplay(legacy.replay).match, true);
});
