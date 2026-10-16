import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun } from '../core/index.mjs';
import { canonicalJSON } from '../data-json.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  matchRecordedGameplayTuning,
} from '../gameplay-tuning.mjs';
import { restoreSession, suspendSession } from '../sessions.mjs';
import { createRecorder, verifyReplay, authoritativeCheckpoint } from '../replay.mjs';
import { matchReplayInstalledRules } from '../replay-installed-rules.mjs';
import { createSoloPerformanceBinding } from '../journey/performance-binding.mjs';
import { restoreCompanySession, companySimulationIdentity } from '../company-session.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { createLearningAttempt, reduceLearningAttempt } from '../company-campaigns/learning.mjs';
import { campaignKey, loadLibrary } from '../library.mjs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/firefox146-gp4-session.json', import.meta.url)),
);
const source = fixture.campaign.levels[0];
function nativeFirefox(t) {
  const native = Math.hypot;
  t.mock.method(Math, 'hypot', (...values) =>
    values.length === 2 && values.every((value) => Math.abs(value) === 1.6970562748477138)
      ? 2.3999999999999995
      : native(...values),
  );
}
const state = () => verifyReplay(fixture.saved.replay).state;

test('exact pre-fix Firefox gp4 replay restores and re-suspends without replacing its recorded rules', async (t) => {
  nativeFirefox(t);
  const before = canonicalJSON(fixture),
    recorded = fixture.saved.replay.level;
  assert.equal(recorded.enemies[0].vx, -5.860147449083514);
  assert.equal(
    applyGameplayTuning(source, resolveGameplayTuning('gentle')).enemies[0].vx,
    -5.860147449083513,
  );
  assert.deepEqual(matchRecordedGameplayTuning(source, recorded), recorded);
  assert.equal(verifyReplay(fixture.saved.replay).match, true);
  const restored = await restoreSession(fixture.saved, {
    campaign: fixture.campaign,
    campaignKey: fixture.campaignKey,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), fixture.saved.replay.checkpoint);
  const again = suspendSession({
    run: restored.run,
    recorder: restored.recorder,
    campaignKey: fixture.campaignKey,
    themeId: fixture.saved.themeId,
    bodyId: fixture.saved.bodyId,
    runId: fixture.saved.runId,
    presentationLevel: source,
  });
  assert.deepEqual(again.replay, fixture.saved.replay);
  assert.equal(canonicalJSON(fixture), before);
});

test('historical matching rejects modified velocity, geometry, recipe revision, source and class roster', (t) => {
  nativeFirefox(t);
  const recorded = fixture.saved.replay.level;
  for (const change of [
    (level) => {
      level.enemies[0].vx += 1e-8;
    },
    (level) => {
      level.goal.coverage = 0.79;
    },
    (level) => {
      level.revision = level.revision.slice(0, -1) + '0';
    },
    (level) => {
      level.spawn.x += 1;
    },
  ]) {
    const altered = structuredClone(recorded);
    change(altered);
    assert.equal(matchRecordedGameplayTuning(source, altered), null);
    assert.throws(
      () =>
        matchReplayInstalledRules({
          campaign: fixture.campaign,
          replay: fixture.saved.replay,
          state: createRun(altered, fixture.saved.replay.options),
        }),
      /Saved rules differ/,
    );
  }
  assert.equal(
    matchRecordedGameplayTuning({ ...source, revision: 'another-source' }, recorded),
    null,
  );
  const classes = structuredClone(fixture.campaign.classRecipes);
  classes[0].cooldown += 1;
  assert.throws(
    () =>
      matchReplayInstalledRules({
        campaign: { ...fixture.campaign, classRecipes: classes },
        replay: fixture.saved.replay,
        state: state(),
      }),
    /Saved rules differ/,
  );
});

test('performance source admission preserves the recorded gameplay while rejecting admins and foreign classes', async (t) => {
  nativeFirefox(t);
  const mission = { id: 'legacy-mission', levelId: source.id },
    entry = { campaign: fixture.campaign, classRecipes: fixture.campaign.classRecipes },
    host = {
      catalog: { find: (id) => (id === mission.id ? mission : null) },
      select: () => entry,
      owns: (item) => item === entry,
    },
    admit = createSoloPerformanceBinding({ host }),
    record = { missionId: mission.id, difficulty: 'gentle' },
    verified = state();
  assert.equal(await admit(record, verified), true);
  assert.equal(await admit({ ...record, difficulty: 'expert' }, verified), false);
  const altered = structuredClone(verified);
  altered.classRecipes[0].cooldown += 1;
  assert.equal(await admit(record, altered), false);
  const admin = createRun(
    applyGameplayTuning(source, resolveGameplayTuning('gentle', { enemySpeed: 1.25 })),
  );
  assert.equal(await admit(record, admin), false);
});

test('prepared company restoration retains old learning simulation identity and cannot add tuning to an untuned mission', async (t) => {
  nativeFirefox(t);
  const options = fixture.saved.replay.options,
    canonical = applyGameplayTuning(source, resolveGameplayTuning('gentle')),
    lesson = { ...COMPANY_LESSONS[0], missionId: source.id },
    learning = reduceLearningAttempt(
      lesson,
      createLearningAttempt(lesson, {
        simulationIdentity: companySimulationIdentity(state()),
        seed: options.seed,
      }),
      {
        type: 'configure',
        fieldId: lesson.fields[0].id,
        value: lesson.fields[0].options[0].value,
        anchor: { kind: 'checkpoint', tick: 0 },
      },
    ),
    saved = {
      format: 'revealline-company-session.v1',
      editionId: 'legacy-company',
      presentationIdentity: 'ab'.repeat(32),
      missionId: source.id,
      difficulty: 'gentle',
      runId: fixture.saved.runId,
      replay: fixture.saved.replay,
      learning,
    };
  const prepare = async () => ({
    manifest: { level: source },
    run: createRun(canonical, options),
    recorder: createRecorder(canonical, options),
  });
  const config = {
    editionId: saved.editionId,
    presentationIdentity: saved.presentationIdentity,
    prepare,
    lessonFor: () => lesson,
  };
  const restored = await restoreCompanySession(saved, config);
  assert.deepEqual(restored.saved.learning, learning);
  assert.deepEqual(authoritativeCheckpoint(restored.run), fixture.saved.replay.checkpoint);
  assert.notEqual(
    companySimulationIdentity(restored.run),
    companySimulationIdentity((await prepare()).run),
  );
  await assert.rejects(
    restoreCompanySession(
      {
        ...saved,
        learning: createLearningAttempt(lesson, {
          simulationIdentity: companySimulationIdentity((await prepare()).run),
          seed: options.seed,
        }),
      },
      config,
    ),
    /different simulation or seed/,
  );
  await assert.rejects(
    restoreCompanySession(saved, {
      ...config,
      prepare: async () => ({
        manifest: { level: source },
        run: createRun(source, options),
        recorder: createRecorder(source, options),
      }),
    }),
    /saved simulation differs/,
  );
});

test(
  'actual Solo Continue restores an old native gp4 flight and earns its authored Collection picture',
  { timeout: 30000 },
  async (t) => {
    nativeFirefox(t);
    const f = JSON.parse(
        await readFile(
          new URL('./fixtures/firefox146-gp4-completion-session.json', import.meta.url),
        ),
      ),
      storage = memoryStorage(),
      campaign = f.campaign;
    assert.equal(campaignKey(campaign), f.campaignKey);
    storage.setItem('revealline.suspended.dev.v1', JSON.stringify(f.saved));
    const page = await soloPage(t, { campaign, storage });
    assert.equal(page.$('continue-saved').disabled, false);
    page.$('continue-saved').click();
    await settle(() => {
      page.frame(0);
      return (
        page.rendered.run.level.revision === f.saved.replay.level.revision &&
        page.rendered.run.tick === f.saved.replay.ticks
      );
    });
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), f.saved.replay.checkpoint);
    assert.equal(page.rendered.run.level.enemies[0].vx, -5.860147449083514);
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let tick = 0; tick < 900 && page.rendered.run.status !== 'won'; tick++) page.frame();
    assert.equal(page.rendered.run.status, 'won');
    if (!page.$('skip-celebration').hidden) page.$('skip-celebration').click();
    page.frame(0);
    const library = loadLibrary(storage, 'revealline.library.dev.v1', {
      campaigns: [campaign],
    }).library;
    assert.deepEqual(Object.keys(library.campaigns[f.campaignKey]?.clears ?? {}), [
      f.campaign.levels[0].id,
    ]);
    assert.equal(library.gallery.length, 1);
    assert.equal(library.gallery[0].levelRevision, f.campaign.levels[0].revision);
    assert.deepEqual(library.masteries, []);
    assert.equal(page.$('save-warning').textContent, '');
    assert.equal(storage.getItem('revealline.suspended.dev.v1'), null);
    assert.equal(
      page.rendered.run.level.enemies[0].vx,
      -5.860147449083514,
      'The old simulation was never relabelled or rewritten.',
    );
    assert.deepEqual(page.errors, []);
  },
);
