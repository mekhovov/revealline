import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

// Actual Team markup, native-menu relocation, host, input and picture ownership.
// Transport, image decode, layout and focus defaults use the finite host fixture.
const options = { nativeFocus: true, nativeVisibility: true, waitPicture: false };
const state = (f) => f.$('coop-picture-status').dataset.state;
const settle = (f, expected) =>
  waitFor(
    () => state(f) === expected,
    () => f.$('coop-picture-status').textContent,
  );
const flush = () => new Promise((resolve) => setImmediate(resolve));

function assertLandingRecovery(f, action) {
  const section = f.$('coop-picture-preparation');
  assert.equal(f.$('coop-menu').classList.contains('native-landing'), true);
  assert.equal(section.parentNode, f.$('coop-menu').querySelector('.native-menu-actions'));
  assert.equal(f.$('coop-picture-status').closest('[hidden],[inert]'), null);
  assert.equal(f.$(action).closest('[hidden],[inert]'), null);
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-play').hidden, true);
}

function openExtras(f) {
  f.$('coop-settings-open').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-options').open, true);
  f.$('coop-settings-tab-extras').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-settings-panel-extras').hidden, false);
}

test('blur-cancelled Team preparation exposes the original landing Retry and fences stale readiness until deliberate recovery', async (t) => {
  const first = deferred(),
    retry = deferred();
  t.after(() => {
    first.resolve();
    retry.resolve();
  });
  const f = await page(t, {
    ...options,
    beforeImport({ $ }) {
      $('coop-level').value = 'relay-yard';
      $('coop-level').emit('change');
    },
    presentation: {
      read: ({ calls }) => (calls.reads.length === 1 ? first.promise : retry.promise),
    },
  });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  const section = f.$('coop-picture-preparation'),
    button = f.$('coop-picture-retry');
  assertLandingRecovery(f, 'coop-picture-cancel');
  assert.equal(f.doc.activeElement, f.doc.body, 'Passive preparation does not take focus.');

  f.doc.focused = false;
  f.win.emit('blur');
  assert.equal(state(f), 'cancelled');
  assertLandingRecovery(f, 'coop-picture-retry');
  f.doc.focused = true;
  f.win.emit('focus');
  f.$('coop-settings-open').focus();
  first.resolve();
  await flush();
  f.tick(60);
  assert.equal(state(f), 'cancelled');
  assert.equal(f.artwork.calls.reads.length, 1, 'Returning does not retry automatically.');
  assert.equal(f.artwork.calls.decodes.length, 0, 'The cancelled read cannot adopt late bytes.');
  assert.equal(
    f.doc.activeElement.id,
    'coop-settings-open',
    'Recovery placement cannot steal focus.',
  );
  assertLandingRecovery(f, 'coop-picture-retry');

  button.focus();
  f.tap('Enter');
  await waitFor(() => f.artwork.calls.reads.length === 2);
  assertLandingRecovery(f, 'coop-picture-cancel');
  assert.equal(f.doc.activeElement.id, 'coop-picture-cancel');
  assert.equal(f.$('coop-picture-preparation'), section, 'The real controls retain one owner.');
  assert.equal(f.$('coop-picture-retry'), button);
  assert.equal(f.artwork.calls.reads[1].slot, f.artwork.calls.reads[0].slot);
  retry.resolve();
  await settle(f, 'ready');
  assert.equal(section.parentNode, f.$('coop-settings-panel-extras'));
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-menu').hidden, false, 'Retry still requires a separate Start.');
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.artwork.calls.decodes[0].sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-stage').textContent, 'RELAY YARD');
});

test('failed Team picture recovery follows Settings ownership and returns to the landing without starting or replacing its actions', async (t) => {
  const initial = deferred(),
    retry = deferred();
  t.after(() => {
    initial.resolve();
    retry.resolve();
  });
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const f = await page(t, {
    ...options,
    presentation: {
      read: ({ calls }) => (calls.reads.length === 1 ? initial.promise : retry.promise),
    },
  });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  const section = f.$('coop-picture-preparation'),
    button = f.$('coop-picture-retry');
  openExtras(f);
  assert.equal(section.parentNode, f.$('coop-settings-panel-extras'));
  assert.equal(state(f), 'preparing', 'Opening Settings does not cancel the existing operation.');
  const active = f.doc.activeElement;
  initial.reject(new Error('Controlled picture read failure.'));
  await settle(f, 'error');
  assert.equal(errors.length, 1);
  assert.equal(button.closest('[hidden],[inert]'), null);
  assert.equal(section.parentNode, f.$('coop-settings-panel-extras'));
  assert.equal(f.doc.activeElement, active, 'A failed passive read cannot steal Settings focus.');
  f.tap('Escape');
  assertLandingRecovery(f, 'coop-picture-retry');
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.match(f.$('coop-picture-status').textContent, /Retry picture or choose another arena/);
  assert.equal(f.$('coop-picture-retry'), button);

  button.focus();
  f.tap('Enter');
  await waitFor(() => f.artwork.calls.reads.length === 2);
  assertLandingRecovery(f, 'coop-picture-cancel');
  openExtras(f);
  assert.equal(state(f), 'preparing');
  retry.resolve();
  await settle(f, 'ready');
  assert.equal(
    f.$('coop-options').open,
    true,
    'Readiness does not close the newer Settings visit.',
  );
  assert.equal(section.parentNode, f.$('coop-settings-panel-extras'));
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.artwork.calls.reads.length, 2);
  f.tap('Escape');
  assert.equal(section.parentNode, f.$('coop-settings-panel-extras'));
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.equal(f.$('coop-start').disabled, false);
  assert.deepEqual(f.visits, []);
});
