#!/usr/bin/env node
/** Offline diagnostic qualification; no game admission or recording is changed. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { finishQualification, writeQualificationReport } from './shared-demo-browser-report.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const at = arg.indexOf('=');
    assert.ok(arg.startsWith('--') && at > 2, 'Use --name=value options.');
    return [arg.slice(2, at), arg.slice(at + 1)];
  }),
);
const engine = args.browser ?? 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const baseURL = args.url ?? 'http://127.0.0.1:8769';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname));
const reportPath = args.report ?? `.cache/demo-ticks-${engine}.json`;
const sourceFiles = execFileSync('rg', ['--files', 'game', 'optional-practice', 'scripts'], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
})
  .trim()
  .split('\n')
  .filter(
    (file) =>
      /\.(mjs|js)$/.test(file) &&
      !file.includes('/test/') &&
      !file.endsWith('.test.mjs') &&
      !file.split('/').at(-1).startsWith('test-') &&
      (!file.startsWith('scripts/') || /^scripts\/demo-tick-(trace|adapters)(\.mjs|\/)/.test(file)),
  )
  .sort();
const fingerprint = async () => {
  const hash = createHash('sha256');
  for (const file of sourceFiles)
    hash.update(file + '\0').update(
      createHash('sha256')
        .update(await readFile(file))
        .digest(),
    );
  return hash.digest('hex');
};
const report = {
  engine,
  started: new Date().toISOString(),
  complete: false,
  checks: [],
  errors: [],
  implementation: await fingerprint(),
};
let browser;
try {
  const runtime = args.runtime ?? 'playwright';
  const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
  browser = await playwright[engine].launch({
    headless: true,
    ...(engine === 'chromium'
      ? { args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'] }
      : {}),
    ...(args.executable ? { executablePath: args.executable } : {}),
  });
  report.browserVersion = browser.version();
  const page = await browser.newPage();
  page.on('pageerror', (error) => {
    if (report.errors.length < 16) report.errors.push(String(error));
  });
  const fixture = `${baseURL}/__demo_tick_qualification__`;
  await page.route(fixture, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Offline demo diagnostics</title>',
    }),
  );
  await page.goto(fixture);
  for (const modeId of ['solo', 'snake', 'sim', 'survival']) {
    console.log(JSON.stringify({ phase: 'start', engine, modeId, at: new Date().toISOString() }));
    report.activeMode = modeId;
    report.modeStarted = new Date().toISOString();
    await writeQualificationReport(reportPath, report);
    let timer;
    const timedOut = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Offline ${modeId} diagnostics exceeded 20 minutes.`)),
        20 * 60 * 1000,
      );
    });
    let result;
    try {
      result = await Promise.race([
        timedOut,
        page.evaluate(
          async ({ modeId, engine, version, implementation }) => {
            const { createDemoTickAdapter } = await import('/scripts/demo-tick-adapters.mjs');
            const { captureDemoTickTrace, compareDemoTickTrace } = await import(
              '/scripts/demo-tick-trace.mjs'
            );
            const paths = {
              solo: `/game/demo-data/solo-qualified-bda094dfb23a16c2${engine === 'webkit' ? '.webkit' : ''}.replay.json`,
              snake: '/game/demo-data/snake/classic-snake-open-loop.replay.json',
              sim: '/optional-practice/civilian-fpv/demo-data/beginner-01-self-level-5b7652234b696e5a.json',
              survival: `/game/demo-data/survival/field-crossing-broken-crossroads.${engine}.replay.json`,
            };
            const response = await fetch(paths[modeId]);
            if (!response.ok) throw new Error(`Recording unavailable: ${response.status}`);
            const adapter = await createDemoTickAdapter({
              modeId,
              recording: await response.json(),
            });
            const runtime = { engine, version, implementation };
            const started = performance.now();
            const packet = await captureDemoTickTrace(adapter, {
              runtime,
              yieldTask: async () => {},
            });
            const captureMs = performance.now() - started;
            const compared = await compareDemoTickTrace(adapter, packet, {
              runtime,
              yieldTask: async () => {},
            });
            if (!compared.match || !compared.nativeVerification.passed)
              throw new Error('Verified native trace did not reproduce.');
            const faults = [];
            for (const tick of [17, 300].filter(
              (tick) => tick < packet.trace.verification.terminalTick,
            )) {
              const faultyObserver = {
                ...adapter,
                observe: (options) =>
                  adapter.observe({
                    ...options,
                    onTick: (row) =>
                      options.onTick(
                        row.tick === tick
                          ? {
                              ...row,
                              stateIdentity:
                                row.stateIdentity === '0000000000000000'
                                  ? '1111111111111111'
                                  : '0000000000000000',
                            }
                          : row,
                      ),
                  }),
              };
              const fault = await compareDemoTickTrace(faultyObserver, packet, {
                runtime,
                yieldTask: async () => {},
              });
              if (
                fault.match ||
                fault.firstDivergentTick !== tick ||
                fault.lastMatchingTick !== tick - 1 ||
                !fault.nativeVerification.passed
              )
                throw new Error(
                  'Exact injected observation mismatch was not located independently.',
                );
              faults.push({
                tick,
                firstDivergentTick: fault.firstDivergentTick,
                kind: fault.kind,
                nativeVerificationPassed: fault.nativeVerification.passed,
              });
            }
            const corrupt = structuredClone(packet);
            corrupt.trace.hashes[17] = '0000000000000000';
            let referenceRejected = false;
            try {
              await compareDemoTickTrace(adapter, corrupt);
            } catch (error) {
              referenceRejected = /receipt/.test(error.message);
            }
            if (!referenceRejected) throw new Error('Corrupt reference was accepted.');
            const controller = new AbortController();
            let calls = 0,
              cancelled = false;
            try {
              await adapter.observe({
                signal: controller.signal,
                yieldTask: async () => {},
                onTick: ({ tick }) => {
                  calls++;
                  if (tick === 17) controller.abort();
                },
              });
            } catch (error) {
              cancelled = error.name === 'AbortError';
            }
            if (!cancelled || calls !== 18)
              throw new Error('Diagnostic cancellation crossed its native tick boundary.');
            return {
              modeId,
              recording: paths[modeId],
              binding: adapter.binding,
              verification: packet.trace.verification,
              observedStates: packet.trace.hashes.length,
              receipt: packet.receipt,
              captureMs,
              elapsedMs: performance.now() - started,
              identicalNativeTrace: compared.match,
              faults,
              referenceRejected,
              cancelledAtTick: 17,
            };
          },
          { modeId, engine, version: report.browserVersion, implementation: report.implementation },
        ),
      ]);
    } finally {
      clearTimeout(timer);
    }
    report.activeMode = null;
    report.checks.push(result);
    await writeQualificationReport(reportPath, report);
    console.log(JSON.stringify({ phase: 'complete', engine, modeId, elapsedMs: result.elapsedMs }));
  }
  report.finalImplementation = await fingerprint();
  assert.equal(
    report.finalImplementation,
    report.implementation,
    'Diagnostic/runtime sources changed during qualification.',
  );
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (error) {
  report.failure = String(error.stack ?? error);
} finally {
  await finishQualification({ report, reportPath, browser });
}
if (!report.complete) process.exitCode = 1;
