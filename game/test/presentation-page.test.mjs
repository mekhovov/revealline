import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPresentationPage } from '../presentation/page.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { Events } from './helpers/couch-dom.mjs';

function pageFixture() {
  const window = new Events(),
    document = { documentElement: {}, defaultView: window };
  let resolve, reject;
  const loaded = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const calls = { created: 0, loads: 0, applies: 0, closes: 0 };
  const createHost = ({ document: target }) => {
    assert.equal(target, document);
    calls.created++;
    return {
      load() {
        calls.loads++;
        return loaded;
      },
      apply(element) {
        assert.equal(element, document.documentElement);
        calls.applies++;
      },
      close() {
        calls.closes++;
      },
    };
  };
  return { document, window, createHost, calls, resolve, reject };
}

test('two Couch painters and repeated page mounts share one load, while leases retain independent cleanup', async () => {
  const f = pageFixture(),
    first = mountPresentationPage(f),
    second = mountPresentationPage(f);
  const left = new BoardPainter({}),
    right = new BoardPainter({});
  const source = { authored: true },
    snapshot = { release: true };
  left.theme = right.theme = source;
  first.bindPainter(left);
  first.bindPainter(right);
  const releaseShared = second.bindPainter(left);
  f.resolve(snapshot);
  assert.equal(await first.ready, snapshot);
  assert.equal(first.ready, second.ready);
  assert.deepEqual(f.calls, { created: 1, loads: 1, applies: 1, closes: 0 });
  assert.equal(left.presentation, snapshot);
  assert.equal(right.presentation, snapshot);
  assert.equal(left.theme, source, 'Cosmetic binding never replaces the authored theme.');
  first.close();
  assert.equal(right.presentation, null);
  assert.equal(left.presentation, snapshot, 'The remaining owner still uses this painter.');
  releaseShared();
  assert.equal(left.presentation, null);
  second.close();
  second.close();
  assert.equal(f.calls.closes, 1);
  assert.equal(f.window.listeners.get('pagehide').size, 0);
});

test('Replay replacement restores only its previous painter and never overwrites an independently pinned snapshot', async () => {
  const f = pageFixture(),
    page = mountPresentationPage(f),
    oldPainter = new BoardPainter({});
  const snapshot = { release: true },
    pinned = { exactRecording: true };
  const releaseOld = page.bindPainter(oldPainter);
  f.resolve(snapshot);
  await page.ready;
  releaseOld();
  const nextPainter = new BoardPainter({});
  page.bindPainter(nextPainter);
  assert.equal(oldPainter.presentation, null);
  assert.equal(nextPainter.presentation, snapshot);
  nextPainter.setPresentation(pinned);
  releaseOld();
  page.close();
  assert.equal(nextPainter.presentation, pinned);
});

test('a late compiled load cannot replace a painter chosen while loading, or publish after page disposal', async () => {
  const f = pageFixture(),
    page = mountPresentationPage(f),
    painter = new BoardPainter({});
  const pinned = { saved: true };
  page.bindPainter(painter);
  painter.setPresentation(pinned);
  f.resolve({ release: true });
  await page.ready;
  assert.equal(painter.presentation, pinned);
  page.close();

  const pending = pageFixture(),
    cancelled = mountPresentationPage(pending);
  cancelled.bindPainter(new BoardPainter({}));
  await Promise.resolve();
  pending.window.emit('pagehide', { persisted: false });
  pending.resolve({ stale: true });
  assert.equal(await cancelled.ready, null);
  assert.deepEqual(pending.calls, { created: 1, loads: 1, applies: 0, closes: 1 });
});

test('BFCache suspension retains the host and boards until actual disposal, then a new mount can reload', async () => {
  const f = pageFixture(),
    page = mountPresentationPage(f),
    painter = new BoardPainter({});
  const snapshot = { release: true };
  page.bindPainter(painter);
  f.resolve(snapshot);
  await page.ready;
  f.window.emit('pagehide', { persisted: true });
  assert.equal(painter.presentation, snapshot);
  assert.equal(f.calls.closes, 0);
  f.window.emit('pagehide', { persisted: false });
  assert.equal(painter.presentation, null);
  assert.equal(f.calls.closes, 1);
  const next = mountPresentationPage(f);
  await next.ready;
  assert.equal(f.calls.created, 2);
  next.close();
});

test('missing or rejected release resources preserve source look and notify without rejecting page readiness', async () => {
  const f = pageFixture(),
    notices = [],
    painter = new BoardPainter({});
  const page = mountPresentationPage({
    ...f,
    onError: () => {
      throw new Error('Notice failed');
    },
  });
  const peer = mountPresentationPage({ ...f, onError: (error) => notices.push(error.message) });
  page.bindPainter(painter);
  f.reject(new Error('Release unavailable'));
  assert.equal(await page.ready, null);
  assert.deepEqual(notices, ['Release unavailable']);
  assert.equal(painter.presentation, null);
  assert.equal(f.calls.applies, 0);
  assert.equal(f.calls.closes, 1);
  page.close();
  peer.close();
  assert.equal(f.calls.closes, 1);
  const invalid = mountPresentationPage({
    document: { documentElement: {} },
    createHost() {
      throw new TypeError('Unsupported origin');
    },
  });
  assert.equal(await invalid.ready, null);
  invalid.close();
});

test('cosmetic page status is immediate, shared without duplicate work, and fenced per closed lease', async () => {
  const f = pageFixture(),
    firstStatus = [],
    secondStatus = [];
  let report;
  const createHost = (options) => {
    const host = f.createHost(options),
      load = host.load;
    host.load = ({ onStatus }) => {
      report = onStatus;
      return load();
    };
    return host;
  };
  const first = mountPresentationPage({ ...f, createHost, onStatus: (s) => firstStatus.push(s) });
  assert.equal(firstStatus[0].stage, 'reading');
  assert.equal(f.calls.loads, 0, 'status is present before deferred cosmetic loading');
  const second = mountPresentationPage({ ...f, createHost, onStatus: (s) => secondStatus.push(s) });
  await Promise.resolve();
  report({
    status: 'preparing',
    stage: 'decoding',
    message: 'Opening release artwork…',
    progress: null,
  });
  first.close();
  const count = firstStatus.length;
  f.resolve({ release: true });
  await second.ready;
  assert.equal(firstStatus.length, count);
  assert.equal(secondStatus.at(-1).status, 'ready');
  const cached = [];
  const third = mountPresentationPage({ ...f, createHost, onStatus: (s) => cached.push(s) });
  assert.equal(cached[0].status, 'ready');
  assert.equal(f.calls.loads, 1);
  second.close();
  third.close();
});
