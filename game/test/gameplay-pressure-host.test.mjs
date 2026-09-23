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
  gameplayTuningDescription,
} from '../gameplay-tuning.mjs';
import * as historicalTuning from '../gameplay-tuning-v1.mjs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = CLASSES;

for (const [name, tuning] of [
  ['current reference-paced', { applyGameplayTuning, resolveGameplayTuning }],
  ['historical gp1', historicalTuning],
])
  test(`${name} saved flight reconstructs its own recipe, independent of later preferences`, async () => {
    const options = { classId: 'scout', classRecipes: CLASSES, seed: 19 };
    const level = tuning.applyGameplayTuning(
      campaign.levels[0],
      tuning.resolveGameplayTuning('expert'),
    );
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
  assert(
    page
      .$('menu-difficulty-note')
      .textContent.includes(gameplayTuningDescription(resolveGameplayTuning('standard'))),
  );
  assert.doesNotMatch(
    page.$('menu-difficulty-note').textContent,
    /relative to the authored preset/i,
  );
  page.change('menu-difficulty', 'expert');
  page.frame(0);
  assert.equal(recoverGameplayTuning(page.rendered.run.level).difficulty, 'expert');
  assert.equal(
    page.rendered.run.level.rules.moveSpeed,
    Math.min(campaign.levels[0].width - 2, campaign.levels[0].height - 2) * 0.26,
  );
  const panel = page.$('gameplay-tuning');
  const enemy = panel.querySelector('[data-tuning="enemySpeed"]');
  enemy.value = '1.25';
  panel.querySelector('button').click();
  page.frame(0);
  assert.equal(recoverGameplayTuning(page.rendered.run.level).adminOverride, true);
  assert.match(page.$('mode-caption').textContent, /ADMIN PLAYTEST/);
  assert(
    panel.textContent.includes(
      gameplayTuningDescription(recoverGameplayTuning(page.rendered.run.level)),
    ),
  );
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

test('current Journey menus and overlay report lives and normalized pacing without historical percentage claims', async (t) => {
  class CandidateImage {
    set src(value) {
      this.source = value;
      const bytes = Buffer.from(value.split(',')[1], 'base64');
      this.width = this.naturalWidth = bytes.readUInt32BE(16);
      this.height = this.naturalHeight = bytes.readUInt32BE(20);
      queueMicrotask(() => this.onload?.());
    }
    async decode() {}
    removeAttribute() {}
  }
  const page = await soloPage(t, {
    search: '?journey=whole-spatial-v5',
    storage: memoryStorage({
      [JOURNEY_PREFERENCES_KEY]: JSON.stringify({
        format: 'JourneyPreferencesV1',
        difficulty: 'expert',
      }),
    }),
    pictures: { Image: CandidateImage },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(readFileSync(path))
        : undefined,
  });
  page.frame(0);
  assert.equal(recoverGameplayTuning(page.rendered.run.level).version, 'gameplay-pressure.v3');
  assert.match(page.$('difficulty-note').textContent, /2 mission lives/);
  assert.match(page.$('overlay-difficulty').textContent, /2 starting lives; no failing countdown/);
  for (const id of [
    'menu-difficulty-note',
    'difficulty-note',
    'overlay-difficulty',
    'gameplay-tuning',
  ])
    assert.doesNotMatch(page.$(id).textContent, /40%|75%|faster than base/);
  page.change('menu-difficulty', 'standard');
  page.frame(0);
  assert.match(page.$('difficulty-note').textContent, /3 mission lives/);
  assert.doesNotMatch(page.$('difficulty-note').textContent, /40%|75%|faster than base/);
});
