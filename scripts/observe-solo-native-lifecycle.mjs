/* global window, document */
// Real native visibility observation; never dispatches lifecycle events or sets visibility.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, readFile, rename, lstat, mkdtemp, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { readPublicQualificationReplay } from './solo-qualification-export.mjs';
import { verifyNativeQualificationReplay } from './solo-qualification-native-replay.mjs';
import {
  LIFECYCLE_PROTOCOL,
  LIFECYCLE_SOURCE,
  LIFECYCLE_FIXTURE,
  LIFECYCLE_PREDECESSOR,
  lifecycleCase,
  readLifecycleJSON,
  assertSamePaused,
  resumeBounds,
  assertLifecycleProof,
  assertLifecycleReplay,
} from './solo-remote-lifecycle.mjs';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const message = (error) => String(error.stack ?? error).slice(0, 16384);

export function installLifecycleProbe(_, environment = globalThis) {
  if (environment.top !== environment) return;
  const documentRef = environment.document;
  let phaser,
    game,
    checkpointFn,
    nextRunId = 1,
    armed = null,
    resumeGesture = null,
    resumePhase = null;
  const runIds = new WeakMap(),
    events = [],
    frames = [],
    phases = [];
  const dropped = { events: 0, phases: 0 };
  const read = (label, checkpoint = false) => {
    const scene = game?.scene?.scenes?.find((entry) => entry.lastPaint?.run),
      paint = scene?.lastPaint,
      run = paint?.run;
    if (run && !runIds.has(run)) runIds.set(run, nextRunId++);
    const result = {
      label,
      atMs: environment.performance.now(),
      phase: documentRef.body?.dataset.flightState ?? null,
      visibility: documentRef.visibilityState,
      focused: documentRef.hasFocus(),
      width: environment.innerWidth,
      height: environment.innerHeight,
      dpr: environment.devicePixelRatio,
      runId: run ? runIds.get(run) : null,
      levelId: run?.level?.id ?? null,
      runTick: run?.tick ?? null,
      submittedPaintTick: paint?.tick ?? null,
      status: run?.status ?? null,
      lives: run?.lives ?? null,
      player: run
        ? {
            x: run.player.x,
            y: run.player.y,
            direction: run.player.direction,
            speed: run.player.speed,
            cutting: run.player.cutting,
          }
        : null,
      trailCells: run?.trail?.length ?? null,
    };
    if (checkpoint) {
      if (result.phase === 'running') throw Error('Checkpoint reads are pause-only');
      if (!run || !checkpointFn) throw Error('Retained run/checkpoint unavailable');
      result.checkpoint = checkpointFn(run);
    }
    return result;
  };
  Object.defineProperty(environment, 'Phaser', {
    configurable: true,
    get: () => phaser,
    set(value) {
      phaser = value;
      const Game = value.Game;
      value.Game = class extends Game {
        constructor(...args) {
          super(...args);
          game = this;
          this.events.on(value.Core.Events.POST_RENDER, () => {
            if (!armed || documentRef.body?.dataset.flightState !== 'running') return;
            frames.push(read(armed.label));
            if (--armed.remaining === 0) armed = null;
          });
        }
      };
    },
  });
  const observe = (event) => {
    const state = {
      type: event.type,
      trusted: event.isTrusted,
      key: event.key ?? null,
      target: String(event.target?.id ?? '').slice(0, 256),
      ...read('event-before-application-handlers'),
    };
    if (events.length < 128) events.push(state);
    else dropped.events++;
    if (
      armed &&
      event.type === 'click' &&
      event.isTrusted &&
      event.target?.closest?.('#start-button')
    )
      resumeGesture = state;
  };
  documentRef.addEventListener(
    'DOMContentLoaded',
    () => {
      const capturePhase = () => {
        const state = read('observed-public-phase-mutation');
        if (phases.at(-1)?.phase === state.phase) return;
        if (phases.length < 64) phases.push(state);
        else dropped.phases++;
        if (armed && state.phase === 'running' && !resumePhase) resumePhase = state;
      };
      capturePhase();
      new environment.MutationObserver(capturePhase).observe(documentRef.body, {
        attributes: true,
        attributeFilter: ['data-flight-state'],
      });
    },
    { once: true },
  );
  for (const type of ['blur', 'focus', 'resize', 'orientationchange'])
    environment.addEventListener(type, observe, true);
  for (const type of ['visibilitychange', 'freeze', 'resume', 'keydown', 'keyup', 'click'])
    documentRef.addEventListener(type, observe, true);
  environment.soloLifecycleProbe = {
    snapshot: read,
    installCheckpoint: (fn) => {
      checkpointFn = fn;
    },
    armFrames: (label) => {
      if (frames.length || armed) throw Error('Only one Resume observation permitted');
      resumeGesture = resumePhase = null;
      armed = { label, remaining: 16 };
    },
    export: () => ({
      events: events.slice(),
      frames: frames.slice(),
      phases: phases.slice(),
      dropped: { ...dropped },
      resumeGesture,
      resumePhase,
      current: read('export'),
    }),
  };
}
export async function writeLifecycleReport(output, report) {
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
  assert(bytes.length <= LIFECYCLE_PROTOCOL.reportBytes, 'Lifecycle report byte bound');
  const temporary = output + '.partial',
    file = await open(temporary, 'wx');
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, output);
}
export async function saveLifecycleRecording(output, text, partial) {
  assert.equal(typeof text, 'string');
  const bytes = Buffer.from(text);
  assert(
    bytes.length > 0 && bytes.length <= LIFECYCLE_PROTOCOL.replayBytes,
    'Lifecycle replay byte bound',
  );
  const path = output + '.replay.json',
    file = await open(path, 'wx');
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  return {
    path,
    bytes: bytes.length,
    sha256: digest(bytes),
    status: 'retained-unverified',
    partial,
  };
}
export async function readOwnedDevtoolsPort(profile) {
  const path = join(profile, 'DevToolsActivePort'),
    info = await lstat(path);
  assert(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= 4096);
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    assert(before.dev === info.dev && before.ino === info.ino && before.size === info.size);
    const buffer = Buffer.alloc(4097),
      { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const after = await file.stat();
    assert(
      bytesRead === info.size && before.size === after.size && before.mtimeMs === after.mtimeMs,
    );
    const [portText, endpoint] = buffer.subarray(0, bytesRead).toString().trim().split('\n');
    assert(/^\d{1,5}$/.test(portText) && /^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(endpoint));
    const port = Number(portText);
    assert(port > 0 && port < 65536);
    return `http://127.0.0.1:${port}`;
  } finally {
    await file.close();
  }
}
async function bounded(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(label + ' deadline')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function closeLifecycleBrowser(browser, owner, timeoutMs = 25000) {
  let commandFailure = null;
  const deadline = performance.now() + timeoutMs;
  const remaining = () => {
    const left = deadline - performance.now();
    assert(left > 0, 'Owned browser cleanup deadline');
    return left;
  };
  if (browser?.isConnected() && !owner.exited) {
    try {
      await bounded(
        (async () => {
          const session = await browser.newBrowserCDPSession();
          await session.send('Browser.close');
        })(),
        remaining(),
        'Owned Browser.close',
      );
    } catch (error) {
      commandFailure = message(error);
    }
  }
  if (!owner.exited) await bounded(owner.exitPromise, remaining(), 'Owned Chrome exit');
  if (browser?.isConnected())
    await bounded(browser.close(), Math.min(5000, remaining()), 'CDP disconnect');
  assert(
    owner.exited && owner.exitCode === 0 && owner.exitSignal === null,
    'Owned Chrome exit unconfirmed',
  );
  assert(browser && !browser.isConnected(), 'Observed browser still connected');
  return { observedBrowserClosed: true, commandFailureAfterConfirmedExit: commandFailure };
}
export async function automationIdentity(modulePath) {
  const path = await realpath(modulePath),
    info = await lstat(path);
  assert(info.isFile() && info.size <= 8 * 1024 ** 2);
  const moduleBytes = await readFile(path);
  const packagePath = join(dirname(path), 'package.json'),
    bytes = await readFile(packagePath);
  assert(bytes.length <= 65536);
  const pkg = JSON.parse(bytes);
  assert(['playwright', 'playwright-core'].includes(pkg.name) && pkg.version === '1.62.1');
  return {
    module: { path, bytes: moduleBytes.length, sha256: digest(moduleBytes) },
    package: { name: pkg.name, version: pkg.version, bytes: bytes.length, sha256: digest(bytes) },
    historical: LIFECYCLE_PREDECESSOR,
    sourceScope:
      'Actual installed entry/package identity. Historical bundled core hash is provenance, not asserted equal to this npm installation.',
  };
}
export async function observeLifecycle(planArg, outputArg) {
  const output = resolve(outputArg),
    plan = await readLifecycleJSON(resolve(planArg), 65536);
  assert.equal(plan.format, 'SoloHostedLifecycleExecutionV1');
  assert.deepEqual(plan.protocol, LIFECYCLE_PROTOCOL);
  assert.deepEqual(plan.job, lifecycleCase());
  assert.equal(plan.runtimeRevision, LIFECYCLE_SOURCE.runtime);
  assert.equal(plan.artifact.sourceRevision, LIFECYCLE_SOURCE.revision);
  assert.equal(plan.artifact.sourceTree, LIFECYCLE_SOURCE.tree);
  assert.match(plan.artifact.buildInfoSHA256, /^[a-f0-9]{64}$/);
  assert.equal(await realpath(process.env.TMPDIR), plan.scratch);
  assert((await lstat(dirname(output))).isDirectory());
  try {
    await lstat(output);
    throw Error('Refusing to replace lifecycle evidence');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const fixture = await readFile(plan.fixture.path);
  assert.equal(fixture.length, LIFECYCLE_FIXTURE.bytes);
  assert.equal(digest(fixture), LIFECYCLE_FIXTURE.sha256);
  const recipe = JSON.parse(fixture);
  const report = {
    format: 'SoloHostedNativeLifecycleV1',
    status: 'running',
    job: plan.job,
    protocol: LIFECYCLE_PROTOCOL,
    runtimeRevision: plan.runtimeRevision,
    artifact: plan.artifact,
    plan: { path: resolve(planArg), sha256: digest(await readFile(planArg)) },
    startedAt: new Date().toISOString(),
    performanceQualification: 'excluded',
    physicalQualification: 'unobserved',
    webkitBackground: 'unsupported-unobserved',
    scope:
      'Actual desktop Chromium hidden/visible events, ten-second paused checkpoint and explicit Resume. No physical OS suspension, iPhone, physical-key or numerical performance claim.',
    snapshots: [],
    actions: [],
    errors: [],
    failedRequests: [],
    failure: null,
  };
  const save = () => writeLifecycleReport(output, report);
  await save();
  let browser,
    context,
    page,
    recording,
    timer,
    stopped = false,
    closePromise;
  const owner = { exited: false, exitCode: null, exitSignal: null, exitPromise: null };
  const checked = async (promise) => {
    const value = await promise;
    assert(!stopped, 'Lifecycle observation stopped');
    return value;
  };
  const close = () => {
    closing = true;
    return (closePromise ??= closeLifecycleBrowser(browser, owner));
  };
  const action = (name) => {
    assert(report.actions.length < 64);
    report.actions.push({ name, at: new Date().toISOString() });
  };
  const requirePhase = (value, timeout = 10000) =>
    checked(
      page.waitForFunction((v) => document.body?.dataset.flightState === v, value, {
        timeout,
        polling: 100,
      }),
    );
  const snapshot = async (label, checkpoint = false) => {
    const value = await checked(
      page.evaluate(
        ({ label, checkpoint }) => window.soloLifecycleProbe.snapshot(label, checkpoint),
        { label, checkpoint },
      ),
    );
    assert(report.snapshots.length < 32);
    report.snapshots.push(value);
    return value;
  };
  let playwright,
    closing = false;
  try {
    report.automation = await automationIdentity(plan.browserModule);
    playwright = await import(pathToFileURL(plan.browserModule).href);
    const profile = await mkdtemp(join(plan.scratch, 'chrome-'));
    const args = [
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,800',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      'about:blank',
    ];
    const child = spawn(plan.chromeExecutable, args, {
      detached: false,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    owner.exitPromise = new Promise((resolveExit) => {
      child.once('exit', (code, signal) => {
        owner.exited = true;
        owner.exitCode = code;
        owner.exitSignal = signal;
        resolveExit();
      });
      child.once('error', (error) => {
        owner.exited = true;
        report.spawnFailure = message(error);
        resolveExit();
      });
    });
    report.ownedProcess = {
      pid: child.pid,
      executable: plan.chromeExecutable,
      args,
      profile,
      authority:
        'Fresh inherited common-owner token/process group and private profile; no user browser and no observer signals.',
    };
    await save();
    timer = setTimeout(() => {
      stopped = true;
      report.deadlineReached = true;
      if (browser)
        void close().catch((error) => {
          report.cleanupFailure = message(error);
        });
    }, LIFECYCLE_PROTOCOL.observationTimeoutMs);
    let endpoint;
    const until = Date.now() + 30000;
    while (!endpoint && Date.now() < until && !owner.exited) {
      try {
        endpoint = await readOwnedDevtoolsPort(profile);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (!endpoint) await checked(wait(100));
    }
    assert(endpoint, 'Owned Chrome endpoint unavailable');
    browser = await playwright.chromium.connectOverCDP(endpoint, {
      noDefaults: true,
      isLocal: true,
      timeout: 30000,
    });
    assert(!stopped);
    report.browserVersion = browser.version();
    context = browser.contexts()[0];
    assert(context, 'Owned default context unavailable');
    page = context.pages()[0] ?? (await checked(context.newPage()));
    await checked(page.setViewportSize(plan.job.viewport));
    report.connection = {
      method: 'connectOverCDP',
      noDefaults: true,
      isLocal: true,
      defaultContextOnly: true,
    };
    let expectedURL;
    page.on('framenavigated', (frame) => {
      if (expectedURL && frame === page.mainFrame() && frame.url() !== expectedURL)
        report.navigationFailure = frame.url().slice(0, 8192);
    });
    page.on('close', () => {
      if (!closing) report.unexpectedPageClose = true;
    });
    page.on('crash', () => {
      report.crashed = true;
    });
    page.on('pageerror', (error) => {
      if (report.errors.length < 64) report.errors.push(message(error));
      else report.errorOverflow = true;
    });
    page.on('requestfailed', (request) => {
      if (report.failedRequests.length < 64)
        report.failedRequests.push({
          url: request.url().slice(0, 8192),
          failure: String(request.failure()?.errorText ?? '').slice(0, 8192),
        });
      else report.failedRequestOverflow = true;
    });
    await checked(page.addInitScript(installLifecycleProbe));
    await checked(page.bringToFront());
    const url = new URL(plan.address);
    url.searchParams.set('journey', 'opening');
    url.searchParams.set('performance', '1');
    const response = await checked(
      page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 }),
    );
    report.csp = response.headers()['content-security-policy'];
    assert.equal(report.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
    if (await checked(page.locator('input[name=password]').isVisible())) {
      await checked(page.locator('input[name=password]').fill('fixture-password'));
      await checked(page.getByRole('button', { name: 'Unlock', exact: true }).click());
    }
    await checked(
      page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
        timeout: 120000,
      }),
    );
    expectedURL = page.url();
    assert.equal(expectedURL, url.href);
    const identityURL = new URL('build-info.json', plan.address).href;
    const text = await checked(
      page.evaluate(async (address) => {
        const response = await fetch(address, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw Error('Identity HTTP' + response.status);
        return response.text();
      }, identityURL),
    );
    const identity = JSON.parse(text);
    report.buildIdentity = {
      url: identityURL,
      sourceRevision: identity.sourceRevision,
      version: identity.version,
      sha256: digest(text),
    };
    assert.equal(identity.sourceRevision, LIFECYCLE_SOURCE.revision);
    assert.equal(digest(text), plan.artifact.buildInfoSHA256);
    await checked(
      page.evaluate(
        async (address) =>
          window.soloLifecycleProbe.installCheckpoint(
            (await import(new URL('replay.mjs', address).href)).authoritativeCheckpoint,
          ),
        plan.address,
      ),
    );
    await checked(page.locator('#shell-featured').click({ timeout: 60000 }));
    action('public-start');
    await requirePhase('running', 60000);
    const started = await snapshot('initial-running');
    assert.equal(started.levelId, 'first-return');
    assert.equal(started.visibility, 'visible');
    assert(started.focused);
    await checked(page.keyboard.down('ArrowRight'));
    action('keydown-border-right');
    await checked(wait(100));
    const moving = await snapshot('before-interruption-held-right');
    assert(moving.player.x > started.player.x);
    const blank = await checked(context.newPage());
    await checked(blank.goto('about:blank'));
    await checked(blank.bringToFront());
    action('activate-owned-blank');
    await checked(wait(250));
    const away = await snapshot('after-native-away');
    if (away.visibility !== 'hidden') {
      report.status = 'unobserved';
      throw Error('Owned blank page did not produce actual hidden state');
    }
    await requirePhase('paused');
    const hidden = await snapshot('hidden-paused', true);
    await save();
    await checked(wait(10000));
    const held = await snapshot('hidden-after-ten-seconds', true);
    assert.equal(held.visibility, 'hidden');
    assertSamePaused(hidden, held);
    await checked(page.bringToFront());
    action('return-to-owned-game');
    await checked(
      page.waitForFunction(() => !document.hidden && document.hasFocus(), null, {
        timeout: 10000,
        polling: 100,
      }),
    );
    await checked(page.keyboard.up('ArrowRight'));
    action('release-original-held-key');
    const returned = await snapshot('returned-before-resume', true);
    assertSamePaused(hidden, returned);
    await checked(wait(500));
    assertSamePaused(hidden, await snapshot('returned-still-paused', true));
    const before = await snapshot('before-explicit-resume', true);
    await checked(page.evaluate(() => window.soloLifecycleProbe.armFrames('resumed-submission')));
    await checked(page.locator('#start-button').click({ timeout: 10000 }));
    action('public-explicit-resume');
    await requirePhase('running');
    await checked(wait(400));
    const resumed = await snapshot('resumed-neutral-no-key');
    assert(resumed.runTick > before.runTick);
    report.lifecycle = await checked(page.evaluate(() => window.soloLifecycleProbe.export()));
    report.resumeProbe = structuredClone(report.lifecycle);
    report.resumeWitness = resumeBounds(before, report.resumeProbe);
    await checked(page.keyboard.down('ArrowLeft'));
    action('fresh-different-key-left');
    await checked(wait(100));
    await checked(page.keyboard.up('ArrowLeft'));
    const fresh = await snapshot('fresh-movement');
    assert(fresh.player.x < resumed.player.x);
    await checked(page.keyboard.press('Escape'));
    action('final-public-pause');
    await requirePhase('paused');
    await snapshot('final-paused', true);
    recording = await checked(readPublicQualificationReplay(page, 15000));
    action('public-replay-export');
    await snapshot('after-public-export', true);
    report.lifecycle = await checked(page.evaluate(() => window.soloLifecycleProbe.export()));
    assertLifecycleProof(report);
    assert.equal(report.errors.length, 0);
    assert(
      !report.errorOverflow &&
        !report.failedRequestOverflow &&
        !report.crashed &&
        !report.unexpectedPageClose &&
        !report.navigationFailure,
    );
    report.status = 'scenario-passed-awaiting-native-replay';
  } catch (error) {
    if (report.status !== 'unobserved') report.status = 'fail';
    report.failure = message(error);
  } finally {
    clearTimeout(timer);
    // Close first on a deadline. No cleanup export may restart timed-out gameplay.
    if (page && !page.isClosed() && !stopped) {
      try {
        report.lifecycle = await bounded(
          page.evaluate(() => window.soloLifecycleProbe?.export() ?? null),
          5000,
          'Final witness',
        );
        if (!recording) {
          let exportStopped = false;
          const step = async (promise) => {
            const value = await promise;
            assert(!exportStopped, 'Partial export stopped');
            return value;
          };
          try {
            recording = await bounded(
              (async () => {
                await step(page.bringToFront());
                await step(page.keyboard.up('ArrowRight'));
                await step(page.keyboard.up('ArrowLeft'));
                if (
                  (await step(page.locator('body').getAttribute('data-flight-state'))) === 'running'
                )
                  await step(page.keyboard.press('Escape'));
                await step(
                  page.waitForFunction(
                    () => document.body?.dataset.flightState === 'paused',
                    null,
                    { timeout: 5000 },
                  ),
                );
                return await step(readPublicQualificationReplay(page, 10000));
              })(),
              15000,
              'Partial paused export',
            );
            report.partialReplay = true;
          } finally {
            exportStopped = true;
          }
        }
      } catch (error) {
        report.partialExportFailure = message(error);
      }
    }
    stopped = true;
    try {
      Object.assign(report, await close());
    } catch (error) {
      report.cleanupFailure = message(error);
    }
    if (report.ownedProcess)
      Object.assign(report.ownedProcess, {
        exited: owner.exited,
        exitCode: owner.exitCode,
        exitSignal: owner.exitSignal,
      });
    report.observedBrowserClosed = Boolean(report.observedBrowserClosed && owner.exited);
    report.observedBrowserClosedAt = new Date().toISOString();
    await save();
  }
  if (recording) {
    try {
      report.recording = await saveLifecycleRecording(
        output,
        recording,
        Boolean(report.partialReplay),
      );
      if (report.observedBrowserClosed && !report.cleanupFailure && !report.deadlineReached) {
        report.nativeReplay = await verifyNativeQualificationReplay({
          playwright,
          engine: 'chromium',
          executablePath: plan.chromeExecutable,
          observedBrowserClosed: true,
          expected: {
            browserVersion: report.browserVersion,
            buildIdentity: report.buildIdentity,
            csp: report.csp,
          },
          recordingText: recording,
          requirements: {},
          expectedDefinition: recipe.expectedReplayDefinition,
          timeoutMs: 120000,
        });
        if (!report.partialReplay && report.nativeReplay.status === 'pass')
          assertLifecycleReplay(report);
      } else
        report.nativeReplay = {
          status: 'unobserved',
          reason: 'Observed browser closure or observation deadline failed',
        };
    } catch (error) {
      report.nativeReplay = { status: 'fail', failure: message(error) };
    }
  }
  if (report.status === 'scenario-passed-awaiting-native-replay')
    report.status =
      report.nativeReplay?.status === 'pass' && !report.cleanupFailure ? 'pass' : 'fail';
  if (
    report.status === 'pass' &&
    (report.partialExportFailure ||
      report.unexpectedPageClose ||
      report.navigationFailure ||
      report.crashed ||
      report.errorOverflow ||
      report.failedRequestOverflow ||
      report.errors.length)
  ) {
    report.status = 'fail';
    report.failure ??= 'Retained final observation failure';
  }
  report.completedAt = new Date().toISOString();
  await save();
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await observeLifecycle(...process.argv.slice(2));
  process.stdout.write(
    JSON.stringify({
      status: report.status,
      nativeReplay: report.nativeReplay?.status ?? 'unobserved',
    }) + '\n',
  );
  process.exitCode = report.status === 'pass' ? 0 : report.status === 'unobserved' ? 2 : 1;
}
