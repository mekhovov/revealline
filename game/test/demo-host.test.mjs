import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey, demoPointer } from './helpers/demo-host-fixture.mjs';
import { memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, loadLibrary, saveLibrary, updatePreferences } from '../library.mjs';
import { KEY_BINDING_PRESETS } from '../key-bindings.mjs';

const frames = (page, count, ms = 16) => {
  for (let i = 0; i < count; i++) page.frame(ms);
};
const stored = (page) => [...page.storage.map];
const cutFacts = (run) => ({
  tick: run.tick,
  player: { x: run.player.x, y: run.player.y },
  cells: [...run.cells],
  lives: run.lives,
  score: run.score,
});

for (const input of ['keyboard', 'touch'])
  test(`${input}: actual demo preserves ordinary cut/save and consumes the interruption gesture`, async (t) => {
    const page = await demoPage(t);
    page.$('shell-play').click();
    page.$('shell-briefing').click();
    page.$('start-button').click();
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
    if (input === 'keyboard') {
      demoKey(page, 'ArrowRight');
      demoKey(page, 'ArrowRight', true, { repeat: true });
      demoKey(page, 'ArrowRight', false);
    } else {
      demoPointer(page.$('demo-canvas'), 'pointerdown');
      demoPointer(page.$('demo-canvas'), 'pointerup');
      demoPointer(page.$('demo-fresh'), 'click');
    }
    page.frame(0);
    const stopped = page.demoFrame.run.tick;
    assert.equal(page.$('demo-actions').hidden, false);
    assert.equal(page.$('demo-practice-controls').hidden, true);
    assert.equal(page.$('demo-dialog').open, true);
    frames(page, 12);
    assert.equal(page.demoFrame.run.tick, stopped);
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

test('fresh start of an installed locked demonstrated level stays in isolated exact-level practice', async (t) => {
  const page = await demoPage(t, { clipId: 'crosswind-openings' });
  const ordinary = page.rendered.run,
    checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  await page.open();
  assert.equal(page.demoFrame.run.levelId, 'signal-03');
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  page.$('demo-fresh').click();
  await settle(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  assert.equal(page.demoFrame.run.levelId, 'signal-03');
  assert.equal(page.demoFrame.run.tick, 0);
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
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
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

test('controller first Confirm interrupts without selecting Fresh and one hardware read remains owned by each frame', async (t) => {
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
  assert.equal(page.$('demo-actions').hidden, false);
  assert.equal(page.$('demo-dialog').open, true);
  assert.equal(page.$('demo-practice-controls').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  pad.buttons[0].pressed = false;
  frames(page, 2);
  pad.buttons[1].pressed = true;
  page.frame(16);
  assert.equal(page.$('demo-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(stored(page), before);
});

test('a single remaining source prepares a new painter on repetition without reusing disposed media', async (t) => {
  const page = await demoPage(t);
  await page.open();
  const firstPainter = page.demoFrame.painter;
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  page.$('demo-next').click();
  await settle(() => {
    page.frame(0);
    return page.demoFrame.painter !== firstPainter;
  }, 'A repeated single source must adopt its new presentation owner');
  assert.equal(page.demoFrame.run.tick, 0);
  assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
});

test('a replay fork completing after blur cannot arm hidden practice or replace its current owner', async (t) => {
  const page = await demoPage(t);
  await page.open();
  frames(page, 20);
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
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
    demoKey(page, 'ArrowRight');
    demoKey(page, 'ArrowRight', false);
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

test('a failed saved-flight write blocks Fresh campaign handoff and retains the current ordinary cut', async (t) => {
  const page = await demoPage(t);
  page.$('shell-play').click();
  page.$('shell-briefing').click();
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  frames(page, 20);
  const ordinary = page.rendered.run;
  page.$('shell-menu').click();
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(ordinary),
    before = stored(page);
  await page.open();
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  const originalSet = page.storage.setItem;
  t.mock.method(page.storage, 'setItem', function (key, value) {
    if (key === 'revealline.suspended.dev.v1') throw Error('Injected quota refusal');
    return originalSet.call(this, key, value);
  });
  page.$('demo-fresh').click();
  await settle(() => !page.$('demo-fresh').disabled);
  assert.equal(page.$('demo-dialog').open, true);
  assert.equal(page.$('demo-practice-controls').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(stored(page), before);
  demoKey(page, 'Escape');
  demoKey(page, 'Escape', false);
  page.frame(0);
  assert.equal(page.rendered.run, ordinary);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
});

test('accessible Fresh opens the demonstrated level at Ready and preserves the previous unfinished flight without rewards', async (t) => {
  const page = await demoPage(t);
  page.$('shell-play').click();
  page.$('shell-briefing').click();
  page.$('start-button').click();
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
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  page.$('demo-fresh').click();
  await settle(() => !page.$('demo-dialog').open);
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
