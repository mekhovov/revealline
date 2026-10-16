import test from 'node:test';
import assert from 'node:assert/strict';
import { attachDemoFullscreen } from '../ui/demo-fullscreen.mjs';

class Target {
  listeners = new Map();
  attributes = new Map();
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  async emit(type) {
    await Promise.all([...(this.listeners.get(type) ?? [])].map((fn) => fn({ type })));
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name);
  }
}
function fixture() {
  const doc = new Target(),
    dialog = new Target(),
    button = new Target();
  dialog.open = true;
  doc.fullscreenEnabled = true;
  doc.fullscreenElement = null;
  let requests = 0,
    exits = 0;
  doc.documentElement = {
    async requestFullscreen(options) {
      requests++;
      assert.deepEqual(options, { navigationUI: 'hide' });
      doc.fullscreenElement = doc.documentElement;
      await doc.emit('fullscreenchange');
    },
  };
  doc.exitFullscreen = async () => {
    exits++;
    doc.fullscreenElement = null;
    await doc.emit('fullscreenchange');
  };
  return {
    doc,
    dialog,
    button,
    get requests() {
      return requests;
    },
    get exits() {
      return exits;
    },
    attach() {
      return attachDemoFullscreen({ document: doc, dialog, button });
    },
  };
}

test('demo fullscreen is explicit, targets the document and follows enter/exit state', async () => {
  const f = fixture(),
    control = f.attach();
  assert.equal(f.requests, 0, 'Opening a demo never requests browser fullscreen.');
  assert.equal(f.button.hidden, false);
  assert.equal(f.button.getAttribute('aria-pressed'), 'false');
  await f.button.emit('click');
  assert.equal(f.requests, 1);
  assert.equal(f.doc.fullscreenElement, f.doc.documentElement);
  assert.equal(f.button.getAttribute('aria-pressed'), 'true');
  assert.match(f.button.getAttribute('aria-label'), /Exit|exitFullscreen/);
  await f.button.emit('click');
  assert.equal(f.exits, 1);
  assert.equal(f.doc.fullscreenElement, null);
  assert.equal(f.button.getAttribute('aria-pressed'), 'false');
  await control.dispose();
});

test('unsupported and rejected fullscreen retain the open viewport demo and a retryable control', async () => {
  const unsupported = fixture();
  unsupported.doc.fullscreenEnabled = false;
  const unsupportedControl = unsupported.attach();
  assert.equal(unsupported.button.hidden, true);
  await unsupported.button.emit('click');
  assert.equal(unsupported.requests, 0);
  assert.equal(unsupported.dialog.open, true);
  await unsupportedControl.dispose();

  const denied = fixture();
  const request = denied.doc.documentElement.requestFullscreen;
  denied.doc.documentElement.requestFullscreen = async () => {
    throw new Error('Denied');
  };
  const control = denied.attach();
  await denied.button.emit('click');
  assert.equal(denied.dialog.open, true);
  assert.equal(denied.button.hidden, false);
  assert.equal(denied.button.disabled, false);
  assert.match(denied.button.title, /unavailable|fullscreenUnavailable/);
  denied.doc.documentElement.requestFullscreen = request;
  await denied.button.emit('click');
  assert.equal(denied.button.getAttribute('aria-pressed'), 'true');
  await control.dispose();
  assert.equal(denied.exits, 1);
});

test('demo closure releases only the fullscreen session it owns', async () => {
  for (const existing of ['document', 'external']) {
    const f = fixture();
    const original = existing === 'document' ? f.doc.documentElement : {};
    f.doc.fullscreenElement = original;
    const control = f.attach();
    assert.equal(f.button.hidden, true);
    await f.button.emit('click');
    await control.release();
    await control.dispose();
    assert.equal(f.requests, 0);
    assert.equal(f.exits, 0);
    assert.equal(f.doc.fullscreenElement, original);
  }
  const f = fixture(),
    control = f.attach();
  await f.button.emit('click');
  f.dialog.open = false;
  await f.dialog.emit('close');
  assert.equal(f.exits, 1);
  await control.dispose();
  await control.dispose();
  assert.equal(f.exits, 1);
  assert.equal(
    [...f.doc.listeners.values()].reduce((total, set) => total + set.size, 0),
    0,
  );
});

test('pending entry is deduplicated and cleaned up if the demo closes or is disposed before completion', async () => {
  for (const dispose of [false, true]) {
    const f = fixture();
    let resolveRequest,
      calls = 0;
    f.doc.documentElement.requestFullscreen = async () => {
      calls++;
      await new Promise((resolve) => {
        resolveRequest = resolve;
      });
      f.doc.fullscreenElement = f.doc.documentElement;
      await f.doc.emit('fullscreenchange');
    };
    const control = f.attach();
    const first = f.button.emit('click');
    await f.button.emit('click');
    assert.equal(calls, 1);
    assert.equal(f.button.disabled, true);
    f.dialog.open = false;
    if (dispose) await control.dispose();
    else await control.release();
    resolveRequest();
    await first;
    assert.equal(f.exits, 1);
    assert.equal(f.doc.fullscreenElement, null);
    await control.dispose();
  }
});

test('browser Escape or a replaced fullscreen owner is never mistaken for demo ownership', async () => {
  const f = fixture(),
    control = f.attach();
  await f.button.emit('click');
  f.doc.fullscreenElement = null;
  await f.doc.emit('fullscreenchange');
  assert.equal(f.button.getAttribute('aria-pressed'), 'false');
  f.doc.fullscreenElement = {};
  await f.doc.emit('fullscreenchange');
  await control.release();
  await control.dispose();
  assert.equal(f.exits, 0);
});

test('rejected exit keeps the truthful Exit control and permits an explicit retry', async () => {
  const f = fixture(),
    control = f.attach();
  await f.button.emit('click');
  const exit = f.doc.exitFullscreen;
  f.doc.exitFullscreen = async () => {
    throw new Error('Denied exit');
  };
  await f.button.emit('click');
  assert.equal(f.button.hidden, false);
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.getAttribute('aria-pressed'), 'true');
  f.doc.exitFullscreen = exit;
  await f.button.emit('click');
  assert.equal(f.exits, 1);
  await control.dispose();
});
