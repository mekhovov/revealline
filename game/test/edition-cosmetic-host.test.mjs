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
import { createRewardCosmeticRegistry } from '../rewards/cosmetics.mjs';
import { createRewardBackend } from '../rewards/store.mjs';

test(
  'an accepted shared Solo win unlocks only its optional body in the native picker without changing core checkpoints',
  // The actual player now holds its earned picture before exposing results.
  // This integration fixture builds an edition, decodes its reward artwork,
  // and runs a complete route, so leave room for a contended CI worker.
  { timeout: 60000 },
  async (t) => {
    const f = await editionProviderFixture(),
      catalog = structuredClone(f.catalog),
      campaign = catalog.campaigns[0],
      missionId = f.source.missions[0].id;
    f.source.maps[0].foundations = [];
    f.source.missions[0].coverage = 0.4;
    const manifest = resolveMission(compileContentProject(f.source), missionId, {
      difficulty: 'standard',
    });
    f.data.campaign.levels = [manifest.level];
    campaign.rewardPath = 'game/content/sample/cosmetic-rewards.json';
    const body = structuredClone(f.data.presets.characters[f.data.themes.themes[0].player]);
    body.label = 'Optional glider';
    body.bodyMotion = { kind: 'rigid-spin', radiansPerSecond: 2, travelGain: 0 };
    f.data.presets.characters['optional-glider'] = body;
    f.data.presets.rewardCharacters = ['optional-glider'];
    const recipe = createRewardCosmeticRegistry({
      presets: f.data.presets,
      themes: f.data.themes.themes,
      assets: [],
    })[0];
    const reward = structuredClone(
      createStudioReward({
        campaign,
        source: f.source,
        rule: 'mission-win',
        missionId,
        id: 'sample-glider',
        locales: {
          en: {
            title: 'Glider',
            teaser: 'A new appearance.',
            paragraph: 'An optional fictional appearance.',
          },
          uk: {
            title: 'Планер',
            teaser: 'Нове оформлення.',
            paragraph: 'Додаткове вигадане оформлення.',
          },
        },
      }),
    );
    reward.payloads.push({
      id: 'body',
      type: 'cosmetic',
      recipeId: recipe.recipeId,
      recipeRevision: recipe.recipeRevision,
      locales: { en: { title: 'Glider' }, uk: { title: 'Планер' } },
    });
    f.files.set('game/editions/catalog.json', catalog);
    f.files.set('edition-catalog.json', catalog);
    f.files.set(campaign.rewardPath, [reward]);
    const disk = managedIndexedDB(),
      page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage: memoryStorage(),
        journeyIndexedDB: disk.indexedDB,
        fetchResponse: f.fetcher,
      });
    const option = () =>
      [...page.$('body-select').children].find((entry) => entry.value === 'optional-glider');
    assert.equal(option().disabled, true);
    assert.notEqual(page.$('body-select').value, 'optional-glider');
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
    // Render at 60 Hz while preserving every fixed simulation step and the final partial frame.
    while (expected.status === 'running' && ticks < 1200) {
      let frameTicks = 0;
      while (frameTicks < 2 && expected.status === 'running' && ticks < 1200) {
        stepRun(expected, { direction: 'down' }, FIXED_DT);
        ticks++;
        frameTicks++;
      }
      page.frame(FIXED_DT * 1000 * frameTicks);
    }
    assert.equal(ticks, 469, 'The fixture still executes its complete original winning route.');
    page.key('ArrowDown', false);
    page.frame(0);
    assert.equal(expected.status, 'won');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(expected));
    assert.equal(page.$('game-overlay').hidden, true);
    page.$('skip-celebration').onclick();
    assert.equal(page.$('show-result').hidden, false);
    await waitFor(() => {
      page.frame(0);
      return option().disabled === false;
    });
    assert.notEqual(
      page.$('body-select').value,
      'optional-glider',
      'Winning does not replace the chosen character.',
    );
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    page.$('body-select').value = 'optional-glider';
    page.$('body-select').onchange();
    page.frame(0);
    assert.equal(page.$('body-select').value, 'optional-glider');
    assert.equal(page.$('match-class-appearance').checked, false);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    const backend = createRewardBackend({ editionId: 'sample-public', indexedDB: disk.indexedDB });
    t.after(() => backend.close());
    let state;
    for (let n = 0; n < 100; n++) {
      page.frame(0);
      state = await backend.read();
      if (state.receipts.length) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(
      state.receipts[0].definition.payloads.at(-1).recipeRevision,
      recipe.recipeRevision,
    );
    assert.equal(page.$('retry-button').disabled, false);
    assert.deepEqual(page.errors, []);
  },
);
