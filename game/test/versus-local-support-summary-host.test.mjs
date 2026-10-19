// Actual Versus host with finite DOM, storage and physical-frame boundaries.
// No browser geometry, physical controller, PWA or native iOS transfer claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const pad = () => ({
  index: 0,
  id: 'private-versus-device',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
async function fixture(t, { storageAPI = {}, compact = false, pads = [], campaign } = {}) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(locale, { persist: false }));
  const storage = memoryStorage();
  const f = await couchPage(t, {
    ...(campaign ? { campaign } : {}),
    storage,
    pads,
    nativeKeyboard: true,
    beforeImport({ document: doc, window: win }) {
      navigator.storage = storageAPI;
      // This finite Element model defaults .open on every tag; native sections do not.
      delete doc.getElementById('race-options-panel').open;
      doc.documentElement.dataset.buildVersion = '0.151.1';
      if (compact) {
        win.innerWidth = 390;
        doc.defaultView.innerWidth = 390;
        doc.documentElement.clientWidth = 390;
      }
    },
  });
  assert.ok(f.$('race-support-summary-root'), 'Native Versus Data owns the support root.');
  return { ...f, storage };
}
function open(f) {
  f.$('race-options').click();
  f.$('race-settings-tab-data').click();
  assert.equal(f.$('race-options-panel').hidden, false);
  assert.equal(f.$('race-settings-panel-data').hidden, false);
  assert.equal(
    f.$('race-options-panel').open,
    undefined,
    'A section must never pretend to be a dialog.',
  );
}
async function prepare(f) {
  f.$('support-summary-prepare').focus();
  f.$('support-summary-prepare').click();
  await waitFor(() => !f.$('support-summary-download').disabled);
  return JSON.parse(f.$('support-summary-json').textContent);
}

test('Versus native Data reuses the ordinary physical frame without changing either paused board or storage', async (t) => {
  const device = pad();
  let buttonReads = 0;
  const buttons = device.buttons;
  Object.defineProperty(device, 'buttons', {
    get() {
      buttonReads++;
      return buttons;
    },
  });
  const f = await fixture(t, { pads: [device], storageAPI: { persisted: async () => true } });
  f.join(0);
  f.frames(151, 1000 / 120);
  f.$('race-start').click();
  f.frames(12, 1000 / 120);
  f.$('race-pause').click();
  open(f);
  f.frame(0);
  const checkpoint = f.checkpoint(),
    writes = [...f.storage.writes],
    reads = f.readCount(),
    rawReads = buttonReads;
  const value = await prepare(f);
  assert.equal(value.scope, 'versus-game-shell');
  assert.equal(value.game.host, 'capture-versus');
  assert.equal(value.game.state, 'paused');
  assert.deepEqual(value.build, { version: '0.151.1', sourceRevision: null, packaged: null });
  assert.equal(value.controller.status, 'connected');
  assert.equal(value.controller.assigned, true);
  assert.equal(value.controller.neutral, null);
  assert.equal(value.controller.confirmBlocked, null);
  assert.equal(value.game.saving.writable, null);
  assert.equal(value.storage.retention, 'granted');
  assert.equal(f.readCount(), reads);
  assert.equal(buttonReads, rawReads);
  assert.deepEqual(f.checkpoint(), checkpoint);
  assert.deepEqual(f.storage.writes, writes);
  const captured = f.$('support-summary-json').textContent;
  f.frames(4, 0);
  assert.equal(
    f.$('support-summary-json').textContent,
    captured,
    'Ordinary paused frames retain the exact prepared document.',
  );
  assert.doesNotMatch(JSON.stringify(value), /private-versus|buttons|axes|seats|profile|device/i);
  f.setPads([]);
  f.frame(0);
  assert.equal(
    (await prepare(f)).controller.freshness,
    'unavailable',
    'Disconnect retires the owned frame before a new sample.',
  );
  f.frame(0);
  assert.equal((await prepare(f)).controller.status, 'disconnected');
  f.setError(Error('private-read-error'));
  f.frame(0);
  assert.equal((await prepare(f)).controller.status, 'unavailable');
});

for (const boundary of ['category', 'close', 'compact-back', 'resize', 'blur', 'hidden', 'bfcache'])
  test(`Versus pending observation is retired by ${boundary} even when Data returns before it resolves`, async (t) => {
    let finish,
      calls = 0;
    const held = new Promise((resolve) => {
      finish = resolve;
    });
    const f = await fixture(t, {
      compact: ['compact-back', 'resize'].includes(boundary),
      storageAPI: { persisted: () => (++calls === 1 ? held : Promise.resolve(false)) },
    });
    open(f);
    f.$('support-summary-prepare').click();
    await settle();
    if (boundary === 'category') {
      f.$('race-settings-tab-data').focus();
      f.$('race-settings-tab-data').emit('keydown', { key: 'ArrowUp' });
      assert.equal(f.$('race-settings-panel-data').hidden, true);
      f.$('race-settings-tab-data').click();
    } else if (boundary === 'close') {
      f.$('race-options-back').click();
      assert.equal(f.$('race-options-panel').hidden, true);
      open(f);
    } else if (['blur', 'hidden', 'bfcache'].includes(boundary)) {
      if (boundary === 'blur') {
        f.doc.focused = false;
        f.win.emit('blur');
        f.doc.focused = true;
      } else if (boundary === 'hidden') {
        f.doc.hidden = true;
        f.doc.emit('visibilitychange');
        f.doc.hidden = false;
        f.doc.emit('visibilitychange');
      } else {
        f.win.emit('pagehide', { persisted: true });
        f.win.emit('pageshow', { persisted: true });
      }
      f.frame(0);
    } else {
      assert.equal(f.$('race-options-panel').getAttribute('data-settings-view'), 'panel');
      if (boundary === 'resize') {
        f.$('race-settings-tab-data').focus();
        f.doc.defaultView.emit('resize');
      } else f.$('race-options-back').click();
      assert.equal(f.$('race-options-panel').hidden, false);
      assert.equal(f.$('race-options-panel').getAttribute('data-settings-view'), 'categories');
      f.$('support-summary-prepare').click();
      await settle();
      assert.equal(calls, 1, 'Compact categories cannot begin a hidden Data observation.');
      f.$('race-settings-tab-data').click();
    }
    const focus = f.doc.activeElement;
    finish(true);
    await settle();
    await settle();
    assert.equal(f.$('support-summary-json').textContent, '');
    assert.equal(f.$('support-summary-download').disabled, true);
    assert.equal(f.doc.activeElement, focus);
    assert.equal((await prepare(f)).storage.retention, 'not-granted');
  });

test('Versus lifecycle retires prepared or pending Data and returns without resuming a paused race', async (t) => {
  const f = await fixture(t);
  f.$('race-start').click();
  f.frames(12, 1000 / 120);
  f.$('race-pause').click();
  open(f);
  await prepare(f);
  f.doc.focused = false;
  f.win.emit('blur');
  const reads = f.readCount(),
    checkpoint = f.checkpoint();
  f.$('support-summary-prepare').click();
  await settle();
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.readCount(), reads);
  f.doc.focused = true;
  f.frame(0);
  await prepare(f);
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.$('support-summary-json').textContent, '');
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  f.frame(0);
  await prepare(f);
  f.win.emit('pagehide', { persisted: true });
  assert.equal(f.$('support-summary-json').textContent, '');
  f.win.emit('pageshow', { persisted: true });
  f.frame(0);
  assert.equal((await prepare(f)).game.state, 'paused');
  assert.deepEqual(f.checkpoint(), checkpoint);
  f.win.emit('pagehide', { persisted: false });
  f.$('support-summary-prepare').click();
  await settle();
  assert.equal(f.$('support-summary-json').textContent, '');
});

test('Versus native controller reaches support actions and explicit export matches preview through EN/UK', async (t) => {
  const f = await fixture(t, { pads: [pad()] });
  f.join(0);
  f.frames(151, 1000 / 120);
  open(f);
  f.frame(0);
  f.$('support-summary-prepare').focus();
  f.pulse(0, 0);
  await waitFor(() => !f.$('support-summary-download').disabled);
  const text = f.$('support-summary-json').textContent,
    value = JSON.parse(text),
    blobs = [];
  t.mock.method(URL, 'createObjectURL', (blob) => {
    blobs.push(blob);
    return 'blob:versus-summary';
  });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, delay, ...args) =>
    schedule(fn, delay === 60000 ? 0 : delay, ...args),
  );
  f.frames(151, 1000 / 120);
  f.$('support-summary-download').focus();
  f.$('support-summary-download').click();
  await waitFor(() => blobs.length === 1);
  assert.deepEqual(JSON.parse(await blobs[0].text()), value);
  setLocale('uk', { persist: false });
  assert.match(f.$('support-summary-title').textContent, /Локальний звіт/);
  assert.equal(f.doc.activeElement, f.$('support-summary-download'));
  assert.equal(f.$('support-summary-json').textContent, text);
});

test('a native finished Versus draw reports the observed round state without inventing a winner or changing results', async (t) => {
  const base = JSON.parse(
    await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
  );
  const campaign = {
    ...base,
    id: 'support-versus-finished-draw',
    briefs: [],
    levels: [retryFixture('enemy-player').level],
  };
  const f = await fixture(t, { campaign });
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.key('ArrowRight');
  f.frames(60);
  assert.equal(f.state(), 'finished');
  open(f);
  const checkpoint = f.checkpoint(),
    writes = [...f.storage.writes];
  const value = await prepare(f);
  assert.equal(value.game.state, 'finished');
  assert.equal(value.game.saving.writable, null);
  assert.match(f.$('support-summary-game').textContent, /Round finished/);
  setLocale('uk', { persist: false });
  assert.match(f.$('support-summary-game').textContent, /Раунд завершено/);
  assert.deepEqual(f.checkpoint(), checkpoint);
  assert.deepEqual(f.storage.writes, writes);
});

// Model the two fixture window objects at the native window/defaultView boundary.
function resizeWidth(f, width) {
  f.win.innerWidth = width;
  f.doc.defaultView.innerWidth = width;
  f.doc.documentElement.clientWidth = width;
  f.doc.defaultView.emit('resize');
}
for (const focusOwner of ['data-tab', 'outside'])
  for (const phase of ['pending', 'prepared'])
    test(`Versus width breakpoint retires ${phase} Data with unchanged categories and ${focusOwner} focus`, async (t) => {
      let finish,
        calls = 0;
      const held = new Promise((resolve) => {
        finish = resolve;
      });
      const f = await fixture(t, {
        storageAPI: {
          persisted: () => (phase === 'pending' && ++calls === 1 ? held : Promise.resolve(false)),
        },
      });
      open(f);
      resizeWidth(f, 1000);
      assert.equal(f.$('race-options-panel').getAttribute('data-settings-view'), 'categories');
      if (phase === 'prepared') await prepare(f);
      else {
        f.$('support-summary-prepare').focus();
        f.$('support-summary-prepare').click();
        await settle();
      }
      const focus = focusOwner === 'data-tab' ? f.$('race-settings-tab-data') : f.doc.body;
      focus.focus();
      const reads = f.readCount(),
        writes = [...f.storage.writes],
        checkpoint = f.checkpoint();
      resizeWidth(f, 320);
      assert.equal(f.$('race-options-panel').getAttribute('data-settings-view'), 'categories');
      assert.equal(
        f.$('race-settings-panel-data').hidden,
        false,
        'CSS breakpoint, not category hidden/inert, retires this view.',
      );
      if (phase === 'prepared')
        assert.equal(
          f.$('support-summary-json').textContent,
          '',
          'The CSS-hidden prepared view must retire immediately.',
        );
      resizeWidth(f, 1000);
      finish(true);
      await settle();
      await settle();
      assert.equal(
        f.$('support-summary-json').textContent,
        '',
        'Returning wide before completion cannot revive the old visit.',
      );
      assert.equal(f.$('support-summary-download').disabled, true);
      assert.equal(f.doc.activeElement, focus);
      assert.equal(f.readCount(), reads);
      assert.deepEqual(f.storage.writes, writes);
      assert.deepEqual(f.checkpoint(), checkpoint);
      await prepare(f);
      const captured = f.$('support-summary-json').textContent;
      f.$('race-settings-tab-data').focus();
      resizeWidth(f, 1000);
      assert.equal(
        f.$('support-summary-json').textContent,
        captured,
        'An unchanged width/category does not retire a fresh report.',
      );
    });
