import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';

const pad = () => ({
  index: 5,
  id: 'Team terminal test pad',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
const touch = (target, type, pointerId) =>
  target.emit(type, {
    button: 0,
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 32,
    clientY: 32,
  });
const result = (f) => ({
  clock: f.$('coop-clock').textContent,
  coverage: f.$('coop-coverage').textContent,
  reserves: f.$('coop-reserves').textContent,
  title: f.$('coop-overlay-title').textContent,
  copy: f.$('coop-overlay-copy').textContent,
  reads: f.artwork.calls.reads.length,
});

async function lose(t, { beforeTerminal = () => {} } = {}) {
  const source = createTeamOpeningCandidates();
  source.maps[0].foundations = [];
  source.maps[0].spawns = [
    { id: 'west', x: 0.5, y: 18.5 },
    { id: 'east', x: 71.5, y: 18.5 },
  ];
  source.missions[0].actors = [];
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    touch: true,
  });
  await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-landings', 'expert')));
  f.$('coop-start').click();
  f.tick(3);
  f.startingReserves = Number.parseInt(f.$('coop-reserves').textContent, 10);
  const loop = (holdFinal = false) => {
    for (const [a, b, ticks] of [
      ['KeyD', 'ArrowLeft', 30],
      ['KeyW', 'ArrowUp', 15],
      ['KeyD', 'ArrowLeft', 15],
      ['KeyS', 'ArrowDown', 15],
      ['KeyA', 'ArrowRight', 15],
    ]) {
      const steer = holdFinal && a === 'KeyA' ? f.press : f.tap;
      steer(a);
      steer(b);
      f.tick(ticks);
    }
  };
  loop();
  assert.equal(f.$('coop-overlay').hidden, true, 'ordinary reserve recovery stays in play');
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  beforeTerminal(f);
  loop(true);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  assert.match(f.$('coop-overlay-copy').textContent, /unfinished line crossed itself/);
  return f;
}

test('Team terminal failure waits indefinitely, then fresh Retry preserves setup and accepted art', async (t) => {
  const f = await lose(t),
    ended = result(f),
    setup = {
      level: f.$('coop-level').value,
      difficulty: f.$('coop-difficulty').value,
      experiment: f.$('coop-experiment').value,
      stage: f.$('coop-stage').textContent,
    };
  f.tick(180);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.deepEqual(result(f), ended);
  assert.doesNotMatch(f.$('coop-overlay-copy').textContent, /starts shortly/);
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.deepEqual(
    {
      level: f.$('coop-level').value,
      difficulty: f.$('coop-difficulty').value,
      experiment: f.$('coop-experiment').value,
      stage: f.$('coop-stage').textContent,
    },
    setup,
  );
  assert.equal(
    f.$('coop-reserves').textContent,
    `${f.startingReserves} reserve${f.startingReserves === 1 ? '' : 's'}`,
  );
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.equal(f.artwork.calls.reads.length, ended.reads);
  f.tick(90);
  assert.equal(f.$('coop-state-0').textContent, 'On reclaimed ground');
  assert.equal(f.$('coop-state-1').textContent, 'On reclaimed ground');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
});

test('keyboard action held across terminal failure cannot Retry until release and a fresh press', async (t) => {
  const f = await lose(t, { beforeTerminal: (host) => host.press('Enter') }),
    ended = result(f);
  const repeated = f.doc.activeElement.emit('keydown', {
    key: 'Enter',
    code: 'Enter',
    repeat: true,
  });
  assert.equal(repeated.defaultPrevented, true);
  f.tick(90);
  assert.deepEqual(result(f), ended);
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
});

test('controller Confirm held across terminal failure cannot Retry; a fresh Confirm can', async (t) => {
  let controller;
  const f = await lose(t, {
      beforeTerminal(host) {
        controller = pad();
        host.pads.push(controller);
        host.tick(2);
        controller.buttons[0] = { pressed: true, value: 1 };
        host.tick();
      },
    }),
    ended = result(f);
  f.tick(90);
  assert.deepEqual(result(f), ended);
  controller.buttons[0] = { pressed: false, value: 0 };
  f.tick(2);
  controller.buttons[0] = { pressed: true, value: 1 };
  f.tick();
  assert.equal(f.$('coop-overlay').hidden, true);
});

test('touch held across terminal failure cannot release into Retry; a fresh touch can', async (t) => {
  const f = await lose(t, {
      beforeTerminal: (host) => touch(host.$('coop-canvas'), 'pointerdown', 7),
    }),
    ended = result(f);
  assert.equal(touch(f.$('coop-retry'), 'pointerup', 7).defaultPrevented, true);
  assert.equal(f.$('coop-retry').emit('click', { button: 0 }).defaultPrevented, true);
  assert.deepEqual(result(f), ended);
  assert.equal(touch(f.$('coop-retry'), 'pointerdown', 8).defaultPrevented, false);
  assert.equal(touch(f.$('coop-retry'), 'pointerup', 8).defaultPrevented, false);
  assert.equal(f.$('coop-retry').emit('click', { button: 0 }).defaultPrevented, false);
  assert.equal(f.$('coop-overlay').hidden, true);
});

test('terminal result and accepted picture survive blur, hidden and persisted page lifecycle', async (t) => {
  const f = await lose(t),
    ended = result(f);
  f.win.emit('blur');
  f.win.emit('focus');
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  f.win.emit('pagehide', { persisted: true });
  f.win.emit('pageshow');
  f.tick(150);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.deepEqual(result(f), ended);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
});

test('deliberate Team Retry stops safely after a painter failure instead of looping', async (t) => {
  const f = await lose(t),
    errors = [];
  t.mock.method(console, 'error', (error) => errors.push(error));
  f.failNextPaint();
  f.$('coop-retry').click();
  assert.equal(f.$('coop-overlay-title').textContent, 'The arena needs a fresh start');
  assert.equal(f.$('coop-overlay').hidden, false);
  const stopped = result(f);
  f.win.emit('blur');
  f.win.emit('focus');
  f.tick(150);
  assert.deepEqual(result(f), stopped);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Modeled Canvas paint failure/);
});
