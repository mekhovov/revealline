import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { MENU_ANIMATION_KEY } from '../ui/menu-scenes.mjs';

async function mounted(t) {
  const timers = new Set();
  t.after(() => {
    for (const timer of timers) clearTimeout(timer);
  });
  const page = await demoPage(t, {
    search: '?journey=legacy&performance=1',
    browserSetup({ window, globals }) {
      globals.performance = { now: () => 1000 };
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
      window.performance = globals.performance;
      window.setTimeout = (callback, delay) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          callback();
        }, delay);
        timers.add(timer);
        return timer;
      };
      window.clearTimeout = (timer) => {
        timers.delete(timer);
        clearTimeout(timer);
      };
    },
  });
  const home = page.$('shell-home');
  const art = home.querySelector('.menu-scene-art');
  art.naturalWidth = 960;
  art.naturalHeight = 540;
  art.complete = true;
  art.emit('load');
  // The modeled DOM has no MutationObserver; use the menu's existing document
  // refresh event after the public home opening rather than inventing ownership.
  page.doc.emit('change');
  page.frame(0);
  page.frame(16);
  return {
    page,
    scene: home.querySelector('.menu-scene'),
    snapshot: () => page.win.RevealLineSoloPerformance.export(),
  };
}
function stalledWindow(page) {
  page.frame(600);
  page.frame(600);
}

test('continuous foreground title stalls reduce actual decoration without advancing the run or delaying Start', async (t) => {
  const { page, scene, snapshot } = await mounted(t);
  const before = authoritativeCheckpoint(page.rendered.run);
  const initialTick = page.rendered.run.tick;
  const preference = page.storage.getItem(MENU_ANIMATION_KEY);
  const samples = snapshot().cadenceCalibration.samples;
  assert.equal(scene.dataset.motion, 'on');
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'full');
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'reduced');
  assert.equal(scene.dataset.motion, 'off');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.equal(page.storage.getItem(MENU_ANIMATION_KEY), preference);
  assert.equal(
    snapshot().cadenceCalibration.samples,
    samples,
    'Stalls are not calibration samples.',
  );
  assert.ok(samples < 30, 'Insufficient ready cadence stays provisional.');
  page.$('overlay-brief').click();
  page.$('shell-briefing').click();
  await page.$('start-button').onclick();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.run.tick, initialTick);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(page.errors, []);
});

test('title overload windows cannot join across covered, hidden or unfocused ownership', async (t) => {
  const { page, snapshot } = await mounted(t);
  const before = authoritativeCheckpoint(page.rendered.run);
  stalledWindow(page);
  page.$('shell-settings').click();
  assert.equal(page.$('settings-dialog').open, true);
  stalledWindow(page);
  page.$('settings-dialog').close();
  page.frame(0);
  page.frame(16);
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'full');
  // A hidden/visible transition can occur without any intervening frame.
  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  page.doc.hidden = false;
  page.doc.emit('visibilitychange');
  page.frame(0);
  page.frame(16);
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'full');
  page.win.emit('blur');
  page.win.emit('focus');
  page.frame(0);
  page.frame(16);
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'full');
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'reduced');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual(page.errors, []);
});

test('a title interruption before render submission cannot complete the old overload window', async (t) => {
  const { page, snapshot } = await mounted(t);
  stalledWindow(page);
  page.frame(600);
  page.frame(600, {
    beforeRender() {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
    },
  });
  assert.equal(snapshot().quality.tier, 'full');
  page.frame(0);
  page.frame(16);
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'full');
  stalledWindow(page);
  assert.equal(snapshot().quality.tier, 'reduced');
  assert.deepEqual(page.errors, []);
});

test('Demo and stable cheap title cadence cannot contribute title-stall adaptation', async (t) => {
  const { page, scene, snapshot } = await mounted(t);
  for (let i = 0; i < 150; i++) page.frame(1000 / 30);
  assert.equal(snapshot().quality.tier, 'full');
  assert.equal(scene.dataset.motion, 'on');
  await page.open();
  for (let i = 0; i < 8; i++) page.frame(600);
  assert.equal(snapshot().quality.tier, 'full');
  assert.deepEqual(page.errors, []);
});
