import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, CLASSES } from '../core/index.mjs';
import { createRecorder, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  recoverGameplayTuning,
} from '../gameplay-tuning.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = CLASSES;

test('tuned saved flight reconstructs its own recipe, independent of later preferences', async () => {
  const options = { classId: 'scout', classRecipes: CLASSES, seed: 19 };
  const level = applyGameplayTuning(campaign.levels[0], resolveGameplayTuning('expert'));
  const run = createRun(level, options);
  const saved = suspendSession({
    run,
    recorder: createRecorder(level, options),
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'pressure-save',
    continuation: { direction: null },
  });
  const restored = await restoreSession(saved, { campaign, campaignKey: campaignKey(campaign) });
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  assert.equal(recoverGameplayTuning(restored.run.level).difficulty, 'expert');
  const changed = structuredClone(level);
  changed.goal.coverage = 0.99;
  const forgedRun = createRun(changed, options);
  const forged = suspendSession({
    run: forgedRun,
    recorder: createRecorder(changed, options),
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'forged-pressure',
    continuation: { direction: null },
  });
  await assert.rejects(
    restoreSession(forged, { campaign, campaignKey: campaignKey(campaign) }),
    /Saved rules differ/,
  );
});

test('Solo main menu exposes actual pressure and admin overrides without changing an active run', async (t) => {
  const page = await soloPage(t, { campaign });
  assert.equal(page.$('menu-difficulty').value, 'standard');
  page.frame(0);
  const standard = page.rendered.run;
  assert.equal(recoverGameplayTuning(standard.level).difficulty, 'standard');
  page.change('menu-difficulty', 'expert');
  page.frame(0);
  assert.equal(recoverGameplayTuning(page.rendered.run.level).difficulty, 'expert');
  assert.ok(page.rendered.run.level.rules.moveSpeed > campaign.levels[0].rules.moveSpeed);
  const panel = page.$('gameplay-tuning');
  const enemy = panel.querySelector('[data-tuning="enemySpeed"]');
  enemy.value = '1.25';
  panel.querySelector('button').click();
  page.frame(0);
  assert.equal(recoverGameplayTuning(page.rendered.run.level).adminOverride, true);
  assert.match(page.$('mode-caption').textContent, /ADMIN PLAYTEST/);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running', 'Start the tuned flight.');
  page.frame(0);
  const active = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(active);
  page.change('menu-difficulty', 'gentle');
  page.frame(0);
  assert.strictEqual(page.rendered.run, active);
  assert.deepEqual(authoritativeCheckpoint(active), checkpoint);
});
