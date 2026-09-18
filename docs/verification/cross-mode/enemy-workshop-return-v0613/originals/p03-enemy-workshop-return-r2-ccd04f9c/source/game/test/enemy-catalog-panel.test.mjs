import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { attachEnemyCatalogPanel } from '../ui/enemy-catalog-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { createEnemyCatalogInput } from '../ui/enemy-catalog-input.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

function setup(t, options = {}) {
  const doc = new Document();
  doc.createElement = (tag) => {
    const element = new SoloElement(doc, tag);
    element.getContext = () => null;
    element.prepend = (child) => {
      element.append(child);
      element.children.unshift(element.children.pop());
    };
    return element;
  };
  const applied = [],
    previews = [],
    exports = [],
    panel = attachEnemyCatalogPanel({
      document: doc,
      onRead: (request) => nav.beginReading(request),
      onApplyDraft: (draft) => applied.push(draft),
      onPreview: (type, draft) => previews.push({ type, draft }),
      onExport: (draft) => exports.push(draft),
      ...options,
    });
  const nav = attachControllerNavigation({
    document: doc,
    getScope: () => (panel.dialog.open ? 'catalog' : 'closed'),
    getRoot: () => panel.dialog,
    getDefaultFocus: () => doc.getElementById('enemy-catalog-role'),
    keyboard: true,
    onBack: () => panel.close(),
    ...options.navigationOptions,
  });
  panel.open();
  nav.sync();
  t.after(() => {
    nav.destroy();
    panel.dispose();
  });
  return {
    doc,
    panel,
    nav,
    applied,
    previews,
    exports,
    $: (id) => doc.getElementById(`enemy-catalog-${id}`),
  };
}
test('actual catalog handlers isolate unsaved choices, save enabled/skin selections, restore and preview the chosen role', async (t) => {
  const h = setup(t);
  h.$('role').value = 'eroder';
  h.$('role').onchange();
  h.$('skin').value = 'ukraine';
  h.$('skin').onchange();
  h.$('enabled').checked = false;
  h.$('enabled').onchange();
  assert.equal(h.$('play').disabled, true);
  assert.equal(h.applied.length, 0);
  await h.$('apply').onclick();
  assert.equal(
    h.applied[0].entries.find((entry) => entry.type === 'eroder').skinId,
    'eroder.ukraine.v1',
  );
  assert.equal(h.applied[0].entries.find((entry) => entry.type === 'eroder').enabled, false);
  assert.ok(Object.isFrozen(h.applied[0]));
  h.$('enabled').checked = true;
  h.$('enabled').onchange();
  await h.$('play').onclick();
  assert.equal(h.previews[0].type, 'eroder');
  assert.equal(h.previews[0].draft.entries.find((entry) => entry.type === 'eroder').enabled, true);
  h.$('undo').onclick();
  assert.equal(h.$('enabled').checked, false);
  await h.$('export').onclick();
  assert.equal(h.exports[0].entries.find((entry) => entry.type === 'eroder').enabled, false);
});
test('failed Apply retains the last saved draft; malformed or oversize imports cannot replace it', async (t) => {
  const h = setup(t, {
    onApplyDraft: () => {
      throw new Error('Storage is full.');
    },
  });
  h.$('enabled').checked = false;
  h.$('enabled').onchange();
  assert.equal(await h.$('apply').onclick(), false);
  assert.match(h.$('status').textContent, /Storage is full/);
  h.$('undo').onclick();
  assert.equal(h.$('enabled').checked, true);
  h.$('import').files = [
    {
      size: 65537,
      text: () => {
        throw new Error('Must not read oversized input.');
      },
    },
  ];
  assert.equal(await h.$('import').onchange(), false);
  assert.match(h.$('status').textContent, /64 KiB/);
  h.$('import').files = [{ size: 2, text: async () => '{}' }];
  assert.equal(await h.$('import').onchange(), false);
  assert.equal(
    h.panel.snapshot().entries.every((entry) => entry.enabled),
    true,
  );
});
test('cancelled catalog file reads cannot replace a draft or unlock a newer operation', async (t) => {
  const h = setup(t),
    first = deferred(),
    second = deferred();
  const before = h.panel.snapshot();
  h.$('import').files = [{ size: 100, text: () => first.promise }];
  const older = h.$('import').onchange();
  assert.match(h.$('status').textContent, /Reading and validating/);
  assert.equal(h.$('status').dataset.state, 'busy');
  assert.equal(h.$('back').disabled, false);
  h.panel.close();
  h.panel.open();
  h.$('import').files = [{ size: 100, text: () => second.promise }];
  const newer = h.$('import').onchange();
  first.resolve(JSON.stringify(before));
  await older;
  assert.equal(h.$('apply').disabled, true);
  assert.equal(h.$('status').dataset.state, 'busy');
  second.reject(new Error('Read failed'));
  await newer;
  assert.equal(h.$('apply').disabled, false);
  assert.equal(h.$('status').dataset.state, 'error');
  assert.deepEqual(h.panel.snapshot(), before);
});
test('Stop waiting keeps an authoring save locked and reconciles its actual outcome', async (t) => {
  const gate = deferred(),
    h = setup(t, { onApplyDraft: () => gate.promise });
  const saving = h.$('apply').onclick();
  assert.match(h.$('status').textContent, /Saving authoring choices/);
  h.panel.close();
  assert.equal(h.panel.dialog.open, true);
  assert.equal(h.$('status').dataset.state, 'detached');
  assert.equal(h.$('apply').disabled, true);
  gate.resolve();
  await saving;
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.match(h.$('status').textContent, /Authoring choices saved/);
  assert.equal(h.$('apply').disabled, false);
});
test('shared keyboard/controller navigation reaches native catalog controls; Back cancels select edit before closing', async (t) => {
  const h = setup(t);
  h.nav.engage();
  assert.equal(h.doc.activeElement, h.$('role'));
  h.nav.handle({ confirm: true });
  h.nav.handle({ direction: 'down' });
  h.nav.handle({ back: true });
  assert.equal(h.panel.dialog.open, true);
  assert.equal(h.$('role').value, 'bouncer');
  h.nav.handle({ confirm: true });
  h.nav.handle({ direction: 'down' });
  h.nav.handle({ confirm: true });
  assert.equal(h.$('role').value, 'border-patrol');
  const found = new Set();
  for (let i = 0; i < 14; i++) {
    found.add(h.doc.activeElement.id);
    h.nav.handle({ direction: 'down' });
  }
  for (const id of [
    'role',
    'skin',
    'style',
    'enabled',
    'read',
    'apply',
    'undo',
    'play',
    'export',
    'import',
    'back',
  ])
    assert.ok(found.has(`enemy-catalog-${id}`), id);
  const nativeTab = h.doc.emit('keydown', { key: 'Tab', target: h.doc.activeElement });
  assert.equal(
    nativeTab.defaultPrevented,
    false,
    'Native modal owns Tab focus cycling; the model does not simulate browser default focus.',
  );
  h.nav.handle({ back: true });
  assert.equal(h.panel.dialog.open, false);
});

function inputFixture(t) {
  let input;
  const h = setup(t, { navigationOptions: { onNativeInput: () => input?.clear() } }),
    frame = h.doc.createElement('iframe'),
    pad = {
      index: 0,
      id: 'Workshop controller',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    },
    router = createControllerRouter({ readPads: () => [pad], eventTarget: h.doc });
  h.doc.body.append(frame);
  input = createEnemyCatalogInput({
    document: h.doc,
    frame,
    router,
    navigation: h.nav,
    getScope: () => (h.panel.dialog.open ? 'catalog' : 'closed'),
  });
  t.after(() => router.destroy());
  const press = (index, value) => {
    pad.buttons[index] = { pressed: value, value: Number(value) };
  };
  input.poll(0);
  press(0, true);
  input.poll(1);
  press(0, false);
  input.poll(2);
  return { ...h, frame, input, press };
}
test('workshop native input clears held D-pad repeats until neutral and a fresh press', (t) => {
  const h = inputFixture(t);
  h.press(13, true);
  h.input.poll(3);
  assert.equal(h.doc.activeElement, h.$('skin'));
  h.doc.emit('pointerdown', { target: h.$('apply') });
  h.$('apply').focus();
  h.input.poll(1000);
  assert.equal(h.doc.activeElement, h.$('apply'));
  h.press(13, false);
  h.input.poll(1001);
  h.press(13, true);
  h.input.poll(1002);
  assert.notEqual(h.doc.activeElement, h.$('apply'));
});
test('workshop ignores a focused game iframe even when parent hasFocus is true, and requires neutral on return', (t) => {
  const h = inputFixture(t);
  h.press(13, true);
  h.input.poll(3);
  h.frame.focus();
  assert.equal(h.doc.hasFocus(), true);
  assert.equal(h.input.poll(500), false);
  assert.equal(h.doc.activeElement, h.frame);
  h.$('apply').focus();
  h.input.poll(600);
  assert.equal(h.doc.activeElement, h.$('apply'));
  h.press(13, false);
  h.input.poll(601);
  h.press(13, true);
  h.input.poll(602);
  assert.notEqual(h.doc.activeElement, h.$('apply'));
});

test('role detail reader stays controller scrollable and Back returns to its own button', (t) => {
  const h = setup(t),
    region = h.$('details');
  region.clientHeight = 100;
  region.scrollHeight = 600;
  h.$('read').focus();
  h.nav.handle({ confirm: true });
  assert.equal(h.nav.readingState().regionId, 'enemy-catalog-details');
  h.nav.handle({ direction: 'down' });
  assert.ok(region.scrollTop > 0);
  h.nav.handle({ back: true });
  assert.equal(h.nav.readingState(), null);
  assert.equal(h.doc.activeElement, h.$('read'));
  assert.equal(h.panel.dialog.open, true);
});

test('file picker cancellation keeps Enemy Catalog choices and an in-flight save; dialog Escape still stops waiting', async (t) => {
  const gate = deferred(),
    h = setup(t, { onApplyDraft: () => gate.promise });
  h.$('enabled').checked = false;
  h.$('enabled').onchange();
  const draft = h.panel.snapshot(),
    input = h.$('import');
  input.files = [new Blob(['retained file'])];
  input.focus();
  input.dispatchEvent(new Event('cancel', { bubbles: true }));
  assert.equal(h.panel.dialog.open, true);
  assert.deepEqual(h.panel.snapshot(), draft);
  assert.equal(h.doc.activeElement, input);
  assert.equal(await input.files[0].text(), 'retained file');
  const saving = h.$('apply').onclick(),
    status = h.$('status').textContent;
  input.dispatchEvent(new Event('cancel', { bubbles: true }));
  assert.equal(h.$('status').textContent, status);
  assert.equal(h.$('status').dataset.state, 'busy');
  const escape = new Event('cancel', { cancelable: true });
  h.panel.dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(h.panel.dialog.open, true);
  assert.equal(h.$('status').dataset.state, 'detached');
  gate.resolve();
  await saving;
  assert.equal(h.$('status').dataset.state, 'ready');
  h.panel.dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  assert.equal(h.panel.dialog.open, false);
});
