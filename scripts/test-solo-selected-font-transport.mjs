import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createSelectedFontHold, selectedFont } from './solo-qualification-readiness.mjs';
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
