import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey, demoPointer } from './helpers/demo-host-fixture.mjs';
import { memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, loadLibrary, saveLibrary, updatePreferences } from '../library.mjs';
import { KEY_BINDING_PRESETS } from '../key-bindings.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const frames = (page, count, ms = 16) => {
  for (let i = 0; i < count; i++) page.frame(ms);
};
const stored = (page) => [...page.storage.map];
async function startOrdinary(page) {
  page.$('overlay-brief').click();
  page.$('shell-briefing').click();
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
}
async function activate(button) {
  const original = button.onclick;
  let completed;
  button.onclick = function (...args) {
    return (completed = original.apply(this, args));
  };
  try {
    button.click();
    await completed;
  } finally {
    button.onclick = original;
  }
}
const cutFacts = (run) => ({
  tick: run.tick,
  player: { x: run.player.x, y: run.player.y },
  cells: [...run.cells],
  lives: run.lives,
  score: run.score,
});

for (const input of ['keyboard', 'touch'])
  test(`${input}: fresh gameplay intent takes over independently while preserving the ordinary cut/save`, async (t) => {
    const page = await demoPage(t);
    await startOrdinary(page);
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    frames(page, 20);
    const ordinary = page.rendered.run;
    assert.equal(ordinary.player.cutting, true);
    page.$('shell-menu').click();
    page.frame(0);
    const checkpoint = authoritativeCheckpoint(ordinary),
      before = stored(page);
    await page.open();
    frames(page, 25);
    assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
    assert.notEqual(page.demoFrame.run, ordinary);
    assert.ok(page.demoFrame.run.tick > 0);
    assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
    assert.deepEqual(stored(page), before);
    const recorded = page.demoFrame.run,
      shown = cutFacts(recorded),
      recordedCheckpoint = authoritativeCheckpoint(recorded);
    if (input === 'keyboard') {
      demoKey(page, 'ArrowDown');
      demoKey(page, 'ArrowDown', true, { repeat: true });
      demoKey(page, 'ArrowDown', false);
    } else {
      demoPointer(page.$('demo-canvas'), 'pointerdown');
      demoPointer(page.$('demo-canvas'), 'pointermove', { clientX: 20, clientY: 100 });
      demoPointer(page.$('demo-canvas'), 'pointerup');
    }
    await settle(() => !page.$('demo-practice-controls').hidden);
    page.frame(0);
    assert.equal(page.$('demo-actions').hidden, false);
    assert.notEqual(page.demoFrame.run, recorded);
    assert.deepEqual(cutFacts(page.demoFrame.run), shown);
    assert.equal(page.$('demo-dialog').open, true);
    frames(page, 12);
    assert.ok(
      page.demoFrame.run.tick > shown.tick,
      'The first direction starts practice without another gesture.',
    );
    assert.deepEqual(authoritativeCheckpoint(recorded), recordedCheckpoint);
    assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
    demoKey(page, 'Escape');
    demoKey(page, 'Escape', false);
    page.frame(0);
    assert.equal(page.$('demo-dialog').open, false);
    assert.equal(page.$('shell-home').open, true);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(stored(page), before);
    frames(page, 245, 250);
    assert.equal(
      page.$('demo-dialog').open,
      false,
      'an unfinished paused flight never enters idle demo',
    );
  });

test('actual idle home entry resets on activity and does not write game data', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  frames(page, 239, 250);
  assert.equal(page.$('demo-dialog').open, false);
  page.doc.emit('pointerdown', { button: 0, pointerType: 'mouse' });
  frames(page, 239, 250);
  assert.equal(page.$('demo-dialog').open, false);
  page.frame(250);
  await page.ready();
  assert.equal(page.$('demo-dialog').open, true);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(stored(page), before);
});

test('Watch from Settings restores its dialog and focus on Back, while Fresh leaves Settings closed', async (t) => {
  const page = await demoPage(t),
    home = page.$('shell-home'),
    settings = page.$('settings-dialog'),
    watch = page.$('shell-demo'),
    ordinary = page.rendered.run,
    checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  page.$('shell-options').click();
  page.$('settings-tab-extras').click();
  watch.focus();
  assert.equal(home.open, true);
  assert.equal(settings.open, true);
  await page.open();
  assert.equal(home.open, false);
  assert.equal(settings.open, false);
  page.$('demo-back').click();
  assert.equal(page.$('demo-dialog').open, false);
  assert.equal(home.open, true);
  assert.equal(settings.open, true);
  assert.equal(page.doc.activeElement, watch);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(stored(page), before);

  await page.open();
  page.$('demo-interrupt').click();
  page.$('demo-fresh').click();
  await waitFor(() => !page.$('demo-dialog').open, {
    timeoutMs: 30000,
    message: 'The accessible demonstrated level should arrive at ordinary Ready.',
  });
  page.frame(0);
  assert.equal(settings.open, false);
  assert.equal(home.open, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'ready');
  assert.equal(page.rendered.run.levelId, 'signal-01');
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.doc.activeElement, page.$('start-button'));
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('leaving a Journey demo restores exactly one truthful title action without saving', async (t) => {
  const page = await demoPage(t, { search: '' });
  const actionState = () => ['shell-featured', 'shell-continue'].map((id) => page.$(id).hidden);
  const beforeActions = actionState(),
    before = stored(page),
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  assert.equal(beforeActions.filter((hidden) => !hidden).length, 1);
  await page.open();
  page.$('demo-back').click();
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(actionState(), beforeActions);
  assert.deepEqual(stored(page), before);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('fresh start of an installed locked demonstrated level stays in isolated exact-level practice', async (t) => {
  const page = await demoPage(t, { clipId: 'crosswind-openings' });
  const ordinary = page.rendered.run,
    checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  await page.open();
  assert.equal(page.demoFrame.run.levelId, 'signal-03');
  const demonstratedLevel = page.demoFrame.run.level;
  page.$('demo-interrupt').click();
  page.$('demo-fresh').click();
  await settle(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  assert.equal(page.demoFrame.run.levelId, 'signal-03');
  assert.equal(page.demoFrame.run.tick, 0);
  assert.deepEqual(
    page.demoFrame.run.level,
    demonstratedLevel,
    'Fresh practice retains current demonstrated tuning',
  );
  assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
  demoKey(page, 'ArrowDown');
  demoKey(page, 'ArrowDown', false);
  frames(page, 12);
  assert.ok(page.demoFrame.run.tick > 0);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(stored(page), before);
  demoKey(page, 'Escape');
  demoKey(page, 'Escape', false);
  page.frame(0);
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(stored(page), before);
});

test('takeover reconstructs the shown board into practice without advancing the recorded or ordinary owners', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run;
  const ordinaryCheckpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  await page.open();
  frames(page, 35);
  page.$('demo-interrupt').click();
  page.frame(0);
  const recording = page.demoFrame.run,
    shown = cutFacts(recording),
    originalCheckpoint = authoritativeCheckpoint(recording);
  page.$('demo-takeover').click();
  await settle(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  assert.notEqual(page.demoFrame.run, recording);
  assert.deepEqual(cutFacts(page.demoFrame.run), shown);
  assert.deepEqual(authoritativeCheckpoint(recording), originalCheckpoint);
  frames(page, 6);
  assert.deepEqual(cutFacts(page.demoFrame.run), shown, 'takeover awaits a fresh steer');
  demoKey(page, 'ArrowDown');
  demoKey(page, 'ArrowDown', false);
  frames(page, 12);
  assert.ok(page.demoFrame.run.tick > shown.tick);
  assert.deepEqual(authoritativeCheckpoint(recording), originalCheckpoint);
  assert.deepEqual(authoritativeCheckpoint(ordinary), ordinaryCheckpoint);
  assert.deepEqual(stored(page), before);
  page.win.emit('blur');
  frames(page, 6);
  const paused = cutFacts(page.demoFrame.run);
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  frames(page, 6);
  assert.deepEqual(
    cutFacts(page.demoFrame.run),
    paused,
    'returning focus/input does not resume suspended practice',
  );
});

test('controller gameplay action takes over while preserving one hardware read per frame', async (t) => {
  const pad = {
    index: 0,
    id: 'Demo pad',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const page = await demoPage(t, { readPads: () => [pad] });
  const ordinary = page.rendered.run,
    checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  await page.open();
  frames(page, 2);
  const reads = page.padReads;
  pad.buttons[0].pressed = true;
  frames(page, 2);
  assert.equal(page.padReads - reads, 2);
  await settle(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  assert.equal(page.$('demo-actions').hidden, false);
  assert.equal(page.$('demo-dialog').open, true);
  assert.equal(page.$('demo-practice-controls').hidden, false);
  const tick = page.demoFrame.run.tick;
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  pad.buttons[0].pressed = false;
  frames(page, 2);
  assert.ok(
    page.demoFrame.run.tick > tick,
    'The initiating action starts the isolated practice clock.',
  );
  demoKey(page, 'Escape');
  demoKey(page, 'Escape', false);
  page.frame(16);
  assert.equal(page.$('demo-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(stored(page), before);
});

test('a single remaining source prepares a new painter on repetition without reusing disposed media', async (t) => {
  const page = await demoPage(t);
  await page.open();
  const canvas = page.$('demo-canvas');
  canvas.clientWidth = 1600;
  canvas.clientHeight = 300;
  page.frame(0);
  assert.equal(
    page.demoFrame.options.displayCSSWidth,
    Math.min(1600, (300 * canvas.width) / canvas.height),
    'Height-limited fullscreen scales readable game pieces to the contained board width.',
  );
  canvas.clientHeight = undefined;
  page.frame(0);
  assert.equal(
    page.demoFrame.options.displayCSSWidth,
    1600,
    'Missing height uses the width fallback.',
  );
  const firstPainter = page.demoFrame.painter;
  page.$('demo-interrupt').click();
  page.$('demo-next').click();
  await settle(() => {
    page.frame(0);
    return page.demoFrame.painter !== firstPainter;
  }, 'A repeated single source must adopt its new presentation owner');
  assert.equal(page.demoFrame.run.tick, 0);
  assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
});

test('unattended playback bounds a visible stall and automatically repeats completed scenes without opening a menu', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run,
    checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  await page.open();
  const initialTick = page.demoFrame.run.tick;
  page.frame(1000);
  assert.ok(page.demoFrame.run.tick > initialTick);
  assert.ok(
    page.demoFrame.run.tick - initialTick <= 30,
    'Each catch-up task advances at most 250ms.',
  );
  assert.equal(page.$('demo-actions').hidden, true);
  // Catch-up deliberately owns asynchronous tasks instead of RAF. Wait for its
  // admitted second to finish before a synchronous fixture loop advances the
  // fake wall clock again; a fixed real delay does not establish completion.
  await waitFor(() => page.demoFrame.run.tick === initialTick + 120, {
    message: 'The bounded one-second catch-up must finish without opening a menu.',
  });
  for (let scene = 0; scene < 3; scene++) {
    const painter = page.demoFrame.painter,
      completed = page.demoFrame.run;
    frames(page, 200, 250);
    await waitFor(
      () => {
        page.frame(0);
        return page.demoFrame.painter !== painter;
      },
      {
        timeoutMs: 30000,
        message: `A completed demo must rotate (scene ${scene}, status ${completed.status}, tick ${completed.tick}, caption ${page.$('demo-caption').textContent}).`,
      },
    );
    assert.ok(completed.tick > 0, 'Rotation follows an advanced real-core performance.');
    assert.ok(
      ['running', 'won', 'lost'].includes(completed.status),
      'A completed scene retains an ordinary core status.',
    );
    assert.notEqual(page.demoFrame.run, completed);
    assert.equal(page.$('demo-dialog').open, true);
    assert.equal(page.$('demo-actions').hidden, true);
    const tick = page.demoFrame.run.tick;
    frames(page, 2);
    assert.ok(page.demoFrame.run.tick > tick);
  }
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(stored(page), before);
});

test('fresh gameplay input on a completed demo starts exact-level practice without a confirmation menu', async (t) => {
  const page = await demoPage(t),
    ordinary = page.rendered.run,
    before = stored(page),
    checkpoint = authoritativeCheckpoint(ordinary);
  await page.open();
  for (let frame = 0; frame < 200 && page.demoFrame.run.status === 'running'; frame++)
    page.frame(250);
  const completed = page.demoFrame.run,
    completedCheckpoint = authoritativeCheckpoint(completed);
  assert.equal(completed.status, 'won');
  demoKey(page, 'ArrowDown');
  demoKey(page, 'ArrowDown', false);
  await settle(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  assert.notEqual(page.demoFrame.run, completed);
  assert.deepEqual(page.demoFrame.run.level, completed.level);
  assert.equal(page.demoFrame.run.tick, 0);
  frames(page, 2);
  assert.ok(page.demoFrame.run.tick > 0);
  assert.deepEqual(authoritativeCheckpoint(completed), completedCheckpoint);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(stored(page), before);
});

test('a replay fork completing after blur cannot arm hidden practice or replace its current owner', async (t) => {
  const page = await demoPage(t);
  await page.open();
  frames(page, 20);
  page.$('demo-interrupt').click();
  page.$('demo-takeover').click();
  page.doc.focused = false;
  page.win.emit('blur');
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(page.$('demo-practice-controls').hidden, true);
  page.doc.focused = true;
  page.win.emit('focus');
  page.frame(0);
  const tick = page.demoFrame.run.tick;
  frames(page, 8);
  assert.equal(page.demoFrame.run.tick, tick);
  assert.equal(page.$('demo-practice-controls').hidden, true);
});

for (const lifecycle of ['blur', 'hidden'])
  test(`locked Fresh handoff cancelled by ${lifecycle} remains paused until another explicit choice`, async (t) => {
    const page = await demoPage(t, { clipId: 'crosswind-openings' });
    const ordinary = page.rendered.run,
      before = stored(page),
      checkpoint = authoritativeCheckpoint(ordinary);
    await page.open();
    page.$('demo-interrupt').click();
    page.$('demo-fresh').click();
    if (lifecycle === 'blur') {
      page.doc.focused = false;
      page.win.emit('blur');
    } else {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(page.$('demo-practice-controls').hidden, true);
    page.doc.focused = true;
    page.doc.hidden = false;
    page.win.emit('focus');
    page.doc.emit('visibilitychange');
    page.frame(0);
    demoKey(page, 'ArrowDown');
    demoKey(page, 'ArrowDown', false);
    frames(page, 4);
    assert.equal(page.$('demo-practice-controls').hidden, true);
    assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
    assert.deepEqual(stored(page), before);
  });

test('a failed saved-flight write keeps Fresh behind replacement review and Stay retains the ordinary cut', async (t) => {
  const page = await demoPage(t);
  await startOrdinary(page);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  frames(page, 20);
  const ordinary = page.rendered.run;
  page.$('shell-menu').click();
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  await page.open();
  page.$('demo-interrupt').click();
  const originalSet = page.storage.setItem;
  t.mock.method(page.storage, 'setItem', function (key, value) {
    if (key === 'revealline.suspended.dev.v1') throw Error('Injected quota refusal');
    return originalSet.call(this, key, value);
  });
  page.$('demo-fresh').click();
  await waitFor(
    () =>
      page.$('mission-replace-dialog').open &&
      !page.$('mission-replace-confirm').disabled &&
      !page.$('demo-dialog').open,
    {
      timeoutMs: 30000,
      message: 'Failed-save handoff must remain behind the ordinary checked replacement review.',
    },
  );
  assert.equal(page.$('demo-dialog').open, false);
  assert.equal(page.$('demo-practice-controls').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(stored(page), before);
  page.$('mission-replace-stay').click();
  page.frame(0);
  assert.equal(page.$('shell-home').open, true);
  assert.equal(page.rendered.run, ordinary);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
});

test('accessible Fresh opens the demonstrated level at Ready and preserves the previous unfinished flight without rewards', async (t) => {
  const page = await demoPage(t);
  await startOrdinary(page);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  frames(page, 20);
  const ordinary = page.rendered.run;
  assert.equal(ordinary.player.cutting, true);
  page.$('shell-menu').click();
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(ordinary),
    beforeLibrary = loadLibrary(page.storage, 'revealline.library.dev.v1').library;
  await page.open();
  assert.equal(page.demoFrame.run.levelId, 'signal-01');
  page.$('demo-interrupt').click();
  page.$('demo-fresh').click();
  await waitFor(() => !page.$('demo-dialog').open, {
    timeoutMs: 30000,
    message: 'The exact mission lookup and checked replacement must settle.',
  }).catch((error) => {
    error.message += JSON.stringify({
      status: page.$('demo-status').textContent,
      availability: page.$('demo-availability').textContent,
      replace: page.$('mission-replace-dialog').open,
      replacement: page.$('mission-replace-status').textContent,
      errors: page.errors.map((value) => String(value?.stack ?? value)),
    });
    throw error;
  });
  assert.equal(page.$('mission-replace-dialog').open, true);
  assert.equal(page.rendered.run, ordinary, 'the existing checked replacement owns adoption');
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  await activate(page.$('mission-replace-confirm'));
  assert.equal(page.$('mission-replace-dialog').open, false);
  page.frame(0);
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'ready');
  assert.equal(page.doc.body.dataset.flightState, 'briefing');
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.levelId, 'signal-01');
  assert.equal(page.rendered.run.tick, 0);
  assert.notEqual(page.rendered.run, ordinary);
  assert.equal(page.doc.activeElement, page.$('start-button'));
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  const savedBytes = page.storage.getItem('revealline.suspended.dev.v1'),
    saved = JSON.parse(savedBytes),
    afterLibrary = loadLibrary(page.storage, 'revealline.library.dev.v1').library;
  assert.deepEqual(saved.replay.checkpoint, checkpoint);
  assert.equal(verifyReplay(saved.replay).match, true);
  for (const field of ['campaigns', 'gallery', 'scores', 'masteries'])
    assert.deepEqual(
      afterLibrary[field],
      beforeLibrary[field],
      `${field} cannot gain a demo reward`,
    );
  frames(page, 8);
  assert.equal(page.rendered.run.tick, 0, 'Fresh awaits the ordinary explicit Start action');
  assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), savedBytes);
  assert.deepEqual(page.errors, []);
});

test('demo control hints show the saved keyboard bindings in the actual app', async (t) => {
  const storage = memoryStorage();
  saveLibrary(
    storage,
    'revealline.library.dev.v1',
    updatePreferences(emptyLibrary(), { keyboardBindings: KEY_BINDING_PRESETS['right-hand'] }),
  );
  const page = await demoPage(t, { storage });
  await page.open();
  assert.match(page.$('demo-bound-controls').textContent, /Directions: I · K · J · L/);
  assert.match(page.$('demo-bound-controls').textContent, /Pause: P · Esc: back to home/);
  demoKey(page, 'KeyI');
  demoKey(page, 'KeyI', false);
  page.$('demo-takeover').click();
  await settle(() => !page.$('demo-practice-controls').hidden);
  assert.match(page.$('demo-bound-controls').textContent, /Directions: I · K · J · L/);
  assert.deepEqual(page.errors, []);
});

test('spectator information and play invitation stay visible while details remain optional', async (t) => {
  const page = await demoPage(t);
  await page.open();
  assert.equal(page.$('demo-panel').hidden, true);
  for (const id of ['demo-watch-pause', 'demo-next']) {
    assert.ok(page.$(id).closest('.demo-header-actions'), id);
    assert.ok(page.$(id).getAttribute('aria-label'), 'Transport retains localized names.');
  }
  assert.ok(page.$('demo-caption').closest('#demo-audience'));
  assert.ok(page.$('demo-now-playing').closest('#demo-audience'));
  assert.ok(page.$('demo-interrupt').closest('#demo-audience'));
  assert.match(page.$('demo-interrupt').textContent, /Want to play/);
  assert.match(page.$('demo-join-hint').textContent, /practice/);
  assert.equal(page.$('demo-guide-portrait').hidden, false);
  const run = page.demoFrame.run;
  page.$('demo-details-toggle').click();
  assert.equal(page.$('demo-panel').hidden, false);
  assert.equal(page.$('demo-dialog').dataset.details, 'open');
  assert.equal(page.doc.activeElement, page.$('demo-details-close'));
  assert.equal(page.$('demo-panel-status').textContent, page.$('demo-status').textContent);
  assert.equal(page.$('demo-panel-caption').textContent, page.$('demo-caption').textContent);
  assert.equal(page.$('demo-details-toggle').getAttribute('aria-expanded'), 'true');
  frames(page, 4);
  assert.equal(page.demoFrame.run, run, 'Opening details cannot take over or replace the run.');
  page.$('demo-details-close').click();
  assert.equal(page.$('demo-panel').hidden, true);
  assert.equal(page.doc.activeElement, page.$('demo-details-toggle'));
  page.$('demo-interrupt').click();
  assert.equal(page.$('demo-panel').hidden, false);
  assert.equal(page.$('demo-actions').hidden, false);
});

test('demo guide respects the shared character-reactions preference without hiding teaching captions', async (t) => {
  const storage = memoryStorage();
  storage.setItem(
    'revealline.journey-reactions.v1',
    JSON.stringify({ format: 'JourneyReactionPreferencesV1', enabled: false }),
  );
  const page = await demoPage(t, { storage });
  await page.open();
  assert.equal(page.$('demo-guide-portrait').hidden, true);
  assert.equal(page.$('demo-guide-label').hidden, true);
  assert.ok(page.$('demo-caption').textContent.length > 0);
  assert.equal(page.$('demo-audience').hidden, false);
});
