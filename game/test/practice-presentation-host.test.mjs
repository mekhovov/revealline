import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { prepareScenario } from '../imports.mjs';
import { FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const theme = (await readJSON('../content-design/themes.json')).themes.find(
  (candidate) => candidate.id === 'horizon',
);
const route = (await readJSON('./fixtures/combat-candidate-routes.json')).routes.find(
  (candidate) =>
    candidate.id === 'workshop-sweep' &&
    candidate.difficulty === 'gentle' &&
    candidate.turnPolicy === 'immediate' &&
    candidate.seed === 1,
);
const project = createCombatCandidates();
project.missions.find((mission) => mission.id === route.id).presentation.themeId = theme.id;
const sourceBefore = JSON.stringify(project);
const preview = prepareContentPreview(project, route.id, { difficulty: route.difficulty, theme });
const scenario = (await prepareScenario(preview.scenario)).scenario;
const scenarioJSON = JSON.stringify(scenario);
const previewKey = 'revealline.playground.current';

function playRoute(page, showCombatScrap) {
  const key = (direction) => `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`;
  for (const { direction, ticks } of route.segments) {
    if (direction) page.key(key(direction));
    for (let tick = 0; tick < ticks; tick += 6) {
      page.frame(Math.min(6, ticks - tick) * FIXED_DT * 1000);
      assert.equal(page.rendered.showCombatScrap, showCombatScrap);
    }
    if (direction) page.key(key(direction), false);
  }
}

async function replayFromHost(t, page) {
  // Retain the real download boundary without keeping Node alive for URL cleanup.
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === 60000) timer.unref();
    return timer;
  });
  await page.$('export-replay').onclick();
  const replay = JSON.parse(page.$('replay-json').value);
  assert.equal(verifyReplay(replay).match, true);
  page.$('replay-dialog').close();
  return replay;
}

test('practice remains affect only painter options through a real combat route and Retry', async (t) => {
  const results = new Map();
  // soloPage owns globals; await each child so teardown retires the prior host.
  for (const [choice, showCombatScrap] of [
    ['hide', false],
    ['show', true],
  ]) {
    await t.test(choice, async (t) => {
      const storage = memoryStorage({ 'practice-presentation-control': 'unchanged' });
      const previewStorage = memoryStorage({ [previewKey]: scenarioJSON });
      const page = await soloPage(t, {
        storage,
        previewStorage,
        search: `?practice=1&preview-remains=${choice}`,
      });
      const playerBefore = [...storage.map];
      const playerWrites = storage.writes.length;
      const previewWrites = previewStorage.writes.length;
      const ready = authoritativeCheckpoint(page.rendered.run);
      assert.equal(page.rendered.run.levelId, route.id);
      assert.equal(page.rendered.run.level.classic.combatPatrols.enabled, true);
      assert.equal(page.rendered.showCombatScrap, showCombatScrap);
      page.$('start-button').click();
      playRoute(page, showCombatScrap);
      const completed = page.rendered.run;
      assert.equal(completed.status, 'won');
      assert.equal(completed.tick, route.ticks);
      assert.equal(completed.classic.livesLost, 0);
      assert.equal(
        completed.classic.combatPatrols.actors.filter((actor) => !actor.alive).length,
        2,
        'the actual route removes both optional scouts',
      );
      const checkpoint = authoritativeCheckpoint(completed);
      const replay = await replayFromHost(t, page);
      results.set(choice, { ready, checkpoint, replay });

      const retry = page.$('retry-button');
      assert.equal(retry.hidden, false);
      retry.emit('pointerdown', { button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 1 });
      retry.focus();
      retry.emit('pointerup', { button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 1 });
      retry.click();
      page.frame(0);
      assert.notEqual(page.rendered.run, completed);
      assert.equal(page.rendered.run.tick, 0);
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ready);
      assert.equal(page.rendered.showCombatScrap, showCombatScrap);
      assert.deepEqual(authoritativeCheckpoint(completed), checkpoint);
      assert.deepEqual([...storage.map], playerBefore);
      assert.equal(storage.writes.length, playerWrites);
      assert.equal(previewStorage.getItem(previewKey), scenarioJSON);
      assert.equal(previewStorage.writes.length, previewWrites);
      assert.equal(JSON.stringify(project), sourceBefore);
      assert.equal(JSON.stringify(scenario), scenarioJSON);
      assert.deepEqual(page.errors, []);
    });
  }
  assert.deepEqual(results.get('hide'), results.get('show'));
});

test('ordinary game ignores preview-remains even when a practice scenario remains in tab storage', async (t) => {
  const previewStorage = memoryStorage({ [previewKey]: scenarioJSON });
  const page = await soloPage(t, {
    previewStorage,
    search: '?journey=legacy&preview-remains=hide',
  });
  assert.notEqual(page.rendered.run.levelId, route.id);
  assert.equal(page.rendered.showCombatScrap, true);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  for (let tick = 0; tick < 12; tick++) page.frame(FIXED_DT * 1000);
  page.key('ArrowDown', false);
  assert.ok(page.rendered.run.tick > 0);
  assert.equal(page.rendered.showCombatScrap, true);
  assert.equal(previewStorage.getItem(previewKey), scenarioJSON);
  assert.deepEqual(page.errors, []);
});
