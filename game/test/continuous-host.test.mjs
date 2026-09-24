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
    // With the host's v4 8.84-cell/s preset, this leaves the same-direction
    // tap and queued turn before the next cell centre, not just after it.
    ticks(page, 11);
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
    assert.equal(page.rendered.run.player.cutting, true);
    assert.ok(
      page.rendered.run.trail.length > 0,
      'The restored flight retains its unfinished line',
    );
    const restoredBytes = storage.getItem(sessionKey);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    assert.equal(
      page.$('run-message').textContent,
      'Flight resumed. Your unfinished line is still exposed.',
    );
    assert.equal(storage.getItem(sessionKey), restoredBytes, 'Resume copy does not rewrite save');
    ticks(page, 8);
    assert.equal(page.rendered.run.tick, saved.replay.ticks + 8);
    assert.ok(
      page.rendered.run.player.x > run.player.x,
      'explicit Resume continues saved turn without a new direction',
    );
    page.$('pause-button').click();
    assert.equal(verifyReplay(JSON.parse(storage.getItem(sessionKey)).replay).match, true);
    assert.equal(
      page.$('run-message').textContent,
      'Flight paused. Your unfinished line is kept. Press Resume to continue.',
    );
    const pausedCheckpoint = authoritativeCheckpoint(page.rendered.run);
    page.$('shell-settings').click();
    page.frame(0);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), pausedCheckpoint);
    assert.equal(page.rendered.paused, true);
    assert.doesNotMatch(page.$('run-message').textContent, /Flight resumed/);
    assert.deepEqual(page.errors, []);
  });
}

test('restored ground flight captions follow pause/resume without suppressing an interruption warning', async (t) => {
  const page = await soloPage(t, { campaign });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  ticks(page, 8);
  page.$('pause-button').click();
  page.$('continue-saved').click();
  await settle(() => !page.$('continue-saved').disabled);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(page.$('run-message').textContent, 'Flight resumed.');
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('pause-button').click();
  assert.equal(page.$('run-message').textContent, 'Flight paused. Press Resume to continue.');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  page.$('start-button').click();
  assert.equal(page.$('run-message').textContent, 'Flight resumed.');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  page.frame(300);
  const important = 'Paused after a long frame interruption. Resume to continue safely.';
  assert.equal(page.$('run-message').textContent, important);
  page.$('shell-settings').click();
  page.frame(0);
  assert.equal(page.$('run-message').textContent, important);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(verifyReplay(JSON.parse(page.storage.getItem(sessionKey)).replay).match, true);
  assert.deepEqual(page.errors, []);
});

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

test('title, missions and settings use the current library navigation without starting flight', async (t) => {
  const page = await soloPage(t, { campaign, titleScreen: true });
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    missions = page.$('shell-play'),
    open = missions.onclick;
  assert.equal(page.$('shell-home').open, true);
  let opening;
  missions.onclick = (...args) => (opening = open.apply(missions, args));
  try {
    missions.focus();
    missions.click();
  } finally {
    missions.onclick = open;
  }
  assert.ok(opening instanceof Promise, 'The real button returns its catalogue preparation.');
  assert.equal(page.$('mission-library-opening-status').textContent, 'Preparing missions…');
  await opening;
  assert.equal(page.$('journey-chooser').open, true);
  assert.equal(page.$('shell-home').open, true, 'The library retains its Home parent.');
  assert.equal(page.$('journey-cards').children.length > 0, true);
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.rendered.run, run);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  page.$('journey-back').click();
  assert.equal(page.doc.activeElement, page.$('shell-play'));
  page.$('shell-options').click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});

async function liveForegroundCut(t, turnPolicy) {
  const storage = memoryStorage();
  saveLibrary(
    storage,
    'revealline.library.dev.v1',
    updatePreferences(emptyLibrary(), { turnPolicy }),
  );
  const page = await soloPage(t, { campaign, storage });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 12); // Queue before the next cell centre under the host's v4 preset.
  page.key('ArrowRight');
  page.key('ArrowRight', false);
  ticks(page, 1);
  assert.equal(page.rendered.run.player.cutting, true);
  assert.ok(page.rendered.run.trail.length > 0);
  if (turnPolicy === 'grid-center') assert.equal(page.rendered.run.player.queuedDirection, 'right');
  assert.equal(page.doc.body.dataset.pictureState, 'ready');
  return page;
}

for (const turnPolicy of ['immediate', 'grid-center'])
  for (const background of ['hidden', 'unfocused'])
    test(`${turnPolicy}: a queued Resume cannot reactivate a cached cut while ${background}`, async (t) => {
      const page = await liveForegroundCut(t, turnPolicy);
      page.$('pause-button').click();
      page.frame(0);
      const run = page.rendered.run,
        checkpoint = authoritativeCheckpoint(run),
        savedTick = run.tick,
        savedX = run.player.x,
        queuedResume = page.$('start-button').onclick;
      assert.equal(page.$('start-button').hidden, false);
      assert.equal(page.rendered.paused, true);
      // Model a previously queued activation arriving after the lifecycle event.
      // This direct handler is a race boundary, not a native background click.
      if (background === 'hidden') {
        page.doc.hidden = true;
        page.doc.emit('visibilitychange');
      } else {
        page.doc.focused = false;
        page.win.emit('blur');
      }
      page.frame(0);
      const stored = new Map(page.storage.map),
        writes = page.storage.writes.length,
        reads = page.padReads,
        focus = page.doc.activeElement;
      queuedResume();
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      assert.equal(page.$('game-overlay').hidden, false);
      assert.equal(page.$('game-overlay').dataset.kind, 'pause');
      assert.equal(page.doc.activeElement, focus, 'Late activation cannot reclaim focus');
      ticks(page, 12);
      assert.equal(page.rendered.run, run);
      assert.equal(page.rendered.paused, true);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.deepEqual(page.storage.map, stored);
      assert.equal(page.storage.writes.length, writes);
      assert.equal(page.padReads, reads, 'No controller reads while inactive');

      page.doc.hidden = false;
      page.doc.focused = true;
      if (background === 'hidden') page.doc.emit('visibilitychange');
      else page.win.emit('focus');
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      // Do not run a frame first: controllerInactive still records the old epoch.
      // An actual foreground Resume must work immediately, using the saved turn.
      page.$('start-button').click();
      assert.equal(page.doc.body.dataset.flightState, 'running');
      ticks(page, 8);
      assert.equal(run.tick, savedTick + 8);
      assert.ok(run.player.x > savedX);
      page.$('pause-button').click();
      assert.equal(verifyReplay(JSON.parse(page.storage.getItem(sessionKey)).replay).match, true);
      assert.deepEqual(page.errors, []);
    });

for (const background of ['hidden', 'unfocused'])
  test(`Solo detects ${background} without a lifecycle notification before polling or stepping`, async (t) => {
    const page = await liveForegroundCut(t, 'grid-center'),
      run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      savedTick = run.tick,
      savedX = run.player.x,
      reads = page.padReads;
    if (background === 'hidden') page.doc.hidden = true;
    else page.doc.focused = false;
    // No event is dispatched: the real frame guard must observe inactivity.
    page.frame(0);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    const stored = new Map(page.storage.map),
      writes = page.storage.writes.length;
    ticks(page, 12);
    assert.equal(page.padReads, reads);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(run.player.queuedDirection, 'right');
    assert.deepEqual(page.storage.map, stored);
    assert.equal(page.storage.writes.length, writes);
    page.doc.hidden = false;
    page.doc.focused = true;
    ticks(page, 8);
    assert.equal(page.rendered.paused, true, 'Returning foreground never resumes');
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    page.$('start-button').click();
    ticks(page, 8);
    assert.equal(run.tick, savedTick + 8);
    assert.ok(run.player.x > savedX);
    page.$('pause-button').click();
    assert.equal(verifyReplay(JSON.parse(page.storage.getItem(sessionKey)).replay).match, true);
    assert.deepEqual(page.errors, []);
  });
