import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

// Real Team host, navigation, simulation and authenticated originals. Native
// focus restoration, pointer activation and gamepads are finite input models;
// browser geometry, physical devices and decoded pixels remain separate evidence.
const yard = COOP_PICTURE_BINDINGS.find((row) => row.levelId === 'relay-yard');
assert.ok(yard);
const dialog = (f) => f.$('coop-discovery-dialog');
const status = (f) => f.$('coop-discovery-status');
const cards = (f) => [...f.$('coop-discovery-list').querySelectorAll('.team-discovery-play')];
function relayCard(f) {
  const button = cards(f).find((entry) => entry.textContent === 'Play Relay Yard');
  assert.ok(button);
  return button;
}

function nativeModalFocus() {
  const restorations = [],
    previous = new WeakMap();
  return {
    restorations,
    beforeImport({ $, doc }) {
      for (const id of ['coop-discovery-dialog', 'coop-discard-dialog']) {
        const modal = $(id),
          show = modal.showModal;
        modal.showModal = () => {
          if (!modal.open) previous.set(modal, doc.activeElement);
          show();
        };
        modal.close = () => {
          if (!modal.open) return;
          const origin = previous.get(modal);
          modal.open = false;
          modal.hidden = true;
          modal.removeAttribute('open');
          if (modal.contains(doc.activeElement)) doc.body.focus();
          // The native previously-focused-element step precedes the host's
          // close listener. Existing nativeFocus modeling rejects hidden or
          // disabled origins; this local model does not bypass those guards.
          if (!doc.hidden && doc.hasFocus() && origin?.isConnected) origin.focus();
          restorations.push({ dialog: id, previous: origin, restored: doc.activeElement });
          modal.emit('close', { bubbles: false });
        };
      }
    },
  };
}

async function fixture(t, extra = {}) {
  const native = nativeModalFocus();
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    stablePaintImages: true,
    ...extra,
    beforeImport: native.beforeImport,
  });
  return Object.assign(f, { restorations: native.restorations });
}

function pointerClick(button, pointerType = 'mouse') {
  assert.ok(button.isConnected);
  assert.equal(button.disabled, false);
  assert.equal(button.closest('[hidden],[inert]'), null);
  button.emit('pointerdown', { pointerId: 1, pointerType, button: 0 });
  if (pointerType === 'mouse') button.focus();
  button.emit('pointerup', { pointerId: 1, pointerType, button: 0 });
  button.click();
}

function startAndPause(f) {
  pointerClick(f.$('coop-start'));
  f.tick(2);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(65);
  pointerClick(f.$('coop-pause'));
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
}

function heldAttempt(f) {
  return {
    hud: [
      'coop-stage',
      'coop-clock',
      'coop-coverage',
      'coop-reserves',
      'coop-objective',
      'coop-state-0',
      'coop-state-1',
      'coop-charge-0',
      'coop-charge-1',
      'coop-support-0',
      'coop-support-1',
    ].map((id) => [id, f.$(id).textContent]),
    progress: f.$('coop-progress').value,
    picture: f.drawImages.at(-1),
    paint: f.lastPaint,
  };
}

function joinedController(f) {
  const pad = {
    index: 0,
    id: 'Team discovery input fixture',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  const press = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick(2);
  };
  const seek = (predicate, label) => {
    for (let i = 0; i < 40 && !predicate(f.doc.activeElement); i++) press(13);
    assert.ok(predicate(f.doc.activeElement), `${label} is controller-reachable.`);
  };
  f.tick(2);
  press(0); // Initial adoption/release must not activate or resume a Team attempt.
  return { pad, press, seek };
}
const ready = (f) =>
  waitFor(
    () => status(f).dataset.state === 'ready',
    () => status(f).textContent,
  );
const runningYard = (f) =>
  waitFor(
    () => !dialog(f).open && f.$('coop-stage').textContent === 'RELAY YARD',
    () => status(f).textContent,
  );

test('pointer Play survives native discovery opener restoration and finishes focused on the new Team board', async (t) => {
  const f = await fixture(t);
  pointerClick(f.$('coop-discovery-open'));
  assert.equal(dialog(f).open, true);
  pointerClick(relayCard(f), 'touch');
  await runningYard(f);
  const closed = f.restorations.find((entry) => entry.dialog === 'coop-discovery-dialog');
  assert.ok(closed);
  assert.equal(closed.previous, f.$('coop-discovery-open'));
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.drawImages.at(-1).sha256, yard.picture.sha256);
  assert.deepEqual(f.visits, []);
});

test('pointer Stay returns through outer Cancel; a separate Replace starts once with native focus restoration enabled', async (t) => {
  const f = await fixture(t);
  startAndPause(f);
  const before = heldAttempt(f);
  pointerClick(f.$('coop-discovery-paused'));
  pointerClick(relayCard(f), 'touch');
  await waitFor(() => f.$('coop-discard-dialog').open);
  pointerClick(f.$('coop-discard-stay'));
  await ready(f);
  const stay = f.restorations.find((entry) => entry.dialog === 'coop-discard-dialog');
  assert.ok(stay);
  assert.equal(stay.previous, f.$('coop-discovery-cancel'));
  assert.equal(stay.restored, f.$('coop-discovery-cancel'));
  assert.equal(dialog(f).open, true);
  assert.equal(f.doc.activeElement, relayCard(f));
  f.tick(30);
  assert.deepEqual(heldAttempt(f), before);
  assert.equal(f.$('coop-overlay').hidden, false);

  pointerClick(relayCard(f), 'touch');
  await waitFor(() => f.$('coop-discard-dialog').open);
  pointerClick(f.$('coop-discard-confirm'));
  await runningYard(f);
  assert.equal(f.restorations.filter((entry) => entry.dialog === 'coop-discard-dialog').length, 2);
  assert.equal(
    f.restorations.filter((entry) => entry.dialog === 'coop-discovery-dialog').length,
    1,
  );
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.drawImages.at(-1).sha256, yard.picture.sha256);
  assert.deepEqual(f.visits, []);
});

test('joined controller traverses Team arenas and Back while preserving the paused attempt and exact opener', async (t) => {
  const f = await fixture(t);
  startAndPause(f);
  const before = heldAttempt(f),
    controls = joinedController(f);
  assert.equal(f.$('coop-overlay').hidden, false);
  controls.seek((element) => element.id === 'coop-discovery-paused', 'Browse Team arenas');
  controls.press(0);
  assert.equal(dialog(f).open, true);
  assert.equal(f.doc.activeElement, cards(f)[0]);
  controls.seek((element) => element === relayCard(f), 'Relay Yard Play');
  assert.equal(f.doc.activeElement, relayCard(f));
  controls.press(1);
  assert.equal(dialog(f).open, false);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  f.tick(75);
  assert.deepEqual(heldAttempt(f), before);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.deepEqual(f.visits, []);
});

test('controller disconnect cancels held destination decoding and reconnect still requires explicit Resume', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  let decoding = false;
  const f = await fixture(t, {
    presentation: {
      decode: async ({ image }) => {
        if (image.sha256 === yard.picture.sha256) {
          decoding = true;
          await gate.promise;
        }
      },
    },
  });
  startAndPause(f);
  const before = heldAttempt(f),
    controls = joinedController(f);
  controls.seek((element) => element.id === 'coop-discovery-paused', 'Browse Team arenas');
  controls.press(0);
  controls.seek((element) => element === relayCard(f), 'Relay Yard Play');
  controls.press(0);
  await waitFor(() => decoding);
  assert.equal(status(f).dataset.state, 'busy');
  controls.pad.connected = false;
  f.tick(2);
  await ready(f);
  assert.match(status(f).textContent, /cancelled/i);
  assert.equal(f.$('coop-discovery-cancel').hidden, true);
  assert.equal(relayCard(f).disabled, false);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.deepEqual(heldAttempt(f), before);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dialog(f).open, true);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.deepEqual(heldAttempt(f), before);

  controls.pad.connected = true;
  f.tick(2);
  controls.press(0);
  assert.equal(dialog(f).open, true);
  assert.equal(status(f).dataset.state, 'ready', 'Rejoining must not replay the prior Play input.');
  controls.press(1);
  assert.equal(dialog(f).open, false);
  assert.equal(f.$('coop-overlay').hidden, false);
  f.tick(30);
  assert.deepEqual(heldAttempt(f), before);
  controls.seek((element) => element.id === 'coop-resume', 'Resume');
  controls.press(0);
  f.tick(65);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.notEqual(f.$('coop-clock').textContent, before.hud.find(([id]) => id === 'coop-clock')[1]);
  assert.equal(f.drawImages.at(-1), before.picture);
  assert.deepEqual(f.visits, []);
});
