import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionalInstallationKey,
  recordOptionalInstallation,
  removeOptionalInstallation,
  validateOptionalInstallationReference,
} from '../../optional-practice/install-context.mjs';
import { preparePracticeOffline } from '../../optional-practice/civilian-flight/offline.mjs';
import { installOptionalLauncher } from '../../optional-practice/launcher-template.mjs';
import { runInNewContext } from 'node:vm';
import { waitFor } from './helpers/wait-for.mjs';

const packageId = 'civilian-flight';
const root = '/revealline/practice/civilian-flight/';
const locationFor = (version, base = root) => ({
  href: `https://example.test${base}releases/${version}/site/optional-practice/civilian-flight/index.html`,
});
function memory() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
test('optional installations preserve previous versions and isolate stable roots without touching Journey', () => {
  const storage = memory();
  storage.setItem('journey-coupa', 'untouched');
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.2') });
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
  const state = JSON.parse(storage.getItem(optionalInstallationKey(packageId, root)));
  assert.equal(state.active.version, 'v1.2.3');
  assert.equal(state.previous.version, 'v1.2.2');
  const otherRoot = '/other/practice/civilian-flight/';
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.3.0', otherRoot) });
  assert.notEqual(
    optionalInstallationKey(packageId, root),
    optionalInstallationKey(packageId, otherRoot),
  );
  removeOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
  assert.equal(
    JSON.parse(storage.getItem(optionalInstallationKey(packageId, root))).active.version,
    'v1.2.2',
  );
  assert.equal(
    JSON.parse(storage.getItem(optionalInstallationKey(packageId, otherRoot))).active.version,
    'v1.3.0',
  );
  assert.equal(storage.getItem('journey-coupa'), 'untouched');
  assert.equal(
    recordOptionalInstallation({
      packageId,
      storage,
      location: { href: 'http://localhost:8768/optional-practice/civilian-flight/' },
    }),
    false,
  );
});

test('optional launch references reject foreign origins, roots, entries and versions', () => {
  const context = { packageId, root, baseURL: 'https://example.test' + root + 'app/' };
  const original = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  assert.match(
    validateOptionalInstallationReference(original, context).scope,
    /^https:\/\/example.test/,
  );
  for (const change of [
    { id: 'other' },
    { entry: 'game/index.html' },
    { version: '../private' },
    { scope: 'https://evil.example/site/' },
    { scope: '/other/practice/civilian-flight/releases/v1.2.3/site/' },
    { scope: '../releases/v1.2.3/site/?edition=other' },
  ])
    assert.throws(() => validateOptionalInstallationReference({ ...original, ...change }, context));
});

test('an installation pointer is recorded only after a verified worker activates', async () => {
  const storage = memory(),
    callbacks = new Set();
  const worker = {
    state: 'installing',
    scriptURL: new URL('worker.js', locationFor('v1.2.3').href).href,
    postMessage(data, ports) {
      if (data.type === 'practice-status')
        ports[0].postMessage({ type: 'practice-status', ready: true, scope: registration.scope });
    },
    addEventListener: (_, callback) => callbacks.add(callback),
    removeEventListener: (_, callback) => callbacks.delete(callback),
  };
  const registration = {
    installing: worker,
    scope: new URL('./', locationFor('v1.2.3').href).href,
  };
  const navigator = {
    serviceWorker: {
      register: async () => registration,
      getRegistration: async () => registration,
    },
  };
  const pending = preparePracticeOffline({
    storage,
    location: locationFor('v1.2.3'),
    navigator,
  });
  await waitFor(() => callbacks.size > 0);
  assert.equal(storage.values.size, 0);
  worker.state = 'activated';
  registration.active = worker;
  for (const callback of [...callbacks]) callback();
  await pending;
  assert.equal(
    JSON.parse(storage.getItem(optionalInstallationKey(packageId, root))).active.version,
    'v1.2.3',
  );
  assert.equal(callbacks.size, 0);
  const failedStorage = memory();
  worker.state = 'installing';
  registration.active = null;
  const failed = preparePracticeOffline({
    storage: failedStorage,
    location: locationFor('v1.2.3'),
    navigator,
  });
  await waitFor(() => callbacks.size > 0);
  worker.state = 'redundant';
  for (const callback of [...callbacks]) callback();
  await assert.rejects(failed, /verification failed/);
  assert.equal(failedStorage.values.size, 0);
  assert.equal(callbacks.size, 0);
});

function launcher(fetcher) {
  const elements = Object.fromEntries(
    ['locale', 'title', 'check', 'open', 'prepare', 'previous', 'status'].map((id) => [
      id,
      { hidden: true, textContent: '', disabled: false },
    ]),
  );
  const events = new Map(),
    timers = new Map();
  const context = {
    document: { documentElement: {}, getElementById: (id) => elements[id] },
    navigator: { language: 'en' },
    localStorage: memory(),
    location: { href: 'https://example.test' + root + 'app/' },
    fetch: fetcher,
    AbortController,
    TextDecoder,
    Uint8Array,
    URL,
    optionalInstallationKey,
    validateOptionalInstallationReference,
    setTimeout(callback) {
      timers.set(callback, callback);
      return callback;
    },
    clearTimeout(callback) {
      timers.delete(callback);
    },
    addEventListener(name, callback) {
      events.set(name, callback);
    },
  };
  const ready = runInNewContext(
    `(${installOptionalLauncher.toString()})(${JSON.stringify({ packageId, root })}, { optionalInstallationKey, validateOptionalInstallationReference })`,
    context,
  );
  return { elements, events, timers, ready };
}

test('stable launcher reads only a bounded explicit pointer and cancels abandoned checks', async () => {
  const requests = [];
  const current = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  const first = launcher(async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify(current));
  });
  assert.equal(requests.length, 0);
  await first.ready;
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(
    first.elements.prepare.href,
    'https://example.test' + root + 'releases/v1.2.3/site/' + current.entry + '?lang=en',
  );
  assert.equal(first.elements.prepare.hidden, false);
  assert.equal(first.timers.size, 0);
  const oversized = launcher(async () => new Response(' '.repeat(4097)));
  await oversized.ready;
  assert.equal(oversized.elements.prepare.hidden, true);
  assert.equal(oversized.elements.check.disabled, false);
  assert.match(oversized.elements.status.textContent, /unavailable/);
  let finish, signal;
  const abandoned = launcher((_url, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const pending = abandoned.ready;
  await waitFor(() => !!signal);
  abandoned.events.get('pagehide')();
  assert.equal(signal.aborted, true);
  finish(new Response(JSON.stringify(current)));
  await pending;
  assert.equal(abandoned.elements.prepare.hidden, true);
  assert.equal(abandoned.timers.size, 0);
});
