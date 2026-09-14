import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { emptyLibrary, recordLibraryCompletion, saveLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
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
  assert.equal(collectionBack(h).textContent, 'Back to Missions →');
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
  // The host now adopts a neutral controller automatically. A Confirm pulse
  // here is a deliberate action and would launch before the modal test begins.
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

test('title Field Guide returns to its opener after Back, Escape and isolated practice', async (t) => {
  nativeDialogs(t);
  // Paint is exercised in the guide panel file; this host uses its supported null Canvas boundary.
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const h = await soloPage(t, { titleScreen: true }),
    pad = controllerPad(h, t);
  h.win.crypto = globalThis.crypto;
  for (const exit of ['controller', 'escape', 'practice']) {
    h.$('shell-workshop').focus();
    h.$('shell-workshop').click();
    assert.equal(h.$('shell-workshop-dialog').open, true);
    h.$('shell-guide').focus();
    h.$('shell-guide').click();
    pad.frame();
    pad.frame();
    assert.equal(h.$('shell-home').open, true, 'The title remains underneath its guide');
    assert.equal(h.$('enemy-guide-dialog').open, true);
    if (exit === 'practice') {
      assert.equal(await h.$('enemy-guide-play').onclick(), true);
      assert.equal(h.$('enemy-guide-frame').hidden, false);
      assert.equal(new URL(h.$('enemy-guide-frame').src).searchParams.get('practice'), '1');
      assert.equal(h.$('shell-home').open, true);
      h.$('enemy-guide-return').click();
      assert.equal(h.$('enemy-guide-frame').src, 'about:blank');
      assert.equal(h.$('enemy-guide-dialog').open, true);
      assert.equal(h.doc.activeElement.id, 'enemy-guide-play');
      h.$('enemy-guide-back').click();
    } else if (exit === 'controller') pad.pulse(1);
    else h.$('enemy-guide-dialog').emit('cancel');
    await Promise.resolve();
    assert.equal(h.$('enemy-guide-dialog').open, false);
    assert.equal(h.$('shell-home').open, true);
    assert.equal(h.doc.activeElement.id, 'shell-guide');
    assert.equal(h.$('shell-workshop-dialog').open, true);
    assert.equal(h.rendered.run.tick, 0, 'Closing a lesson never starts the campaign');
    pad.frame(); // Sample neutral in the returned scope before a fresh controller Back.
    pad.pulse(1);
    await Promise.resolve();
    assert.equal(h.$('shell-workshop-dialog').open, false);
    assert.equal(h.$('shell-home').open, true);
    assert.equal(h.doc.activeElement.id, 'shell-workshop');
    pad.frame();
  }
  assert.deepEqual(h.errors, []);
});

test('Main menu Field Guide returns to Main menu over an unchanged paused-flight checkpoint', async (t) => {
  nativeDialogs(t);
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const h = await soloPage(t, { titleScreen: false }),
    pad = controllerPad(h, t);
  h.win.crypto = globalThis.crypto;
  h.$('start-button').click();
  pad.frame();
  h.$('overlay-menu').click();
  assert.equal(h.$('shell-home').open, true);
  h.$('shell-workshop').focus();
  h.$('shell-workshop').click();
  assert.equal(h.$('shell-workshop-dialog').open, true);
  h.$('shell-guide').focus();
  h.$('shell-guide').click();
  pad.frame();
  pad.frame();
  const checkpoint = structuredClone(h.rendered.run);
  assert.equal(h.$('shell-home').open, true);
  assert.equal(await h.$('enemy-guide-play').onclick(), true);
  h.$('enemy-guide-return').click();
  h.$('enemy-guide-back').click();
  await Promise.resolve();
  pad.frame();
  assert.equal(h.$('enemy-guide-dialog').open, false);
  assert.equal(h.$('shell-home').open, true);
  assert.equal(h.doc.activeElement.id, 'shell-guide');
  assert.equal(h.$('shell-workshop-dialog').open, true);
  pad.pulse(1);
  await Promise.resolve();
  assert.equal(h.$('shell-workshop-dialog').open, false);
  assert.equal(h.$('shell-home').open, true);
  assert.equal(h.doc.activeElement.id, 'shell-workshop');
  pad.pulse(1);
  await Promise.resolve();
  assert.equal(h.$('shell-home').open, false);
  assert.equal(h.$('flight-state').textContent, 'Paused');
  assert.deepEqual(structuredClone(h.rendered.run), checkpoint);
  assert.deepEqual(h.errors, []);
});

// A legal completion supplies a real Collection card; only canvas painting and
// native dialog focus/events are modeled, as in the existing modal host cases.
async function earnedTitleCollection(t) {
  nativeDialogs(t);
  t.mock.method(SoloElement.prototype, 'getContext', () => ({ drawImage() {} }));
  t.mock.method(BoardPainter.prototype, 'drawGallery', () => {});
  const classRecipes = JSON.parse(
    await readFile(new URL('../content/classes.json', import.meta.url)),
  );
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'title-collection-return',
    revision: '1',
    title: 'Title Collection return',
    classRecipes,
    levels: [
      {
        version: 'xonix-level.v1',
        id: 'return-picture',
        revision: '1',
        name: 'Return picture',
        width: 48,
        height: 36,
        spawn: { x: 24.5, y: 0.5 },
        walls: [],
        enemies: [],
        objectives: [],
        supplies: [],
        goal: { coverage: 0.5 },
      },
    ],
  };
  const run = createRun(campaign.levels[0], { classRecipes, classId: 'scout', seed: 7 });
  for (let i = 0; i < 1000 && run.status === 'running'; i++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won', 'The stored picture originates in a legal core completion.');
  const library = recordLibraryCompletion(emptyLibrary(), {
    campaign,
    result: getSummary(run),
    runId: 'collection-return-completion',
    themeId: 'fpv',
    bodyId: 'fpv-body',
    completedAt: '2026-09-14T12:00:00.000Z',
  });
  const storage = memoryStorage();
  assert.equal(saveLibrary(storage, 'revealline.library.dev.v1', library).ok, true);
  const page = await soloPage(t, { titleScreen: true, campaign, storage });
  return { page, library };
}
function collectionBack(h) {
  return h.$('collection-back');
}
function openTitleCollection(h) {
  h.$('shell-gallery').focus();
  h.$('shell-gallery').click();
  assert.equal(h.$('shell-home').open, true);
  assert.equal(h.$('collection-dialog').open, true);
  assert.equal(collectionBack(h).textContent, 'Back to menu →');
}
async function openFirstPicture(h) {
  const card = h.$('gallery-grid').querySelector('button');
  assert.ok(card && !card.disabled, 'The actual earned picture must be available.');
  card.focus();
  await card.onclick();
  assert.equal(h.$('gallery-view-dialog').open, true);
  assert.equal(h.$('collection-dialog').open, true, 'Collection retains its original opener.');
  assert.equal(h.$('gallery-replay').disabled, false);
  return card;
}
function nativeEscape(dialog) {
  const event = dialog.emit('cancel');
  if (!event.defaultPrevented) dialog.close();
}
for (const exit of ['controller', 'escape', 'close button'])
  test(`title picture ${exit} returns through Collection to its exact title opener`, async (t) => {
    const { page: h } = await earnedTitleCollection(t),
      pad = controllerPad(h, t);
    const checkpoint = authoritativeCheckpoint(h.rendered.run),
      before = [...h.storage.map],
      writes = h.storage.writes.length;
    openTitleCollection(h);
    const oldCard = await openFirstPicture(h);
    pad.frame();
    pad.frame();
    if (exit === 'controller') pad.pulse(1);
    else if (exit === 'escape') nativeEscape(h.$('gallery-view-dialog'));
    else h.$('gallery-view-dialog').querySelector('[data-close]').click();
    await settle(
      () => !h.$('gallery-view-dialog').open && h.$('gallery-grid').contains(h.doc.activeElement),
    );
    const currentCard = h.$('gallery-grid').querySelector('button');
    assert.notEqual(currentCard, oldCard, 'Back resolves the recreated card by picture identity.');
    assert.equal(h.doc.activeElement, currentCard);
    assert.equal(currentCard.children[1].textContent, oldCard.children[1].textContent);
    assert.equal(h.$('shell-home').open, true);
    nativeEscape(h.$('collection-dialog'));
    await Promise.resolve();
    pad.frame();
    assert.equal(h.$('collection-dialog').open, false);
    assert.equal(h.$('shell-home').open, true);
    assert.equal(h.doc.activeElement, h.$('shell-gallery'));
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
    assert.deepEqual([...h.storage.map], before);
    assert.equal(h.storage.writes.length, writes);
    assert.deepEqual(h.errors, []);
  });

test('picture Replay deliberately leaves title and Collection for the selected ready briefing', async (t) => {
  const { page: h, library } = await earnedTitleCollection(t);
  openTitleCollection(h);
  await openFirstPicture(h);
  h.$('gallery-replay').click();
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  await Promise.resolve();
  h.frame(0);
  for (const id of ['gallery-view-dialog', 'collection-dialog', 'shell-home', 'shell-missions'])
    assert.equal(h.$(id).open, false, `${id} must not cover the chosen briefing`);
  assert.equal(h.doc.activeElement, h.$('start-button'));
  assert.equal(h.rendered.run.level.id, 'return-picture');
  assert.equal(h.rendered.run.seed, 7);
  assert.equal(h.rendered.run.tick, 0);
  assert.equal(h.$('flight-state').textContent, 'Ready for launch');
  const after = JSON.parse(h.storage.getItem('revealline.library.dev.v1')).library;
  assert.deepEqual(after.gallery, JSON.parse(JSON.stringify(library.gallery)));
  assert.deepEqual(after.campaigns, JSON.parse(JSON.stringify(library.campaigns)));
  assert.deepEqual(h.errors, []);
});

test('Collection Choose appearance deliberately leaves title for Missions setup', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, { titleScreen: true }),
    checkpoint = authoritativeCheckpoint(h.rendered.run);
  openTitleCollection(h);
  h.$('collection-choose-appearance').click();
  await Promise.resolve();
  h.frame(0);
  assert.equal(h.$('collection-dialog').open, false);
  assert.equal(h.$('shell-home').open, false);
  assert.equal(h.$('shell-missions').open, true);
  assert.equal(h.doc.activeElement, h.$('body-select'));
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
  assert.deepEqual(h.errors, []);
});

test('Collection resets its return label from title to a direct paused-flight visit', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, { titleScreen: true });
  openTitleCollection(h);
  collectionBack(h).click();
  await Promise.resolve();
  assert.equal(h.$('shell-home').open, true);
  h.$('shell-play').click();
  h.$('shell-briefing').click();
  h.$('start-button').click();
  h.key('ArrowDown');
  h.key('ArrowDown', false);
  for (let i = 0; i < 20; i++) h.frame();
  assert.equal(h.rendered.run.player.cutting, true);
  h.$('shell-collection').focus();
  h.$('shell-collection').click();
  h.frame(0);
  const checkpoint = authoritativeCheckpoint(h.rendered.run);
  assert.equal(h.$('shell-home').open, false);
  assert.equal(collectionBack(h).textContent, 'Back to the field →');
  collectionBack(h).click();
  await Promise.resolve();
  for (let i = 0; i < 10; i++) h.frame();
  assert.equal(h.$('collection-dialog').open, false);
  assert.equal(h.$('shell-home').open, false);
  assert.equal(h.$('flight-state').textContent, 'Paused');
  assert.ok(
    h.doc.activeElement === h.$('shell-collection'),
    `Expected shell-collection; actual focus: ${h.doc.activeElement?.id || h.doc.activeElement?.tagName}`,
  );
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
  assert.deepEqual(h.errors, []);
});

test('programmatic Collection after a real win does not refocus a hidden opener', async (t) => {
  const { page: h } = await earnedTitleCollection(t);
  openTitleCollection(h);
  await openFirstPicture(h);
  h.$('gallery-replay').click();
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  h.$('start-button').click();
  h.key('ArrowDown');
  for (let i = 0; i < 1000 && h.rendered.run.status === 'running'; i++) h.frame();
  h.key('ArrowDown', false);
  assert.equal(
    h.rendered.run.status,
    'won',
    JSON.stringify({
      level: h.rendered.run.level.id,
      tick: h.rendered.run.tick,
      time: h.rendered.run.time,
      paused: h.rendered.paused,
      x: h.rendered.run.player.x,
      y: h.rendered.run.player.y,
      cutting: h.rendered.run.player.cutting,
      coverage: h.rendered.run.coverage,
      classId: h.rendered.run.classId,
      message: h.$('run-message').textContent,
      dialogs: [...h.doc.querySelectorAll('dialog[open]')].map((x) => x.id),
    }),
  );
  h.$('show-result').click();
  const hiddenOpener = h.$('start-button');
  assert.equal(hiddenOpener.hidden, true);
  // Older/embedded DOMs can retain a hidden active element. The Collection
  // handler must not deliberately refocus it during a programmatic open.
  hiddenOpener.focus();
  const focus = hiddenOpener.focus.bind(hiddenOpener);
  let refocuses = 0;
  t.mock.method(hiddenOpener, 'focus', (...args) => {
    refocuses++;
    focus(...args);
  });
  h.$('collection-button').click();
  assert.equal(refocuses, 0);
  assert.equal(h.$('collection-dialog').open, true);
  assert.equal(h.$('shell-home').open, false);
  assert.equal(collectionBack(h).textContent, 'Back to the field →');
  assert.equal(h.rendered.run.status, 'won');
  assert.deepEqual(h.errors, []);
});
