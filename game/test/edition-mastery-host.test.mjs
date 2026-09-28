import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createRewardBackend } from '../rewards/store.mjs';

test(
  'the actual Solo app accepts the normal winning run before asynchronously granting its configured no-loss discovery',
  { timeout: 30000 },
  async (t) => {
    const f = await editionProviderFixture(),
      catalog = structuredClone(f.catalog),
      campaign = catalog.campaigns[0],
      missionId = f.source.missions[0].id;
    f.source.maps[0].foundations = [];
    f.source.missions[0].coverage = 0.4;
    const project = compileContentProject(f.source),
      manifest = resolveMission(project, missionId, { difficulty: 'standard' });
    f.data.campaign.levels = [manifest.level];
    campaign.rewardPath = 'game/content/sample/mastery-rewards.json';
    f.files.set('game/editions/catalog.json', catalog);
    f.files.set('edition-catalog.json', catalog);
    const reward = createStudioReward({
      campaign,
      source: f.source,
      rule: 'mission-win',
      missionId,
      masteryMissionIds: [missionId],
      id: 'sample-no-loss',
      locales: {
        en: {
          title: 'A careful route',
          teaser: 'Win this mission without a lost life.',
          paragraph: 'An optional local arcade achievement.',
        },
        uk: {
          title: 'Уважний маршрут',
          teaser: 'Переможіть без втрати життя.',
          paragraph: 'Додаткове локальне ігрове досягнення.',
        },
      },
    });
    f.files.set(campaign.rewardPath, [reward]);
    const storage = memoryStorage(),
      disk = managedIndexedDB(),
      page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage,
        journeyIndexedDB: disk.indexedDB,
        fetchResponse: f.fetcher,
      });
    page.$('shell-featured').click();
    await settle(() => {
      page.frame(0);
      return page.doc.body.dataset.flightState === 'running';
    });
    const expected = createRun(
      applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
      { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
    );
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(expected));
    page.key('ArrowDown');
    let ticks = 0;
    while (expected.status === 'running' && ticks++ < 1200) {
      stepRun(expected, { direction: 'down' }, FIXED_DT);
      page.frame(FIXED_DT * 1000);
    }
    page.key('ArrowDown', false);
    page.frame(0);
    assert.equal(expected.status, 'won');
    assert.equal(expected.classic.livesLost, 0);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(expected));
    assert.equal(page.$('retry-button').disabled, false);
    const proofKey = 'revealline.journey-mastery-proofs.sample-public.v1';
    await waitFor(() => {
      page.frame(0);
      return storage.getItem(proofKey);
    });
    const proof = JSON.parse(storage.getItem(proofKey)).proofs[0];
    const backend = createRewardBackend({ editionId: 'sample-public', indexedDB: disk.indexedDB });
    let state;
    for (let attempt = 0; attempt < 100; attempt++) {
      page.frame(0);
      state = await backend.read();
      if (state.receipts.length === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(state.receipts.length, 1);
    assert.deepEqual(state.receipts[0].evidence.mastery, [
      { id: 'journey-no-loss-win', revision: '1', missionId, runId: proof.clear.runId },
    ]);
    assert.equal(state.receipts[0].evidence.clears[missionId].runId, proof.clear.runId);
    assert.deepEqual(page.errors, []);
  },
);
