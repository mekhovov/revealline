import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { setLocale } from '../i18n/index.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const pad = (index = 0) => ({
  index,
  id: `Standard pad ${index}`,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
});

const startCue = async (page) => {
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  page.frame(0);
};

test('Versus starts over prepared boards without advancing either simulation before Go', async (t) => {
  const page = await couchPage(t);
  assert.equal(page.$('race-start-cue').hidden, true);
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);

  assert.equal(page.$('race-start-cue-label').textContent, '3');
  assert.equal(page.tick(), 0);
  page.frame(0);
  page.frame(699);
  assert.equal(page.$('race-start-cue-label').textContent, '3');
  assert.deepEqual(page.ticks(), [0, 0]);
  assert.equal(page.$('race-clock').textContent, '0:30');
  page.frame(1);
  assert.equal(page.$('race-start-cue-label').textContent, '2');
  assert.deepEqual(page.ticks(), [0, 0]);
  assert.equal(page.$('race-clock').textContent, '0:30');
  page.frame(700);
  assert.equal(page.$('race-start-cue-label').textContent, '1');
  assert.deepEqual(page.ticks(), [0, 0]);
  assert.equal(page.$('race-clock').textContent, '0:30');
  page.frame(700);
  assert.equal(page.$('race-start-cue-label').textContent, 'GO');
  assert.deepEqual(page.ticks(), [0, 0], 'Go releases play without spending hidden time');
  assert.equal(page.$('race-clock').textContent, '0:30');
  page.frame(1000 / 120);
  assert.deepEqual(page.ticks(), [1, 1]);
  page.frames(119, 1000 / 120);
  assert.deepEqual(page.ticks(), [120, 120]);
  assert.equal(page.$('race-clock').textContent, '0:29');
});

test('Versus Retry uses the short cue and held launch input cannot advance the replacement', async (t) => {
  const page = await couchPage(t);
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  await page.settleStartCue();
  page.frame();
  assert.ok(page.tick() > 0);

  page.$('race-pause').click();
  page.frame(0);
  assert.equal(page.state(), 'paused');
  page.$('race-retry').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  assert.equal(page.$('race-start-cue').dataset.kind, 'retry');
  assert.equal(page.$('race-start-cue-label').textContent, 'READY');
  page.frame(0);
  assert.deepEqual(page.ticks(), [0, 0]);
  assert.equal(page.$('race-clock').textContent, '0:30');

  // A second activation while the cue owns the boards cannot create or advance a race.
  page.$('race-retry').click();
  page.frame(599);
  assert.equal(page.$('race-start-cue-label').textContent, 'READY');
  assert.deepEqual(page.ticks(), [0, 0]);
  assert.equal(page.$('race-clock').textContent, '0:30');
  page.frame(1);
  assert.equal(page.$('race-start-cue-label').textContent, 'GO');
  assert.deepEqual(page.ticks(), [0, 0]);
  page.frame(1000 / 120);
  assert.deepEqual(page.ticks(), [1, 1]);
});

test('start cue is an atomic localized status with reduced-effects timing parity', async (t) => {
  t.after(() => setLocale('en'));
  const page = await couchPage(t);
  page.$('race-reduced').checked = true;
  page.$('race-reduced').emit('change');
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);

  const cue = page.$('race-start-cue');
  assert.equal(cue.getAttribute('role'), 'status');
  assert.equal(cue.getAttribute('aria-live'), 'polite');
  assert.equal(cue.getAttribute('aria-atomic'), 'true');
  assert.equal(page.doc.body.dataset.effects, 'reduced');
  page.frame(0);
  page.frame(2100);
  assert.equal(page.$('race-start-cue-label').textContent, 'GO');
  assert.deepEqual(page.ticks(), [0, 0]);
  setLocale('uk');
  page.frame(0);
  assert.equal(page.$('race-start-cue-label').textContent, 'РУШ');
  assert.deepEqual(page.ticks(), [0, 0]);
});

test('a keyboard direction held through Go is discarded until a fresh press', async (t) => {
  const page = await couchPage(t);
  await startCue(page);
  const x = page.renders[0].player.x;
  page.key('KeyD');
  page.frame(2100);
  page.frames(20);
  assert.equal(page.renders[0].player.x, x);

  page.key('KeyD', false);
  page.key('KeyD');
  page.frames(20);
  assert.ok(page.renders[0].player.x > x);
  page.key('KeyD', false);
});

test('a controller direction held through Go stays blocked until neutral and a fresh press', async (t) => {
  const device = pad();
  const page = await couchPage(t, { pads: [device] });
  await startCue(page);
  const x = page.renders[0].player.x;
  device.axes[0] = 1;
  page.frame(100);
  page.frame(2000);
  page.frames(20);
  assert.equal(page.renders[0].player.x, x);

  device.axes[0] = 0;
  page.frame();
  device.axes[0] = 1;
  page.frames(20);
  assert.ok(page.renders[0].player.x > x);
});

test('a touch direction held through Go is retired until a fresh contact', async (t) => {
  const page = await couchPage(t);
  page.$('race-touch-0').value = 'always';
  page.$('race-touch-0').emit('change');
  const surface = page.doc.querySelector('.race-pad').querySelector('.touch-surface');
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 156, height: 156 });
  await startCue(page);
  const x = page.renders[0].player.x;
  surface.emit('pointerdown', {
    pointerId: 41,
    pointerType: 'touch',
    button: 0,
    clientX: 78,
    clientY: 78,
  });
  surface.emit('pointermove', {
    pointerId: 41,
    pointerType: 'touch',
    clientX: 130,
    clientY: 78,
  });
  page.frame(2100);
  page.frames(20);
  assert.equal(page.renders[0].player.x, x);

  surface.emit('pointerup', { pointerId: 41, pointerType: 'touch' });
  surface.emit('pointerdown', {
    pointerId: 42,
    pointerType: 'touch',
    button: 0,
    clientX: 78,
    clientY: 78,
  });
  surface.emit('pointermove', {
    pointerId: 42,
    pointerType: 'touch',
    clientX: 130,
    clientY: 78,
  });
  page.frames(20);
  assert.ok(page.renders[0].player.x > x);
  surface.emit('pointerup', { pointerId: 42, pointerType: 'touch' });
});

for (const interruption of ['Pause', 'blur', 'hidden', 'persisted pagehide'])
  test(`${interruption} pauses an active cue and Resume restarts its full recipe`, async (t) => {
    const page = await couchPage(t);
    await startCue(page);
    page.frame(700);
    assert.equal(page.$('race-start-cue-label').textContent, '2');
    if (interruption === 'Pause') page.$('race-pause').click();
    else if (interruption === 'blur') page.win.emit('blur');
    else if (interruption === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    } else page.win.emit('pagehide', { persisted: true });
    assert.equal(page.$('race-start-cue').hidden, true);
    page.frame(0);
    assert.equal(page.state(), 'paused');
    assert.deepEqual(page.ticks(), [0, 0]);

    page.doc.hidden = false;
    page.$('race-start').click();
    await waitFor(() => !page.$('race-start-cue').hidden);
    assert.equal(page.$('race-start-cue').dataset.kind, 'mission');
    assert.equal(page.$('race-start-cue-label').textContent, '3');
    page.frame(0);
    page.frame(699);
    assert.equal(page.$('race-start-cue-label').textContent, '3');
    assert.deepEqual(page.ticks(), [0, 0]);
  });

test('assigned controller disconnect pauses and retires an active cue', async (t) => {
  const device = pad();
  const page = await couchPage(t, { pads: [device] });
  await startCue(page);
  page.win.emit('gamepaddisconnected', { gamepad: device });
  assert.equal(page.$('race-start-cue').hidden, true);
  page.frame(0);
  assert.equal(page.state(), 'paused');
  assert.deepEqual(page.ticks(), [0, 0]);
});

test('non-persisted pagehide cancels the cue and its RAF owner', async (t) => {
  const page = await couchPage(t);
  await startCue(page);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(page.$('race-start-cue').hidden, true);
  assert.equal(page.pendingFrames(), 0);
});
