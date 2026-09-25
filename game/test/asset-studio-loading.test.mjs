import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createStudioOperations } from '../../authoring/asset-studio/operation.mjs';
import { drawAssetPreview } from '../../authoring/asset-studio/preview.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { setLocale } from '../i18n/index.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const label = (target) => target.querySelector('.operation-status-label').textContent;
function operations() {
  const doc = new Document(),
    target = doc.createElement('p'),
    cancelButton = doc.createElement('button');
  doc.body.append(target, cancelButton);
  const locks = [];
  const owner = createStudioOperations({
    target,
    cancelButton,
    setBusy: (value) => locks.push(value),
  });
  return { owner, target, cancelButton, locks };
}

test('Studio announces before a delayed read; cancellation fences adoption and stale finally cannot unlock a retry', async () => {
  const { owner, target, cancelButton, locks } = operations();
  const older = deferred(),
    newer = deferred();
  let adopted = 'original';
  const first = owner.run('Reading replacement…', async (task) => {
    assert.equal(label(target), 'Reading replacement…');
    assert.equal(cancelButton.hidden, false);
    const value = await older.promise;
    task.check();
    adopted = value;
  });
  assert.equal(owner.busy, true);
  cancelButton.onclick();
  assert.equal(target.dataset.state, 'cancelled');
  const second = owner.run('Reading a newer replacement…', async (task) => {
    const value = await newer.promise;
    task.check();
    adopted = value;
    owner.message('New replacement prepared.');
  });
  older.resolve('stale');
  await first;
  assert.equal(adopted, 'original');
  assert.equal(owner.busy, true);
  assert.equal(cancelButton.hidden, false);
  assert.equal(label(target), 'Reading a newer replacement…');
  assert.deepEqual(locks, [true, false, true]);
  newer.resolve('new');
  await second;
  assert.equal(adopted, 'new');
  assert.equal(label(target), 'New replacement prepared.');
  assert.equal(owner.busy, false);
});

test('Stop waiting retains the non-abortable save lock and reconciles success or failure', async () => {
  for (const failed of [false, true]) {
    const { owner, target, cancelButton } = operations();
    const pending = deferred();
    let committed = false;
    const save = owner.run('Preparing local revision…', async (task) => {
      task.commit();
      await pending.promise;
      task.check();
      committed = true;
      owner.message('Local revision saved atomically.', 'success');
    });
    assert.equal(cancelButton.textContent, 'Stop waiting');
    cancelButton.onclick();
    assert.equal(target.dataset.state, 'detached');
    assert.match(label(target), /still running/);
    let retried = false;
    await owner.run('Conflicting change', () => {
      retried = true;
    });
    assert.equal(retried, false);
    assert.equal(owner.busy, true);
    if (failed) pending.reject(new Error('Studio storage quota exceeded.'));
    else pending.resolve();
    await save;
    assert.equal(committed, !failed);
    assert.equal(owner.busy, false);
    assert.equal(target.dataset.state, failed ? 'error' : 'ready');
    assert.match(label(target), failed ? /quota exceeded/ : /saved atomically/);
  }
});

test('delayed failure keeps its error; a cached retry completes without a minimum delay', async () => {
  const { owner, target } = operations();
  const pending = deferred();
  const failed = owner.run('Reading bundle…', async () => pending.promise);
  pending.reject(new Error('Invalid image bytes.'));
  await failed;
  assert.equal(target.dataset.state, 'error');
  assert.match(label(target), /Invalid image/);
  await owner.run('Reading cached bundle…', () => owner.message('Cached bundle ready.'));
  assert.equal(label(target), 'Cached bundle ready.');
  assert.equal(owner.busy, false);
});

test('Studio operation controls and owned outcomes switch locale in place', async (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const { owner, target, cancelButton } = operations(),
    pending = deferred(),
    running = owner.run('Preparing local revision…', async (task) => {
      task.commit();
      await pending.promise;
    });
  setLocale('uk', { persist: false });
  assert.equal(cancelButton.textContent, 'Припинити очікування');
  cancelButton.onclick();
  assert.match(label(target), /Локальне збереження ще триває/);
  pending.resolve();
  await running;
});

test('a cancelled real bundle import preserves the current document and exact original transfer bytes', async () => {
  const { owner } = operations();
  const document = createDefaultThemeBundle();
  const bundle = await exportThemeBundle(document);
  const before = Buffer.from(await bundle.arrayBuffer());
  let working = document;
  const importing = owner.run('Reading and validating imported bundle…', async (task) => {
    const incoming = await importThemeBundle(bundle, { signal: task.signal });
    task.check();
    working = incoming.document;
  });
  owner.cancel();
  await importing;
  assert.equal(working, document);
  assert.deepEqual(Buffer.from(await bundle.arrayBuffer()), before);
  const incoming = await importThemeBundle(bundle);
  assert.deepEqual(incoming.document, document);
});

class PreviewElement extends Element {
  constructor(doc, tag) {
    super(doc, tag);
    this.style.getPropertyValue = (key) => this.style[key] || '';
    this.style.removeProperty = (key) => delete this.style[key];
    this.draws = [];
  }
  getContext() {
    return { drawImage: (...args) => this.draws.push(args) };
  }
}
function previewBoundary(t) {
  const doc = new Document();
  doc.createElement = (tag) => new PreviewElement(doc, tag);
  const oldDocument = globalThis.document,
    oldDecoder = globalThis.createImageBitmap;
  globalThis.document = doc;
  t.after(() => {
    globalThis.document = oldDocument;
    globalThis.createImageBitmap = oldDecoder;
  });
  const surface = doc.createElement('div'),
    target = doc.createElement('p'),
    cancelButton = doc.createElement('button');
  doc.body.append(target, cancelButton, surface);
  const resolved = resolvePresentation(createDefaultThemeBundle());
  const slot = { id: 'sample', group: 'test', label: 'Exact sprite', sampling: 'nearest' };
  const asset = {
    kind: 'image',
    file: { sha256: 'fixture' },
    geometry: { frame: { x: 0, y: 0, width: 32, height: 32 } },
  };
  const bytes = new Map([['fixture', new Blob(['unchanged-original'])]]);
  const settings = {
    mode: 'native',
    background: 'checker',
    geometry: false,
    statusTarget: target,
    cancelButton,
    label: 'Draft preview',
  };
  const draw = () => drawAssetPreview(surface, slot, asset, resolved, bytes, settings);
  return { doc, surface, target, cancelButton, bytes, draw };
}

test('preview labels precede decode; superseded bitmaps close without replacing the newer canvas or status', async (t) => {
  const { doc, surface, target, cancelButton, bytes, draw } = previewBoundary(t);
  const older = deferred(),
    newer = deferred();
  let calls = 0,
    oldClosed = 0,
    newClosed = 0;
  globalThis.createImageBitmap = () => (++calls === 1 ? older.promise : newer.promise);
  const first = draw();
  assert.match(label(target), /decoding the asset image/);
  assert.equal(surface.getAttribute('aria-busy'), 'true');
  assert.equal(cancelButton.hidden, false);
  const second = draw();
  newer.resolve({
    close() {
      newClosed++;
    },
  });
  await second;
  const canvas = surface.children[0];
  assert.equal(canvas.tagName, 'CANVAS');
  assert.equal(canvas.style.width, '32px');
  older.resolve({
    close() {
      oldClosed++;
    },
  });
  await first;
  assert.equal(surface.children[0], canvas);
  assert.equal(label(target), 'Draft preview: ready.');
  assert.equal(target.hidden, false);
  assert.equal(newClosed, 1);
  assert.equal(oldClosed, 1);
  assert.equal(doc.activeElement, doc.body);
  assert.equal(await bytes.get('fixture').text(), 'unchanged-original');
});

test('Stop waiting and retry preserve preview ownership through late success and failure', async (t) => {
  const { surface, target, cancelButton, draw } = previewBoundary(t);
  const pending = deferred();
  let closed = 0;
  globalThis.createImageBitmap = () => pending.promise;
  const first = draw();
  cancelButton.onclick();
  assert.equal(target.dataset.state, 'detached');
  assert.equal(target.hidden, false);
  assert.equal(surface.getAttribute('aria-busy'), 'false');
  assert.equal(cancelButton.textContent, 'Retry preview');
  pending.resolve({
    close() {
      closed++;
    },
  });
  await first;
  assert.equal(surface.children.length, 0);
  assert.equal(closed, 1);
  assert.equal(target.dataset.state, 'detached');
  globalThis.createImageBitmap = async () => {
    throw new Error('Image decode failed.');
  };
  await cancelButton.onclick();
  assert.equal(target.dataset.state, 'error');
  assert.match(label(target), /Image decode failed/);
  assert.equal(cancelButton.textContent, 'Retry preview');
  globalThis.createImageBitmap = async () => ({ close() {} });
  await cancelButton.onclick();
  assert.equal(target.dataset.state, 'ready');
  assert.equal(surface.children[0].tagName, 'CANVAS');
});
