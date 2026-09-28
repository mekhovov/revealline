import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { rewardContext } from '../rewards/context.mjs';
import { projectRewardProgress } from '../rewards/model.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { mountEditionMastery } from '../ui/edition-mastery.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const campaignId = 'coupa-spend-in-motion',
  missionId = campaignId + '-01';
const source = createCompanyProject({ brandId: 'coupa', campaignId });
const bindings = createRewardMissionBindings(source),
  mission = bindings.find((item) => item.missionId === missionId);
const reward = createStudioReward({
  campaign: { id: campaignId, brandId: 'coupa' },
  source,
  rule: 'mission-win',
  missionId,
  masteryMissionIds: [missionId],
  id: 'optional-clean-reveal',
  locales: {
    en: { title: 'Optional route', teaser: 'No life lost', paragraph: 'Local optional goal.' },
    uk: {
      title: 'Додатковий маршрут',
      teaser: 'Без втрати життя',
      paragraph: 'Локальна додаткова ціль.',
    },
  },
});
const provider = {
  editionId: 'coupa-adventure',
  route: { source },
  rewards: [reward],
  lessons: [],
  selection: { brand: { id: 'coupa' }, edition: { campaignIds: [campaignId] } },
};
const row = JSON.parse(
  readFileSync(new URL('fixtures/company-campaign-routes.json', import.meta.url)),
).rows.find(
  (row) => row.id === missionId && row.difficulty === 'standard' && row.turnPolicy === 'immediate',
);
function winningRun() {
  const manifest = resolveMission(compileContentProject(source), missionId, {
    difficulty: row.difficulty,
  });
  const level = applyGameplayTuning(manifest.level, row.gameplayTuning),
    options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const segment of row.segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      const input = { direction: segment.direction };
      stepRun(run, input, FIXED_DT);
      recordInput(recorder, input);
    }
  assert.equal(run.status, 'won');
  return { run, recorder };
}
async function mount(
  t,
  {
    writer = { writable: true },
    durable = true,
    runId = 'accepted-win',
    acceptedRunId = runId,
    storage = memoryStorage(),
  } = {},
) {
  const { run, recorder } = winningRun(),
    doc = new Document(),
    reports = [];
  for (const id of ['overlay-reading', 'settings-panel-data', 'next-level', 'retry']) {
    const node = doc.createElement(id.includes('level') || id === 'retry' ? 'button' : 'section');
    node.id = id;
    doc.body.append(node);
  }
  const clear = {
    ...mission.bindings.find((item) => item.difficulty === 'standard'),
    runId: acceptedRunId,
  };
  const profile = { generation: 1, clears: { solo: { [mission.journeyMissionIds[0]]: clear } } };
  let active = run,
    currentId = runId;
  const ui = await mountEditionMastery({
    provider,
    document: doc,
    window: { localStorage: storage, setTimeout, URL },
    writer,
    getRun: () => active,
    getRunId: () => currentId,
    getRecorder: () => recorder,
    getJourneyProfile: () => profile,
    getJourneyRevision: () => profile.generation,
    getJourneyDurable: () => durable,
    report: (message) => reports.push(message),
  });
  t.after(() => ui.dispose());
  return {
    ui,
    doc,
    run,
    recorder,
    profile,
    storage,
    reports,
    setActive(value, id) {
      active = value;
      currentId = id;
    },
    clear,
  };
}

test('only the host’s exact accepted winning run grants mastery and keeps Next/Retry immediately usable', async (t) => {
  const h = await mount(t),
    checkpoint = authoritativeCheckpoint(h.run);
  h.ui.refresh();
  assert.equal(h.doc.getElementById('next-level').disabled, false);
  assert.equal(h.doc.getElementById('retry').disabled, false);
  h.setActive(null, 'later-run');
  await waitFor(() => h.ui.rewardEvidence().durableMastery.length === 1);
  assert.deepEqual(authoritativeCheckpoint(h.run), checkpoint);
  const evidence = h.ui.rewardEvidence();
  assert.equal(
    projectRewardProgress(
      reward,
      rewardContext(provider, bindings, h.profile, [], evidence.mastery),
    ).eligible,
    true,
  );
  h.ui.refresh();
  assert.equal(
    evidence,
    h.ui.rewardEvidence(),
    'No repeated replay verification or new evidence on an unchanged refresh.',
  );
  assert.equal(h.storage.writes.filter(([key]) => key.endsWith('.v1')).length, 1);
  const practice = await mount(t, { runId: 'practice', acceptedRunId: 'earlier-win' });
  practice.ui.refresh();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(practice.ui.rewardEvidence().mastery, []);
  assert.deepEqual(practice.storage.writes, []);
});

test('writer loss and unsaved Journey clears leave only session evidence; unrelated durable contexts cannot borrow it', async (t) => {
  for (const options of [{ writer: { writable: false } }, { durable: false }]) {
    const h = await mount(t, options);
    h.ui.refresh();
    await waitFor(() => h.ui.rewardEvidence().mastery.length === 1);
    const evidence = h.ui.rewardEvidence();
    assert.deepEqual(evidence.durableMastery, []);
    assert.deepEqual(h.storage.writes, []);
    assert.equal(
      projectRewardProgress(
        reward,
        rewardContext(provider, bindings, h.profile, [], evidence.mastery),
      ).eligible,
      true,
    );
    assert.equal(
      projectRewardProgress(
        reward,
        rewardContext(provider, bindings, h.profile, [], evidence.durableMastery),
      ).eligible,
      false,
    );
    const changed = structuredClone(h.profile);
    changed.clears.solo[mission.journeyMissionIds[0]].runId = 'another-run';
    assert.equal(
      projectRewardProgress(
        reward,
        rewardContext(provider, bindings, changed, [], evidence.mastery),
      ).eligible,
      false,
    );
  }
});

test('disposing pending verification prevents writes and repeated mounts release every owned surface', async (t) => {
  const h = await mount(t);
  h.ui.refresh();
  h.ui.dispose();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(h.storage.writes, []);
  assert.equal(h.doc.getElementById('edition-mastery-notice'), null);
  assert.equal(h.doc.getElementById('edition-mastery-status'), null);
  for (let index = 0; index < 20; index++) {
    const view = await mountEditionMastery({
      provider,
      document: h.doc,
      window: { localStorage: h.storage, setTimeout, URL },
      writer: { writable: true },
      getRun: () => null,
      getRunId: () => null,
      getRecorder: () => null,
      getJourneyProfile: () => h.profile,
      getJourneyRevision: () => 1,
      getJourneyDurable: () => true,
    });
    view.dispose();
    assert.equal(h.doc.getElementById('edition-mastery-notice'), null);
    assert.equal(h.doc.getElementById('settings-panel-data').children.length, 0);
  }
});
