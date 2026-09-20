import test from 'node:test';
import assert from 'node:assert/strict';
import { browseWorlds, installedWorldMode } from '../ui/worlds-browser.mjs';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const themes = ['fpv', 'ukraine', 'retro', 'coupa'];
const entries = Array.from({ length: 36 }, (_, i) => ({
  key: `source:world-${i}`,
  themeId: themes[i % 4],
  mode: i % 3 ? 'Arcade' : 'Tactical',
}));
test('all 36 choices traverse exactly once in deterministic 4/2 card pages and every theme/mode intersection', () => {
  for (const size of [2, 4])
    for (const theme of ['', ...themes])
      for (const mode of ['', 'Arcade', 'Tactical']) {
        const seen = [];
        for (let page = 0; ; page++) {
          const view = browseWorlds(entries, { size, theme, mode, page });
          assert(view.visible.length <= size);
          seen.push(...view.visible);
          if (page + 1 === view.pages) break;
        }
        assert.deepEqual(
          seen,
          entries
            .filter((e) => (!theme || e.themeId === theme) && (!mode || e.mode === mode))
            .map((e) => e.key),
        );
      }
  assert.equal(browseWorlds(entries, { page: 99 }).page, 8);
  assert.throws(() => browseWorlds([...entries, entries[0]]), /Duplicate/);
});
function fixture(t, changes = {}) {
  const doc = new Document();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  Object.assign(doc.defaultView, changes.view);
  let resized;
  const media = {
    matches: false,
    addEventListener: (_, fn) => {
      resized = fn;
    },
    removeEventListener: () => {},
  };
  const calls = [],
    chapters = entries.map((entry, i) => ({
      id: `world-${i}`,
      name: `World ${i}`,
      themeId: entry.themeId,
      mode: entry.mode,
      inspect: async () => ({ status: 'absent' }),
      download: async () => {
        calls.push(i);
      },
      install: async () => {
        calls.push(i);
      },
      choose: async () => {
        calls.push(i);
      },
      ...changes.chapter?.(i),
    }));
  const panel = attachOptionalChaptersPanel({
    document: doc,
    matchMedia: () => media,
    getLibrary: () => ({ packs: [] }),
    sourceChapters: chapters,
    loadCatalog: async () => ({ format: 'revealline-optional-chapters.v1', packs: [] }),
    ...changes.panel,
  });
  const $ = (id) => doc.getElementById(`optional-worlds-${id}`);
  const nav = attachControllerNavigation({
    document: doc,
    getScope: () => 'menu',
    getRoot: () => $('dialog'),
    getDefaultFocus: () => $('top-back'),
    keyboard: true,
    onBack: () => panel.close(),
  });
  t.after(() => {
    nav.destroy();
    panel.dispose();
  });
  const visible = () => $('cards').children.filter((card) => !card.hidden);
  return {
    doc,
    panel,
    nav,
    $,
    calls,
    visible,
    resize: (matches = true) => {
      media.matches = matches;
      resized();
    },
    change(id, value) {
      $(id).focus();
      $(id).value = value;
      $(id).onchange();
    },
    key(key) {
      const target = doc.activeElement;
      const event = target.emit('keydown', { key, repeat: false });
      target.emit('keyup', { key });
      return event;
    },
  };
}
test('world action stays inside a resized scrollport without changing focus or activating a choice', async (t) => {
  const frames = [],
    listeners = new Map();
  const f = fixture(t, {
    view: {
      requestAnimationFrame: (callback) => frames.push(callback),
      addEventListener: (name, callback) => {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(callback);
      },
      removeEventListener: (name, callback) => listeners.get(name)?.delete(callback),
    },
  });
  await f.panel.open();
  const dialog = f.$('dialog'),
    action = f.$('source-world-0-download');
  let height = 844;
  dialog.scrollTop = 0;
  dialog.clientTop = 2;
  Object.defineProperty(dialog, 'clientHeight', { get: () => height - 28 });
  dialog.getBoundingClientRect = () => ({ top: 12, bottom: height - 12 });
  dialog.querySelector('.optional-worlds-top').getBoundingClientRect = () => ({
    top: 14,
    bottom: 100,
  });
  action.getBoundingClientRect = () => ({
    top: 550 - dialog.scrollTop,
    bottom: 598 - dialog.scrollTop,
  });
  action.focus();
  const flush = () => {
    for (const callback of frames.splice(0)) callback();
  };
  flush();
  assert.equal(dialog.scrollTop, 0);
  height = 390;
  for (const callback of listeners.get('resize')) callback();
  flush();
  assert(action.getBoundingClientRect().top >= 108);
  assert(action.getBoundingClientRect().bottom <= 368);
  assert.equal(f.doc.activeElement, action);
  assert.deepEqual(f.calls, []);
  const settled = dialog.scrollTop;
  for (const callback of listeners.get('resize')) callback();
  f.panel.close();
  flush();
  assert.equal(dialog.scrollTop, settled, 'A queued resize cannot scroll the closed dialog.');
  f.panel.dispose();
  assert.equal(listeners.get('resize').size, 0);
});

test('actual panel traverses every card, filters without work and resizes with reachable focus', async (t) => {
  const f = fixture(t);
  await f.panel.open();
  const seen = new Set();
  while (true) {
    assert.equal(f.visible().length, 4);
    for (const card of f.visible()) seen.add(card.id);
    if (f.$('next').disabled) break;
    f.$('next').focus();
    f.$('next').click();
  }
  assert.equal(seen.size, 36);
  assert.ok(
    f.doc.activeElement === f.$('previous'),
    'Focus must remain on the exact expected control.',
  );
  f.change('theme', 'ukraine');
  f.change('mode', 'Tactical');
  assert.match(f.$('page').textContent, /3 chapters/);
  assert.deepEqual(
    f.visible().map((card) => card.id),
    [9, 21, 33].map((i) => `optional-worlds-source-world-${i}-card`),
  );
  f.$('source-world-33-recovery-summary').focus();
  f.resize();
  assert.equal(f.visible().length, 2);
  assert.ok(
    f.doc.activeElement === f.$('theme'),
    'Focus must remain on the exact expected control.',
  );
  assert.deepEqual(f.calls, []);
});
test('filter and paging preserve exact pending work; failure remains on its visible card and retry acts once', async (t) => {
  let fail,
    signal,
    calls = 0;
  const f = fixture(t, {
    chapter: (i) =>
      i === 0
        ? {
            download: async (options) => {
              signal = options.signal;
              calls++;
              await new Promise((_, reject) => {
                fail = reject;
              });
            },
          }
        : {},
  });
  await f.panel.open();
  const action = f.$('source-world-0-download');
  action.focus();
  const job = action.onclick();
  f.change('theme', 'ukraine');
  f.$('next').click();
  assert.equal(signal.aborted, false);
  assert.equal(calls, 1);
  assert(f.visible().includes(f.$('source-world-0-card')));
  assert.equal(f.visible().length, 4);
  fail(new Error('Exact original refused'));
  await job;
  assert.match(f.$('status').textContent, /Exact original refused/);
  assert(f.visible().includes(f.$('source-world-0-card')));
  assert.ok(f.doc.activeElement === f.$('theme'), 'Completion respects deliberate filter focus');
  action.focus();
  const retry = action.onclick();
  assert.equal(calls, 2);
  fail(new Error('Retry refused'));
  await retry;
  assert.ok(f.doc.activeElement === action, 'Focus must remain on the exact expected control.');
});
test('remote failure still inspects exact source cards and exposes remaining installed choices without installation', async (t) => {
  const pack = { id: 'local-original', name: 'Local original', themes: [{ id: 'retro' }] },
    chosen = [];
  const f = fixture(t, {
    chapter: (i) => (i === 35 ? { inspect: async () => ({ status: 'installed' }) } : {}),
    panel: {
      getLibrary: () => ({ packs: [pack] }),
      loadCatalog: async () => {
        throw new Error('Offline');
      },
      chooseInstalled: async (value) => {
        chosen.push(value);
      },
    },
  });
  await f.panel.open();
  assert.match(f.$('status').textContent, /Online list unavailable/);
  f.change('theme', 'coupa');
  while (!f.$('next').disabled) f.$('next').click();
  assert.equal(f.$('source-world-35-choose').disabled, false);
  assert(f.visible().includes(f.$('source-world-35-card')));
  f.change('mode', 'Other');
  f.change('theme', 'retro');
  const action = f.$('installed-choose-local-original');
  assert.equal(action.closest('[hidden]'), null);
  await action.onclick();
  assert.deepEqual(chosen, [pack]);
  assert.equal(f.$('dialog').open, false);
  assert.deepEqual(f.calls, []);
});

test('native controller select preview and Back keep filters unchanged; Confirm commits without selecting a chapter', async (t) => {
  const f = fixture(t);
  await f.panel.open();
  f.$('theme').focus();
  f.nav.handle({ confirm: true });
  f.nav.handle({ direction: 'down' });
  assert.equal(f.$('theme').value, '');
  assert.match(f.$('page').textContent, /36 chapters/);
  f.nav.handle({ back: true });
  assert.equal(f.$('theme').value, '');
  assert.equal(f.$('dialog').open, true);
  assert.ok(
    f.doc.activeElement === f.$('theme'),
    'Focus must remain on the exact expected control.',
  );
  f.nav.handle({ confirm: true });
  f.nav.handle({ direction: 'down' });
  f.nav.handle({ confirm: true });
  assert.equal(f.$('theme').value, 'fpv');
  assert.match(f.$('page').textContent, /9 chapters/);
  assert.deepEqual(f.calls, []);
  f.nav.handle({ back: true });
  assert.equal(f.$('dialog').open, false);
});

test('installed mode follows actual authored policies and a multi-theme pack is one reachable choice', () => {
  const arcade = { classic: { arcadeActions: { version: 'arcade-actions.v1' } } },
    tactical = { classic: {} };
  assert.equal(installedWorldMode({ campaigns: [{ levels: [arcade, arcade] }] }), 'Arcade');
  assert.equal(installedWorldMode({ campaigns: [{ levels: [tactical] }] }), 'Tactical');
  assert.equal(installedWorldMode({ campaigns: [{ levels: [arcade, tactical] }] }), 'Other');
  const pack = { key: 'installed:mixed', themeIds: ['ukraine', 'retro'], mode: 'Other' };
  for (const theme of ['', 'ukraine', 'retro'])
    assert.deepEqual(browseWorlds([pack], { theme }).visible, [pack.key]);
  assert.deepEqual(browseWorlds([pack], { theme: 'fpv' }).visible, []);
});

test('cancelling an unavailable online list leaves inspected installed originals usable and late metadata cannot reopen the dialog', async (t) => {
  let release;
  const f = fixture(t, {
    chapter: (i) => (i === 0 ? { inspect: async () => ({ status: 'installed' }) } : {}),
    panel: {
      loadCatalog: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  });
  const opened = f.panel.open();
  await waitFor(() => !!release);
  f.$('cancel').focus();
  f.$('cancel').click();
  const choose = f.$('source-world-0-choose');
  assert.equal(choose.disabled, false);
  assert.equal(choose.closest('[hidden]'), null);
  await choose.onclick();
  assert.deepEqual(f.calls, [0]);
  assert.equal(f.$('dialog').open, false);
  release({ format: 'revealline-optional-chapters.v1', packs: [] });
  await opened;
  assert.equal(f.$('dialog').open, false);
});

test('widening and releasing a retained card never leave focus on disabled page controls', async (t) => {
  let finish;
  const f = fixture(t, {
    chapter: (i) => ({
      mode: i >= 1 && i <= 4 ? 'Arcade' : 'Tactical',
      ...(i === 0
        ? {
            download: () =>
              new Promise((resolve) => {
                finish = resolve;
              }),
          }
        : {}),
    }),
  });
  await f.panel.open();
  f.change('mode', 'Arcade');
  f.resize();
  f.$('next').focus();
  assert.equal(f.$('next').disabled, false);
  f.resize(false);
  assert.equal(f.$('next').disabled, true);
  assert.equal(f.$('previous').disabled, true);
  assert.ok(
    f.doc.activeElement === f.$('theme'),
    'Focus must remain on the exact expected control.',
  );

  f.change('mode', '');
  const action = f.$('source-world-0-download');
  action.focus();
  const job = action.onclick();
  f.change('mode', 'Arcade');
  assert.match(f.$('page').textContent, /Page 1 of 2/);
  finish();
  await job;
  assert.equal(f.$('next').disabled, false);
  f.$('next').focus();
  f.$('next').click();
  assert.match(f.$('page').textContent, /Page 1 of 1/);
  assert.equal(f.$('next').disabled, true);
  assert.equal(f.$('previous').disabled, true);
  assert.ok(
    f.doc.activeElement === f.$('theme'),
    'Focus must remain on the exact expected control.',
  );
});

test('file picker cancellation retains More Worlds recovery files and pending work; dialog Escape still closes', async (t) => {
  let finish, signal;
  const f = fixture(t, {
    chapter: (i) =>
      i === 0
        ? {
            download: (options) => {
              signal = options.signal;
              return new Promise((resolve) => {
                finish = resolve;
              });
            },
          }
        : {},
  });
  await f.panel.open();
  const recovery = f.$('source-world-0-recovery');
  recovery.open = true;
  for (const id of ['source-world-0-pack', 'source-world-0-media']) {
    const input = f.$(id);
    input.files = [new Blob(['retained original'])];
    input.focus();
    input.dispatchEvent(new Event('cancel', { bubbles: true }));
    assert.equal(f.$('dialog').open, true);
    assert.equal(recovery.open, true);
    assert.equal(f.doc.activeElement, input);
    assert.equal(await input.files[0].text(), 'retained original');
  }
  const pending = f.$('source-world-0-download').onclick();
  await waitFor(() => !!finish);
  const status = f.$('status').textContent;
  f.$('source-world-0-pack').dispatchEvent(new Event('cancel', { bubbles: true }));
  assert.equal(signal.aborted, false);
  assert.equal(f.$('status').textContent, status);
  const escape = new Event('cancel', { cancelable: true });
  f.$('dialog').dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(signal.aborted, true);
  assert.equal(f.$('dialog').open, false);
  finish();
  await pending;
});
