import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const PHYSICS_TICKS_PER_FRAME = 4;
const MOVEMENT_TICK_BUDGET = 1800;

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
  const reference = structuredClone(page.rendered.run);
  const initialTick = reference.tick;
  // Draw at 30 Hz while the real host still steps its 120 Hz simulation. Keep
  // budgets in physics ticks: grouping renders must not extend the legal route.
  for (let remaining = idle; remaining > 0; ) {
    const ticks = Math.min(PHYSICS_TICKS_PER_FRAME, remaining);
    page.frame(ticks * FIXED_DT * 1000);
    remaining -= ticks;
  }
  assert.equal(page.rendered.run.tick - initialTick, idle);
  page.key('ArrowDown');
  for (
    let remaining = MOVEMENT_TICK_BUDGET;
    remaining > 0 && page.rendered.run.status === 'running';

  ) {
    const ticks = Math.min(PHYSICS_TICKS_PER_FRAME, remaining);
    page.frame(ticks * FIXED_DT * 1000);
    remaining -= ticks;
  }
  page.key('ArrowDown', false);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
  assert(page.rendered.run.tick - initialTick <= idle + MOVEMENT_TICK_BUDGET);

  // Independently step the same starting state and inputs one physics tick at a
  // time. The grouped host must reach the identical authoritative checkpoint;
  // the existing durable-result assertions also require accepted replay proof.
  for (let tick = 0; tick < idle; tick++) stepRun(reference, {}, FIXED_DT);
  for (let tick = 0; tick < MOVEMENT_TICK_BUDGET && reference.status === 'running'; tick++)
    stepRun(reference, { direction: 'down' }, FIXED_DT);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(reference));
  assert.equal(page.$('game-overlay').hidden, false, 'The won menu is usable during celebration.');
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.equal(page.$('retry-button').hidden, false);
  assert.equal(page.$('retry-button').disabled, false);
  assert.equal(page.$('show-result').hidden, true, 'Results need no preliminary picture click.');
}

test(
  'real Solo Journey result compares its second verified win and keeps Retry immediately available',
  // Keep the 60s bound: CI's per-tick rendering took 62.1s for these two wins.
  // Sixty idle physics ticks still prove a measurable faster retry, with real
  // host inputs, IndexedDB and replay verification rather than injected wins.
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
