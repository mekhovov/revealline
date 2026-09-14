// Actual solo host, saved replay and fixed-step input; DOM/paint are modeled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
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

for (const stopOnCapture of [false, true])
  for (const newerNotice of [false, true])
    test(`secured cut cue follows real motion and exposure: stop ${stopOnCapture}, newer notice ${newerNotice}`, async (t) => {
      t.mock.method(SoloElement.prototype, 'getContext', () => null);
      const level = {
        version: 'xonix-level.v4',
        id: 'hud-secured-cut',
        revision: '1',
        name: 'Secured cut cues',
        width: 72,
        height: 36,
        encounter: null,
        classic: { version: 'classic.v1', terrain: [], powerups: [] },
        spawn: { x: 24.5, y: 0.5 },
        goal: { coverage: 0.99 },
        enemies: [{ id: 'remote', type: 'bouncer', x: 38.5, y: 18.5, vx: 0, vy: 0 }],
        rules: { moveSpeed: 13, lives: 3, stopOnCapture },
      };
      const page = await soloPage(t),
        candidate = {
          format: 'xonix-pack.v5',
          id: `hud-secured-${stopOnCapture}`,
          version: '1.0.0',
          name: 'Secured cut cues',
          description: 'A small validated Arcade fixture for successful capture cues.',
          engine: 'xonix-core.v5',
          dependencies: [],
          themes: JSON.parse(
            readFileSync(new URL('../content/themes.json', import.meta.url)),
          ).themes.slice(0, 1),
          classRecipes: classes,
          campaigns: [
            {
              version: 'xonix-campaign.v1',
              id: `hud-secured-${stopOnCapture}`,
              revision: '1',
              title: 'Secured cut cues',
              levels: [level],
            },
          ],
          masteries: [],
          visualOverrides: {},
          levelVisuals: [],
          music: [],
        };
      page.$('library-button').click();
      page.$('pack-json').value = JSON.stringify(candidate);
      await page.$('install-pack').onclick();
      assert.match(page.$('pack-status').textContent, /Validated and installed/);
      const play = page
        .$('installed-packs')
        .querySelectorAll('button')
        .find((button) => button.textContent === 'Play Secured cut cues');
      assert.ok(play);
      play.click();
      page.frame(0);
      assert.equal(page.rendered.run.ruleset, 'xonix-core.v5');
      assert.equal(page.rendered.run.rules.stopOnCapture, stopOnCapture);
      page.$('start-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.key('ArrowDown');
      until(page, () => page.rendered.run.claimedCount > 0, 450);
      page.key('ArrowDown', false);
      assert.equal(page.rendered.run.status, 'running');
      assert.equal(page.rendered.run.player.cutting, false);
      assert.equal(page.rendered.run.lives, 3);
      const secured = page.$('run-message').textContent;
      assert.match(secured, /^Line secured\./);
      if (stopOnCapture) {
        assert.match(secured, /Tap a direction/);
        const position = [page.rendered.run.player.x, page.rendered.run.player.y];
        tick(page, 6);
        assert.equal(page.rendered.run.player.speed, 0);
        assert.deepEqual([page.rendered.run.player.x, page.rendered.run.player.y], position);
        assert.equal(page.$('run-message').textContent, secured);
      }
      if (newerNotice) {
        page.$('save-attempt-button').click();
        assert.match(page.$('run-message').textContent, /^Flight saved\./);
        const checkpoint = authoritativeCheckpoint(page.rendered.run);
        page.$('start-button').click();
        page.frame(0);
        assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
      }
      const prior = page.$('run-message').textContent,
        x = page.rendered.run.player.x,
        claimed = page.rendered.run.claimedCount;
      page.key('ArrowRight');
      tick(page, 12);
      page.key('ArrowRight', false);
      assert.ok(page.rendered.run.player.x > x);
      assert.equal(page.rendered.run.player.cutting, false);
      if (newerNotice) assert.equal(page.$('run-message').textContent, prior);
      else if (stopOnCapture) assert.equal(page.$('run-message').textContent, 'Flight moving.');
      page.key('ArrowUp');
      until(page, () => page.rendered.run.player.cutting, 60);
      page.key('ArrowUp', false);
      assert.equal(page.rendered.run.status, 'running');
      assert.equal(page.rendered.run.lives, 3);
      assert.equal(page.rendered.run.claimedCount, claimed);
      if (newerNotice) assert.equal(page.$('run-message').textContent, prior);
      else {
        assert.match(page.$('run-message').textContent, /^Live line exposed\./);
        assert.doesNotMatch(page.$('run-message').textContent, /Line secured|Tap a direction/);
      }
      page.$('pause-button').click();
      assert.equal(verifyReplay(JSON.parse(page.storage.getItem(sessionKey)).replay).match, true);
      assert.deepEqual(page.errors, []);
    });
