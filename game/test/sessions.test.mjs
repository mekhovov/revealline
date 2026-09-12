import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint, exportReplay } from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import {
  suspendSession,
  restoreSession,
  saveSession,
  SESSION_STORAGE_BYTES,
  SESSION_IMPORT_BYTES,
} from '../sessions.mjs';
const campaign = JSON.parse(fs.readFileSync(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = CLASSES;
function flight(turnPolicy = 'immediate') {
  const options = { classId: 'scout', classRecipes: CLASSES, turnPolicy };
  const run = createRun(campaign.levels[0], options),
    recorder = createRecorder(campaign.levels[0], options, 'test');
  const input = { direction: 'down', boost: false, action: false, pickup: false };
  for (let i = 0; i < 100; i++) {
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  return {
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'test-session',
  };
}
for (const policy of ['immediate', 'grid-center'])
  test(`saved live cut restores and can continue exactly: ${policy}`, async () => {
    const source = flight(policy),
      suspended = suspendSession(source);
    assert.ok(source.run.trail.length > 0);
    const restored = await restoreSession(JSON.stringify(suspended), {
      campaign,
      campaignKey: campaignKey(campaign),
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(source.run));
    const input = { direction: 'down' };
    for (let i = 0; i < 60; i++) {
      stepRun(source.run, input, FIXED_DT);
      recordInput(source.recorder, input);
      stepRun(restored.run, input, FIXED_DT);
      recordInput(restored.recorder, input);
    }
    assert.deepEqual(
      exportReplay(restored.recorder, restored.run).checkpoint,
      exportReplay(source.recorder, source.run).checkpoint,
    );
  });
test('altered checkpoint and uninstalled campaign do not load', async () => {
  const saved = suspendSession(flight());
  await assert.rejects(
    restoreSession(saved, { campaign, campaignKey: 'wrong' }),
    /different campaign/,
  );
  const changed = structuredClone(saved);
  changed.replay.summary.score = 9000;
  await assert.rejects(
    restoreSession(changed, { campaign, campaignKey: campaignKey(campaign) }),
    /verification failed/,
  );
});
test('a self-consistent replay of altered campaign rules cannot load as registered progress', async () => {
  const changed = structuredClone(campaign);
  changed.levels[0].goal.coverage = 0.9;
  const options = { classId: 'scout', classRecipes: CLASSES };
  const run = createRun(changed.levels[0], options),
    recorder = createRecorder(changed.levels[0], options);
  const s = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'altered',
  });
  await assert.rejects(
    restoreSession(s, { campaign, campaignKey: campaignKey(campaign) }),
    /rules differ/,
  );
});
test('storage failure and oversized save preserve the previous attempt', () => {
  let value = 'old';
  const storage = {
    setItem(k, v) {
      value = v;
    },
  };
  assert.equal(saveSession(storage, 'slot', { text: 'x'.repeat(SESSION_STORAGE_BYTES) }).ok, false);
  assert.equal(value, 'old');
  assert.equal(
    saveSession(
      {
        setItem() {
          throw new Error('quota');
        },
      },
      'slot',
      {},
    ).ok,
    false,
  );
  const valid = suspendSession(flight());
  assert.equal(saveSession(storage, 'slot', valid).ok, true);
  assert.deepEqual(JSON.parse(value), valid);
});
test('terminal attempt cannot overwrite suspend slot', () => {
  const f = flight();
  while (f.run.status === 'running') {
    stepRun(f.run, { direction: 'down' }, FIXED_DT);
    recordInput(f.recorder, { direction: 'down' });
  }
  assert.throws(() => suspendSession(f), /unfinished/);
});

test('session envelope rejects malicious getters, unknown fields, cycles and oversized outer files before replay work', async () => {
  const saved = suspendSession(flight());
  let reads = 0;
  Object.defineProperty(saved, 'savedAt', {
    enumerable: true,
    get() {
      reads++;
      return '2026-09-12T12:00:00.000Z';
    },
  });
  await assert.rejects(
    restoreSession(saved, { campaign, campaignKey: campaignKey(campaign) }),
    /accessors/,
  );
  assert.equal(reads, 0);
  for (const key of ['__proto__', 'constructor', 'prototype'])
    await assert.rejects(
      restoreSession(`{"${key}":{}}`, { campaign, campaignKey: campaignKey(campaign) }),
      /Forbidden/,
    );
  const unknown = suspendSession(flight());
  unknown.script = 'unused';
  await assert.rejects(
    restoreSession(unknown, { campaign, campaignKey: campaignKey(campaign) }),
    /not supported/,
  );
  const cycle = suspendSession(flight());
  cycle.loop = cycle;
  await assert.rejects(
    restoreSession(cycle, { campaign, campaignKey: campaignKey(campaign) }),
    /cycles/,
  );
  await assert.rejects(
    restoreSession(' '.repeat(SESSION_IMPORT_BYTES + 1), {
      campaign,
      campaignKey: campaignKey(campaign),
    }),
    /budget/,
  );
  await assert.rejects(
    restoreSession(undefined, { campaign, campaignKey: campaignKey(campaign) }),
    /saved flight file/,
  );
});
test('invalid dates, unsafe cosmetic IDs and ineligible run IDs cannot enter resumable metadata', async () => {
  for (const patch of [
    { savedAt: '2026-02-31T00:00:00.000Z' },
    { savedAt: 'tomorrow' },
    { bodyId: 'javascript:run()' },
    { themeId: '' },
    { runId: 'x'.repeat(160) },
  ]) {
    const saved = { ...suspendSession(flight()), ...patch };
    await assert.rejects(
      restoreSession(saved, { campaign, campaignKey: campaignKey(campaign) }),
      /identity|timestamp/,
    );
  }
  const source = flight();
  source.campaignKey = 'a'.repeat(278);
  const saved = suspendSession(source);
  const restored = await restoreSession(saved, { campaign, campaignKey: source.campaignKey });
  assert.equal(restored.session.campaignKey, source.campaignKey);
});
test('restore snapshots imported replay and metadata before yielding; later caller edits cannot alter the accepted run', async () => {
  const saved = suspendSession(flight()),
    original = structuredClone(saved);
  const pending = restoreSession(saved, { campaign, campaignKey: campaignKey(campaign) });
  saved.runId = 'changed-later';
  saved.replay.options.classId = 'invented';
  saved.replay.segments[0].input.direction = 'left';
  const restored = await pending;
  assert.equal(restored.session.runId, original.runId);
  assert.equal(restored.recorder.options.classId, original.replay.options.classId);
  assert.deepEqual(authoritativeCheckpoint(restored.run), original.replay.checkpoint);
});
test('failed metadata serialization preserves the previous suspended slot without invoking toJSON', () => {
  let written = false,
    called = false;
  const saved = suspendSession(flight());
  saved.toJSON = () => {
    called = true;
    return {};
  };
  assert.equal(
    saveSession(
      {
        setItem() {
          written = true;
        },
      },
      'slot',
      saved,
    ).ok,
    false,
  );
  assert.equal(written, false);
  assert.equal(called, false);
});
