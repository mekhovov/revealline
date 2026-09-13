// Real solo host/navigation/storage; DOM, native dialog defaults and Gamepad
// hardware are modeled. No run state, navigation callbacks or saves are replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { emptyLibrary, updatePreferences, saveLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const headers = [
  ['shell-packs', 'shell-missions'],
  ['shell-collection', 'collection-dialog'],
  ['shell-settings', 'settings-dialog'],
];
const sessionKey = 'revealline.suspended.dev.v1';
function nativeDialogs(t) {
  const show = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close;
  const origins = new WeakMap();
  SoloElement.prototype.showModal = function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    show.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled)')?.focus();
  };
  SoloElement.prototype.close = function () {
    if (!this.open) return;
    close.call(this);
    const origin = origins.get(this);
    if (origin?.isConnected && !origin.closest('[hidden]')) origin.focus();
  };
  t.after(() => {
    SoloElement.prototype.showModal = show;
    SoloElement.prototype.close = close;
  });
}
function key(page, value, extra = {}) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat: false, ...extra });
  if (!event.defaultPrevented && ['Enter', ' '].includes(value) && target.tagName === 'BUTTON')
    target.click();
  const dialog = target.closest('dialog[open]');
  if (
    !event.defaultPrevented &&
    value === 'Escape' &&
    dialog &&
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
  )
    dialog.close();
  target.emit('keyup', { key: value, code: value });
  return event;
}
function frames(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}
function snapshot(page) {
  const saved = page.storage.getItem(sessionKey);
  const slot = saved ? JSON.parse(saved) : null;
  if (slot) delete slot.savedAt; // Existing explicit menu pause may save a new timestamp.
  return {
    run: page.rendered.run,
    checkpoint: authoritativeCheckpoint(page.rendered.run),
    slot,
    selection: ['pack-select', 'campaign-select', 'level-select', 'difficulty-select'].map(
      (id) => page.$(id).value,
    ),
  };
}
function unchanged(page, before) {
  page.frame(0);
  const after = snapshot(page);
  assert.equal(after.run, before.run);
  assert.deepEqual(after.checkpoint, before.checkpoint);
  assert.deepEqual(after.slot, before.slot);
  assert.deepEqual(after.selection, before.selection);
}
async function fixture(t, policy, options = {}) {
  nativeDialogs(t);
  const storage = memoryStorage();
  assert.equal(
    saveLibrary(
      storage,
      'revealline.library.dev.v1',
      updatePreferences(emptyLibrary(), { turnPolicy: policy }),
    ).ok,
    true,
  );
  const page = await soloPage(t, { storage, ...options });
  assert.equal(page.rendered.run.turnPolicy, policy);
  return page;
}
function startCut(page) {
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  frames(page, 24);
  assert.ok(page.rendered.run.player.cutting);
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
}
function win(page) {
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 1200 && page.rendered.run.status !== 'won'; i++) page.frame();
  assert.equal(page.rendered.run.status, 'won');
  page.$('skip-celebration').click();
  page.frame(0);
  assert.equal(page.$('show-result').hidden, false);
}
function pad(page, t) {
  let now = 1000;
  const original = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    original ? Object.defineProperty(performance, 'now', original) : delete performance.now,
  );
  const controller = {
    index: 0,
    id: 'Modeled header navigation',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [controller];
  const frame = () => {
    now += 16;
    page.frame(16);
  };
  const set = (i, pressed) => {
    controller.buttons[i] = { pressed, value: pressed ? 1 : 0 };
  };
  const pulse = (i) => {
    set(i, true);
    frame();
    set(i, false);
    frame();
  };
  const reach = (id) => {
    for (let i = 0; i < 60 && page.doc.activeElement.id !== id; i++) pulse(13);
    assert.equal(
      page.doc.activeElement.id,
      id,
      `${id} reachable by real host controller navigation`,
    );
  };
  frame();
  pulse(0);
  frame();
  return { frame, set, pulse, reach };
}

for (const policy of ['immediate', 'grid-center']) {
  for (const state of ['ready', 'paused', 'picture', 'result']) {
    test(`${policy}: native Enter and controller activate visible headers from ${state} without starting or replacing the flight`, async (t) => {
      const page = await fixture(t, policy);
      if (state === 'paused') startCut(page);
      if (['picture', 'result'].includes(state)) {
        win(page);
        if (state === 'result') {
          page.$('show-result').click();
          page.frame(0);
        }
      }
      const before = snapshot(page);
      for (const [header, dialog] of headers) {
        page.$(header).focus();
        key(page, 'Enter');
        assert.equal(page.$(dialog).open, true, `${header} activates from ${state}`);
        page.$(dialog).close();
        frames(page, 3);
        unchanged(page, before);
      }
      const controls = pad(page, t);
      for (const [header, dialog] of headers) {
        controls.reach(header);
        controls.pulse(0);
        assert.equal(page.$(dialog).open, true);
        controls.pulse(1);
        assert.equal(page.$(dialog).open, false);
        unchanged(page, before);
      }
      assert.deepEqual(page.errors, []);
    });
  }
  test(`${policy}: Tab and controller reach headers while unrelated body and flight controls stay excluded`, async (t) => {
    const page = await fixture(t, policy),
      before = snapshot(page);
    const unrelated = page.doc.createElement('button');
    unrelated.id = 'unrelated-body-action';
    let clicks = 0;
    unrelated.onclick = () => {
      clicks++;
    };
    page.doc.body.append(unrelated);
    const visited = new Set();
    page.$('start-button').focus();
    for (let i = 0; i < 35; i++) {
      key(page, 'Tab');
      visited.add(page.doc.activeElement.id);
    }
    for (const [header] of headers)
      assert.ok(visited.has(header), `${header} is in native Tab cycle`);
    for (const id of [
      'unrelated-body-action',
      'settings-button',
      'pause-button',
      'action-button',
      'pickup-button',
      'boost-button',
    ])
      assert.equal(visited.has(id), false, `${id} stays outside the composite scope`);
    unrelated.focus();
    assert.equal(key(page, 'Enter').defaultPrevented, true);
    assert.equal(clicks, 0);
    unchanged(page, before);
    const controls = pad(page, t);
    for (const [header, dialog] of headers) {
      controls.reach(header);
      controls.pulse(0);
      assert.equal(page.$(dialog).open, true);
      controls.pulse(1);
      assert.equal(page.$(dialog).open, false);
      unchanged(page, before);
    }
    assert.deepEqual(page.errors, []);
  });
  test(`${policy}: paused header controller/Back preserves direction and modal scope prevents click-through`, async (t) => {
    const page = await fixture(t, policy);
    startCut(page);
    const before = snapshot(page),
      controls = pad(page, t);
    controls.reach('shell-settings');
    controls.pulse(0);
    assert.equal(page.$('settings-dialog').open, true);
    // Native modal focus is inside the dialog; keyboard and controller
    // traversal must never offer the visible background header.
    for (let i = 0; i < 35; i++) {
      key(page, 'ArrowDown');
      assert.ok(page.$('settings-dialog').contains(page.doc.activeElement));
    }
    assert.equal(page.$('shell-missions').open, false);
    assert.equal(page.$('settings-dialog').open, true);
    for (let i = 0; i < 35; i++) {
      controls.pulse(13);
      assert.ok(page.$('settings-dialog').contains(page.doc.activeElement));
    }
    controls.pulse(1);
    assert.equal(page.$('settings-dialog').open, false);
    frames(page, 20);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    unchanged(page, before);
    controls.reach('start-button');
    const pausedTick = page.rendered.run.tick;
    controls.set(0, true);
    controls.frame();
    controls.frame();
    assert.equal(page.rendered.paused, false);
    assert.equal(page.rendered.run.player.direction, 'down');
    assert.equal(page.$('hangar-dialog').open, false);
    controls.set(0, false);
    controls.frame();
    assert.ok(page.rendered.run.tick > pausedTick);
    assert.deepEqual(page.errors, []);
  });
  test(`${policy}: First Flight ready and ended gates retain original course-only scope`, async (t) => {
    const page = await fixture(t, policy, {
      search: `?course=first-flight&lesson=close-line&turn-policy=${policy}`,
      parentWindow: {},
    });
    assert.equal(page.$('shell-edition').textContent, 'FIRST FLIGHT');
    assert.equal(page.$('game-overlay').hidden, false, 'course begins in ready panel');
    const before = snapshot(page);
    for (let i = 0; i < 25; i++) {
      key(page, 'Tab');
      assert.equal(!!page.doc.activeElement.closest('.shell-bar'), false);
    }
    const controls = pad(page, t);
    assert.equal(page.$('game-overlay').hidden, false, 'joining leaves course ready');
    for (let i = 0; i < 25; i++) {
      controls.pulse(13);
      assert.equal(!!page.doc.activeElement.closest('.shell-bar'), false);
    }
    page.$('first-flight-exit').focus();
    key(page, 'Enter');
    assert.equal(page.$('game-overlay').dataset.kind, 'course-ended');
    for (let i = 0; i < 25; i++) {
      key(page, 'Tab');
      controls.pulse(13);
      assert.equal(!!page.doc.activeElement.closest('.shell-bar'), false);
    }
    for (const [, dialog] of headers) assert.equal(page.$(dialog).open, false);
    frames(page, 20);
    unchanged(page, before);
    assert.deepEqual(page.errors, []);
  });
}
