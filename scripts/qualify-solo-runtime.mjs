/* global window, document, navigator, requestAnimationFrame, MutationObserver,
PerformanceObserver, AudioBufferSourceNode, OscillatorNode, HTMLMediaElement */
import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { arch, release, loadavg } from 'node:os';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import {
  validateQualification,
  resourceStability,
  createManifestMirror,
  evaluateQualificationBudgets,
  memoryProfileSummary,
  quantileBound,
  FRAME_BOUNDS,
} from './solo-qualification.mjs';

// Public UI only. Never write application storage, run state, clocks or caches.
// Recovery injection is a separately labeled scenario, not native device loss.
const [address, scenarioPath, output, ...flags] = process.argv.slice(2);
if (!address || !scenarioPath || !output || !process.env.PLAYWRIGHT_MODULE)
  throw new Error(
    'Usage: PLAYWRIGHT_MODULE=<path> node scripts/qualify-solo-runtime.mjs <Solo URL> <scenario.json> <new-report.json> [--browser=webkit] [--source-revision=<sha>] [--server-fixture-access|--fixture-access] [--public-url=<original production URL> --manifest=<frozen manifest>] [--headed] [--cpu=4] [--memory-profile]',
  );
const option = (key, fallback) =>
  flags.find((flag) => flag.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const bytes = await readFile(resolve(scenarioPath)),
  scenario = validateQualification(JSON.parse(bytes));
const engine = option('browser', 'chromium'),
  cpu = Number(option('cpu', '1'));
const memoryProfile = flags.includes('--memory-profile');
assert(['chromium', 'webkit'].includes(engine) && Number.isFinite(cpu) && cpu >= 1 && cpu <= 20);
assert(engine === 'chromium' || cpu === 1, 'CPU throttling is Chromium-only');
assert(!memoryProfile || engine === 'chromium', 'Heap/DOM profiling is Chromium-only');
try {
  await access(resolve(output));
  throw new Error('Refusing to overwrite existing evidence. Choose a new output path.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const localURL = new URL(address),
  url = new URL(option('public-url', address));
const mirrored = url.origin !== localURL.origin || url.pathname !== localURL.pathname;
let mirror, mirrorManifest;
if (mirrored) {
  assert(option('manifest', null), 'Public-origin mirroring requires the frozen package manifest');
  const manifestBytes = await readFile(resolve(option('manifest')));
  const manifest = JSON.parse(manifestBytes);
  if (option('source-revision', null))
    assert.equal(manifest.sourceRevision, option('source-revision'));
  mirror = createManifestMirror(manifest, url.href, localURL.href);
  mirrorManifest = {
    sourceRevision: manifest.sourceRevision,
    sha256: createHash('sha256').update(manifestBytes).digest('hex'),
    files: manifest.files.length,
  };
}
const fixtureAccess = flags.includes('--fixture-access');
const serverFixtureAccess = flags.includes('--server-fixture-access');
assert(
  !(fixtureAccess && serverFixtureAccess),
  'Choose server or routing access fixture, not both',
);
assert(
  !(fixtureAccess || serverFixtureAccess) ||
    ['localhost', '127.0.0.1', '[::1]'].includes(localURL.hostname),
  'Access fixture requires a local transport',
);
if (scenario.query)
  for (const [key, value] of Object.entries(scenario.query)) url.searchParams.set(key, value);
url.searchParams.set('performance', '1');
const report = {
  format: 'SoloQualificationReportV1',
  scenario: scenario.id,
  kind: memoryProfile ? 'memory-profile' : scenario.kind,
  scenarioKind: scenario.kind,
  sourceRevision: option('source-revision', null),
  scenarioSHA256: createHash('sha256').update(bytes).digest('hex'),
  requestedCoverage: scenario.coverage,
  startedAt: new Date().toISOString(),
  scenarioStatus: 'running',
  performanceGateStatus: 'not-evaluated',
  mirrorManifest: mirrorManifest ?? null,
  environment: {
    engine,
    cpuThrottle: cpu,
    headless: !flags.includes('--headed'),
    architecture: arch(),
    osRelease: release(),
    initialLoad: loadavg(),
    url: url.href,
    localTransport: mirrored ? localURL.href : null,
  },
  limitations: [
    'Scenario action/replay/resource success is separate from conservative observed-window numerical gates. Cohort comparisons, matched overhead and physical-device qualification remain required.',
    'Keyboard and ordinary UI actions use native elapsed time. No fixed-tick replay or simulation mutation; a route that misses its expected result fails.',
    'Requested coverage is not proof that a mechanic occurred. Assertions and visible results are recorded separately.',
    'Desktop browser observations do not qualify iPhone Safari, Steam Deck graphics, thermals, touch, controllers or actual orientation.',
    'rAF histograms are quantile bounds. Previous-phase attribution retains transition-crossing intervals; browser GPU completion is unobserved.',
    ...(serverFixtureAccess
      ? [
          'Local server HTML access fixture; no browser routing is added unless public-origin mirroring was requested.',
        ]
      : []),
    'Resource export happens only at explicit paused/result checkpoints. Owned categories may overlap; no total memory or leak-free claim.',
    'Audio source starts/play-promise fulfillment demonstrate API activity, not audible output or complete speech/music coverage.',
    'This harness adds phase/rAF and audio-API observers. Its timing is not a measurement of ordinary diagnostics overhead.',
    ...(memoryProfile
      ? [
          'Forced GC and heap/DOM observations perturb the browser. This whole run is excluded from timing qualification. No Memory.prepareForLeakDetection, worker termination or cache retirement is used.',
        ]
      : []),
    ...(fixtureAccess || mirrored
      ? [
          'Playwright routing disables HTTP cache. This is a fixture/network-transport run, not warm-cache qualification.',
        ]
      : []),
    ...(mirrored
      ? [
          'Original origin is preserved. All manifest-admitted deployment paths use local transport, including authoring imports. Missing deployment paths are blocked; only the explicit sibling soundtrack publication may use the live public origin. Policy is unchanged.',
        ]
      : []),
    ...(scenario.kind === 'recovery'
      ? [
          'Synthetic lifecycle/Canvas events test application handlers only; they do not lose or restore a native context.',
        ]
      : []),
  ],
  actions: [],
  snapshots: [],
  uploads: [],
  pageErrors: [],
  failedResponses: [],
  failure: null,
};
await mkdir(dirname(resolve(output)), { recursive: true });
async function save() {
  const target = resolve(output),
    temporary = target + '.partial';
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
  await rename(temporary, target);
}
await save();
let browser, context, page, deadline, nativeReplay, cdp;
let memorySnapshots = 0;
async function profileMemory() {
  if (!memoryProfile) return undefined;
  if (memorySnapshots++ >= 64)
    return { status: 'unobserved-cap', reason: '64 pause-only profiles per run maximum.' };
  const read = async () => {
    const [heap, dom] = await Promise.all([
      cdp.send('Runtime.getHeapUsage'),
      cdp.send('Memory.getDOMCounters'),
    ]);
    return { heap, dom };
  };
  let timer;
  const result = { status: 'running', at: new Date().toISOString() };
  try {
    await Promise.race([
      (async () => {
        result.before = await read();
        await cdp.send('HeapProfiler.collectGarbage');
        result.after = await read();
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Pause-only memory profile exceeded10s')), 10000);
      }),
    ]);
    result.status = 'observed';
  } catch (error) {
    result.status = 'failed';
    result.error = String(error.stack ?? error);
  } finally {
    clearTimeout(timer);
  }
  result.method =
    'Pause-only HeapProfiler.collectGarbage between Runtime.getHeapUsage + Memory.getDOMCounters reads; owned resources are the adjacent application export.';
  return result;
}
try {
  const playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
  browser = await playwright[engine].launch({
    ...(engine === 'chromium' ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
    headless: !flags.includes('--headed'),
  });
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
  });
  report.limitations.push(
    'Service workers are explicitly blocked for controlled online qualification; offline/update lifecycle is separate.',
  );
  page = await context.newPage();
  if (memoryProfile || cpu !== 1) cdp = await context.newCDPSession(page);
  page.on('pageerror', (error) => {
    if (report.pageErrors.length < 100) report.pageErrors.push(String(error.stack ?? error));
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && report.failedResponses.length < 100)
      report.failedResponses.push({ url: response.url(), status: response.status() });
  });
  if (mirrored || fixtureAccess)
    await page.route('**/*', async (route) => {
      const requested = new URL(route.request().url());
      const decision = mirror?.(requested.href);
      if (decision?.kind === 'blocked') {
        if (report.failedResponses.length < 100)
          report.failedResponses.push({ url: requested.href, blocked: decision.reason });
        return route.abort('blockedbyclient');
      }
      const mapped = decision?.kind === 'local' ? decision.url : null;
      const entry =
        requested.origin === url.origin && route.request().resourceType() === 'document';
      if (!mapped && !(entry && fixtureAccess && !mirrored)) return route.continue();
      const response = await route.fetch(mapped ? { url: mapped } : {});
      if (entry)
        assert.equal(
          response.headers()['content-security-policy'],
          PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
          'Exact production CSP required',
        );
      if (!(entry && fixtureAccess)) return route.fulfill({ response });
      const body = (await response.text())
        .replace(
          /(name="revealline-access-salt"\s+content=")[^"]+/,
          '$1' + Buffer.from('performance-fixture').toString('base64url'),
        )
        .replace(
          /(name="revealline-access-verifier"\s+content=")[^"]+/,
          '$1' +
            pbkdf2Sync('fixture-password', 'performance-fixture', 150000, 32, 'sha256').toString(
              'base64url',
            ),
        );
      await route.fulfill({ response, body });
    });
  await page.addInitScript(
    ({ bounds }) => {
      const phases = ['boot', 'briefing', 'running', 'paused', 'result', 'picture', 'other'];
      const counts = phases.map(() => new Float64Array(bounds.length));
      const totals = new Float64Array(phases.length * 5),
        tail = new Float64Array(256 * 4);
      let observedGame, phaser;
      // Capture the constructed owner once. Never wrap update/draw, evaluate
      // drawOptions, or recompute presentation ownership during active play.
      Object.defineProperty(window, 'Phaser', {
        configurable: true,
        get: () => phaser,
        set(value) {
          phaser = value;
          const Game = value.Game;
          value.Game = class extends Game {
            constructor(...args) {
              super(...args);
              observedGame = this;
            }
          };
        },
      });
      let previous = performance.now(),
        phase = 0,
        previousPhase = 0,
        tailCount = 0;
      const audio = {
        oscillatorStarts: 0,
        sourceStarts: 0,
        sourceStartFailures: 0,
        mediaPlayRequests: 0,
        mediaPlayResolved: 0,
        mediaPlayRejected: 0,
      };
      if (typeof AudioBufferSourceNode !== 'undefined') {
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
          try {
            const result = start.apply(this, args);
            audio.sourceStarts++;
            return result;
          } catch (error) {
            audio.sourceStartFailures++;
            throw error;
          }
        };
      }
      if (typeof OscillatorNode !== 'undefined') {
        const start = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...args) {
          const result = start.apply(this, args);
          audio.oscillatorStarts++;
          return result;
        };
      }
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        audio.mediaPlayRequests++;
        const result = play.apply(this, args);
        result?.then(
          () => audio.mediaPlayResolved++,
          () => audio.mediaPlayRejected++,
        );
        return result;
      };
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          const update = () => {
            const n = phases.indexOf(document.body.dataset.flightState);
            phase = n < 0 ? 6 : n;
          };
          update();
          new MutationObserver(update).observe(document.body, {
            attributes: true,
            attributeFilter: ['data-flight-state'],
          });
        },
        { once: true },
      );
      function frame(now) {
        const dt = now - previous,
          offset = previousPhase * 5;
        let bucket = 0;
        while (bounds[bucket] !== null && dt > bounds[bucket]) bucket++;
        counts[previousPhase][bucket]++;
        totals[offset]++;
        totals[offset + 1] += dt;
        totals[offset + 2] = Math.max(totals[offset + 2], dt);
        if (dt >= 50) totals[offset + 3]++;
        if (dt >= 100) totals[offset + 4]++;
        if (dt >= 50) {
          const index = (tailCount++ % 256) * 4;
          tail[index] = previous;
          tail[index + 1] = now;
          tail[index + 2] = previousPhase;
          tail[index + 3] = phase;
        }
        previous = now;
        previousPhase = phase;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      window.soloQualificationProbe = {
        presentation: () => ({
          atMs: performance.now(),
          phase: document.body?.dataset.flightState,
          submittedTier:
            observedGame?.scene?.scenes?.find((scene) => scene.lastPaint)?.lastPaint?.quality ??
            null,
          scope:
            'Retained last submitted paint record only; sparse action-boundary observations do not establish the tier between samples.',
        }),
        export: () => ({
          phases,
          bounds,
          counts: counts.map((x) => Array.from(x)),
          totals: Array.from(totals),
          tailCount,
          tail: Array.from(tail.subarray(0, Math.min(256, tailCount) * 4)),
          audio: { ...audio },
          now: performance.now(),
        }),
      };
    },
    { bounds: FRAME_BOUNDS },
  );
  if (cpu !== 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const entryURL = scenario.entryPath ? new URL(scenario.entryPath, url) : url;
  const response = await page.goto(entryURL.href, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  assert.equal(
    response.headers()['content-security-policy'],
    PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
    'Exact production CSP required',
  );
  report.csp = response.headers()['content-security-policy'];
  if (
    (fixtureAccess || serverFixtureAccess) &&
    (await page.locator('input[name=password]').isVisible())
  ) {
    await page.locator('input[name=password]').fill('fixture-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  }
  if (scenario.readySelector)
    await page.locator(scenario.readySelector).waitFor({ state: 'visible', timeout: 120000 });
  else
    await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
      timeout: 120000,
    });
  report.readyAt = new Date().toISOString();
  report.environment.userAgent = await page.evaluate(() => navigator.userAgent);
  deadline = Date.now() + scenario.timeoutMs;
  const remaining = (action) => {
    const time = Math.min(action.timeoutMs ?? 30000, deadline - Date.now());
    assert(time > 0, 'Scenario deadline exceeded');
    return time;
  };
  async function execute(actions, prefix = '') {
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index],
        path = `${prefix}${index}`,
        record = {
          path,
          type: action.type,
          startedAt: new Date().toISOString(),
          status: 'running',
        };
      report.actions.push(record);
      const timeout = remaining(action),
        locator = action.selector ? page.locator(action.selector) : null;
      try {
        if (action.type === 'repeat') {
          const started = Date.now();
          let completed = 0;
          for (; completed < action.count; completed++) {
            await execute(action.actions, `${path}.${completed}.`);
            if (action.atLeastMs !== undefined && Date.now() - started >= action.atLeastMs) {
              completed++;
              break;
            }
          }
          record.iterations = completed;
          record.elapsedMs = Date.now() - started;
          assert(
            action.atLeastMs === undefined || record.elapsedMs >= action.atLeastMs,
            'Repeat cap reached before requested duration',
          );
        } else if (action.type === 'click') {
          if (action.optional && !(await locator.isVisible()))
            record.status = 'skipped-not-visible';
          else await locator.click({ timeout });
        } else if (action.type === 'reload') {
          await page.reload({ waitUntil: 'domcontentloaded', timeout });
          if (
            (fixtureAccess || serverFixtureAccess) &&
            (await page.locator('input[name=password]').isVisible())
          ) {
            await page.locator('input[name=password]').fill('fixture-password');
            await page.getByRole('button', { name: 'Unlock', exact: true }).click();
          }
          await page.waitForFunction(
            () => document.documentElement.dataset.bootState === 'ready',
            null,
            { timeout },
          );
        } else if (action.type === 'follow') {
          const href = await locator.getAttribute('href');
          assert(href, 'Missing prepared UI link');
          const destination = new URL(href, page.url());
          assert.equal(
            destination.origin,
            url.origin,
            'Qualification navigation must stay in the admitted origin',
          );
          destination.searchParams.set('performance', '1');
          await page.goto(destination.href, { waitUntil: 'domcontentloaded', timeout });
          if (
            (fixtureAccess || serverFixtureAccess) &&
            (await page.locator('input[name=password]').isVisible())
          ) {
            await page.locator('input[name=password]').fill('fixture-password');
            await page.getByRole('button', { name: 'Unlock', exact: true }).click();
          }
          await page.waitForFunction(
            () => document.documentElement.dataset.bootState === 'ready',
            null,
            { timeout },
          );
        } else if (action.type === 'select') await locator.selectOption(action.value, { timeout });
        else if (action.type === 'check') await locator.setChecked(action.value, { timeout });
        else if (action.type === 'fill') await locator.fill(action.value, { timeout });
        else if (action.type === 'upload') {
          const file = resolve(dirname(resolve(scenarioPath)), action.file),
            data = await readFile(file);
          report.uploads.push({
            path: action.file,
            bytes: data.length,
            sha256: createHash('sha256').update(data).digest('hex'),
          });
          await locator.setInputFiles(file, { timeout });
        } else if (action.type === 'key') {
          assert(
            action.ms <= deadline - Date.now(),
            'Key duration exceeds remaining scenario budget',
          );
          await page.keyboard.down(action.key);
          try {
            await page.waitForTimeout(action.ms);
          } finally {
            await page.keyboard.up(action.key);
          }
        } else if (action.type === 'wait') {
          if (action.phase) {
            await page.waitForFunction(
              (value) => document.body.dataset.flightState === value,
              action.phase,
              { timeout },
            );
            if (action.phase === 'running')
              record.firstActivePresentation = await page.evaluate(() =>
                window.soloQualificationProbe.presentation(),
              );
          } else {
            assert(action.ms <= deadline - Date.now());
            await page.waitForTimeout(action.ms);
          }
        } else if (action.type === 'expect') {
          await locator.waitFor({ state: 'visible', timeout });
          if (action.contains !== undefined) {
            record.actual = (await locator.textContent()).trim();
            assert(
              record.actual.includes(action.contains),
              'Required public text fragment missing',
            );
          } else if (action.attribute) {
            record.actual = await locator.getAttribute(action.attribute);
            assert.equal(record.actual, action.value);
          } else if (action.value !== undefined) {
            record.actual = (await locator.textContent()).trim();
            assert.equal(record.actual, action.value);
          } else record.actual = 'visible';
        } else if (action.type === 'resize')
          await page.setViewportSize({ width: action.width, height: action.height });
        else if (action.type === 'fault')
          await page.evaluate(({ selector, event }) => {
            const target = selector ? document.querySelector(selector) : window;
            if (!target) throw new Error('Missing injected-event target');
            target.dispatchEvent(
              new Event(
                { 'canvas-loss': 'contextlost', 'canvas-restore': 'contextrestored' }[event] ??
                  event,
              ),
            );
          }, action);
        else if (action.type === 'exportReplay') {
          assert.notEqual(
            await page.locator('body').getAttribute('data-flight-state'),
            'running',
            'Export only after measured gameplay',
          );
          await page.locator('#shell-menu').click({ timeout });
          await page.locator('#shell-options').click({ timeout });
          await page.locator('#settings-tab-extras').click({ timeout });
          await page.locator('#shell-workshop').click({ timeout });
          const summary = page.locator('details:has(#export-replay) > summary');
          if (!(await page.locator('#export-replay').isVisible())) await summary.click({ timeout });
          await page.locator('#export-replay').click({ timeout });
          await page.locator('#replay-dialog').waitFor({ state: 'visible', timeout });
          const text = await page.locator('#replay-json').inputValue();
          assert(Buffer.byteLength(text) <= 32 * 1024 * 1024, 'Replay exceeds public byte bound');
          nativeReplay = text;
          record.bytes = Buffer.byteLength(text);
        } else if (action.type === 'snapshot') {
          const snapshot = await page.evaluate(() => {
            const phase = document.body.dataset.flightState;
            if (phase === 'running')
              throw new Error('Resource snapshots require an explicit paused/result boundary');
            return {
              phase,
              application: window.RevealLineSoloPerformance?.export() ?? null,
              presentation: window.soloQualificationProbe.presentation(),
              probe: window.soloQualificationProbe.export(),
              hud: Object.fromEntries(
                ['coverage', 'lives', 'time', 'score', 'run-message'].map((id) => [
                  id,
                  document.getElementById(id)?.textContent ?? null,
                ]),
              ),
            };
          });
          assert(snapshot.application, 'Required application diagnostics unavailable');
          if (report.sourceRevision)
            assert.equal(
              snapshot.application.sourceRevision,
              report.sourceRevision,
              'Observed generated runtime does not match the declared source revision',
            );
          const row = {
            group: action.group,
            action: path,
            ...snapshot,
            qualityPolicy: snapshot.application.quality ?? null,
          };
          report.snapshots.push(row);
          row.memory = await profileMemory();
          assert(
            row.memory?.status !== 'failed',
            'Pause-only memory profile failed; partial application data retained',
          );
        }
        if (record.status === 'running') record.status = 'pass';
      } catch (error) {
        record.status = 'fail';
        record.failure = String(error.stack ?? error);
        throw error;
      } finally {
        record.completedAt = new Date().toISOString();
      }
      // Serialize only between actions, never in a browser animation callback.
      if (action.type === 'snapshot' || action.type === 'repeat') await save();
    }
  }
  await execute(scenario.actions);
  if (scenario.expectAudio) {
    const probe = await page.evaluate(() => window.soloQualificationProbe.export());
    const audio = report.snapshots.at(-1)?.application?.audio;
    report.audioCheck = { observed: probe.audio, master: audio, requirement: scenario.expectAudio };
    assert.equal(audio?.muted, false, 'Expected an unmuted master at the final paused checkpoint');
    assert(audio.volume > 0, 'Expected nonzero master volume');
    assert(
      probe.audio.sourceStarts + probe.audio.oscillatorStarts + probe.audio.mediaPlayResolved >=
        scenario.expectAudio.nativeStartsAtLeast,
      'No successful native audio-source starts were observed',
    );
  }
  report.resources = resourceStability(report.snapshots, scenario.resourceRules);
  assert(
    !report.resources.some((row) => row.status !== 'pass'),
    'Resource stability rule failed or was unobserved',
  );
  assert.equal(report.pageErrors.length, 0, 'Uncaught page errors were observed');
  report.scenarioStatus = 'pass';
} catch (error) {
  report.scenarioStatus = 'fail';
  report.failure = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (page && !page.isClosed()) {
    try {
      if (report.scenarioStatus === 'fail') {
        try {
          const beforeStop = await page.locator('body').getAttribute('data-flight-state');
          report.failureCleanup = { beforeStop, inducedPause: false };
          if (beforeStop === 'running') {
            report.failureCleanup.inducedPause = true;
            await page.keyboard.press('Escape');
            await page.waitForFunction(
              () => document.body.dataset.flightState !== 'running',
              null,
              { timeout: 5000 },
            );
          }
          const partial = await page.evaluate(() => {
            const phase = document.body.dataset.flightState;
            return {
              phase,
              application:
                phase !== 'running' ? (window.RevealLineSoloPerformance?.export() ?? null) : null,
              presentation: window.soloQualificationProbe?.presentation() ?? null,
            };
          });
          report.failureCleanup.afterStop = partial.phase;
          if (partial.application)
            report.snapshots.push({
              group: 'failed-attempt-partial',
              ...partial,
              qualityPolicy: partial.application.quality ?? null,
              harnessInducedBoundary: beforeStop === 'running',
              memory: await profileMemory(),
            });
        } catch (error) {
          report.failureCleanupFailure = String(error.stack ?? error);
        }
      }
      report.finalState = await page.evaluate(() => ({
        state: document.body?.dataset.flightState,
        boot: document.documentElement.dataset.bootState,
        probe: window.soloQualificationProbe?.export(),
      }));
      const probe = report.finalState.probe;
      if (probe)
        report.cadence = probe.phases.map((phase, index) => ({
          phase,
          count: probe.totals[index * 5],
          totalMs: probe.totals[index * 5 + 1],
          maximumMs: probe.totals[index * 5 + 2],
          atLeast50ms: probe.totals[index * 5 + 3],
          atLeast100ms: probe.totals[index * 5 + 4],
          p95: quantileBound(probe.counts[index], 0.95),
          p99: quantileBound(probe.counts[index], 0.99),
        }));
    } catch (error) {
      report.finalReadFailure = String(error.message);
    }
  }
  report.completedAt = new Date().toISOString();
  report.environment.finalLoad = loadavg();
  await save();
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  if (memoryProfile) {
    report.performanceGateStatus = 'excluded-memory-profiling';
    report.memory = memoryProfileSummary(report.snapshots);
  } else if (scenario.kind !== 'recovery') {
    try {
      report.performanceGates = evaluateQualificationBudgets(report.snapshots.at(-1)?.application);
      report.performanceGateStatus = report.performanceGates.status;
    } catch (error) {
      report.performanceGateStatus = 'invalid-evidence';
      report.performanceGateFailure = String(error.stack ?? error);
    }
  } else report.performanceGateStatus = 'excluded-synthetic-recovery';
  if (nativeReplay) {
    try {
      const file = resolve(output) + '.replay.json';
      await writeFile(file, nativeReplay, { flag: 'wx' });
      report.replay = {
        file,
        sha256: createHash('sha256').update(nativeReplay).digest('hex'),
        bytes: Buffer.byteLength(nativeReplay),
      };
      const { inspectQualificationReplay } = await import('./solo-qualification-replay.mjs');
      report.replay.observation = inspectQualificationReplay(
        JSON.parse(nativeReplay),
        scenario.replayRequirements,
      );
      assert.equal(
        report.replay.observation.status,
        'pass',
        'Native recording did not exercise required mechanics',
      );
    } catch (error) {
      report.scenarioStatus = 'fail';
      report.replayFailure = String(error.stack ?? error);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode && ['fail', 'invalid-evidence'].includes(report.performanceGateStatus))
    process.exitCode = 2;
  await save();
}
