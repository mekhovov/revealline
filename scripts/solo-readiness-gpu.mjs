// Setup capability witness only; never a hardware/acceleration or timing verdict.
const MAX_BYTES = 16384;
const field = (object, key) => {
  try {
    return object?.[key];
  } catch {
    return undefined;
  }
};
function text(value, maximum) {
  if (typeof value !== 'string') return { value: null, unavailable: true, truncated: false };
  let low = 0,
    high = Math.min(value.length, maximum);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(JSON.stringify(value.slice(0, middle))) <= maximum) low = middle;
    else high = middle - 1;
  }
  return { value: value.slice(0, low), unavailable: false, truncated: low < value.length };
}
const strings = (object, names, maximum) =>
  Object.fromEntries(names.map((name) => [name, text(field(object, name), maximum)]));
const number = (value) =>
  Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
export function projectReadinessGpu(response) {
  const gpu = field(response, 'gpu'),
    devices = field(gpu, 'devices');
  if (!Array.isArray(devices)) throw new Error('GPU response devices unavailable');
  const length = field(devices, 'length');
  if (!Number.isSafeInteger(length) || length < 0) throw new Error('Invalid GPU device count');
  const result = {
    deviceCount: length,
    omittedDevices: Math.max(0, length - 4),
    devices: Array.from({ length: Math.min(4, length) }, (_, i) => {
      const device = field(devices, i);
      return {
        vendorId: number(field(device, 'vendorId')),
        deviceId: number(field(device, 'deviceId')),
        ...strings(device, ['vendorString', 'deviceString', 'driverVendor', 'driverVersion'], 256),
      };
    }),
    attributes: strings(field(gpu, 'auxAttributes'), ['glVendor', 'glRenderer', 'glVersion'], 512),
    features: strings(
      field(gpu, 'featureStatus'),
      [
        'gpu_compositing',
        'rasterization',
        'opengl',
        'webgl',
        'webgl2',
        'vulkan',
        'skia_graphite',
        'multiple_raster_threads',
      ],
      128,
    ),
  };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_BYTES - 2048)
    throw new Error('GPU projection exceeds byte bound');
  return result;
}
function errorFields(error) {
  return strings(error, ['name', 'message'], 512);
}
function unsupported(error) {
  const message = field(error, 'message');
  return (
    field(error, 'code') === -32601 ||
    (typeof message === 'string' &&
      /^Protocol error \(SystemInfo\.getInfo\): ['"]?SystemInfo\.getInfo['"]? (?:wasn't found|is not supported)\.?$/.test(
        message,
      ))
  );
}
class DeadlineError extends Error {}

/** One browser-target request before calibration. Racing a timeout never
 * permits measurement: late work stays under the existing browser owner. */
export async function observeReadinessGpu(
  browser,
  engine,
  { clock = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {},
) {
  let previous = -1;
  const now = () => {
    const value = clock();
    if (!Number.isFinite(value) || value < 0 || value < previous)
      throw new Error('Invalid GPU setup clock');
    previous = value;
    return value;
  };
  const report = {
    format: 'SoloReadinessGpuCapabilityV1',
    engine: ['chromium', 'webkit'].includes(engine) ? engine : null,
    status: 'not-started',
    stage: 'admission',
    canProceed: false,
    requestBudgetMs: 5000,
    cleanupBudgetMs: 2000,
    maximumBytes: MAX_BYTES,
    startedAtMs: null,
    requestSettled: false,
    sessionDetached: false,
    scope:
      'Browser-reported setup fields only; no GPU utilization, hardware acceleration, presentation or physical-device conclusion.',
  };
  const wait = async (promise, deadline) => {
    const pending = Promise.resolve(promise);
    // If the clock/deadline precheck throws, the supplied operation still owns
    // its eventual rejection. The raced promise below retains normal failures.
    pending.catch(() => {});
    let timer;
    try {
      const remaining = deadline - now();
      if (remaining <= 0) throw new DeadlineError('GPU setup deadline exceeded');
      const result = await Promise.race([
        pending,
        new Promise((_, reject) => {
          timer = setTimer(
            () => reject(new DeadlineError('GPU setup deadline exceeded')),
            remaining,
          );
        }),
      ]);
      // A delayed event-loop timer is not evidence that the operation settled
      // within its bound. Check the monotonic clock after promise delivery too.
      if (now() > deadline) throw new DeadlineError('GPU setup deadline exceeded');
      return result;
    } finally {
      clearTimer(timer);
    }
  };
  const finish = () => {
    try {
      report.completedAtMs = now();
    } catch (error) {
      report.status = 'failed';
      report.canProceed = false;
      report.failure = errorFields(error);
    }
    if (Buffer.byteLength(JSON.stringify(report)) > MAX_BYTES) {
      delete report.gpu;
      report.status = 'failed';
      report.canProceed = false;
      report.byteOverflow = true;
    }
    return report;
  };
  let session,
    created,
    requestSettled = false;
  try {
    report.startedAtMs = now();
    if (!['chromium', 'webkit'].includes(engine)) throw new Error('Unknown GPU witness engine');
    if (engine === 'webkit' || typeof browser?.newBrowserCDPSession !== 'function') {
      report.status = 'unsupported';
      report.reason =
        engine === 'webkit' ? 'non-chromium-engine' : 'browser-session-api-unavailable';
      report.canProceed = true;
      return finish();
    }
    const deadline = report.startedAtMs + 5000;
    report.stage = 'create-session';
    created = Promise.resolve().then(() => browser.newBrowserCDPSession());
    session = await wait(created, deadline);
    report.sessionCreatedAtMs = now();
    report.stage = 'get-info';
    const request = Promise.resolve().then(() => session.send('SystemInfo.getInfo'));
    // Handle both outcomes even if the bounded wait expires; never mutate the
    // returned report from these late delivery handlers.
    request.then(
      () => {
        requestSettled = true;
      },
      () => {
        requestSettled = true;
      },
    );
    try {
      const response = await wait(request, deadline);
      report.responseAtMs = now();
      report.gpu = projectReadinessGpu(response);
      report.status = 'response-observed';
    } catch (error) {
      report.status = unsupported(error) ? 'unsupported' : 'failed';
      report.failureStage = 'get-info';
      report.failure = errorFields(error);
      report.requestTimedOut = error instanceof DeadlineError;
    }
  } catch (error) {
    report.status = 'failed';
    report.failure = errorFields(error);
    report.failureStage = report.stage;
    report.creationTimedOut = error instanceof DeadlineError;
    if (created && !session) {
      report.lateSessionCleanupScheduled = true;
      // A late-created session cannot grant continuation. Cleanup is handled and
      // bounded, with the existing outer browser owner still authoritative.
      created.then(
        async (late) => {
          try {
            const cleanupDeadline = now() + 2000;
            await wait(
              Promise.resolve().then(() => late.detach()),
              cleanupDeadline,
            );
          } catch {
            /* Row already failed. */
          }
        },
        () => {},
      );
    }
  } finally {
    if (session) {
      report.stage = 'detach-session';
      try {
        const cleanupDeadline = now() + 2000;
        await wait(
          Promise.resolve().then(() => session.detach()),
          cleanupDeadline,
        );
        report.sessionDetached = true;
        report.detachedAtMs = now();
      } catch (error) {
        report.status = 'failed';
        report.cleanupFailure = errorFields(error);
      }
    }
  }
  report.requestSettled = requestSettled;
  report.canProceed =
    ['response-observed', 'unsupported'].includes(report.status) &&
    requestSettled &&
    report.sessionDetached &&
    !report.requestTimedOut;
  return finish();
}
