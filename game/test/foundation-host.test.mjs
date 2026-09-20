import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: foundation host calls return surfaces reclaimed ground and preserves closure control`, async (t) => {
    const preview = prepareContentPreview(createOpeningCandidates(), 'courtyard-return', {
      theme: themes[0],
    });
    preview.scenario.settings.turnPolicy = turnPolicy;
    const storage = memoryStorage(),
      page = await soloPage(t, {
        storage,
        search: '?practice=1',
        previewStorage: memoryStorage({
          'revealline.playground.current': JSON.stringify(preview.scenario),
        }),
      });
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    const run = page.rendered.run;
    assert.equal(run.ruleset, 'xonix-core.v6');
    assert.equal(run.turnPolicy, turnPolicy);
    assert.equal(page.$('theme-select').value, 'horizon');
    assert.equal(page.$('flight-state').textContent, 'Reclaimed ground');
    assert.equal(run.coverage, 0, 'Starting foundations are not earned territory.');
    page.key('ArrowRight');
    page.key('ArrowRight', false);
    for (let frame = 0; frame < 800 && run.claimedCount === 0; frame++) page.frame();
    assert.equal(run.status, 'running');
    assert.equal(run.player.cutting, false);
    assert.equal(run.player.speed, 0);
    assert.equal(run.lives, 3);
    assert.equal(run.score, 1140);
    assert.match(page.$('run-message').textContent, /Line secured.*5.1%.*Tap a direction/);
    assert.equal(page.$('flight-state').textContent, 'Reclaimed ground');
    const stopped = authoritativeCheckpoint(run);
    page.frame(0);
    assert.deepEqual(authoritativeCheckpoint(run), stopped);
    page.key('ArrowRight');
    page.key('ArrowRight', false);
    for (let frame = 0; frame < 30 && !run.player.cutting; frame++) page.frame();
    assert.equal(run.player.cutting, true);
    assert.match(page.$('run-message').textContent, /Reach reclaimed ground to secure it/);
    assert.doesNotMatch(page.$('run-message').textContent, /safe ground/i);
    assert.match(page.$('flight-state').textContent, /EXPOSED/);
    assert.equal(storage.getItem('revealline.suspended.dev.v1'), null);
    assert.deepEqual(page.errors, []);
  });
