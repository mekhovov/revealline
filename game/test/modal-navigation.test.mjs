import test from 'node:test';
import assert from 'node:assert/strict';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

function surface() {
  const doc = new Document();
  const add = (tag, id, parent = doc.body) => {
    const element = doc.createElement(tag);
    element.id = id;
    parent.append(element);
    return element;
  };
  const dialogs = [add('dialog', 'earlier'), add('dialog', 'later')];
  for (const dialog of dialogs) {
    dialog.hidden = true;
    add('button', `${dialog.id}-first`, dialog);
    add('button', `${dialog.id}-last`, dialog);
  }
  const opener = add('button', 'opener');
  opener.focus();
  const open = (dialog) => {
    dialog.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    dialog.hidden = false;
    dialog.open = true;
    dialog.setAttribute('open', '');
    dialog.children[0].focus();
  };
  const close = (dialog) => {
    dialog.open = false;
    dialog.hidden = true;
    dialog.removeAttribute('open');
    doc.activeElement = doc.body;
    dialog.emit('close');
  };
  return { doc, dialogs, opener, open, close, add };
}

test('opening order owns controller scope across reversed DOM order, Back and fresh reopen', async () => {
  const h = surface(),
    [earlier, later] = h.dialogs;
  const stack = attachModalNavigation({ document: h.doc });
  const nav = attachControllerNavigation({
    document: h.doc,
    getRoot: () => stack.topDialog() ?? h.doc,
    getScope: () => stack.topDialog()?.id ?? 'ready',
    onBack: () => h.close(stack.topDialog()),
  });
  h.open(later);
  later.children[1].focus();
  h.open(earlier);
  assert.equal(stack.topDialog(), earlier);
  nav.engage();
  nav.handle({ direction: 'down' });
  assert.equal(h.doc.activeElement, earlier.children[1]);
  nav.handle({ back: true });
  await Promise.resolve();
  assert.equal(stack.topDialog(), later);
  assert.equal(h.doc.activeElement, later.children[1], 'Back restores the actual opener');
  h.close(later);
  await Promise.resolve();
  h.open(earlier);
  h.open(later);
  assert.equal(stack.topDialog(), later, 'A reopened dialog gets a fresh position');
  later.remove();
  assert.equal(stack.topDialog()?.id, earlier.id, 'Detached top cannot retain navigation');
  nav.destroy();
  stack.destroy();
  assert.equal(stack.topDialog(), null);
});

test('ordered mutation records cover older engines and same-task close/reopen without guessing DOM order', () => {
  const h = surface(),
    [earlier, later] = h.dialogs;
  let observer;
  h.doc.defaultView.MutationObserver = class {
    pending = [];
    constructor(callback) {
      observer = this;
      this.callback = callback;
    }
    observe() {}
    takeRecords() {
      const records = this.pending;
      this.pending = [];
      return records;
    }
    disconnect() {
      this.disconnected = true;
    }
  };
  const stack = attachModalNavigation({ document: h.doc });
  for (const dialog of [later, earlier]) {
    dialog.open = true;
    dialog.hidden = false;
    dialog.setAttribute('open', '');
  }
  observer.pending = [later, earlier].map((target) => ({
    target,
    attributeName: 'open',
    oldValue: null,
  }));
  assert.equal(stack.topDialog(), earlier);
  observer.pending = [
    { target: later, attributeName: 'open', oldValue: '' },
    { target: later, attributeName: 'open', oldValue: null },
  ];
  assert.equal(stack.topDialog(), later);
  stack.destroy();
  assert.equal(observer.disconnected, true);
});

// Native dialog event/focus behavior only. Actual app, shell, router, navigation,
// input and simulation run unchanged; this does not model browser top-layer pixels.
function nativeDialogs(t) {
  const originalOpen = SoloElement.prototype.showModal,
    originalClose = SoloElement.prototype.close;
  const origins = new WeakMap();
  const originalAttribute = SoloElement.prototype.setAttribute;
  SoloElement.prototype.setAttribute = function (key, value) {
    originalAttribute.call(this, key, value);
    if (['type', 'min', 'max', 'step', 'size'].includes(key)) this[key] = String(value);
  };
  SoloElement.prototype.showModal = function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    originalOpen.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  };
  SoloElement.prototype.close = function () {
    if (!this.open) return;
    originalClose.call(this);
    const origin = origins.get(this);
    if (origin?.isConnected && !origin.disabled) origin.focus();
  };
  t.after(() => {
    SoloElement.prototype.setAttribute = originalAttribute;
    SoloElement.prototype.showModal = originalOpen;
    SoloElement.prototype.close = originalClose;
  });
}

test('actual title → Missions → Collection controller Back closes only the front dialog and never starts flight', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, { titleScreen: true });
  const pad = {
    index: 0,
    id: 'Menu test',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    h.frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    h.frame();
  };
  h.frame();
  pulse(0);
  h.frame();
  h.$('shell-play').click();
  h.frame();
  h.frame();
  h.$('collection-button').focus();
  h.$('collection-button').click();
  h.frame();
  h.frame();
  assert.ok(h.$('collection-dialog').contains(h.doc.activeElement));
  const close = h.$('collection-dialog').querySelector('button');
  close.focus();
  close.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown' });
  assert.ok(
    h.$('collection-dialog').contains(h.doc.activeElement),
    'Keyboard arrows also use the front modal',
  );
  h.frame(); // Native input requires a neutral controller sample before a fresh action.
  pulse(1);
  assert.equal(h.$('collection-dialog').open, false);
  assert.equal(h.$('shell-missions').open, true);
  assert.equal(h.doc.activeElement, h.$('collection-button'));
  assert.equal(h.$('flight-state').textContent, 'Ready for launch');
  assert.equal(h.rendered.run.tick, 0);
  pulse(1);
  assert.equal(h.$('shell-missions').open, false);
  assert.equal(h.rendered.run.tick, 0);
  assert.deepEqual(h.errors, []);
});

function controllerPad(h, t) {
  const prior = Object.getOwnPropertyDescriptor(performance, 'now');
  let now = 1000;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    prior ? Object.defineProperty(performance, 'now', prior) : delete performance.now,
  );
  const pad = {
    index: 0,
    id: 'Menu controls',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = (ms = 16) => {
    now += ms;
    h.frame(ms);
  };
  const set = (index, pressed) => {
    pad.buttons[index] = { pressed, value: Number(pressed) };
  };
  const pulse = (index) => {
    set(index, true);
    frame();
    set(index, false);
    frame();
  };
  frame();
  pulse(0);
  frame();
  return { frame, set, pulse };
}

test('actual native keyboard/pointer handoff retains controller owner but suppresses its held menu repeat until neutral', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, { titleScreen: true }),
    pad = controllerPad(h, t);
  for (const kind of ['keydown', 'pointerdown']) {
    pad.set(13, true);
    pad.frame();
    h.$('shell-help').emit(
      kind,
      kind === 'keydown' ? { key: 'Tab', code: 'Tab' } : { button: 0, isPrimary: true },
    );
    h.$('shell-help').focus();
    pad.frame(400);
    assert.equal(h.doc.activeElement.id, 'shell-help');
    pad.set(13, false);
    pad.frame();
    pad.pulse(13);
    assert.notEqual(
      h.doc.activeElement.id,
      'shell-help',
      'Fresh direction works without another join',
    );
  }
  assert.equal(h.rendered.run.tick, 0);
});

for (const [dialog, opener, prefix] of [
  ['help-dialog', 'help-button', 'help'],
  ['collection-dialog', 'collection-button', 'collection'],
])
  test(`actual ${dialog} reader reaches the bottom; first Back/Escape leaves reading without closing or starting`, async (t) => {
    nativeDialogs(t);
    const h = await soloPage(t, { titleScreen: false }),
      pad = controllerPad(h, t);
    h.$(opener).click();
    pad.frame();
    pad.frame();
    const region = h.$(`${prefix}-reading`);
    region.clientHeight = 100;
    region.scrollHeight = 480;
    h.$(`${prefix}-read`).focus();
    pad.pulse(0);
    assert.equal(h.doc.activeElement.id, region.id);
    assert.equal(h.$(`${prefix}-reading-done`).disabled, false);
    for (let i = 0; i < 10; i++) pad.pulse(13);
    assert.equal(region.scrollTop, 380);
    pad.pulse(1);
    assert.equal(h.$(dialog).open, true);
    assert.equal(h.doc.activeElement.id, `${prefix}-read`);
    assert.equal(h.$(`${prefix}-reading-done`).disabled, true);
    pad.pulse(0);
    const escape = region.emit('keydown', { key: 'Escape', code: 'Escape' });
    assert.equal(escape.defaultPrevented, true);
    assert.equal(h.$(dialog).open, true);
    assert.equal(h.doc.activeElement.id, `${prefix}-read`);
    assert.equal(h.rendered.run.tick, 0);
    pad.frame(); // Escape handed control back to the keyboard; acknowledge neutral first.
    pad.pulse(1);
    assert.equal(h.$(dialog).open, false);
  });

test('actual Settings → Studio listbox/range edits preview, cancel and apply through native handlers before Back returns', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, {
      titleScreen: true,
      audio: audioHarness(),
      soundtrackIndexedDB: memoryIndexedDB().indexedDB,
    }),
    pad = controllerPad(h, t);
  await settle(() => !h.$('soundtrack-open').disabled);
  h.$('shell-options').focus();
  h.$('shell-options').click();
  pad.frame();
  pad.frame();
  h.$('soundtrack-open').focus();
  pad.pulse(0);
  await settle(() =>
    /Saved library loaded|Music library ready/.test(h.$('soundtrack-status')?.textContent),
  );
  pad.frame();
  pad.frame();
  assert.equal(h.$('soundtrack-dialog').open, true);
  assert.equal(h.$('settings-dialog').open, false);
  const tracks = h.$('soundtrack-tracks'),
    volume = h.$('soundtrack-volume');
  assert.equal(tracks.size, '7', 'The actual multirow listbox uses the select editor');
  for (const [element, direction] of [
    [tracks, 13],
    [volume, 15],
  ]) {
    element.focus();
    const initial = element.value;
    let changes = 0;
    element.addEventListener('change', () => changes++);
    pad.pulse(0);
    pad.pulse(direction);
    assert.equal(element.value, initial, 'Browsing only changes the owned preview');
    pad.pulse(1);
    assert.equal(element.value, initial);
    assert.equal(changes, 0);
    assert.equal(h.$('soundtrack-dialog').open, true, 'Back cancels the editor before closing');
    pad.pulse(0);
    pad.pulse(direction);
    const escape = element.emit('keydown', { key: 'Escape', code: 'Escape' });
    assert.equal(
      escape.defaultPrevented,
      true,
      'Native Escape also cancels only the active editor',
    );
    assert.equal(element.value, initial);
    assert.equal(changes, 0);
    pad.frame();
    pad.pulse(0);
    pad.pulse(direction);
    pad.pulse(0);
    assert.notEqual(element.value, initial);
    assert.equal(changes, 1, 'Confirm applies through the existing native handler once');
  }
  await settle(() => Number(h.$('music-volume').value) === Number(volume.value));
  pad.pulse(1);
  assert.equal(h.$('soundtrack-dialog').open, false);
  assert.equal(h.$('settings-dialog').open, true);
  assert.equal(h.doc.activeElement.id, 'soundtrack-open');
  assert.equal(h.$('shell-home').open, true);
  pad.pulse(1);
  await Promise.resolve();
  assert.equal(h.$('settings-dialog').open, false);
  assert.equal(h.$('shell-home').open, true);
  assert.equal(h.doc.activeElement.id, 'shell-options');
  assert.equal(h.rendered.run.tick, 0);
  assert.deepEqual(h.errors, []);
});

test('title Settings returns to its title opener after controller Back or native Escape', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, { titleScreen: true }),
    pad = controllerPad(h, t);
  for (const exit of ['controller', 'escape']) {
    h.$('shell-options').focus();
    h.$('shell-options').click();
    pad.frame();
    pad.frame();
    assert.equal(h.$('shell-home').open, true, 'The title remains underneath its settings');
    assert.equal(h.$('settings-dialog').open, true);
    if (exit === 'controller') pad.pulse(1);
    else {
      // Browser Escape cancels the front native dialog; model its default close.
      const dialog = h.$('settings-dialog');
      const event = dialog.emit('cancel');
      if (!event.defaultPrevented) dialog.close();
    }
    await Promise.resolve();
    assert.equal(h.$('settings-dialog').open, false);
    assert.equal(h.$('shell-home').open, true);
    assert.equal(h.doc.activeElement.id, 'shell-options');
    assert.equal(h.rendered.run.tick, 0, 'Returning never starts flight');
    pad.frame();
  }
  assert.deepEqual(h.errors, []);
});

test('opening Settings during a flight keeps its paused-flight return instead of opening the title', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, { titleScreen: false }),
    pad = controllerPad(h, t);
  h.$('start-button').click();
  pad.frame();
  h.$('shell-settings').click();
  pad.frame();
  pad.frame();
  const tick = h.rendered.run.tick;
  assert.equal(h.$('settings-dialog').open, true);
  assert.equal(h.$('shell-home').open, false);
  pad.pulse(1);
  await Promise.resolve();
  pad.frame();
  assert.equal(h.$('settings-dialog').open, false);
  assert.equal(h.$('shell-home').open, false);
  assert.equal(h.$('flight-state').textContent, 'Paused');
  assert.equal(h.rendered.run.tick, tick);
  assert.deepEqual(h.errors, []);
});
