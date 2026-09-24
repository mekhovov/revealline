// Real solo host/navigation/storage; DOM, native dialog defaults and Gamepad
// hardware are modeled. No run state, navigation callbacks or saves are replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { emptyLibrary, updatePreferences, saveLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const headers = [
  ['shell-packs', 'journey-chooser'],
  ['shell-collection', 'collection-dialog'],
  ['shell-settings', 'settings-dialog'],
];
const sessionKey = 'revealline.suspended.dev.v1';
// Navigation qualification needs a reproducible legal victory, independently
// of later enemy tuning in the production First Signal mission.
const navigationCampaign = JSON.parse(
  readFileSync(new URL('../content/campaign.json', import.meta.url)),
);
navigationCampaign.id = 'header-navigation';
navigationCampaign.levels[0].enemies = [];
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
  if (!event.defaultPrevented && value === 'Tab' && dialog) {
    const stops = [
      ...dialog.querySelectorAll('button,a[href],input,select,textarea,summary'),
    ].filter(
      (node) =>
        !node.disabled &&
        node.tabIndex >= 0 &&
        !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
        (!node.closest('details:not([open])') || node.tagName === 'SUMMARY') &&
        node.getClientRects().length,
    );
    const index = stops.indexOf(target);
    stops[index + (extra.shiftKey ? -1 : 1)]?.focus();
  }
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
// Capture the original handler's operation without moving focus or replacing
// the native keyboard/controller gesture being qualified. Cold catalogue work
// may exceed a readiness poll while still acknowledging the action immediately.
async function activateHeader(page, header, activate) {
  if (header !== 'shell-packs') {
    activate();
    return;
  }
  const control = page.$(header),
    handler = control.onclick;
  let pending;
  control.onclick = (...args) => (pending = handler.apply(control, args));
  try {
    activate();
  } finally {
    control.onclick = handler;
  }
  assert(pending instanceof Promise, 'The actual Missions gesture owns preparation.');
  const feedback = page.$('mission-library-opening-status');
  assert.equal(feedback?.textContent, 'Preparing missions…');
  assert.equal(feedback.getAttribute('role'), 'status');
  assert.equal(page.doc.activeElement, control, 'Loading does not take header focus.');
  await pending;
  assert.equal(page.$('journey-chooser').open, true);
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
  const page = await soloPage(t, { storage, campaign: navigationCampaign, ...options });
  assert.equal(page.rendered.run.turnPolicy, policy);
  return page;
}
async function startCut(page) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  frames(page, 24);
  assert.ok(page.rendered.run.player.cutting);
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
}
async function win(page) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
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
  // A neutral sample connects automatically; Confirm is now a real menu action.
  frame();
  return { frame, set, pulse, reach };
}

for (const policy of ['immediate', 'grid-center']) {
  for (const state of ['ready', 'paused', 'picture', 'result']) {
    test(`${policy}: native Enter and controller activate visible headers from ${state} without starting or replacing the flight`, async (t) => {
      const page = await fixture(t, policy);
      if (state === 'paused') await startCut(page);
      if (['picture', 'result'].includes(state)) {
        await win(page);
        if (state === 'result') {
          page.$('show-result').click();
          page.frame(0);
        }
      }
      const before = snapshot(page);
      for (const [header, dialog] of headers) {
        page.$(header).focus();
        await activateHeader(page, header, () => key(page, 'Enter'));
        await settle(() => page.$(dialog)?.open);
        assert.equal(page.$(dialog).open, true, `${header} activates from ${state}`);
        page.$(dialog).close();
        frames(page, 3);
        unchanged(page, before);
      }
      const controls = pad(page, t);
      for (const [header, dialog] of headers) {
        controls.reach(header);
        await activateHeader(page, header, () => controls.pulse(0));
        await settle(() => page.$(dialog)?.open);
        assert.equal(page.$(dialog).open, true);
        controls.frame(); // The asynchronously opened modal receives a neutral sample.
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
      await activateHeader(page, header, () => controls.pulse(0));
      await settle(() => page.$(dialog)?.open);
      assert.equal(page.$(dialog).open, true);
      controls.frame();
      controls.pulse(1);
      assert.equal(page.$(dialog).open, false);
      unchanged(page, before);
    }
    assert.deepEqual(page.errors, []);
  });
  test(`${policy}: paused header controller/Back preserves direction and modal scope prevents click-through`, async (t) => {
    const page = await fixture(t, policy);
    await startCut(page);
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
  for (const state of ['ready', 'paused', 'picture', 'result']) {
    test(`${policy}: First Flight ${state} exposes usable header/menu actions and preserves its lesson`, async (t) => {
      const page = await fixture(t, policy, {
        search: `?course=first-flight&lesson=close-line&turn-policy=${policy}`,
        parentWindow: {},
      });
      if (state === 'paused') await startCut(page);
      if (['picture', 'result'].includes(state)) {
        await win(page);
        if (state === 'result') {
          page.$('show-result').click();
          page.frame(0);
        }
      }
      const before = snapshot(page),
        writes = page.storage.writes.length;
      assert.equal(page.$('shell-edition').textContent, 'FIRST FLIGHT');
      assert.equal(page.$('shell-packs').hidden, true);
      assert.equal(page.$('shell-collection').hidden, true);
      assert.equal(page.$('pause-button').hidden, true, 'inactive Pause is not an unused action');
      const visited = new Set();
      page.$('shell-settings').focus();
      for (let i = 0; i < 60; i++) {
        key(page, 'Tab');
        visited.add(page.doc.activeElement.id);
      }
      assert.ok(visited.has('shell-settings'));
      assert.ok(visited.has('shell-menu'));
      assert.ok(visited.has('first-flight-exit'), 'lesson actions stay reachable with the picture');
      assert.equal(visited.has('shell-packs'), false);
      assert.equal(visited.has('shell-collection'), false);
      page.$('shell-settings').focus();
      key(page, 'Enter');
      assert.equal(page.$('settings-dialog').open, true);
      for (let i = 0; i < 20; i++) {
        key(page, 'ArrowDown');
        assert.ok(page.$('settings-dialog').contains(page.doc.activeElement));
      }
      key(page, 'Escape');
      assert.equal(page.$('settings-dialog').open, false);
      const controls = pad(page, t);
      controls.reach('shell-settings');
      controls.pulse(0);
      assert.equal(page.$('settings-dialog').open, true);
      controls.pulse(1);
      assert.equal(page.$('settings-dialog').open, false);
      controls.reach('shell-menu');
      controls.pulse(0);
      assert.equal(page.$('shell-home').open, true);
      assert.equal(page.doc.activeElement.id, 'shell-course-return');
      for (const id of [
        'shell-featured',
        'shell-play',
        'shell-worlds',
        'shell-library',
        'shell-gallery',
        'shell-guide',
        'shell-continue',
      ])
        assert.equal(
          page.$(id).hidden,
          true,
          `${id} does not offer an unavailable course destination`,
        );
      for (const element of page.doc.querySelectorAll('.home-actions a, .shell-tools'))
        assert.equal(element.hidden, true);
      const menuVisits = new Set();
      for (let i = 0; i < 25; i++) {
        key(page, 'Tab');
        menuVisits.add(page.doc.activeElement.id);
      }
      assert.ok(menuVisits.has('shell-course-return'));
      assert.ok(menuVisits.has('shell-options'));
      assert.ok(menuVisits.has('shell-music'));
      controls.frame(); // Observe a released pad after the keyboard-to-controller change.
      controls.reach('shell-course-return');
      controls.pulse(0);
      assert.equal(page.$('shell-home').open, false);
      frames(page, 20);
      unchanged(page, before);
      assert.equal(
        page.storage.writes.length,
        writes,
        'navigation awards and saves no course progress',
      );
      assert.deepEqual(page.errors, []);
    });
  }
  test(`${policy}: ended embedded First Flight hides shell actions and keeps the terminal reader`, async (t) => {
    const page = await fixture(t, policy, {
      search: `?course=first-flight&lesson=close-line&turn-policy=${policy}`,
      parentWindow: {},
    });
    const before = snapshot(page),
      controls = pad(page, t);
    page.$('first-flight-exit').focus();
    key(page, 'Enter');
    assert.equal(page.$('game-overlay').dataset.kind, 'course-ended');
    assert.equal(page.doc.querySelector('.shell-bar').hidden, true);
    assert.equal(page.$('overlay-menu').hidden, true);
    for (let i = 0; i < 25; i++) {
      key(page, 'Tab');
      controls.pulse(13);
      assert.equal(!!page.doc.activeElement.closest('.shell-bar'), false);
    }
    for (const [, dialog] of headers) assert.notEqual(page.$(dialog)?.open, true);
    frames(page, 20);
    unchanged(page, before);
    assert.deepEqual(page.errors, []);
  });
}
