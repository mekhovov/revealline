import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseControllerPreviewSnapshot,
  CONTROLLER_PREVIEW_STATUS_FORMAT,
} from '../ui/controller-preview.mjs';

class Element {
  constructor(id = '') {
    this.id = id;
    this.listeners = new Map();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.clientWidth = 900;
    this.classList = { toggle() {} };
  }
  addEventListener(type, fn) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type, fn) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((v) => v !== fn),
    );
  }
  async emit(type, data = {}) {
    for (const fn of this.listeners.get(type) ?? []) await fn(data);
  }
  append(node) {
    this.children.push(node);
    if (!this.value) this.value = node.value;
  }
  replaceChildren() {
    this.children = [];
    this.value = '';
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  getAttribute(key) {
    return key === 'src' ? this.src : this.attributes[key];
  }
  focus() {
    this.focused = true;
  }
}

test('practice page keeps virtual holds, releases and import failures isolated from player storage', async (t) => {
  const originals = new Map(),
    ids = [
      'game-frame',
      'load-status',
      'connect',
      'disconnect',
      'release',
      'focus-game',
      'connection-status',
      'gesture',
      'mission',
      'craft',
      'steering',
      'viewport',
      'frame-space',
      'viewport-readout',
      'load',
      'scope',
      'focused',
      'pad-status',
    ],
    elements = Object.fromEntries(ids.map((id) => [id, new Element(id)])),
    pads = [12, 14, 13, 15, 0, 1, 2, 3, 5, 9].map((index) => {
      const button = new Element();
      button.dataset.pad = String(index);
      return button;
    }),
    doc = new Element(),
    host = new Element(),
    posts = [],
    storage = new Map(),
    writes = [],
    timeouts = new Map(),
    intervals = new Map();
  let timer = 0,
    storageFailure = false;
  host.location = { origin: 'http://localhost:8767' };
  const child = {
    focus() {},
    postMessage(data, origin) {
      posts.push({ data, origin });
    },
  };
  elements['game-frame'].contentWindow = child;
  elements.gesture.value = 'pulse';
  elements.steering.value = 'immediate';
  elements.viewport.value = '1280x720';
  doc.getElementById = (id) => elements[id];
  doc.querySelectorAll = () => pads;
  doc.createElement = () => new Element();
  doc.hidden = false;
  const globals = {
    window: host,
    document: doc,
    sessionStorage: {
      setItem(key, value) {
        if (storageFailure) throw new Error('Storage unavailable');
        writes.push(key);
        storage.set(key, value);
      },
    },
    fetch: async (path) => ({
      ok: true,
      json: async () =>
        JSON.parse(
          await readFile(new URL(path, new URL('../controller-lab/', import.meta.url)), 'utf8'),
        ),
    }),
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    setTimeout: (fn, ms) => {
      const id = ++timer;
      timeouts.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: (fn, ms) => {
      const id = ++timer;
      intervals.set(id, { fn, ms });
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const click = (id) => elements[id].emit('click', { detail: 0 });
  const press = (index) =>
    pads
      .find((button) => button.dataset.pad === String(index))
      .emit('pointerdown', { button: 0, preventDefault() {} });
  const latest = () => posts.at(-1).data;
  try {
    await import(`../controller-lab/lab.mjs?test=${Date.now()}`);
    await t.test(
      'boot prepares actual practice and exposes every authored map without profile writes',
      () => {
        assert.equal(elements.mission.children.length, 16);
        assert.equal(elements.craft.children.length, 7);
        assert.match(elements['game-frame'].src, /practice=1&controller-preview=1/);
        assert.deepEqual(writes, ['revealline.playground.current']);
        const scenario = JSON.parse(storage.get(writes[0]));
        assert.equal(scenario.level.id, 'signal-01');
        assert.equal(scenario.settings.turnPolicy, 'immediate');
      },
    );
    await elements['game-frame'].emit('load');
    await t.test(
      'connect focuses the iframe and sends neutral before any deliberate button',
      async () => {
        await click('connect');
        assert.equal(elements['game-frame'].focused, true);
        assert.equal(latest().pad.connected, true);
        assert.ok(latest().pad.buttons.every((v) => !v));
        assert.equal(elements.connect.disabled, true);
        assert.equal(intervals.values().next().value.ms, 150);
      },
    );
    await t.test(
      'pulse uses one press and releases after200ms, ignoring the following pointer click',
      async () => {
        await press(0);
        const count = posts.length;
        await pads.find((p) => p.dataset.pad === '0').emit('click', { detail: 1 });
        assert.equal(posts.length, count);
        assert.equal(latest().pad.buttons[0], true);
        const release = [...timeouts].find(([, item]) => item.ms === 200);
        assert.ok(release);
        timeouts.delete(release[0]);
        release[1].fn();
        assert.equal(latest().pad.buttons[0], false);
      },
    );
    await t.test(
      'hold mode combines movement+boost; release all clears both without disconnecting',
      async () => {
        elements.gesture.value = 'hold';
        await elements.gesture.emit('change');
        await press(15);
        await press(5);
        assert.equal(latest().pad.buttons[15], true);
        assert.equal(latest().pad.buttons[5], true);
        assert.equal(pads.find((p) => p.dataset.pad === '5').getAttribute('aria-pressed'), 'true');
        await click('release');
        assert.equal(latest().pad.connected, true);
        assert.ok(latest().pad.buttons.every((v) => !v));
        assert.equal(timeouts.size, 0);
      },
    );
    await t.test(
      'only exact bounded status from the current same-origin iframe reaches labels',
      async () => {
        const data = {
          format: CONTROLLER_PREVIEW_STATUS_FORMAT,
          sequence: 1,
          scope: 'settings',
          focusedId: 'theme',
          focusedLabel: '<img onerror=bad>',
          assigned: true,
          message: 'Ready',
        };
        await host.emit('message', { source: {}, origin: host.location.origin, data });
        assert.equal(elements.focused.textContent, '—');
        await host.emit('message', { source: child, origin: 'https://wrong.test', data });
        assert.equal(elements.focused.textContent, '—');
        await host.emit('message', { source: child, origin: host.location.origin, data });
        assert.equal(elements.focused.textContent, '<img onerror=bad>');
        await host.emit('message', {
          source: child,
          origin: host.location.origin,
          data: { ...data, sequence: 0, focusedLabel: 'stale' },
        });
        await host.emit('message', {
          source: child,
          origin: host.location.origin,
          data: { ...data, sequence: 2, gameState: {} },
        });
        assert.equal(elements.focused.textContent, '<img onerror=bad>');
      },
    );
    await t.test('storage failure preserves the old frame and validated handoff', async () => {
      const oldSrc = elements['game-frame'].src,
        oldData = storage.get('revealline.playground.current');
      storageFailure = true;
      await click('load');
      assert.equal(elements['game-frame'].src, oldSrc);
      assert.equal(storage.get('revealline.playground.current'), oldData);
      assert.match(
        elements['load-status'].textContent,
        /Practice was not replaced: Storage unavailable/,
      );
      assert.equal(elements.load.disabled, false);
      storageFailure = false;
    });
    await t.test(
      'visibility loss disconnects while iframe-focus parent blur does not',
      async () => {
        await press(15);
        await host.emit('blur');
        assert.equal(latest().pad.buttons[15], true);
        doc.hidden = true;
        await doc.emit('visibilitychange');
        assert.equal(latest().pad.connected, false);
        assert.ok(latest().pad.buttons.every((v) => !v));
      },
    );
    await t.test(
      'history-cache return remains usable but never resumes a previous hold',
      async () => {
        doc.hidden = false;
        await click('connect');
        await press(15);
        await host.emit('pagehide', { persisted: true });
        assert.equal(latest().pad.connected, false);
        assert.equal(intervals.size, 1);
        await host.emit('pageshow', { persisted: true });
        await click('connect');
        assert.equal(latest().pad.connected, true);
        assert.ok(latest().pad.buttons.every((v) => !v));
        assert.equal(elements.load.disabled, false);
      },
    );
    await t.test('every emitted snapshot validates and pagehide disposes timers', async () => {
      assert.ok(
        posts.every(
          ({ data, origin }) =>
            parseControllerPreviewSnapshot(data) && origin === host.location.origin,
        ),
      );
      assert.ok(
        posts.every(
          ({ data }, index) => index === 0 || data.sequence > posts[index - 1].data.sequence,
        ),
      );
      await host.emit('pagehide');
      assert.equal(intervals.size, 0);
      assert.equal(timeouts.size, 0);
      assert.deepEqual(new Set(writes), new Set(['revealline.playground.current']));
    });
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
