import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { mountRevealAuditThumbnails } from '../../authoring/design-atlas/reveal-audit-thumbnails.mjs';

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};
function fixture() {
  const doc = new Document(),
    win = doc.defaultView,
    requests = [],
    images = [];
  let observer,
    disconnected = 0;
  win.IntersectionObserver = class {
    constructor(callback) {
      observer = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {
      disconnected++;
    }
  };
  const entries = [1, 2, 3].map((id) => ({
    box: doc.createElement('div'),
    source: { id, width: 400, height: 200 },
    alt: `Exact original ${id}`,
  }));
  doc.body.append(...entries.map((entry) => entry.box));
  const gallery = mountRevealAuditThumbnails({
    document: doc,
    window: win,
    entries,
    rootURL: 'https://preview.test/',
    loadImage(source, { signal }) {
      return new Promise((resolve, reject) => {
        requests.push({
          source,
          signal,
          reject,
          resolve() {
            const image = {
              image: doc.createElement('img'),
              retired: 0,
              dispose() {
                this.retired++;
                this.image.removeAttribute('src');
              },
            };
            images.push(image);
            resolve(image);
          },
        });
      });
    },
  });
  return {
    doc,
    win,
    entries,
    gallery,
    requests,
    images,
    get disconnected() {
      return disconnected;
    },
    show(...indices) {
      observer(indices.map((index) => ({ target: entries[index].box, isIntersecting: true })));
    },
  };
}

test('Reveal thumbnails stay lazy, decode sequentially, and release every adopted image exactly once', async () => {
  const h = fixture();
  assert.equal(h.requests.length, 0);
  h.show(0, 1);
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve();
  await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.entries[0].box.children[0], h.images[0].image);
  assert.equal(h.images[0].image.alt, 'Exact original 1');
  h.requests[1].resolve();
  await flush();
  assert.equal(h.requests.length, 2, 'The offscreen third image must remain unloaded.');
  h.gallery.dispose();
  h.gallery.dispose();
  assert.deepEqual(
    h.images.map((image) => image.retired),
    [1, 1],
  );
  assert.equal(h.disconnected, 1);
});

test('Reveal thumbnails abort on hidden/BFCache departure, reject late adoption, and resume pending originals', async () => {
  const h = fixture();
  h.show(0, 1);
  h.win.emit('pagehide', { persisted: true });
  assert(h.requests[0].signal.aborted);
  h.requests[0].resolve();
  await flush();
  assert.equal(h.images[0].retired, 1);
  assert.equal(h.entries[0].box.children.length, 0);
  assert.equal(h.requests.length, 1);
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve();
  await flush();
  assert.equal(h.requests.length, 3);
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert(h.requests[2].signal.aborted);
  h.requests[2].resolve();
  await flush();
  h.win.emit('pagehide', { persisted: false });
  assert.deepEqual(
    h.images.map((image) => image.retired),
    [1, 1, 1],
  );
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.requests.length, 3, 'Final disposal must remove all resume listeners.');
});

test('Reveal replacement prevents old pending decodes from overwriting the new gallery', async () => {
  const h = fixture();
  h.show(0, 1);
  h.gallery.dispose();
  const replacement = h.doc.createElement('p');
  h.entries[0].box.replaceChildren(replacement);
  h.requests[0].resolve();
  await flush();
  assert.equal(h.images[0].retired, 1);
  assert.equal(h.entries[0].box.children[0], replacement);
  assert.equal(h.requests.length, 1);
});
