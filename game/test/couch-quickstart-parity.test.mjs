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

test('Versus and Team retain tuning and import controls for the shared Settings surface', async () => {
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
    /<details id="coop-optional-setup"[^>]*>[\s\S]*id="coop-level"[\s\S]*id="coop-experiment"[\s\S]*id="coop-difficulty"[\s\S]*id="coop-actor-style"[\s\S]*id="coop-pack-file"/,
  );
  assert.match(versus, /id="race-start"[^>]*>\s*Start race/);
  assert.match(team, /id="coop-start"[^>]*>[\s\S]*Preparing arena/);
});

test('prepared Versus defaults need one assigned-controller Confirm and never route it to Cancel', async (t) => {
  const controller = pad();
  const f = await couchPage(t, { pads: [controller], initialLevel: null });
  assert.equal(f.doc.activeElement.id, 'race-start');
  assert.equal(f.$('race-options-panel').hidden, true);
  assert.equal(
    f.$('race-optional-setup').closest('[role="tabpanel"]'),
    f.$('race-settings-panel-gameplay'),
  );
  assert.equal(f.$('race-actor-style').closest('details'), f.$('race-optional-setup'));
  f.join(0);
  assert.equal(f.doc.activeElement.id, 'race-start');
  f.pulse(0, 0);
  await waitFor(() => f.state() === 'running');
  assert.notEqual(f.doc.activeElement.id, 'race-picture-cancel');
});

test('Steam Deck Confirm opens Versus Settings and starts exactly once despite its native echo', async (t) => {
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
  assert.equal(f.doc.activeElement.id, 'race-options');
  f.pulse(0, 0);
  assert.equal(f.$('race-options-panel').hidden, false);
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  assert.equal(f.$('race-options-panel').hidden, false, 'native echo must not leave Settings');
  f.$('race-settings-tab-gameplay').click();
  assert.equal(f.$('race-settings-panel-gameplay').hidden, false);
  assert.equal(
    f.$('race-actor-style').closest('[role="tabpanel"]'),
    f.$('race-settings-panel-gameplay'),
  );
  assert.equal(f.state(), 'ready');

  f.$('race-options-back').click();
  assert.equal(f.$('race-options-panel').hidden, true);
  time += 600;
  f.focus('race-start');
  f.frame(); // Admit the changed menu scope only after a neutral sample.
  f.pulse(0, 0);
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  await waitFor(() => f.state() === 'running');
  assert.equal(f.state(), 'running', 'native echo must not trigger another start action');
});

test('prepared Team defaults need one assigned-controller Confirm and gameplay Settings stay reachable', async (t) => {
  const f = await teamPage(t, { nativeFocus: true });
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.$('coop-level').closest('[role="tabpanel"]'), f.$('coop-settings-panel-gameplay'));
  assert.equal(
    f.$('coop-difficulty').closest('[role="tabpanel"]'),
    f.$('coop-settings-panel-gameplay'),
  );
  f.$('coop-settings-open').click();
  assert.equal(f.$('coop-options').open, true);
  f.$('coop-settings-tab-gameplay').click();
  assert.equal(f.$('coop-settings-panel-gameplay').hidden, false);
  f.$('coop-difficulty').focus();
  assert.equal(f.doc.activeElement.id, 'coop-difficulty');
  f.$('coop-settings-close').click();
  assert.equal(f.$('coop-options').open, false);
  f.pads.push(pad());
  f.tick(1);
  pulseTeam(f); // Assign this controller to the menu without starting.
  assert.equal(f.$('coop-play').hidden, true);
  f.$('coop-start').focus();
  pulseTeam(f);
  assert.equal(f.$('coop-play').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});

test('Team pointer quick start keeps arena selection inside gameplay Settings', async (t) => {
  const f = await teamPage(t, { nativeFocus: true });
  const options = f.$('coop-options');
  assert.equal(options.open, false);
  assert.equal(f.$('coop-level').closest('[role="tabpanel"]'), f.$('coop-settings-panel-gameplay'));
  f.$('coop-settings-open').emit('pointerdown', {
    pointerType: 'touch',
    button: 0,
    isPrimary: true,
  });
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-gameplay').click();
  assert.equal(f.$('coop-settings-panel-gameplay').hidden, false);
  await f.choose('coop-level', 'relay-yard');
  assert.equal(options.open, true);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-start').disabled, false);
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

test('Steam Deck Confirm opens Team Settings and starts exactly once despite its native echo', async (t) => {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const f = await teamPage(t, { nativeFocus: true });
  f.pads.push(pad());
  f.tick(1);
  pulseTeam(f); // Assign without activating the focused Start action.

  time += 600;
  f.$('coop-settings-open').focus();
  pulseTeam(f);
  assert.equal(f.$('coop-options').open, true);
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  assert.equal(f.$('coop-options').open, true, 'native echo must not close Settings');
  f.$('coop-settings-tab-gameplay').click();
  assert.equal(f.$('coop-settings-panel-gameplay').hidden, false);

  f.$('coop-settings-close').click();
  assert.equal(f.$('coop-options').open, false);
  time += 600;
  f.$('coop-start').focus();
  f.tick(1); // A neutral sample admits the return from the Settings scope.
  pulseTeam(f);
  assert.equal(f.$('coop-play').hidden, false);
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  assert.equal(f.$('coop-play').hidden, false, 'native echo must not trigger another start action');
});

test('passive Team preparation exposes Cancel without focusing or activating it', async (t) => {
  const gate = deferred();
  const f = await teamPage(t, {
    nativeFocus: true,
    waitPicture: false,
    presentation: { read: () => gate.promise },
  });
  assert.equal(f.doc.activeElement, f.doc.body);
  assert.equal(f.$('coop-picture-cancel').hidden, false);
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

test('Steam Deck Confirm echo cannot activate Cancel during initial Team picture preparation', async (t) => {
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
  assert.equal(f.doc.activeElement.id, 'coop-home');
  assert.equal(f.$('coop-options').open, false);
  assert.notEqual(f.doc.activeElement.id, 'coop-picture-cancel');
  time += 120;
  assert.equal(nativeConfirm(f.doc.activeElement).defaultPrevented, true);
  assert.equal(f.$('coop-picture-status').dataset.state, 'preparing');
  assert.equal(f.$('coop-picture-cancel').hidden, false);
  gate.resolve();
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
});
