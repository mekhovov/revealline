import assert from 'node:assert/strict';

/** Chromium-only controlled quota denial. Never use a real user profile/origin.
 * The caller owns the isolated browser and must abort its observation if this
 * helper returns completed:false; a deadline cannot cancel a CDP/UI promise.
 * This is not physical disk exhaustion, browser eviction or cross-browser proof.
 */
export function validateQuotaProbeOrigin(origin) {
  assert.equal(typeof origin, 'string', 'Quota probe requires an exact localhost origin.');
  const parsed = new URL(origin);
  assert(
    parsed.protocol === 'http:' &&
      parsed.hostname === '127.0.0.1' &&
      parsed.port &&
      !parsed.username &&
      !parsed.password &&
      parsed.origin === origin,
    'Quota probe requires an exact http://127.0.0.1:PORT origin, without path, credentials or query.',
  );
  return origin;
}

function snapshot(value) {
  assert(
    value &&
      typeof value.overrideActive === 'boolean' &&
      Number.isFinite(value.usage) &&
      value.usage >= 0 &&
      Number.isFinite(value.quota) &&
      value.quota >= 0,
    'CDP returned invalid quota evidence.',
  );
  return { usage: value.usage, quota: value.quota, overrideActive: value.overrideActive };
}

export async function withOptionalQuotaDeny({
  cdp,
  origin,
  run,
  timeoutMs = 45_000,
  commandTimeoutMs = 10_000,
}) {
  validateQuotaProbeOrigin(origin);
  assert(typeof cdp?.send === 'function' && typeof run === 'function');
  for (const [name, value, max] of [
    ['timeoutMs', timeoutMs, 120_000],
    ['commandTimeoutMs', commandTimeoutMs, 10_000],
  ])
    assert(Number.isInteger(value) && value > 0 && value <= max, `Invalid ${name}.`);
  const report = {
    format: 'OptionalQuotaDenial.v1',
    origin,
    completed: false,
    controlledOverride: true,
    nativeDiskExhaustion: false,
    exactCacheWriteExceptionProven: false,
    callbackCompleted: false,
    operations: [],
    cleanup: { attempted: false, completed: false },
    limitations: [
      'CDP quota override on one isolated loopback origin, not real disk exhaustion or eviction.',
      'The override affects the origin, not just one package. The caller must verify sibling packages and saved data.',
      'A generic installation failure does not prove Cache.put threw QuotaExceededError; registration can fail earlier.',
    ],
  };
  const abort = new AbortController();
  let overrideAttempted = false,
    overridePromise,
    overrideTimedOut = false;
  async function bounded(name, operation, milliseconds) {
    const row = { name, pending: true, timedOut: false };
    report.operations.push(row);
    let timer;
    const task = Promise.resolve()
      .then(operation)
      .finally(() => {
        row.pending = false;
      });
    try {
      return await Promise.race([
        task,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            row.timedOut = true;
            reject(new Error(`${name} timed out.`));
          }, milliseconds);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  const command = (name, args) => bounded(name, () => cdp.send(name, args), commandTimeoutMs);
  try {
    report.before = snapshot(await command('Storage.getUsageAndQuota', { origin }));
    assert.equal(
      report.before.overrideActive,
      false,
      'Refusing to replace a pre-existing quota override.',
    );
    overrideAttempted = true;
    overridePromise = Promise.resolve().then(() =>
      cdp.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: 0 }),
    );
    try {
      await bounded('apply-zero-quota', () => overridePromise, commandTimeoutMs);
    } catch (error) {
      overrideTimedOut = report.operations.at(-1).timedOut;
      throw error;
    }
    report.denied = snapshot(await command('Storage.getUsageAndQuota', { origin }));
    assert.equal(report.denied.overrideActive, true, 'Quota override did not become active.');
    assert.equal(report.denied.quota, 0, 'Quota override is not zero.');
    // Callback performs ordinary public UI operations and owns its domain
    // assertions. It must throw on unexpected success, changed saved data, etc.
    await bounded('ordinary-ui-denial-check', () => run({ signal: abort.signal }), timeoutMs);
    report.callbackCompleted = true;
  } catch (error) {
    abort.abort();
    report.failure = String(error?.message ?? error).slice(0, 2000);
  } finally {
    if (overrideAttempted) {
      report.cleanup.attempted = true;
      try {
        // Omitting quotaSize restores Chromium's default. Do not send null or
        // clearDataForOrigin, which has destructive and different semantics.
        await command('Storage.overrideQuotaForOrigin', { origin });
        report.after = snapshot(await command('Storage.getUsageAndQuota', { origin }));
        assert.equal(
          report.after.overrideActive,
          false,
          'Quota override remains active after cleanup.',
        );
        report.cleanup.completed = true;
      } catch (error) {
        report.cleanup.failure = String(error?.message ?? error).slice(0, 2000);
      }
      if (overrideTimedOut) {
        // An unanswered apply command can complete after the first reset.
        // Restore again on late settlement; the returned evidence remains
        // unverified, and the owner must close its isolated browser promptly.
        void overridePromise
          .then(
            () => cdp.send('Storage.overrideQuotaForOrigin', { origin }),
            () => cdp.send('Storage.overrideQuotaForOrigin', { origin }),
          )
          .catch(() => {});
      }
    } else report.cleanup.completed = true; // No override was attempted.
    if (report.operations.some((row) => row.pending || row.timedOut)) {
      report.cleanup.completed = false;
      report.cleanup.unverified = 'A timed-out or pending operation may still own browser work.';
    }
    report.completed = !report.failure && report.callbackCompleted && report.cleanup.completed;
  }
  // Late promises must not rewrite an already emitted receipt.
  return JSON.parse(JSON.stringify(report));
}
