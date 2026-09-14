// Actual app, game shell, gallery/save handlers and navigation. The DOM's native
// button/Escape defaults and physical gamepad samples are modeled boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function key(page, value) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat: false });
  if (!event.defaultPrevented && value === 'Enter' && target.tagName === 'BUTTON') target.click();
  if (!event.defaultPrevented && value === 'Escape') {
    const dialog = page.doc.activeElement?.closest('dialog[open]');
    if (dialog && !dialog.emit('cancel').defaultPrevented) dialog.close();
  }
  target.emit('keyup', { key: value, code: value });
}
function controls(page, t, mode) {
  if (mode === 'keyboard')
    return {
      next: () => key(page, 'ArrowDown'),
      confirm: () => key(page, 'Enter'),
      back: () => key(page, 'Escape'),
    };
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const pad = {
    index: 0,
    id: 'Main menu collection controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = () => {
    time += 20;
    page.frame(20);
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
  };
  frame();
  pulse(0); // Neutral + physical Confirm joins without activating a menu action.
  return { next: () => pulse(13), confirm: () => pulse(0), back: () => pulse(1) };
}
function activate(page, input, target, scope) {
  const surfaces = Array.isArray(scope) ? scope : [scope];
  for (let step = 0; step < 80 && page.doc.activeElement !== target; step++) {
    input.next();
    assert.ok(
      surfaces.some((surface) => surface.contains(page.doc.activeElement)),
      'focus stays in the requested visible menu surfaces',
    );
  }
  assert.equal(
    page.doc.activeElement,
    target,
    `${target.id} must be reachable without pointer focus`,
  );
  input.confirm();
  page.frame(0);
}
function nonmodalOverlay(page) {
  // Only the four visible header actions join a nonmodal overlay. Dialog
  // callers still supply their single native modal and keep strict containment.
  return ['game-overlay', 'shell-menu', 'shell-packs', 'shell-collection', 'shell-settings'].map(
    (id) => page.$(id),
  );
}

for (const mode of ['keyboard', 'controller']) {
  test(`${mode}: native Main menu reaches Picture collection and Scores & saves without winning or leaving a paused cut`, async (t) => {
    const showModal = SoloElement.prototype.showModal,
      close = SoloElement.prototype.close,
      origins = new WeakMap();
    t.mock.method(SoloElement.prototype, 'showModal', function () {
      if (this.open) return;
      origins.set(this, this.ownerDocument.activeElement);
      this.emit('beforetoggle', { oldState: 'closed', newState: 'open' });
      showModal.call(this);
      // Native showModal focuses the first eligible control. Actual app/menu
      // listeners remain responsible for any deliberate replacement focus.
      this.querySelector(
        'button:not(:disabled),select:not(:disabled),input:not(:disabled)',
      )?.focus();
    });
    t.mock.method(SoloElement.prototype, 'close', function () {
      if (!this.open) return;
      close.call(this);
      const origin = origins.get(this),
        dialog = origin?.closest('dialog');
      if (origin?.isConnected && !origin.closest('[hidden]') && (!dialog || dialog.open))
        origin.focus();
      else this.ownerDocument.activeElement = this.ownerDocument.body;
    });
    const page = await soloPage(t, { titleScreen: true }),
      input = controls(page, t, mode),
      home = page.$('shell-home');
    const ready = authoritativeCheckpoint(page.rendered.run),
      initialStorage = [...page.storage.map],
      initialWrites = page.storage.writes.length;
    assert.equal(home.open, true);
    assert.equal(page.$('shell-library').textContent.trim(), 'Scores & saves');
    assert.equal(page.$('shell-gallery').textContent.trim(), 'Picture collection');
    assert.ok(home.contains(page.$('shell-guide')), 'Field guide remains in the title menu');
    activate(page, input, page.$('shell-gallery'), home);
    assert.equal(home.open, true);
    assert.equal(page.$('collection-dialog').open, true);
    assert.equal(page.$('library-dialog').open, false);
    assert.ok(page.$('collection-dialog').contains(page.doc.activeElement));
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ready);
    assert.deepEqual([...page.storage.map], initialStorage);
    assert.equal(page.storage.writes.length, initialWrites);
    input.back();
    page.frame(0);
    assert.equal(page.$('collection-dialog').open, false);
    assert.equal(page.$('collection-dialog').contains(page.doc.activeElement), false);
    assert.equal(page.rendered.paused, true);
    assert.equal(home.open, true);
    assert.equal(page.doc.activeElement, page.$('shell-gallery'));
    activate(page, input, page.$('shell-library'), home);
    assert.equal(home.open, false);
    assert.equal(page.$('library-dialog').open, true);
    assert.equal(page.$('collection-dialog').open, false);
    input.back();
    page.frame(0);
    assert.equal(page.$('library-dialog').open, false);
    assert.equal(page.$('library-dialog').contains(page.doc.activeElement), false);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ready);
    activate(page, input, page.$('start-button'), nonmodalOverlay(page));
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let i = 0; i < 20; i++) page.frame();
    assert.equal(page.rendered.run.player.cutting, true);
    page.key('Escape');
    page.key('Escape', false);
    page.frame(0);
    const paused = authoritativeCheckpoint(page.rendered.run);
    activate(page, input, page.$('overlay-menu'), nonmodalOverlay(page));
    activate(page, input, page.$('shell-gallery'), home);
    assert.equal(page.$('collection-dialog').open, true);
    input.back();
    for (let i = 0; i < 10; i++) page.frame();
    assert.equal(page.$('collection-dialog').open, false);
    assert.equal(home.open, true);
    assert.equal(page.doc.activeElement, page.$('shell-gallery'));
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), paused);
    assert.equal(page.$('collection-dialog').contains(page.doc.activeElement), false);
    assert.deepEqual(page.errors, []);
  });
}
