import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  createSelectedFontHold,
  selectedFont,
  assertSelectedFontTransport,
} from './solo-qualification-readiness.mjs';
const original = await readFile(
  new URL('../game/ui/fonts/field-kit/handjet-display-600.woff2', import.meta.url),
);
const entry = 'http://127.0.0.1:43123/game/index.html',
  target = new URL(selectedFont.relativePath, entry).href;
const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
};
function fixture(options = {}) {
  let now = 0,
    id = 0;
  const timers = new Map(),
    calls = [];
  const wait = async (name) => {
    if (options.wait === name) await options.pending;
    if (options.reject === name) throw new Error(name + ' rejected');
  };
  const response = {
    url: () => options.responseURL ?? target,
    status: () => options.status ?? 200,
    headers: () =>
      options.headers ?? {
        'content-type': 'font/woff2',
        'content-length': String(original.length),
        'cache-control': 'public, max-age=3600',
      },
    body: async () => {
      await wait('body');
      return options.bytes ?? Buffer.from(original);
    },
    dispose: async () => {
      calls.push(['dispose']);
      await wait('dispose');
    },
  };
  const route = {
    request: () => ({
      url: () => options.url ?? target,
      method: () => options.method ?? 'GET',
      resourceType: () => options.resourceType ?? 'font',
      headers: () => options.requestHeaders ?? {},
    }),
    fetch: async (args) => {
      calls.push(['fetch', args]);
      await wait('fetch');
      return response;
    },
    fulfill: async (args) => {
      calls.push(['fulfill', args]);
      assert.equal(args.response, response);
      await wait('fulfill');
    },
    abort: async (reason) => {
      calls.push(['abort', reason]);
      await wait('abort');
    },
  };
  const owner = createSelectedFontHold(entry, {
    requestPolicy: options.requestPolicy ?? 'single-v1',
    releaseBoundary: options.releaseBoundary ?? 'public-cancellation',
    now: () => now,
    setTimer: (callback, ms) => {
      const n = ++id;
      timers.set(n, { at: now + ms, callback });
      return n;
    },
    clearTimer: (n) => timers.delete(n),
  });
  async function advance(ms) {
    const end = now + ms;
    await flush();
    for (;;) {
      const due = [...timers]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].callback();
      await flush();
    }
    now = end;
    await flush();
  }
  return {
    owner,
    route,
    response,
    calls,
    advance,
    timers,
    jump: (value) => {
      now = value;
    },
  };
}
test('exact validated response waits through cancellation then forwards original APIResponse and disposes', async () => {
  const f = fixture(),
    running = f.owner.handle(f.route);
  await flush();
  assert.equal(f.owner.snapshot().status, 'held');
  await f.owner.waitUntilHeld();
  assert.deepEqual(
    f.calls.map((c) => c[0]),
    ['fetch'],
  );
  assert.deepEqual(f.calls[0][1], { timeout: 10000, maxRedirects: 0, maxRetries: 0 });
  f.owner.releaseAfterPublicCancellation();
  await running;
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'complete');
  assert(r.closed && r.responseDisposed && r.released);
  assert.deepEqual(r.pendingOperations, []);
  assert.deepEqual(r.timedOutOperations, []);
  assert.equal(r.actualSHA256, selectedFont.sha256);
  assert.equal(f.timers.size, 0);
});
test('unrelated URL/origin/query retains existing route without a new request', async () => {
  for (const url of [
    target + '?x=1',
    target.replace('127.0.0.1', 'localhost'),
    target.replace('handjet-display-600', 'other'),
  ]) {
    const f = fixture({ url });
    assert.equal(await f.owner.handle(f.route), false);
    assert.equal(f.calls.length, 0);
    await f.owner.close();
  }
});
test('wrong status/type/length/hash/redirect/method/range fail without delivery', async () => {
  const corrupt = Buffer.from(original);
  corrupt[100] ^= 1;
  for (const options of [
    { status: 404 },
    { headers: { 'content-type': 'text/plain', 'content-length': String(original.length) } },
    { headers: { 'content-type': 'font/woff2', 'content-length': '99999999' } },
    { bytes: corrupt },
    { bytes: original.subarray(1) },
    { responseURL: target + '?changed=1' },
    { method: 'POST' },
    { resourceType: 'other' },
    { requestHeaders: { range: 'bytes=0-1' } },
  ]) {
    const f = fixture(options);
    await f.owner.handle(f.route);
    assert.equal(f.owner.snapshot().status, 'failed');
    assert(!f.calls.some((c) => c[0] === 'fulfill'));
    await f.owner.close();
  }
});
test('one fixed hold deadline fails closed and disposes without delivery', async () => {
  const f = fixture(),
    running = f.owner.handle(f.route);
  await flush();
  await f.advance(60000);
  await running;
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert.match(r.failure, /deadline/);
  assert(r.responseDisposed && !r.released);
  assert.equal(f.timers.size, 0);
});
test('missing native request has bounded observation deadline, not fabricated held readiness', async () => {
  const f = fixture();
  const wait = f.owner.waitUntilHeld();
  const rejected = assert.rejects(wait);
  await f.advance(10000);
  await rejected;
  await f.owner.close();
  assert.equal(f.owner.snapshot().claimed, 0);
  assert.equal(f.owner.snapshot().status, 'failed');
  assert.equal(f.timers.size, 0);
});
test('close does not claim a noncancelable fetch settled; late response is still disposed', async () => {
  let release;
  const pending = new Promise((resolve) => {
      release = resolve;
    }),
    f = fixture({ wait: 'fetch', pending }),
    running = f.owner.handle(f.route);
  await flush();
  await f.owner.close();
  await running;
  let r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert.equal(r.closed, false);
  assert.deepEqual(r.pendingOperations, ['response-fetch']);
  release();
  await flush();
  r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(r.responseDisposed && r.closed);
  assert(!r.released);
});
test('duplicate request invalidates first observation with no second fetch', async () => {
  const f = fixture(),
    running = f.owner.handle(f.route);
  await flush();
  await f.owner.handle(f.route);
  await running;
  await f.owner.close();
  assert.equal(f.owner.snapshot().status, 'failed');
  assert.equal(f.owner.snapshot().claimed, 2);
  assert.equal(f.calls.filter((c) => c[0] === 'fetch').length, 1);
});
test('never-settling fetch/body/fulfill/dispose remains failed and unclosed under finite deadline', async () => {
  for (const stage of ['fetch', 'body', 'fulfill', 'dispose']) {
    const f = fixture({ wait: stage, pending: new Promise(() => {}) }),
      running = f.owner.handle(f.route);
    await flush();
    if (['fulfill', 'dispose'].includes(stage)) f.owner.releaseAfterPublicCancellation();
    await flush();
    await f.advance(62000);
    await running;
    await f.owner.close();
    const r = f.owner.snapshot();
    assert.equal(r.status, 'failed', stage);
    assert.equal(r.closed, false, stage);
    assert.equal(r.pendingOperations.length, 1, stage);
    assert(r.timedOutOperations.length > 0, stage);
    assert.equal(f.timers.size, 0, stage);
  }
});
test('never-settling abort uses only cleanup reserve and remains unclosed', async () => {
  const f = fixture({ method: 'POST', wait: 'abort', pending: new Promise(() => {}) }),
    running = f.owner.handle(f.route);
  await flush();
  await f.advance(2000);
  await running;
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert.equal(r.closed, false);
  assert.deepEqual(r.pendingOperations, ['request-abort']);
  assert.equal(f.timers.size, 0);
});
test('late native rejection remains observed and cannot promote timed-out observation', async () => {
  for (const stage of ['body', 'fulfill', 'dispose']) {
    let reject;
    const pending = new Promise((_, r) => {
        reject = r;
      }),
      f = fixture({ wait: stage, pending }),
      running = f.owner.handle(f.route);
    await flush();
    if (stage !== 'body') f.owner.releaseAfterPublicCancellation();
    await flush();
    await f.advance(62000);
    await running;
    await f.owner.close();
    reject(new Error('late ' + stage));
    await flush();
    const r = f.owner.snapshot();
    assert.equal(r.status, 'failed');
    assert.deepEqual(r.pendingOperations, []);
    assert(r.timedOutOperations.length > 0);
  }
});
test('early/repeated release and immediate native errors fail closed', async () => {
  const f = fixture();
  assert.throws(() => f.owner.releaseAfterPublicCancellation());
  const running = f.owner.handle(f.route);
  await flush();
  f.owner.releaseAfterPublicCancellation();
  assert.throws(() => f.owner.releaseAfterPublicCancellation());
  await running;
  await f.owner.close();
  for (const reject of ['fetch', 'body', 'fulfill', 'dispose']) {
    const f = fixture({ reject }),
      running = f.owner.handle(f.route);
    await flush();
    if (f.owner.snapshot().status === 'held') f.owner.releaseAfterPublicCancellation();
    await running;
    await f.owner.close();
    assert.equal(f.owner.snapshot().status, 'failed', reject);
  }
});

test('expired deadline prevents a new native action even before scheduled timers run', async () => {
  const f = fixture(),
    running = f.owner.handle(f.route);
  await flush();
  assert.equal(f.owner.snapshot().status, 'held');
  f.jump(60001);
  f.owner.releaseAfterPublicCancellation();
  await running;
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(!f.calls.some((c) => c[0] === 'fulfill'));
  assert(r.timedOutOperations.includes('response-fulfill'));
});
test('late promise delivery cannot beat an already expired deadline timer', async () => {
  let release;
  const pending = new Promise((resolve) => {
      release = resolve;
    }),
    f = fixture({ wait: 'fetch', pending }),
    running = f.owner.handle(f.route);
  await flush();
  f.jump(10001);
  release();
  await flush();
  await running;
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(r.timedOutOperations.includes('response-fetch'));
  assert(!f.calls.some((c) => c[0] === 'fulfill'));
  assert(r.responseDisposed);
});
test('invalid initial clocks are rejected before any native request', () => {
  for (const value of [NaN, Infinity, -1])
    assert.throws(() => createSelectedFontHold(entry, { now: () => value }), /Finite monotonic/);
});

test('a fetch arriving after cleanup reserve stays explicitly owned and never reopens cleanup budget', async () => {
  let release;
  const pending = new Promise((r) => (release = r)),
    f = fixture({ wait: 'fetch', pending }),
    running = f.owner.handle(f.route);
  await flush();
  await f.advance(12000);
  await running;
  await f.owner.close();
  release();
  await flush();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert.equal(r.closed, false);
  assert.equal(r.ownedResponseCount, 1);
  assert.equal(r.responseDisposed, false);
  assert(!f.calls.some((c) => c[0] === 'dispose'));
  assert(r.timedOutOperations.includes('response-dispose'));
});

test('joined mode shares one validated fetch and original response across two held native routes', async () => {
  const f = fixture({ requestPolicy: 'same-url-two-v2' });
  const first = f.owner.handle(f.route);
  await flush();
  const second = f.owner.handle({ ...f.route });
  await flush();
  await f.owner.waitUntilHeld();
  assert.equal(f.owner.snapshot().ownedRouteCount, 2);
  assert.equal(f.calls.filter((c) => c[0] === 'fetch').length, 1);
  assert.equal(f.calls.filter((c) => c[0] === 'fulfill').length, 0);
  f.owner.releaseAfterPublicCancellation();
  await Promise.all([first, second]);
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.format, 'SoloSelectedFontHoldV2');
  assert.equal(r.maximumRequests, 2);
  assert.equal(r.claimed, 2);
  assert.equal(r.status, 'complete');
  assert(r.closed && r.responseDisposed && r.released);
  assert.equal(r.ownedRouteCount, 0);
  assert.deepEqual(
    r.routes.map((x) => [x.fulfillmentSettled, x.abortionSettled]),
    [
      [true, false],
      [true, false],
    ],
  );
  assert.equal(f.calls.filter((c) => c[0] === 'fulfill').length, 2);
  assert.equal(f.calls.filter((c) => c[0] === 'dispose').length, 1);
  assert.equal(f.timers.size, 0);
});

test('a second request joining during fetch shares its nonrenewing deadline and response', async () => {
  let release;
  const f = fixture({
    requestPolicy: 'same-url-two-v2',
    wait: 'fetch',
    pending: new Promise((r) => (release = r)),
  });
  const first = f.owner.handle(f.route);
  await flush();
  await f.advance(9000);
  const second = f.owner.handle({ ...f.route });
  release();
  await flush();
  assert.equal(f.owner.snapshot().status, 'held');
  await f.advance(50999);
  assert.equal(f.owner.snapshot().status, 'held');
  await f.advance(1);
  await Promise.all([first, second]);
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(r.closed && r.responseDisposed && r.abortSettled);
  assert.equal(r.ownedRouteCount, 0);
  assert.equal(f.calls.filter((c) => c[0] === 'fetch').length, 1);
  assert.equal(f.calls.filter((c) => c[0] === 'abort').length, 2);
});

test('cancellation aborts both admitted routes and retains no owned response', async () => {
  const f = fixture({ requestPolicy: 'same-url-two-v2' });
  const first = f.owner.handle(f.route);
  await flush();
  const second = f.owner.handle({ ...f.route });
  await flush();
  await f.owner.close();
  await Promise.all([first, second]);
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(r.closed && r.responseDisposed);
  assert.equal(r.ownedRouteCount, 0);
  assert(r.routes.every((x) => x.abortionSettled && !x.fulfillmentSettled));
  assert.equal(f.calls.filter((c) => c[0] === 'fetch').length, 1);
});

test('third request fails the cap without a second fetch and all three routes settle', async () => {
  const f = fixture({ requestPolicy: 'same-url-two-v2' });
  const first = f.owner.handle(f.route);
  await flush();
  const second = f.owner.handle({ ...f.route });
  await flush();
  const third = f.owner.handle({ ...f.route });
  await Promise.all([first, second, third]);
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert.equal(r.claimed, 3);
  assert.equal(r.routes.length, 2);
  assert(r.closed && r.responseDisposed);
  assert.equal(r.ownedRouteCount, 0);
  assert.equal(f.calls.filter((c) => c[0] === 'fetch').length, 1);
  assert.equal(f.calls.filter((c) => c[0] === 'abort').length, 3);
});

test('every joined request must be the same font GET with no range', async () => {
  for (const change of [
    { method: () => 'POST' },
    { resourceType: () => 'other' },
    { headers: () => ({ range: 'bytes=0-1' }) },
  ]) {
    const f = fixture({ requestPolicy: 'same-url-two-v2' });
    const first = f.owner.handle(f.route);
    await flush();
    const second = f.owner.handle({
      ...f.route,
      request: () => ({ ...f.route.request(), ...change }),
    });
    await Promise.all([first, second]);
    await f.owner.close();
    const r = f.owner.snapshot();
    assert.equal(r.status, 'failed');
    assert(r.closed && r.responseDisposed);
    assert.equal(f.calls.filter((c) => c[0] === 'fetch').length, 1);
    assert(!f.calls.some((c) => c[0] === 'fulfill'));
  }
});

test('a request arriving after forwarding starts fails rather than reopening the response lifetime', async () => {
  let release;
  const f = fixture({
    requestPolicy: 'same-url-two-v2',
    wait: 'fulfill',
    pending: new Promise((r) => (release = r)),
  });
  const first = f.owner.handle(f.route);
  await flush();
  f.owner.releaseAfterPublicCancellation();
  await flush();
  const second = f.owner.handle({ ...f.route });
  await second;
  await first;
  await f.owner.close();
  let r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert.equal(r.closed, false);
  assert(r.pendingOperations.includes('response-fulfill'));
  release();
  await flush();
  r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(r.closed);
  assert.equal(f.calls.filter((c) => c[0] === 'fetch').length, 1);
});

test('never-settling joined fulfillment remains owned after deadline even if its abort settles', async () => {
  let reject;
  const late = new Promise((_, r) => (reject = r));
  const f = fixture({ requestPolicy: 'same-url-two-v2' });
  const first = f.owner.handle(f.route);
  await flush();
  const second = f.owner.handle({ ...f.route, fulfill: async () => late });
  await flush();
  f.owner.releaseAfterPublicCancellation();
  await flush();
  await f.advance(62000);
  await Promise.all([first, second]);
  await f.owner.close();
  let r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert.equal(r.closed, false);
  assert(r.pendingOperations.includes('response-fulfill'));
  assert.equal(r.routes[0].fulfillmentSettled, true);
  assert.equal(r.routes[1].abortionSettled, true);
  reject(new Error('late joined native failure'));
  await flush();
  r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(r.closed && r.pendingOperations.length === 0);
  assert(r.timedOutOperations.length > 0);
});

test('expired joined deadline rejects every fulfillment before native invocation', async () => {
  const f = fixture({ requestPolicy: 'same-url-two-v2' });
  const first = f.owner.handle(f.route);
  await flush();
  const second = f.owner.handle({ ...f.route });
  await flush();
  f.jump(60001);
  f.owner.releaseAfterPublicCancellation();
  await Promise.all([first, second]);
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'failed');
  assert(!f.calls.some((c) => c[0] === 'fulfill'));
  assert.equal(r.ownedRouteCount, 0);
  assert(r.closed);
});

test('V2 assessment requires explicit mode, every admitted route settled and zero uncertainty', async () => {
  const f = fixture({ requestPolicy: 'same-url-two-v2' });
  const one = f.owner.handle(f.route);
  await flush();
  const two = f.owner.handle({ ...f.route });
  await flush();
  f.owner.releaseAfterPublicCancellation();
  await Promise.all([one, two]);
  await f.owner.close();
  const r = f.owner.snapshot();
  assert(assertSelectedFontTransport(r, 'same-url-two-v2'));
  assert.throws(() => assertSelectedFontTransport(r));
  for (const mutate of [
    (v) => {
      v.claimed = 3;
    },
    (v) => {
      v.claimed = 1;
    },
    (v) => {
      v.routes[1].fulfillmentSettled = false;
    },
    (v) => {
      v.routes[1].abortionSettled = true;
    },
    (v) => {
      v.routes[1].index = 0;
    },
    (v) => {
      v.ownedRouteCount = 1;
    },
    (v) => {
      v.rejectedOwned = 1;
    },
    (v) => {
      v.pendingOperations = ['response-fulfill'];
    },
    (v) => {
      v.timedOutOperations = ['response-fulfill'];
    },
    (v) => {
      v.records = v.records.filter((x) => x.kind !== 'same-original-request-joined');
    },
    (v) => {
      const j = v.records.splice(
        v.records.findIndex((x) => x.kind === 'same-original-request-joined'),
        1,
      );
      v.records.push(...j);
    },
  ]) {
    const changed = structuredClone(r);
    mutate(changed);
    assert.throws(() => assertSelectedFontTransport(changed, 'same-url-two-v2'));
  }
});

test('prospective stable pending route preserves the original deadlines, actions and public cancellation', async () => {
  const { validateQualification } = await import('./solo-qualification.mjs');
  const next = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-readiness-font/selected-font-cancel-joined-v2.qualification.fixture',
        import.meta.url,
      ),
    ),
  );
  const old = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-readiness-font/selected-font-cancel.qualification.fixture',
        import.meta.url,
      ),
    ),
  );
  validateQualification(next);
  assert.equal(next.timeoutMs, old.timeoutMs);
  assert.equal(next.actions.length, old.actions.length);
  assert.equal(next.actions[8].timeoutMs, 5000);
  assert.equal(next.actions[8].contains, undefined);
  assert.equal(
    next.actions[8].selector,
    'body:not([data-flight-state="running"]):not(:has(dialog[open])) #flight-preparation-status[data-state="busy"]',
  );
  assert.equal(next.actions[9].key, 'Escape');
  assert.deepEqual(next.actions.slice(9), old.actions.slice(9));
  const restored = structuredClone(next);
  restored.id = old.id;
  restored.actions[8] = old.actions[8];
  assert.deepEqual(restored, old);
});

test('second request between public cancellation and forwarding is accepted at the actual owner boundary', async () => {
  const f = fixture({ requestPolicy: 'same-url-two-v2' });
  const first = f.owner.handle(f.route);
  await flush();
  f.owner.releaseAfterPublicCancellation();
  // Same turn, before the release promise continuation starts native forwarding.
  const second = f.owner.handle({ ...f.route });
  await Promise.all([first, second]);
  await f.owner.close();
  const r = f.owner.snapshot();
  const kinds = r.records.map((x) => x.kind);
  assert(
    kinds.indexOf('declared-public-cancel-boundary') <
      kinds.indexOf('same-original-request-joined'),
  );
  assert(
    kinds.indexOf('same-original-request-joined') < kinds.indexOf('original-response-forwarded'),
  );
  assert(assertSelectedFontTransport(r, 'same-url-two-v2'));
  assert.equal(r.status, 'complete');
  assert.equal(r.ownedRouteCount, 0);
});

test('hidden completion is explicit and cannot borrow cancellation release or assessment', async () => {
  const legacy = fixture();
  assert.equal(legacy.owner.releaseAfterNativeHidden, undefined);
  assert.throws(() => fixture({ releaseBoundary: 'native-hidden' }), /joined ownership/);
  assert.throws(() => fixture({ releaseBoundary: 'invented' }));
  const f = fixture({ requestPolicy: 'same-url-two-v2', releaseBoundary: 'native-hidden' });
  assert.equal(f.owner.releaseAfterPublicCancellation, undefined);
  assert.throws(() => f.owner.releaseAfterNativeHidden(), /validated pending/);
  const first = f.owner.handle(f.route);
  await flush();
  const second = f.owner.handle({ ...f.route });
  await flush();
  await f.owner.waitUntilHeld();
  f.owner.releaseAfterNativeHidden();
  assert.throws(() => f.owner.releaseAfterNativeHidden(), /repeated release/);
  await Promise.all([first, second]);
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.releaseBoundary, 'native-hidden');
  assert(assertSelectedFontTransport(r, 'same-url-two-v2', 'native-hidden'));
  assert.throws(() => assertSelectedFontTransport(r, 'same-url-two-v2'));
  assert.deepEqual(
    f.calls.map((v) => v[0]),
    ['fetch', 'fulfill', 'fulfill', 'dispose'],
  );
  assert.equal(f.timers.size, 0);
  for (const mutate of [
    (v) => delete v.releaseBoundary,
    (v) =>
      (v.records.find((x) => x.kind === 'declared-native-hidden-boundary').kind =
        'declared-public-cancel-boundary'),
    (v) => (v.closed = false),
    (v) => v.pendingOperations.push('response-body'),
  ]) {
    const bad = structuredClone(r);
    mutate(bad);
    assert.throws(() => assertSelectedFontTransport(bad, 'same-url-two-v2', 'native-hidden'));
  }
});
test('hidden release retains the original deadline and prevents late delivery', async () => {
  const f = fixture({ requestPolicy: 'same-url-two-v2', releaseBoundary: 'native-hidden' });
  const first = f.owner.handle(f.route);
  await flush();
  await f.advance(selectedFont.maximumHoldMs);
  assert.throws(() => f.owner.releaseAfterNativeHidden(), /validated pending/);
  await first;
  await f.owner.close();
  assert.equal(f.owner.snapshot().status, 'failed');
  assert.equal(
    f.calls.some((v) => v[0] === 'fulfill'),
    false,
  );
  assert.equal(f.owner.snapshot().closed, true);
});
