import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateQuotaProbeOrigin,
  withOptionalQuotaDeny,
  QUOTA_PROBE_HEADROOM_BYTES,
} from './optional-installation-quota-probe.mjs';

const origin = 'http://127.0.0.1:12345';
function fixture({
  active = false,
  failApply = false,
  failReset = false,
  pretend = false,
  usage = 1000,
} = {}) {
  const calls = [];
  let appliedQuota = 2024;
  return {
    calls,
    send: async (method, args) => {
      calls.push({ method, args });
      if (method === 'Storage.getUsageAndQuota')
        return { usage, quota: active ? appliedQuota : 10000, overrideActive: active };
      if (Object.hasOwn(args, 'quotaSize')) {
        if (failApply) throw new Error('CDP unsupported');
        if (!pretend) {
          active = true;
          appliedQuota = args.quotaSize;
        }
      } else {
        if (failReset) throw new Error('Reset unavailable');
        active = false;
      }
    },
  };
}

test('only exact explicit-port IPv4 loopback HTTP origins are eligible', () => {
  assert.equal(validateQuotaProbeOrigin(origin), origin);
  for (const value of [
    'https://127.0.0.1:12345',
    'http://localhost:12345',
    'http://127.0.0.1',
    'http://127.0.0.1:80',
    origin + '/',
    origin + '/practice',
    origin + '?x=1',
    origin + '#x',
    'http://user:password@127.0.0.1:12345',
    'http://example.com:12345',
    'http://127.1:12345',
  ])
    assert.throws(() => validateQuotaProbeOrigin(value));
});

test('verified measured usage plus positive headroom surrounds callback and reset omits quotaSize', async () => {
  const cdp = fixture();
  let calls = 0;
  const report = await withOptionalQuotaDeny({
    cdp,
    origin,
    run: async ({ signal }) => {
      calls++;
      assert.equal(signal.aborted, false);
    },
  });
  assert.equal(calls, 1);
  assert.equal(report.completed, true);
  assert.equal(report.format, 'OptionalQuotaDenial.v2');
  assert.equal(report.headroomBytes, QUOTA_PROBE_HEADROOM_BYTES);
  assert.equal(report.requestedQuotaBytes, 2024);
  assert.equal(report.denied.quota, 2024);
  assert.equal(report.after.overrideActive, false);
  assert.deepEqual(
    cdp.calls
      .filter((row) => row.method === 'Storage.overrideQuotaForOrigin')
      .map((row) => row.args),
    [{ origin, quotaSize: 2024 }, { origin }],
  );
  assert.equal(report.nativeDiskExhaustion, false);
  assert.equal(report.exactCacheWriteExceptionProven, false);
});

test('callback failure is retained and override still reset', async () => {
  const report = await withOptionalQuotaDeny({
    cdp: fixture(),
    origin,
    run: async () => {
      throw new Error('Pointers changed');
    },
  });
  assert.equal(report.completed, false);
  assert.equal(report.cleanup.completed, true);
  assert.match(report.failure, /Pointers changed/);
});

test('unsupported or ineffective override never executes callback but attempts reset', async () => {
  for (const options of [{ failApply: true }, { pretend: true }]) {
    const cdp = fixture(options);
    let ran = false;
    const report = await withOptionalQuotaDeny({
      cdp,
      origin,
      run: async () => {
        ran = true;
      },
    });
    assert.equal(ran, false);
    assert.equal(report.completed, false);
    assert.equal(report.cleanup.attempted, true);
    assert.equal(report.cleanup.completed, true);
  }
});

test('existing override is not replaced or cleared', async () => {
  const cdp = fixture({ active: true });
  const report = await withOptionalQuotaDeny({
    cdp,
    origin,
    run: async () => assert.fail('must not run'),
  });
  assert.equal(report.completed, false);
  assert.equal(report.cleanup.attempted, false);
  assert.equal(cdp.calls.length, 1);
  assert.match(report.failure, /pre-existing/);
});

test('reset failure cannot report a completed probe', async () => {
  const report = await withOptionalQuotaDeny({
    cdp: fixture({ failReset: true }),
    origin,
    run: async () => {},
  });
  assert.equal(report.callbackCompleted, true);
  assert.equal(report.completed, false);
  assert.equal(report.cleanup.completed, false);
  assert.match(report.cleanup.failure, /Reset unavailable/);
});

test('timed-out callback is aborted and never reclassifies late success', async () => {
  let finish, signal;
  const report = await withOptionalQuotaDeny({
    cdp: fixture(),
    origin,
    timeoutMs: 10,
    run: (options) => {
      signal = options.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  assert.equal(signal.aborted, true);
  assert.equal(report.completed, false);
  assert.equal(report.cleanup.completed, false);
  assert.equal(report.after.overrideActive, false);
  const frozen = JSON.stringify(report);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(JSON.stringify(report), frozen);
});

test('late bounded-quota response triggers another reset and stays unverified', async () => {
  const cdp = fixture();
  const original = cdp.send;
  let completeApply;
  cdp.send = (method, args) =>
    Object.hasOwn(args, 'quotaSize')
      ? new Promise((resolve) => {
          completeApply = async () => {
            await original(method, args);
            resolve();
          };
        })
      : original(method, args);
  const report = await withOptionalQuotaDeny({
    cdp,
    origin,
    commandTimeoutMs: 10,
    run: async () => assert.fail('must not run'),
  });
  assert.equal(report.completed, false);
  assert.equal(report.cleanup.completed, false);
  await completeApply();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(cdp.calls.at(-1), {
    method: 'Storage.overrideQuotaForOrigin',
    args: { origin },
  });
  assert.equal(report.completed, false);
});

test('zero is never sent even on an unused origin', async () => {
  const cdp = fixture({ usage: 0 });
  const report = await withOptionalQuotaDeny({ cdp, origin, run: async () => {} });
  assert.equal(report.completed, true);
  assert.equal(report.requestedQuotaBytes, 1024);
  assert.equal(cdp.calls.find((row) => Object.hasOwn(row.args, 'quotaSize')).args.quotaSize, 1024);
});

test('invalid or overflowing measured usage cannot trigger an override', async () => {
  for (const usage of [
    -1,
    1.5,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MAX_SAFE_INTEGER - 1023,
  ]) {
    const cdp = fixture({ usage });
    const report = await withOptionalQuotaDeny({
      cdp,
      origin,
      run: async () => assert.fail('must not run'),
    });
    assert.equal(report.completed, false);
    assert.equal(report.cleanup.attempted, false);
    assert.equal(
      cdp.calls.some((row) => row.method === 'Storage.overrideQuotaForOrigin'),
      false,
    );
  }
});

test('a different active quota is not accepted as the requested control', async () => {
  const cdp = fixture(),
    original = cdp.send;
  cdp.send = async (method, args) => {
    const value = await original(method, args);
    return value?.overrideActive ? { ...value, quota: value.quota + 1 } : value;
  };
  const report = await withOptionalQuotaDeny({
    cdp,
    origin,
    run: async () => assert.fail('must not run'),
  });
  assert.equal(report.completed, false);
  assert.equal(report.cleanup.completed, true);
  assert.match(report.failure, /differs from the requested/);
});
