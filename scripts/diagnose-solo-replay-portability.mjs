/* global window */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  verifyNativeQualificationReplay,
  replayVerificationRequestAllowed,
  assertReplayVerificationIdentity,
} from './solo-qualification-native-replay.mjs';
import {
  prepareReplayPortabilityRequest,
  traceReplayPortability,
  assertReplayPortabilityNativeModules,
} from './solo-replay-portability-diagnostic.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

/** Explicit, separately excluded companion. The existing strict verifier and
 * its callers remain unchanged. The caller's existing ownedCommand must bound
 * Node preparation plus this command to 120 seconds; this inner budget never
 * grants another 120 seconds to the trace or creates a retry. */
export async function diagnoseNativeReplayPortability(options) {
  const {
    playwright,
    engine,
    executablePath,
    expected,
    recordingText,
    mirror,
    portabilityDiagnostic,
    timeoutMs = 120000,
  } = options;
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000);
  assert.equal(options.observedBrowserClosed, true);
  assert(portabilityDiagnostic, 'Explicit fixed portability request is required');
  const deadline = performance.now() + timeoutMs;
  const remaining = () => {
    const value = Math.floor(deadline - performance.now());
    assert(value > 0, 'Portability owner deadline expired');
    return value;
  };
  const report = {
    format: 'SoloReplayPortabilityCompanionV1',
    status: 'running',
    recordId: null,
    recordingSHA256: null,
    startedAt: new Date().toISOString(),
    strictVerdictChanged: false,
    scope:
      'Separate retained-recording replay diagnostic, excluded from performance qualification. No gameplay or saved state. Classic and other sections are excluded from scalar comparison.',
  };
  let browser,
    context,
    timer,
    stopped = false;
  const pending = [];
  const traceSource = {
    status: 'running',
    modules: [],
    pageErrors: [],
    failedRequests: [],
  };
  const finishModules = async () => {
    await Promise.all(pending);
    assert(traceSource.modules.length > 0, 'Trace modules were not observed');
    assert(
      traceSource.modules.every(
        (row) => !row.failure && row.status === 200 && row.csp === expected.csp,
      ),
      'Trace module load/policy failure',
    );
    assert.equal(traceSource.pageErrors.length, 0, 'Trace page errors');
    assert.equal(traceSource.failedRequests.length, 0, 'Trace request failures');
  };
  try {
    const prepared = await prepareReplayPortabilityRequest(portabilityDiagnostic, {
      recordingText,
      engine,
      expected,
      timeoutMs,
    });
    report.recordId = prepared.row.id;
    report.recordingSHA256 = prepared.row.recording.sha256;
    // This exact unchanged verifier retains its own strict report and cleanup.
    report.strict = await verifyNativeQualificationReplay({
      ...options,
      timeoutMs: remaining(),
    });
    assertReplayPortabilityNativeModules(prepared.row, report.strict);
    const traceBudget = remaining();
    await Promise.race([
      (async () => {
        browser = await playwright[engine].launch({
          ...(engine === 'chromium' ? { executablePath } : {}),
          headless: true,
          timeout: Math.min(traceBudget, 30000),
        });
        if (stopped) {
          await browser.close();
          throw new Error('Trace launch completed after its deadline');
        }
        traceSource.browserVersion = browser.version();
        assert.equal(traceSource.browserVersion, expected.browserVersion);
        context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        const identityURL = new URL(expected.buildIdentity.url);
        const gameURL = new URL('./', identityURL);
        page.on('pageerror', (error) => {
          if (traceSource.pageErrors.length < 100) traceSource.pageErrors.push(String(error));
        });
        page.on('requestfailed', (request) => {
          if (traceSource.failedRequests.length < 100)
            traceSource.failedRequests.push({ url: request.url(), failure: request.failure() });
        });
        await page.route('**/*', async (route) => {
          const requested = route.request();
          const allowed = replayVerificationRequestAllowed(
            identityURL.href,
            requested.url(),
            requested.resourceType(),
          );
          const decision = mirror?.(requested.url());
          if (!allowed || (mirror && decision?.kind !== 'local'))
            return route.abort('blockedbyclient');
          if (decision)
            return route.fulfill({ response: await route.fetch({ url: decision.url }) });
          return route.continue();
        });
        let totalBytes = 0;
        page.on('response', (response) => {
          if (!/\.m?js$/.test(new URL(response.url()).pathname)) return;
          pending.push(
            (async () => {
              try {
                assert(pending.length < 256, 'Trace module count exceeded');
                const bytes = await response.body();
                totalBytes += bytes.length;
                assert(totalBytes <= 64 * 1024 * 1024, 'Trace module byte bound');
                traceSource.modules.push({
                  url: response.url(),
                  status: response.status(),
                  bytes: bytes.length,
                  sha256: digest(bytes),
                  csp: response.headers()['content-security-policy'] ?? null,
                });
              } catch (error) {
                traceSource.modules.push({ url: response.url(), failure: String(error) });
              }
            })(),
          );
        });
        await page.addInitScript(
          'window.soloTraceReplayPortability = ' + traceReplayPortability.toString() + ';',
        );
        const response = await page.goto(identityURL.href, {
          waitUntil: 'load',
          timeout: Math.min(remaining(), 60000),
        });
        assert.equal(response.status(), 200);
        const identityBytes = await response.body();
        assert(identityBytes.length <= 65536);
        const identity = JSON.parse(identityBytes.toString());
        traceSource.buildIdentity = {
          url: page.url(),
          sourceRevision: identity.sourceRevision,
          version: identity.version,
          sha256: digest(identityBytes),
        };
        traceSource.csp = response.headers()['content-security-policy'] ?? null;
        assertReplayVerificationIdentity(expected, { ...traceSource, url: page.url() });
        const comparison = await page.evaluate(
          async ({ source, base, checkpoint, reference }) => {
            const [core, replay] = await Promise.all([
              import(new URL('core/index.mjs', base).href),
              import(new URL('replay.mjs', base).href),
            ]);
            return window.soloTraceReplayPortability(
              JSON.parse(source),
              {
                snapshotReplay: replay.snapshotReplay,
                createRun: core.createRun,
                stepRun: core.stepRun,
                releaseInputs: core.releaseInputs,
                FIXED_DT: core.FIXED_DT,
                authoritativeCheckpoint: replay.authoritativeCheckpoint,
              },
              checkpoint,
              reference,
            );
          },
          {
            source: recordingText,
            base: gameURL.href,
            checkpoint: prepared.row.nativeCheckpoint,
            reference: prepared.reference.trace,
          },
        );
        await finishModules();
        assert.equal(comparison.status, 'complete');
        assert.equal(comparison.strictVerdictChanged, false);
        assert(Buffer.byteLength(JSON.stringify(comparison)) <= 65536);
        traceSource.status = 'pass';
        traceSource.observation = { checkpoint: comparison.observedFinalCheckpoint };
        assertReplayPortabilityNativeModules(prepared.row, traceSource);
        remaining();
        if (!stopped) report.comparison = comparison;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Portability trace deadline expired')),
          traceBudget,
        );
      }),
    ]);
    report.status = 'complete';
  } catch (error) {
    report.status = 'incomplete';
    report.failure = String(error.stack ?? error).slice(0, 4096);
  } finally {
    stopped = true;
    clearTimeout(timer);
    report.cleanupFailures = [];
    for (const [name, owner] of [
      ['context', context],
      ['browser', browser],
    ]) {
      try {
        await owner?.close();
      } catch (error) {
        report.cleanupFailures.push({ owner: name, failure: String(error).slice(0, 512) });
      }
    }
    if (report.cleanupFailures.length) report.status = 'incomplete';
    await Promise.all(pending);
    report.traceSource = traceSource;
    report.completedAt = new Date().toISOString();
  }
  const serialized = JSON.stringify(report);
  const reportBytes = Buffer.byteLength(serialized);
  // Comparison <=64KiB; complete envelope (strict report, sources and errors)
  // <=512KiB. Overflow never returns a partial map or a complete disposition.
  if (reportBytes > 512 * 1024)
    return {
      format: report.format,
      status: 'incomplete',
      recordId: report.recordId,
      recordingSHA256: report.recordingSHA256,
      strictVerdictChanged: false,
      evidenceOverflow: {
        bytes: reportBytes,
        maximumBytes: 512 * 1024,
        sha256: digest(serialized),
      },
      strictIdentity: report.strict
        ? {
            status: report.strict.status,
            bytes: Buffer.byteLength(JSON.stringify(report.strict)),
            sha256: digest(JSON.stringify(report.strict)),
          }
        : null,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      failure:
        'Complete diagnostic envelope exceeded its declared bound; detailed result not retained.',
    };
  return report;
}
