import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demoPage, demoKey } from './helpers/demo-host-fixture.mjs';
import { settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { prepareReviewedReplayPlayer } from '../replay-player.mjs';

async function mounted(t) {
  let work = 1000;
  const page = await demoPage(t, {
    search: '?journey=legacy&performance=1',
    browserSetup({ globals }) {
      globals.performance = { now: () => work };
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  return {
    page,
    addWork: (ms) => {
      work += ms;
    },
    snapshot: () => page.win.RevealLineSoloPerformance.export(),
  };
}
function readyFrames(page) {
  for (let i = 0; i < 30; i++) page.frame(1000 / 60);
}
async function assertRecordedPrefix(run) {
  const source = JSON.parse(
    await readFile(new URL('../demo-data/first-signal-left.replay.json', import.meta.url), 'utf8'),
  );
  const reference = await prepareReviewedReplayPlayer(source);
  try {
    assert.equal(verifyReplay(reference.exportRecording()).match, true);
    assert.equal(run.levelId, reference.state.levelId);
    while (reference.state.tick < run.tick)
      reference.step(Math.min(240, run.tick - reference.state.tick));
    assert.deepEqual(
      authoritativeCheckpoint(run),
      authoritativeCheckpoint(reference.state),
      'Decoration never changes the exact recorded input prefix.',
    );
  } finally {
    reference.dispose();
  }
}

test('active Demo cannot calibrate the main ready baseline from its loaded callbacks', async (t) => {
  const { page, snapshot } = await mounted(t);
  await page.open();
  const before = snapshot().cadenceCalibration.samples;
  for (let i = 0; i < 40; i++) page.frame(1000 / 30);
  assert.equal(
    snapshot().cadenceCalibration.samples,
    before,
    'Demo callbacks are not lightweight preparation calibration.',
  );
  assert.equal(snapshot().quality.tier, 'full', 'Cheap regular30Hz alone must not downgrade.');
  assert.deepEqual(page.errors, []);
});

test('foreground Demo irregular delivery reduces decoration while exact replay and paused parent remain unchanged', async (t) => {
  const { page, snapshot } = await mounted(t);
  readyFrames(page);
  const parent = authoritativeCheckpoint(page.rendered.run);
  await page.open();
  const run = page.demoFrame.run;
  for (let i = 0; i < 110; i++) page.frame(i % 2 ? 50 : 1000 / 60);
  assert.equal(snapshot().quality.tier, 'reduced');
  assert.equal(page.demoFrame.options.quality, 'reduced');
  assert.ok(run.tick > 0);
  await assertRecordedPrefix(run);
  page.$('demo-interrupt').click();
  const paused = authoritativeCheckpoint(run);
  for (let i = 0; i < 10; i++) page.frame(1000 / 60);
  assert.deepEqual(authoritativeCheckpoint(run), paused);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), parent);
  assert.deepEqual(page.errors, []);
});

test('Demo practice uses the existing full Phaser submission cost once and preserves parent ownership', async (t) => {
  const { page, snapshot, addWork } = await mounted(t);
  readyFrames(page);
  const parent = authoritativeCheckpoint(page.rendered.run);
  await page.open();
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  await settle(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  const run = page.demoFrame.run;
  for (let i = 0; i < 70; i++) page.frame(1000 / 60, { beforeRender: () => addWork(20) });
  assert.equal(snapshot().quality.tier, 'full', 'One overload window cannot change quality.');
  page.$('demo-interrupt').click();
  const interrupted = authoritativeCheckpoint(run);
  for (let i = 0; i < 10; i++) page.frame(1000 / 60, { beforeRender: () => addWork(20) });
  assert.deepEqual(authoritativeCheckpoint(run), interrupted);
  page.$('demo-resume').click();
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  for (let i = 0; i < 70; i++) page.frame(1000 / 60, { beforeRender: () => addWork(20) });
  assert.equal(
    snapshot().quality.tier,
    'full',
    'Pause separates overload windows even for the same practice run.',
  );
  for (let i = 0; i < 70; i++) page.frame(1000 / 60, { beforeRender: () => addWork(20) });
  assert.equal(snapshot().quality.tier, 'reduced');
  assert.equal(page.demoFrame.options.quality, 'reduced');
  assert.ok(run.tick > 0);
  page.$('demo-interrupt').click();
  const before = authoritativeCheckpoint(run);
  for (let i = 0; i < 10; i++) page.frame(1000 / 60, { beforeRender: () => addWork(20) });
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), parent);
  assert.deepEqual(page.errors, []);
});

test('Demo caches stable display geometry and invalidates on resize and explicit layout changes', async (t) => {
  const { page } = await mounted(t);
  await page.open();
  const canvas = page.$('demo-canvas');
  let reads = 0,
    width = 640;
  Object.defineProperty(canvas, 'clientWidth', {
    configurable: true,
    get() {
      reads++;
      return width;
    },
  });
  Object.defineProperty(canvas, 'clientHeight', {
    configurable: true,
    get() {
      reads++;
      return 0;
    },
  });
  page.win.emit('resize');
  page.frame(1000 / 60);
  assert.equal(page.demoFrame.options.displayCSSWidth, 640);
  assert.equal(reads, 2);
  for (let i = 0; i < 8; i++) page.frame(1000 / 60);
  assert.equal(reads, 2, 'Stable painted callbacks do not repeat layout reads.');
  width = 500;
  page.win.emit('resize');
  page.frame(1000 / 60);
  assert.equal(page.demoFrame.options.displayCSSWidth, 500);
  assert.equal(reads, 4);
  width = 420;
  page.$('demo-details-toggle').click();
  page.frame(1000 / 60);
  assert.equal(page.demoFrame.options.displayCSSWidth, 420);
  assert.equal(reads, 6);
  assert.deepEqual(page.errors, []);
});

test('paused Demo honors the user reduced preference immediately without advancing its recording', async (t) => {
  const { page, snapshot } = await mounted(t);
  await page.open();
  page.$('demo-interrupt').click();
  page.frame(0);
  const run = page.demoFrame.run,
    before = authoritativeCheckpoint(run);
  page.$('settings-reduced-effects').checked = true;
  page.$('settings-reduced-effects').emit('change');
  page.frame(0);
  assert.equal(snapshot().quality.tier, 'reduced');
  assert.equal(page.demoFrame.options.quality, 'reduced');
  assert.equal(page.demoFrame.options.reduced, true);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(page.errors, []);
});
