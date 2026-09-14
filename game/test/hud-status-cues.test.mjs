// Actual solo host, saved replay and fixed-step input; DOM/paint are modeled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { soloPage, SoloElement } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const sessionKey = 'revealline.suspended.dev.v1';
const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const tick = (page, count = 1) => {
  for (let n = 0; n < count; n++) page.frame();
};
function until(page, predicate, limit = 180) {
  for (let n = 0; n < limit && !predicate(); n++) tick(page);
  assert.ok(predicate(), 'Expected transition through bounded real simulation ticks');
}
async function fixture(t, cause = 'self-contact') {
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const level = retryFixture(cause).level;
  level.rules = { lives: 3, respawnSeconds: 0.1, graceSeconds: 1 };
  const campaign = {
    version: 'xonix-campaign.v1',
    id: `hud-status-${cause}`,
    revision: '1',
    title: 'HUD status transitions',
    classRecipes: classes,
    levels: [level],
  };
  const page = await soloPage(t, { campaign });
  page.$('start-button').click();
  return page;
}

for (const newerNotice of [false, true])
  test(`restored cut Resume replaces only its own instruction, newer notice ${newerNotice}`, async (t) => {
    const page = await fixture(t);
    page.key('ArrowDown');
    tick(page, 30);
    page.key('ArrowDown', false);
    page.$('pause-button').click();
    page.frame(0);
    const saved = JSON.parse(page.storage.getItem(sessionKey));
    assert.equal(verifyReplay(saved.replay).match, true);
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    assert.equal(page.rendered.run.player.cutting, true);
    await page.$('continue-saved').onclick();
    page.frame(0);
    assert.match(page.$('run-message').textContent, /Press Resume/);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(page.rendered.paused, true);
    if (newerNotice) page.$('save-attempt-button').click();
    const beforeResume = page.$('run-message').textContent;
    if (newerNotice) assert.match(beforeResume, /^Flight saved\./);
    page.$('start-button').click();
    page.frame(0);
    assert.equal(page.rendered.paused, false);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    if (newerNotice) assert.equal(page.$('run-message').textContent, beforeResume);
    else {
      assert.match(page.$('run-message').textContent, /resumed.*line is still exposed/);
      assert.doesNotMatch(page.$('run-message').textContent, /Press Resume/);
    }
    tick(page);
    assert.ok(page.rendered.run.tick > saved.replay.ticks);
    assert.deepEqual(page.errors, []);
  });

for (const newerNotice of [false, true])
  test(`a real fresh cut retires only the prior caught-line cue, newer notice ${newerNotice}`, async (t) => {
    const page = await fixture(t, 'enemy-trail');
    page.key('ArrowDown');
    until(page, () => page.rendered.run.status === 'respawning');
    page.key('ArrowDown', false);
    assert.equal(page.rendered.run.failureCause, 'enemy-trail');
    assert.equal(page.rendered.run.lives, 2);
    const caught = page.$('run-message').textContent;
    assert.match(caught, /^Your line was caught\./);
    until(page, () => page.rendered.run.status === 'running');
    assert.equal(page.rendered.run.player.cutting, false);
    assert.equal(
      page.$('run-message').textContent,
      caught,
      'Keep the explanation through recovery',
    );
    if (newerNotice) {
      page.$('save-attempt-button').click();
      assert.match(page.$('run-message').textContent, /^Flight saved\./);
      page.$('start-button').click();
    }
    const beforeCut = page.$('run-message').textContent;
    page.key('ArrowDown');
    until(page, () => page.rendered.run.player.cutting);
    page.key('ArrowDown', false);
    assert.equal(page.rendered.run.status, 'running');
    assert.equal(page.rendered.run.lives, 2);
    assert.equal(
      page.rendered.run.failureCause,
      'enemy-trail',
      'Historical simulation cause stays intact',
    );
    if (newerNotice) assert.equal(page.$('run-message').textContent, beforeCut);
    else assert.match(page.$('run-message').textContent, /^Live line exposed\./);
    page.$('pause-button').click();
    assert.equal(verifyReplay(JSON.parse(page.storage.getItem(sessionKey)).replay).match, true);
    assert.deepEqual(page.errors, []);
  });
