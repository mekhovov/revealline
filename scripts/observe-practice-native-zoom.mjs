/** Explicit opt-in capability fixture. Never connects to an existing browser. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { mkdtemp, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  NATIVE_ZOOM_POLICY,
  NATIVE_ZOOM_FIXTURE,
  selectNativeZoom,
  observeNativeZoomSequence,
  zoomOperationScope,
} from './practice-native-zoom-capability.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function parseNativeZoomArguments(args) {
  assert.equal(
    args.length,
    4,
    'Require --playwright ABSOLUTE_MODULE --output FRESH_ABSOLUTE_DIRECTORY.',
  );
  const flags = new Map();
  for (let i = 0; i < args.length; i += 2) {
    assert(['--playwright', '--output'].includes(args[i]) && !flags.has(args[i]));
    assert(path.isAbsolute(args[i + 1]) && args[i + 1].length <= 2048);
    assert.equal(path.resolve(args[i + 1]), args[i + 1]);
    flags.set(args[i], args[i + 1]);
  }
  assert(flags.has('--playwright') && flags.has('--output'));
  assert.notEqual(flags.get('--output'), path.parse(flags.get('--output')).root);
  return { modulePath: flags.get('--playwright'), output: flags.get('--output') };
}

export async function observeNativeChromeZoom({ modulePath, output }) {
  // Reserve a new evidence directory before importing a browser implementation.
  parseNativeZoomArguments(['--playwright', modulePath, '--output', output]);
  await mkdir(output);
  const handle = await open(path.join(output, 'observation.json'), 'wx');
  const report = {
    format: 'NativeChromeZoomCapabilityObservation.v1',
    protocol: { ...NATIVE_ZOOM_POLICY },
    startedAt: new Date().toISOString(),
    passed: false,
    qualified: false,
    publicEligible: false,
    packageBound: false,
    isolatedProfile: true,
    headed: true,
    viewportEmulation: false,
    deviceScaleEmulation: false,
    fixture: {
      path: '/native-zoom',
      bytes: Buffer.byteLength(NATIVE_ZOOM_FIXTURE),
      sha256: sha(NATIVE_ZOOM_FIXTURE),
    },
    authority: [],
    errors: [],
    cleanup: {
      errors: [],
      zoomResetVerified: false,
      browserClosed: false,
      serverClosed: false,
      profileRemoved: false,
    },
    limitations: [
      'Native Chrome zoom capability only; no app, package, authentication, accessibility or release qualification.',
      'Ordinary visible Chrome Settings selection changes only this disposable profile. No user profile, global OS preference, private settings function, CSS zoom, pinch scaling or device emulation.',
      'No screen reader, physical input, reduced-motion or human-readability evidence. Those require separate later protocols.',
      'Screenshot content is page content, not a whole-desktop capture. Settings screenshot and independent geometry corroborate zoom.',
      'Native operations cannot always be cancelled. Pending operations or failed restoration/cleanup make the receipt fail and retain the owned profile.',
    ],
  };
  const persist = async () => {
    const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
    await handle.truncate(0);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset, offset);
      assert(bytesWritten > 0);
      offset += bytesWritten;
    }
  };
  const scope = zoomOperationScope();
  let context,
    server,
    profile,
    settings,
    stopped = false;
  const resources = [];
  const cleanup = async (label, work) => {
    const owned = zoomOperationScope({
      overallMs: NATIVE_ZOOM_POLICY.cleanupMs,
      actionMs: NATIVE_ZOOM_POLICY.cleanupMs,
    });
    try {
      await owned.run(label, work);
      return true;
    } catch (error) {
      report.cleanup.errors.push({ label, message: error.message });
      return false;
    } finally {
      owned.stop();
    }
  };
  const acquire = async (label, work, close) => {
    const row = { label, acquired: false, late: false, closed: false };
    resources.push(row);
    return scope.run(label, async () => {
      const value = await work();
      row.acquired = true;
      row.release = async () => {
        if (!row.closed) {
          await close(value);
          row.closed = true;
        }
      };
      if (stopped) {
        row.late = true;
        await cleanup(`Close late ${label}`, row.release);
        throw Error(`Late owned resource: ${label}`);
      }
      return value;
    });
  };
  try {
    for (const name of ['observe-practice-native-zoom.mjs', 'practice-native-zoom-capability.mjs'])
      report.authority.push({
        path: name,
        sha256: sha(await readFile(new URL(name, import.meta.url))),
      });
    await persist();
    const { chromium } = await scope.run(
      'Import existing browser runtime',
      () => import(pathToFileURL(modulePath).href),
    );
    profile = await acquire(
      'Create isolated profile',
      () => mkdtemp(path.join(tmpdir(), 'practice-native-zoom-')),
      (value) => rm(value, { recursive: true, force: true }),
    );
    report.ownedProfile = profile;
    server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/native-zoom') {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy':
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      });
      response.end(NATIVE_ZOOM_FIXTURE);
    });
    await acquire(
      'Start owned loopback server',
      () =>
        new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', () => resolve(server));
        }),
      async (value) => {
        value.closeAllConnections?.();
        await new Promise((resolve, reject) =>
          value.close((error) => (error ? reject(error) : resolve())),
        );
      },
    );
    const fixtureURL = `http://127.0.0.1:${server.address().port}/native-zoom`;
    context = await acquire(
      'Launch owned headed Chrome',
      () =>
        chromium.launchPersistentContext(profile, {
          channel: 'chrome',
          headless: false,
          viewport: null,
          timeout: 10000,
          args: ['--window-size=1280,900'],
        }),
      (value) => value.close(),
    );
    context.setDefaultTimeout(5000);
    const page =
      context.pages()[0] ??
      (await acquire(
        'Create fixture page',
        () => context.newPage(),
        (value) => value.close(),
      ));
    settings = await acquire(
      'Create owned settings page',
      () => context.newPage(),
      (value) => value.close(),
    );
    for (const item of [page, settings])
      item.on('pageerror', (error) => report.errors.push(error.message.slice(0, 1024)));
    const cdp = await acquire(
      'Create read-only version session',
      () => context.newCDPSession(page),
      (value) => value.detach(),
    );
    try {
      report.browser = await scope.run('Read actual Chrome version', () =>
        cdp.send('Browser.getVersion'),
      );
    } finally {
      await cleanup(
        'Close version session',
        resources.find((row) => row.label === 'Create read-only version session').release,
      );
    }
    const capture = async (target, name) =>
      scope.run(`Capture ${name}`, async () => {
        const bytes = await target.screenshot({ timeout: 5000 });
        const namePath = path.join(output, name + '.png');
        await writeFile(namePath, bytes, { flag: 'wx' });
        return {
          path: namePath,
          bytes: bytes.length,
          sha256: sha(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        };
      });
    await observeNativeZoomSequence({
      page,
      settings,
      fixtureURL,
      run: scope.run,
      capture,
      receipt: report,
    });
  } catch (error) {
    report.failure = error.message;
  } finally {
    stopped = true;
    scope.stop();
    // Restoration precedes close, but owns a separate fixed cleanup deadline.
    if (settings) {
      const reset = zoomOperationScope({ overallMs: 5000, actionMs: 2000 });
      try {
        report.cleanup.resetActions = [];
        await selectNativeZoom(settings, '1', reset.run, report.cleanup.resetActions);
        report.cleanup.zoomResetVerified = true;
      } catch (error) {
        report.cleanup.errors.push({
          label: 'Restore owned profile zoom to 100%',
          message: error.message,
        });
      } finally {
        reset.stop();
      }
    }
    await Promise.all(
      resources
        .filter(
          (row) =>
            row.acquired &&
            ['Launch owned headed Chrome', 'Start owned loopback server'].includes(row.label) &&
            !row.closed,
        )
        .map((row) => cleanup(`Close ${row.label}`, row.release)),
    );
    const browserClosed = resources.some(
      (row) => row.label === 'Launch owned headed Chrome' && row.closed,
    );
    for (const row of resources.filter(
      (row) =>
        row.acquired &&
        [
          'Create fixture page',
          'Create owned settings page',
          'Create read-only version session',
        ].includes(row.label) &&
        !row.closed,
    )) {
      if (browserClosed)
        row.closed = true; // Closing the owned context closes its pages/sessions.
      else await cleanup(`Close ${row.label}`, row.release);
    }
    await cleanup('Join pending native operations', () => Promise.allSettled(scope.tasks()));
    report.cleanup.browserClosed = resources.some(
      (row) => row.label === 'Launch owned headed Chrome' && row.closed,
    );
    report.cleanup.serverClosed = resources.some(
      (row) => row.label === 'Start owned loopback server' && row.closed,
    );
    report.cleanup.pending = scope.pending();
    if (
      profile &&
      report.cleanup.browserClosed &&
      !report.cleanup.pending.length &&
      !report.cleanup.errors.length
    )
      report.cleanup.profileRemoved = await cleanup(
        'Remove owned disposable profile',
        resources.find((row) => row.label === 'Create isolated profile').release,
      );
    if (profile && !report.cleanup.profileRemoved) report.cleanup.retainedProfile = profile;
    report.cleanup.resources = resources.map(({ label, acquired, late, closed }) => ({
      label,
      acquired,
      late,
      closed,
    }));
    try {
      report.sourceStable = (
        await Promise.all(
          report.authority.map(
            async (row) => row.sha256 === sha(await readFile(new URL(row.path, import.meta.url))),
          ),
        )
      ).every(Boolean);
    } catch (error) {
      report.sourceStable = false;
      report.cleanup.errors.push({ label: 'Recheck authority', message: error.message });
    }
    report.passed = Boolean(
      report.sequenceVerified &&
        report.sourceStable &&
        !report.failure &&
        !report.errors.length &&
        report.cleanup.zoomResetVerified &&
        report.cleanup.browserClosed &&
        report.cleanup.serverClosed &&
        report.cleanup.profileRemoved &&
        !report.cleanup.pending.length &&
        !report.cleanup.errors.length,
    );
    report.endedAt = new Date().toISOString();
    try {
      await persist();
    } finally {
      await handle.close();
    }
  }
  return report;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  assert.equal(
    process.env.PRACTICE_NATIVE_ZOOM_CAPABILITY,
    '1',
    'Explicit capability-only opt-in required.',
  );
  const report = await observeNativeChromeZoom(parseNativeZoomArguments(process.argv.slice(2)));
  console.log(
    JSON.stringify({
      passed: report.passed,
      failure: report.failure,
      output: process.argv[process.argv.indexOf('--output') + 1],
    }),
  );
  process.exitCode = report.passed ? 0 : 1;
}
