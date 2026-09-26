import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareEditionOffline,
  verifyEditionOffline,
  selectPreparedEdition,
} from '../editions/offline-client.mjs';
import { validateCompanyInstallationReference } from '../edition-context.mjs';

const root = 'https://game.test/revealline/editions/coupa-adventure/';
const scopeFor = (version = '1.0.0') => `${root}releases/v${version}/site/`;
const ready = (version = '1.0.0') => ({
  status: 'ready',
  editionId: 'coupa-adventure',
  version,
  buildId: 'ab'.repeat(32),
  count: 12,
  bytes: 100,
});
const turn = () => new Promise((resolve) => setImmediate(resolve));
const locks = { request: async (_key, _options, callback) => callback({}) };
function fixture({
  version = '1.0.0',
  response = ready(version),
  state = 'activated',
  installing = false,
} = {}) {
  const events = new Set(),
    messages = [],
    statuses = [],
    values = new Map();
  const worker = {
    state,
    addEventListener: (_type, fn) => events.add(fn),
    removeEventListener: (_type, fn) => events.delete(fn),
    postMessage(message, [port]) {
      messages.push(message.type);
      if (response) port.postMessage(response);
    },
  };
  const scope = scopeFor(version),
    registration = {
      scope,
      active: installing ? null : worker,
      waiting: null,
      installing: installing ? worker : null,
    };
  return {
    events,
    messages,
    statuses,
    values,
    worker,
    registration,
    state(value) {
      worker.state = value;
      for (const fn of [...events]) fn();
    },
    options: {
      scope,
      editionId: 'coupa-adventure',
      version,
      serviceWorker: {
        register: async () => registration,
        getRegistration: async () => registration,
      },
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
      onStatus: (value) => statuses.push(value.status),
      locks,
      timeoutMs: 100,
    },
  };
}

test('offline receipts bind the exact edition, release, build and bounded inventory', async () => {
  const f = fixture();
  assert.deepEqual(await verifyEditionOffline(f.options), ready());
  for (const change of [
    { editionId: 'droneaid' },
    { version: '2.0.0' },
    { buildId: 'bad' },
    { count: 2001 },
    { bytes: 64 * 1024 * 1024 + 1 },
    { version: 'DEV' },
  ]) {
    const h = fixture({ response: { ...ready(), ...change } });
    await assert.rejects(verifyEditionOffline(h.options));
  }
  await assert.rejects(
    verifyEditionOffline({ ...f.options, buildId: 'cd'.repeat(32) }),
    /different edition or build/,
  );
  f.registration.scope = root;
  await assert.rejects(verifyEditionOffline(f.options), /not been prepared/);
});

test('preparation waits, repairs an existing active worker, and releases all listeners on abort or failure', async () => {
  const f = fixture({ installing: true, state: 'installing' });
  const preparing = prepareEditionOffline(f.options);
  await turn();
  assert.equal(f.events.size, 1);
  f.registration.waiting = f.worker;
  f.state('installed');
  assert.equal((await preparing).status, 'waiting');
  assert.deepEqual(f.statuses, ['downloading', 'waiting']);
  assert.deepEqual(f.messages, ['repair-company-edition']);
  assert.equal(f.events.size, 0);
  for (const mode of ['abort', 'timeout', 'redundant']) {
    const h = fixture({ installing: true, state: 'installing' }),
      controller = new AbortController();
    const pending = prepareEditionOffline({
      ...h.options,
      signal: controller.signal,
      timeoutMs: 10,
    });
    const rejected = assert.rejects(
      pending,
      mode === 'abort' ? { name: 'AbortError' } : /timed out|download failed/,
    );
    await turn();
    if (mode === 'abort') controller.abort();
    if (mode === 'redundant') h.state('redundant');
    await rejected;
    assert.equal(h.events.size, 0);
    assert.deepEqual(h.messages, []);
    assert.deepEqual(h.statuses, ['downloading']);
  }
  assert.equal((await prepareEditionOffline(fixture().options)).status, 'ready');
});

test('verification interruption, timeout and synchronous post failures settle without dangling ports', async () => {
  for (const mode of ['abort', 'timeout', 'throw']) {
    const f = fixture({ response: null }),
      controller = new AbortController();
    if (mode === 'throw')
      f.worker.postMessage = () => {
        throw new Error('detached worker');
      };
    const pending = verifyEditionOffline({
      ...f.options,
      signal: controller.signal,
      timeoutMs: 10,
    });
    const rejected = assert.rejects(
      pending,
      mode === 'abort' ? { name: 'AbortError' } : /timed out|detached worker/,
    );
    await turn();
    if (mode === 'abort') controller.abort();
    await rejected;
  }
});

test('verified update and rollback preserve the previous edition and never touch progress or other audiences', async () => {
  const f = fixture(),
    key = 'revealline.company-installed.coupa-adventure.v1';
  f.values.set('journey-coupa-adventure', 'original progress');
  f.values.set('revealline.company-installed.droneaid.v1', 'other edition');
  const v1 = await selectPreparedEdition(f.options);
  const next = fixture({ version: '1.1.0' });
  const options = { ...next.options, storage: f.options.storage };
  const v2 = await selectPreparedEdition(options);
  assert.deepEqual(JSON.parse(f.values.get(key)), { active: v2, previous: v1 });
  await selectPreparedEdition(options);
  assert.deepEqual(JSON.parse(f.values.get(key)).previous, v1);
  await selectPreparedEdition(f.options);
  assert.deepEqual(JSON.parse(f.values.get(key)), { active: v1, previous: v2 });
  assert.equal(f.values.get('journey-coupa-adventure'), 'original progress');
  assert.equal(f.values.get('revealline.company-installed.droneaid.v1'), 'other edition');
  const before = f.values.get(key);
  await assert.rejects(
    selectPreparedEdition({
      ...options,
      locks: { request: async (_key, _options, callback) => callback(null) },
    }),
    /Another tab/,
  );
  await assert.rejects(
    selectPreparedEdition({
      ...options,
      storage: {
        getItem: f.options.storage.getItem,
        setItem() {
          throw new Error('quota exhausted');
        },
      },
    }),
    /quota/,
  );
  const wrong = fixture({ response: { ...ready(), editionId: 'droneaid' } });
  await assert.rejects(selectPreparedEdition({ ...wrong.options, storage: f.options.storage }));
  assert.equal(f.values.get(key), before);
  f.values.set(key, '{interrupted old record');
  await assert.rejects(selectPreparedEdition(f.options));
  assert.equal(f.values.get(key), '{interrupted old record');
});

test('installation references reject foreign origins, audiences, mutable paths and URL decorations', () => {
  const value = { ...ready(), scope: scopeFor(), entry: 'game/company.html' };
  const options = {
    editionId: 'coupa-adventure',
    baseURL: `${root}app/`,
    editionRoot: new URL(root).pathname,
  };
  assert.equal(
    validateCompanyInstallationReference({ ...value, scope: '../releases/v1.0.0/site/' }, options)
      .scope,
    scopeFor(),
  );
  for (const scope of [
    'https://other.test/revealline/editions/coupa-adventure/releases/v1.0.0/site/',
    scopeFor('2.0.0'),
    `${root}app/`,
    `${scopeFor()}?old=1`,
    `${scopeFor()}#fragment`,
    scopeFor().replace('https://', 'https://name:secret@'),
    scopeFor().replace('coupa-adventure', 'droneaid'),
  ])
    assert.throws(() => validateCompanyInstallationReference({ ...value, scope }, options));
});

test('waiting workers and cancelled browser registration never replace an installed selection', async () => {
  const f = fixture(),
    key = 'revealline.company-installed.coupa-adventure.v1';
  await selectPreparedEdition(f.options);
  const original = f.values.get(key);
  f.registration.waiting = f.worker;
  await assert.rejects(selectPreparedEdition(f.options), /waiting.*Close other tabs/);
  assert.equal(f.values.get(key), original);
  for (const method of ['register', 'getRegistration'])
    for (const mode of ['abort', 'timeout']) {
      const controller = new AbortController();
      let finish;
      const slow = new Promise((resolve) => {
        finish = resolve;
      });
      const serviceWorker = { ...f.options.serviceWorker, [method]: () => slow };
      const operation = method === 'register' ? prepareEditionOffline : verifyEditionOffline;
      const pending = operation({
        ...f.options,
        serviceWorker,
        signal: controller.signal,
        timeoutMs: 10,
      });
      const rejected = assert.rejects(
        pending,
        mode === 'abort' ? { name: 'AbortError' } : /timed out/,
      );
      await turn();
      if (mode === 'abort') controller.abort();
      await rejected;
      finish(f.registration);
      await turn();
      assert.equal(f.values.get(key), original);
    }
});
