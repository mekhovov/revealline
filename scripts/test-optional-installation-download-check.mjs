import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, get } from 'node:http';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { setTimeout as pause } from 'node:timers/promises';
import {
  selectInstallationDownloadFaults,
  assertDownloadFaultTiming,
  readPreparedCacheFingerprints,
  observeInstallationDownloadFault,
} from './optional-installation-download-check.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function evaluatedPage(environment) {
  const browser = { ...environment };
  return {
    browser,
    evaluate: async (fn, input) => {
      browser.input = input;
      return runInNewContext(`(${fn.toString()})(input)`, browser);
    },
  };
}

test('short download matrix requires exact explicit opt-in', () => {
  assert.equal(selectInstallationDownloadFaults(undefined), false);
  assert.equal(selectInstallationDownloadFaults('all-short'), true);
  for (const value of ['', true, 'all', 'idle', 'cancel-hold', 'overall-trickle'])
    assert.throws(() => selectInstallationDownloadFaults(value));
});

test('mode-specific timing rejects late or no-op Cancel and distinguishes the documented Gym copy', () => {
  const cancelled = {
    mode: 'cancel-hold',
    cancelAfterPrefixMs: 100,
    cancelLatencyMs: 100,
    status: 'Download cancelled',
  };
  assert.equal(assertDownloadFaultTiming(cancelled, '#transfer-status'), true);
  assert.equal(
    assertDownloadFaultTiming(
      { ...cancelled, cancelAfterPrefixMs: 19999, cancelLatencyMs: 4999 },
      '#runtime-offline-status',
    ),
    true,
  );
  for (const key of ['cancelAfterPrefixMs', 'cancelLatencyMs'])
    for (const value of [undefined, NaN, Infinity, -1, key === 'cancelLatencyMs' ? 5000 : 20000])
      assert.throws(() =>
        assertDownloadFaultTiming({ ...cancelled, [key]: value }, '#transfer-status'),
      );
  for (const status of ['Timed out', 'Preparation failed', 'Ready offline', ''])
    assert.throws(() => assertDownloadFaultTiming({ ...cancelled, status }, '#transfer-status'));
  const gym = {
    ...cancelled,
    status: 'Offline preparation failed. Online practice remains available.',
  };
  assert.equal(assertDownloadFaultTiming(gym, '#package-status'), true);
  assert.throws(() =>
    assertDownloadFaultTiming({ ...gym, cancelLatencyMs: 30000 }, '#package-status'),
  );
  assert.throws(() =>
    assertDownloadFaultTiming({ ...gym, status: 'Offline preparation failed' }, '#package-status'),
  );
  assert.throws(() => assertDownloadFaultTiming(gym, '#transfer-status'));
  for (const heldMs of [28500, 39999])
    assert.equal(
      assertDownloadFaultTiming(
        { mode: 'idle', heldMs, status: 'Preparation timed out' },
        '#status',
      ),
      true,
    );
  for (const heldMs of [28499, 40000, 45000, NaN, undefined])
    assert.throws(() =>
      assertDownloadFaultTiming(
        { mode: 'idle', heldMs, status: 'Preparation timed out' },
        '#status',
      ),
    );
  assert.throws(() =>
    assertDownloadFaultTiming({ mode: 'idle', heldMs: 30000, status: 'Cancelled' }, '#status'),
  );
  assert.throws(() =>
    assertDownloadFaultTiming({ ...cancelled, mode: 'overall-trickle' }, '#status'),
  );
});

function cacheFixture({
  missingCache = false,
  missingResponse = false,
  oversized = false,
  truncated = false,
  changed = false,
} = {}) {
  const name = 'revealline.optional.example',
    events = [],
    content = Buffer.from('real unit bytes');
  const files = ['http://127.0.0.1/z', 'http://127.0.0.1/a'].map((url) => ({
    url,
    bytes: content.length,
    sha256: digest(content),
  }));
  const inventories = [{ name, files }];
  const page = evaluatedPage({
    crypto: webcrypto,
    caches: {
      keys: async () => {
        events.push('cache-list');
        return missingCache ? [] : [name];
      },
      open: () => assert.fail('No cache may be opened or created, including after eviction'),
      match: async (url, options) => {
        assert.equal(options.cacheName, name);
        assert.equal(Object.keys(options).length, 1);
        events.push(`read:${url}`);
        if (missingResponse) return undefined;
        let reads = 0;
        const payload = changed ? Buffer.alloc(content.length, 99) : content;
        return {
          arrayBuffer: () => assert.fail('Unbounded whole-response allocation is forbidden'),
          body: {
            getReader: () => ({
              read: async () => {
                reads++;
                if (reads === 1)
                  return {
                    done: false,
                    value: Uint8Array.from(truncated ? payload.subarray(1) : payload),
                  };
                if (oversized && reads === 2) return { done: false, value: Uint8Array.of(1) };
                assert(!oversized, 'Stop streaming immediately after the pinned size is exceeded');
                return { done: true };
              },
              cancel: async () => events.push(`cancel:${url}`),
            }),
          },
        };
      },
      put: () => assert.fail('No cache write is permitted'),
      add: () => assert.fail('No cache fetch/write is permitted'),
      delete: () => assert.fail('No cache removal is permitted'),
    },
  });
  return { page, name, inventories, events, content };
}

test('prepared fingerprint observer only reads named existing caches and hashes exact bytes', async () => {
  const { page, name, inventories, events, content } = cacheFixture();
  const result = await readPreparedCacheFingerprints(page, inventories);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, name);
  assert.deepEqual(
    [...result[0].files].map((row) => row.url),
    ['http://127.0.0.1/a', 'http://127.0.0.1/z'],
  );
  assert(
    result[0].files.every((row) => row.sha256 === digest(content) && row.bytes === content.length),
  );
  assert.deepEqual(events, [
    'cache-list',
    'read:http://127.0.0.1/z',
    'cancel:http://127.0.0.1/z',
    'read:http://127.0.0.1/a',
    'cancel:http://127.0.0.1/a',
  ]);
});

test('missing caches/responses and streamed size/hash changes reject without writes', async () => {
  for (const options of [
    { missingCache: true },
    { missingResponse: true },
    { oversized: true },
    { truncated: true },
    { changed: true },
  ]) {
    const { page, inventories, events } = cacheFixture(options);
    await assert.rejects(readPreparedCacheFingerprints(page, inventories));
    if (options.missingCache) assert.deepEqual(events, ['cache-list']);
    if (options.oversized || options.truncated || options.changed)
      assert(events.includes('cancel:http://127.0.0.1/z'), 'Always cancel the owned stream');
  }
});

test('invalid or oversized pinned inventories reject before reading browser storage', async () => {
  const page = { evaluate: () => assert.fail('Invalid inventories must not reach the page') };
  const { inventories } = cacheFixture();
  const inventory = inventories[0],
    file = inventory.files[0];
  const one = (patch) => [{ ...inventory, files: [{ ...file, ...patch }] }];
  const invalid = [
    null,
    [],
    Array(17).fill(inventory),
    [inventory, inventory],
    [{ ...inventory, name: 'unrelated-cache' }],
    [{ ...inventory, files: [] }],
    [{ ...inventory, files: Array(513).fill(file) }],
    [{ ...inventory, files: [file, file] }],
    ...[-1, NaN, Infinity, 1.5, 64 * 1024 * 1024 + 1].map((bytes) => one({ bytes })),
    ...['', 'f'.repeat(63), 'G'.repeat(64)].map((sha256) => one({ sha256 })),
    ...[
      'file:///tmp/a',
      'http://u:p@127.0.0.1/a',
      'http://127.0.0.1/a?q=1',
      'http://127.0.0.1/a#fragment',
    ].map((url) => one({ url })),
    [
      {
        ...inventory,
        files: Array.from({ length: 5 }, (_, index) => ({
          ...file,
          url: `http://127.0.0.1/${index}`,
          bytes: 64 * 1024 * 1024,
        })),
      },
    ],
  ];
  for (const value of invalid) await assert.rejects(readPreparedCacheFingerprints(page, value));
});

/** Real local HTTP fault + scripted DOM unit fixture, NOT a browser qualification.
 * Real activateOfflineAction callbacks run against a persistent isolated VM.
 * A Cancel action aborts the actual request, not a fabricated fault snapshot.
 */
async function exerciseCancel({
  actionFails = false,
  beforeRequestFails = false,
  disabledCancel = false,
  noopCancel = false,
  wrongPhase = false,
} = {}) {
  const body = Buffer.alloc(256, 37),
    pathname = '/revealline/practice/civilian-fpv/releases/v0.0.1/site/game/example.mjs';
  const original = (_request, response) => response.end('ordinary response');
  const server = createServer(original);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let client,
    response,
    mutation,
    progress = false,
    busy = false,
    disconnected = false,
    cancelClicks = 0;
  const statusNode = { textContent: 'Ready offline', contains: () => false };
  const emit = (text) => {
    statusNode.textContent = text;
    mutation?.([{ target: statusNode, addedNodes: [] }]);
  };
  const page = evaluatedPage({
    document: {
      body: {},
      querySelector: (selector) => {
        if (selector === '#status') return statusNode;
        if (selector === '#prepare') return { disabled: busy };
        if (selector === '[data-optional-offline-progress]') return progress ? {} : null;
        if (selector === '[data-optional-offline-progress] [role="status"]')
          return progress
            ? {
                textContent: wrongPhase ? 'Verifying · unit fixture' : 'Downloading · unit fixture',
              }
            : null;
        return null;
      },
    },
    MutationObserver: class {
      constructor(callback) {
        mutation = callback;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  });
  const finish = (text) => {
    response?.destroy();
    client?.destroy();
    busy = false;
    progress = false;
    emit(text);
  };
  const panel = {
    waitFor: async ({ state }) => {
      assert.equal(progress, state === 'visible', 'Progress panel state mismatch');
    },
    innerText: async () => (wrongPhase ? 'Verifying · unit fixture' : 'Downloading · unit fixture'),
    getByRole: (role, options) => {
      assert.equal(role, 'button');
      assert.deepEqual(options, { name: 'Cancel download', exact: true });
      return {
        waitFor: async ({ state }) => assert.equal(state, 'visible'),
        isEnabled: async () => !disabledCancel,
        click: async () => {
          cancelClicks++;
          if (noopCancel) {
            await pause(20);
            finish('Timed out');
          } else finish('Download cancelled');
        },
      };
    },
  };
  page.locator = (selector) => {
    if (selector === '[data-optional-offline-progress]') return panel;
    if (selector === '#status') return { textContent: async () => statusNode.textContent };
    assert.equal(selector, '#prepare');
    return {
      waitFor: async ({ state }) => assert.equal(state, 'visible'),
      press: async (key) => {
        assert.equal(key, 'Enter');
        if (beforeRequestFails) throw Error('Native action failed before a request');
        busy = true;
        await new Promise((resolve, reject) => {
          client = get(origin + pathname, (res) => {
            response = res;
            res.on('error', () => {});
            res.once('data', () => {
              progress = true;
              emit('Downloading');
              resolve();
            });
          });
          client.on('error', reject);
        });
        if (actionFails) throw Error('Native prepare action failed');
      },
    };
  };
  page.waitForFunction = async (fn, input) => {
    const end = Date.now() + 1000;
    while (true) {
      if (await page.evaluate(fn, input)) return;
      if (Date.now() >= end) throw Error('Unit DOM condition did not settle');
      await pause(5);
    }
  };
  const receipt = {};
  let error;
  try {
    await observeInstallationDownloadFault({
      page,
      server,
      origin,
      dependency: { pathname, bytes: body.length, sha256: digest(body) },
      body,
      mode: 'cancel-hold',
      prepare: '#prepare',
      status: '#status',
      receipt,
    });
  } catch (caught) {
    error = caught;
  } finally {
    response?.destroy();
    client?.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(server.listeners('request').length, 1);
  assert.equal(server.listeners('request')[0], original);
  assert.equal(receipt.fault.closed, true);
  assert.equal(receipt.fault.activeTimers, 0);
  assert.deepEqual(receipt.fault.cleanupErrors, []);
  assert.equal(disconnected, true);
  assert.equal(page.browser.__optionalInstallationWitness, undefined);
  return { receipt, error, cancelClicks };
}

test('actual short fault plus real action witness cancels one HTTP request and cleans up', async () => {
  const { receipt, error, cancelClicks } = await exerciseCancel();
  assert.equal(error, undefined);
  assert.equal(cancelClicks, 1);
  assert.equal(receipt.passed, true);
  assert.equal(receipt.fault.bytesSent, 1);
  assert.equal(receipt.fault.delegatedTargetRequests, 0);
  assert(['client-disconnect', 'request-aborted'].includes(receipt.fault.outcome));
  assert.match(receipt.status, /cancelled/);
  assert.match(receipt.visibleProgress, /Downloading/);
});

test('native action failure and disabled Cancel preserve failure and remove owned fault resources', async () => {
  for (const options of [
    { beforeRequestFails: true },
    { actionFails: true },
    { disabledCancel: true },
    { wrongPhase: true },
  ]) {
    const { receipt, error } = await exerciseCancel(options);
    assert(error);
    assert.notEqual(receipt.passed, true);
  }
});

test('a no-op Cancel followed by timeout must not qualify cancellation', async () => {
  const { receipt, error, cancelClicks } = await exerciseCancel({ noopCancel: true });
  assert.equal(cancelClicks, 1);
  assert(error, 'Generic timeout after a Cancel click must be rejected.');
  assert.notEqual(receipt.passed, true);
});
