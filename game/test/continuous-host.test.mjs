import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { updatePreferences, emptyLibrary, saveLibrary } from '../library.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const level = retryFixture('self-contact').level;
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'continuous-host',
  revision: '1',
  title: 'Continuous host',
  classRecipes: classes,
  levels: [{ ...level, rules: { lives: 3, respawnSeconds: 0.1 } }],
};
const sessionKey = 'revealline.suspended.dev.v1';
const ticks = (page, count) => {
  for (let n = 0; n < count; n++) page.frame();
};

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: tap/release, same direction, exact pause/load and explicit resume through the actual host`, async (t) => {
    const storage = memoryStorage();
    saveLibrary(
      storage,
      'revealline.library.dev.v1',
      updatePreferences(emptyLibrary(), { turnPolicy }),
    );
    const page = await soloPage(t, { campaign, storage });
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    ticks(page, 13);
    const run = page.rendered.run;
    const y = run.player.y;
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    ticks(page, 1);
    assert.ok(run.player.y > y, 'same-direction tap does not toggle off');
    page.key('ArrowRight');
    page.key('ArrowRight', false);
    ticks(page, 1);
    const checkpoint = authoritativeCheckpoint(run);
    page.$('pause-button').click();
    page.frame(0);
    const saved = JSON.parse(storage.getItem(sessionKey));
    assert.equal(saved.format, 'xonix-session.v4');
    assert.equal(saved.presentationPins.format, 'revealline-flight-pictures.v2');
    assert.ok(
      saved.presentationPins.choices.every(
        (choice) => choice.picture.kind === 'legacy' && choice.story === null,
      ),
    );
    assert.equal(saved.continuation.direction, 'right');
    assert.deepEqual(saved.replay.checkpoint, checkpoint);
    assert.equal(verifyReplay(saved.replay).match, true);
    if (turnPolicy === 'grid-center') assert.equal(run.player.queuedDirection, 'right');
    page.key('ArrowUp');
    page.key('ArrowUp', false);
    ticks(page, 4);
    assert.equal(page.rendered.paused, true, 'directions cannot auto-resume');
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    page.$('continue-saved').click();
    await settle(() => !page.$('continue-saved').disabled, 'saved flight verified');
    page.frame(0);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.match(page.$('run-message').textContent, /Saved flight verified.*Press Resume/);
    const restoredBytes = storage.getItem(sessionKey);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    assert.equal(page.$('run-message').textContent, 'Flight resumed.');
    assert.equal(storage.getItem(sessionKey), restoredBytes, 'Resume copy does not rewrite save');
    ticks(page, 8);
    assert.equal(page.rendered.run.tick, saved.replay.ticks + 8);
    assert.ok(
      page.rendered.run.player.x > run.player.x,
      'explicit Resume continues saved turn without a new direction',
    );
    page.$('pause-button').click();
    assert.equal(verifyReplay(JSON.parse(storage.getItem(sessionKey)).replay).match, true);
    assert.deepEqual(page.errors, []);
  });
}

test('fresh direction before the next tick survives pause and does not rewrite the checkpoint', async (t) => {
  const page = await soloPage(t, { campaign });
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 13);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.key('ArrowRight');
  page.key('ArrowRight', false);
  page.$('pause-button').click();
  const saved = JSON.parse(page.storage.getItem(sessionKey));
  assert.equal(saved.continuation.direction, 'right');
  assert.deepEqual(saved.replay.checkpoint, checkpoint);
});

test('recovery inside a multi-tick frame clears intent and requires fresh post-recovery input', async (t) => {
  const page = await soloPage(t, { campaign });
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 30);
  page.key('ArrowUp');
  page.frame(200);
  const run = page.rendered.run;
  assert.equal(run.tick, 54);
  assert.equal(run.status, 'running');
  assert.equal(run.lives, 2);
  const position = [run.player.x, run.player.y];
  ticks(page, 30);
  assert.deepEqual([run.player.x, run.player.y], position);
  page.key('ArrowUp', false);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 3);
  assert.ok(run.player.y > position[1]);
  page.$('pause-button').click();
  assert.equal(verifyReplay(JSON.parse(page.storage.getItem(sessionKey)).replay).match, true);
});

test('title, missions, briefing and settings use real shell navigation without starting flight', async (t) => {
  const page = await soloPage(t, { campaign, titleScreen: true });
  assert.equal(page.$('shell-home').open, true);
  page.$('shell-play').click();
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.$('shell-missions').open, true);
  assert.equal(page.$('shell-mission-content').contains(page.$('pack-select')), true);
  page.$('shell-briefing').click();
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
  page.$('shell-settings').click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});
