// Actual Rooms mount, shell, input router and support view/collector.
// Finite DOM/media boundaries; no browser pixels or live service qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { mountRoomUI } from '../online/room-ui.mjs';
import { createRoomClientLifecycle } from '../online/room-client-lifecycle.mjs';
import { roomSupportState } from '../online/room-support-summary.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  createAuthoritativeRoom,
  joinAuthoritativeRoom,
  readyAuthoritativeRoom,
  pauseAuthoritativeRoom,
  snapshotAuthoritativeRoom,
  stepAuthoritativeRoom,
  restoreTrustedRoomSnapshot,
} from '../online/room-core.mjs';

const html = await readFile(new URL('../online/index.html', import.meta.url), 'utf8');
const turn = () => new Promise((resolve) => setImmediate(resolve));
function storage() {
  const values = new Map([['private-seat-token', 'private-room-credential']]),
    writes = [];
  return {
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value]);
      values.set(key, value);
    },
    removeItem(key) {
      writes.push([key, null]);
      values.delete(key);
    },
  };
}
const device = () => ({
  index: 0,
  id: 'private-room-controller-serial',
  connected: true,
  mapping: 'standard',
  timestamp: 1,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
async function fixture(t, { storageAPI = {} } = {}) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  const doc = new Document(),
    win = doc.defaultView,
    saved = storage(),
    pads = [],
    original = new Map();
  mountCouch(doc, html);
  // rooms.mjs creates this transport-owned button before mounting the native UI.
  const reconnect = doc.createElement('button');
  reconnect.id = 'reconnect';
  reconnect.hidden = true;
  doc.getElementById('notice').after(reconnect);
  doc.parentNode = win;
  doc.hidden = false;
  doc.focused = true;
  let reads = 0,
    requests = 0,
    submits = 0,
    pauses = 0,
    failed = false,
    state = null;
  const lifecycle = createRoomClientLifecycle({ sendInput: async () => submits++ });
  const values = {
    document: doc,
    window: win,
    localStorage: saved,
    sessionStorage: saved,
    navigator: {
      storage: storageAPI,
      getGamepads() {
        reads++;
        if (failed) throw new Error('private-room-hardware-error');
        return pads;
      },
    },
    location: { href: 'https://private.example/game/online/?invite=private-invite#private-token' },
    performance: { now: () => 1000 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    fetch() {
      requests++;
      throw new Error('No room transport/media request belongs to support preparation.');
    },
  };
  for (const [key, value] of Object.entries(values)) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const display = createDisplayPreferences(),
    destruction = createDestructionPreferences();
  let ui;
  t.after(() => {
    ui?.dispose();
    display.dispose();
    destruction.dispose();
    for (const [key, descriptor] of original)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    setLocale(locale, { persist: false });
  });
  ui = mountRoomUI({
    getState: () => state,
    getSeat: () => 0,
    canPlay: () => lifecycle.canPlay(),
    submit: (control) => lifecycle.submit(control),
    pause() {
      pauses++;
      lifecycle.suspend();
    },
    getSupportState: () => roomSupportState(lifecycle.snapshot()),
    display,
    destruction,
  });
  return {
    ui,
    doc,
    win,
    saved,
    pads,
    lifecycle,
    $: (id) => doc.getElementById(id),
    get reads() {
      return reads;
    },
    get requests() {
      return requests;
    },
    get submits() {
      return submits;
    },
    get pauses() {
      return pauses;
    },
    failReads() {
      failed = true;
    },
    accept(room) {
      const wire = snapshotAuthoritativeRoom(room);
      lifecycle.accept(wire, lifecycle.snapshot().epoch);
      state = restoreTrustedRoomSnapshot(wire);
      ui.update(state, { replacement: true });
    },
    open() {
      ui.shell.open('settings');
      assert.equal(doc.getElementById('room-settings-dialog').open, true);
      assert.equal(
        doc.getElementById('room-support-summary-root').closest('dialog').id,
        'room-settings-dialog',
      );
    },
  };
}
async function prepare(f) {
  f.$('support-summary-prepare').focus();
  f.$('support-summary-prepare').click();
  await waitFor(() => !f.$('support-summary-download').disabled);
  return JSON.parse(f.$('support-summary-json').textContent);
}
function pausedRoom(f) {
  const room = createAuthoritativeRoom(
    { family: 'snake', mode: 'versus', level: CLASSIC_SNAKE_LEVELS[0].level, seed: 17 },
    { id: 'a'.repeat(32), contentHash: 'b'.repeat(64) },
  );
  joinAuthoritativeRoom(room, 0);
  readyAuthoritativeRoom(room, 0, 0);
  readyAuthoritativeRoom(room, 1, 0);
  pauseAuthoritativeRoom(room);
  f.lifecycle.own({ seat: 0, token: 'private-seat-credential' });
  f.accept(room);
  return room;
}

test('actual Rooms Settings owns one summary, with unknown pre-frame hardware/build/save and no added activity', async (t) => {
  const f = await fixture(t);
  f.open();
  const before = [f.reads, f.requests, f.submits, f.pauses, [...f.saved.writes]],
    lifecycle = f.lifecycle.snapshot();
  const report = await prepare(f);
  assert.equal(report.scope, 'private-room-game-shell');
  assert.equal(report.game.host, 'private-room');
  assert.equal(report.game.state, 'idle');
  assert.equal(report.build.version, null);
  assert.equal(report.controller.freshness, 'unavailable');
  assert.equal(report.controller.assigned, null);
  assert.equal(report.game.saving.writable, null);
  assert.equal(report.offline.files, 'not-verified-here');
  assert.deepEqual([f.reads, f.requests, f.submits, f.pauses, f.saved.writes], before);
  assert.deepEqual(f.lifecycle.snapshot(), lifecycle);
  assert.ok(
    f.doc.activeElement === f.$('support-summary-prepare'),
    `Expected prepare focus, got ${f.doc.activeElement?.id}`,
  );
  assert.doesNotMatch(
    JSON.stringify(report),
    /private-seat|private-room-credential|private-token|private-invite|private\.example|token|recipe|roomId|seat|sequence/i,
  );
});

test('paused legal room reuses only the ordinary controller sample and preserves accepted state, input and storage', async (t) => {
  const f = await fixture(t),
    room = pausedRoom(f),
    before = snapshotAuthoritativeRoom(room);
  f.open();
  f.pads.push(device());
  f.ui.frame();
  f.ui.frame();
  const reads = f.reads,
    writes = [...f.saved.writes],
    lifecycle = f.lifecycle.snapshot();
  const report = await prepare(f);
  assert.equal(report.game.state, 'paused');
  assert.equal(report.controller.status, 'connected');
  assert.equal(report.controller.assigned, true);
  assert.equal(report.controller.neutral, null);
  assert.equal(report.controller.confirmBlocked, null);
  assert.match(f.$('support-summary-controller').textContent, /observed/i);
  assert.doesNotMatch(f.$('support-summary-controller').textContent, /reports.*ready/i);
  assert.equal(f.reads, reads);
  assert.equal(f.submits, 0);
  assert.deepEqual(f.saved.writes, writes);
  assert.deepEqual(f.lifecycle.snapshot(), lifecycle);
  assert.deepEqual(snapshotAuthoritativeRoom(room), before);
  assert.doesNotMatch(
    JSON.stringify(report),
    /private-room-controller|buttons|axes|roomId|contentHash|controlActivation|sequence|recipe|seats/,
  );
  f.pads.length = 0;
  f.ui.frame();
  const disconnected = await prepare(f);
  assert.equal(disconnected.controller.status, 'disconnected');
  assert.equal(disconnected.controller.assigned, false);
  f.pads.push(device());
  f.ui.frame();
  f.ui.frame();
  assert.equal((await prepare(f)).controller.status, 'connected');
  f.failReads();
  f.ui.frame();
  assert.equal((await prepare(f)).controller.status, 'unavailable');
});

test('Rooms summary reports actual local connection phases without issuing Ready, resume, pause or transport work', async (t) => {
  const f = await fixture(t);
  f.open();
  f.lifecycle.own({ seat: 0, token: 'private-connecting-token' });
  assert.equal((await prepare(f)).game.state, 'connecting');
  f.lifecycle.suspend();
  assert.equal((await prepare(f)).game.state, 'recovering');
  f.lifecycle.abandon();
  assert.equal((await prepare(f)).game.state, 'abandoned');
  assert.deepEqual([f.requests, f.submits, f.pauses, f.reads], [0, 0, 0, 0]);
});

test('accepted waiting, playing and terminal room states stay distinct from local transport recovery', async (t) => {
  const f = await fixture(t),
    room = createAuthoritativeRoom(
      { family: 'snake', mode: 'versus', level: CLASSIC_SNAKE_LEVELS[0].level, seed: 17 },
      { id: 'a'.repeat(32), contentHash: 'b'.repeat(64) },
    );
  f.lifecycle.own({ seat: 0, token: 'private-state-token' });
  f.accept(room);
  f.open();
  assert.equal((await prepare(f)).game.state, 'waiting');
  joinAuthoritativeRoom(room, 0);
  readyAuthoritativeRoom(room, 0, 0);
  readyAuthoritativeRoom(room, 1, 0);
  f.accept(room);
  const playing = snapshotAuthoritativeRoom(room);
  assert.equal((await prepare(f)).game.state, 'playing');
  assert.deepEqual(snapshotAuthoritativeRoom(room), playing);
  assert.equal(f.submits, 0);
  for (let n = 0; n < 6000 && room.status === 'playing'; n++) stepAuthoritativeRoom(room, 0);
  assert.equal(room.status, 'finished', 'Use an actual terminal core outcome.');
  f.accept(room);
  assert.ok(
    f.ui.shell.topDialog() === f.$('room-results-dialog'),
    'Results must own the top modal.',
  );
  f.ui.shell.back();
  assert.ok(
    f.ui.shell.topDialog() === f.$('room-settings-dialog'),
    'Settings must own the top modal.',
  );
  assert.equal((await prepare(f)).game.state, 'finished');
  assert.deepEqual([f.requests, f.submits, f.pauses], [0, 0, 0]);
});

test('first accepted room and replacement identity keep the mounted support owner through Settings, blur and disposal', async (t) => {
  const f = await fixture(t),
    first = pausedRoom(f);
  f.open();
  await prepare(f);
  const root = f.$('room-support-summary-root'),
    button = f.$('support-summary-prepare');
  const replacement = createAuthoritativeRoom(
    { family: 'snake', mode: 'versus', level: CLASSIC_SNAKE_LEVELS[0].level, seed: 18 },
    { id: 'c'.repeat(32), contentHash: 'b'.repeat(64) },
  );
  assert.notEqual(first.id, replacement.id);
  f.lifecycle.own({ seat: 0, token: 'private-replacement-token' });
  f.accept(replacement);
  assert.equal(f.$('support-summary-json').textContent, '');
  f.open();
  assert.equal((await prepare(f)).game.state, 'waiting');
  assert.ok(f.$('room-support-summary-root') === root, 'Retain the mounted root node.');
  assert.ok(f.$('support-summary-prepare') === button, 'Retain the native prepare button.');
  f.win.emit('blur');
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.$('support-summary-download').disabled, true);
  f.ui.dispose();
  assert.ok(root.closest('dialog') === null, 'Disposal returns the root to its original owner.');
  assert.deepEqual([f.requests, f.submits, f.pauses], [0, 0, 0]);
});

test('closing actual Rooms Settings retires a late preparation without reclaiming focus', async (t) => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const f = await fixture(t, { storageAPI: { persisted: () => pending } });
  f.open();
  f.$('support-summary-prepare').click();
  await turn();
  f.$('room-settings-dialog').close();
  f.$('room-action-primary').focus();
  assert.ok(
    f.doc.activeElement.closest('dialog') === f.ui.shell.topDialog(),
    'Replacement focus belongs to the active native Home modal.',
  );
  const focus = f.doc.activeElement;
  finish(true);
  await turn();
  await turn();
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.$('support-summary-download').disabled, true);
  assert.ok(
    f.doc.activeElement === focus,
    `Expected retained ${focus?.id}, got ${f.doc.activeElement?.id}`,
  );
  f.open();
  assert.equal(f.$('support-summary-json').textContent, '');
});

test('native child modal transition retires prepared and pending Rooms reports; ordinary frames retain them', async (t) => {
  let finish,
    held = false;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const f = await fixture(t, {
    storageAPI: { persisted: () => (held ? pending : Promise.resolve(false)) },
  });
  f.open();
  await prepare(f);
  const json = f.$('support-summary-json').textContent,
    prepareButton = f.$('support-summary-prepare'),
    reads = f.reads;
  f.ui.frame();
  assert.equal(f.$('support-summary-json').textContent, json);
  assert.ok(
    f.doc.activeElement === prepareButton,
    `Expected prepare focus, got ${f.doc.activeElement?.id}`,
  );
  assert.equal(f.reads, reads + 1, 'Only the ordinary frame samples input.');
  f.ui.shell.open('help');
  assert.equal(f.$('room-settings-dialog').open, true);
  assert.ok(f.ui.shell.topDialog() === f.$('room-help-dialog'), 'Help must own the top modal.');
  assert.equal(f.$('support-summary-json').textContent, '');
  f.$('support-summary-prepare').click();
  await turn();
  assert.equal(f.$('support-summary-json').textContent, '');
  f.$('room-help-dialog').close();
  held = true;
  f.$('support-summary-prepare').click();
  await turn();
  f.ui.shell.open('help');
  const focus = f.doc.activeElement,
    before = [f.reads, f.requests, f.submits, [...f.saved.writes]];
  finish(true);
  await turn();
  await turn();
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.$('support-summary-download').disabled, true);
  assert.ok(
    f.doc.activeElement === focus,
    `Expected retained ${focus?.id}, got ${f.doc.activeElement?.id}`,
  );
  assert.deepEqual([f.reads, f.requests, f.submits, f.saved.writes], before);
  f.$('room-help-dialog').close();
  assert.equal(f.$('support-summary-json').textContent, '');
});

test('foreground/page retirement and suspension clear cached input and cannot publish old Rooms facts', async (t) => {
  const f = await fixture(t);
  f.open();
  f.pads.push(device());
  f.ui.frame();
  f.ui.frame();
  assert.equal((await prepare(f)).controller.freshness, 'recent');
  f.doc.focused = false;
  f.win.emit('blur');
  f.$('support-summary-prepare').click();
  await turn();
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.$('support-summary-download').disabled, true);
  f.doc.focused = true;
  f.win.emit('focus');
  assert.equal((await prepare(f)).controller.freshness, 'unavailable');
  f.ui.frame();
  f.ui.suspend();
  assert.equal((await prepare(f)).controller.freshness, 'unavailable');
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.$('support-summary-json').textContent, '');
  f.doc.hidden = false;
  f.win.emit('pagehide', { persisted: true });
  assert.equal(f.$('support-summary-download').disabled, true);
  f.$('support-summary-prepare').click();
  await turn();
  assert.equal(
    f.$('support-summary-json').textContent,
    '',
    'A hidden persisted page cannot prepare a new report.',
  );
  f.win.emit('pageshow', { persisted: true });
  assert.equal((await prepare(f)).controller.freshness, 'unavailable');
  f.ui.dispose();
  const reads = f.reads;
  f.ui.frame();
  assert.equal(f.reads, reads);
});

test('blur retires pending native Rooms preparation and cannot reclaim newer focus after foreground returns', async (t) => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const f = await fixture(t, { storageAPI: { persisted: () => pending } });
  f.open();
  f.$('support-summary-prepare').click();
  await turn();
  f.doc.focused = false;
  f.win.emit('blur');
  f.$('room-action-menu').focus();
  const focus = f.doc.activeElement;
  f.doc.focused = true;
  f.win.emit('focus');
  finish(true);
  await turn();
  await turn();
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.$('support-summary-download').disabled, true);
  assert.ok(
    f.doc.activeElement === focus,
    `Expected retained ${focus?.id}, got ${f.doc.activeElement?.id}`,
  );
  assert.deepEqual([f.requests, f.submits, f.pauses, f.reads], [0, 0, 0, 0]);
});

test('Rooms export uses the exact captured preview; locale refresh preserves its focus, JSON and native actions', async (t) => {
  const f = await fixture(t);
  f.open();
  f.ui.frame();
  const report = await prepare(f),
    json = f.$('support-summary-json').textContent,
    download = f.$('support-summary-download'),
    blobs = [];
  t.mock.method(URL, 'createObjectURL', (blob) => {
    blobs.push(blob);
    return 'blob:room-local-summary';
  });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) =>
    schedule(callback, delay === 60000 ? 0 : delay, ...args),
  );
  assert.equal(blobs.length, 0);
  download.focus();
  download.click();
  await waitFor(() => blobs.length === 1);
  assert.deepEqual(JSON.parse(await blobs[0].text()), report);
  setLocale('uk', { persist: false });
  assert.match(f.$('support-summary-title').textContent, /Локальний звіт/);
  assert.ok(
    f.doc.activeElement === download,
    `Expected download focus, got ${f.doc.activeElement?.id}`,
  );
  assert.equal(f.$('support-summary-json').textContent, json);
  assert.ok(f.$('support-summary-download') === download, 'Retain the native download node.');
  assert.doesNotMatch(
    f.$('room-support-summary-root').textContent,
    /interface:|supportSummary\.|\{\{/,
  );
  setLocale('en', { persist: false });
  assert.ok(
    f.doc.activeElement === download,
    `Expected download focus, got ${f.doc.activeElement?.id}`,
  );
  assert.equal(f.$('support-summary-json').textContent, json);
  assert.deepEqual([f.requests, f.submits, f.pauses], [0, 0, 0]);
});
