import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';

const pack = JSON.parse(
  readFileSync(new URL('../content/packs/classic-lab.json', import.meta.url)),
);
const frames = (page, count) => {
  for (let i = 0; i < count; i++) page.frame();
};
async function setup(t, index) {
  const page = await soloPage(t),
    candidate = structuredClone(pack);
  candidate.campaigns[0].levels = [candidate.campaigns[0].levels[index]];
  page.$('library-button').click();
  page.$('pack-json').value = JSON.stringify(candidate);
  page.$('install-pack').click();
  await settle(() => !page.$('install-pack').disabled, 'classic practice pack installed');
  assert.match(page.$('pack-status').textContent, /Validated and installed/);
  const play = page
    .$('installed-packs')
    .querySelectorAll('button')
    .find((button) => button.textContent === `Play ${candidate.campaigns[0].title}`);
  assert.ok(play);
  play.click();
  page.frame(0);
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v5');
  return page;
}

test('actual classic host explains a life pickup, retains timed effects through pause/load, and explicitly resumes saved movement', async (t) => {
  const page = await setup(t, 0);
  page.$('start-button').click();
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
  frames(page, 4);
  assert.ok(page.rendered.run.player.y > y);
  assert.deepEqual(page.errors, []);
});

test('actual classic host exposes lethal-terrain recovery text and clears movement before redeployment', async (t) => {
  const page = await setup(t, 5);
  page.$('start-button').click();
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
