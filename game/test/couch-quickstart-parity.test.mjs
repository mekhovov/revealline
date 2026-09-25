import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

const pad = (index = 0) => ({
  index,
  id: `Quick-start pad ${index}`,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
});

function pulseTeam(f, button = 0) {
  f.pads[0].buttons[button].pressed = true;
  f.pads[0].buttons[button].value = 1;
  f.tick(1);
  f.pads[0].buttons[button].pressed = false;
  f.pads[0].buttons[button].value = 0;
  f.tick(1);
}

function nativeConfirm(target) {
  const down = target.emit('keydown', { key: 'Enter', code: 'Enter', repeat: false });
  if (!down.defaultPrevented && ['BUTTON', 'SUMMARY'].includes(target.tagName)) target.click();
  target.emit('keyup', { key: 'Enter', code: 'Enter' });
  return down;
}

test('Versus and Team keep tuning and imports in closed optional setup surfaces', async () => {
  const [versus, team] = await Promise.all([
    readFile(new URL('../couch/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8'),
  ]);
  assert.match(
    versus,
    /<details id="race-optional-setup"[^>]*>[\s\S]*id="race-actor-style"[\s\S]*id="race-journey-difficulty"[\s\S]*id="race-focus"/,
  );
  assert.match(
    team,
    /<details id="coop-optional-setup"[^>]*>[\s\S]*id="coop-experiment"[\s\S]*id="coop-difficulty"[\s\S]*id="coop-actor-style"[\s\S]*id="coop-pack-file"/,
  );
  assert.match(versus, /id="race-start"[^>]*>Start race/);
  assert.match(team, /id="coop-start"[^>]*>[\s\S]*Preparing arena/);
});

test('prepared Versus defaults need one assigned-controller Confirm and never route it to Cancel', async (t) => {
  const controller = pad();
  const f = await couchPage(t, { pads: [controller], initialLevel: null });
  assert.equal(f.doc.activeElement.id, 'race-start');
  assert.equal(f.$('race-optional-setup').open, false);
  assert.equal(f.$('race-actor-style').closest('details'), f.$('race-optional-setup'));
  f.join(0);
  assert.equal(f.doc.activeElement.id, 'race-start');
  f.pulse(0, 0);
  assert.equal(f.state(), 'running');
  assert.notEqual(f.doc.activeElement.id, 'race-picture-cancel');
});

test('Steam Deck Confirm opens Versus optional setup and starts exactly once despite its native echo', async (t) => {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const controller = pad();
  const f = await couchPage(t, {
    pads: [controller],
    initialLevel: null,
    nativeKeyboard: true,
  });
  f.join(0);
  time += 600;
  f.pulse(0, 13);
  assert.equal(f.doc.activeElement.id, 'race-chapters');
  f.pulse(0, 13);
  assert.equal(f.doc.activeElement.id, 'race-optional-setup-toggle');
  f.pulse(0, 0);
  assert.equal(f.$('race-optional-setup').open, true);
  time += 120;
  assert.equal(nativeConfirm(f.$('race-optional-setup-toggle')).defaultPrevented, true);
  assert.equal(f.$('race-optional-setup').open, true, 'native echo must not close setup');

  f.$('race-optional-setup-toggle').click();
  time += 600;
  f.focus('race-start');
  f.frame(); // Admit the changed menu scope only after a neutral sample.
  f.pulse(0, 0);
  assert.equal(f.state(), 'running');
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  assert.equal(f.state(), 'running', 'native echo must not trigger another start action');
});

test('prepared Team defaults need one assigned-controller Confirm and optional setup stays reachable', async (t) => {
  const f = await teamPage(t, { nativeFocus: true });
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-optional-setup').open, false);
  assert.equal(f.$('coop-difficulty').closest('details'), f.$('coop-optional-setup'));
  f.disclose('coop-optional-setup');
  f.$('coop-difficulty').focus();
  assert.equal(f.doc.activeElement.id, 'coop-difficulty');
  f.$('coop-optional-setup').open = false;
  f.pads.push(pad());
  f.tick(1);
  pulseTeam(f); // Assign this controller to the menu without starting.
  assert.equal(f.$('coop-play').hidden, true);
  f.$('coop-start').focus();
  pulseTeam(f);
  assert.equal(f.$('coop-play').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});

test('prepared Team Start remains visible after short-landscape layout settles', async (t) => {
  const f = await teamPage(t, {
    nativeFocus: true,
    beforeImport({ $, doc, win }) {
      Object.assign(win, { innerWidth: 844, innerHeight: 390 });
      doc.documentElement.clientWidth = 844;
      doc.documentElement.clientHeight = 390;
      $('coop-start')._rect = { x: 118, y: 457, width: 300, height: 44 };
    },
  });
  const start = f.$('coop-start');
  assert.equal(f.doc.activeElement, start);
  await waitFor(
    () => start.scrolled > 0,
    () => 'focused Start was not revealed',
  );
  assert.ok(start.scrolled > 0, 'settled preparation must reveal the focused primary action');
  assert.equal(f.doc.activeElement, start);
});

test('Steam Deck Confirm opens Team optional setup and starts exactly once despite its native echo', async (t) => {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const f = await teamPage(t, { nativeFocus: true });
  f.pads.push(pad());
  f.tick(1);
  pulseTeam(f); // Assign without activating the focused Start action.

  time += 600;
  f.$('coop-optional-setup-toggle').focus();
  pulseTeam(f);
  assert.equal(f.$('coop-optional-setup').open, true);
  time += 120;
  assert.equal(nativeConfirm(f.$('coop-optional-setup-toggle')).defaultPrevented, true);
  assert.equal(f.$('coop-optional-setup').open, true, 'native echo must not close setup');

  f.$('coop-optional-setup-toggle').click();
  time += 600;
  f.$('coop-start').focus();
  pulseTeam(f);
  assert.equal(f.$('coop-play').hidden, false);
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  assert.equal(f.$('coop-play').hidden, false, 'native echo must not trigger another start action');
});

test('passive Team preparation keeps stable lobby focus without exposing a Cancel trap', async (t) => {
  const gate = deferred();
  const f = await teamPage(t, {
    nativeFocus: true,
    waitPicture: false,
    presentation: { read: () => gate.promise },
  });
  assert.equal(f.doc.activeElement.id, 'coop-level');
  assert.equal(f.$('coop-picture-cancel').hidden, true);
  f.tap('Enter');
  assert.equal(f.$('coop-picture-status').dataset.state, 'preparing');
  gate.resolve();
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
  assert.equal(f.$('coop-picture-cancel').hidden, true);
  assert.equal(f.$('coop-play').hidden, true);
  f.$('coop-start').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-play').hidden, false);
});

test('Steam Deck Confirm echo cannot expose or activate Cancel during initial Team preparation', async (t) => {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const gate = deferred();
  const f = await teamPage(t, {
    nativeFocus: true,
    waitPicture: false,
    presentation: { read: () => gate.promise },
  });
  f.pads.push(pad());
  f.tick(1);
  pulseTeam(f);
  assert.equal(f.doc.activeElement.id, 'coop-level');
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  assert.equal(f.$('coop-picture-status').dataset.state, 'preparing');
  assert.equal(f.$('coop-picture-cancel').hidden, true);
  gate.resolve();
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
});
