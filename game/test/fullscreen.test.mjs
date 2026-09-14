import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFullscreen } from '../ui/fullscreen.mjs';

class Target {
  listeners = new Map();
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type) {
    this.listeners.delete(type);
  }
  async emit(type) {
    return this.listeners.get(type)?.();
  }
}

class Button extends Target {
  hidden = true;
  attributes = new Map();
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function fullscreenDocument() {
  const doc = new Target();
  const root = {
    dataset: {},
    async requestFullscreen(options) {
      doc.requestOptions = options;
      doc.fullscreenElement = root;
      await doc.emit('fullscreenchange');
    },
  };
  Object.assign(doc, {
    fullscreenEnabled: true,
    fullscreenElement: null,
    documentElement: root,
    async exitFullscreen() {
      doc.fullscreenElement = null;
      await doc.emit('fullscreenchange');
    },
  });
  return doc;
}

test('fullscreen control follows the browser state and exits through the same explicit control', async (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const detach = attachFullscreen(button, doc);
  t.after(detach);

  assert.equal(button.hidden, false);
  assert.equal(button.getAttribute('aria-label'), 'Enter fullscreen');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);

  await button.emit('click');
  assert.equal(doc.fullscreenElement, doc.documentElement);
  assert.deepEqual(doc.requestOptions, { navigationUI: 'hide' });
  assert.equal(button.getAttribute('aria-label'), 'Exit fullscreen');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');

  await button.emit('click');
  assert.equal(doc.fullscreenElement, null);
  assert.equal(button.getAttribute('aria-label'), 'Enter fullscreen');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);
});

test('installed standalone PWAs use the immersive arena layout without browser fullscreen', (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const displayMode = new Target();
  displayMode.matches = true;
  doc.fullscreenEnabled = false;
  doc.defaultView = { matchMedia: () => displayMode };

  const detach = attachFullscreen(button, doc);
  t.after(detach);

  assert.equal(button.hidden, true);
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test('iOS Home Screen games use the immersive arena layout', (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  doc.fullscreenEnabled = false;
  doc.defaultView = { navigator: { standalone: true } };

  const detach = attachFullscreen(button, doc);
  t.after(detach);

  assert.equal(button.hidden, true);
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');
});

test('unsupported browsers retain their responsive game layout without an inoperable control', () => {
  const button = new Button();
  const doc = new Target();
  doc.fullscreenEnabled = false;
  doc.documentElement = { dataset: {} };

  const detach = attachFullscreen(button, doc);
  assert.equal(button.hidden, true);
  assert.equal(button.listeners.size, 0);
  detach();
});
