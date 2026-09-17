import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const html = readFileSync(new URL('../profile-recovery.html', import.meta.url), 'utf8');
const catalogs = readFileSync(new URL('../content/recovery-catalogs.json', import.meta.url));
let serial = 0;
function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}
const until = (predicate, message) => waitFor(predicate, { message });
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
};
function mount(doc) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/u)[1]
    .split('</body>')[0]
    .matchAll(/<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      stack.at(-1)._text = (stack.at(-1)._text || '') + token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (['type', 'value', 'src'].includes(name)) node[name] = value;
      if (['disabled', 'hidden'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
}

async function harness(t, { heldProfileRead = false } = {}) {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    timers = new Map(),
    requests = [],
    locations = [],
    pad = {
      index: 0,
      id: 'modeled standard controller',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
  Object.assign(win, doc.defaultView);
  doc.defaultView = win;
  mount(doc);
  let sequence = 0,
    time = 0,
    storeReads = 0;
  const databaseRead = { opened: 0, aborts: 0, closes: 0, pending: null };
  const database = {
    version: 1,
    objectStoreNames: { contains: (name) => name === 'assets' },
    close: () => databaseRead.closes++,
    transaction(name, mode) {
      assert.equal(name, 'assets');
      assert.equal(mode, 'readonly');
      const transaction = {
        abort: () => databaseRead.aborts++,
        objectStore: () => ({ getAllKeys: () => ({}) }),
      };
      databaseRead.pending = transaction;
      return transaction;
    },
  };
  const originalSet = globalThis.setTimeout,
    originalClear = globalThis.clearTimeout;
  const values = {
    document: doc,
    window: win,
    location: { origin: 'https://recovery.test', assign: (url) => locations.push(url) },
    navigator: {
      getGamepads: () => [pad],
      locks: { request: () => assert.fail('Startup cannot inspect stored profiles.') },
    },
    localStorage: {
      get length() {
        storeReads++;
        if (heldProfileRead) return 0;
        throw new Error('No explicit Find requested.');
      },
      getItem() {
        storeReads++;
        throw new Error('No explicit Find requested.');
      },
      setItem() {
        assert.fail('Recovery cannot save.');
      },
    },
    indexedDB: {
      open(name) {
        assert.equal(heldProfileRead, true, 'Profile discovery must be explicitly requested.');
        assert.equal(name, 'revealline-assets-v1');
        databaseRead.opened++;
        const request = { result: database };
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    },
    fetch: (url, options = {}) => {
      const gate = deferred();
      requests.push({ url: String(url), signal: options.signal, gate });
      return gate.promise;
    },
    requestAnimationFrame(fn) {
      const id = ++sequence;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    setTimeout(fn, ms, ...args) {
      if (ms !== 10000) return originalSet(fn, ms, ...args);
      const id = { deadline: ++sequence };
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      if (timers.has(id)) timers.delete(id);
      else originalClear(id);
    },
  };
  const saved = new Map();
  for (const [name, value] of Object.entries(values)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  t.after(async () => {
    win.emit('pagehide', { persisted: false });
    databaseRead.pending?.onabort?.();
    for (const request of requests)
      request.gate.resolve(new Response('unavailable', { status: 503 }));
    await settle();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const entry = html.match(/<script[^>]+src="(\.\/profile-recovery\.mjs)"/)[1];
  await import(
    new URL(`${entry}?navigation=${++serial}`, new URL('../profile-recovery.html', import.meta.url))
  );
  await until(() => requests.length === 1, 'The actual startup entered its held build-info read.');
  const tick = () => {
    assert.equal(frames.size, 1, 'One current navigation poll owner.');
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback((time += 20));
  };
  const neutral = () => {
    for (const button of pad.buttons) button.pressed = false;
    tick();
  };
  const press = (button) => {
    pad.buttons[button].pressed = true;
    tick();
  };
  const $ = (id) => doc.getElementById(`profile-recovery-${id}`);
  return {
    doc,
    win,
    frames,
    timers,
    requests,
    locations,
    pad,
    $,
    tick,
    neutral,
    press,
    storeReads: () => storeReads,
    databaseRead,
    async beginProfileRead() {
      assert.equal(heldProfileRead, true);
      const finding = $('find').onclick();
      await until(
        () => typeof databaseRead.pending?.onabort === 'function',
        'Explicit Find is waiting on a real reader readonly transaction.',
      );
      return { finding };
    },
    finishProfileAbort() {
      assert.ok(databaseRead.aborts > 0, 'The reader requested transaction cancellation.');
      databaseRead.pending.onabort();
    },
    join() {
      neutral();
      press(0);
      neutral();
    },
    async ready(index) {
      const start = requests[index];
      assert.match(start.url, /build-info\.json$/);
      start.gate.resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
      await until(() => requests.length > index + 1, 'This startup entered its held catalog read.');
      requests[index + 1].gate.resolve(new Response(catalogs));
      await until(() => !$('find').disabled, 'Explicit profile discovery became available.');
    },
  };
}

test('controller Back cancels held Recovery startup before any profile read or late adoption', async (t) => {
  const h = await harness(t);
  h.join();
  h.press(1);
  await until(() => h.locations.length === 1, 'Controller Back left the loading screen.');
  assert.deepEqual(h.locations, ['./index.html']);
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
  h.requests[0].gate.resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
  await settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.$('find').disabled, true);
  assert.equal(h.storeReads(), 0);
});

test('failed startup keeps controller Reload reachable and retains one router through readiness', async (t) => {
  const h = await harness(t);
  h.requests[0].gate.resolve(new Response('unavailable', { status: 503 }));
  await until(() => /built release/.test(h.$('status').textContent), 'Startup failure is visible.');
  h.join();
  h.press(13);
  assert.equal(h.doc.activeElement, h.$('reload'));
  h.neutral();
  h.press(0);
  await until(() => h.requests.length === 2, 'Controller Reload started one replacement read.');
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.frames.size, 1);
  assert.equal(h.win.listeners.get('gamepaddisconnected').size, 1);
  await h.ready(1);
  assert.equal(h.$('reload').hidden, true);
  assert.equal(h.doc.activeElement, h.$('find'));
  assert.equal(h.frames.size, 1);
  assert.equal(h.win.listeners.get('gamepaddisconnected').size, 1);
  assert.equal(h.doc.captureListeners.get('keydown').size, 1);
  h.neutral();
  h.press(1);
  await until(
    () => h.locations.length === 1,
    'The same assigned controller can leave after readiness.',
  );
  assert.equal(h.storeReads(), 0);
});

test('Reload during a held catalog retires its late completion without replacing the newer view', async (t) => {
  const h = await harness(t);
  h.requests[0].gate.resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
  await until(() => h.requests.length === 2, 'First catalog is held.');
  h.join();
  h.$('reload').focus();
  h.press(0);
  await until(
    () => h.requests.length === 3,
    'Explicit controller Reload begins another generation.',
  );
  assert.equal(h.requests[1].signal.aborted, true);
  await h.ready(2);
  const message = h.$('status').textContent,
    focus = h.doc.activeElement;
  h.requests[1].gate.resolve(new Response(catalogs));
  await settle();
  assert.equal(h.$('status').textContent, message);
  assert.equal(h.doc.activeElement, focus);
  assert.equal(h.$('find').disabled, false);
  assert.equal(h.requests.length, 4);
  assert.equal(h.frames.size, 1);
  assert.equal(h.storeReads(), 0);
});

test('timed-out startup keeps Reload active and late failed work cannot replace its successor', async (t) => {
  const h = await harness(t);
  assert.equal(h.timers.size, 1);
  [...h.timers.values()][0]();
  assert.match(h.$('status').textContent, /timed out.*Reload recovery/);
  assert.equal(h.requests[0].signal.aborted, true);
  h.join();
  h.$('reload').focus();
  h.press(0);
  await until(() => h.requests.length === 2, 'Reload retries after timeout.');
  await h.ready(1);
  h.requests[0].gate.resolve(new Response('late failure', { status: 500 }));
  await settle();
  assert.equal(h.$('find').disabled, false);
  assert.doesNotMatch(h.$('status').textContent, /timed out|built release/);
  assert.equal(h.storeReads(), 0);
});

test('startup completion preserves newer focus instead of moving it from Back', async (t) => {
  const h = await harness(t);
  h.$('reload').focus();
  h.$('back').focus();
  await h.ready(0);
  assert.equal(h.doc.activeElement, h.$('back'));
  assert.equal(h.$('reload').hidden, true);
});

test('background completion cannot autofocus now or on foreground return', async (t) => {
  const h = await harness(t);
  h.join();
  h.$('reload').focus();
  h.doc.focused = false;
  h.win.emit('blur');
  await h.ready(0);
  assert.notEqual(h.doc.activeElement, h.$('find'));
  h.doc.activeElement = h.doc.body;
  h.doc.focused = true;
  h.win.emit('focus');
  h.neutral();
  assert.equal(
    h.doc.activeElement,
    h.doc.body,
    'Foreground return is not a deferred focus request.',
  );
});

test('hidden input stays neutral and returning foreground requires a fresh controller command', async (t) => {
  const h = await harness(t);
  h.join();
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  h.press(1);
  assert.deepEqual(h.locations, []);
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  h.tick();
  assert.deepEqual(h.locations, [], 'A held background Back cannot trigger on return.');
  h.neutral();
  h.press(1);
  await until(() => h.locations.length === 1, 'A fresh Back command is accepted.');
});

test('cached return starts one read and one navigation loop while terminal departure cannot revive either', async (t) => {
  const h = await harness(t);
  h.join();
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(h.requests[0].signal.aborted, true);
  h.win.emit('pageshow', { persisted: true });
  await until(
    () => h.requests.length === 2,
    'Cached recovery return restarts its existing read lifecycle.',
  );
  assert.equal(h.frames.size, 1);
  assert.equal(h.win.listeners.get('gamepaddisconnected').size, 1);
  await h.ready(1);
  h.win.emit('pagehide', { persisted: false });
  h.win.emit('pageshow', { persisted: true });
  h.requests[0].gate.resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
  await settle();
  assert.equal(h.frames.size, 0);
  assert.equal(h.requests.length, 3);
  assert.equal(h.$('find').disabled, true);
  assert.equal(h.win.listeners.get('gamepaddisconnected').size, 0);
  assert.equal(h.doc.captureListeners.get('keydown').size, 0);
  assert.equal(h.storeReads(), 0);
});

test('ready Back waits for the actual reader transaction and overlapping Back closes it once', async (t) => {
  const h = await harness(t, { heldProfileRead: true });
  await h.ready(0);
  const { finding } = await h.beginProfileRead();
  const first = h.$('back').onclick(),
    second = h.$('back').onclick();
  await settle();
  assert.deepEqual(h.locations, [], 'Neither Back bypasses pending readonly transaction closure.');
  assert.equal(h.databaseRead.closes, 0);
  assert.equal(h.databaseRead.opened, 1);
  h.finishProfileAbort();
  await Promise.all([first, second, finding]);
  assert.deepEqual(h.locations, ['./index.html']);
  assert.equal(h.databaseRead.closes, 1, 'The single opened connection closes once.');
  assert.equal(h.frames.size, 0);
});

test('old ready Back cannot navigate or focus after persisted departure and return', async (t) => {
  const h = await harness(t, { heldProfileRead: true });
  await h.ready(0);
  const { finding } = await h.beginProfileRead();
  const leaving = h.$('back').onclick();
  await settle();
  assert.deepEqual(h.locations, []);
  assert.equal(h.databaseRead.closes, 0);
  h.win.emit('pagehide', { persisted: true });
  h.win.emit('pageshow', { persisted: true });
  h.$('back').focus();
  const currentFocus = h.doc.activeElement;
  h.finishProfileAbort();
  await Promise.all([leaving, finding]);
  await until(
    () => h.requests.length === 3,
    'The new visit begins its own startup after old read cleanup.',
  );
  assert.deepEqual(h.locations, [], 'The completed old Back cannot leave the new history visit.');
  assert.equal(h.doc.activeElement, currentFocus);
  assert.equal(h.databaseRead.closes, 1);
  assert.equal(h.frames.size, 1);
  await h.ready(2);
  assert.equal(h.doc.activeElement, currentFocus);
  assert.equal(h.$('find').disabled, false);
  await h.$('back').onclick();
  assert.deepEqual(h.locations, ['./index.html'], 'A fresh current Back still works.');
});

test('ready Back cleanup completed in the background cannot navigate or later autofocus', async (t) => {
  const h = await harness(t, { heldProfileRead: true });
  await h.ready(0);
  const { finding } = await h.beginProfileRead();
  const leaving = h.$('back').onclick();
  h.doc.focused = false;
  h.win.emit('blur');
  h.doc.activeElement = h.doc.body;
  h.finishProfileAbort();
  await Promise.all([leaving, finding]);
  assert.deepEqual(h.locations, []);
  assert.equal(h.doc.activeElement, h.doc.body);
  h.doc.focused = true;
  h.win.emit('focus');
  h.neutral();
  assert.deepEqual(h.locations, []);
  assert.equal(h.doc.activeElement, h.doc.body);
  await h.$('back').onclick();
  assert.deepEqual(h.locations, ['./index.html']);
  assert.equal(h.databaseRead.closes, 1);
});

test('terminal departure invalidates a ready Back still awaiting its reader', async (t) => {
  const h = await harness(t, { heldProfileRead: true });
  await h.ready(0);
  const { finding } = await h.beginProfileRead();
  const leaving = h.$('back').onclick();
  h.win.emit('pagehide', { persisted: false });
  h.finishProfileAbort();
  await Promise.all([leaving, finding]);
  assert.deepEqual(h.locations, []);
  assert.equal(h.frames.size, 0);
  assert.equal(h.databaseRead.closes, 1);
});

test('terminal departure also invalidates startup Back final navigation continuation', async (t) => {
  const h = await harness(t);
  const leaving = h.$('back').onclick();
  h.win.emit('pagehide', { persisted: false });
  await leaving;
  assert.deepEqual(h.locations, []);
  assert.equal(h.frames.size, 0);
  assert.equal(h.requests[0].signal.aborted, true);
});

for (const readyBeforeBack of [false, true]) {
  test(`completed ${readyBeforeBack ? 'ready' : 'startup'} Back supports a real persisted departure and fresh return`, async (t) => {
    const h = await harness(t);
    h.join();
    if (readyBeforeBack) await h.ready(0);
    const previousRequests = h.requests.length;
    h.press(1);
    await until(
      () => h.locations.length === 1,
      'Explicit Back completed navigation before departure.',
    );
    assert.deepEqual(h.locations, ['./index.html']);
    assert.equal(h.frames.size, 0);
    assert.equal(h.requests[0].signal.aborted, true);
    h.win.emit('pagehide', { persisted: true });
    h.win.emit('pageshow', { persisted: true });
    assert.equal(
      h.frames.size,
      1,
      'A cached completed departure retains one reusable navigation owner.',
    );
    await until(
      () => h.requests.length === previousRequests + 1,
      'Return begins a fresh startup read.',
    );
    assert.equal(h.win.listeners.get('gamepaddisconnected').size, 1);
    assert.equal(h.doc.captureListeners.get('keydown').size, 1);
    h.tick();
    assert.equal(h.locations.length, 1, 'A Back held through the cached visit is not fresh input.');
    if (!readyBeforeBack) {
      h.requests[0].gate.resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
      await settle();
      assert.equal(
        h.requests.length,
        previousRequests + 1,
        'Late departed startup cannot begin a catalog read.',
      );
    }
    await h.ready(previousRequests);
    assert.equal(h.$('find').disabled, false);
    assert.equal(h.$('reload').hidden, true);
    assert.equal(h.frames.size, 1);
    h.tick();
    assert.equal(h.locations.length, 1, 'Ready adoption does not replay the still-held Back.');
    h.neutral();
    h.press(1);
    await until(
      () => h.locations.length === 2,
      'The same controller can leave again with a fresh Back.',
    );
    assert.deepEqual(h.locations, ['./index.html', './index.html']);
    assert.equal(h.frames.size, 0);
    assert.equal(h.storeReads(), 0, 'History return never discovers profiles automatically.');
  });
}

test('completed Back followed by terminal departure cannot revive on stale persisted pageshow or late startup', async (t) => {
  const h = await harness(t);
  h.join();
  h.press(1);
  await until(() => h.locations.length === 1, 'Back completed before terminal departure.');
  h.win.emit('pagehide', { persisted: false });
  h.win.emit('pageshow', { persisted: true });
  h.requests[0].gate.resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
  await settle();
  assert.deepEqual(h.locations, ['./index.html']);
  assert.equal(h.requests.length, 1);
  assert.equal(h.frames.size, 0);
  assert.equal(h.win.listeners.get('gamepaddisconnected').size, 0);
  assert.equal(h.doc.captureListeners.get('keydown').size, 0);
  assert.equal(h.$('find').disabled, true);
  assert.equal(h.storeReads(), 0);
});
