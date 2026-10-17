/* global window */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { inspectReplayMechanics } from './solo-qualification-replay-core.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function replayVerificationRequestAllowed(identityAddress, address, resourceType) {
  const identity = new URL(identityAddress),
    requested = new URL(address),
    deployment = new URL('../', new URL('./', identity));
  return (
    requested.origin === identity.origin &&
    requested.pathname.startsWith(deployment.pathname) &&
    (requested.href === identity.href || /\.(?:m?js|json)$/.test(requested.pathname)) &&
    !/\/app\.m?js$/.test(requested.pathname) &&
    (resourceType !== 'document' || requested.href === identity.href)
  );
}

export function assertReplayVerificationIdentity(expected, actual) {
  assert(expected.browserVersion, 'Observed full browser version is required');
  assert.equal(actual.browserVersion, expected.browserVersion, 'Browser version changed');
  assert(
    /^[0-9a-f]{40}$/.test(expected.buildIdentity?.sourceRevision),
    'Observed source identity is required',
  );
  assert.equal(
    actual.buildIdentity.sourceRevision,
    expected.buildIdentity.sourceRevision,
    'Source revision changed',
  );
  assert.equal(
    actual.buildIdentity.sha256,
    expected.buildIdentity.sha256,
    'Build identity bytes changed',
  );
  assert.equal(actual.url, expected.buildIdentity.url, 'Verification document changed');
  assert.equal(
    expected.csp,
    PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
    'Observation must use exact production CSP',
  );
  assert.equal(actual.csp, expected.csp, 'Verification CSP changed');
}

/** Separate fresh browser, after the observed browser has disconnected. Only a
 * JSON identity document and its production module dependencies are admitted. */
export async function verifyNativeQualificationReplay({
  playwright,
  engine,
  executablePath,
  observedBrowserClosed,
  expected,
  recordingText,
  requirements = {},
  expectedDefinition,
  mirror,
  timeoutMs = 120000,
}) {
  assert.equal(
    observedBrowserClosed,
    true,
    'Close the gameplay browser before replay verification',
  );
  assert(['chromium', 'webkit'].includes(engine), 'Unsupported verification engine');
  assert.equal(typeof recordingText, 'string');
  assert(Buffer.byteLength(recordingText) <= 32 * 1024 * 1024, 'Recording exceeds verifier bound');
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000);
  const identityURL = new URL(expected.buildIdentity.url),
    gameURL = new URL('./', identityURL);
  const report = {
    format: 'SoloNativeReplayVerificationV1',
    status: 'running',
    engine,
    executable: engine === 'chromium' ? executablePath : 'playwright-webkit',
    startedAt: new Date().toISOString(),
    expected,
    recording: { bytes: Buffer.byteLength(recordingText), sha256: digest(recordingText) },
    pageErrors: [],
    failedRequests: [],
    modules: [],
    scope:
      'Strict same-engine, same-version post-measurement verification against the observed production artifact. No game page, live run, saved storage or checkpoint is changed. All verification cost is outside timing.',
  };
  let browser,
    context,
    timer,
    stopped = false,
    byteCount = 0;
  const pending = [];
  try {
    await Promise.race([
      (async () => {
        browser = await playwright[engine].launch({
          ...(engine === 'chromium' ? { executablePath } : {}),
          headless: true,
          timeout: Math.min(timeoutMs, 30000),
        });
        if (stopped) {
          await browser.close();
          throw new Error('Verifier launch completed after its deadline');
        }
        report.browserVersion = browser.version();
        assert.equal(report.browserVersion, expected.browserVersion, 'Browser version changed');
        context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        page.on('pageerror', (error) => {
          if (report.pageErrors.length < 100) report.pageErrors.push(String(error));
        });
        page.on('requestfailed', (request) => {
          if (report.failedRequests.length < 100)
            report.failedRequests.push({ url: request.url(), failure: request.failure() });
        });
        await page.route('**/*', async (route) => {
          const requested = new URL(route.request().url());
          // Never boot app.mjs or fetch media/HTML. A production verifier only
          // needs the identity document plus its relative ESM/locale imports.
          const admitted = replayVerificationRequestAllowed(
            identityURL.href,
            requested.href,
            route.request().resourceType(),
          );
          const decision = mirror?.(requested.href);
          if (!admitted || (mirror && decision?.kind !== 'local'))
            return route.abort('blockedbyclient');
          if (decision)
            return route.fulfill({ response: await route.fetch({ url: decision.url }) });
          return route.continue();
        });
        page.on('response', (response) => {
          if (!/\.m?js$/.test(new URL(response.url()).pathname)) return;
          pending.push(
            (async () => {
              try {
                assert(pending.length < 256, 'Verifier module count exceeded');
                const bytes = await response.body();
                byteCount += bytes.length;
                assert(byteCount <= 64 * 1024 * 1024, 'Verifier module bytes exceeded');
                report.modules.push({
                  url: response.url(),
                  status: response.status(),
                  bytes: bytes.length,
                  sha256: digest(bytes),
                  csp: response.headers()['content-security-policy'] ?? null,
                });
              } catch (error) {
                report.modules.push({ url: response.url(), failure: String(error) });
              }
            })(),
          );
        });
        await page.addInitScript(
          `window.soloInspectReplayMechanics = ${inspectReplayMechanics.toString()};`,
        );
        const response = await page.goto(identityURL.href, {
          waitUntil: 'load',
          timeout: Math.min(timeoutMs, 60000),
        });
        assert.equal(response.status(), 200, 'Build identity is unavailable');
        const identityBytes = await response.body();
        assert(identityBytes.length <= 65536, 'Build identity exceeds metadata bound');
        const identity = JSON.parse(identityBytes.toString());
        report.buildIdentity = {
          url: page.url(),
          sourceRevision: identity.sourceRevision,
          version: identity.version,
          sha256: digest(identityBytes),
        };
        report.csp = response.headers()['content-security-policy'] ?? null;
        assertReplayVerificationIdentity(expected, { ...report, url: page.url() });
        report.observation = await page.evaluate(
          async ({ source, requirements, expectedDefinition, base }) => {
            const [core, replay, jammer, combat] = await Promise.all([
              import(new URL('core/index.mjs', base).href),
              import(new URL('replay.mjs', base).href),
              import(new URL('ui/jammer-picture.mjs', base).href),
              import(new URL('ui/combat-view.mjs', base).href),
            ]);
            return window.soloInspectReplayMechanics(
              JSON.parse(source),
              requirements,
              {
                createRun: core.createRun,
                stepRun: core.stepRun,
                releaseInputs: core.releaseInputs,
                FIXED_DT: core.FIXED_DT,
                verifyReplay: replay.verifyReplay,
                authoritativeCheckpoint: replay.authoritativeCheckpoint,
                jammerPictureStrength: jammer.jammerPictureStrength,
                combatView: combat.combatView,
              },
              expectedDefinition,
            );
          },
          { source: recordingText, requirements, expectedDefinition, base: gameURL.href },
        );
        await Promise.all(pending);
        assert(report.modules.length > 0, 'Production verifier modules were not observed');
        assert(
          report.modules.every(
            (row) => !row.failure && row.status === 200 && row.csp === expected.csp,
          ),
          'Verifier module load/policy failure',
        );
        assert.equal(report.pageErrors.length, 0, 'Verifier page errors');
        assert.equal(report.failedRequests.length, 0, 'Verifier request failures');
        report.status =
          report.observation.match && report.observation.status === 'pass' ? 'pass' : 'fail';
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Post-measurement replay verification timed out')),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    report.status = 'fail';
    report.failure = String(error.stack ?? error);
  } finally {
    stopped = true;
    clearTimeout(timer);
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await Promise.all(pending);
    report.completedAt = new Date().toISOString();
    report.modules.sort((a, b) => a.url.localeCompare(b.url));
  }
  return report;
}
