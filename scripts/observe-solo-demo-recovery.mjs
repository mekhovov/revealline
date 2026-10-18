/* global window, document */
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat, realpath, statfs, mkdtemp, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import {
  readPublicQualificationReplay,
  waitQualificationControl,
} from './solo-qualification-export.mjs';
import { verifyNativeQualificationReplay } from './solo-qualification-native-replay.mjs';
import { installDemoRecoveryProbe } from './solo-demo-recovery-probe.mjs';
import { DEMO_ARMS, unchanged, validQuality } from './solo-remote-demo.mjs';

const [planPath, outputPath] = process.argv.slice(2);
assert(planPath && outputPath);
const output = resolve(outputPath),
  here = dirname(fileURLToPath(import.meta.url)),
  root = dirname(here);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const planBytes = await readFile(planPath),
  plan = JSON.parse(planBytes);
assert.equal(process.platform, 'linux');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert(process.env.DISPLAY);
assert.match(process.env.SOLO_REMOTE_OWNER ?? '', /^[a-f0-9-]{36}$/);
assert.equal(plan.format, 'SoloHostedDemoRecoveryCaseV1');
assert.equal(plan.status, 'pinned-for-execution');
assert.equal(plan.sourceRole, 'candidate');
assert.equal(plan.cpuThrottle, 1);
assert.equal(plan.observationTimeoutMs, 360000);
assert.equal(plan.replayTimeoutMs, 120000);
assert.deepEqual(plan.arms, DEMO_ARMS);
assert.deepEqual(plan.qualityWindowsMs, [5000, 2500]);
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
  format: 'SoloHostedDemoRecoveryV1',
  status: 'fail',
  sourceRevision: plan.sourceRevision,
  plan: { path: planPath, sha256: sha(planBytes) },
  startedAt: new Date().toISOString(),
  performanceExclusion: true,
  automaticQualityTransition: 'not-observed',
  snapshots: [],
  arms: [],
  qualityWindows: [],
  errors: [],
  failedRequests: [],
  sources: [],
  events: [],
};
let browser,
  context,
  page,
  chrome,
  chromeLog,
  exitPromise,
  exited = false,
  stopped = false,
  timer,
  operation,
  settled = false;
let recordingBefore,
  recordingAfter,
  sourceText,
  ordinaryBefore,
  practiceAtTakeover,
  sourceCapture = true;
const pending = [];
const save = async () => {
  const bytes = JSON.stringify(report, null, 2) + '\n';
  assert(Buffer.byteLength(bytes) <= 2 * 1024 ** 2, 'Report cap');
  await writeFile(output, bytes);
};
await writeFile(output, JSON.stringify(report) + '\n', { flag: 'wx' });
const ensure = () => assert(!stopped && !report.deadlineReached, 'Observation owner stopped');
const bounded = async (label, fn, ms = 10000) => {
  let t;
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        t = setTimeout(() => reject(Error(`${label} deadline`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(t);
  }
};
const retain = (list, value, max) => {
  if (list.length >= max) {
    report.overflow = true;
    throw Error('Bounded evidence overflow');
  }
  list.push(value);
};
const click = async (selector) => {
  ensure();
  await waitQualificationControl(page, selector, 15000);
  ensure();
  await page.locator(selector).click({ timeout: 15000 });
};
const phase = (value) =>
  page.waitForFunction((v) => document.body?.dataset.flightState === v, value, { timeout: 60000 });
const snap = async (label, retainedOnly = false) => {
  ensure();
  const value = await page.evaluate(
    ({ label, retainedOnly }) =>
      retainedOnly
        ? window.demoRecoveryProbe.state(label)
        : window.demoRecoveryProbe.snapshot(label),
    { label, retainedOnly },
  );
  retain(report.snapshots, value, 64);
  assert(value.visible && value.focused);
  assert.deepEqual(value.viewport, { width: 1280, height: 800, dpr: 1 });
  return value;
};
const pausedDraw = async ({ afterDraw = -1, differentRun = null } = {}) => {
  ensure();
  await page.waitForFunction(
    ({ afterDraw, differentRun }) => {
      const s = window.demoRecoveryProbe.readiness();
      return s.id && s.id !== differentRun && s.paused && s.drawCount > afterDraw;
    },
    { afterDraw, differentRun },
    { timeout: 10000 },
  );
};
const pause = async (practice) => {
  await click(practice ? '#demo-pause' : '#demo-watch-pause');
  await pausedDraw();
};
const openDemo = async () => {
  await click('#shell-options');
  await click('#settings-tab-extras');
  await click('#shell-demo');
  await page.waitForFunction(
    () =>
      document.getElementById('demo-dialog')?.dataset.scene === 'playing' &&
      window.demoRecoveryProbe.readiness().tick > 0,
    null,
    { timeout: 60000 },
  );
};
const closeExport = async () => {
  await click('#replay-dialog .dialog-close');
  await click('#shell-workshop-dialog [data-close="shell-workshop-dialog"]');
  await click('#settings-dialog .dialog-close');
};
const qualityWindow = async (practice, ms) => {
  const before = await snap(practice ? 'practice-quality-before' : 'spectator-quality-before');
  validQuality(before);
  await click('#demo-resume');
  if (practice) {
    await page.locator('#demo-canvas').click();
    await page.keyboard.press('ArrowRight');
  }
  await wait(ms);
  ensure();
  await pause(practice);
  const after = await snap(practice ? 'practice-quality-after' : 'spectator-quality-after');
  validQuality(after);
  assert.equal(after.demo.id, before.demo.id);
  assert(after.demo.tick > before.demo.tick);
  assert.equal(after.calibration.samples, before.calibration.samples);
  assert.equal(after.reducedPreference, before.reducedPreference);
  unchanged(ordinaryBefore, after, 'ordinary');
  retain(
    report.qualityWindows,
    {
      mode: practice ? 'practice' : 'spectator',
      requestedMs: ms,
      elapsedMs: after.atMs - before.atMs,
      before,
      after,
      status: 'pass',
    },
    2,
  );
  if (before.quality.tier !== after.quality.tier)
    report.automaticQualityTransition = 'observed-source-and-owner-scoped';
  await save();
};
const fault = async (id) => {
  const practice = id.startsWith('practice'),
    surface = id.endsWith('-display') ? 'display' : 'owned-concealment-layer';
  const arm = { id, status: 'fail' };
  retain(report.arms, arm, 4);
  arm.beforeActivation = await page.evaluate(() => window.demoRecoveryProbe.readiness());
  await click('#demo-resume');
  if (practice) await page.keyboard.down('ArrowRight');
  await wait(250);
  ensure();
  arm.active = await page.evaluate(() => window.demoRecoveryProbe.readiness());
  assert.equal(arm.active.id, arm.beforeActivation.id);
  assert(arm.active.tick > arm.beforeActivation.tick, 'Fault requires actual active advancement');
  assert.equal(arm.active.paused, false);
  arm.surface = await page.evaluate(
    ({ surface, id }) => window.demoRecoveryProbe.retain(surface, id),
    { surface, id },
  );
  // Keep the fault at the active boundary: diagnostics export is paused-only.
  arm.loss = await page.evaluate((id) => window.demoRecoveryProbe.event(id, 'contextlost'), id);
  assert.equal(arm.loss.before.demo.id, arm.active.id);
  assert(arm.loss.before.demo.tick >= arm.active.tick);
  assert.equal(arm.loss.before.lastDraw.paused, false);
  unchanged(arm.loss.before, arm.loss.after);
  assert.equal(arm.loss.isTrusted, false);
  assert.equal(arm.loss.defaultPrevented, false);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await wait(500);
  ensure();
  arm.lost = await snap(id + '-lost', true);
  unchanged(arm.loss.after, arm.lost);
  assert.equal(arm.lost.drawCount, arm.loss.after.drawCount);
  assert(Object.values(arm.lost.disabled).every((v) => v === true));
  arm.restore = await page.evaluate(
    (id) => window.demoRecoveryProbe.event(id, 'contextrestored'),
    id,
  );
  assert.equal(arm.restore.isTrusted, false);
  await pausedDraw({ afterDraw: arm.lost.drawCount });
  arm.restored = await snap(id + '-restored', true);
  unchanged(arm.lost, arm.restored);
  assert(arm.restored.drawCount > arm.lost.drawCount);
  await wait(500);
  ensure();
  arm.held = await snap(id + '-restore-held', true);
  unchanged(arm.restored, arm.held);
  assert.equal(arm.held.drawCount, arm.restored.drawCount);
  await click('#demo-resume');
  if (practice) {
    await wait(500);
    ensure();
    arm.armed = await snap(id + '-armed', true);
    unchanged(arm.held, arm.armed);
    await page.keyboard.press('ArrowLeft');
  }
  await wait(250);
  ensure();
  await pause(practice);
  arm.resumed = await snap(id + '-resumed');
  assert.equal(arm.resumed.demo.id, arm.held.demo.id);
  assert(arm.resumed.demo.tick > arm.held.demo.tick);
  unchanged(ordinaryBefore, arm.resumed, 'ordinary');
  validQuality(arm.resumed);
  arm.status = 'pass';
  await save();
};
const observation = async () => {
  const playwright = await import(pathToFileURL(plan.playwrightModule));
  ensure();
  // Same fresh Chrome/CDP/default-context lifecycle as the retained public Demo driver.
  const profile = await mkdtemp(join(scratch, 'demo-'));
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
  page.on('pageerror', (e) => {
    if (report.errors.length < 100) report.errors.push(String(e).slice(0, 2048));
    else report.overflow = true;
  });
  page.on('requestfailed', (r) => {
    if (report.failedRequests.length < 100)
      report.failedRequests.push({ url: r.url().slice(0, 2048), failure: r.failure() });
    else report.overflow = true;
  });
  const assets = [
    ...plan.sourceAssets,
    ...plan.metadata
      .filter((a) => a.path.endsWith('.mjs'))
      .map((a) => ({ ...a, role: 'module', relative: a.path.replace(/^game\//, '') })),
  ];
  for (const asset of assets) {
    const cap = asset.role === 'module' ? 1024 * 1024 : 256 * 1024;
    assert(Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= cap);
  }
  let sourceBytes = 0;
  const expected = new Map(assets.map((a) => [new URL(a.relative, plan.address).href, a]));
  assert.equal(expected.size, assets.length);
  page.on('response', (response) => {
    const asset = expected.get(response.url());
    if (!asset) return;
    if (!sourceCapture) {
      report.unexpectedSourceFetch = true;
      return;
    }
    if (report.sources.length >= 16) {
      report.overflow = true;
      return;
    }
    sourceBytes += asset.bytes;
    if (sourceBytes > 8 * 1024 ** 2) {
      report.overflow = true;
      return;
    }
    const row = { url: response.url(), role: asset.role, status: response.status() };
    report.sources.push(row);
    pending.push(
      (async () => {
        assert(response.ok());
        const bytes = await response.body();
        assert.equal(bytes.length, asset.bytes);
        assert.equal(sha(bytes), asset.sha256);
        Object.assign(row, { bytes: bytes.length, sha256: sha(bytes) });
        if (asset.role !== 'module') row.text = bytes.toString('utf8');
      })().catch((error) => {
        row.failure = String(error);
      }),
    );
  });
  await page.addInitScript(installDemoRecoveryProbe);
  await page.bringToFront();
  const response = await page.goto(plan.address + '?journey=opening&performance=1', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  ensure();
  report.csp = response.headers()['content-security-policy'];
  assert.equal(report.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
  if (await page.locator('input[name=password]').isVisible()) {
    await page.locator('input[name=password]').fill('fixture-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  }
  await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
    timeout: 120000,
  });
  ensure();
  const url = new URL('build-info.json', plan.address).href;
  const identity = await page.evaluate(async (url) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw Error('Build identity');
    return r.text();
  }, url);
  assert.equal(sha(identity), plan.buildInfoSHA256);
  assert.equal(JSON.parse(identity).sourceRevision, plan.sourceRevision);
  report.buildIdentity = {
    url,
    sourceRevision: plan.sourceRevision,
    version: JSON.parse(identity).version,
    sha256: sha(identity),
  };
  await page.evaluate(async (base) => {
    const [{ BoardPainter }, { authoritativeCheckpoint }] = await Promise.all([
      import(new URL('ui/render.mjs', base)),
      import(new URL('replay.mjs', base)),
    ]);
    window.demoRecoveryProbe.install(BoardPainter, authoritativeCheckpoint);
  }, plan.address);
  await click('#shell-featured');
  await phase('running');
  await page.keyboard.down('ArrowRight');
  await wait(150);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await phase('paused');
  ordinaryBefore = await snap('ordinary-before');
  recordingBefore = await readPublicQualificationReplay(page, 20000);
  await writeFile(output + '.before.replay.json', recordingBefore, { flag: 'wx' });
  await closeExport();
  await openDemo();
  await pause(false);
  await bounded('source response drain', () => Promise.all(pending));
  assert(report.sources.every((s) => !s.failure));
  const catalogue = report.sources.find((s) => s.role === 'catalog');
  assert(catalogue);
  assert.deepEqual(JSON.parse(catalogue.text).clips[0], plan.expectedClip);
  sourceText = report.sources.filter((s) => s.role === 'replay').at(-1)?.text;
  assert(sourceText);
  await writeFile(output + '.demo-source.json', sourceText, { flag: 'wx' });
  const prepared = await snap('prepared-first-source');
  assert.equal(prepared.mutePressed, 'true');
  assert.equal(prepared.reducedPreference, false);
  for (const asset of assets.filter((a) => a.role === 'module'))
    assert(
      report.sources.some(
        (s) => s.url === new URL(asset.relative, plan.address).href && !s.failure,
      ),
      'Required served module witness',
    );
  await qualityWindow(false, 5000);
  await fault(DEMO_ARMS[0]);
  await fault(DEMO_ARMS[1]);
  const takeover = await snap('takeover-source');
  await click('#demo-details-toggle');
  await click('#demo-takeover');
  await page.waitForFunction(
    () => document.getElementById('demo-dialog')?.classList.contains('is-practice'),
    null,
    { timeout: 60000 },
  );
  await pausedDraw({ differentRun: takeover.demo.id });
  practiceAtTakeover = await snap('takeover-practice');
  assert.notEqual(practiceAtTakeover.demo.id, takeover.demo.id);
  assert.equal(practiceAtTakeover.demo.tick, takeover.demo.tick);
  await qualityWindow(true, 2500);
  await fault(DEMO_ARMS[2]);
  await fault(DEMO_ARMS[3]);
  const oldPainter = await page.evaluate(() =>
    window.demoRecoveryProbe.retain('owned-concealment-layer', 'stale'),
  );
  await click('#demo-back');
  await openDemo();
  const newer = await snap('reopened', true);
  assert.notEqual(newer.painterId, oldPainter.painterId);
  const oldLoss = await page.evaluate(() => window.demoRecoveryProbe.event('stale', 'contextlost')),
    oldRestore = await page.evaluate(() =>
      window.demoRecoveryProbe.event('stale', 'contextrestored'),
    );
  await wait(500);
  ensure();
  const afterStale = await snap('after-retired-events', true);
  assert.equal(afterStale.demo.id, newer.demo.id);
  assert(afterStale.demo.tick > newer.demo.tick);
  assert.equal(afterStale.watchPaused, 'false');
  report.staleOwner = { status: 'pass', oldPainter, newer, oldLoss, oldRestore, afterStale };
  await pause(false);
  await click('#demo-back');
  const afterClose = await snap('ordinary-after');
  unchanged(ordinaryBefore, afterClose, 'ordinary');
  if (await page.locator('#settings-dialog').isVisible())
    await click('#settings-dialog .dialog-close');
  await page.keyboard.press('Escape');
  recordingAfter = await readPublicQualificationReplay(page, 20000);
  assert.equal(recordingAfter, recordingBefore, 'Public parent recording bytes changed');
  report.parentUnchanged = true;
  await writeFile(output + '.after.replay.json', recordingAfter, { flag: 'wx' });
  sourceCapture = false;
  await bounded('final source drain', () => Promise.all(pending));
  assert(!report.sources.some((s) => s.failure));
  const snapshots = report.snapshots.filter((s) => s.demo && !s.practice && s.open);
  const proof = await page.evaluate(
    async ({ source, snapshots, practice, base }) => {
      const core = await import(new URL('core/index.mjs', base)),
        replay = await import(new URL('replay.mjs', base));
      const recording = JSON.parse(source);
      const reconstruct = (target) => {
        const state = core.createRun(recording.level, recording.options);
        for (const segment of recording.segments) {
          if (state.tick >= target) break;
          if (segment.releaseBefore) core.releaseInputs(state);
          for (let i = 0; i < segment.ticks && state.tick < target; i++)
            core.stepRun(state, segment.input, core.FIXED_DT);
        }
        if (target === recording.ticks && recording.releaseAfter) core.releaseInputs(state);
        return state;
      };
      const rows = snapshots.map((s) => {
        const state = reconstruct(s.demo.tick),
          actual = replay.authoritativeCheckpoint(state);
        return {
          label: s.label,
          tick: s.demo.tick,
          actual,
          expected: s.demo.checkpoint,
          match: state.tick === s.demo.tick && actual.hash === s.demo.checkpoint.hash,
        };
      });
      const fork = reconstruct(practice.demo.tick);
      core.releaseInputs(fork);
      const actual = replay.authoritativeCheckpoint(fork);
      return {
        prefix: { status: rows.every((r) => r.match) ? 'pass' : 'fail', rows },
        practice: {
          status: actual.hash === practice.demo.checkpoint.hash ? 'pass' : 'fail',
          actual,
          expected: practice.demo.checkpoint,
        },
      };
    },
    { source: sourceText, snapshots, practice: practiceAtTakeover, base: plan.address },
  );
  report.prefixProof = proof.prefix;
  report.practiceForkProof = proof.practice;
  assert.equal(proof.prefix.status, 'pass');
  assert.equal(proof.practice.status, 'pass');
  assert.equal(report.errors.length, 0);
  assert.equal(report.failedRequests.length, 0);
  assert(!report.overflow && !report.unexpectedSourceFetch);
  ensure();
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
    void browser?.close().catch(() => {});
  }, plan.observationTimeoutMs);
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
    await bounded('closed source response drain', () => Promise.all(pending), 5000);
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
  !report.unexpectedSourceFetch &&
  !report.sources.some((row) => row.failure) &&
  report.errors.length === 0 &&
  report.failedRequests.length === 0
) {
  const playwright = await import(pathToFileURL(plan.playwrightModule));
  for (const [name, text] of [
    ['parentReplay', recordingAfter],
    ['demoReplay', sourceText],
  ]) {
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
      const parsed = JSON.parse(text),
        native = parsed.replay ?? parsed;
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
        recordingText: text,
        expectedDefinition: { level: native.level, options: native.options },
        requirements: {},
        timeoutMs: plan.replayTimeoutMs,
      });
      report[name] = await bounded(name, () => pendingVerifier, plan.replayTimeoutMs + 5000);
      assert.equal(report[name].status, 'pass');
      assert(
        launched.length === 1 && launched.every((b) => !b.isConnected()),
        'Verifier browser closure not confirmed',
      );
      report[name].ownedBrowserClosed = true;
    } catch (error) {
      report[name] ??= { status: 'fail' };
      report[name].status = 'fail';
      report[name].failure = String(error);
      if (pendingVerifier)
        try {
          await bounded('verifier drain', () => pendingVerifier, 5000);
        } catch (e) {
          report.verifierDrainFailure = String(e);
        }
      await save();
      break;
    }
    await save();
  }
}
if (
  report.functionalStatus === 'pass' &&
  report.parentReplay?.status === 'pass' &&
  report.demoReplay?.status === 'pass' &&
  report.parentReplay.ownedBrowserClosed &&
  report.demoReplay.ownedBrowserClosed &&
  report.observedBrowserClosed &&
  report.observationSettled &&
  !report.deadlineReached &&
  !report.cleanupFailure &&
  !report.overflow &&
  !report.observationDrainFailure &&
  !report.verifierDrainFailure &&
  !report.sourceDrainFailure &&
  !report.unexpectedSourceFetch &&
  !report.sources.some((row) => row.failure) &&
  report.errors.length === 0 &&
  report.failedRequests.length === 0
)
  report.status = 'pass';
report.completedAt = new Date().toISOString();
await save();
process.exitCode = report.status === 'pass' ? 0 : 1;
