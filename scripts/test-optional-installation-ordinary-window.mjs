import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import {
  ORDINARY_WINDOW_MODE,
  acquireHistoricalOrdinaryWindow,
  disposeHistoricalOrdinaryWindow,
} from './optional-installation-ordinary-window.mjs';
const URL =
  'http://127.0.0.1:3200/practice/civilian-fpv/releases/v0.142.4/site/optional-practice/civilian-fpv/index.html?lang=en';
const delayedMicrotask = (value) =>
  new Promise((resolve) => {
    resolve(value);
    let depth = 3;
    const block = () => {
      if (depth-- > 0) queueMicrotask(block);
      else {
        const end = performance.now() + 40;
        while (performance.now() < end) {}
      }
    };
    queueMicrotask(block);
  });
function fixture({
  createDelay = 0,
  createReject = false,
  stallResource,
  sessionDelay = 0,
  standalone = false,
  wrongTarget = false,
  wrongContext = false,
  closeFails = false,
  detachFails = false,
  rejectClosedDetach = false,
  state = 'normal',
} = {}) {
  const log = [];
  let created = false,
    closed = false;
  const normal = { left: 20, top: 20, width: 1280, height: 900, windowState: state };
  let context;
  const b = {
    url: () => 'http://127.0.0.1:3200/practice/civilian-fpv/app/',
    context: () => context,
  };
  const a = {
    url: () => URL,
    context: () => context,
    isClosed: () => closed,
    waitForLoadState: async () => {
      log.push('load');
    },
    evaluate: async () => ({ standalone, url: URL }),
  };
  const session = (page) => ({
    async send(method, params) {
      log.push([method, params]);
      if (method === 'Target.getTargetInfo')
        return {
          targetInfo: {
            targetId: page === b ? 'B' : wrongTarget ? 'OTHER' : 'A',
            type: 'page',
            url: page.url(),
            browserContextId: page === a && wrongContext ? 'wrong' : 'owned-context',
          },
        };
      if (method === 'Target.createTarget') {
        await pause(createDelay);
        if (createReject) throw Error('late create rejection');
        created = true;
        return stallResource === 'target' ? delayedMicrotask({ targetId: 'A' }) : { targetId: 'A' };
      }
      if (method === 'Browser.getWindowForTarget')
        return { windowId: params.targetId === 'A' ? 11 : 22, bounds: normal };
      if (method === 'Target.closeTarget') {
        if (closeFails) throw Error('close failed');
        assert.equal(params.targetId, 'A');
        closed = true;
        return { success: true };
      }
      throw Error('unexpected ' + method);
    },
    async detach() {
      log.push(['detach', page === b ? 'B' : 'A']);
      if (rejectClosedDetach && page === a && closed) throw Error('target already closed');
      if (detachFails) throw Error('detach failed');
    },
  });
  context = {
    pages: () => (created && !closed ? [b, a] : [b]),
    newCDPSession: async (page) => {
      await pause(sessionDelay);
      return stallResource === (page === b ? 'control' : 'candidate')
        ? delayedMicrotask(session(page))
        : session(page);
    },
  };
  return {
    context,
    updatePage: b,
    a,
    log,
    receipt: {},
    expectedURL: URL,
    mode: ORDINARY_WINDOW_MODE,
    deadlineAt: Date.now() + 10000,
    timeoutMs: 1000,
  };
}
test('creates exact native newWindow in owned context and proves ordinary display mode', async () => {
  const f = fixture(),
    guard = await acquireHistoricalOrdinaryWindow(f);
  assert.equal(guard.page, f.a);
  assert(f.receipt.created);
  assert.equal(f.receipt.standaloneQualified, false);
  assert.deepEqual(f.log.find((row) => row[0] === 'Target.createTarget')[1], {
    url: URL,
    newWindow: true,
    browserContextId: 'owned-context',
  });
  assert.deepEqual(f.receipt.window.bounds, {
    left: 20,
    top: 20,
    width: 1280,
    height: 900,
    windowState: 'normal',
  });
  assert((await disposeHistoricalOrdinaryWindow(guard)).completed);
  assert(f.a.isClosed());
  assert.equal(f.log.filter((row) => row[0] === 'detach').length, 2);
});
test('requires exact historical mode/URL and fresh owned updater', async () => {
  for (const patch of [
    { mode: 'owned-window-minimize-98ad851' },
    { expectedURL: URL.replace('v0.142.4', 'v0.142.5') },
    { deadlineAt: Date.now() - 1 },
    { timeoutMs: 5001 },
  ]) {
    const f = fixture();
    await assert.rejects(acquireHistoricalOrdinaryWindow({ ...f, ...patch }));
    assert.equal(f.log.length, 0);
  }
});
test('detaches page before target closure, retaining updater control until afterward', async () => {
  const f = fixture({ rejectClosedDetach: true });
  const guard = await acquireHistoricalOrdinaryWindow(f);
  assert((await disposeHistoricalOrdinaryWindow(guard)).completed);
  assert.deepEqual(
    f.log.filter((row) => Array.isArray(row) && ['detach', 'Target.closeTarget'].includes(row[0])),
    [
      ['detach', 'A'],
      ['Target.closeTarget', { targetId: 'A' }],
      ['detach', 'B'],
    ],
  );
  assert((await disposeHistoricalOrdinaryWindow(guard)).completed);
  assert.equal(f.log.filter((row) => row[0] === 'detach').length, 2);
});
test('rejects standalone, foreign context and abnormal initial bounds, closes only created target', async () => {
  for (const patch of [{ standalone: true }, { wrongContext: true }, { state: 'minimized' }]) {
    const f = fixture(patch);
    await assert.rejects(acquireHistoricalOrdinaryWindow(f));
    assert(!f.receipt.created && f.receipt.cleanup.completed && f.a.isClosed());
    assert(
      f.log
        .filter((row) => row[0] === 'Target.closeTarget')
        .every((row) => row[1].targetId === 'A'),
    );
  }
});
test('target identity mismatch cannot bind same-URL page', async () => {
  const f = fixture({ wrongTarget: true });
  f.timeoutMs = 30;
  await assert.rejects(acquireHistoricalOrdinaryWindow(f));
  assert(!f.receipt.created);
  assert(f.a.isClosed());
});
test('pre-abort performs no acquisition or native command', async () => {
  const f = fixture();
  f.signal = AbortSignal.abort();
  await assert.rejects(acquireHistoricalOrdinaryWindow(f));
  assert.equal(f.log.length, 0);
});
test('late target creation is closed and never accepted; cleanup stays unverified', async () => {
  const f = fixture({ createDelay: 60 });
  f.timeoutMs = 20;
  await assert.rejects(acquireHistoricalOrdinaryWindow(f));
  assert(!f.receipt.cleanup.completed && !f.receipt.created);
  await pause(100);
  assert(f.receipt.lateTargetClosed && f.a.isClosed());
  assert.equal(f.receipt.cleanup.completed, false);
  assert.equal(f.log.filter((row) => row[0] === 'detach').length, 1);
});
test('late control session gets detached without creating a target', async () => {
  const f = fixture({ sessionDelay: 50 });
  f.timeoutMs = 15;
  await assert.rejects(acquireHistoricalOrdinaryWindow(f));
  await pause(70);
  assert(!f.receipt.cleanup.completed);
  assert.equal(f.log.filter((row) => row[0] === 'detach').length, 1);
  assert.equal(
    f.log.some((row) => row[0] === 'Target.createTarget'),
    false,
  );
});
test('late target close failure remains explicit and cannot qualify cleanup', async () => {
  const f = fixture({ createDelay: 50, closeFails: true });
  f.timeoutMs = 15;
  await assert.rejects(acquireHistoricalOrdinaryWindow(f));
  await pause(80);
  assert.match(f.receipt.lateCleanupError, /close failed/);
  assert(!f.receipt.cleanup.completed);
});
test('close and detach failures do not skip remaining independent cleanup', async () => {
  const f = fixture({ detachFails: true }),
    g = await acquireHistoricalOrdinaryWindow(f);
  assert.equal((await disposeHistoricalOrdinaryWindow(g)).completed, false);
  assert(f.a.isClosed());
  assert.equal(f.log.filter((row) => row[0] === 'detach').length, 2);
});
test('late creation rejection releases the reserved control session exactly once', async () => {
  const f = fixture({ createDelay: 50, createReject: true });
  f.timeoutMs = 15;
  await assert.rejects(acquireHistoricalOrdinaryWindow(f));
  await pause(80);
  assert(!f.receipt.cleanup.completed);
  assert.equal(f.log.filter((row) => row[0] === 'detach').length, 1);
  assert.equal(
    f.log.some((row) => row[0] === 'Target.closeTarget'),
    false,
  );
});
for (const stallResource of ['control', 'target', 'candidate'])
  test(`post-resolution microtask stall cannot orphan ${stallResource}`, async () => {
    const f = fixture({ stallResource });
    f.timeoutMs = 20;
    await assert.rejects(acquireHistoricalOrdinaryWindow(f));
    await pause(70);
    assert(!f.receipt.created);
    assert.equal(f.log.filter((row) => row[0] === 'detach' && row[1] === 'B').length, 1);
    if (stallResource !== 'control') {
      assert(f.a.isClosed());
      assert.equal(f.log.filter((row) => row[0] === 'Target.closeTarget').length, 1);
    }
    if (stallResource === 'candidate')
      assert.equal(f.log.filter((row) => row[0] === 'detach' && row[1] === 'A').length, 1);
  });
