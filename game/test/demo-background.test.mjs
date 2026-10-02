import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { settle } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { prepareReplayPlayer } from '../replay-player.mjs';

const frames = (page, count, ms = 16) => {
  for (let i = 0; i < count; i++) page.frame(ms);
};
const stored = (page) => [...page.storage.map];
function hidden(page, value) {
  page.doc.hidden = value;
  page.doc.emit('visibilitychange');
}
function focused(page, value) {
  page.doc.focused = value;
  page.win.emit(value ? 'focus' : 'blur');
}

test('visible unfocused watch advances independently and close retires its clock without changing an ordinary cut', async (t) => {
  const page = await demoPage(t);
  page.$('overlay-brief').click();
  page.$('shell-briefing').click();
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  frames(page, 20);
  const ordinary = page.rendered.run;
  assert.equal(ordinary.player.cutting, true);
  page.$('shell-menu').click();
  page.frame(0);
  const before = authoritativeCheckpoint(ordinary),
    saves = stored(page);
  await page.open();
  const watched = page.demoFrame.run,
    start = watched.tick;
  focused(page, false);
  frames(page, 12);
  assert.ok(watched.tick > start);
  assert.equal(page.demoFrame.options.paused, false);
  assert.equal(page.$('demo-actions').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(ordinary), before);
  assert.deepEqual(stored(page), saves);

  page.$('demo-back').click();
  const retired = authoritativeCheckpoint(watched);
  hidden(page, true);
  page.frame(1000);
  await delay(120);
  hidden(page, false);
  focused(page, true);
  frames(page, 4);
  assert.equal(page.$('demo-dialog').open, false);
  assert.deepEqual(authoritativeCheckpoint(watched), retired);
  assert.deepEqual(authoritativeCheckpoint(ordinary), before);
  // The ordinary page owns lifecycle saving again after Back; its savedAt may
  // refresh on hidden. Its actual cut and the retired spectator stay exact.
});

test('hidden timer wake consumes bounded elapsed replay time exactly and return paints the current tick', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run;
  const before = authoritativeCheckpoint(ordinary),
    saves = stored(page);
  await page.open();
  const painted = page.demoFrame,
    watched = painted.run;
  assert.equal(watched.tick, 0);
  focused(page, false);
  hidden(page, true);
  page.frame(1000);
  await waitFor(() => watched.tick === 120, {
    message: 'The hidden timer should replay one admitted second without a Phaser frame.',
  });
  assert.equal(page.demoFrame, painted, 'Hidden playback does not paint.');
  assert.equal(page.$('demo-actions').hidden, true);
  const recording = JSON.parse(
    await readFile(new URL('../demo-data/first-signal-left.replay.json', import.meta.url)),
  );
  const reference = await prepareReplayPlayer(recording);
  try {
    reference.play();
    for (let i = 0; i < 4; i++) reference.advance(0.25);
    assert.deepEqual(authoritativeCheckpoint(watched), authoritativeCheckpoint(reference.state));
  } finally {
    reference.dispose();
  }
  hidden(page, false);
  focused(page, true);
  page.frame(0);
  assert.notEqual(page.demoFrame, painted);
  assert.equal(page.demoFrame.run.tick, 120);
  assert.equal(page.demoFrame.options.paused, false);
  assert.deepEqual(authoritativeCheckpoint(ordinary), before);
  assert.deepEqual(stored(page), saves);
});

test('explicit watch pause survives hidden time, blur and return until Keep watching', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run;
  const original = authoritativeCheckpoint(ordinary),
    saves = stored(page);
  await page.open();
  frames(page, 12);
  page.$('demo-interrupt').click();
  const watched = page.demoFrame.run,
    pausedTick = watched.tick,
    before = authoritativeCheckpoint(watched);
  focused(page, false);
  hidden(page, true);
  page.frame(60000);
  await delay(120);
  assert.deepEqual(authoritativeCheckpoint(watched), before);
  hidden(page, false);
  focused(page, true);
  frames(page, 4);
  assert.equal(page.$('demo-actions').hidden, false);
  assert.equal(page.demoFrame.options.paused, true);
  assert.deepEqual(authoritativeCheckpoint(watched), before);
  page.$('demo-resume').click();
  frames(page, 4);
  assert.ok(watched.tick > pausedTick);
  assert.equal(page.demoFrame.options.paused, false);
  assert.deepEqual(authoritativeCheckpoint(ordinary), original);
  assert.deepEqual(stored(page), saves);
});

test('hidden playback completes a real recorded level, retains its recap and adopts the next scene without RAF', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run;
  const before = authoritativeCheckpoint(ordinary),
    saves = stored(page);
  const previousFetch = globalThis.fetch;
  let recordingReads = 0;
  globalThis.fetch = async (url, options) => {
    if (url?.pathname?.endsWith('/demo-data/first-signal-left.replay.json')) recordingReads++;
    return previousFetch(url, options);
  };
  try {
    await page.open();
    assert.equal(recordingReads, 1);
    const painted = page.demoFrame,
      watched = painted.run,
      firstLevel = page.$('demo-level').textContent;
    focused(page, false);
    hidden(page, true);
    // Each wake admits at most2s and yields its quarter-second slices. The
    // document is hidden throughout: the fixture dispatches no animation frame.
    for (let wakes = 0; page.$('demo-level').textContent === firstLevel; wakes++) {
      assert.ok(
        wakes < 34,
        `A real recording and its recap must rotate: ${watched.status}, tick ${watched.tick}, errors ${JSON.stringify(page.errors)}`,
      );
      page.frame(2000);
      await delay(90);
    }
    assert.equal(watched.status, 'won');
    assert.equal(watched.tick, 3682);
    assert.equal(page.demoFrame, painted, 'Background completion and rotation do not repaint.');
    await page.ready();
    assert.equal(page.demoFrame, painted);
    hidden(page, false);
    focused(page, true);
    page.frame(0);
    assert.notEqual(page.demoFrame.painter, painted.painter);
    assert.notEqual(page.demoFrame.run, watched);
    assert.equal(page.demoFrame.options.paused, false);
    const tick = page.demoFrame.run.tick;
    frames(page, 4);
    assert.ok(page.demoFrame.run.tick > tick);
    assert.deepEqual(authoritativeCheckpoint(ordinary), before);
    assert.deepEqual(stored(page), saves);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('blur during pending watch source loading preserves adoption and continuous playback', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run;
  const before = authoritativeCheckpoint(ordinary),
    saves = stored(page);
  const previousFetch = globalThis.fetch;
  let release,
    entered = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (url, options) => {
    if (url?.pathname?.endsWith('/demo-data/catalog.json')) {
      entered = true;
      await gate;
    }
    return previousFetch(url, options);
  };
  try {
    page.$('shell-demo').click();
    await waitFor(() => entered, { message: 'Watch must begin its actual catalogue request.' });
    assert.equal(page.$('demo-dialog').open, true);
    assert.equal(page.$('demo-fresh').disabled, true);
    focused(page, false);
    page.frame(1000);
    release();
    await page.ready();
    const watched = page.demoFrame.run,
      tick = watched.tick;
    frames(page, 12);
    assert.ok(watched.tick > tick);
    assert.equal(page.$('demo-actions').hidden, true);
    assert.equal(page.demoFrame.options.paused, false);
    assert.deepEqual(authoritativeCheckpoint(ordinary), before);
    assert.deepEqual(stored(page), saves);
  } finally {
    release();
    globalThis.fetch = previousFetch;
  }
});

test('withheld visible RAF recovers real replay completion and rotation while preserving explicit pause and the ordinary save', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run,
    original = authoritativeCheckpoint(ordinary),
    saves = stored(page),
    originalFetch = globalThis.fetch;
  let recordingReads = 0;
  globalThis.fetch = async (url, options) => {
    if (url?.pathname?.endsWith('/demo-data/first-signal-left.replay.json')) recordingReads++;
    return originalFetch(url, options);
  };
  try {
    await page.open();
    const watched = page.demoFrame.run,
      firstLevel = page.$('demo-level').textContent;
    focused(page, false);
    assert.equal(page.doc.hidden, false);
    page.$('demo-watch-pause').click();
    const paused = authoritativeCheckpoint(watched);
    page.frame(60000, { dispatchAnimationFrames: false });
    await delay(300);
    assert.deepEqual(authoritativeCheckpoint(watched), paused);
    assert.equal(page.demoFrame.options.paused, true);
    page.$('demo-watch-pause').click();

    // Model a visible/unfocused browser that runs timers but withholds every
    // requested animation frame. The production clock owns all replay ticks.
    for (let wakes = 0; page.$('demo-level').textContent === firstLevel; wakes++) {
      assert.ok(
        wakes < 34,
        `The replay and recap must rotate: ${watched.status}, tick ${watched.tick}, errors ${JSON.stringify(page.errors)}`,
      );
      page.frame(2000, { dispatchAnimationFrames: false });
      await delay(300);
    }
    assert.equal(watched.status, 'won');
    const recording = JSON.parse(
      await readFile(new URL('../demo-data/first-signal-left.replay.json', import.meta.url)),
    );
    const reference = await prepareReplayPlayer(recording);
    try {
      reference.play();
      while (reference.state.status === 'running') reference.advance(0.25);
      assert.deepEqual(authoritativeCheckpoint(watched), authoritativeCheckpoint(reference.state));
    } finally {
      reference.dispose();
    }
    await settle(() => !page.$('demo-fresh').disabled);
    page.frame(250, { dispatchAnimationFrames: false });
    await delay(300);
    assert.notEqual(page.demoFrame.run, watched);
    assert.ok(page.demoFrame.run.tick > 0, 'The next demonstration also advances without a RAF.');
    assert.deepEqual(authoritativeCheckpoint(ordinary), original);
    assert.deepEqual(stored(page), saves);
    assert.deepEqual(page.errors, []);

    const retired = page.demoFrame.run,
      retiredCheckpoint = authoritativeCheckpoint(retired);
    page.$('demo-back').click();
    page.frame(1000, { dispatchAnimationFrames: false });
    await delay(300);
    assert.deepEqual(authoritativeCheckpoint(retired), retiredCheckpoint);
    assert.deepEqual(authoritativeCheckpoint(ordinary), original);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
