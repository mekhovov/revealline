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

test('installed standalone PWAs report their display state without browser fullscreen', (t) => {
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

test('iOS Home Screen games report standalone display state', (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  doc.fullscreenEnabled = false;
  doc.defaultView = { navigator: { standalone: true } };

  const detach = attachFullscreen(button, doc);
  t.after(detach);

  assert.equal(button.hidden, true);
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');
});

test('display-mode changes update state and detach releases the listener', async () => {
  const button = new Button();
  const doc = fullscreenDocument();
  const displayMode = new Target();
  displayMode.matches = false;
  doc.fullscreenEnabled = false;
  doc.defaultView = { matchMedia: () => displayMode };
  const detach = attachFullscreen(button, doc);

  displayMode.matches = true;
  await displayMode.emit('change');
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');
  displayMode.matches = false;
  await displayMode.emit('change');
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);
  detach();
  assert.equal(displayMode.listeners.size, 0);
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

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('fullscreen retry clears a prior denial only after an accepted transition', async (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const request = doc.documentElement.requestFullscreen;
  doc.documentElement.requestFullscreen = async () => {
    throw new Error('Gesture denied');
  };
  t.after(attachFullscreen(button, doc));
  await button.emit('click');
  assert.match(button.title, /unavailable/);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  doc.documentElement.requestFullscreen = request;
  await button.emit('click');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.title, '', 'An accepted retry must retire the old denial.');
});

test('repeated activation while fullscreen is pending sends one browser request', async (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const gate = deferred();
  let requests = 0;
  doc.documentElement.requestFullscreen = () => {
    requests++;
    return gate.promise;
  };
  t.after(attachFullscreen(button, doc));
  const first = button.emit('click');
  const second = button.emit('click');
  assert.equal(requests, 1, 'Touch/controller repetition cannot queue competing transitions.');
  doc.fullscreenElement = doc.documentElement;
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  await button.emit('click');
  assert.equal(
    button.getAttribute('aria-pressed'),
    'false',
    'Next deliberate activation can exit.',
  );
});

for (const outcome of ['resolve', 'reject']) {
  test(`retired fullscreen owner ignores a late ${outcome} after replacement`, async () => {
    const button = new Button();
    const doc = fullscreenDocument();
    const gate = deferred();
    doc.documentElement.requestFullscreen = () => gate.promise;
    const detach = attachFullscreen(button, doc);
    const pending = button.emit('click');
    detach();
    button.title = 'Replacement owner';
    button.setAttribute('aria-label', 'Replacement control');
    if (outcome === 'reject') gate.reject(new Error('Late denial'));
    else gate.resolve();
    await pending;
    assert.equal(button.title, 'Replacement owner');
    assert.equal(button.getAttribute('aria-label'), 'Replacement control');
    assert.equal(button.listeners.size, 0);
    assert.equal(doc.listeners.size, 0);
  });
}
