import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createPresentationResolver } from '../media-presentation.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { attachStillMediaPanel } from '../ui/still-media-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { mediaFixture, pngBytes, deferred } from './helpers/media-fixtures.mjs';

const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
async function setup(t, options = {}) {
  const doc = new Document();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  const f = mediaFixture(true),
    memory = memoryIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  const context = Object.freeze({ generation: 1, executionCatalog: f.catalog });
  let valid = true,
    paints = [],
    clears = 0,
    id = 0;
  const preview = {
    canvas: doc.createElement('canvas'),
    async show(args, extra) {
      paints.push(args);
      return options.show ? options.show(args, extra) : true;
    },
    clear() {
      ++clears;
    },
    dispose() {},
  };
  const catalog = {
    read: async () => context,
    withCurrent: async (snapshot, work) => {
      assert.equal(snapshot, context);
      if (!valid) throw new Error('Installed packs changed. Reload.');
      return work();
    },
  };
  const panel = attachStillMediaPanel({
    document: doc,
    store,
    catalog,
    preview,
    decodeImage,
    makeId: () => `picture-${++id}`,
    ...options.panel,
  });
  t.after(() => {
    panel.dispose();
    manager.close();
  });
  assert.equal(await panel.open(), true);
  const $ = (id) => doc.getElementById(`still-media-${id}`);
  function choose() {
    $('file').files = [new Blob([pngBytes()], { type: 'image/png' })];
    $('file').onchange();
    $('credit').value = 'Original test';
    $('source').value = 'Explicit injected fixture';
    $('description').value = 'Test picture';
  }
  return {
    ...f,
    doc,
    memory,
    manager,
    store,
    panel,
    $,
    choose,
    paints,
    get clears() {
      return clears;
    },
    invalidate() {
      valid = false;
    },
  };
}
test('native panel prepares original bytes, saves exact theme assignment, reloads and unassigns without losing history', async (t) => {
  const h = await setup(t);
  h.choose();
  assert.equal(await h.$('preview').onclick(), true);
  assert.equal((await h.store.read()).document.library.assets.length, 0, 'Preview does not write.');
  const before = h.clears;
  assert.equal(await h.$('save').onclick(), true);
  assert.equal(h.clears, before, 'Successful save retains the inspected preview.');
  const saved = await h.store.read();
  assert.equal(saved.generation, 1);
  assert.deepEqual(Buffer.from(await saved.assets[0].blob.arrayBuffer()), pngBytes());
  const resolver = createPresentationResolver(
    saved.document.library,
    createMediaIdentityCatalog(h.catalog),
  );
  assert.equal(resolver.resolve(h.request()).kind, 'still');
  assert.equal(
    resolver.resolve(h.request('gentle')).asset.sha256,
    saved.document.library.assets[0].sha256,
  );
  assert.equal(resolver.resolve(h.request('standard', 'retro')).kind, 'legacy');
  assert.equal(await h.$('reload').onclick(), true);
  assert.equal(await h.$('show-saved').onclick(), true);
  assert.equal(await h.$('unassign').onclick(), true);
  const removed = await h.store.read();
  assert.equal(removed.document.library.assignments.length, 0);
  assert.deepEqual(removed.assets, saved.assets);
  assert.deepEqual(removed.document.library.presentations, saved.document.library.presentations);
});
test('failed candidate decode or preview leaves the prior preview and saved assignment intact', async (t) => {
  let fail = false;
  const h = await setup(t, {
    show: () => {
      if (fail) throw new Error('Display decode failed');
      return true;
    },
  });
  h.choose();
  await h.$('preview').onclick();
  await h.$('save').onclick();
  const before = await h.store.read(),
    clears = h.clears;
  fail = true;
  h.choose();
  assert.equal(await h.$('preview').onclick(), false);
  assert.equal(h.clears, clears);
  assert.equal(h.panel.snapshot().hasDraft, false);
  assert.match(h.$('status').textContent, /Display decode failed/);
  assert.deepEqual(await h.store.read(), before);
  h.$('file').files = [new Blob(['not png'])];
  const paints = h.paints.length;
  assert.equal(await h.$('preview').onclick(), false);
  assert.equal(h.paints.length, paints);
});
test('double commands, cancellation and stale completion cannot save or overwrite a newer preview', async (t) => {
  const gate = deferred();
  let slow = true;
  const h = await setup(t, {
    show: async () => {
      if (slow) await gate.promise;
      return true;
    },
  });
  h.choose();
  const pending = h.$('preview').onclick();
  assert.equal(await h.$('preview').onclick(), false);
  await new Promise(setImmediate);
  h.$('cancel').onclick();
  slow = false;
  assert.equal(h.panel.snapshot().ready, false);
  await h.$('reload').onclick();
  h.choose();
  await h.$('preview').onclick();
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(h.panel.snapshot().hasDraft, true);
  assert.equal(await h.$('save').onclick(), true);
  assert.equal((await h.store.read()).generation, 1);
});
test('stale installed context and concurrent media writer refuse the whole save', async (t) => {
  const h = await setup(t);
  h.choose();
  await h.$('preview').onclick();
  h.invalidate();
  assert.equal(await h.$('save').onclick(), false);
  assert.match(h.$('status').textContent, /Installed packs changed/);
  assert.equal((await h.store.read()).generation, 0);
  const j = await setup(t);
  j.choose();
  await j.$('preview').onclick();
  const prior = await j.store.read();
  const prepared = await j.store.prepare(prior.document.library, prior.assets, {
    executionCatalog: j.catalog,
    previous: prior.document,
  });
  await j.store.commit(prepared, { expectedGeneration: prior.generation });
  assert.equal(await j.$('save').onclick(), false);
  assert.match(j.$('status').textContent, /changed|Reload|generation/i);
  assert.equal((await j.store.read()).document.library.assets.length, 0);
});
test('context switching discards an unsaved binding and close restores focus without late publication', async (t) => {
  const h = await setup(t);
  h.choose();
  await h.$('preview').onclick();
  h.$('theme').value = 'retro';
  h.$('theme').onchange();
  assert.equal(h.panel.snapshot().hasDraft, false);
  assert.equal(h.$('save').disabled, true);
  h.panel.invalidateContext();
  assert.equal(h.$('preview').disabled, true);
  h.panel.close();
  assert.equal(h.panel.dialog.open, false);
});
test('transaction refusal keeps the previous preview/draft and stored bytes; notification failure cannot erase a successful save', async (t) => {
  const h = await setup(t, {
    panel: {
      onSaved: () => {
        throw new Error('UI notification failed');
      },
    },
  });
  h.choose();
  await h.$('preview').onclick();
  const before = await h.store.read(),
    clears = h.clears;
  h.memory.failAnyPutAt = 1;
  assert.equal(await h.$('save').onclick(), false);
  assert.equal(h.panel.snapshot().hasDraft, true);
  assert.equal(h.clears, clears);
  assert.deepEqual(await h.store.read(), before);
  h.memory.failAnyPutAt = null;
  assert.equal(await h.$('save').onclick(), true);
  assert.match(h.$('status').textContent, /Assignment saved, but/);
  assert.equal((await h.store.read()).generation, 1);
});
test('existing keyboard/controller navigation edits native selects and Back closes only the workshop', async (t) => {
  const h = await setup(t);
  const nav = attachControllerNavigation({
    document: h.doc,
    keyboard: true,
    getScope: () => (h.panel.dialog.open ? 'still' : 'page'),
    getRoot: () => h.panel.dialog,
    getDefaultFocus: () => h.$('theme'),
    onBack: () => h.panel.close(),
  });
  t.after(() => nav.destroy());
  h.$('theme').focus();
  nav.sync();
  nav.handle({ confirm: true });
  assert.equal(h.$('theme').getAttribute('data-controller-editing'), 'true');
  nav.handle({ direction: 'down' });
  nav.handle({ confirm: true });
  assert.equal(h.$('theme').value, 'ukraine');
  nav.handle({ back: true });
  assert.equal(h.panel.dialog.open, false);
});

test('file picker cancellation preserves the Still Media draft, focus and pending preview; dialog Escape still closes', async (t) => {
  const gate = deferred();
  let slow = false;
  const h = await setup(t, { show: () => (slow ? gate.promise : true) });
  h.choose();
  await h.$('preview').onclick();
  const saved = await h.store.read();
  for (const id of ['file', 'bundle-file']) {
    const input = h.$(id);
    input.focus();
    const before = h.panel.snapshot(),
      status = h.$('status').textContent,
      clears = h.clears;
    const event = new Event('cancel', { bubbles: true });
    input.dispatchEvent(event);
    assert.equal(event.target, input);
    assert.equal(event.cancelable, false);
    assert.equal(h.panel.dialog.open, true);
    assert.deepEqual(h.panel.snapshot(), before);
    assert.equal(h.doc.activeElement, input);
    assert.equal(h.$('status').textContent, status);
    assert.equal(h.clears, clears);
  }
  assert.equal(h.panel.snapshot().hasDraft, true);
  assert.deepEqual(await h.store.read(), saved);
  slow = true;
  h.choose();
  const pending = h.$('preview').onclick();
  assert.equal(h.panel.snapshot().busy, true);
  h.$('file').dispatchEvent(new Event('cancel', { bubbles: true }));
  assert.equal(h.panel.snapshot().busy, true);
  gate.resolve(true);
  assert.equal(await pending, true);
  assert.equal(h.panel.snapshot().hasDraft, true);
  assert.deepEqual(await h.store.read(), saved);
  const escape = new Event('cancel', { cancelable: true });
  h.panel.dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(h.panel.dialog.open, false);
});

// Model Chromium's observed disabled-control blur only at this test boundary.
// The shared minimal DOM deliberately makes no native focus/layout claim.
function nativeDisabled(element, onEnable = () => {}) {
  let disabled = element.disabled;
  Object.defineProperty(element, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      const was = disabled;
      disabled = value;
      if (value && element.ownerDocument.activeElement === element) {
        element.blur();
        element.emit('blur', { bubbles: false, relatedTarget: null });
      }
      if (was && !value) onEnable();
    },
  });
}
function focusWindow(h) {
  h.doc.defaultView = Object.assign(new Events(), h.doc.defaultView);
  return h.doc.defaultView;
}
function listenerCount(h) {
  return [h.doc, h.doc.defaultView].reduce(
    (count, node) =>
      count +
      [...node.listeners.values(), ...node.captureListeners.values()].reduce(
        (sum, listeners) => sum + listeners.size,
        0,
      ),
    0,
  );
}
async function pendingPreview(t, action, { fail = false, onEnable } = {}) {
  let gate = null;
  const entered = deferred();
  const h = await setup(t, {
    show: () => {
      if (!gate) return true;
      entered.resolve();
      return gate.promise;
    },
  });
  h.choose();
  await h.$('preview').onclick();
  await h.$('save').onclick();
  const before = await h.store.read();
  const original = Buffer.from(await before.assets[0].blob.arrayBuffer());
  const win = focusWindow(h);
  const listenersBefore = listenerCount(h);
  const opener = h.$(action);
  nativeDisabled(opener, () => onEnable?.(h));
  opener.focus();
  gate = deferred();
  t.after(() => gate.resolve(true));
  const pending = opener.onclick();
  await entered.promise;
  assert.equal(opener.disabled, true);
  assert.equal(h.doc.activeElement, h.doc.body, 'Native disable drops initiating focus');
  return {
    h,
    win,
    opener,
    listenersBefore,
    async complete() {
      if (fail) gate.reject(new Error('Picture decoder refused the preview'));
      else gate.resolve(true);
      const result = await pending;
      const after = await h.store.read();
      assert.equal(after.generation, before.generation, 'Preview never writes local media');
      assert.deepEqual(after.document, before.document);
      assert.deepEqual(Buffer.from(await after.assets[0].blob.arrayBuffer()), original);
      return result;
    },
  };
}
for (const action of ['preview', 'show-saved', 'show-authored']) {
  for (const fail of [false, true]) {
    test(`${action} ${fail ? 'failure' : 'completion'} restores its initiating control after native disabled blur`, async (t) => {
      const { h, opener, complete, listenersBefore } = await pendingPreview(t, action, { fail });
      assert.equal(await complete(), !fail);
      assert.equal(opener.disabled, false);
      assert.equal(h.doc.activeElement, opener, 'Return to the exact Preview action, never Save');
      assert.equal(h.panel.dialog.open, true);
      assert.equal(
        listenerCount(h),
        listenersBefore,
        'Finished operation releases focus listeners',
      );
      if (fail) assert.match(h.$('status').textContent, /Picture decoder refused/);
      else if (action !== 'show-authored') assert.equal(h.$('save').disabled, false);
    });
  }
}
test('chosen preview validation failure restores its opener without publishing a draft', async (t) => {
  const h = await setup(t);
  focusWindow(h);
  h.choose();
  h.$('description').value = '';
  const opener = h.$('preview');
  nativeDisabled(opener);
  opener.focus();
  const pending = opener.onclick();
  assert.equal(h.doc.activeElement, h.doc.body);
  assert.equal(await pending, false);
  assert.equal(h.doc.activeElement, opener);
  assert.equal(h.panel.snapshot().hasDraft, false);
  assert.equal((await h.store.read()).generation, 0);
  assert.match(h.$('status').textContent, /Add a picture description/);
});
for (const decision of [
  'focus-away',
  'body-key',
  'body-pointer',
  'window-blur',
  'hidden',
  'pagehide',
  'new-dialog',
]) {
  test(`preview completion respects ${decision} even when focus returns to BODY`, async (t) => {
    const { h, win, complete, listenersBefore } = await pendingPreview(t, 'show-authored');
    if (decision === 'focus-away') {
      h.$('close').focus();
      h.$('close').blur();
    } else if (decision === 'body-key') h.doc.body.emit('keydown', { key: 'Tab', code: 'Tab' });
    else if (decision === 'body-pointer') h.doc.body.emit('pointerdown', { button: 0 });
    else if (decision === 'window-blur') {
      win.emit('blur');
      win.emit('focus');
    } else if (decision === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    } else if (decision === 'pagehide') win.emit('pagehide', { persisted: true });
    else {
      const dialog = h.doc.createElement('dialog');
      h.doc.body.append(dialog);
      // SoloElement omits native beforetoggle; publish that boundary explicitly.
      dialog.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
      dialog.showModal();
      dialog.close();
    }
    assert.equal(listenerCount(h), listenersBefore, 'Newer intent retires listeners promptly');
    assert.equal(await complete(), true);
    assert.equal(h.doc.activeElement, h.doc.body, 'Completion does not resurrect retired focus');
  });
}
test('programmatic preview does not capture an unrelated focused action', async (t) => {
  const h = await setup(t);
  focusWindow(h);
  h.choose();
  h.$('close').focus();
  const before = listenerCount(h);
  assert.equal(await h.$('preview').onclick(), true);
  assert.equal(h.doc.activeElement, h.$('close'));
  assert.equal(listenerCount(h), before);
});
for (const stop of ['cancel', 'invalidate', 'close', 'dispose']) {
  test(`${stop} retires a preview focus lease before its decoder settles`, async (t) => {
    const { h, complete, listenersBefore, opener } = await pendingPreview(t, 'show-authored');
    if (stop === 'cancel') h.$('cancel').onclick();
    else if (stop === 'invalidate') h.panel.invalidateContext();
    else if (stop === 'close') h.panel.close();
    else h.panel.dispose();
    assert.equal(
      listenerCount(h),
      listenersBefore,
      'Abort removes ownership listeners immediately',
    );
    const acceptedFocus = h.doc.activeElement;
    assert.equal(await complete(), false);
    assert.equal(h.doc.activeElement, acceptedFocus);
    assert.notEqual(h.doc.activeElement, opener);
  });
}
test('a cancelled preview cannot steal focus from the next accepted preview', async (t) => {
  const { h, complete, opener } = await pendingPreview(t, 'show-authored');
  h.$('cancel').onclick();
  await h.$('reload').onclick();
  h.$('show-saved').focus();
  const next = h.$('show-saved').onclick();
  assert.equal(await complete(), false);
  assert.equal(await next, true);
  assert.equal(h.doc.activeElement, h.$('show-saved'));
  assert.notEqual(h.doc.activeElement, opener);
});
test('close and reopen does not revive the earlier preview focus owner', async (t) => {
  const { h, complete, opener } = await pendingPreview(t, 'show-authored');
  h.panel.close();
  await h.panel.open();
  const acceptedFocus = h.doc.activeElement;
  assert.equal(await complete(), false);
  assert.equal(h.doc.activeElement, acceptedFocus);
  assert.notEqual(h.doc.activeElement, opener);
});
for (const reentry of ['focus', 'invalidate']) {
  test(`preview final enabling ${reentry} takes precedence over old focus`, async (t) => {
    let handled = false;
    const { h, complete, opener } = await pendingPreview(t, 'show-authored', {
      onEnable(page) {
        if (handled) return;
        handled = true;
        if (reentry === 'focus') page.$('close').focus();
        else page.panel.invalidateContext();
      },
    });
    await complete();
    assert.equal(handled, true);
    assert.notEqual(h.doc.activeElement, opener);
    if (reentry === 'focus') assert.equal(h.doc.activeElement, h.$('close'));
    else assert.equal(h.panel.snapshot().ready, false);
  });
}
