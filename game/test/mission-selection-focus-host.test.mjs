import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { emptyLibrary, recordLibraryCompletion, saveLibrary } from '../library.mjs';
import { attachMissionPicker } from '../ui/mission-picker.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'mission-focus-fixture',
  revision: '1',
  title: 'Mission Focus QA',
  classRecipes: CLASSES,
  levels: Array.from({ length: 2 }, (_, index) => ({
    version: 'xonix-level.v1',
    id: `focus-${index}`,
    revision: '1',
    name: `Completed mission ${index + 1}`,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    enemies: [],
    objectives: [],
    supplies: [],
    goal: { coverage: 0.2 },
  })),
};
function completedStorage() {
  const storage = memoryStorage();
  let library = emptyLibrary();
  for (const level of campaign.levels) {
    const run = createRun(level, { seed: 1, classId: 'scout', classRecipes: CLASSES });
    for (let tick = 0; tick < 1000 && run.status === 'running'; tick++)
      stepRun(run, { direction: 'down' }, FIXED_DT);
    assert.equal(run.status, 'won');
    library = recordLibraryCompletion(library, {
      campaign,
      result: getSummary(run),
      runId: `focus-${level.id}`,
      themeId: 'fpv',
      bodyId: 'fpv-body',
      sourcePackId: null,
      completedAt: '2026-09-21T12:00:00.000Z',
    });
  }
  assert.equal(saveLibrary(storage, 'revealline.library.dev.v1', library).ok, true);
  return storage;
}
function nativeFocus(t) {
  const remove = SoloElement.prototype.remove,
    focus = SoloElement.prototype.focus;
  t.mock.method(SoloElement.prototype, 'remove', function () {
    if (this.isConnected && this.contains(this.ownerDocument.activeElement))
      this.ownerDocument.activeElement = this.ownerDocument.body;
    return remove.call(this);
  });

  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    const doc = this.ownerDocument,
      top = doc.querySelectorAll('dialog[open]').at(-1);
    if (this.isConnected && !this.closest('[hidden],[inert]') && (!top || top.contains(this)))
      focus.apply(this, args);
  });
}
async function setup(t) {
  nativeFocus(t);
  const h = await soloPage(t, { campaign, storage: completedStorage(), titleScreen: true });
  Object.assign(h.win, h.doc.defaultView);
  h.doc.defaultView = h.win;
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  assert.equal(h.$('shell-home').open, true);
  h.$('shell-play').focus();
  h.$('shell-play').click();
  assert.equal(h.$('shell-missions').open, true);
  const profile = h.storage.getItem('revealline.library.dev.v1');
  return Object.assign(h, { profile });
}

// Native dispatch can clean up an empty JS stack between listener callbacks.
// Keep the original event path while allowing those real microtask checkpoints;
// the shared synchronous JS-dispatch helper cannot represent this boundary.
async function nativeClickWithCheckpoints(target) {
  const event = {
      type: 'click',
      target,
      bubbles: true,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.cancelBubble = true;
      },
    },
    ancestors = [];
  for (let node = target.parentNode; node; node = node.parentNode) ancestors.push(node);
  const call = async (node, capture) => {
    const map = capture ? node.captureListeners : node.listeners;
    for (const listener of [...(map.get('click') || [])]) {
      listener.call(node, event);
      await Promise.resolve();
    }
    if (!capture && node.onclick) {
      node.onclick(event);
      await Promise.resolve();
    }
  };
  for (const node of [...ancestors].reverse()) {
    await call(node, true);
    if (event.cancelBubble) return;
  }
  await call(target, true);
  await call(target, false);
  for (const node of ancestors) {
    if (event.cancelBubble) break;
    await call(node, false);
  }
}

// The finite DOM has no browser MutationObserver delivery. Model the observed
// readiness attributes, then let the actual shell callback decide Deploy state.
function readinessMutationDelivery(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver'),
    observers = new Set();
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Map();
      observers.add(this);
    }
    observe(target, options) {
      if (options.attributes)
        this.targets.set(target, { disabled: target.disabled, hidden: target.hidden });
    }
    takeRecords() {
      return [];
    }
    disconnect() {
      this.targets.clear();
      observers.delete(this);
    }
  };
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'MutationObserver', original);
    else delete globalThis.MutationObserver;
  });
  return (target) => {
    for (const observer of observers) {
      const previous = observer.targets.get(target);
      if (!previous) continue;
      const changes = Object.keys(previous)
        .filter((name) => previous[name] !== target[name])
        .map((attributeName) => ({ type: 'attributes', target, attributeName }));
      observer.targets.set(target, { disabled: target.disabled, hidden: target.hidden });
      if (changes.length) observer.callback(changes, observer);
    }
  };
}

for (const input of ['pointer', 'keyboard', 'controller'])
  test(`${input}: completed mission selection retains a connected selected card after its actual host rebuild`, async (t) => {
    const deliverReadiness = input === 'controller' ? readinessMutationDelivery(t) : null;
    const h = await setup(t),
      card = h.$('missions').querySelectorAll('button')[0];
    let controllerPad;
    assert.equal(card.disabled, false);
    assert.match(card.querySelector('.medal').textContent, /[★✓]/);
    card.focus();
    if (input === 'pointer') {
      card.emit('pointerdown', { pointerType: 'mouse' });
      await nativeClickWithCheckpoints(card.querySelector('.mission-gallery-state'));
    } else if (input === 'keyboard') {
      const event = card.emit('keydown', { key: 'Enter', code: 'Enter', repeat: false });
      if (!event.defaultPrevented) await nativeClickWithCheckpoints(card);
      card.emit('keyup', { key: 'Enter', code: 'Enter' });
    } else {
      const pad = {
        index: 0,
        id: 'Mission focus controller',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      controllerPad = pad;
      navigator.getGamepads = () => [pad];
      h.frame(0);
      pad.buttons[0] = { pressed: true, value: 1 };
      h.frame(0);
      pad.buttons[0] = { pressed: false, value: 0 };
      h.frame(0);
    }
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    await new Promise((resolve) => setImmediate(resolve));
    for (let n = 0; n < 3; n++) h.frame(0);
    const selected = h.$('missions').querySelector('.selected');
    assert.equal(h.$('shell-missions').open, true);
    assert.equal(selected?.isConnected, true);
    assert.equal(
      h.doc.activeElement === selected,
      true,
      `Focus is ${h.doc.activeElement.tagName}, expected selected mission.`,
    );
    assert.equal(
      h.$('level-select').value,
      campaign.levels[0].id,
      JSON.stringify({
        level: h.$('level-select').value,
        selected: selected?.dataset.level,
        text: h.$('content-select-status').textContent,
        visible: h.doc.querySelectorAll('dialog[open]').map((node) => node.id),
        picture: h.doc.body.dataset.pictureState,
      }),
    );
    assert.equal(h.rendered.paused, true);
    assert.equal(h.storage.getItem('revealline.library.dev.v1'), h.profile);
    if (controllerPad) {
      const pulse = (index) => {
        controllerPad.buttons[index] = { pressed: true, value: 1 };
        h.frame(0);
        controllerPad.buttons[index] = { pressed: false, value: 0 };
        h.frame(0);
      };
      const deploy = h.$('shell-deploy'),
        visited = [];
      deliverReadiness(h.$('start-button'));
      deliverReadiness(h.$('pack-select'));
      assert.equal(deploy.disabled, false);
      for (let n = 0; n < 24 && h.doc.activeElement !== deploy; n++) {
        visited.push(h.doc.activeElement.id || h.doc.activeElement.textContent.slice(0, 80));
        pulse(13);
      }
      assert.equal(h.doc.activeElement === deploy, true, JSON.stringify(visited));
      assert.equal(h.doc.body.dataset.flightState, 'briefing');
      h.frame(0); // Release the direction before South/A crosses the start boundary.
      pulse(0);
      await settle(() => h.doc.body.dataset.flightState === 'running');
      assert.equal(h.$('shell-missions').open, false);
      h.frame(0);
      assert.equal(h.rendered.paused, false);
      assert.equal(h.rendered.run.levelId, campaign.levels[0].id);
      assert.equal(h.storage.getItem('revealline.library.dev.v1'), h.profile);
    }
    assert.deepEqual(h.errors, []);
  });

for (const newer of ['another control', 'background', 'hidden page', 'Back to Home'])
  test(`queued completed-card focus does not override ${newer}`, async (t) => {
    const h = await setup(t),
      card = h.$('missions').querySelectorAll('button')[0],
      back = h.$('shell-missions-back');
    card.focus();
    card.querySelector('.mission-gallery-state').click();
    if (newer === 'another control') back.focus();
    else if (newer === 'background') h.doc.focused = false;
    else if (newer === 'hidden page') h.doc.hidden = true;
    else {
      back.focus();
      back.click();
    }
    const owned = h.doc.activeElement;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.doc.activeElement === owned, true);
    if (newer === 'Back to Home') {
      assert.equal(h.$('shell-missions').open, false);
      assert.equal(h.$('shell-home').open, true);
    }
    assert.equal(h.storage.getItem('revealline.library.dev.v1'), h.profile);
    assert.deepEqual(h.errors, []);
  });

test('a newer reopened Missions visit retains its actual chapter focus', async (t) => {
  const h = await setup(t),
    card = h.$('missions').querySelectorAll('button')[0];
  card.focus();
  card.querySelector('.mission-gallery-state').click();
  h.$('shell-missions-back').click();
  h.$('shell-play').focus();
  h.$('shell-play').click();
  const newer = h.doc.activeElement;
  assert.equal(newer.classList.contains('mission-picker-card'), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.$('shell-missions').open, true);
  assert.equal(h.doc.activeElement === newer, true);
  assert.deepEqual(h.errors, []);
});

test('destroying the picker retires queued card focus and removes both click listeners', async (t) => {
  const h = await setup(t),
    picker = attachMissionPicker({ document: h.doc }),
    missions = h.$('missions'),
    card = missions.querySelectorAll('button')[0];
  card.focus();
  card.querySelector('.mission-gallery-state').click();
  picker.destroy();
  const owned = h.doc.activeElement;
  assert.equal(missions.captureListeners.get('click')?.size ?? 0, 0);
  assert.equal(missions.listeners.get('click')?.size ?? 0, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.doc.activeElement === owned, true);
  assert.deepEqual(h.errors, []);
});
