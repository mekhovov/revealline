import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { teamReturnHref } from '../mode-return.mjs';
import { readVersusSoloReturnToken } from '../mode-return-v2.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes, provenance, libraryRecord, deferred } from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { campaignKey } from '../library.mjs';

const slot = 'revealline.suspended.dev.v1';
const homeURL = 'http://localhost/game/';
const hintKeys = ['revealline.mode-return.v1:/game/', 'revealline.mode-return.v2:/game/'];
const destinations = { team: 'couch/relay-rescue.html?return=solo', versus: 'couch/?return=solo' };
// Model native top-layer focus and cancel defaults only. Actual app, shell,
// controller navigation, replay, storage and mode presenter execute unchanged.
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
    if (this.contains(this.ownerDocument.activeElement))
      this.ownerDocument.activeElement = this.ownerDocument.body;
    close.call(this);
  });
  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    const top = opened.filter((e) => e.open).at(-1);
    if (!this.closest('[hidden],[inert],dialog:not([open])') && (!top || top.contains(this)))
      focus.apply(this, args);
  });
}
async function host(t, options = {}) {
  nativeDialogs(t);
  return soloPage(t, { titleScreen: true, ...options });
}
function action(element) {
  const original = element.onclick;
  let result;
  element.onclick = function (event) {
    result = original.call(this, event);
    return result;
  };
  try {
    element.click();
  } finally {
    element.onclick = original;
  }
  return Promise.resolve(result);
}
function press(h, key) {
  const target = h.doc.activeElement,
    event = target.emit('keydown', { key, code: key, repeat: false });
  let result;
  if (!event.defaultPrevented && key === 'Enter' && ['BUTTON', 'A'].includes(target.tagName))
    result = action(target);
  if (!event.defaultPrevented && key === 'Escape') {
    const dialog = target.closest('dialog[open]');
    if (dialog && !dialog.emit('cancel', { bubbles: false }).defaultPrevented) dialog.close();
  }
  target.emit('keyup', { key, code: key });
  return Promise.resolve(result);
}
function checkpoint(h) {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
}
function frozen(h, before) {
  for (let i = 0; i < 8; i++) h.frame();
  assert.deepEqual(checkpoint(h), before);
  assert.equal(h.rendered.paused, true);
  assert.deepEqual(h.errors, []);
}
async function flight(t, options = {}) {
  const h = await host(t, options);
  if (options.policy === 'grid-center') {
    h.change('turn-select', 'grid-center');
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
  }
  h.$('shell-featured').focus();
  await press(h, 'Enter');
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.key('ArrowDown');
  for (let i = 0; i < 12; i++) h.frame();
  h.key('ArrowDown', false);
  h.key('ArrowRight');
  h.frame();
  h.key('ArrowRight', false);
  assert.equal(h.rendered.run.player.cutting, true);
  h.$('shell-menu').click();
  assert.equal(h.$('shell-home').open, true);
  return h;
}
function request(h, kind) {
  h.$(`shell-title-${kind}`).focus();
  assert.equal(h.doc.activeElement.id, `shell-title-${kind}`);
  return press(h, 'Enter');
}
function hintGuard(storage) {
  const calls = [];
  for (const name of ['getItem', 'setItem', 'removeItem']) {
    const method = storage[name].bind(storage);
    storage[name] = (key, ...args) => {
      if (hintKeys.includes(key)) {
        calls.push([name, key]);
        throw new Error('Title does not need a return-hint store.');
      }
      return method(key, ...args);
    };
  }
  return calls;
}
for (const kind of ['versus', 'team']) {
  test(`ready Title ${kind} is a real fixed link, has no hint storage, and Back opens Title without Start`, async (t) => {
    const previewStorage = memoryStorage(),
      storage = memoryStorage();
    let target;
    await t.test('actual Title row and keyboard activation', async (t) => {
      const h = await host(t, { previewStorage, storage });
      const before = checkpoint(h),
        row = h.$('shell-title-modes');
      assert.equal(row.hidden, false);
      assert.deepEqual(
        row.children.map((e) => e.dataset.gameMode),
        ['solo', 'versus', 'team'],
      );
      assert.equal(row.children[0].tagName, 'SPAN');
      assert.equal(row.children[0].getAttribute('aria-current'), 'page');
      assert.equal(row.children[0].getAttribute('tabindex'), null);
      row.children[0].click();
      assert.deepEqual(checkpoint(h), before);
      const calls = hintGuard(previewStorage);
      assert.equal(h.$(`shell-title-${kind}`).getAttribute('href'), destinations[kind]);
      await request(h, kind);
      target = globalThis.location.href;
      assert.equal(target, homeURL + destinations[kind]);
      assert.equal(h.$('mode-leave-dialog').open, false);
      assert.equal(h.$('shell-missions').open, false);
      assert.equal(storage.getItem(slot), null);
      assert.deepEqual(calls, []);
      frozen(h, before);
    });
    await t.test('fixed receiving route with no automatic continuation', async (t) => {
      if (kind === 'team')
        assert.equal(teamReturnHref({ href: target, storage: previewStorage }), '../');
      else assert.equal(readVersusSoloReturnToken({ href: target, storage: previewStorage }), null);
      const h = await host(t, { storage });
      assert.equal(h.$('shell-home').open, true);
      assert.equal(h.$('shell-missions').open, false);
      assert.match(h.$('shell-destination').textContent, /Start · First Signal/);
      assert.equal(h.doc.body.dataset.flightState, 'briefing');
    });
  });
  for (const policy of ['immediate', 'grid-center'])
    test(`${kind}/${policy}: Stay preserves the exact cut and actual Title opener; explicit Leave retains a verified save without a hint`, async (t) => {
      const previewStorage = memoryStorage();
      const h = await flight(t, { policy, previewStorage });
      const before = checkpoint(h),
        calls = hintGuard(previewStorage);
      await request(h, kind);
      assert.match(h.$('mode-leave-status').textContent, /saved and verified/);
      assert.match(h.$('mode-leave-status').textContent, /opens Solo’s title; it does not resume/);
      assert.doesNotMatch(
        h.$('mode-leave-status').textContent,
        /context is unavailable|Missions selection/,
      );
      const saved = h.storage.getItem(slot);
      assert.equal(h.doc.activeElement.id, 'mode-leave-stay');
      await press(h, 'Enter');
      assert.equal(h.doc.activeElement.id, `shell-title-${kind}`);
      assert.equal(h.$('shell-home').open, true);
      assert.equal(h.storage.getItem(slot), saved);
      frozen(h, before);
      await request(h, kind);
      const retained = h.storage.getItem(slot);
      h.$('mode-leave-confirm').focus();
      await press(h, 'Enter');
      assert.equal(globalThis.location.href, homeURL + destinations[kind]);
      h.win.emit('pagehide', { persisted: true });
      assert.equal(h.storage.getItem(slot), retained);
      assert.deepEqual(calls, []);
      frozen(h, before);
    });
}
for (const method of ['button', 'Escape', 'controller'])
  test(`${method}: pending retention Stay cannot later save, navigate or resume`, async (t) => {
    let pad = null;
    const h = await flight(t, { readPads: () => (pad ? [pad] : []) });
    const before = checkpoint(h),
      raw = h.storage.getItem(slot);
    let release;
    navigator.locks.request = async (_name, _options, work) => {
      if (!release)
        await new Promise((resolve) => {
          release = resolve;
        });
      return work();
    };
    const pending = request(h, 'team');
    await settle(() => !!release);
    assert.equal(h.$('mode-leave-confirm').disabled, true);
    h.$('mode-leave-confirm').click();
    assert.equal(globalThis.location.href, homeURL);
    if (method === 'button') await press(h, 'Enter');
    else if (method === 'Escape') await press(h, 'Escape');
    else {
      pad = {
        index: 0,
        id: 'Title controller',
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
    assert.equal(h.$('mode-leave-dialog').open, false);
    assert.equal(h.doc.activeElement.id, 'shell-title-team');
    release();
    await pending;
    assert.equal(globalThis.location.href, homeURL);
    assert.equal(h.storage.getItem(slot), raw);
    frozen(h, before);
  });
for (const reason of ['blur', 'hidden', 'pagehide', 'close-reopen', 'newer-focus'])
  test(`${reason}: a retired Title origin cannot navigate or reclaim focus after retention settles`, async (t) => {
    const h = await flight(t),
      before = checkpoint(h),
      raw = h.storage.getItem(slot);
    let release;
    navigator.locks.request = async (_name, _options, work) => {
      if (!release)
        await new Promise((resolve) => {
          release = resolve;
        });
      return work();
    };
    const pending = request(h, 'versus');
    await settle(() => !!release);
    if (reason === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    }
    if (reason === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (reason === 'pagehide') {
      h.doc.hidden = true;
      h.win.emit('pagehide', { persisted: true });
    }
    if (reason === 'close-reopen') {
      h.$('shell-home').close();
      h.$('shell-menu').click();
    }
    if (reason === 'newer-focus') {
      h.$('shell-home').close();
      h.$('settings-dialog').showModal();
      h.$('master-volume').focus();
    }
    if (['blur', 'hidden', 'pagehide'].includes(reason)) {
      await Promise.resolve();
      assert.equal(h.doc.activeElement.tagName, 'BODY', 'Background close must not restore focus.');
    }
    h.doc.focused = true;
    h.doc.hidden = false;
    if (['blur', 'hidden', 'pagehide'].includes(reason)) h.$('shell-settings').focus();
    const chosen = h.doc.activeElement;
    release();
    await pending;
    h.$('mode-leave-confirm').click();
    assert.equal(globalThis.location.href, homeURL);
    h.$('mode-leave-dialog').close();
    assert.equal(
      h.doc.activeElement.id || h.doc.activeElement.tagName,
      chosen.id || chosen.tagName,
      'Old close cannot take a newer focus choice.',
    );
    assert.equal(h.storage.getItem(slot), raw);
    frozen(h, before);
  });
for (const reason of ['quota', 'readback', 'newer-before', 'newer-after'])
  test(`${reason}: Title departure keeps truthful save authority and preserves newer bytes`, async (t) => {
    const h = await flight(t),
      before = checkpoint(h);
    const get = h.storage.getItem.bind(h.storage),
      set = h.storage.setItem.bind(h.storage);
    let written = false,
      newer;
    if (reason === 'newer-before') {
      newer = JSON.stringify({ ...JSON.parse(get(slot)), savedAt: '2026-09-16T00:00:00.000Z' });
      set(slot, newer);
    }
    h.storage.setItem = (key, value) => {
      if (key === slot && reason === 'quota') throw new Error('quota');
      set(key, value);
      if (key === slot) written = true;
    };
    h.storage.getItem = (key) =>
      key === slot && written && reason === 'readback' ? '{}' : get(key);
    await request(h, 'team');
    if (reason === 'newer-after') {
      assert.match(h.$('mode-leave-status').textContent, /saved and verified/);
      newer = JSON.stringify({ ...JSON.parse(get(slot)), savedAt: '2026-09-16T00:00:00.000Z' });
      set(slot, newer);
      h.$('mode-leave-confirm').click();
      assert.equal(globalThis.location.href, homeURL);
      assert.match(h.$('mode-leave-status').textContent, /Review this warning/);
    }
    assert.match(h.$('mode-leave-status').textContent, /session-only.*Leaving may lose/);
    assert.doesNotMatch(h.$('mode-leave-status').textContent, /saved and verified/);
    if (newer) assert.equal(get(slot), newer);
    h.$('mode-leave-confirm').click();
    assert.equal(globalThis.location.href, homeURL + destinations.team);
    if (newer) assert.equal(get(slot), newer);
    frozen(h, before);
  });
test('modified Title links retain native defaults; rejected direct navigation leaves a fresh retry available', async (t) => {
  const h = await host(t),
    link = h.$('shell-title-versus');
  const event = link.emit('click', { ctrlKey: true });
  assert.equal(event.defaultPrevented, false);
  assert.equal(h.$('mode-leave-dialog').open, false);
  assert.equal(globalThis.location.href, homeURL);
  let current = homeURL;
  Object.defineProperty(globalThis.location, 'href', {
    configurable: true,
    get: () => current,
    set: () => {
      throw new Error('Navigation refused');
    },
  });
  await request(h, 'versus');
  assert.match(h.$('run-message').textContent, /could not open.*Navigation refused/);
  Object.defineProperty(globalThis.location, 'href', {
    configurable: true,
    get: () => current,
    set: (value) => {
      current = value;
    },
  });
  await request(h, 'versus');
  assert.equal(current, homeURL + destinations.versus);
});

class Picture {
  constructor() {
    this.width = this.height = this.naturalWidth = this.naturalHeight = 1;
  }
  set src(value) {
    this.url = value;
    if (value) queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this.url;
  }
  decode() {
    return Promise.resolve();
  }
  removeAttribute() {
    this.url = '';
  }
}
async function pictureFixture(t) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
  const campaign = read('../content/campaign.json'),
    themes = read('../content/themes.json').themes,
    classRecipes = read('../content/classes.json');
  const catalog = createExecutionCatalog([{ campaign, classRecipes, themes }]);
  const identity = {
    baseCampaignKey: campaignKey(campaign),
    levelId: campaign.levels[0].id,
    levelRevision: campaign.levels[0].revision,
    themeId: 'fpv',
  };
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  const asset = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const library = libraryRecord(identity);
  library.assets = [asset.asset];
  await store.commit(
    await store.prepare(library, [{ sha256: asset.asset.sha256, blob: asset.blob }], {
      executionCatalog: catalog,
    }),
    { expectedGeneration: 0 },
  );
  t.after(() => manager.close());
  return { memory, campaign };
}
for (const kind of ['versus', 'team'])
  test(`pending Title Start → ${kind} cancels launch before fixed departure; late media cannot Start or take focus`, async (t) => {
    const f = await pictureFixture(t),
      gate = deferred();
    let decoding = 0;
    class Slow extends Picture {
      decode() {
        decoding++;
        return gate.promise;
      }
    }
    const h = await host(t, {
      campaign: f.campaign,
      soundtrackIndexedDB: f.memory.indexedDB,
      pictures: { Image: Slow },
      waitForPictures: false,
    });
    await settle(() => decoding > 0);
    const before = checkpoint(h);
    h.$('shell-featured').focus();
    const starting = press(h, 'Enter');
    assert.equal(h.$('shell-flight-cancel').hidden, false);
    await request(h, kind);
    assert.equal(globalThis.location.href, homeURL + destinations[kind]);
    const chosen = h.doc.activeElement;
    gate.resolve();
    await starting;
    assert.equal(h.$('shell-flight-cancel').hidden, true);
    assert.equal(
      h.doc.activeElement.id || h.doc.activeElement.tagName,
      chosen.id || chosen.tagName,
    );
    assert.equal(h.$('shell-missions').open, false);
    frozen(h, before);
  });

for (const kind of ['versus', 'team'])
  test(`pending saved Continue → ${kind} cancels adoption, retains stored bytes and permits a fresh departure after cleanup`, async (t) => {
    const f = await pictureFixture(t),
      storage = memoryStorage();
    await t.test('seed actual saved picture and cut', async (t) => {
      const h = await flight(t, {
        storage,
        campaign: f.campaign,
        soundtrackIndexedDB: f.memory.indexedDB,
        pictures: { Image: Picture },
      });
      assert.ok(JSON.parse(storage.getItem(slot)).presentationPins);
      assert.equal(h.rendered.run.player.cutting, true);
    });
    const captured = storage.getItem(slot);
    await t.test('cancel pending restore through the real Title anchor', async (t) => {
      const gate = deferred();
      let decodes = 0;
      class RestorePicture extends Picture {
        decode() {
          decodes++;
          return decodes === 1 ? Promise.resolve() : gate.promise;
        }
      }
      const h = await host(t, {
        storage,
        campaign: f.campaign,
        soundtrackIndexedDB: f.memory.indexedDB,
        pictures: { Image: RestorePicture },
      });
      const before = checkpoint(h),
        old = h.rendered.run;
      h.$('shell-continue').focus();
      const pending = press(h, 'Enter');
      await settle(() => decodes >= 2);
      assert.equal(h.$('shell-flight-cancel').hidden, false);
      await request(h, kind);
      // The real restore owns sessionBusy until its asynchronous finally runs.
      assert.equal(globalThis.location.href, homeURL);
      assert.match(h.$('run-message').textContent, /Finish the current operation/);
      gate.resolve();
      await pending;
      await settle(() => !h.$('continue-saved').disabled);
      assert.equal(h.rendered.run === old, true);
      assert.equal(storage.getItem(slot), captured);
      frozen(h, before);
      assert.equal(h.doc.activeElement.id, `shell-title-${kind}`);
      await request(h, kind);
      assert.equal(globalThis.location.href, homeURL + destinations[kind]);
      assert.equal(storage.getItem(slot), captured);
      frozen(h, before);
    });
  });

for (const kind of ['versus', 'team'])
  test(`saved Continue: explicit keyboard Cancel then ${kind} preserves newer focus when the retired picture decode rejects`, async (t) => {
    const f = await pictureFixture(t),
      storage = memoryStorage();
    await t.test('seed an actual saved original and unfinished cut', async (t) => {
      const h = await flight(t, {
        storage,
        policy: 'grid-center',
        campaign: f.campaign,
        soundtrackIndexedDB: f.memory.indexedDB,
        pictures: { Image: Picture },
      });
      assert.ok(JSON.parse(storage.getItem(slot)).presentationPins);
      assert.equal(h.rendered.run.player.cutting, true);
    });
    const captured = storage.getItem(slot);
    await t.test('Cancel, attempt mode departure, then reject only the old decode', async (t) => {
      const gate = deferred();
      let decodes = 0;
      class RestorePicture extends Picture {
        decode() {
          decodes++;
          return decodes === 1 ? Promise.resolve() : gate.promise;
        }
      }
      const h = await host(t, {
        storage,
        campaign: f.campaign,
        soundtrackIndexedDB: f.memory.indexedDB,
        pictures: { Image: RestorePicture },
      });
      const before = checkpoint(h),
        old = h.rendered.run;
      h.$('shell-continue').focus();
      const pending = press(h, 'Enter');
      await settle(() => decodes >= 2);
      assert.equal(h.$('shell-flight-cancel').hidden, false);
      assert.equal(h.doc.activeElement.id, 'shell-flight-cancel');
      await press(h, 'Enter');
      assert.equal(h.$('shell-flight-cancel').hidden, true);
      assert.equal(h.doc.activeElement.id, 'shell-continue');
      assert.equal(h.$('shell-continue').disabled, false);
      assert.equal(h.$('continue-saved').disabled, true, 'The actual restore still owns cleanup');
      assert.equal(storage.getItem(slot), captured);
      await request(h, kind);
      assert.equal(globalThis.location.href, homeURL);
      assert.equal(h.doc.activeElement.id, `shell-title-${kind}`);
      assert.match(h.$('run-message').textContent, /Finish the current operation/);
      frozen(h, before);
      gate.reject(new Error('Retired original decode failed after explicit Cancel'));
      await pending;
      await settle(() => !h.$('continue-saved').disabled);
      assert.equal(h.rendered.run, old, 'Late rejection cannot adopt or replace a flight');
      assert.equal(
        h.doc.activeElement.id,
        `shell-title-${kind}`,
        'Newer deliberate action keeps focus',
      );
      assert.equal(h.$('shell-home').open, true);
      assert.equal(h.$('mode-leave-dialog').open, false);
      assert.equal(storage.getItem(slot), captured);
      frozen(h, before);
      await request(h, kind);
      assert.equal(globalThis.location.href, homeURL + destinations[kind]);
      assert.equal(storage.getItem(slot), captured);
      assert.equal(h.$('mode-leave-dialog').open, false);
      frozen(h, before);
    });
  });
