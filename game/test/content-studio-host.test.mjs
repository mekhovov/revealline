import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { createContentDraftBackend } from '../content-design/drafts.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';

const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
let serial = 0;
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
};

// Execute the real Studio entry against actual markup and the finite IndexedDB
// transaction model. Canvas geometry and browser layout remain separate evidence.
async function fixture(t, { controller = false } = {}) {
  const doc = new Document(),
    win = doc.defaultView,
    memory = managedIndexedDB();
  doc.parentNode = win;
  const frames = new Map(),
    timers = new Map(),
    sessionValues = new Map();
  const blobs = new Map(),
    downloads = [];
  let fetchSource = () => assert.fail('No preview media fetch without an explicit Play.');
  let frameSerial = 0,
    timerSerial = 0,
    now = 1000;
  const pad = {
    id: 'Studio host test pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: now,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    location: new URL('https://studio.example/game/studio/?project=studio-host-fixture'),
    confirm: () => true,
    performance: { now: () => now },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame(fn) {
      frames.set(++frameSerial, fn);
      return frameSerial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    let value = '';
    Object.defineProperty(node, 'value', {
      get: () => value,
      set(next) {
        value = String(next ?? '');
      },
    });
    let disabled = false;
    Object.defineProperty(node, 'disabled', {
      get: () => disabled,
      set(value) {
        disabled = !!value;
        if (disabled && doc.activeElement === node) doc.activeElement = doc.body;
      },
    });
    Object.defineProperty(node, 'selectedOptions', {
      get: () => node.options.filter((option) => option.selected || option.value === node.value),
    });
    node.before = (sibling) => node.parentNode.insertBefore(sibling, node);
    const click = node.click.bind(node);
    node.click = () => {
      if (node.tagName === 'A' && node.download)
        downloads.push({ name: node.download, href: node.href });
      return click();
    };
    node.getContext = () =>
      new Proxy(
        {},
        { get: (_target, key) => (key === 'measureText' ? () => ({ width: 20 }) : () => {}) },
      );
    return node;
  };
  function append(parent, source) {
    if (source.nodeName === '#text') {
      parent._text = (parent._text || '') + source.value;
      return;
    }
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs || []) {
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (['type', 'value', 'min', 'max', 'step', 'href', 'width', 'height'].includes(name))
        node[name] = value;
      if (['hidden', 'disabled', 'inert', 'open', 'checked', 'selected', 'multiple'].includes(name))
        node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
    if (node.tagName === 'TEXTAREA') node.value = node.textContent;
    if (node.tagName === 'SELECT') {
      const selected = node.options.find((option) => option.selected);
      if (selected) node.value = selected.value;
    }
  }
  const body = parse(html)
    .childNodes.find((n) => n.tagName === 'html')
    .childNodes.find((n) => n.tagName === 'body');
  for (const child of body.childNodes) append(doc.body, child);
  const restores = [];
  const install = (key, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restores.push(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key],
    );
  };
  install('document', doc);
  install('window', win);
  install('location', win.location);
  install('history', {
    replaceState(_state, _title, address) {
      win.location.href = address.href;
    },
  });
  install('indexedDB', memory.indexedDB);
  install('navigator', { getGamepads: () => (controller ? [pad] : []) });
  install('localStorage', {
    getItem: () => null,
    setItem: () => assert.fail('Studio must not write player preferences.'),
  });
  install('sessionStorage', {
    getItem: (key) => sessionValues.get(key) ?? null,
    setItem: (key, value) => sessionValues.set(key, value),
  });
  const URLImpl = globalThis.URL;
  install(
    'URL',
    class extends URLImpl {
      static createObjectURL(blob) {
        const url = `blob:studio-test/${blobs.size + 1}`;
        blobs.set(url, blob);
        return url;
      }
      static revokeObjectURL() {}
    },
  );
  install('setTimeout', (fn, ms) => {
    timers.set(++timerSerial, { fn, ms });
    return timerSerial;
  });
  install('clearTimeout', (id) => timers.delete(id));
  install('fetch', (...args) => fetchSource(...args));
  const locale = getLocale();
  setLocale('en', { persist: false });
  let inputHost;
  t.after(() => {
    inputHost?.destroy();
    win.emit('pagehide', { persisted: false });
    setLocale(locale, { persist: false });
    restores.reverse().forEach((restore) => restore());
  });
  await import(`../studio/studio.mjs?host=${++serial}`);
  await settle();
  const $ = (id) => doc.getElementById(id);
  assert.equal(doc.documentElement.dataset.toolState, 'ready', $('status').textContent);
  if (controller) inputHost = mountAuthoringInputHost({ document: doc, window: win });
  function focus(id) {
    const target = $(id);
    for (let parent = target.parentElement; parent; parent = parent.parentElement)
      if (parent.tagName === 'DETAILS') {
        parent.open = true;
        parent.setAttribute('open', '');
      }
    target.focus();
  }
  const tick = () => {
    now += 50;
    pad.timestamp = now;
    const pending = [...frames];
    frames.clear();
    pending.forEach(([, fn]) => fn(now));
  };
  async function pulse(index) {
    tick();
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
    await settle();
  }
  async function click(id, { focus = true } = {}) {
    if (focus) {
      for (let parent = $(id).parentElement; parent; parent = parent.parentElement)
        if (parent.tagName === 'DETAILS') {
          parent.open = true;
          parent.setAttribute('open', '');
        }
      $(id).focus();
    }
    $(id).click();
    await settle();
  }
  function edit(source) {
    $('source').value = typeof source === 'string' ? source : JSON.stringify(source);
    $('source').emit('input');
  }
  return {
    doc,
    win,
    $,
    click,
    edit,
    memory,
    timers,
    sessionValues,
    focus,
    tick,
    pulse,
    inputHost,
    blobs,
    downloads,
    setFetch: (fn) => (fetchSource = fn),
  };
}

test('actual Studio boots an editable project without touching player storage', async (t) => {
  const h = await fixture(t);
  assert.equal(JSON.parse(h.$('source').value).id, 'studio-host-fixture');
  assert.equal(h.$('apply').disabled, true);
  assert.equal(h.$('undo').disabled, true);
  assert.equal(h.$('redo').disabled, true);
  assert.equal(h.$('mission').value, 'nearby-shore');
});

test('actual Studio rejects invalid source without enabling Apply or changing the accepted checkpoint', async (t) => {
  const h = await fixture(t);
  await h.click('save');
  const backend = createContentDraftBackend(h.memory);
  const before = await backend.read('studio-host-fixture');
  h.edit('{"invalid":');
  await h.click('validate');
  assert.equal(h.$('apply').disabled, true);
  assert.equal(h.$('status').dataset.error, 'true');
  assert.equal(h.$('source').value, '{"invalid":');
  assert.deepEqual(await backend.read('studio-host-fixture'), before);
  assert.equal(h.doc.activeElement, h.$('validate'));
});

test('actual Studio Apply keeps a reachable owner after it disables the consumed action', async (t) => {
  const h = await fixture(t);
  const edited = JSON.parse(h.$('source').value);
  edited.name = 'Applied through actual host';
  h.edit(edited);
  await h.click('validate');
  assert.equal(h.$('apply').disabled, false);
  await h.click('apply');
  assert.equal(JSON.parse(h.$('source').value).name, edited.name);
  assert.equal(h.$('apply').disabled, true);
  assert.equal(h.doc.activeElement.id, 'validate');
  assert.equal(h.doc.activeElement.disabled, false);
});

test('actual Studio terminal Undo and Redo preserve exact history and a reachable focus owner', async (t) => {
  const h = await fixture(t);
  const original = JSON.parse(h.$('source').value);
  h.edit({ ...original, name: 'One committed edit' });
  await h.click('validate');
  await h.click('apply');
  await h.click('undo');
  assert.deepEqual(JSON.parse(h.$('source').value), original);
  assert.equal(h.$('undo').disabled, true);
  assert.equal(h.doc.activeElement.id, 'redo');
  assert.equal(h.doc.activeElement.disabled, false);
  await h.click('redo');
  assert.equal(JSON.parse(h.$('source').value).name, 'One committed edit');
  assert.equal(h.$('redo').disabled, true);
  assert.equal(h.doc.activeElement.id, 'undo');
  assert.equal(h.doc.activeElement.disabled, false);
});

test('actual Studio saves and stages an exact checkpoint without adopting it before Apply', async (t) => {
  const h = await fixture(t);
  const original = JSON.parse(h.$('source').value);
  h.edit({ ...original, name: 'Saved test revision' });
  await h.click('validate');
  await h.click('apply');
  await h.click('save');
  const backend = createContentDraftBackend(h.memory);
  const saved = await backend.read(original.id);
  assert.equal(saved.project.name, 'Saved test revision');
  assert.deepEqual(compileContentProject(saved.project).source, saved.project);
  h.edit({ ...saved.project, name: 'Later accepted edit' });
  await h.click('validate');
  await h.click('apply');
  await h.click('load');
  assert.equal(JSON.parse(h.$('source').value).name, 'Saved test revision');
  assert.equal(h.$('project-name').textContent, 'Later accepted edit');
  assert.equal(h.$('apply').disabled, false);
  await h.click('apply');
  assert.equal(h.$('project-name').textContent, 'Saved test revision');
});

for (const interruption of [
  'other-focus',
  'blur',
  'hidden',
  'focus-return',
  'blur-return',
  'hidden-return',
  'wheel',
  'page-down',
  'touch',
])
  test(`actual Studio late preview must not scroll after ${interruption}`, async (t) => {
    const h = await fixture(t),
      gate = deferred();
    h.setFetch(() => gate.promise);
    await h.click('play');
    const before = h.$('preview-panel').scrolled ?? 0;
    if (interruption === 'other-focus') h.$('source').focus();
    if (interruption === 'blur') h.win.emit('blur');
    if (interruption === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (interruption === 'focus-return') {
      h.focus('source');
      h.focus('play');
    }
    if (interruption === 'blur-return') {
      h.win.emit('blur');
      h.win.emit('focus');
    }
    if (interruption === 'hidden-return') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    }
    if (interruption === 'wheel') h.$('play').emit('wheel', { deltaY: 100 });
    if (interruption === 'page-down') h.$('play').emit('keydown', { key: 'PageDown' });
    if (interruption === 'touch') h.$('play').emit('touchstart');
    gate.resolve({ ok: true, json: async () => themes });
    await settle();
    assert.equal(h.$('preview-panel').scrolled ?? 0, before);
    assert.equal(h.$('preview-panel').hidden, false);
    assert.match(h.$('preview').src, /practice=1/);
  });

test('actual Studio current preview reveals once and explicit Return cancels the owned frame', async (t) => {
  const h = await fixture(t),
    gate = deferred();
  h.setFetch(() => gate.promise);
  await h.click('play');
  gate.resolve({ ok: true, json: async () => themes });
  await settle();
  assert.equal(h.$('preview-panel').scrolled, 1);
  assert.equal(h.doc.activeElement.id, 'play');
  assert.match(h.$('preview').src, /practice=1/);
  assert.equal(h.sessionValues.size, 1);
  await h.click('preview-return');
  assert.equal(h.$('preview-panel').hidden, true);
  assert.equal(h.$('preview').src, 'about:blank');
  assert.equal(h.doc.activeElement.id, 'play');
});

test('actual Studio closing a loading preview prevents late frame navigation and scenario writes', async (t) => {
  const h = await fixture(t),
    gate = deferred();
  h.setFetch(() => gate.promise);
  await h.click('play');
  await h.click('close-preview');
  gate.resolve({ ok: true, json: async () => themes });
  await settle();
  assert.equal(h.$('preview-panel').hidden, true);
  assert.equal(h.$('preview').src, 'about:blank');
  assert.equal(h.sessionValues.size, 0);
  assert.equal(h.$('preview-panel').scrolled ?? 0, 0);
});

for (const state of ['other-focus', 'hidden', 'unfocused'])
  test(`actual Studio Apply handoff cannot borrow ${state} ownership`, async (t) => {
    const h = await fixture(t);
    h.edit({ ...JSON.parse(h.$('source').value), name: 'Applied without focus theft' });
    await h.click('validate');
    h.focus('source');
    if (state === 'hidden') h.doc.hidden = true;
    if (state === 'unfocused') h.doc.focused = false;
    await h.click('apply', { focus: false });
    assert.equal(h.doc.activeElement.id, 'source');
    assert.equal(h.$('project-name').textContent, 'Applied without focus theft');
    assert.equal(h.$('apply').disabled, true);
  });

test('real shared controller Confirm preserves Apply, Undo and Redo successors through neutral polls', async (t) => {
  const h = await fixture(t, { controller: true });
  h.edit({ ...JSON.parse(h.$('source').value), name: 'Controller accepted edit' });
  h.focus('validate');
  await h.pulse(0);
  assert.equal(h.$('apply').disabled, false);
  h.focus('apply');
  await h.pulse(0);
  assert.equal(h.doc.activeElement.id, 'validate');
  h.focus('undo');
  await h.pulse(0);
  assert.equal(h.doc.activeElement.id, 'redo');
  await h.pulse(0);
  assert.equal(h.doc.activeElement.id, 'undo');
  assert.equal(JSON.parse(h.$('source').value).name, 'Controller accepted edit');
});

test('shared controller Back cancels unapplied source replacement and Confirm only retries the approved action once', async (t) => {
  const h = await fixture(t, { controller: true });
  const before = JSON.parse(h.$('source').value);
  h.edit({ ...before, name: 'Unapplied source to preserve' });
  h.$('project-id').value = 'another-studio-project';
  h.focus('new');
  await h.pulse(0);
  assert.equal(h.$('studio-source-discard').open, true);
  assert.equal(h.doc.activeElement.id, 'studio-source-discard-cancel');
  await h.pulse(1);
  assert.equal(h.$('studio-source-discard').open, false);
  assert.equal(h.doc.activeElement.id, 'new');
  assert.equal(JSON.parse(h.$('source').value).name, 'Unapplied source to preserve');
  await h.pulse(0);
  h.focus('studio-source-discard-confirm');
  await h.pulse(0);
  assert.equal(h.$('studio-source-discard').open, false);
  assert.equal(JSON.parse(h.$('source').value).id, 'another-studio-project');
  assert.equal(
    h.$('project-name').textContent,
    before.name,
    'Approved retry stages source, not Apply.',
  );
  assert.equal(h.$('apply').disabled, false);
  h.$('project-id').value = 'third-studio-project';
  h.focus('new');
  await h.pulse(0);
  assert.equal(
    h.$('studio-source-discard').open,
    true,
    'Prior approval cannot authorize a later replacement.',
  );
});

test('actual Studio backup exports only the applied validated project and can be inspected again without mutation', async (t) => {
  const h = await fixture(t);
  const accepted = JSON.parse(h.$('source').value);
  h.edit('{"unfinished":');
  await h.click('export');
  assert.equal(h.downloads.length, 1);
  const download = h.downloads[0];
  assert.equal(download.name, `${accepted.id}-backup.json`);
  const blob = h.blobs.get(download.href),
    text = await blob.text();
  assert.equal(blob.type, 'application/json');
  assert.equal(text, JSON.stringify(accepted));
  assert.deepEqual(compileContentProject(text).source, accepted);
  assert.equal(h.$('source').value, '{"unfinished":');
  assert.equal(h.$('apply').disabled, true);
  h.edit(text);
  await h.click('validate');
  assert.equal(h.$('apply').disabled, false);
  assert.equal(h.$('project-name').textContent, accepted.name);
});

test('actual Studio canceled import and late imported bytes preserve a newer source edit', async (t) => {
  const h = await fixture(t),
    gate = deferred();
  const original = h.$('source').value;
  h.$('import').files = [];
  h.$('import').emit('change');
  await settle();
  assert.equal(h.$('source').value, original);
  h.$('import').files = [{ size: original.length, text: () => gate.promise }];
  h.$('import').emit('change');
  await settle();
  h.edit('{"newer":');
  gate.resolve(original);
  await settle();
  assert.equal(h.$('source').value, '{"newer":');
  assert.equal(h.$('apply').disabled, true);
});

test('actual Studio discard approval rejects a changed form snapshot and preserves both drafts', async (t) => {
  const h = await fixture(t, { controller: true });
  const accepted = JSON.parse(h.$('source').value);
  h.edit({ ...accepted, name: 'Unapplied text' });
  h.$('project-id').value = 'original-request';
  h.focus('new');
  await h.pulse(0);
  h.$('project-id').value = 'later-request';
  h.focus('studio-source-discard-confirm');
  await h.pulse(0);
  assert.equal(h.$('studio-source-discard').open, false);
  assert.equal(JSON.parse(h.$('source').value).name, 'Unapplied text');
  assert.equal(h.$('project-name').textContent, accepted.name);
  assert.equal(h.$('apply').disabled, true);
});

test('a declined shared-controller discard never erases unapplied JSON when Undo was requested', async (t) => {
  const h = await fixture(t, { controller: true });
  const original = JSON.parse(h.$('source').value);
  h.edit({ ...original, name: 'Applied once' });
  await h.click('validate');
  await h.click('apply');
  h.edit('{"stillEditing":');
  h.focus('undo');
  await h.pulse(0);
  await h.pulse(1);
  assert.equal(h.$('source').value, '{"stillEditing":');
  assert.equal(h.$('project-name').textContent, 'Applied once');
  assert.equal(h.$('undo').disabled, false);
  assert.equal(h.$('redo').disabled, true);
  assert.equal(h.doc.activeElement.id, 'undo');
});

test('actual asynchronous Inspect saved retry reports its failure after discard approval without adopting or erasing source', async (t) => {
  const h = await fixture(t, { controller: true });
  const original = JSON.parse(h.$('source').value);
  h.edit({ ...original, name: 'Keep this until a checkpoint loads' });
  h.$('project-id').value = 'missing-checkpoint-project';
  h.focus('load');
  await h.pulse(0);
  assert.equal(h.$('studio-source-discard').open, true);
  h.focus('studio-source-discard-confirm');
  await h.pulse(0);
  assert.equal(h.$('studio-source-discard').open, false);
  assert.equal(h.$('status').dataset.error, 'true');
  assert.match(h.$('status').textContent, /checkpoint|saved draft/i);
  assert.equal(JSON.parse(h.$('source').value).name, 'Keep this until a checkpoint loads');
  assert.equal(h.$('project-name').textContent, original.name);
  assert.equal(h.$('apply').disabled, true);
});

for (const changed of [false, true])
  test(`actual actor commit ${changed ? 'rejects fields changed during' : 'revalidates and applies once after'} discard approval`, async (t) => {
    const h = await fixture(t, { controller: true });
    const before = JSON.parse(h.$('source').value);
    h.$('actor-select').value = 'keeper';
    h.$('actor-select').emit('change');
    h.$('actor-x').value = '59.5';
    h.edit({ ...before, name: 'Unapplied actor review text' });
    h.focus('actor-submit');
    h.$('actor-form').emit('submit');
    await settle();
    assert.equal(h.$('studio-source-discard').open, true);
    if (changed) h.$('actor-x').value = '58.5';
    h.focus('studio-source-discard-confirm');
    await h.pulse(0);
    assert.equal(h.$('studio-source-discard').open, false);
    if (changed) {
      assert.equal(JSON.parse(h.$('source').value).name, 'Unapplied actor review text');
      assert.equal(h.$('project-name').textContent, before.name);
      assert.equal(h.$('undo').disabled, true);
    } else {
      const applied = JSON.parse(h.$('source').value);
      assert.equal(applied.name, before.name);
      assert.equal(applied.missions[0].actors.find((actor) => actor.id === 'keeper').x, 59.5);
      assert.deepEqual(
        applied,
        editContentActor(before, before.missions[0].id, {
          action: 'replace',
          id: 'keeper',
          actor: { ...before.missions[0].actors[0], x: 59.5 },
        }),
      );
      await h.click('undo');
      assert.deepEqual(
        JSON.parse(h.$('source').value),
        before,
        'One Undo exactly restores the draft; approval did not double-apply.',
      );
    }
  });

for (const reason of ['focus', 'blur', 'hidden', 'pagehide'])
  test(`actual Studio discard approval is retired by ${reason}`, async (t) => {
    const h = await fixture(t);
    const source = h.$('source').value;
    h.edit(source);
    h.$('project-id').value = 'must-not-be-staged';
    await h.click('new');
    assert.equal(h.$('studio-source-discard').open, true);
    if (reason === 'focus') h.focus('source');
    if (reason === 'blur') h.win.emit('blur');
    if (reason === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (reason === 'pagehide') h.win.emit('pagehide', { persisted: true });
    assert.equal(h.$('studio-source-discard').open, false);
    if (reason === 'hidden') {
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    }
    if (reason === 'pagehide') h.win.emit('pageshow', { persisted: true });
    h.$('studio-source-discard-confirm').click();
    await settle();
    assert.equal(h.$('source').value, source);
    assert.equal(h.$('apply').disabled, true);
    if (reason === 'focus') assert.equal(h.doc.activeElement.id, 'source');
  });
