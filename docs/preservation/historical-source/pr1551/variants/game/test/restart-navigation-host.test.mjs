import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary, saveLibrary, updatePreferences } from '../library.mjs';

const slot = 'revealline.suspended.dev.v1';
const profile = 'revealline.library.dev.v1';
function nativeDialogs(t) {
  const show = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close,
    focus = SoloElement.prototype.focus,
    opened = [];
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    show.call(this);
    opened.push(this);
    this.querySelector('button:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    const owned = this.contains(this.ownerDocument.activeElement);
    if (owned) this.ownerDocument.activeElement = this.ownerDocument.body;
    close.call(this);
  });
  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    const top = opened.filter((element) => element.open).at(-1);
    if (!this.closest('[hidden],[inert],dialog:not([open])') && (!top || top.contains(this)))
      focus.apply(this, args);
  });
}
function press(h, key, extra = {}) {
  const target = h.doc.activeElement;
  const event = target.emit('keydown', { key, code: key, repeat: false, ...extra });
  if (!event.defaultPrevented && key === 'Escape') {
    const dialog = target.closest('dialog[open]');
    if (dialog) {
      const cancel = dialog.emit('cancel', { bubbles: false });
      if (!cancel.defaultPrevented) dialog.close();
    }
  }
  if (!event.defaultPrevented && key === 'Enter') {
    if (target.tagName === 'BUTTON') target.click();
    else if (target.tagName === 'SUMMARY') target.parentNode.open = !target.parentNode.open;
  }
  target.emit('keyup', { key, code: key });
  return event;
}
function frames(h, n = 12) {
  for (let i = 0; i < n; i++) h.frame();
}
function checkpoint(h) {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
}
async function flight(t, options = {}) {
  nativeDialogs(t);
  const storage = memoryStorage();
  saveLibrary(storage, profile, updatePreferences(emptyLibrary(), { turnPolicy: 'grid-center' }));
  const h = await soloPage(t, { storage, ...options });
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.key('ArrowDown');
  // Queue before the next cell centre under the current approved speed.
  frames(h, 8);
  h.key('ArrowDown', false);
  h.key('ArrowRight');
  h.frame();
  h.key('ArrowRight', false);
  assert.equal(h.rendered.run.player.cutting, true);
  assert.equal(h.rendered.run.player.queuedDirection, 'right');
  h.$('pause-button').click();
  h.frame(0);
  return h;
}
function openFrom(h, origin) {
  if (origin === 'workshop') {
    h.$('overlay-menu').focus();
    press(h, 'Enter');
    h.$('shell-workshop').focus();
    press(h, 'Enter');
    const summary = h.$('restart-button').closest('details').querySelector('summary');
    summary.focus();
    press(h, 'Enter');
    assert.equal(summary.parentNode.open, true);
    h.$('restart-button').focus();
  } else h.$('overlay-restart').focus();
  const opener = h.doc.activeElement;
  const before = checkpoint(h),
    run = h.rendered.run,
    saved = h.storage.getItem(slot);
  press(h, 'Enter');
  assert.equal(h.$('restart-dialog').open, true);
  assert.equal(h.doc.activeElement.id, 'restart-cancel');
  assert.equal(h.$('restart-cancel').textContent, 'Stay paused');
  return { opener, before, run, saved, library: h.storage.getItem(profile) };
}
function preserved(h, old) {
  frames(h);
  assert.equal(h.rendered.run, old.run);
  assert.deepEqual(checkpoint(h), old.before);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.storage.getItem(slot), old.saved);
  assert.equal(h.storage.getItem(profile), old.library);
  assert.deepEqual(h.errors, []);
}
for (const origin of ['overlay', 'workshop'])
  for (const method of ['button', 'Escape', 'controller'])
    test(`${origin} Restart ${method}: actual opener returns with exact queued cut and saved bytes, without Resume`, async (t) => {
      let pad = null;
      const h = await flight(t, { readPads: () => (pad ? [pad] : []) });
      const old = openFrom(h, origin);
      preserved(h, old);
      if (method === 'button') press(h, 'Enter');
      else if (method === 'Escape') press(h, 'Escape');
      else {
        pad = {
          index: 0,
          id: 'restart-pad',
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        };
        h.frame();
        pad.buttons[1] = { pressed: true, value: 1 };
        h.frame();
        pad.buttons[1] = { pressed: false, value: 0 };
        h.frame();
      }
      await Promise.resolve();
      assert.equal(h.$('restart-dialog').open, false);
      assert.equal(h.doc.activeElement, old.opener);
      assert.equal(h.$('shell-workshop-dialog').open, origin === 'workshop');
      preserved(h, old);
    });
for (const origin of ['overlay', 'workshop'])
  test(`${origin} explicit Restart closes retained parents and creates one fresh attempt behind no menu`, async (t) => {
    const h = await flight(t);
    const old = openFrom(h, origin);
    h.$('restart-confirm').focus();
    press(h, 'Enter');
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    await settle(() => h.doc.body.dataset.flightState === 'running');
    h.frame(0);
    assert.equal(h.$('restart-dialog').open, false);
    assert.equal(h.$('shell-workshop-dialog').open, false);
    assert.equal(h.$('shell-home').open, false);
    assert.notEqual(h.rendered.run, old.run);
    assert.equal(h.rendered.run.tick, 0);
    assert.equal(h.rendered.run.levelId, old.run.levelId);
    assert.equal(h.rendered.run.turnPolicy, old.run.turnPolicy);
    assert.equal(h.rendered.run.player.queuedDirection, null);
    assert.equal(h.doc.activeElement.id, 'game-canvas');
    assert.equal(h.storage.getItem(slot), old.saved);
    const next = h.rendered.run;
    h.$('restart-confirm').click();
    press(h, 'Enter', { repeat: true });
    frames(h, 3);
    assert.equal(h.rendered.run, next);
    assert.deepEqual(h.errors, []);
  });
test('confirmation opening failure keeps the old Workshop flight and visible opener', async (t) => {
  const h = await flight(t);
  h.$('overlay-menu').click();
  h.$('shell-workshop').click();
  h.$('restart-button').closest('details').open = true;
  h.$('restart-button').focus();
  const old = {
    run: h.rendered.run,
    before: checkpoint(h),
    saved: h.storage.getItem(slot),
    library: h.storage.getItem(profile),
  };
  t.mock.method(h.$('restart-dialog'), 'showModal', () => {
    throw new Error('Modeled modal failure');
  });
  press(h, 'Enter');
  assert.equal(h.$('restart-dialog').open, false);
  assert.equal(h.doc.activeElement.id, 'restart-button');
  assert.match(h.$('run-message').textContent, /confirmation unavailable.*remains paused/);
  preserved(h, old);
});
for (const lifecycle of ['blur', 'hidden', 'pagehide'])
  test(`${lifecycle} invalidates a shown Restart; returning never reuses its destructive intent`, async (t) => {
    const h = await flight(t);
    const old = openFrom(h, 'workshop');
    if (lifecycle === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
    } else globalThis.window.emit(lifecycle, { persisted: true });
    h.$('restart-confirm').click();
    assert.equal(h.$('restart-confirm').disabled, true);
    assert.match(h.$('restart-dialog-copy').textContent, /cancelled/);
    preserved(h, old);
    h.$('restart-cancel').click();
    assert.equal(h.$('restart-dialog').open, false);
    preserved(h, old);
  });
test('a queued old close cannot invalidate a newly opened Restart decision', async (t) => {
  const h = await flight(t);
  openFrom(h, 'overlay');
  press(h, 'Enter');
  const old = openFrom(h, 'overlay');
  h.$('restart-dialog').emit('close', { bubbles: false });
  assert.equal(h.$('restart-dialog').open, true);
  assert.equal(h.$('restart-confirm').disabled, false);
  press(h, 'Escape');
  assert.equal(h.doc.activeElement, old.opener);
  preserved(h, old);
});
test('Restart and class/mission/Team decisions cannot replace each other through hidden controls', async (t) => {
  const h = await flight(t);
  const old = openFrom(h, 'workshop');
  h.$('class-select').value = 'bomber';
  h.$('class-select').onchange();
  h.$('level-select').onchange();
  h.$('shell-team').click();
  assert.equal(h.$('restart-dialog').open, true);
  assert.equal(h.$('mission-replace-dialog').open, false);
  assert.equal(h.$('mode-leave-dialog').open, false);
  assert.equal(h.$('class-select').value, 'scout');
  preserved(h, old);
  press(h, 'Escape');
});

test('a completed saved-flight adoption makes an older Restart decision unusable', async (t) => {
  const h = await flight(t);
  const old = openFrom(h, 'workshop');
  // Exercise a real competing host adoption completion, not an invented run.
  await h.$('continue-saved').onclick();
  h.frame(0);
  const adopted = h.rendered.run,
    adoptedCheckpoint = checkpoint(h);
  assert.notEqual(adopted, old.run);
  h.$('restart-confirm').click();
  assert.equal(h.$('restart-dialog').open, true);
  assert.equal(h.$('restart-confirm').disabled, true);
  assert.match(h.$('restart-dialog-copy').textContent, /changed/);
  frames(h);
  assert.equal(h.rendered.run, adopted);
  assert.deepEqual(checkpoint(h), adoptedCheckpoint);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.storage.getItem(slot), old.saved);
  h.$('restart-cancel').click();
});

test('Restart cannot displace a pending checked class preparation', async (t) => {
  const h = await flight(t);
  let grant;
  globalThis.navigator.locks.request = async (_name, _options, work) => {
    await new Promise((resolve) => {
      grant = resolve;
    });
    return work();
  };
  h.$('class-select').value = 'bomber';
  const pending = h.$('class-select').onchange();
  await settle(() => !!grant);
  assert.equal(h.$('mission-replace-dialog').open, true);
  assert.equal(h.$('mission-replace-confirm').disabled, true);
  h.$('restart-button').click();
  h.$('overlay-restart').click();
  assert.equal(h.$('restart-dialog').open, false);
  const old = {
    run: h.rendered.run,
    before: checkpoint(h),
    saved: h.storage.getItem(slot),
    library: h.storage.getItem(profile),
  };
  h.$('mission-replace-stay').click();
  grant();
  await pending;
  preserved(h, old);
});
