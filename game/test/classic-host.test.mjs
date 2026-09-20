import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';

const pack = JSON.parse(
  readFileSync(new URL('../content/packs/classic-lab.json', import.meta.url)),
);
const frames = (page, count) => {
  for (let i = 0; i < count; i++) page.frame();
};
async function setup(t, index, { stopOnCapture, journey = false, level } = {}) {
  const page = await soloPage(t, {
      search: journey ? '?journey=1' : '',
      titleScreen: journey,
      journeyIndexedDB: managedIndexedDB().indexedDB,
    }),
    candidate = structuredClone(pack);
  candidate.campaigns[0].levels = [level ?? candidate.campaigns[0].levels[index]];
  if (stopOnCapture !== undefined)
    candidate.campaigns[0].levels[0].rules.stopOnCapture = stopOnCapture;
  page.$('library-button').click();
  page.doc.querySelector('[data-library-panel="packs"]').click();
  assert.equal(page.$('library-packs').hidden, false);
  page.$('pack-json').value = JSON.stringify(candidate);
  page.$('install-pack').click();
  await settle(() => !page.$('install-pack').disabled, 'classic practice pack installed');
  assert.match(page.$('pack-status').textContent, /Validated and installed/);
  const play = page
    .$('installed-packs')
    .querySelectorAll('button')
    .find((button) => button.textContent === `Play ${candidate.campaigns[0].title}`);
  assert.ok(play);
  await play.onclick();
  await settle(
    () =>
      page.$('pack-select').value === candidate.id &&
      page.doc.body.dataset.pictureState === 'ready',
    'The visible installed campaign must finish selection and picture preparation.',
  );
  page.frame(0);
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v5');
  return page;
}

test('Journey capture stop preserves occupied-region teaching and fresh-direction guidance', async (t) => {
  const level = {
    ...structuredClone(pack.campaigns[0].levels[0]),
    spawn: { x: 35.5, y: 0.5 },
    goal: { coverage: 0.6 },
    classic: {
      version: 'classic.v1',
      terrain: [
        { id: 'slow-crossing', kind: 'slow', x: 35, y: 10, w: 1, h: 2 },
        { id: 'occupied-lethal', kind: 'lethal', x: 10, y: 10, w: 2, h: 2 },
      ],
      powerups: [],
    },
    enemies: [
      { id: 'west', type: 'bouncer', x: 15.5, y: 23.5, vx: -1.7, vy: 1.7 },
      { id: 'east', type: 'bouncer', x: 58.5, y: 12.5, vx: 1.7, vy: 1.7 },
    ],
  };
  const page = await setup(t, 0, { stopOnCapture: true, journey: true, level });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let frame = 0; frame < 900 && page.rendered.run.claimedCount === 0; frame++) page.frame();
  assert.equal(page.rendered.run.status, 'running');
  assert.equal(page.rendered.run.player.speed, 0);
  assert(
    page.rendered.run.claimedCount > 0,
    JSON.stringify({
      level: page.rendered.run.levelId,
      player: page.rendered.run.player,
      tick: page.rendered.run.tick,
      message: page.$('run-message').textContent,
      lives: page.rendered.run.lives,
    }),
  );
  assert.match(page.$('run-message').textContent, /2 occupied regions remain/);
  assert.match(page.$('run-message').textContent, /west.*east|east.*west/);
  assert.match(
    page.$('run-message').textContent,
    /Empty regions fill; field enemies retain their regions/,
  );
  assert.match(page.$('run-message').textContent, /Tap a direction to fly again/);
  assert.match(page.$('run-message').textContent, /2 slow-field cells neutralized/);
  assert.doesNotMatch(page.$('run-message').textContent, /lethal-field cells neutralized/);
  page.frame(0);
  assert.match(page.$('run-message').textContent, /2 occupied regions remain/);
  assert.deepEqual(page.errors, []);
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: capture stops the actual host before another substep and saved Resume stays stopped`, async (t) => {
    const page = await setup(t, 0, { stopOnCapture: true });
    page.change('turn-select', turnPolicy);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    page.key('ArrowDown');
    for (let n = 0; n < 700 && page.rendered.run.claimedCount === 0; n++) frames(page, 1);
    const run = page.rendered.run;
    assert.ok(run.claimedCount > 0);
    assert.equal(run.status, 'running');
    const position = [run.player.x, run.player.y];
    page.frame(200);
    assert.deepEqual([run.player.x, run.player.y], position);
    assert.equal(run.player.speed, 0);
    assert.equal(run.player.queuedDirection, null);
    assert.match(page.$('run-message').textContent, /Tap a direction to fly again/);
    page.$('pause-button').click();
    const saved = JSON.parse(page.storage.getItem('revealline.suspended.dev.v1'));
    assert.equal(saved.continuation.direction, null);
    assert.equal(verifyReplay(saved.replay).match, true);
    page.$('continue-saved').click();
    await settle(() => !page.$('continue-saved').disabled, 'stopped session restored');
    page.frame(0);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    frames(page, 8);
    assert.deepEqual([page.rendered.run.player.x, page.rendered.run.player.y], position);
    page.key('ArrowDown', false);
    page.key('ArrowLeft');
    page.key('ArrowLeft', false);
    frames(page, 12);
    assert.ok(page.rendered.run.player.x < position[0]);
    assert.deepEqual(page.errors, []);
  });

test('actual classic host explains a life pickup, retains timed effects through pause/load, and explicitly resumes saved movement', async (t) => {
  const page = await setup(t, 0);
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let n = 0; n < 100 && page.rendered.run.lives === 3; n++) frames(page, 1);
  assert.equal(page.rendered.run.lives, 4);
  assert.match(page.$('run-message').textContent, /Extra life collected/);
  assert.equal(page.$('encounter-status').hidden, false);
  for (let n = 0; n < 200 && !page.rendered.run.classic.powerups[1].collectedTick; n++)
    frames(page, 1);
  frames(page, 1);
  assert.match(page.$('classic-summary').textContent, /Speed:/);
  const before = authoritativeCheckpoint(page.rendered.run);
  page.$('pause-button').click();
  frames(page, 4);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  const saved = JSON.parse(page.storage.getItem('revealline.suspended.dev.v1'));
  assert.equal(saved.replay.version, 'xonix-replay.v6');
  assert.equal(verifyReplay(saved.replay).match, true);
  page.$('continue-saved').click();
  await settle(() => !page.$('continue-saved').disabled, 'classic session restored');
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.equal(page.rendered.paused, true);
  const y = page.rendered.run.player.y;
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  frames(page, 4);
  assert.ok(page.rendered.run.player.y > y);
  assert.deepEqual(page.errors, []);
});

test('actual classic host exposes lethal-terrain recovery text and clears movement before redeployment', async (t) => {
  const page = await setup(t, 5);
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let n = 0; n < 1200 && page.rendered.run.status === 'running'; n++) frames(page, 1);
  assert.equal(page.rendered.run.status, 'respawning');
  assert.equal(page.rendered.run.failureCause, 'lethal-terrain');
  assert.match(page.$('run-message').textContent, /lethal field/);
  for (let n = 0; n < 200 && page.rendered.run.status === 'respawning'; n++) frames(page, 1);
  const y = page.rendered.run.player.y;
  frames(page, 30);
  assert.equal(page.rendered.run.player.y, y);
  assert.deepEqual(page.errors, []);
});
