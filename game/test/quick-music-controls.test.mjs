import assert from 'node:assert/strict';
import test from 'node:test';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  attachQuickMusicControls,
  musicShortcutAction,
  MUSIC_SHORTCUTS_KEY,
} from '../ui/quick-music-controls.mjs';

function setup({ stored = null, active = () => true, conflicts = () => false } = {}) {
  const doc = new Document(),
    win = new Events(),
    values = new Map(),
    calls = [];
  if (stored !== null) values.set(MUSIC_SHORTCUTS_KEY, stored);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const menu = doc.createElement('button'),
    resume = doc.createElement('button'),
    settings = doc.createElement('section');
  doc.body.append(menu, resume, settings);
  let state = {
    desired: false,
    playing: false,
    status: 'paused',
    volume: 0.6,
    queue: ['one', 'two'],
    track: { id: 'one', title: 'One', artist: 'Artist' },
  };
  const master = { muted: false, volume: 0.65 };
  let resolvePlay = null,
    deferredPlay = false;
  const host = attachQuickMusicControls({
    document: doc,
    window: win,
    prefix: 'test',
    after: [menu, resume],
    settingsRoot: settings,
    getStorage: () => storage,
    active,
    conflicts,
    getMaster: () => master,
    snapshot: () => state,
    play: () => {
      calls.push('play');
      state = {
        ...state,
        desired: true,
        playing: !deferredPlay,
        status: deferredPlay ? 'loading' : 'playing',
      };
      return deferredPlay
        ? new Promise((resolve) => {
            resolvePlay = resolve;
          })
        : true;
    },
    pause: () => {
      calls.push('pause');
      state = { ...state, desired: false, playing: false, status: 'paused' };
    },
    next: () => {
      calls.push('next');
      state = { ...state, track: { id: 'two', title: 'Two' } };
    },
  });
  return {
    doc,
    win,
    values,
    storage,
    calls,
    master,
    host,
    menu,
    resume,
    state: () => state,
    setState: (value) => {
      state = { ...state, ...value };
      host.render();
    },
    defer: () => {
      deferredPlay = true;
    },
    finish: () => resolvePlay?.(true),
    key: (code, extra = {}) => doc.body.emit('keydown', { code, ...extra }),
    $: (id) => doc.getElementById(id),
  };
}

test('B/N routing yields to composition, editing, modifiers, repeats and priority owners', () => {
  assert.equal(musicShortcutAction({ code: 'KeyB' }), 'toggle');
  assert.equal(musicShortcutAction({ key: 'n' }), 'next');
  assert.equal(musicShortcutAction({ code: 'KeyM' }), null);
  for (const blocked of [
    { defaultPrevented: true },
    { repeat: true },
    { isComposing: true },
    { keyCode: 229 },
    { key: 'Dead' },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
  ])
    assert.equal(musicShortcutAction({ code: 'KeyB', ...blocked }), null);
  for (const option of [{ enabled: false }, { active: false }, { conflicts: true }])
    assert.equal(musicShortcutAction({ code: 'KeyN' }, option), null);
  const doc = new Document();
  for (const tag of ['input', 'textarea', 'select']) {
    const target = doc.createElement(tag);
    assert.equal(musicShortcutAction({ code: 'KeyB', target }), null);
  }
  for (const attr of ['contenteditable', 'data-game-reading']) {
    const target = doc.createElement('div');
    target.setAttribute(attr, '');
    assert.equal(musicShortcutAction({ code: 'KeyN', target }), null);
  }
});

test('main/pause buttons share transport, preserve focus and do not change master sound', () => {
  const f = setup(),
    before = { ...f.master };
  f.resume.focus();
  assert.equal(
    f.resume.parentNode.children[f.resume.parentNode.children.indexOf(f.resume) + 1].id,
    'test-quick-music-1',
  );
  f.$('test-quick-music-0-toggle').click();
  assert.deepEqual(f.calls, ['play']);
  assert.equal(f.$('test-quick-music-1-toggle').textContent, 'Pause music');
  f.$('test-quick-music-1-toggle').click();
  assert.deepEqual(f.calls, ['play', 'pause']);
  assert.equal(f.doc.activeElement, f.resume);
  assert.deepEqual(f.master, before);
  assert.match(f.$('test-quick-music-0').textContent, /One · Artist · Paused/);
  f.host.dispose();
});

test('keyboard Play starts synchronously and Pause cancels loading intent without waiting', async () => {
  const f = setup();
  f.defer();
  assert.equal(f.key('KeyB').defaultPrevented, true);
  assert.deepEqual(f.calls, ['play']);
  assert.equal(f.$('test-quick-music-0-toggle').textContent, 'Pause music');
  assert.equal(f.key('KeyB').defaultPrevented, true);
  assert.deepEqual(f.calls, ['play', 'pause']);
  f.finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.state().desired, false);
  assert.equal(f.$('test-quick-music-0-toggle').textContent, 'Play music');
  f.host.dispose();
});

test('Next while paused selects a song without introducing Play or changing focus', () => {
  const f = setup();
  f.resume.focus();
  f.key('KeyN');
  assert.deepEqual(f.calls, ['next']);
  assert.equal(f.state().track.id, 'two');
  assert.equal(f.state().desired, false);
  assert.equal(f.doc.activeElement, f.resume);
  f.host.dispose();
});

test('blocked browser state offers Play retry instead of silently cancelling its intent', () => {
  const f = setup();
  f.setState({ desired: true, status: 'blocked' });
  assert.equal(f.$('test-quick-music-0-toggle').textContent, 'Play music');
  assert.match(f.$('test-quick-music-0').textContent, /Choose Play music to retry/);
  f.key('KeyB');
  assert.deepEqual(f.calls, ['play']);
  f.host.dispose();
});

test('shortcut opt-out persists independently and leaves touch/controller buttons usable', () => {
  const f = setup(),
    toggle = f.$('test-music-shortcuts');
  assert.equal(toggle.checked, true);
  toggle.click();
  assert.equal(f.values.get(MUSIC_SHORTCUTS_KEY), 'false');
  assert.equal(f.key('KeyB').defaultPrevented, false);
  assert.deepEqual(f.calls, []);
  assert.equal(f.$('test-quick-music-0-toggle').hasAttribute('aria-keyshortcuts'), false);
  f.$('test-quick-music-0-toggle').click();
  assert.deepEqual(f.calls, ['play']);
  assert.deepEqual([...f.values.keys()], [MUSIC_SHORTCUTS_KEY]);
  f.host.dispose();
  const reloaded = setup({ stored: 'false' });
  assert.equal(reloaded.$('test-music-shortcuts').checked, false);
  reloaded.key('KeyB');
  assert.deepEqual(reloaded.calls, []);
  reloaded.host.dispose();
});

test('current storage notifications synchronize shortcut opt-out but stale notifications cannot', () => {
  const f = setup();
  f.values.set(MUSIC_SHORTCUTS_KEY, 'false');
  f.win.emit('storage', { key: MUSIC_SHORTCUTS_KEY, newValue: 'true', storageArea: f.storage });
  assert.equal(f.$('test-music-shortcuts').checked, true);
  f.win.emit('storage', { key: MUSIC_SHORTCUTS_KEY, newValue: 'false', storageArea: f.storage });
  assert.equal(f.$('test-music-shortcuts').checked, false);
  f.host.dispose();
});

test('inactive practice parent, background and custom game bindings retain keyboard ownership', () => {
  let active = true,
    conflicts = false;
  const f = setup({ active: () => active, conflicts: () => conflicts });
  active = false;
  assert.equal(f.key('KeyB').defaultPrevented, false);
  active = true;
  conflicts = true;
  assert.equal(f.key('KeyN').defaultPrevented, false);
  conflicts = false;
  f.doc.hidden = true;
  assert.equal(f.key('KeyB').defaultPrevented, false);
  f.doc.hidden = false;
  f.doc.focused = false;
  assert.equal(f.key('KeyN').defaultPrevented, false);
  assert.deepEqual(f.calls, []);
  f.doc.focused = true;
  assert.equal(f.key('KeyB').defaultPrevented, true);
  assert.deepEqual(f.calls, ['play']);
  f.host.dispose();
});

test('dispose releases rows and handlers, including callbacks from previously mounted controls', () => {
  const f = setup(),
    button = f.$('test-quick-music-0-toggle');
  f.host.dispose();
  button.click();
  f.key('KeyB');
  assert.deepEqual(f.calls, []);
  assert.equal(f.$('test-quick-music-0'), null);
  assert.equal(f.doc.listeners.get('keydown')?.size, 0);
  assert.equal(f.win.listeners.get('storage')?.size, 0);
});
