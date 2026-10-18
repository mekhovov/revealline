import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { observeReadinessGpu, projectReadinessGpu } from './solo-readiness-gpu.mjs';

const response = () => ({
  gpu: {
    devices: [{ vendorId: 0, deviceId: 1, vendorString: 'vendor', deviceString: 'device' }],
    auxAttributes: { glRenderer: 'reported renderer' },
    featureStatus: { gpu_compositing: 'enabled' },
  },
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let index = 0; index < 24; index++) await Promise.resolve();
}
function harness(behavior = {}) {
  let time = 100,
    next = 0;
  const events = [],
    timers = new Map(),
    scheduled = [];
  const options = {
    clock: () => time,
    setTimer(callback, delay) {
      const id = ++next;
      timers.set(id, { callback, at: time + delay });
      scheduled.push(delay);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  };
  const session = {
    send(method) {
      events.push(`send:${method}`);
      return behavior.send ? behavior.send(method) : response();
    },
    detach() {
      events.push('detach');
      return behavior.detach?.();
    },
  };
  const browser = {
    newBrowserCDPSession() {
      events.push('create');
      return behavior.create ? behavior.create(session) : session;
    },
  };
  return {
    browser,
    session,
    options,
    events,
    scheduled,
    timers,
    setTime(value) {
      time = value;
    },
    async advance(milliseconds) {
      const target = time + milliseconds;
      await flush();
      for (;;) {
        const entry = [...timers]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        time = entry[1].at;
        timers.delete(entry[0]);
        entry[1].callback();
        await flush();
      }
      time = target;
      await flush();
    },
  };
}

test('the response projection reads only fixed allowlisted fields and bounds encoded bytes', () => {
  let forbiddenReads = 0;
  const huge = '\0😀'.repeat(20000),
    source = response();
  source.gpu.devices = Array.from({ length: 100 }, () => ({
    vendorId: 0xffffffff,
    deviceId: -1,
    vendorString: huge,
    deviceString: huge,
    driverVendor: huge,
    driverVersion: huge,
  }));
  source.gpu.auxAttributes = { glVendor: huge, glRenderer: huge, glVersion: huge };
  source.gpu.featureStatus = Object.fromEntries(
    [
      'gpu_compositing',
      'rasterization',
      'opengl',
      'webgl',
      'webgl2',
      'vulkan',
      'skia_graphite',
      'multiple_raster_threads',
    ].map((key) => [key, huge]),
  );
  for (const [object, key] of [
    [source, 'commandLine'],
    [source, 'modelName'],
    [source, 'modelVersion'],
    [source.gpu, 'driverBugWorkarounds'],
    [source.gpu.auxAttributes, 'secret'],
    [source.gpu, 'videoDecoding'],
  ])
    Object.defineProperty(object, key, {
      get() {
        forbiddenReads++;
        throw Error('private');
      },
    });
  const observed = projectReadinessGpu(source);
  assert.equal(forbiddenReads, 0);
  assert.equal(observed.deviceCount, 100);
  assert.equal(observed.omittedDevices, 96);
  assert.equal(observed.devices.length, 4);
  assert.equal(observed.devices[0].vendorId, 0xffffffff);
  assert.equal(observed.devices[0].deviceId, null);
  for (const row of observed.devices)
    for (const key of ['vendorString', 'deviceString', 'driverVendor', 'driverVersion']) {
      assert.equal(row[key].truncated, true);
      assert(Buffer.byteLength(JSON.stringify(row[key].value)) <= 256);
    }
  for (const item of Object.values(observed.attributes))
    assert(Buffer.byteLength(JSON.stringify(item.value)) <= 512);
  for (const item of Object.values(observed.features))
    assert(Buffer.byteLength(JSON.stringify(item.value)) <= 128);
  assert(Buffer.byteLength(JSON.stringify(observed)) < 16384 - 2048);
});

test('missing, hostile and nonstring fields stay explicit without coercion or nested serialization', () => {
  let coercions = 0;
  const dangerous = {
    toString() {
      coercions++;
      throw Error('coercion');
    },
    toJSON() {
      coercions++;
      throw Error('serialization');
    },
  };
  const source = response();
  source.gpu.devices[0].vendorString = dangerous;
  Object.defineProperty(source.gpu.devices[0], 'driverVersion', {
    get() {
      throw Error('getter unavailable');
    },
  });
  source.gpu.featureStatus.webgl = 0;
  const observed = projectReadinessGpu(source);
  assert.deepEqual(observed.devices[0].vendorString, {
    value: null,
    unavailable: true,
    truncated: false,
  });
  assert.deepEqual(observed.devices[0].driverVersion, observed.devices[0].vendorString);
  assert.equal(observed.features.webgl.unavailable, true);
  assert.equal(coercions, 0);
  assert.equal(projectReadinessGpu({ gpu: { devices: [] } }).deviceCount, 0);
  for (const invalid of [{}, { gpu: {} }, { gpu: { devices: {} } }])
    assert.throws(() => projectReadinessGpu(invalid), /devices unavailable/);
});

test('one browser-target request and acknowledged detach precede successful continuation', async () => {
  const h = harness(),
    report = await observeReadinessGpu(h.browser, 'chromium', h.options);
  assert.deepEqual(h.events, ['create', 'send:SystemInfo.getInfo', 'detach']);
  assert.equal(report.status, 'response-observed');
  assert.equal(report.canProceed, true);
  assert.equal(report.requestSettled, true);
  assert.equal(report.sessionDetached, true);
  assert.equal(report.gpu.attributes.glRenderer.value, 'reported renderer');
  assert(report.startedAtMs <= report.responseAtMs && report.responseAtMs <= report.detachedAtMs);
  assert.equal(h.timers.size, 0);
  assert(Buffer.byteLength(JSON.stringify(report)) <= 16384);
});

test('complete retained success and failure envelopes remain within the declared byte ceiling', async () => {
  const long = '\0😀'.repeat(20000);
  const many = response();
  many.gpu.devices = Array.from({ length: 500 }, () =>
    Object.fromEntries(
      ['vendorString', 'deviceString', 'driverVendor', 'driverVersion'].map((key) => [key, long]),
    ),
  );
  many.gpu.auxAttributes = { glVendor: long, glRenderer: long, glVersion: long };
  many.gpu.featureStatus = Object.fromEntries(
    [
      'gpu_compositing',
      'rasterization',
      'opengl',
      'webgl',
      'webgl2',
      'vulkan',
      'skia_graphite',
      'multiple_raster_threads',
    ].map((key) => [key, long]),
  );
  const largeFailure = { name: long, message: long };
  for (const behavior of [
    { send: () => many },
    {
      send: () => many,
      detach() {
        throw largeFailure;
      },
    },
    {
      send() {
        throw largeFailure;
      },
      detach() {
        throw largeFailure;
      },
    },
  ]) {
    const h = harness(behavior),
      report = await observeReadinessGpu(h.browser, 'chromium', h.options);
    assert(Buffer.byteLength(JSON.stringify(report)) <= 16384);
    assert.notEqual(report.byteOverflow, true, 'The fixed allowlist itself must fit');
    if (behavior.detach) {
      assert.equal(report.status, 'failed');
      assert.equal(report.canProceed, false);
      assert.equal(report.cleanupFailure.message.truncated, true);
    }
  }
});

test('WebKit and a missing Chromium API are explicitly unsupported without opening a session', async () => {
  const h = harness();
  for (const [browser, engine, reason] of [
    [h.browser, 'webkit', 'non-chromium-engine'],
    [{}, 'chromium', 'browser-session-api-unavailable'],
  ]) {
    const report = await observeReadinessGpu(browser, engine, h.options);
    assert.equal(report.status, 'unsupported');
    assert.equal(report.reason, reason);
    assert.equal(report.canProceed, true);
    assert.equal(report.requestSettled, false);
    assert.equal(report.sessionDetached, false);
  }
  assert.deepEqual(h.events, []);
  const invalid = await observeReadinessGpu({}, 'x'.repeat(20000), h.options);
  assert.equal(invalid.status, 'failed');
  assert.equal(invalid.engine, null);
  assert.equal(invalid.canProceed, false);
  assert(Buffer.byteLength(JSON.stringify(invalid)) <= 16384);
});

test('only settled known unsupported-method responses can continue after detach', async () => {
  for (const error of [
    { code: -32601 },
    Error("Protocol error (SystemInfo.getInfo): 'SystemInfo.getInfo' wasn't found"),
  ]) {
    const h = harness({
      send() {
        throw error;
      },
    });
    const report = await observeReadinessGpu(h.browser, 'chromium', h.options);
    assert.equal(report.status, 'unsupported');
    assert.equal(report.requestSettled, true);
    assert.equal(report.sessionDetached, true);
    assert.equal(report.canProceed, true);
  }
  let coerced = false;
  for (const error of [
    Error('Target closed'),
    {
      message: {
        toString() {
          coerced = true;
        },
      },
    },
    {
      get message() {
        throw Error('hostile');
      },
    },
  ]) {
    const h = harness({
      send() {
        throw error;
      },
    });
    const report = await observeReadinessGpu(h.browser, 'chromium', h.options);
    assert.equal(report.status, 'failed');
    assert.equal(report.canProceed, false);
    assert.equal(report.requestSettled, true);
    assert.equal(report.sessionDetached, true);
  }
  assert.equal(coerced, false);
});

test('creation and request share one deadline instead of renewing it after acquisition', async () => {
  const creation = deferred(),
    request = deferred();
  const h = harness({ create: () => creation.promise, send: () => request.promise });
  const pending = observeReadinessGpu(h.browser, 'chromium', h.options);
  await h.advance(4000);
  creation.resolve(h.session);
  await flush();
  assert.deepEqual(h.scheduled, [5000, 1000]);
  await h.advance(1000);
  const report = await pending;
  assert.equal(report.status, 'failed');
  assert.equal(report.requestTimedOut, true);
  assert.equal(report.completedAtMs, 5100);
  assert.equal(report.requestSettled, false);
  assert.equal(report.sessionDetached, true);
  assert.equal(report.canProceed, false);
  const frozen = JSON.stringify(report);
  request.resolve(response());
  await flush();
  assert.equal(JSON.stringify(report), frozen);
});

test('creation timeout fails before continuation and a later session gets one bounded cleanup', async () => {
  const creation = deferred(),
    cleanup = deferred();
  const h = harness({ create: () => creation.promise, detach: () => cleanup.promise });
  const pending = observeReadinessGpu(h.browser, 'chromium', h.options);
  await h.advance(5000);
  const report = await pending,
    frozen = JSON.stringify(report);
  assert.equal(report.creationTimedOut, true);
  assert.equal(report.lateSessionCleanupScheduled, true);
  assert.equal(report.canProceed, false);
  creation.resolve(h.session);
  await flush();
  assert.deepEqual(h.events, ['create', 'detach']);
  assert.equal(h.scheduled.at(-1), 2000);
  await h.advance(2000);
  cleanup.reject(Error('late cleanup failure'));
  await flush();
  assert.equal(JSON.stringify(report), frozen);
  assert.equal(h.timers.size, 0);
});

test('a request timeout cannot become supported success when detach settles the pending request', async () => {
  for (const settle of ['resolve', 'reject']) {
    const request = deferred();
    const h = harness({
      send: () => request.promise,
      detach() {
        request[settle](settle === 'resolve' ? response() : Error('Detached'));
      },
    });
    const pending = observeReadinessGpu(h.browser, 'chromium', h.options);
    await h.advance(5000);
    const report = await pending;
    assert.equal(report.requestTimedOut, true);
    assert.equal(report.requestSettled, true);
    assert.equal(report.sessionDetached, true);
    assert.equal(report.canProceed, false);
    assert.equal(report.status, 'failed');
  }
});

test('cleanup rejection or timeout fails within its independent fixed reserve', async () => {
  for (const mode of ['reject', 'timeout']) {
    const cleanup = deferred();
    const h = harness({
      detach: () => (mode === 'reject' ? Promise.reject(Error('detach failed')) : cleanup.promise),
    });
    const pending = observeReadinessGpu(h.browser, 'chromium', h.options);
    await flush();
    if (mode === 'timeout') await h.advance(2000);
    const report = await pending,
      frozen = JSON.stringify(report);
    assert.equal(report.status, 'failed');
    assert.equal(report.canProceed, false);
    assert.equal(report.requestSettled, true);
    assert.equal(report.sessionDetached, false);
    assert(report.cleanupFailure);
    assert(report.completedAtMs <= 2100);
    cleanup.resolve();
    await flush();
    assert.equal(JSON.stringify(report), frozen);
  }
});

test('late promise delivery cannot beat delayed timers and invalid clocks fail closed', async () => {
  const h = harness({
    send() {
      h.setTime(5101);
      return response();
    },
  });
  const late = await observeReadinessGpu(h.browser, 'chromium', h.options);
  assert.equal(late.requestTimedOut, true);
  assert.equal(late.canProceed, false);
  for (const value of [undefined, NaN, Infinity, -1]) {
    const failed = await observeReadinessGpu({}, 'webkit', { clock: () => value });
    assert.equal(failed.status, 'failed');
    assert.equal(failed.canProceed, false);
  }
  const backwards = harness({
    send() {
      backwards.setTime(99);
      return response();
    },
  });
  const failed = await observeReadinessGpu(backwards.browser, 'chromium', backwards.options);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.canProceed, false);
});

test('an immediate cleanup clock jump still handles the already submitted detach rejection', async (t) => {
  const unhandled = [],
    listener = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  t.after(() => process.off('unhandledRejection', listener));
  let reads = 0;
  const h = harness({
    detach() {
      throw Error('late detach rejection after clock jump');
    },
  });
  const report = await observeReadinessGpu(h.browser, 'chromium', {
    ...h.options,
    clock() {
      return ++reads >= 9 ? 9000 : 100;
    },
  });
  // The ninth read is wait's precheck, after the cleanup deadline and promise
  // are constructed. Let Node deliver any unhandled-rejection event as well.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.events, ['create', 'send:SystemInfo.getInfo', 'detach']);
  assert.equal(report.status, 'failed');
  assert.equal(report.canProceed, false);
  assert.equal(report.sessionDetached, false);
  assert.match(report.cleanupFailure.message.value, /deadline exceeded/);
  assert.deepEqual(unhandled, []);
});

test('invalid cleanup deadline never constructs an unowned rejecting detach promise', async (t) => {
  const unhandled = [],
    listener = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  t.after(() => process.off('unhandledRejection', listener));
  let reads = 0;
  const h = harness({
    detach() {
      throw Error('must not be constructed');
    },
  });
  const report = await observeReadinessGpu(h.browser, 'chromium', {
    ...h.options,
    clock() {
      return ++reads >= 8 ? NaN : 100;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.events, ['create', 'send:SystemInfo.getInfo']);
  assert.equal(report.status, 'failed');
  assert.equal(report.canProceed, false);
  assert.equal(report.sessionDetached, false);
  assert.match(report.cleanupFailure.message.value, /Invalid GPU setup clock/);
  assert.deepEqual(unhandled, []);
});

test('the actual qualifier guards the helper and saves settled setup before any calibration', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const marker =
    "  if (readinessOptions) {\n    const { observeReadinessGpu } = await import('./solo-readiness-gpu.mjs');";
  const start = source.indexOf(marker),
    end = source.indexOf('  if (cpu !== 1)', start);
  assert(start > 0 && end > start);
  assert(end < source.indexOf('report.externalCadenceCalibration ='));
  assert(end < source.indexOf('deadline = Date.now() + scenario.timeoutMs;'));
  const block = source
    .slice(start, end)
    .replace("import('./solo-readiness-gpu.mjs')", 'loadHelper()');
  for (const [enabled, mode] of [
    [false, 'success'],
    [true, 'success'],
    [true, 'unsupported'],
    [true, 'failed'],
  ]) {
    const events = [],
      report = { environment: {} };
    const result = { canProceed: mode !== 'failed', status: mode };
    const run = runInNewContext('(async () => {\n' + block + '\ncalibrate(); })', {
      readinessOptions: enabled ? {} : null,
      browser: {},
      engine: mode === 'unsupported' ? 'webkit' : 'chromium',
      report,
      assert,
      async loadHelper() {
        events.push('load');
        return {
          async observeReadinessGpu() {
            events.push('observe-settled');
            return result;
          },
        };
      },
      async save() {
        events.push('save');
        assert.equal(report.environment.graphicsCapability, result);
      },
      calibrate() {
        events.push('calibrate');
      },
    });
    if (mode === 'failed') await assert.rejects(run(), /calibration not started/);
    else await run();
    assert.deepEqual(
      events,
      !enabled
        ? ['calibrate']
        : mode === 'failed'
          ? ['load', 'observe-settled', 'save']
          : ['load', 'observe-settled', 'save', 'calibrate'],
    );
    if (!enabled) assert.deepEqual(report, { environment: {} });
  }
});
