import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'acorn';
import { bindCpuProfileJob } from './solo-remote-cpu-profile.mjs';
import {
  createQualificationFrameTrace,
  qualificationFrameTraceOptions,
  inspectFrameTrace,
  FRAME_TRACE_CATEGORIES,
  FRAME_TRACE_LIMITS,
} from './solo-qualification-cpu-profile.mjs';
import './test-solo-qualification-cpu-profile.mjs';
const recipe = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-remote-timing/warm-first30.qualification.fixture',
    import.meta.url,
  ),
);
const flags = ['--frame-trace=warm-first3-v1', '--work-probe', '--cadence=settled120'];
const names = [
  'solo-frame-trace-before-public-start-v1',
  'solo-frame-trace-after-safe-border-direction-3-v1',
];
const anchor = (name, index) => ({
  name,
  before: index * 3000 + 10,
  startTime: index * 3000 + 10.1,
  after: index * 3000 + 10.2,
  timeOrigin: 1000000,
  phase: index ? 'running' : 'ready',
  cdpRequestElapsedMs: 1,
});
const trace = (
  events = names.map((name, index) => ({
    name,
    cat: 'blink.user_timing',
    ts: index * 3000000 + 10100,
    pid: 42,
    tid: 43,
  })),
) => Buffer.from(JSON.stringify({ traceEvents: events }));
async function setup(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'solo-frame-trace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cdp = new EventEmitter(),
    calls = [];
  let mark = 0,
    read = 0;
  cdp.detach = async () => {
    calls.push(['detach']);
    if (options.detachError) throw new Error('detach failure');
  };
  cdp.send = async (method, params) => {
    calls.push([method, params]);
    if (options.failure === method) throw new Error('unsupported ' + method);
    if (method === 'Tracing.getCategories')
      return { categories: options.categories ?? [...FRAME_TRACE_CATEGORIES] };
    if (method === 'Tracing.start') {
      options.onStart?.();
      if (options.startBarrier) await options.startBarrier;
      return {};
    }
    if (method === 'Runtime.evaluate') {
      const index = mark++;
      if (index === 1 && options.endBarrier) await options.endBarrier;
      return { result: { value: anchor(names[index], index) } };
    }
    if (method === 'Tracing.end') {
      const complete = () =>
        cdp.emit('Tracing.tracingComplete', {
          stream: 'owned-stream',
          dataLossOccurred: options.loss ?? false,
          traceFormat: 'json',
          streamCompression: 'none',
        });
      options.onEnd?.();
      if (options.rejectEndLate) {
        setImmediate(complete);
        throw new Error('end rejected');
      }
      if (!options.noCompletion) complete();
      if (options.endCommandBarrier) await options.endCommandBarrier;
      return {};
    }
    if (method === 'IO.read') {
      if (options.parts) return options.parts[read++];
      return {
        data: (options.bytes ?? trace()).toString(options.base64 ? 'base64' : 'utf8'),
        base64Encoded: options.base64,
        eof: true,
      };
    }
    if (method === 'IO.close') {
      if (options.closeError) throw new Error('close failure');
      return {};
    }
    return {};
  };
  const file = join(root, 'trace.json');
  const owner = createQualificationFrameTrace(cdp, {
    protocol: options.protocol,
    file,
    remainingMs: options.remainingMs ?? (() => 360000),
    onLimit: async (reason) => {
      calls.push(['owned-browser-close', reason]);
    },
  });
  return { cdp, calls, file, owner };
}
const end = async (x) => {
  x.owner.afterDirectionThree();
  return x.owner.finish();
};

test('the exact warm trace opt-in preserves ordinary defaults and refuses substitutions', () => {
  assert.equal(qualificationFrameTraceOptions([], 'webkit', Buffer.from('not this recipe')), null);
  assert.equal(
    qualificationFrameTraceOptions(flags, 'chromium', recipe).protocol,
    'warm-first3-v1',
  );
  for (const value of [
    flags.concat('--cpu-profile'),
    flags.concat('--memory-profile'),
    flags.concat('--audio-proof'),
    flags.concat('--frame-trace=warm-first3-v1'),
    ['--frame-trace'],
    flags.filter((x) => x !== '--work-probe'),
    flags.filter((x) => x !== '--cadence=settled120'),
    flags.concat('--fixture-access'),
    flags.concat('--public-url=https://example.test/'),
  ])
    assert.throws(() => qualificationFrameTraceOptions(value, 'chromium', recipe));
  assert.throws(() => qualificationFrameTraceOptions(flags, 'webkit', recipe));
  assert.throws(() =>
    qualificationFrameTraceOptions(flags, 'chromium', Buffer.concat([recipe, Buffer.from(' ')])),
  );
});

test('actual recorder requests only fixed bounded categories and exports at finalization', async (t) => {
  const x = await setup(t);
  await x.owner.start();
  assert.deepEqual(x.calls.find(([name]) => name === 'Tracing.start')[1], {
    transferMode: 'ReturnAsStream',
    streamFormat: 'json',
    streamCompression: 'none',
    bufferUsageReportingInterval: 1000,
    traceConfig: {
      recordMode: 'recordUntilFull',
      traceBufferSizeInKb: 8192,
      enableSampling: false,
      enableSystrace: false,
      includedCategories: [...FRAME_TRACE_CATEGORIES],
      excludedCategories: ['*'],
    },
  });
  assert.equal(x.owner.afterDirectionThree(), undefined);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(x.calls.filter(([name]) => name === 'Tracing.end').length, 1);
  assert(!x.calls.some(([name]) => name === 'IO.read'));
  const report = await x.owner.finish();
  assert.equal(report.status, 'retained');
  assert.equal(report.cdpDetached, true);
  assert.equal(report.backend.applicationRenderer, 'unobserved');
  assert.equal(report.backend.hardwareGraphics, 'unobserved');
  assert.match(report.backend.reason, /No graphics context/);
  assert.deepEqual(await readFile(x.file), trace());
  assert.deepEqual(x.calls.find(([name]) => name === 'IO.read')[1], {
    handle: 'owned-stream',
    size: 65536,
  });
  assert(!x.calls.some(([name]) => name.startsWith('Profiler.')));
  assert.equal(report.inspection.anchors.end.browserMs, 3010.1);
  assert.equal(await x.owner.finish(), report);
  assert.equal(x.calls.filter(([name]) => name === 'IO.close').length, 1);
  assert.equal(x.calls.filter(([name]) => name === 'detach').length, 1);
});

test('end anchor has no awaited action-loop gap and stop follows its actual completion', async (t) => {
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const x = await setup(t, { endBarrier: barrier });
  await x.owner.start();
  assert.equal(x.owner.afterDirectionThree(), undefined);
  assert(!x.calls.some(([name]) => name === 'Tracing.end'));
  release();
  const report = await x.owner.finish();
  assert.equal(report.status, 'retained');
  const endIndex = x.calls.findIndex(([name]) => name === 'Tracing.end');
  assert.equal(
    x.calls.slice(0, endIndex).filter(([name]) => name === 'Runtime.evaluate').length,
    2,
  );
});

test('missing categories and unsupported commands fail without fallback', async (t) => {
  const x = await setup(t, { categories: FRAME_TRACE_CATEGORIES.slice(1) });
  await assert.rejects(x.owner.start(), /Required trace category/);
  await x.owner.finish();
  assert(!x.calls.some(([name]) => name === 'Tracing.start'));
  const y = await setup(t, { failure: 'Tracing.start' });
  await assert.rejects(y.owner.start(), /unsupported/);
  await y.owner.finish();
  assert.equal(y.calls.filter(([name]) => name === 'Tracing.start').length, 1);
});

test('missing, duplicated and reordered anchors cannot admit a truncated trace', () => {
  const anchors = { start: anchor(names[0], 0), end: anchor(names[1], 1) };
  const good = JSON.parse(trace());
  for (const events of [
    good.traceEvents.slice(0, 1),
    good.traceEvents.concat(good.traceEvents[1]),
    [good.traceEvents[0], { ...good.traceEvents[1], ts: 0 }],
    [good.traceEvents[0], { ...good.traceEvents[1], pid: 99 }],
    [good.traceEvents[0], { ...good.traceEvents[1], cat: 'other' }],
  ])
    assert.throws(() => inspectFrameTrace(trace(events), anchors));
  assert.throws(() => inspectFrameTrace(Buffer.from('{'), anchors));
  assert.throws(() =>
    inspectFrameTrace(trace(), { ...anchors, end: { ...anchors.end, timeOrigin: 0 } }),
  );
});

test('recordUntilFull absence of the end mark is incomplete even with no loss or usage signal', async (t) => {
  const x = await setup(t, { bytes: trace(JSON.parse(trace()).traceEvents.slice(0, 1)) });
  await x.owner.start();
  const report = await end(x);
  assert.equal(report.status, 'incomplete');
  assert.match(report.failure, /end anchor/);
  assert.equal(report.dataLossOccurred, false);
  assert.equal(report.maximumBufferUsage, undefined);
  assert((await readFile(x.file)).length > 0);
});

test('browser loss or a full buffer remains incomplete with complete marker bytes', async (t) => {
  for (const loss of [true, false]) {
    const x = await setup(t, { loss });
    await x.owner.start();
    if (!loss) x.cdp.emit('Tracing.bufferUsage', { percentFull: 1 });
    const report = await end(x);
    assert.equal(report.status, 'incomplete');
    assert((await readFile(x.file)).length > 0);
  }
});

test('base64 stream is retained exactly and cleanup failure never reports complete', async (t) => {
  const x = await setup(t, { base64: true });
  await x.owner.start();
  assert.equal((await end(x)).status, 'retained');
  assert.deepEqual(await readFile(x.file), trace());
  for (const options of [{ closeError: true }, { detachError: true }]) {
    const y = await setup(t, options);
    await y.owner.start();
    assert.equal((await end(y)).status, 'incomplete');
    assert.deepEqual(await readFile(y.file), trace());
  }
});

test('malformed, empty nonfinal and oversized chunks fail closed with one cleanup', async (t) => {
  for (const part of [
    { data: '', eof: false },
    { data: '!', base64Encoded: true, eof: true },
    { data: 'x'.repeat(65537), eof: true },
    { data: '{}', eof: 'true' },
  ]) {
    const x = await setup(t, { parts: [part] });
    await x.owner.start();
    assert.equal((await end(x)).status, 'incomplete');
    assert.equal(x.calls.filter(([name]) => name === 'IO.close').length, 1);
  }
});

test('scenario failure retains a trace prefix without inventing an end anchor', async (t) => {
  const x = await setup(t);
  await x.owner.start();
  const report = await x.owner.finish('scenario-failure');
  assert.equal(report.status, 'incomplete');
  assert.equal(report.stopReason, 'scenario-failure');
  assert.equal(report.anchors.end, undefined);
  assert((await readFile(x.file)).length > 0);
});

test('expired read budget still attempts bounded stream closure and detach', async (t) => {
  let time = 360000;
  const x = await setup(t, { remainingMs: () => time });
  await x.owner.start();
  x.owner.afterDirectionThree();
  await new Promise((resolve) => setImmediate(resolve));
  time = 0;
  const report = await x.owner.finish();
  assert.equal(report.status, 'incomplete');
  assert.equal(report.streamClosed, true);
  assert.equal(report.cdpDetached, true);
});

test('existing evidence is not overwritten', async (t) => {
  const x = await setup(t);
  await writeFile(x.file, 'old');
  await assert.rejects(x.owner.start(), /overwrite/);
  await x.owner.finish();
  assert.equal(await readFile(x.file, 'utf8'), 'old');
  assert(!x.calls.some(([name]) => name === 'Tracing.start'));
});

test('actual qualifier hooks retain action order, fixed recipe and diagnostic exclusion', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const visits = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.object?.name === 'frameRecorder')
      visits.push(node);
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
  };
  walk(ast);
  assert.deepEqual(
    visits.map((node) => node.callee.property.name),
    ['start', 'afterDirectionThree', 'finish'],
  );
  assert(source.includes("if (frameRecorder && path === '3')"));
  assert(
    source.includes("if (frameRecorder && path === '7') frameRecorder.afterDirectionThree();"),
  );
  assert(!source.includes('await frameRecorder.afterDirectionThree'));
  assert(
    source.indexOf('await frameRecorder.start()') < source.indexOf("if (action.type === 'repeat')"),
  );
  assert(
    source.indexOf('frameRecorder.afterDirectionThree()') <
      source.indexOf("if (record.status === 'running')"),
  );
  assert(source.includes("'excluded-browser-frame-tracing'"));
  const actions = JSON.parse(recipe).actions;
  assert.deepEqual(actions[3], { type: 'click', selector: '#shell-featured', timeoutMs: 60000 });
  assert.equal(actions[7].label, 'safe-border-direction-3');
  assert.equal(actions[8].label, 'safe-border-direction-4');
  assert.equal(FRAME_TRACE_LIMITS.maximumMs, 30000);
  assert.equal(FRAME_TRACE_LIMITS.maximumBytes, 64 * 1024 ** 2);
  assert.equal(FRAME_TRACE_LIMITS.maximumReads, 1025);
});

test('held exact-source declaration cannot enter native CPU owner without reviewed first-eight proof', async () => {
  const plan = JSON.parse(
    await readFile(
      new URL('../docs/performance/solo-browser-frame-trace-warm-plan.json', import.meta.url),
    ),
  );
  assert(plan.status.startsWith('held-'));
  assert.equal(plan.candidate.revision, '9d5139b9983c700a6a708f65f379fa4d5a8b0395');
  assert.equal(plan.release.firstEightEvidence, null);
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.throws(() => bindCpuProfileJob(plan));
  assert.equal(plan.scenarioTimeoutMs, 360000);
  assert.equal(plan.diagnostic.executionBounds.rowSeconds, 480);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
});

test('stream read and byte caps retain only the admitted prefix', async (t) => {
  for (const byteCap of [false, true]) {
    const part = { data: byteCap ? 'x'.repeat(65536) : 'x', eof: false };
    const parts = Array.from({ length: 1026 }, () => part);
    const x = await setup(t, { parts });
    await x.owner.start();
    const report = await end(x);
    assert.equal(report.status, 'incomplete');
    assert.match(report.failure, byteCap ? /64 MiB evidence bound/ : /read count exceeded/);
    assert.equal(report.bytes, byteCap ? 64 * 1024 ** 2 : 1025);
    assert.equal(report.streamClosed, true);
    assert.equal(report.cdpDetached, true);
  }
});

function controlledTimers(t) {
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (fn, ms) => {
    const value = { fn, ms, active: true, unref() {} };
    timers.push(value);
    return value;
  });
  t.mock.method(globalThis, 'clearTimeout', (value) => {
    if (value) value.active = false;
  });
  return timers;
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test('watchdog is armed at start request and not reset by a delayed acknowledgement', async (t) => {
  const timers = controlledTimers(t),
    called = deferred(),
    accepted = deferred();
  const x = await setup(t, {
    startBarrier: accepted.promise,
    onStart: () => {
      assert(timers.some((timer) => timer.active && timer.ms === 30000));
      called.resolve();
    },
  });
  const starting = x.owner.start();
  await called.promise;
  assert.equal(timers.filter((timer) => timer.ms === 30000).length, 1);
  accepted.resolve();
  await starting;
  assert.equal(timers.filter((timer) => timer.ms === 30000).length, 1);
  const watchdog = timers.find((timer) => timer.ms === 30000);
  watchdog.fn();
  const report = await x.owner.finish();
  assert.equal(report.limitReached, true);
  assert.equal(report.status, 'incomplete');
  assert.equal(x.calls.filter(([name]) => name === 'owned-browser-close').length, 1);
});

test('timed-out start remains incomplete when a late start acknowledgement arrives', async (t) => {
  const timers = controlledTimers(t),
    called = deferred(),
    accepted = deferred();
  const x = await setup(t, { startBarrier: accepted.promise, onStart: called.resolve });
  const starting = x.owner.start();
  const rejected = assert.rejects(starting, /Tracing.start exceeded/);
  await called.promise;
  timers.find((timer) => timer.active && timer.ms === 10000).fn();
  await rejected;
  accepted.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  const report = await x.owner.finish();
  assert.equal(report.startOutcomeUnknown, true);
  assert.equal(report.startAcknowledged, true);
  assert.equal(report.status, 'incomplete');
  assert(report.ownerClosureRequested);
  assert.equal(x.calls.filter(([name]) => name === 'owned-browser-close').length, 1);
  assert.match(report.cleanupAuthority, /after CDP detach/);
});

test('rejected end with later valid completion retains and closes its known stream', async (t) => {
  const x = await setup(t, { rejectEndLate: true });
  await x.owner.start();
  const report = await end(x);
  assert.equal(report.status, 'incomplete');
  assert.match(report.failure, /end rejected/);
  assert.equal(report.streamClosed, true);
  assert.deepEqual(await readFile(x.file), trace());
});

test('timed-out end cannot lose an already delivered stream handle', async (t) => {
  const timers = controlledTimers(t),
    called = deferred(),
    accepted = deferred();
  const x = await setup(t, { endCommandBarrier: accepted.promise, onEnd: called.resolve });
  await x.owner.start();
  x.owner.afterDirectionThree();
  const finishing = x.owner.finish();
  await called.promise;
  timers.find((timer) => timer.active && timer.ms === 10000).fn();
  const report = await finishing;
  accepted.resolve();
  assert.equal(report.status, 'incomplete');
  assert.equal(report.streamClosed, true);
  assert.deepEqual(await readFile(x.file), trace());
});

test('completion still unknown at detach requires browser closure without a universal closed claim', async (t) => {
  const timers = controlledTimers(t),
    called = deferred();
  const x = await setup(t, { noCompletion: true, onEnd: called.resolve });
  await x.owner.start();
  x.owner.afterDirectionThree();
  const finishing = x.owner.finish();
  await called.promise;
  await new Promise((resolve) => setImmediate(resolve));
  timers.find((timer) => timer.active && timer.ms === 10000).fn();
  const report = await finishing;
  x.cdp.emit('Tracing.tracingComplete', { stream: 'too-late', dataLossOccurred: false });
  assert.equal(report.status, 'incomplete');
  assert.equal(report.completionUnconfirmed, true);
  assert.equal(report.streamClosed, undefined);
  assert(report.ownerClosureRequested);
  assert.match(report.cleanupAuthority, /row-owned browser/);
});

test('actual pre-Start hook subtracts trace setup from the original public click deadline', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  let hook;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'IfStatement' &&
      source.slice(node.test.start, node.test.end) === "frameRecorder && path === '3'"
    )
      hook = source.slice(node.start, node.end);
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
  };
  walk(ast);
  assert(hook);
  const run = new Function(
    'frameRecorder',
    'path',
    'report',
    'remaining',
    'Date',
    'assert',
    'return (async () => { let timeout = 60000; const action = { timeoutMs: 60000 }; ' +
      hook +
      '; return timeout; })();',
  );
  for (const elapsed of [5000, 60001]) {
    let now = 100;
    const report = { frameTrace: {} };
    const pending = run(
      {
        start: async () => {
          now += elapsed;
        },
      },
      '3',
      report,
      () => 60000,
      { now: () => now },
      assert,
    );
    if (elapsed < 60000) {
      assert.equal(await pending, 55000);
      assert.equal(report.frameTrace.preStartSetupMs, elapsed);
    } else await assert.rejects(pending, /original public Start deadline/);
  }
});

// Shared modeled CDP fixtures; importing this module still runs every original owner control.
export {
  setup as setupFrameTraceFixture,
  end as finishFrameTraceFixture,
  trace as frameTraceBytes,
  names as frameTraceNames,
  anchor as frameTraceAnchor,
};
