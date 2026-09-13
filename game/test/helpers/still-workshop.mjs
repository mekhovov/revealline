import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachStillMediaHost } from '../../ui/still-media-host.mjs';
import { createManagedMediaStore } from '../../managed-media-store.mjs';
import { createStillMediaStore } from '../../media-store.mjs';
import { Document, Events } from './couch-dom.mjs';
import { SoloElement } from './solo-dom.mjs';
import { memoryIndexedDB } from './soundtrack-fixtures.mjs';
import { mediaFixture, pngBytes } from './media-fixtures.mjs';

export const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
export async function workshop(t, options = {}) {
  const doc = new Document();
  doc.createElement = (tag) => {
    const element = new SoloElement(doc, tag);
    // Model native anchor property/attribute reflection; the shared lightweight
    // DOM does not provide HTMLAnchorElement's href/download properties.
    if (tag === 'a')
      for (const key of ['href', 'download'])
        Object.defineProperty(element, key, {
          get: () => element.getAttribute(key) ?? '',
          set: (value) => element.setAttribute(key, value),
        });
    return element;
  };
  const html = await readFile(
    new URL('../../../authoring/still-media/index.html', import.meta.url),
    'utf8',
  );
  for (const [, tag, id] of html.matchAll(/<(button|a|p)\b[^>]*id="([^"]+)"/g)) {
    const item = doc.createElement(tag);
    item.id = id;
    doc.body.append(item);
  }
  doc.getElementById('still-host-download-audio').hidden = true;
  const win = new Events(),
    frames = new Map(),
    rows = new Map(),
    held = new Set(),
    reads = [],
    locks = [];
  let frameId = 0,
    clears = 0,
    urlId = 0;
  win.location = { protocol: 'http:' };
  win.requestAnimationFrame = (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  const fixture = mediaFixture(true),
    memory = options.memory ?? memoryIndexedDB(),
    managers = [],
    urls = new Map(),
    revoked = [],
    paints = [];
  const source = {
    baseEntry: { campaign: fixture.campaign, themes: [{ id: 'fpv' }, { id: 'retro' }] },
    presets: {},
    ...(options.channel ? { channel: options.channel } : {}),
  };
  const read = (key) => {
    reads.push(key);
    return rows.has(key) ? rows.get(key) : null;
  };
  const host = attachStillMediaHost({
    document: doc,
    window: win,
    readBase: async () => source,
    readAsset: async (key) => read(key),
    storage: { getItem: read },
    lockManager: {
      async request(name, opts, work) {
        assert.equal(opts.ifAvailable, true);
        locks.push(name);
        if (held.has(name)) return work(null);
        held.add(name);
        try {
          return await work({});
        } finally {
          held.delete(name);
        }
      },
    },
    decodeImage,
    createManager(args) {
      const manager = createManagedMediaStore({ ...args, indexedDB: memory.indexedDB });
      managers.push(manager);
      return manager;
    },
    createPreview: ({ canvas }) => ({
      canvas,
      show: async (input) => {
        paints.push(input);
        return true;
      },
      clear() {
        ++clears;
      },
      dispose() {},
    }),
    URLImpl: {
      createObjectURL(blob) {
        const url = `blob:workshop-${++urlId}`;
        urls.set(url, blob);
        options.allocate?.();
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    ...options.host,
  });
  t.after(() => host.dispose());
  const $ = (id) => doc.getElementById(`still-media-${id}`),
    hostNode = (id) => doc.getElementById(`still-host-${id}`);
  return {
    doc,
    win,
    host,
    memory,
    managers,
    urls,
    revoked,
    paints,
    rows,
    reads,
    locks,
    held,
    source,
    fixture,
    $,
    hostNode,
    get clears() {
      return clears;
    },
    store() {
      return createStillMediaStore({ managedStore: managers[0], decodeImage });
    },
    frame(now) {
      const [id, fn] = frames.entries().next().value;
      frames.delete(id);
      fn(now);
    },
    async open() {
      assert.equal(await hostNode('open').onclick(), true);
    },
    choose(blob, mode = 'preserve') {
      $('bundle-file').files = [blob];
      $('bundle-file').onchange();
      $('bundle-mode').value = mode;
      $('bundle-mode').onchange();
    },
    async upload() {
      $('file').files = [new Blob([pngBytes()])];
      $('file').onchange();
      $('credit').value = 'Fixture';
      $('source').value = 'Owned test';
      $('description').value = 'Destination original';
      assert.equal(await $('preview').onclick(), true);
      assert.equal(await $('save').onclick(), true);
    },
  };
}
