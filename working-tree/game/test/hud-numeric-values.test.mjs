import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloScoreLabel } from '../ui/hud-values.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { soloPage, SoloElement } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

test('Solo integer HUD scores keep five-place padding without grouping or truncation', () => {
  for (const [score, expected] of [
    [0, '00000'],
    [42, '00042'],
    [2780000, '2780000'],
    [1000000000, '1000000000'],
  ]) {
    assert.equal(soloScoreLabel(score), expected);
  }
});

test('fractional HUD labels use result precision without integer padding', () => {
  const decimal = (1.1).toLocaleString().replace(/\p{Number}/gu, '');
  for (const [score, expected] of [
    [0.1 + 0.2, `0${decimal}3`],
    [1.2344, `1${decimal}234`],
    [1.2346, `1${decimal}235`],
    [0.0004, '0'],
    [9.9999, '10'],
  ]) {
    assert.equal(soloScoreLabel(score), expected);
  }
  // As with results, nearby raw fractional scores can share a display label.
  assert.equal(soloScoreLabel(0.3), soloScoreLabel(0.1 + 0.2));
  assert.notEqual(0.3, 0.1 + 0.2);
});

test('a real fractional capture displays a short label while save and replay retain raw score', async (t) => {
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const level = retryFixture('self-contact').level;
  level.rules = { lives: 3, pointsPerCell: 0.1 };
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'hud-fractional-capture',
    revision: '1',
    title: 'Fractional capture presentation',
    classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
    levels: [level],
  };
  const page = await soloPage(t, { campaign });
  assert.equal(page.$('score').textContent, '00000');
  page.$('start-button').click();
  page.key('ArrowDown');
  for (let n = 0; n < 10; n++) page.frame();
  page.key('ArrowDown', false);
  page.key('ArrowLeft');
  for (let n = 0; n < 180 && page.rendered.run.score === 0; n++) page.frame();
  page.key('ArrowLeft', false);
  page.$('pause-button').click();
  page.frame(0);

  const run = page.rendered.run;
  assert.equal(run.claimedCount, 6, 'Normal fixed-step input closes the six-cell cut');
  assert.equal(run.score, 0.6000000000000001);
  assert.equal(page.$('score').textContent, (0.6).toLocaleString());
  const checkpoint = authoritativeCheckpoint(run);
  const stored = page.storage.getItem('revealline.suspended.dev.v1');
  const saved = JSON.parse(stored);
  const replay = verifyReplay(saved.replay);
  assert.equal(replay.match, true);
  assert.equal(replay.state.score, run.score);
  const writes = page.storage.writes.length;
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(run.score, 0.6000000000000001);
  assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), stored);
  assert.equal(page.storage.writes.length, writes);
  assert.deepEqual(page.errors, []);
});
