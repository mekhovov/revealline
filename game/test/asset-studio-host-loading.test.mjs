import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createStudioStore, STUDIO_DATABASE } from '../presentation/studio-store.mjs';
import { iconForSlot } from '../presentation/icons.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
async function until(predicate) {
  for (let count = 0; count < 100; count++) {
    if (predicate()) return;
    await flush();
  }
  assert.fail('Studio operation did not reach the expected state.');
}
function mount(doc, html) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) continue;
    const tag = token.match(/^<([\w-]+)/)[1];
    const element = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name.startsWith('data-'))
        element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) element[name] = true;
    }
    stack.at(-1).append(element);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(element);
  }
}

test('actual Studio handlers show startup/read/encode stages, cancel a late upload, and save exact source bytes in Studio storage only', async (t) => {
  const pixels = iconForSlot('icon.play');
  const bytes = encodeSpritePNG(pixels);
  const doc = new Document(),
    window = new Events();
  const readGate = deferred(),
    decodeGate = deferred(),
    startupGate = deferred();
  let encodeGate = deferred();
  let delayRead = false,
    delayDecode = false,
    delayEncode = false,
    cancelledReads = 0,
    lateClosed = 0;
  const opened = [];
  const db = memoryIndexedDB();
  const indexedDB = {
    open(name, version) {
      opened.push(name);
      const inner = db.indexedDB.open(name, version),
        request = {};
      inner.onupgradeneeded = (event) => {
        request.result = inner.result;
        request.transaction = inner.transaction;
        request.onupgradeneeded?.(event);
      };
      inner.onsuccess = () => {
        request.result = inner.result;
        startupGate.promise.then(() => request.onsuccess?.());
      };
      inner.onerror = () => {
        request.error = inner.error;
        request.onerror?.();
      };
      return request;
    },
  };
  class StudioElement extends Element {
    constructor(document, tag) {
      super(document, tag);
      this.style.getPropertyValue = (name) => this.style[name] || '';
      this.style.removeProperty = (name) => delete this.style[name];
    }
    getContext() {
      return new Proxy(
        {
          getImageData: () => ({
            width: this.width,
            height: this.height,
            data: new Uint8ClampedArray(pixels.rgba),
          }),
        },
        {
          get(target, name) {
            return target[name] ?? (() => {});
          },
        },
      );
    }
    toBlob(callback) {
      if (delayEncode)
        encodeGate.promise.then(() => callback(new Blob([bytes], { type: 'image/png' })));
      else callback(new Blob([bytes], { type: 'image/png' }));
    }
    toDataURL() {
      return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    }
  }
  doc.createElement = (tag) => new StudioElement(doc, tag);
  doc.createDocumentFragment = () => new StudioElement(doc, 'fragment');
  class Reader {
    readAsDataURL(blob) {
      this.pending = (async () => {
        const read = Buffer.from(await blob.arrayBuffer());
        if (delayRead) await readGate.promise;
        if (this.aborted) return;
        this.result = `data:image/png;base64,${read.toString('base64')}`;
        this.onload();
      })();
    }
    abort() {
      this.aborted = true;
      cancelledReads++;
    }
  }
  const globals = {
    document: doc,
    window,
    indexedDB,
    FileReader: Reader,
    ImageData: class {
      constructor(data, width, height) {
        Object.assign(this, { data, width, height });
      }
    },
    matchMedia: () => ({ matches: false }),
    fetch: async () => new Response('', { status: 404 }),
    createImageBitmap: async () => {
      if (delayDecode) {
        await decodeGate.promise;
        return {
          width: 24,
          height: 24,
          close() {
            lateClosed++;
          },
        };
      }
      return { width: 24, height: 24, close() {} };
    },
    cancelAnimationFrame() {},
  };
  const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  t.after(() => {
    window.emit('pagehide', { persisted: false });
    Object.assign(globalThis, previous);
  });
  mount(
    doc,
    await readFile(new URL('../../authoring/asset-studio/index.html', import.meta.url), 'utf8'),
  );
  const $ = (id) => doc.getElementById(id);
  const message = () => $('studio-status').querySelector('.operation-status-label').textContent;
  for (const id of [
    'save-workspace',
    'export-workspace',
    'import-workspace',
    'reload-workspace',
    'load-release',
  ])
    assert.equal($(id).disabled, true, `${id} is disabled before the Studio module owns it`);
  assert.equal($('studio-status').querySelector('.operation-status-signal').children.length, 3);
  await import(`../../authoring/asset-studio/studio.mjs?loading-host=${Date.now()}`);
  assert.match(message(), /Loading saved Studio/);
  assert.equal($('cancel-studio-operation').hidden, false);
  assert.equal($('cancel-studio-operation').closest('[inert]'), null);
  assert.equal($('current-preview-cancel').closest('[inert]'), null);
  for (const id of [
    'save-workspace',
    'export-workspace',
    'import-workspace',
    'reload-workspace',
    'load-release',
  ])
    assert.equal($(id).hasAttribute('data-studio-startup-disabled'), false);
  startupGate.resolve();
  await until(() => $('cancel-studio-operation').hidden);
  assert.match(message(), /Source registry loaded/);
  const summary = $('workspace-summary').textContent;
  const original = new File([bytes], 'original.png', { type: 'image/png' });
  $('asset-upload').files = [original];
  delayRead = true;
  $('asset-upload').onchange();
  assert.match(message(), /Reading the image header/);
  $('cancel-studio-operation').onclick();
  readGate.resolve();
  await flush();
  assert.equal(cancelledReads, 1);
  assert.equal($('workspace-summary').textContent, summary);
  assert.equal($('stage-asset').disabled, true);
  delayRead = false;
  delayDecode = true;
  $('asset-upload').onchange();
  await until(() => /Decoding the original/.test(message()));
  $('cancel-studio-operation').onclick();
  delayDecode = false;
  delayEncode = true;
  $('asset-upload').onchange();
  await until(() => /Encoding the crop/.test(message()));
  assert.equal(
    $('stage-asset').disabled,
    true,
    'No partial prepared asset is published during encode.',
  );
  decodeGate.resolve();
  await flush();
  assert.equal(lateClosed, 1);
  assert.match(message(), /Encoding the crop/);
  assert.equal(
    $('replacement-panel').inert,
    true,
    'Old finally cannot release the newer upload lock.',
  );
  encodeGate.resolve();
  await until(() => $('cancel-studio-operation').hidden);
  assert.match(message(), /Replacement prepared/);
  assert.equal($('stage-asset').disabled, false);
  assert.equal($('workspace-summary').textContent, summary);
  $('asset-creator').value = 'Fixture author';
  $('asset-source').value = 'Owned original fixture';
  $('asset-license').value = 'Fixture rights';
  await $('stage-asset').onclick();
  assert.match(message(), /validated and staged/);
  assert.match($('workspace-summary').textContent, /unsaved changes/);
  await $('save-workspace').onclick();
  assert.match(message(), /saved atomically/);
  const saved = await createStudioStore({ indexedDB: db.indexedDB }).load();
  const hash = await hashPresentationBytes(bytes);
  assert.deepEqual(Buffer.from(await saved.assets.get(hash).arrayBuffer()), Buffer.from(bytes));
  assert.equal(saved.generation, 1);
  assert.ok(saved.document.assets.some((asset) => asset.id.endsWith('.source')));
  assert.deepEqual(new Set(opened), new Set([STUDIO_DATABASE]));
  $('new-sprite').onclick();
  $('sprite-canvas').emit('keydown', { code: 'Space' });
  encodeGate = deferred();
  const preparingSprite = $('use-sprite').onclick();
  assert.match(message(), /Encoding the edited sprite/);
  $('cancel-studio-operation').onclick();
  encodeGate.resolve();
  await preparingSprite;
  await $('save-workspace').onclick();
  assert.match(
    message(),
    /Prepare the edited sprite/,
    'Cancelled sprite encoding preserves the edited pixels and baseline.',
  );
  assert.equal($('sprite-workbench').hidden, false);
});
