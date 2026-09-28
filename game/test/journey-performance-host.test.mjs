import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { FIXED_DT } from '../core/index.mjs';

async function fixture(t) {
  const f = await editionProviderFixture(),
    descriptor = f.catalog.campaigns[0];
  f.source.maps[0].foundations = [];
  f.source.missions[0].coverage = 0.4;
  f.source.missions[0].actors[0].heading = [0, 1];
  f.files.set(descriptor.sourcePath, f.source);
  const manifest = resolveMission(compileContentProject(f.source), f.source.missions[0].id, {
    difficulty: 'standard',
  });
  f.data.campaign.levels = [manifest.level];
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    storage: memoryStorage(),
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: f.fetcher,
  });
  page.$('shell-featured').click();
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  return page;
}
function win(page, idle = 0) {
  for (let index = 0; index < idle; index++) page.frame(FIXED_DT * 1000);
  page.key('ArrowDown');
  for (let i = 0; i < 1800 && page.rendered.run.status === 'running'; i++)
    page.frame(FIXED_DT * 1000);
  page.key('ArrowDown', false);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
}

test(
  'real Solo Journey result compares its second verified win and keeps Retry immediately available',
  // This drives real frames, IndexedDB and replay verification. The earlier
  // 360-idle-frame fixture took 27.4s alone and 32.6s in the full parallel suite.
  // Sixty frames still prove a measurable faster retry without sixfold idle UI
  // work; retain a bounded 60s host ceiling for concurrent qualification jobs.
  { timeout: 60000 },
  async (t) => {
    const page = await fixture(t);
    win(page, 60);
    assert.equal(page.$('retry-button').hidden, false);
    assert.equal(page.$('next-button').hidden, false);
    await settle(() => page.$('journey-best').dataset.state === 'first');
    assert.equal(page.$('journey-best').dataset.durable, 'true');
    const firstTime = page.rendered.run.time;
    page.$('retry-button').click();
    await settle(() => {
      page.frame(0);
      return page.rendered.run.status === 'running';
    });
    assert.equal(page.$('journey-best').hidden, true);
    assert.equal(page.rendered.run.status, 'running');
    win(page);
    assert(page.rendered.run.time < firstTime);
    await settle(() => page.$('journey-best').dataset.state === 'comparison');
    assert.equal(page.$('journey-best').hidden, false);
    assert.equal(page.$('journey-best').dataset.durable, 'true');
    assert.equal(page.$('next-button').disabled, false);
    assert.deepEqual(page.errors, []);
  },
);

test(
  'leaving a won result immediately never paints its delayed optional comparison onto the next attempt',
  { timeout: 60000 },
  async (t) => {
    const page = await fixture(t);
    win(page);
    page.$('retry-button').click();
    await settle(() => {
      page.frame(0);
      return page.rendered.run.status === 'running';
    });
    assert.equal(page.rendered.run.status, 'running');
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(page.$('journey-best').hidden, true);
    assert.equal(page.$('journey-best').dataset.state, 'hidden');
    assert.deepEqual(page.errors, []);
  },
);
