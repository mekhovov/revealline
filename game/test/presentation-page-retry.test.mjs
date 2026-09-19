import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPresentationPage } from '../presentation/page.mjs';
import { Events } from './helpers/couch-dom.mjs';

function fixture() {
  const window = new Events();
  const document = { documentElement: {}, defaultView: window };
  const hosts = [];
  const createHost = () => {
    let resolve, reject;
    const loaded = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const host = {
      resolve,
      reject,
      applies: 0,
      closes: 0,
      report: null,
      load({ onStatus }) {
        host.report = onStatus;
        return loaded;
      },
      apply() {
        host.applies++;
      },
      close() {
        host.closes++;
      },
    };
    hosts.push(host);
    return host;
  };
  return { window, document, createHost, hosts };
}
const painter = () => ({
  presentation: null,
  setPresentation(value) {
    this.presentation = value;
  },
});
const fail = async (f, lease) => {
  await Promise.resolve();
  f.hosts.at(-1).reject(new Error('Temporary resource failure'));
  assert.equal(await lease.ready, null);
};

test('explicit failed-page retry shares one new load and updates all live leases without replacing a pinned painter', async () => {
  const f = fixture(),
    statuses = [],
    first = mountPresentationPage({ ...f, onStatus: (s) => statuses.push(s.status) }),
    second = mountPresentationPage(f);
  const left = painter(),
    right = painter(),
    pin = { retained: true },
    recovered = { release: true };
  first.bindPainter(left);
  second.bindPainter(right);
  await fail(f, first);
  right.setPresentation(pin);
  const oldReady = first.ready,
    retry = first.retry();
  assert.notEqual(retry, oldReady);
  assert.equal(second.retry(), retry);
  assert.equal(first.ready, retry);
  assert.equal(second.ready, retry);
  assert.equal(statuses.at(-1), 'preparing');
  await Promise.resolve();
  assert.equal(f.hosts.length, 2);
  assert.equal(f.hosts[0].closes, 1);
  f.hosts[1].resolve(recovered);
  assert.equal(await retry, recovered);
  assert.equal(first.current(), recovered);
  assert.equal(left.presentation, recovered);
  assert.equal(right.presentation, pin);
  assert.equal(await first.retry(), recovered);
  assert.equal(f.hosts.length, 2, 'An accepted release is not refreshed by picture Retry.');
  first.close();
  second.close();
  assert.equal(f.hosts[1].closes, 1);
  assert.equal(right.presentation, pin);
});

test('retry joins initial work instead of creating a competing host', async () => {
  const f = fixture(),
    lease = mountPresentationPage(f),
    initial = lease.ready;
  assert.equal(lease.retry(), initial);
  await Promise.resolve();
  assert.equal(f.hosts.length, 1);
  const snapshot = { current: true };
  f.hosts[0].resolve(snapshot);
  assert.equal(await initial, snapshot);
  lease.close();
});

test('closing the final lease during recovery prevents late apply, status and painter adoption', async () => {
  const f = fixture(),
    statuses = [],
    lease = mountPresentationPage({ ...f, onStatus: (s) => statuses.push(s.status) }),
    board = painter();
  lease.bindPainter(board);
  await fail(f, lease);
  const retry = lease.retry();
  await Promise.resolve();
  const host = f.hosts[1];
  lease.close();
  const count = statuses.length;
  host.report({ status: 'preparing', stage: 'decoding', message: 'late' });
  host.resolve({ stale: true });
  assert.equal(await retry, null);
  assert.equal(await lease.retry(), null);
  assert.equal(host.applies, 0);
  assert.equal(host.closes, 1);
  assert.equal(board.presentation, null);
  assert.equal(statuses.length, count);
  assert.equal(f.window.listeners.get('pagehide').size, 0);
});

test('one closed lease cannot retry or cancel a peer recovery, including BFCache suspension', async () => {
  const f = fixture(),
    first = mountPresentationPage(f),
    second = mountPresentationPage(f);
  await fail(f, first);
  first.close();
  assert.equal(await first.retry(), null);
  assert.equal(f.hosts.length, 1);
  const retry = second.retry();
  await Promise.resolve();
  f.window.emit('pagehide', { persisted: true });
  assert.equal(f.hosts[1].closes, 0);
  const snapshot = { recovered: true };
  f.hosts[1].resolve(snapshot);
  assert.equal(await retry, snapshot);
  f.window.emit('pagehide', { persisted: false });
  assert.equal(f.hosts[1].closes, 1);
  assert.equal(second.current(), null);
});

test('an error-status observer may immediately retry without later delivering obsolete error state to peers', async () => {
  const f = fixture(),
    peerStatus = [],
    peerErrors = [];
  let retry, first;
  first = mountPresentationPage({
    ...f,
    onStatus(status) {
      if (status.status === 'error') retry = first.retry();
    },
  });
  const second = mountPresentationPage({
    ...f,
    onStatus: (s) => peerStatus.push(s.status),
    onError: (e) => peerErrors.push(e.message),
  });
  const initial = first.ready;
  await Promise.resolve();
  f.hosts[0].reject(new Error('Temporary resource failure'));
  assert.equal(await initial, null);
  assert.ok(retry);
  assert.equal(second.ready, retry);
  assert.equal(peerStatus.at(-1), 'preparing');
  assert.deepEqual(peerErrors, []);
  await Promise.resolve();
  const snapshot = { recovered: true };
  f.hosts[1].resolve(snapshot);
  assert.equal(await retry, snapshot);
  first.close();
  second.close();
});

for (const outcome of ['abort', 'empty']) {
  test(`a ${outcome} load retires its host before an explicit retry`, async () => {
    const f = fixture(),
      lease = mountPresentationPage(f);
    await Promise.resolve();
    if (outcome === 'abort') f.hosts[0].reject(new DOMException('Loader cancelled', 'AbortError'));
    else f.hosts[0].resolve(null);
    assert.equal(await lease.ready, null);
    assert.equal(f.hosts[0].closes, 1);
    const retry = lease.retry();
    await Promise.resolve();
    assert.equal(f.hosts.length, 2);
    const snapshot = { recovered: true };
    f.hosts[1].resolve(snapshot);
    assert.equal(await retry, snapshot);
    lease.close();
    assert.equal(f.hosts[0].closes, 1);
    assert.equal(f.hosts[1].closes, 1);
  });
}
