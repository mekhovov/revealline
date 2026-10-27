import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, realpath, rm, writeFile, symlink, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  capturePreparedMeasurementContext,
  captureWebKitRuntimeFiles,
  requestedMeasurementContext,
} from './solo-qualification-provenance.mjs';

// Helper contracts only. Caller placement and measured-run provenance remain
// in the separately held integration proposal. These tests do not attest to
// a loaded WebKit library, a timer error bound, or overhead qualification.
const temporary = async (t) => {
  const path = await mkdtemp(join(tmpdir(), 'solo-hosted-owner-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
};

const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1, 2, 3, 4]);
async function runtimeInstallation(t) {
  // temporary() owns teardown of its original path, even when /var aliases /private/var.
  const root = await realpath(await temporary(t));
  await mkdir(join(root, 'minibrowser-wpe/bin'), { recursive: true });
  await mkdir(join(root, 'minibrowser-wpe/lib'), { recursive: true });
  await writeFile(join(root, 'pw_run.sh'), '# retained launcher fixture\n');
  for (const name of ['MiniBrowser', 'WPEWebProcess', 'WPENetworkProcess'])
    await writeFile(join(root, 'minibrowser-wpe/bin', name), elf);
  await writeFile(join(root, 'minibrowser-wpe/lib/libWPEWebKit-2.0.so.1'), elf);
  return { root, executable: join(root, 'pw_run.sh') };
}

test('runtime provenance hashes bounded ELF candidates without claiming loaded-library identity', async (t) => {
  const { root, executable } = await runtimeInstallation(t);
  await symlink('libWPEWebKit-2.0.so.1', join(root, 'minibrowser-wpe/lib/libWPEWebKit-2.0.so'));
  const value = await captureWebKitRuntimeFiles(executable, { platform: 'linux' });
  assert.equal(value.status, 'recorded-candidates');
  assert.equal(value.actualLoadedIdentity.status, 'unavailable');
  assert.equal(value.files.length, 4, 'internal aliases deduplicate by canonical file');
  assert.equal(value.totalBytes, elf.length * 4);
  const expected = createHash('sha256').update(elf).digest('hex');
  for (const file of value.files) {
    assert.equal(file.sha256, expected);
    assert.equal(file.bytes, elf.length);
    assert.equal(file.path.startsWith('/'), false);
    assert.equal(file.path.includes('..'), false);
  }
});

test('runtime provenance reports missing libraries and unsupported layouts explicitly', async (t) => {
  const { root, executable } = await runtimeInstallation(t);
  await rm(join(root, 'minibrowser-wpe/lib/libWPEWebKit-2.0.so.1'));
  const missing = await captureWebKitRuntimeFiles(executable, { platform: 'linux' });
  assert.equal(missing.status, 'incomplete');
  assert.match(missing.reason, /No WebKit or JavaScriptCore/);
  const unsupported = await captureWebKitRuntimeFiles('/not-accessed/unknown', {
    platform: 'darwin',
  });
  assert.equal(unsupported.status, 'unavailable');
  assert.deepEqual(unsupported.files, []);
  assert.equal(unsupported.actualLoadedIdentity.status, 'unavailable');
});

test('runtime provenance rejects an external engine alias and a non-ELF binary', async (t) => {
  const { root, executable } = await runtimeInstallation(t);
  const external = await temporary(t);
  await writeFile(join(external, 'engine'), elf);
  const target = join(root, 'minibrowser-wpe/bin/MiniBrowser');
  await rm(target);
  await symlink(join(external, 'engine'), target);
  const escaped = await captureWebKitRuntimeFiles(executable, { platform: 'linux' });
  assert.equal(escaped.status, 'incomplete');
  assert.match(escaped.reason, /escaped/);
  assert.deepEqual(escaped.files, []);
  await rm(target);
  await writeFile(target, 'text cannot attest to an engine');
  const text = await captureWebKitRuntimeFiles(executable, { platform: 'linux' });
  assert.equal(text.status, 'incomplete');
  assert.match(text.reason, /not an ELF/);
});

test('runtime provenance refuses oversized files before reading and excessive candidate counts', async (t) => {
  const { root, executable } = await runtimeInstallation(t);
  const target = join(root, 'minibrowser-wpe/bin/MiniBrowser');
  await truncate(target, 512 * 1024 ** 2 + 1);
  const oversized = await captureWebKitRuntimeFiles(executable, { platform: 'linux' });
  assert.equal(oversized.status, 'incomplete');
  assert.match(oversized.reason, /size\/type budget/);
  assert.deepEqual(oversized.files, []);
  await writeFile(target, elf);
  for (let index = 0; index < 10; index++)
    await writeFile(
      join(root, 'minibrowser-wpe/lib', 'libJavaScriptCore-test' + index + '.so'),
      elf,
    );
  const crowded = await captureWebKitRuntimeFiles(executable, { platform: 'linux' });
  assert.equal(crowded.status, 'incomplete');
  assert.match(crowded.reason, /file budget/);
  assert.deepEqual(crowded.files, []);
});

test('runtime provenance cancellation cannot produce a complete candidate record', async (t) => {
  const { executable } = await runtimeInstallation(t);
  const controller = new AbortController();
  controller.abort(new Error('owned setup cancelled'));
  const value = await captureWebKitRuntimeFiles(executable, {
    platform: 'linux',
    signal: controller.signal,
  });
  assert.equal(value.status, 'aborted');
  assert.deepEqual(value.files, []);
  assert.match(value.reason, /owned setup cancelled/);
});

function preparedPage(overrides = {}) {
  const sandbox = {
    document: { body: { dataset: { flightState: 'ready' } }, visibilityState: 'visible' },
    navigator: { maxTouchPoints: 1, userAgent: 'not retained' },
    crossOriginIsolated: false,
    isSecureContext: true,
    innerWidth: 400,
    innerHeight: 850,
    devicePixelRatio: 3,
    matchMedia: (query) => ({ matches: query === '(pointer: coarse)' }),
    location: { href: 'https://user:secret@example.test/?private=value' },
    localStorage: { secret: 'not retained' },
    ...overrides,
  };
  return {
    evaluate: async (fn) =>
      JSON.parse(JSON.stringify(runInNewContext('(' + fn.toString() + ')()', sandbox))),
  };
}

test('prepared context captures actual arm flags separately from whitelisted requested settings', async () => {
  const requested = {
    mode: 'persistent',
    headless: true,
    viewport: { width: 400, height: 850 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
    ignoredSecret: 'must not escape',
  };
  const value = await capturePreparedMeasurementContext(preparedPage(), requested);
  assert.equal(value.status, 'observed');
  assert.equal(value.stage, 'prepared-before-start');
  assert.equal(value.observed.crossOriginIsolated, false);
  assert.equal(value.observed.isSecureContext, true);
  assert.deepEqual(value.observed.viewport, { width: 400, height: 850 });
  assert.equal(value.observed.devicePixelRatio, 3);
  assert.equal(value.observed.coarsePointer, true);
  assert.equal(value.requested.mode, 'persistent');
  requested.viewport.width = 999;
  assert.equal(
    value.requested.viewport.width,
    400,
    'snapshot does not borrow caller configuration',
  );
  const encoded = JSON.stringify(value);
  for (const forbidden of [
    'ignoredSecret',
    'user:secret',
    'private=value',
    'localStorage',
    'userAgent',
  ])
    assert.equal(encoded.includes(forbidden), false);
});

test('prepared context marks unavailable security fields and refuses active gameplay', async () => {
  const requested = { mode: 'ephemeral', headless: true };
  const missing = await capturePreparedMeasurementContext(
    preparedPage({ crossOriginIsolated: undefined, isSecureContext: undefined }),
    requested,
  );
  assert.equal(missing.status, 'unavailable');
  assert.equal(missing.observed.crossOriginIsolated, null);
  assert.equal(missing.observed.isSecureContext, null);
  await assert.rejects(
    capturePreparedMeasurementContext(
      preparedPage({
        document: { body: { dataset: { flightState: 'running' } }, visibilityState: 'visible' },
      }),
      requested,
    ),
    /requires preparation/,
  );
});

test('prepared context rejects before evaluation for invalid configuration and bounds a hung RPC', async () => {
  let calls = 0;
  const page = {
    evaluate: () => {
      calls++;
      return new Promise(() => {});
    },
  };
  assert.throws(() =>
    requestedMeasurementContext({
      mode: 'persistent',
      headless: true,
      viewport: { width: Infinity, height: 2 },
    }),
  );
  await assert.rejects(
    capturePreparedMeasurementContext(page, { mode: 'unknown', headless: true }),
  );
  assert.equal(calls, 0);
  await assert.rejects(
    capturePreparedMeasurementContext(
      page,
      { mode: 'ephemeral', headless: true },
      { timeoutMs: 10 },
    ),
    /exceeded deadline/,
  );
  assert.equal(calls, 1, 'no retry or additional evaluation after the stage deadline');
});
