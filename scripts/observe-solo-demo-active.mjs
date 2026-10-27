/* global window, document, innerWidth, innerHeight, devicePixelRatio */
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat, realpath, statfs, mkdtemp, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { verifyNativeQualificationReplay } from './solo-qualification-native-replay.mjs';
import { evaluateQualificationBudgets } from './solo-qualification.mjs';
import {
  prepareCadenceViewport,
  observeSettledCadence,
  calibrateSettledCadence,
} from './solo-qualification-cadence.mjs';
import {
  installDemoRafObserver,
  aggregateRafWindow,
  requiredTaskMetrics,
  taskMetricDeltas,
} from './solo-demo-active-observer.mjs';
const [planPath, outputPath] = process.argv.slice(2);
assert(planPath && outputPath);
const output = resolve(outputPath),
  root = dirname(dirname(fileURLToPath(import.meta.url)));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const planBytes = await readFile(planPath),
  plan = JSON.parse(planBytes);
assert.equal(process.platform, 'linux');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert(process.env.DISPLAY);
assert.match(process.env.SOLO_REMOTE_OWNER ?? '', /^[a-f0-9-]{36}$/);
assert.equal(plan.format, 'SoloHostedDemoScopedRafWorkCaseV1');
assert.equal(plan.status, 'pinned-for-execution');
assert.equal(plan.sourceRole, 'candidate');
assert.equal(plan.engine, 'chromium');
assert.equal(plan.cpuThrottle, 1);
assert.equal(plan.watchingMs, 30000);
assert.equal(plan.deadlineSeconds, 240);
assert.equal(plan.replayTimeoutMs, 120000);
assert.deepEqual(plan.viewport, { width: 1280, height: 800, dpr: 1 });
for (const [field, length] of [
  ['sourceRevision', 40],
  ['buildInfoSha256', 64],
  ['artifactArchiveSha256', 64],
])
  assert.match(plan[field], new RegExp(`^[0-9a-f]{${length}}$`));
const driverHash = sha(await readFile(fileURLToPath(import.meta.url)));
assert.equal(driverHash, plan.driverSha256);
for (const ref of [plan.driver, plan.probe]) {
  const bytes = await readFile(join(root, ref.path));
  assert.equal(bytes.length, ref.bytes);
  assert.equal(sha(bytes), ref.sha256);
}
const checked = async (ref) => {
  const st = await lstat(ref.path);
  assert(st.isFile() && !st.isSymbolicLink() && st.size <= 4 * 1024 ** 2);
  const bytes = await readFile(ref.path);
  assert.equal(bytes.length, ref.bytes);
  assert.equal(sha(bytes), ref.sha256);
  return JSON.parse(bytes);
};
const authority = await checked(plan.commonOwner.verifiedArtifacts);
assert.equal(authority.format, 'SoloHostedVerifiedArtifactsV1');
assert.equal(authority.status, 'passed');
assert.deepEqual(authority.artifacts.candidate, plan.artifact);
assert.equal(plan.artifact.sourceRevision, plan.sourceRevision);
for (const proof of [plan.artifact.sourceProof, plan.artifact.archiveProof])
  assert.equal((await checked(proof)).status, 'passed');
const scratchAuthority = await checked(plan.commonOwner.scratchAuthority),
  storage = scratchAuthority.storage;
assert.equal(scratchAuthority.format, 'SoloHostedRowScratchV1');
assert.equal(storage.scratchRoot, plan.storage.scratch);
assert.equal(storage.outputRoot, dirname(output));
const runner = await realpath(process.env.RUNNER_TEMP),
  scratch = await realpath(plan.storage.scratch);
assert.equal(scratch, plan.storage.scratch);
assert.equal(dirname(storage.scratchOwner.path), runner);
assert.match(storage.scratchOwner.path.slice(runner.length + 1), /^sc-[a-zA-Z0-9]{6}$/);
assert.equal(dirname(scratch), storage.scratchOwner.path);
assert.match(scratch.slice(storage.scratchOwner.path.length + 1), /^r\d{2}$/);
assert(Buffer.byteLength(scratch) <= 52);
for (const [p, dev, ino] of [
  [storage.scratchOwner.path, storage.scratchOwner.device, storage.scratchOwner.inode],
  [scratch, storage.device, storage.inode],
]) {
  const s = await lstat(p);
  assert(s.isDirectory() && !s.isSymbolicLink());
  assert.equal(s.dev, dev);
  assert.equal(s.ino, ino);
}
const free = await statfs(scratch);
assert(free.bavail * free.bsize >= 1024 ** 3);
const report = {
  format: 'SoloHostedDemoScopedRafWorkV1',
  status: 'running',
  startedAt: new Date().toISOString(),
  plan: { path: planPath, sha256: sha(planBytes) },
  driverSha256: driverHash,
  platform: process.platform,
  sourceRevision: plan.sourceRevision,
  artifactArchiveSha256: plan.artifactArchiveSha256,
  scope: plan.scope,
  storage: plan.storage,
  storageAdmission: {
    verifiedArtifacts: plan.commonOwner.verifiedArtifacts,
    scratchAuthority: plan.commonOwner.scratchAuthority,
  },
  actions: [],
  errors: [],
  failedRequests: [],
  sourceResponses: [],
  failure: null,
  fullApplicationCostGateStatus: 'unobserved-timer-and-messagechannel-wake-work-not-timed',
  inputLatencyGateStatus: 'not-applicable-passive-watching',
  instrumentationOverheadStatus: 'unqualified',
  limitations: [
    'rAF callbacks include both owners and are summed at identical native timestamps. Timer/MessageChannel callbacks are not timed; outside-rAF paint counts cannot prove absent fallback/catch-up work.',
    'TaskDuration/ScriptDuration are whole-page cumulative boundary deltas, not per-wake p95 or physical CPU/power/heat measurement.',
    'Main-thread callback duration does not measure GPU completion, workers, native decoding or display presentation. Instrumentation overhead has not been independently qualified.',
    'First callback anchors intervals; registration-to-first callback and all later intervals are retained. No retries, sliding windows or loaded rebaseline.',
  ],
};

let browser,
  context,
  page,
  cdp,
  chrome,
  chromeLog,
  exitPromise,
  exited = false,
  stopped = false,
  timer,
  operation,
  settled = false;
let deadlineTriggered = false,
  selectedRecordingText,
  selectedDefinition;
const save = async () => {
  const bytes = JSON.stringify(report, null, 2) + '\n';
  assert(Buffer.byteLength(bytes) <= 8 * 1024 ** 2, 'Bounded report');
  await writeFile(output, bytes);
};
await writeFile(output, JSON.stringify(report) + '\n', { flag: 'wx' });
const ensure = () => assert(!stopped && !deadlineTriggered, 'Observation owner stopped');
const sourcePending = [];
let sourceCaptureOpen = true;
const record = (action, detail = {}) =>
  report.actions.push({ action, at: new Date().toISOString(), ...detail });
const click = async (selector) => {
  ensure();
  await page.locator(selector).click({ timeout: 60000 });
  record('public-click', { selector });
};
const bounded = async (label, operation, timeoutMs = 5000) => {
  let deadline;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        deadline = setTimeout(() => reject(Error(`${label} exceeded ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
};
const send = (method, params) => bounded(method, () => cdp.send(method, params), 10000);
const metrics = async () => {
  const requestedAt = new Date().toISOString(),
    value = await send('Performance.getMetrics');
  const values = requiredTaskMetrics(value.metrics);
  return { requestedAt, completedAt: new Date().toISOString(), values };
};
const stats = (values, bounds) => {
  const histogram = new Array(bounds.length).fill(0);
  for (const value of values) {
    let slot = bounds.findIndex((bound) => value <= bound);
    if (slot < 0) slot = bounds.length - 1;
    histogram[slot]++;
  }
  return { count: values.length, histogram, maxMs: values.length ? Math.max(...values) : 0 };
};

// Retain the byte-exact original observation protocol below.
// prettier-ignore
const observation = async () => {
  const playwright = await import(pathToFileURL(plan.playwrightModule));
  ensure();
  // Same fresh Chrome/CDP/default-context lifecycle as the retained public Demo driver.
  const profile = await mkdtemp(join(scratch, 'demo-active-'));
  chromeLog = await open(output + '.chrome.log', 'wx');
  chrome = spawn(
    plan.chromeExecutable,
    [
      '--remote-debugging-port=0',
      '--no-sandbox', // Match pinned Playwright Chromium default in this isolated hosted runner.
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,800',
      'about:blank',
    ],
    { detached: true, stdio: ['ignore', chromeLog.fd, chromeLog.fd] },
  );
  report.ownedProcess = {
    pid: chrome.pid,
    profile,
    executable: plan.chromeExecutable,
    sandbox: 'disabled, matching Playwright1.62.1 Chromium default; hosted functional stratum only',
    scope: 'Fresh child of shared ownedCommand token; outer owner performs any forced cleanup.',
  };
  exitPromise = new Promise((resolve) => {
    chrome.once('exit', (code, signal) => {
      exited = true;
      Object.assign(report.ownedProcess, { exitCode: code, exitSignal: signal });
      resolve();
    });
    chrome.once('error', (error) => {
      exited = true;
      report.ownedProcess.error = String(error);
      resolve();
    });
  });
  let port;
  const until = Date.now() + 30000;
  while (!port && Date.now() < until && !exited) {
    ensure();
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (!port) await wait(100);
  }
  assert(Number.isInteger(port) && port > 0 && port < 65536);
  ensure();
  browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
    noDefaults: true,
    isLocal: true,
    timeout: 30000,
  });
  ensure();
  report.browserVersion = browser.version();
  assert.equal(report.browserVersion, plan.browserVersion);
  context = browser.contexts()[0];
  page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 800 });

  cdp = await context.newCDPSession(page);
  await send('Performance.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  report.layoutConfiguration = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };
  report.focusConfiguration = {
    connection: 'connectOverCDP',
    noDefaults: true,
    context: 'Fresh owned default context',
    override: 'No focus or visibility emulation',
  };
  page.on('pageerror', (error) => {
    if (report.errors.length < 100) report.errors.push(String(error).slice(0, 2048));
    else report.overflow = true;
  });
  page.on('requestfailed', (request) => {
    if (report.failedRequests.length < 100)
      report.failedRequests.push({ url: request.url().slice(0, 2048), failure: request.failure() });
    else report.overflow = true;
  });
  await page.bringToFront();
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(prepareCadenceViewport, plan.viewport);
  await page.waitForFunction(({ width, height, dpr }) => innerWidth === width && innerHeight === height && devicePixelRatio === dpr, plan.viewport, { timeout: 2000 });
  report.cadenceCalibration = calibrateSettledCadence(await page.evaluate(observeSettledCadence, { expected: plan.viewport }));
  await page.addInitScript(`(${installDemoRafObserver.toString()})(globalThis);`);
  const admittedSources = new Map(plan.sourceAssets.map((row) => [new URL(row.relative, plan.address).href, row]));
  page.on('response', (response) => {
    const pin = admittedSources.get(response.url()); if (!pin) return;
    if (!sourceCaptureOpen) { report.sourceResponseAfterPreparation = (report.sourceResponseAfterPreparation ?? 0) + 1; return; }
    if (report.sourceResponses.length >= 8) { report.sourceResponseOverflow = true; return; }
    const row = { url: response.url(), requestedRole: pin.role, status: response.status(), at: new Date().toISOString() };
    report.sourceResponses.push(row);
    sourcePending.push((async () => { try { const bytes = await response.body(); assert(bytes.length <= 2 * 1024 * 1024); Object.assign(row, { bytes: bytes.length, sha256: sha(bytes), text: bytes.toString('utf8') }); assert.equal(row.sha256, pin.sha256); assert.equal(row.bytes, pin.bytes); assert.equal(row.status, 200); } catch (error) { row.failure = String(error); } })());
  });
  const response = await page.goto(`${plan.address}?journey=opening`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  report.csp = response.headers()['content-security-policy']; assert.equal(report.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
  if (await page.locator('input[name=password]').isVisible()) { await page.locator('input[name=password]').fill('fixture-password'); await page.getByRole('button', { name: 'Unlock', exact: true }).click(); }
  await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, { timeout: 120000 });
  const identityURL = new URL('build-info.json', plan.address).href;
  const identityText = await page.evaluate(async (url) => { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw Error(`Identity ${response.status}`); return response.text(); }, identityURL);
  const identity = JSON.parse(identityText);
  report.buildIdentity = { url: identityURL, sourceRevision: identity.sourceRevision, version: identity.version, sha256: sha(identityText) };
  assert.equal(identity.sourceRevision, plan.sourceRevision); assert.equal(sha(identityText), plan.buildInfoSha256);
  await page.evaluate(async (base) => {
    const [{ BoardPainter }, { authoritativeCheckpoint }] = await Promise.all([import(new URL('ui/render.mjs', base).href), import(new URL('replay.mjs', base).href)]);
    window.demoRafObservation.install(BoardPainter, authoritativeCheckpoint);
  }, plan.address);
  await click('#shell-options'); await click('#settings-tab-extras'); await click('#shell-demo');
  await page.waitForFunction(() => document.getElementById('demo-dialog')?.dataset.scene === 'playing' && window.demoRafObservation.hasRun(), null, { timeout: 60000 });
  await click('#demo-watch-pause');
  await page.waitForFunction(() => document.getElementById('demo-watch-pause')?.getAttribute('aria-pressed') === 'true', null, { timeout: 10000 });
  await Promise.all(sourcePending); sourceCaptureOpen = false;
  assert(!report.sourceResponseOverflow && report.sourceResponses.every((row) => !row.failure), 'Source fetch witness failed/overflowed');
  const catalogRow = report.sourceResponses.find((row) => row.requestedRole === 'catalog');
  assert(catalogRow, 'Actual catalogue response required');
  const clip = JSON.parse(catalogRow.text).clips[0]; assert.equal(clip.id, plan.expectedClip.id);
  assert.deepEqual(clip, plan.expectedClip, 'Full declared first catalogue entry changed');
  const recordingRows = report.sourceResponses.filter((row) => row.requestedRole === 'replay');
  const selected = recordingRows.at(-1); assert(selected, 'Actual first source recording response required');
  selectedRecordingText = selected.text; const recording = JSON.parse(selectedRecordingText);
  report.selectedSource = { url: selected.url, sha256: selected.sha256, bytes: selected.bytes, selectionEvidence: 'Last ordinary first-clip candidate fetched before prepared public Demo. All candidate attempts retained; full strict verification and actual prefix equality are required separately.' };
  await writeFile(`${output}.source-replay.json`, selectedRecordingText, { flag: 'wx' });
  selectedDefinition = { level: recording.level, options: recording.options };
  report.before = await page.evaluate(() => window.demoRafObservation.snapshot());
  assert.equal(report.before.mutePressed, 'true'); assert.equal(report.before.reducedEffects, false);
  assert.equal(report.before.watchPause, 'true'); assert.equal(report.before.open, true);
  assert.deepEqual(report.before.run.level, recording.level); assert.equal(report.before.run.classId, recording.options.classId);
  assert(report.before.run.tick <= 120, 'First Demo window must start within one simulation second; no source reset/retry');
  report.taskBefore = await metrics();
  report.windowStart = await page.evaluate(() => window.demoRafObservation.begin());
  await click('#demo-watch-pause');
  await wait(plan.watchingMs);
  report.windowStop = await page.evaluate(() => window.demoRafObservation.stop());
  report.taskAfter = await metrics();
  await click('#demo-watch-pause');
  await page.waitForFunction(() => document.getElementById('demo-watch-pause')?.getAttribute('aria-pressed') === 'true', null, { timeout: 10000 });
  report.rawWindow = await page.evaluate(() => window.demoRafObservation.export());
  report.after = report.rawWindow.snapshotAfterPause;
  assert.equal(report.after.sameObservedOwner, true);
  report.checkpointScope = 'Full checkpoint/definition copied only after public Pause. tickAtStop/statusAtStop are numeric observation-boundary witnesses; the later paused checkpoint is independently reconstructed and is not labeled the exact stop-time checkpoint.';
  report.taskDeltas = taskMetricDeltas(report.taskBefore.values, report.taskAfter.values);
  report.taskScope = 'Boundary deltas include begin/Resume/stop RPC work and scheduling brackets. Numeric stop precedes TaskAfter, public Pause and buffer/checkpoint serialization; not an exact sum of timed rAF work or all-wake p95.';
  assert.equal(report.after.mutePressed, 'true'); assert.equal(report.after.reducedEffects, false);
  assert.equal(report.rawWindow.ownerChanged, false, 'First Demo owner changed during declared window');
  assert(report.rawWindow.endedAtMs - report.rawWindow.startedAtMs >= 30000);
  assert.deepEqual(report.after.run.level, recording.level);
  assert(report.windowStop.tickAtStop > report.before.run.tick, 'Watching did not advance');
  // Independent reconstructed state only, after timing has ended. No live state/replay rewrite.
  report.prefixProof = await page.evaluate(async ({ source, snapshots, base }) => {
    const core = await import(new URL('core/index.mjs', base).href), replay = await import(new URL('replay.mjs', base).href);
    const recording = JSON.parse(source), rows = [];
    for (const snapshot of snapshots) {
      const state = core.createRun(recording.level, recording.options), target = snapshot.run.tick;
      for (const segment of recording.segments) {
        if (state.tick >= target) break;
        if (segment.releaseBefore) core.releaseInputs(state);
        for (let i = 0; i < segment.ticks && state.tick < target; i++) core.stepRun(state, segment.input, core.FIXED_DT);
      }
      if (target === recording.ticks && recording.releaseAfter) core.releaseInputs(state);
      const actual = replay.authoritativeCheckpoint(state);
      rows.push({ target, actual, observed: snapshot.run.checkpoint, match: state.tick === target && actual.hash === snapshot.run.checkpoint.hash });
    }
    return { rows, status: rows.every((row) => row.match) ? 'pass' : 'fail', scope: 'Read-only independent prefix reconstruction after observation in the same observed engine. Unchanged full source is strictly verified in a fresh browser after closure.' };
  }, { source: selectedRecordingText, snapshots: [report.before, report.after], base: plan.address });
  assert.equal(report.prefixProof.status, 'pass', 'Live Demo state does not match unchanged recorded source');
  report.aggregate = aggregateRafWindow(report.rawWindow, report.cadenceCalibration.baselineMs);
  assert(report.aggregate.valid, 'Observer/foreground/environment/owner integrity failed');
  assert(report.aggregate.demoFrames > 0 && report.aggregate.phaserFrames > 0, 'Both frame owners must be observed');
  const bounds = Array.from({ length: 2000 }, (_, i) => (i + 1) / 10).concat([500, 1000, 5000, 60000, Number.MAX_VALUE]);
  const frames = { ...stats(report.aggregate.intervals, bounds), missedOpportunities: report.aggregate.missedOpportunities, maxMissedStreak: report.aggregate.maxMissedStreak };
  const work = stats(report.aggregate.frames.map((row) => row.workMs), bounds);
  const budget = evaluateQualificationBudgets({ enabled: true, baselineMs: report.cadenceCalibration.baselineMs, cadenceCalibration: report.cadenceCalibration, histogramUpperBoundsMs: bounds, phases: { playing: { frames, work, durationMs: report.rawWindow.endedAtMs - report.rawWindow.startedAtMs } } });
  report.scopedRafGates = { checks: budget.checks.slice(0, 4), review: budget.review, scope: 'Only aggregate native-rAF application work and callback cadence. Full application-wake, passive input and physical display gates are not claimed.' };
  report.scopedRafGates.status = report.scopedRafGates.checks.some((row) => row.status === 'fail') ? 'fail' : report.scopedRafGates.review.length ? 'review-required' : report.scopedRafGates.checks.every((row) => row.status === 'pass') ? 'pass-scoped-raf-only' : 'inconclusive';
  assert(!report.sourceResponseAfterPreparation, 'Unexpected source fetch after prepared window');
  assert.equal(report.errors.length, 0, 'Page errors retained'); assert(!deadlineTriggered, 'Observation deadline reached');

  ensure();
  assert(!report.overflow);
  assert.equal(report.failedRequests.length, 0);
  report.functionalStatus = 'pass';
};
const closeObservation = async () => {
  if (browser) await bounded('observation browser close', () => browser.close(), 5000);
  if (chrome && !exited) await bounded('observation process exit', () => exitPromise, 5000);
  report.observedBrowserClosed = Boolean(
    browser &&
      !browser.isConnected() &&
      exited &&
      report.ownedProcess.exitCode === 0 &&
      !report.ownedProcess.exitSignal &&
      !report.ownedProcess.error,
  );
  report.observedBrowserClosedAt = new Date().toISOString();
  await chromeLog?.close();
  assert.equal(report.observedBrowserClosed, true);
};
try {
  timer = setTimeout(() => {
    stopped = true;
    report.deadlineReached = true;
    deadlineTriggered = true;
    void browser?.close().catch(() => {});
  }, 240000);
  operation = observation();
  operation.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await operation;
} catch (error) {
  report.failure = String(error.stack ?? error);
} finally {
  stopped = true;
  clearTimeout(timer);
  try {
    await closeObservation();
  } catch (error) {
    report.cleanupFailure = String(error);
  }
  if (operation && !settled)
    try {
      await bounded('observation drain', () => operation.catch(() => {}), 5000);
    } catch (error) {
      report.observationDrainFailure = String(error);
    }
  report.observationSettled = settled;
  try {
    await bounded('closed source response drain', () => Promise.all(sourcePending), 5000);
  } catch (error) {
    report.sourceDrainFailure = String(error);
  }
  await save();
}

if (
  report.functionalStatus === 'pass' &&
  report.observedBrowserClosed &&
  settled &&
  !report.cleanupFailure &&
  !report.deadlineReached &&
  !report.sourceDrainFailure &&
  !report.overflow
) {
  const playwright = await import(pathToFileURL(plan.playwrightModule));
  const launched = [];
  const observedPlaywright = {
    chromium: {
      launch: async (...args) => {
        const value = await playwright.chromium.launch(...args);
        launched.push(value);
        return value;
      },
    },
  };
  let pendingVerifier;
  try {
    pendingVerifier = verifyNativeQualificationReplay({
      playwright: observedPlaywright,
      engine: 'chromium',
      executablePath: plan.chromeExecutable,
      observedBrowserClosed: true,
      expected: {
        browserVersion: report.browserVersion,
        buildIdentity: report.buildIdentity,
        csp: report.csp,
      },
      recordingText: selectedRecordingText,
      expectedDefinition: selectedDefinition,
      requirements: {},
      timeoutMs: 120000,
    });
    report.nativeReplay = await bounded('strict source replay', () => pendingVerifier, 125000);
    assert.equal(report.nativeReplay.status, 'pass');
    assert(
      launched.length === 1 && launched.every((b) => !b.isConnected()),
      'Verifier browser closure not confirmed',
    );
    report.nativeReplay.ownedBrowserClosed = true;
  } catch (error) {
    report.nativeReplay ??= { status: 'fail' };
    report.nativeReplay.status = 'fail';
    report.nativeReplay.failure = String(error);
    if (pendingVerifier)
      try {
        await bounded('verifier drain', () => pendingVerifier, 5000);
      } catch (e) {
        report.verifierDrainFailure = String(e);
      }
  }
}
report.status =
  report.functionalStatus === 'pass' &&
  report.nativeReplay?.status === 'pass' &&
  report.nativeReplay.ownedBrowserClosed &&
  report.observedBrowserClosed &&
  report.observationSettled &&
  !report.deadlineReached &&
  !report.cleanupFailure &&
  !report.overflow &&
  !report.observationDrainFailure &&
  !report.verifierDrainFailure &&
  !report.sourceDrainFailure &&
  !report.sourceResponseAfterPreparation &&
  !report.sourceResponses.some((s) => s.failure) &&
  !report.errors.length &&
  !report.failedRequests.length
    ? 'pass-scoped-observation'
    : 'fail';
report.completedAt = new Date().toISOString();
await save();
process.exitCode = report.status === 'pass-scoped-observation' ? 0 : 1;
