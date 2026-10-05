import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import {
  inspectOptionalOffline,
  optionalInstallationKey,
  prepareOptionalOffline,
  recordOptionalInstallation,
  removeOptionalOffline,
} from '../../optional-practice/install-context.mjs';
import { removePracticeOffline as removeFlight } from '../../optional-practice/civilian-flight/offline.mjs';
import { removePracticeOffline as removeFPV } from '../../optional-practice/civilian-fpv/offline.mjs';
import { installPracticeWorker as installFlight } from '../../optional-practice/civilian-flight/worker-template.mjs';
import { installPracticeWorker as installFPV } from '../../optional-practice/worker-template.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { Document } from './helpers/couch-dom.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function fixture(packageId = 'civilian-flight') {
  const root = `/review/practice/${packageId}/`;
  const location = {
    href: `https://example.test${root}releases/v1.2.3/site/optional-practice/${packageId}/index.html`,
  };
  const base = new URL('./', location.href);
  const values = new Map(),
    messages = [],
    ports = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const worker = new EventTarget();
  worker.state = 'installing';
  worker.scriptURL = new URL('worker.js', base).href;
  worker.postMessage = (data, transferred = []) => {
    messages.push(data.type);
    if (data.type === 'practice-status') ports.push(transferred[0]);
  };
  let registered = false,
    unregisters = 0,
    registrations = 0;
  const registration = {
    scope: base.href,
    installing: worker,
    active: null,
    unregister: async () => {
      unregisters++;
      registered = false;
    },
  };
  const navigator = {
    serviceWorker: {
      getRegistration: async () => (registered ? registration : undefined),
      register: async () => {
        registered = true;
        registrations++;
        return registration;
      },
    },
  };
  const activate = () => {
    worker.state = 'activated';
    registration.installing = null;
    registration.active = worker;
    registered = true;
    worker.dispatchEvent(new Event('statechange'));
  };
  const reply = (ready = true) =>
    ports.shift().postMessage({ type: 'practice-status', ready, scope: base.href });
  return {
    packageId,
    root,
    location,
    base,
    storage,
    values,
    navigator,
    worker,
    registration,
    messages,
    ports,
    activate,
    reply,
    unregisters: () => unregisters,
    registrations: () => registrations,
    options: { packageId, location, storage, navigator, document: null },
  };
}

test('status cancellation owns lookup and reply lifetime without cancelling a playing worker', async () => {
  const f = fixture(),
    lookup = deferred(),
    abort = new AbortController();
  f.activate();
  const pending = inspectOptionalOffline(f.base, {
    navigator: { serviceWorker: { getRegistration: () => lookup.promise } },
    signal: abort.signal,
  });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  abort.abort();
  await rejected;
  lookup.resolve(f.registration);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.messages, [], 'A late lookup never opens a port or cancels the flight');
});

test('cancelling initial verification never records a late successful installation', async () => {
  const f = fixture(),
    abort = new AbortController();
  f.activate();
  const pending = prepareOptionalOffline({ ...f.options, signal: abort.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => f.ports.length === 1);
  abort.abort();
  f.reply();
  await rejected;
  assert.equal(f.values.size, 0);
  assert.equal(f.registrations(), 0);
  assert(
    !f.messages.includes('practice-cancel'),
    'Read-only verification must not stop active play',
  );
});

test('cancelling final verification rejects after activation without publishing a receipt', async () => {
  const f = fixture(),
    abort = new AbortController();
  const pending = prepareOptionalOffline({ ...f.options, signal: abort.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => f.messages.includes('practice-progress'));
  f.activate();
  await waitFor(() => f.ports.length === 1);
  abort.abort();
  f.reply();
  await rejected;
  assert.equal(f.values.size, 0);
});

test('pagehide cancels its package operation and a fresh owner can reinstall', async () => {
  const f = fixture(),
    win = new EventTarget();
  f.activate();
  const pending = prepareOptionalOffline({ ...f.options, document: { defaultView: win } });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => f.ports.length === 1);
  win.dispatchEvent(new Event('pagehide'));
  f.reply();
  await rejected;
  const retry = prepareOptionalOffline(f.options);
  await waitFor(() => f.ports.length === 1);
  f.reply();
  assert.equal(await retry, true);
  assert.equal(
    JSON.parse(f.storage.getItem(optionalInstallationKey(f.packageId, f.root))).active.version,
    'v1.2.3',
  );
});

test('default progress belongs to the invoking native modal and Cancel restores its focus', async () => {
  const f = fixture(),
    doc = new Document(),
    dialog = doc.createElement('dialog'),
    prepare = doc.createElement('button');
  doc.body.append(dialog);
  dialog.append(prepare);
  dialog.showModal();
  prepare.focus();
  f.activate();
  const pending = prepareOptionalOffline({ ...f.options, document: doc });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => f.ports.length === 1);
  const panel = dialog.querySelector('[data-optional-offline-progress]');
  assert(panel, 'Cancel must share the active modal top layer, not the inert body');
  assert.equal(panel.parentNode, dialog);
  assert.match(panel.querySelector('[role="status"]').textContent, /Checking offline files/);
  assert.equal(doc.activeElement, panel.querySelector('button'));
  panel.querySelector('button').click();
  f.reply();
  await rejected;
  assert.equal(doc.querySelector('[data-optional-offline-progress]'), null);
  assert.equal(doc.activeElement, prepare);
  assert.equal(f.values.size, 0);
  assert(!f.messages.includes('practice-cancel'), 'Read-only status does not stop active play');
});

test('closing a moved settings owner cancels its download without reclaiming focus', async () => {
  const f = fixture(),
    doc = new Document(),
    previous = doc.createElement('button'),
    settings = doc.createElement('section'),
    dialog = doc.createElement('dialog');
  doc.body.append(previous, settings, dialog);
  previous.focus();
  // The shell moves settings after construction; ownership is resolved at Prepare.
  dialog.append(settings);
  dialog.showModal();
  f.activate();
  const pending = prepareOptionalOffline({
    ...f.options,
    document: doc,
    progressParent: settings,
  });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => f.ports.length === 1);
  assert.equal(settings.querySelector('[data-optional-offline-progress]').parentNode, settings);
  dialog.close();
  f.reply();
  await rejected;
  assert.equal(doc.activeElement, previous);
  assert.equal(dialog.listeners.get('close')?.size, 0);
  assert.equal(f.values.size, 0);
});

test('successful preparation removes progress without stealing focus from another control', async () => {
  const f = fixture(),
    doc = new Document(),
    other = doc.createElement('button');
  doc.body.append(other);
  f.activate();
  const pending = prepareOptionalOffline({ ...f.options, document: doc });
  await waitFor(() => f.ports.length === 1);
  other.focus();
  f.reply();
  assert.equal(await pending, true);
  assert.equal(doc.activeElement, other);
  assert.equal(doc.querySelector('[data-optional-offline-progress]'), null);
});

test('custom progress keeps caller-owned UI, focus and dialog lifetime unchanged', async () => {
  const f = fixture(),
    doc = new Document(),
    dialog = doc.createElement('dialog');
  doc.body.append(dialog);
  dialog.showModal();
  f.activate();
  const pending = prepareOptionalOffline({
    ...f.options,
    document: doc,
    progressParent: dialog,
    onProgress() {},
  });
  await waitFor(() => f.ports.length === 1);
  assert.equal(doc.querySelector('[data-optional-offline-progress]'), null);
  assert.equal(doc.activeElement, dialog);
  dialog.close();
  f.reply();
  assert.equal(await pending, true, 'A custom caller owns cancellation through its signal');
});

test('a closed explicit progress owner cannot start a hidden download', async () => {
  const f = fixture(),
    doc = new Document(),
    dialog = doc.createElement('dialog');
  doc.body.append(dialog);
  await assert.rejects(
    prepareOptionalOffline({ ...f.options, document: doc, progressParent: dialog }),
    { name: 'AbortError' },
  );
  assert.equal(f.registrations(), 0);
  assert.equal(doc.querySelector('[data-optional-offline-progress]'), null);
});

test('late registration is cancelled and cannot recreate an installation receipt', async () => {
  const f = fixture(),
    registration = deferred(),
    abort = new AbortController();
  let registering = false;
  f.navigator.serviceWorker.register = () => {
    registering = true;
    return registration.promise;
  };
  const pending = prepareOptionalOffline({ ...f.options, signal: abort.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => registering);
  abort.abort();
  await rejected;
  registration.resolve(f.registration);
  await waitFor(() => f.messages.includes('practice-cancel'));
  assert.equal(f.values.size, 0);
});

test('removal retains registration ownership after caller cancellation until even a late activated worker is removed', async () => {
  const f = fixture(),
    registration = deferred(),
    abort = new AbortController(),
    deleted = [];
  let registering = false,
    held = 0,
    removed = false;
  f.navigator.locks = {
    request: async (_name, _options, operation) => {
      held++;
      try {
        return await operation();
      } finally {
        held--;
      }
    },
  };
  f.navigator.serviceWorker.register = () => {
    registering = true;
    return registration.promise;
  };
  const pending = prepareOptionalOffline({ ...f.options, signal: abort.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => registering);
  abort.abort();
  await rejected;
  assert.equal(held, 1, 'Cancellation retires the caller, not the outstanding browser operation');
  const own = `revealline.optional.civilian-flight.v1:${f.base.pathname}:late`;
  const removal = removeOptionalOffline({
    ...f.options,
    caches: {
      keys: async () => [own],
      delete: async (name) => deleted.push(name),
    },
  }).then(() => {
    removed = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(removed, false);
  assert.equal(f.unregisters(), 0);
  assert.deepEqual(deleted, []);
  // Browser activation can have completed before register() finally resolves.
  f.activate();
  registration.resolve(f.registration);
  await removal;
  await waitFor(() => held === 0);
  assert.equal(held, 0);
  assert.equal(f.unregisters(), 1);
  assert.deepEqual(deleted, [own]);
  assert(
    !JSON.parse(f.storage.getItem(optionalInstallationKey(f.packageId, f.root)) ?? '{}').active,
  );
});

test('a stuck registration bounds removal waiting and a timed-out removal never runs later', async (t) => {
  const f = fixture(),
    registration = deferred(),
    abort = new AbortController(),
    deleted = [];
  let registering = false;
  f.navigator.serviceWorker.register = () => {
    registering = true;
    return registration.promise;
  };
  t.after(() => registration.resolve(f.registration));
  const pending = prepareOptionalOffline({ ...f.options, signal: abort.signal });
  const cancelled = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => registering);
  abort.abort();
  await cancelled;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const options = {
    ...f.options,
    caches: {
      keys: async () => [`revealline.optional.civilian-flight.v1:${f.base.pathname}:current`],
      delete: async (name) => deleted.push(name),
    },
  };
  const remove = removeOptionalOffline(options);
  const rejected = assert.rejects(remove, /Another offline operation is still stopping/);
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(30001);
  await rejected;
  f.activate();
  registration.resolve(f.registration);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.unregisters(), 0);
  assert.deepEqual(deleted, [], 'A timed-out request cannot remove a later usable installation');
  await removeOptionalOffline(options);
  assert.equal(f.unregisters(), 1);
  assert.equal(deleted.length, 1);
});

test('offload waits for worker write settlement and both game wrappers use scoped removal', async () => {
  for (const [packageId, remove] of [
    ['civilian-flight', removeFlight],
    ['civilian-fpv', removeFPV],
  ]) {
    const f = fixture(packageId),
      deleted = [];
    f.navigator.serviceWorker.getRegistration = async () => f.registration;
    recordOptionalInstallation(f.options);
    const family = packageId === 'civilian-flight' ? packageId : 'package';
    const own = `revealline.optional.${family}.v1:${f.base.pathname}:current`;
    const removed = remove({
      ...f.options,
      caches: {
        keys: async () => [own, 'game-core', own.replace('/review/', '/other/')],
        delete: async (name) => deleted.push(name),
      },
    });
    await waitFor(() => f.messages.filter((name) => name === 'practice-cancel').length === 2);
    assert.equal(f.unregisters(), 0);
    assert.deepEqual(deleted, [], 'Do not delete while an installing worker can still write');
    f.worker.state = 'redundant';
    f.worker.dispatchEvent(new Event('statechange'));
    await removed;
    assert.equal(f.unregisters(), 1);
    assert.deepEqual(deleted, [own]);
    assert.deepEqual(JSON.parse(f.storage.getItem(optionalInstallationKey(packageId, f.root))), {});
  }
});

test('offload cancels an old verification before its pointer and exact cache are removed', async () => {
  const f = fixture(),
    deleted = [],
    locks = [];
  f.activate();
  f.navigator.locks = {
    request: async (name, options, task) => {
      locks.push({ name, options });
      return task();
    },
  };
  recordOptionalInstallation(f.options);
  const pending = prepareOptionalOffline(f.options);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => f.ports.length === 1);
  const own = `revealline.optional.civilian-flight.v1:${f.base.pathname}:current`;
  const remove = removeOptionalOffline({
    ...f.options,
    caches: {
      keys: async () => [own],
      delete: async (name) => deleted.push(name),
    },
  });
  f.reply();
  await rejected;
  await remove;
  assert.deepEqual(deleted, [own]);
  assert.deepEqual(JSON.parse(f.storage.getItem(optionalInstallationKey(f.packageId, f.root))), {});
  assert.equal(locks.length, 2);
  assert.equal(locks[0].name, locks[1].name);
  assert.equal(locks[0].options.mode, 'exclusive');
});

test('missing dependencies require repair, then exact offload and a fresh install restore the same receipt', async () => {
  const f = fixture();
  f.activate();
  recordOptionalInstallation(f.options);
  const original = f.storage.getItem(optionalInstallationKey(f.packageId, f.root));
  const broken = prepareOptionalOffline(f.options);
  const rejected = assert.rejects(broken, /Needs repair/);
  await waitFor(() => f.ports.length === 1);
  f.reply(false);
  await waitFor(() => f.ports.length === 1);
  f.reply(false);
  await rejected;
  assert.equal(f.storage.getItem(optionalInstallationKey(f.packageId, f.root)), original);
  await removeOptionalOffline({ ...f.options, caches: { keys: async () => [] } });
  f.registration.active = null;
  f.registration.installing = f.worker;
  f.worker.state = 'installing';
  f.messages.length = 0;
  const retry = prepareOptionalOffline(f.options);
  await waitFor(() => f.messages.includes('practice-progress'));
  f.activate();
  await waitFor(() => f.ports.length === 1);
  f.reply();
  assert.equal(await retry, true);
  assert.equal(f.storage.getItem(optionalInstallationKey(f.packageId, f.root)), original);
});

function workerFixture(install, family, { initialRead, finalWrite, empty = false } = {}) {
  const base = 'https://example.test/review/optional-practice/civilian-flight/';
  const owner = `revealline.optional.${family}.v1:${new URL(base).pathname}:`;
  const name = owner + 'revision';
  const body = Buffer.from('pinned asset');
  const pins = empty
    ? []
    : [
        {
          path: 'image.png',
          bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex'),
        },
      ];
  const listeners = new Map(),
    stores = new Map(),
    progress = [];
  let writes = 0,
    fetches = 0,
    opens = 0;
  const scope = {
    registration: { scope: base },
    crypto: webcrypto,
    addEventListener: (event, fn) => listeners.set(event, fn),
    caches: {
      keys: async () => {
        await initialRead?.promise;
        return [...stores.keys()];
      },
      delete: async (id) => stores.delete(id),
      match: async (url, { cacheName }) => stores.get(cacheName)?.get(url)?.clone(),
      open: async (id) => {
        opens++;
        if (!stores.has(id)) stores.set(id, new Map());
        const cache = stores.get(id);
        return {
          match: async (url) => cache.get(url)?.clone(),
          put: async (url, response) => {
            writes++;
            await finalWrite?.promise;
            cache.set(url, response);
          },
        };
      },
    },
    fetch: async () => {
      fetches++;
      return new Response(body);
    },
  };
  install(scope, pins, 'revision');
  const message = (data, ports = []) => listeners.get('message')({ data, ports });
  message({ type: 'practice-progress' }, [{ postMessage: (value) => progress.push(value.phase) }]);
  const start = () => {
    let pending;
    listeners.get('install')({
      waitUntil: (value) => {
        pending = value;
      },
    });
    return pending;
  };
  return {
    base,
    name,
    stores,
    progress,
    message,
    start,
    listeners,
    caches: scope.caches,
    writes: () => writes,
    fetches: () => fetches,
    opens: () => opens,
  };
}

for (const [family, install] of [
  ['civilian-flight', installFlight],
  ['package', installFPV],
]) {
  test(`${family} worker keeps cancellation received before its controller exists`, async () => {
    const initialRead = deferred(),
      f = workerFixture(install, family, { initialRead });
    const pending = f.start();
    const rejected = assert.rejects(pending, /cancelled/);
    f.message({ type: 'practice-cancel' });
    initialRead.resolve();
    await rejected;
    assert.equal(f.fetches(), 0);
    assert.equal(f.writes(), 0);
    assert(!f.stores.has(f.name));
    assert(!f.progress.includes('ready'));
  });
  test(`${family} worker waits for final writes then rejects cancellation, without announcing ready`, async () => {
    const finalWrite = deferred(),
      f = workerFixture(install, family, { finalWrite });
    const pending = f.start();
    const rejected = assert.rejects(pending, /cancelled/);
    await waitFor(() => f.writes() === 1);
    f.message({ type: 'practice-cancel' });
    finalWrite.resolve();
    await rejected;
    assert(!f.stores.has(f.name));
    assert(!f.progress.includes('ready'));
  });
  test(`${family} old controlling worker does not recreate an offloaded cache on a later asset read`, async () => {
    const f = workerFixture(install, family);
    await f.start();
    const opens = f.opens();
    f.stores.delete(f.name);
    let response;
    f.listeners.get('fetch')({
      request: new Request(f.base + 'image.png'),
      respondWith: (value) => {
        response = value;
      },
    });
    assert.equal(await (await response).text(), 'pinned asset');
    assert.equal(f.opens(), opens);
    assert(!f.stores.has(f.name));
  });
  test(`${family} read-only status does not recreate a cache removed after its names were read`, async () => {
    const f = workerFixture(install, family);
    await f.start();
    const opens = f.opens();
    f.caches.keys = async () => {
      const names = [...f.stores.keys()];
      f.stores.delete(f.name);
      return names;
    };
    let pending, status;
    f.listeners.get('message')({
      data: { type: 'practice-status' },
      ports: [
        {
          postMessage: (value) => {
            status = value;
          },
        },
      ],
      waitUntil: (value) => {
        pending = value;
      },
    });
    await pending;
    assert.equal(status.ready, false);
    assert.equal(f.opens(), opens, 'Status verification never creates a Cache object');
    assert(!f.stores.has(f.name));
  });
  test(`${family} status cannot certify an empty dependency set or a missing package`, async () => {
    for (const empty of [true, false]) {
      const f = workerFixture(install, family, { empty });
      if (empty) f.stores.set(f.name, new Map());
      let pending, status;
      f.listeners.get('message')({
        data: { type: 'practice-status' },
        ports: [
          {
            postMessage: (value) => {
              status = value;
            },
          },
        ],
        waitUntil: (value) => {
          pending = value;
        },
      });
      await pending;
      assert.equal(status.ready, false);
      assert.equal(f.opens(), 0);
    }
  });
}
