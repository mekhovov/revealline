import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, SoloElement } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const failCampaign = {
  version: 'xonix-campaign.v1',
  id: 'terminal-navigation',
  revision: '1',
  title: 'Terminal navigation',
  classRecipes: classes,
  levels: [retryFixture('self-contact').level],
};
function key(page, key, extra = {}) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key, code: key === ' ' ? 'Space' : key, ...extra });
  // Native button activation is the modeled DOM boundary, never a game action stub.
  if (!event.defaultPrevented && ['Enter', ' '].includes(key) && target.tagName === 'BUTTON')
    target.click();
  const dialog = target.closest('dialog[open]');
  if (!event.defaultPrevented && key === 'Tab' && dialog) {
    // Native Tab advances editable controls; menu arrows intentionally remain
    // native inside a select/input instead of skipping or changing its owner.
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
    stops[stops.indexOf(target) + (extra.shiftKey ? -1 : 1)]?.focus();
  }
  target.emit('keyup', { key, code: key === ' ' ? 'Space' : key, ...extra });
  return event;
}
function steps(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}
async function win(t) {
  const page = await soloPage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  const run = page.rendered.run,
    reference = createRun(run.level, {
      seed: run.seed,
      classId: run.classId,
      turnPolicy: run.turnPolicy,
      classRecipes: run.classRecipes,
    });
  // A legal current First Signal route: wait for the patrol to clear the
  // crossing, then make one cut. Authored enemies, tuning and outcomes stay intact.
  for (let i = 0; i < 180; i++) {
    stepRun(reference, {}, FIXED_DT);
    page.frame();
  }
  page.key('ArrowDown');
  for (let i = 0; i < 469; i++) {
    stepRun(reference, { direction: 'down' }, FIXED_DT);
    page.frame();
  }
  page.key('ArrowDown', false);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
  assert.equal(reference.status, 'won');
  assert.equal(run.tick, 649);
  assert.equal(run.lives, 3);
  assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
  if (!page.$('skip-celebration').hidden) page.$('skip-celebration').click();
  page.frame(0);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  return page;
}
function controller(page, t) {
  let now = 1000;
  const previous = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    previous ? Object.defineProperty(performance, 'now', previous) : delete performance.now,
  );
  const pad = {
    index: 0,
    id: 'Terminal controls',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = () => {
    now += 16;
    page.frame(16);
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
  };
  frame();
  // A neutral sample connects automatically; Confirm is now a real menu action.
  frame();
  return { frame, pulse, pad };
}

function nativeModalBoundary(t) {
  const open = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close;
  const origins = new WeakMap();
  SoloElement.prototype.showModal = function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    open.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled)')?.focus();
  };
  SoloElement.prototype.close = function () {
    if (!this.open) return;
    close.call(this);
    const origin = origins.get(this);
    if (origin?.isConnected && !origin.closest('[hidden]')) origin.focus();
  };
  t.after(() => {
    SoloElement.prototype.showModal = open;
    SoloElement.prototype.close = close;
  });
}

const resultActions = [
  'next-button',
  'view-picture',
  'retry-button',
  'choose-appearance',
  'overlay-menu',
  'shell-menu',
  'shell-packs',
  'shell-collection',
  'shell-settings',
];
function resultSurface(page) {
  for (const id of resultActions) assert.equal(page.$(id).hidden, false);
  const unrelated = page.doc.createElement('button');
  unrelated.id = 'unrelated-result-body-action';
  page.doc.body.append(unrelated);
  return (visited) => {
    const id = page.doc.activeElement.id;
    assert.ok(resultActions.includes(id), `${id} stays in results plus visible header actions`);
    visited.add(id);
  };
}

test('real win focuses results; keyboard arrows and Tab include visible headers and exclude unrelated or flight controls', async (t) => {
  const page = await win(t),
    checkpoint = authoritativeCheckpoint(page.rendered.run),
    recordFocus = resultSurface(page);
  assert.equal(page.doc.activeElement.id, 'next-button');
  const visited = new Set();
  for (let i = 0; i < resultActions.length * 2; i++) {
    recordFocus(visited);
    const event = key(page, 'ArrowDown');
    assert.equal(event.defaultPrevented, true);
    recordFocus(visited);
  }
  assert.deepEqual(visited, new Set(resultActions), 'every result/header action is reachable');
  visited.clear();
  page.$('choose-appearance').focus();
  for (let i = 0; i < resultActions.length * 2; i++) {
    key(page, 'Tab');
    recordFocus(visited);
  }
  assert.deepEqual(visited, new Set(resultActions), 'Tab reaches the same complete action set');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
});

test('controller reaches results plus visible headers; Confirm opens picture and Back restores the same result', async (t) => {
  const page = await win(t),
    controls = controller(page, t),
    recordFocus = resultSurface(page);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    visited = new Set();
  for (let i = 0; i < resultActions.length * 2; i++) {
    recordFocus(visited);
    controls.pulse(13);
    recordFocus(visited);
  }
  assert.deepEqual(visited, new Set(resultActions), 'every result/header action is reachable');
  page.$('view-picture').focus();
  controls.pulse(0);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(page.doc.activeElement.id, 'show-result');
  controls.pulse(1);
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.doc.activeElement.id, 'view-picture');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
});

test('a legal terminal self-contact focuses Retry and keyboard retry starts only after preparation', async (t) => {
  const page = await soloPage(t, { campaign: failCampaign });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  steps(page, 30);
  page.key('ArrowDown', false);
  page.key('ArrowUp');
  steps(page, 1);
  page.key('ArrowUp', false);
  const failed = page.rendered.run;
  assert.equal(failed.status, 'lost');
  assert.equal(failed.failureCause, 'self-contact');
  const failureCheckpoint = authoritativeCheckpoint(failed);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(page.doc.activeElement.id, 'skip-celebration');
  steps(page, 80);
  assert.deepEqual(authoritativeCheckpoint(failed), failureCheckpoint);
  assert.equal(page.$('game-overlay').dataset.kind, 'lost');
  assert.equal(page.doc.activeElement.id, 'retry-button');
  key(page, 'Enter');
  page.frame(0);
  assert.equal(page.rendered.run, failed, 'The result survives while Retry prepares.');
  assert.deepEqual(authoritativeCheckpoint(failed), failureCheckpoint);
  assert.equal(page.$('game-overlay').dataset.kind, 'lost');
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  assert.notEqual(page.rendered.run, failed);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(page.doc.activeElement.id, 'game-canvas');
  assert.equal(page.rendered.run.status, 'running');
  assert.equal(page.rendered.run.tick, 0);
  const initial = [page.rendered.run.player.x, page.rendered.run.player.y];
  steps(page, 6);
  assert.deepEqual([page.rendered.run.player.x, page.rendered.run.player.y], initial);
  assert.deepEqual(page.errors, []);
});

test('held Confirm cannot cross Next adoption into another action; Pause requires fresh Resume', async (t) => {
  const page = await win(t),
    controls = controller(page, t);
  const previous = page.rendered.run,
    resultCheckpoint = authoritativeCheckpoint(previous);
  page.$('next-button').focus();
  controls.pad.buttons[0] = { pressed: true, value: 1 };
  controls.frame();
  for (let i = 0; i < 5; i++) controls.frame();
  assert.equal(page.rendered.run, previous, 'Held Confirm does not replace a pending result.');
  assert.deepEqual(authoritativeCheckpoint(previous), resultCheckpoint);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  const next = page.rendered.run;
  assert.notEqual(next, previous);
  assert.notEqual(next.levelId, previous.levelId);
  assert.equal(next.tick, 0);
  assert.equal(page.$('game-overlay').hidden, true, 'The accepted Next action starts directly.');
  assert.equal(page.doc.activeElement.id, 'game-canvas');
  const location = [next.player.x, next.player.y];
  for (let i = 0; i < 6; i++) controls.frame();
  assert.equal(page.rendered.run, next, 'Held Confirm cannot select another destination.');
  assert.deepEqual([next.player.x, next.player.y], location, 'Menu Confirm adds no movement.');
  page.key('Escape');
  page.frame(0);
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  assert.equal(page.doc.activeElement.id, 'start-button');
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  const paused = authoritativeCheckpoint(next);
  for (let i = 0; i < 6; i++) controls.frame();
  assert.equal(page.doc.body.dataset.flightState, 'paused', 'Still-held Confirm cannot Resume.');
  assert.deepEqual(authoritativeCheckpoint(next), paused);
  controls.pad.buttons[0] = { pressed: false, value: 0 };
  controls.frame();
  assert.equal(key(page, 'Enter', { repeat: true }).defaultPrevented, true);
  key(page, 'Escape', { repeat: true });
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(authoritativeCheckpoint(next), paused);
  key(page, 'Enter');
  steps(page, 6);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.rendered.run, next);
  assert.deepEqual([next.player.x, next.player.y], location);
  assert.deepEqual(page.errors, []);
});

test('short results omit reading controls; overflow reading scrolls by keyboard and ends without launching', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver'),
    observers = [];
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target) {
        this.target = target;
      }
      disconnect() {
        this.disconnected = true;
      }
    },
  });
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, 'ResizeObserver', previous)
      : delete globalThis.ResizeObserver,
  );
  const page = await win(t),
    region = page.$('overlay-reading');
  const resize = observers.find((observer) => observer.target === region);
  assert.ok(resize);
  assert.equal(page.$('overlay-read').hidden, true);
  assert.equal(page.$('overlay-reading-done').hidden, true);
  assert.equal(page.$('overlay-reading-hint').hidden, true);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  // Layout/ResizeObserver is modeled; actual reading handlers and key routing run.
  region.clientHeight = 100;
  region.scrollHeight = 450;
  resize.callback();
  assert.equal(page.$('overlay-read').hidden, false);
  assert.equal(page.$('overlay-reading-done').hidden, true);
  page.$('overlay-read').focus();
  key(page, 'Enter');
  assert.equal(page.doc.activeElement.id, region.id);
  assert.equal(page.$('overlay-reading-done').hidden, false);
  key(page, 'ArrowDown');
  assert.ok(region.scrollTop > 0);
  key(page, 'End');
  assert.equal(region.scrollTop, 350);
  key(page, 'Home');
  assert.equal(region.scrollTop, 0);
  key(page, 'PageDown');
  assert.equal(region.scrollTop, 100);
  key(page, ' ');
  assert.equal(page.doc.activeElement.id, 'overlay-read');
  assert.equal(page.$('overlay-reading-done').hidden, true);
  assert.equal(page.$('overlay-reading-hint').hidden, true);
  key(page, 'Enter');
  controller(page, t);
  assert.equal(page.doc.body.dataset.inputMode, 'controller');
  page
    .$('overlay-reading-done')
    .emit('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true });
  assert.equal(page.doc.body.dataset.inputMode, 'touch');
  page.$('overlay-reading-done').click();
  assert.equal(page.doc.activeElement.id, 'overlay-read');
  region.scrollHeight = 100;
  resize.callback();
  assert.equal(page.$('overlay-read').hidden, true);
  assert.equal(page.doc.activeElement.id, 'next-button');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
});

test('result keyboard picture/Back and current appearance setup return keep the same earned attempt', async (t) => {
  const page = await win(t),
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('view-picture').focus();
  key(page, 'Enter');
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'picture');
  key(page, 'Escape');
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'result');
  assert.equal(page.doc.activeElement.id, 'view-picture');
  page.$('choose-appearance').focus();
  key(page, 'Enter');
  await settle(
    () => page.$('journey-chooser')?.open && page.doc.activeElement.id === 'body-select',
  );
  assert.equal(page.$('journey-chooser').open, true);
  assert.equal(page.doc.activeElement.id, 'body-select');
  assert.equal(page.$('body-select').closest('details').open, true);
  assert.equal(key(page, 'ArrowDown').defaultPrevented, false, 'Native select editing is retained');
  page.$('journey-back').focus();
  key(page, 'Enter');
  assert.equal(page.$('journey-chooser').open, false);
  assert.equal(page.doc.activeElement.id, 'choose-appearance');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('final installed campaign keeps its result while keyboard Missions opens the shared library and returns', async (t) => {
  const source = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  source.id = 'terminal-final-campaign';
  source.campaigns = [
    {
      ...source.campaigns[0],
      id: 'terminal-final-campaign',
      levels: [
        { ...failCampaign.levels[0], id: 'terminal-final-mission', goal: { coverage: 0.1 } },
      ],
    },
  ];
  source.levelVisuals = [];
  source.visualOverrides = {};
  const { pack } = await preparePack(source),
    assets = managedIndexedDB();
  const db = await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(
        exportPackLibrary(installPack(emptyPackLibrary(), pack)),
        'revealline.packs.dev.v1',
      );
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  const page = await soloPage(t, { assetIndexedDB: assets.indexedDB });
  await openMissionLibrary(page, 'shell-packs');
  page.change('journey-collection', 'Custom');
  const card = [...page.$('journey-cards').children].find(
    (node) => JSON.parse(node.dataset.missionId)[3] === 'terminal-final-mission',
  );
  assert(card);
  card.focus();
  key(page, 'Enter');
  await settle(() => {
    page.frame(0);
    return (
      page.doc.body.dataset.flightState === 'running' &&
      page.rendered.run.levelId === 'terminal-final-mission'
    );
  });
  assert.equal(page.rendered.run.levelId, 'terminal-final-mission');
  page.key('ArrowDown');
  for (let i = 0; i < 1200 && page.rendered.run.status === 'running'; i++) page.frame();
  page.key('ArrowDown', false);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
  if (!page.$('skip-celebration').hidden) {
    assert.equal(page.doc.activeElement.id, 'skip-celebration');
    key(page, 'Enter');
    page.frame(0);
  }
  assert.equal(page.doc.activeElement.id, 'next-button');
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  key(page, 'Enter');
  await settle(() =>
    /End of the Solo mission library/.test(page.$('flight-preparation-status').textContent),
  );
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  const opener = page.$('shell-packs'),
    handler = opener.onclick;
  let opening;
  opener.onclick = (...args) => (opening = handler.apply(opener, args));
  try {
    opener.focus();
    key(page, 'Enter');
  } finally {
    opener.onclick = handler;
  }
  assert(opening instanceof Promise);
  await opening;
  assert.equal(page.$('journey-chooser').open, true);
  assert.equal(JSON.parse(page.doc.activeElement.dataset.missionId)[3], 'terminal-final-mission');
  page.$('journey-back').focus();
  key(page, 'Enter');
  assert.equal(page.$('journey-chooser').open, false);
  assert.equal(page.doc.activeElement, opener);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});

for (const pointerId of [41, undefined])
  test(`native input modality follows fresh keyboard/touch/controller events without held-pad reclaim (${pointerId === undefined ? 'missing synthetic pointer ID' : 'captured pointer 41'})`, async (t) => {
    const page = await soloPage(t),
      controls = controller(page, t);
    assert.equal(page.doc.body.dataset.inputMode, 'controller');
    key(page, 'ArrowDown');
    assert.equal(page.doc.body.dataset.inputMode, 'keyboard');
    page.$('start-button').focus();
    key(page, 'Enter');
    await settle(() => page.doc.body.dataset.flightState === 'running');
    controls.frame();
    controls.pad.buttons[15] = { pressed: true, value: 1 };
    controls.frame();
    assert.equal(page.doc.body.dataset.inputMode, 'controller');
    page.$('game-canvas').emit('pointerdown', {
      pointerId,
      clientX: 100,
      clientY: 100,
      pointerType: 'touch',
      button: 0,
      isPrimary: true,
    });
    assert.equal(page.doc.body.dataset.inputMode, 'touch');
    for (let i = 0; i < 5; i++) controls.frame();
    assert.equal(page.doc.body.dataset.inputMode, 'touch');
    controls.pad.buttons[15] = { pressed: false, value: 0 };
    controls.frame();
    controls.pad.buttons[13] = { pressed: true, value: 1 };
    controls.frame();
    assert.equal(page.doc.body.dataset.inputMode, 'controller');
    assert.equal(page.$('encounter-status').dataset.kind, 'classic');
    assert.equal(
      page.$('game-overlay').hidden,
      true,
      'Intentional controller handoff must not cancel and pause the active flight.',
    );
    assert.equal(page.rendered.run.status, 'running');
    assert.deepEqual(page.errors, []);
  });

for (const mode of ['keyboard', 'controller']) {
  test(`${mode}: Pause → Main menu → Settings/Missions → return stays paused and preserves the live cut`, async (t) => {
    nativeModalBoundary(t);
    const page = await soloPage(t);
    key(page, 'Enter');
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    steps(page, 30);
    page.key('ArrowDown', false);
    page.key('Escape');
    page.frame(0);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    assert.equal(page.rendered.run.player.cutting, true);
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    const pad = mode === 'controller' ? controller(page, t) : null;
    const direction = () =>
      pad
        ? pad.pulse(13)
        : key(
            page,
            /^(SELECT|INPUT|TEXTAREA)$/.test(page.doc.activeElement.tagName) ? 'Tab' : 'ArrowDown',
          );
    const confirm = () => (pad ? pad.pulse(0) : key(page, 'Enter'));
    const activate = (element, root) => {
      for (let i = 0; i < 140 && page.doc.activeElement !== element; i++) {
        direction();
        assert.ok(
          root.contains(page.doc.activeElement),
          'Menu navigation remains in its active surface',
        );
      }
      assert.equal(page.doc.activeElement.id, element.id);
      assert.ok(page.doc.activeElement === element, 'Requested native control is reachable');
      const handler = element.onclick;
      let pending;
      if (handler) element.onclick = (...args) => (pending = handler.apply(element, args));
      try {
        confirm();
      } finally {
        if (handler) element.onclick = handler;
      }
      page.frame(0);
      return pending;
    };
    activate(page.$('overlay-menu'), page.$('game-overlay'));
    assert.equal(page.$('shell-home').open, true);
    activate(page.$('shell-options'), page.$('shell-home'));
    assert.equal(page.$('settings-dialog').open, true);
    activate(
      page.$('settings-dialog').querySelector('[data-close="settings-dialog"]'),
      page.$('settings-dialog'),
    );
    assert.equal(page.$('settings-dialog').open, false);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.equal(page.$('shell-home').open, true);
    assert.equal(
      page.doc.activeElement.id,
      'shell-options',
      'Settings returns to its title-menu opener while the live cut stays paused',
    );
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    const opening = activate(page.$('shell-play'), page.$('shell-home'));
    assert(opening instanceof Promise, 'The actual Missions action prepares its catalogue.');
    await opening;
    assert.equal(page.$('journey-chooser').open, true);
    activate(page.$('journey-back'), page.$('journey-chooser'));
    assert.equal(page.$('journey-chooser').open, false);
    assert.equal(page.$('shell-home').open, true);
    assert.equal(page.doc.activeElement.id, 'shell-play');
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(page.errors, []);
  });
}
