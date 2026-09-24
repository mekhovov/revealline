import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  preparePack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  importPackLibrary,
  resolvePackCampaign,
} from '../packs.mjs';
import { createRun, stepRun, getSummary } from '../core/index.mjs';

test('downloadable creator example survives installation and its documented down route wins both maps', async () => {
  const source = await readFile(
    new URL('../../authoring/community/examples/two-crossings.expansion.json', import.meta.url),
    'utf8',
  );
  const { pack } = await preparePack(source);
  const installed = installPack(emptyPackLibrary(), pack);
  const restored = await importPackLibrary(exportPackLibrary(installed));
  assert.deepEqual(restored, installed);
  const { campaign } = resolvePackCampaign(restored.packs[0], pack.campaigns[0].id);
  assert.equal(campaign.levels.length, 2);
  for (const level of campaign.levels) {
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const run = createRun(level, {
        classRecipes: campaign.classRecipes,
        seed: 1,
        turnPolicy,
      });
      for (let tick = 0; tick < 2400 && run.status !== 'won' && run.status !== 'lost'; tick++) {
        stepRun(run, { direction: 'down' });
      }
      assert.equal(getSummary(run).won, true, `${level.id}: ${turnPolicy}`);
      assert.equal(run.lives, 3);
    }
  }
});
