import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { createStudioStore, STUDIO_DATABASE } from '../presentation/studio-store.mjs';
import { importThemeBundle, hashPresentationBytes } from '../presentation/bundle.mjs';

let serial = 0;
async function fixture(t) {
  const doc = new Document(),
    win = doc.defaultView,
    memory = managedIndexedDB();
  const blobs = new Map(),
    downloads = [],
    opened = [];
  win.location = new URL('https://studio.example/authoring/asset-studio/?studio=sounds');
  win.history = {
    state: null,
    replaceState(value) {
      this.state = value;
    },
  };
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    if (node.tagName === 'A') {
      const click = node.click.bind(node);
      node.click = () => {
        if (node.download) downloads.push({ name: node.download, href: node.href });
        return click();
      };
    }
    if (node.tagName === 'AUDIO')
      Object.assign(node, {
        readyState: 1,
        paused: true,
        volume: 1,
        muted: false,
        play() {
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        load() {},
      });
    return node;
  };
  doc.createDocumentFragment = () => doc.createElement('fragment');
  const html = parse(
    await readFile(new URL('../../authoring/asset-studio/index.html', import.meta.url), 'utf8'),
  );
  const body = html.childNodes
    .find((n) => n.tagName === 'html')
    .childNodes.find((n) => n.tagName === 'body');
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
      if (['type', 'value', 'href', 'width', 'height'].includes(name)) node[name] = value;
      if (['disabled', 'hidden', 'inert', 'checked', 'selected'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
    if (node.tagName === 'OPTION' && !node.hasAttribute('value'))
      node.value = node.textContent.trim();
  }
  for (const child of body.childNodes) append(doc.body, child);
  const NativeURL = globalThis.URL,
    restore = [];
  function install(key, value) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restore.push(() =>
      prior ? Object.defineProperty(globalThis, key, prior) : delete globalThis[key],
    );
  }
  install('document', doc);
  install('window', win);
  install('location', win.location);
  install('matchMedia', win.matchMedia);
  install('indexedDB', {
    open(name, version) {
      opened.push(name);
      assert.equal(name, STUDIO_DATABASE);
      return memory.indexedDB.open(name, version);
    },
  });
  install('localStorage', {
    getItem: () => null,
    setItem: () => assert.fail('Transfer cannot write player preferences'),
  });
  install(
    'ImageData',
    class {
      constructor(data, width, height) {
        Object.assign(this, { data, width, height });
      }
    },
  );
  install('cancelAnimationFrame', () => {});
  install('fetch', async (url) =>
    String(url).endsWith('/compiled/studio.json')
      ? new Response(JSON.stringify(createDefaultThemeBundle()))
      : new Response(null, { status: 404 }),
  );
  install(
    'URL',
    class extends NativeURL {
      static createObjectURL(blob) {
        const url = `blob:studio-sound/${blobs.size + 1}`;
        blobs.set(url, blob);
        return url;
      }
      static revokeObjectURL() {}
    },
  );
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    win.emit('pagehide', { persisted: false });
    restore.reverse().forEach((fn) => fn());
  }
  t.after(dispose);
  const $ = (id) => doc.getElementById(id);
  const status = () => $('studio-status').querySelector('.operation-status-label').textContent;
  const idle = () =>
    waitFor(() => $('cancel-studio-operation').hidden, {
      message: 'Sound Studio operation did not settle',
    });
  await import(`../../authoring/asset-studio/studio.mjs?sound-transfer=${++serial}`);
  await idle();
  assert.match(status(), /release assets loaded/i);
  function select(slot) {
    const button = $('asset-list')
      .querySelectorAll('button')
      .find((candidate) => candidate.querySelector('small')?.textContent.startsWith(`${slot} ·`));
    assert.ok(button, `${slot} is in Sound Studio`);
    button.click();
    assert.equal($('slot-id').textContent, slot);
  }
  async function snapshot() {
    const store = createStudioStore({ indexedDB: memory.indexedDB });
    try {
      const { activeId } = await store.listWorkspaces();
      return await store.loadWorkspace(activeId);
    } finally {
      store.close();
    }
  }
  return { $, status, idle, select, snapshot, dispose, blobs, downloads, opened };
}

test('actual Sound Studio upload, Undo/Redo, save, export and fresh import retain the original WAV and binding', async (t) => {
  const h = await fixture(t),
    original = await readFile(new URL('../audio/effects/confirm.wav', import.meta.url));
  const file = new Blob([original], { type: 'audio/wav' });
  file.name = 'existing-project-confirm.wav';
  const hash = await hashPresentationBytes(original);
  h.select('audio.capture');
  const before = await h.snapshot();
  h.$('asset-upload').files = [file];
  h.$('asset-upload').onchange();
  await h.idle();
  assert.match(h.status(), /Replacement prepared/i);
  h.$('asset-creator').value = 'RevealLine';
  h.$('asset-source').value = 'game/audio/effects/confirm.wav';
  h.$('asset-license').value = 'Existing project-authored audio; transfer verification only';
  await h.$('stage-asset').onclick();
  assert.match(h.status(), /validated and staged/i);
  await h.$('undo-draft').onclick();
  await h.$('redo-draft').onclick();
  assert.deepEqual(
    (await h.snapshot()).document,
    before.document,
    'Staging and history navigation do not save',
  );
  await h.$('save-workspace').onclick();
  assert.match(h.status(), /saved atomically/i);
  const saved = await h.snapshot(),
    asset = resolvePresentation(saved.document).assets['audio.capture'];
  assert.equal(asset.file.sha256, hash);
  assert.equal(asset.quality.stage, 'produced', 'A transfer is not a production approval');
  assert.deepEqual(Buffer.from(await saved.assets.get(hash).arrayBuffer()), original);
  await h.$('reload-workspace').onclick();
  assert.deepEqual((await h.snapshot()).document, saved.document);
  await h.$('export-workspace').onclick();
  const download = h.downloads.at(-1),
    portable = h.blobs.get(download.href);
  assert.match(download.name, /\.rltheme$/);
  const verified = await importThemeBundle(portable);
  assert.deepEqual(verified.document, saved.document);
  assert.deepEqual(Buffer.from(await verified.assets.get(hash).arrayBuffer()), original);
  h.dispose();

  const fresh = await fixture(t);
  const freshBefore = await fresh.snapshot();
  fresh.$('import-workspace').files = [portable];
  fresh.$('import-workspace').onchange();
  await fresh.idle();
  assert.match(fresh.status(), /staged atomically/i);
  assert.deepEqual(
    (await fresh.snapshot()).document,
    freshBefore.document,
    'Import waits for explicit Save',
  );
  await fresh.$('save-workspace').onclick();
  await fresh.$('reload-workspace').onclick();
  const accepted = await fresh.snapshot();
  const recovered = resolvePresentation(accepted.document).assets['audio.capture'];
  assert.equal(recovered.file.sha256, hash);
  assert.deepEqual(recovered.provenance, asset.provenance);
  assert.deepEqual(Buffer.from(await accepted.assets.get(hash).arrayBuffer()), original);
  fresh.select('audio.capture');
  const corrupt = new Uint8Array(await portable.arrayBuffer());
  corrupt[corrupt.length - 1] ^= 1;
  fresh.$('import-workspace').files = [new Blob([corrupt])];
  fresh.$('import-workspace').onchange();
  await fresh.idle();
  assert.deepEqual(
    (await fresh.snapshot()).document,
    accepted.document,
    'Corrupt import cannot replace the saved choice',
  );
  await fresh.$('export-workspace').onclick();
  const retained = await importThemeBundle(fresh.blobs.get(fresh.downloads.at(-1).href));
  assert.deepEqual(
    retained.document,
    accepted.document,
    'Corrupt import cannot mutate the working choice either',
  );
  assert.deepEqual(new Set([...h.opened, ...fresh.opened]), new Set([STUDIO_DATABASE]));
});
