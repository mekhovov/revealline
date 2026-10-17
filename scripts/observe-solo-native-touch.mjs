/* global window, document, navigator, performance, innerWidth, innerHeight, devicePixelRatio */
// Hosted port of the retained settled120 native touch probes; no simulated DOM input.
import assert from 'node:assert/strict';
import { open, readFile, rename, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import {
  prepareCadenceViewport,
  observeSettledCadence,
  calibrateSettledCadence,
} from './solo-qualification-cadence.mjs';
import { quantileBound } from './solo-qualification.mjs';
import {
  waitQualificationControl,
  readPublicQualificationReplay,
} from './solo-qualification-export.mjs';
import { verifyNativeQualificationReplay } from './solo-qualification-native-replay.mjs';
import {
  TOUCH_PROTOCOL,
  TOUCH_SOURCE,
  TOUCH_FIXTURE,
  touchCase,
  readTouchJSON,
  assertTouchMovement,
  assertTouchEvents,
  touchLatency,
} from './solo-remote-touch.mjs';
import { writeFile } from 'node:fs/promises';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function observeTouchCadenceAfterStart(page, report) {
  report.internalCadenceBoundary = 'after-public-start-before-native-input';
  try {
    await page.waitForFunction(() => window.soloTouchProbe.read().readyCount === 30, null, {
      timeout: 5000,
    });
  } catch (error) {
    // This is the same optional internal observation. The independent settled120
    // measurement remains the only external cadence authority for the input gate.
    report.internalCadenceWait = String(error.message);
  }
}

export async function readPartialTouchReplay(page, timeoutMs = 10000) {
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000);
  const deadline = Date.now() + timeoutMs;
  const remaining = () => {
    const time = deadline - Date.now();
    assert(time > 0, 'Partial public replay readback deadline exceeded');
    return time;
  };
  assert.equal(
    await page.locator('body').getAttribute('data-flight-state', { timeout: remaining() }),
    'paused',
    'Partial touch replay is read only after the attempt is paused',
  );
  let recording, source;
  if (await page.locator('#replay-dialog').isVisible()) {
    // A native click can open this public dialog before its automation promise
    // settles. Do not click through that modal or issue the export a second time.
    recording = await page.locator('#replay-json').inputValue({ timeout: remaining() });
    source = 'already-open-public-replay-dialog';
  } else {
    recording = await readPublicQualificationReplay(page, remaining());
    source = 'public-export-controls';
  }
  assert(
    Buffer.byteLength(recording) <= TOUCH_PROTOCOL.replayBytes,
    'Partial public replay exceeds the unchanged byte bound',
  );
  assert(recording.trim().length > 0, 'Partial public replay is empty');
  const parsed = JSON.parse(recording);
  assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
  assert.equal(
    await page.locator('body').getAttribute('data-flight-state', { timeout: remaining() }),
    'paused',
    'The attempt must remain paused throughout partial readback',
  );
  return { recording, source };
}

export function installTouchProbe({ mode }, environment = globalThis) {
  const documentRef = environment.document;
  let phaser,
    game,
    dropped = 0;
  const events = [];
  const read = () => {
    const scene = game?.scene?.scenes?.find((entry) => entry.lastPaint?.run),
      paint = scene?.lastPaint,
      run = paint?.run;
    return {
      atMs: environment.performance.now(),
      phase: documentRef.body?.dataset.flightState ?? null,
      visible: !documentRef.hidden,
      focused: documentRef.hasFocus(),
      levelId: run?.level?.id ?? null,
      tick: run?.tick ?? null,
      x: run?.player?.x ?? null,
      y: run?.player?.y ?? null,
      direction: run?.player?.direction ?? null,
      lives: run?.lives ?? null,
      trailCells: run?.trail?.length ?? null,
      quality: paint?.quality ?? null,
      readyCount: scene?.readyCount ?? null,
    };
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
        }
      };
    },
  });
  const observe = (event) => {
    if (documentRef.body?.dataset.flightState !== 'running') return;
    if (
      mode === 'dpad'
        ? event.type !== 'pointerdown' || !event.target?.closest?.('[data-move]')
        : !event.target?.closest?.('#touch-surface,.direction-controls,#game-canvas')
    )
      return;
    if (events.length === 64) {
      dropped++;
      return;
    }
    events.push({
      atMs: environment.performance.now(),
      type: event.type,
      eventTimeStamp: event.timeStamp,
      isTrusted: event.isTrusted,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      buttons: event.buttons,
      defaultPrevented: event.defaultPrevented,
      x: event.clientX,
      y: event.clientY,
      target: String(event.target.id || event.target.className).slice(0, 256),
      targetDirection: event.target.closest('[data-move]')?.dataset.move ?? null,
    });
  };
  documentRef.addEventListener('pointerdown', observe);
  documentRef.addEventListener('pointermove', observe);
  environment.soloTouchProbe = {
    read,
    export: () => ({ events: events.slice(), dropped, current: read() }),
  };
}

export async function writeTouchReport(output, report) {
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
  assert(bytes.length <= TOUCH_PROTOCOL.reportBytes, 'Touch report exceeds fixed byte bound');
  const temporary = output + '.partial';
  const file = await open(temporary, 'wx');
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, output);
}
export async function closeTouchOwner(owner, kind, report) {
  if (!owner) return;
  let timer;
  try {
    await Promise.race([
      owner.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(kind + ' close deadline')), 10000);
      }),
    ]);
  } catch (error) {
    report[kind + 'CloseFailure'] = String(error);
  } finally {
    clearTimeout(timer);
  }
}
export async function dispatchTouchDirection({ page, cdp, anchor, mode, index }) {
  assert(['dpad', 'stick', 'swipe'].includes(mode));
  assert(Number.isInteger(index) && index >= 0 && index < 24);
  const direction = index % 2 ? 'left' : 'right';
  if (mode === 'dpad') {
    const selector = `[data-move="${direction}"]`;
    await waitQualificationControl(page, selector, 10000);
    const box = await page.locator(selector).boundingBox();
    assert(box);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    return { name: 'trusted-native-touch-tap', index, direction };
  }
  const point = {
    x: anchor.x + (direction === 'right' ? 40 : -40),
    y: anchor.y,
    id: 1,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  return { name: 'trusted-native-touch-move', index, direction, x: point.x, y: point.y };
}
export async function observeTouch(planArg, outputArg) {
  const output = resolve(outputArg),
    plan = await readTouchJSON(resolve(planArg), 65536);
  assert.equal(plan.format, 'SoloHostedTouchExecutionV1');
  assert.deepEqual(plan.protocol, TOUCH_PROTOCOL);
  const job = plan.job;
  assert.deepEqual(job, touchCase(job.engine + '-' + job.mode, job.repetition));
  assert.equal(plan.artifact.sourceRevision, TOUCH_SOURCE.revision);
  assert.equal(plan.artifact.sourceTree, TOUCH_SOURCE.tree);
  assert.match(plan.artifact.buildInfoSHA256, /^[a-f0-9]{64}$/);
  assert.equal(resolve(process.env.TMPDIR), plan.scratch);
  assert.equal((await lstat(dirname(output))).isDirectory(), true);
  try {
    await lstat(output);
    throw Error('Refusing to replace existing touch evidence');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert.equal(plan.fixture.bytes, TOUCH_FIXTURE.bytes);
  assert.equal(plan.fixture.sha256, TOUCH_FIXTURE.sha256);
  const fixture = await readFile(plan.fixture.path);
  assert.equal(fixture.length, TOUCH_FIXTURE.bytes);
  assert.equal(digest(fixture), TOUCH_FIXTURE.sha256);
  const recipe = JSON.parse(fixture),
    planBytes = await readFile(planArg);
  const expectedCount = TOUCH_PROTOCOL.directionChanges + Number(job.mode !== 'dpad');
  const report = {
    format: 'SoloHostedNativeTouchV1',
    caseId: job.id,
    status: 'running',
    inputGateStatus: 'not-evaluated',
    plan: { path: resolve(planArg), sha256: digest(planBytes) },
    job,
    startedAt: new Date().toISOString(),
    artifact: plan.artifact,
    scope: `Native automation touch through public ${job.mode}; event-to-fixed-tick-to-render submission. One accepted neutral down is counted separately for continuous gestures. No physical touch, photon, controller, CPU work qualification or ordinary diagnostics overhead claim.`,
    instrumentation:
      'Existing opt-in application diagnostics, bounded trusted input witness and retained run reads at 600ms action boundaries. No per-frame external work probe, CPU profile, heap/GC, pixel readback or screenshot.',
    performanceGateStatus: 'excluded-from-core-work-and-overhead-cohorts',
    actions: [],
    movement: [],
    errors: [],
    failedRequests: [],
    failure: null,
  };
  const save = () => writeTouchReport(output, report);
  await save();
  const playwright = await import(pathToFileURL(plan.browserModule).href);
  let browser,
    context,
    page,
    recording,
    deadline,
    cdp,
    contact = false,
    observedClosed = false;
  const phase = () => page.locator('body').getAttribute('data-flight-state');
  const requirePhase = (value, timeout = 20000) =>
    page.waitForFunction((value) => document.body?.dataset.flightState === value, value, {
      timeout,
    });
  const action = (name, details = {}) =>
    report.actions.push({ name, at: new Date().toISOString(), ...details });
  const click = async (selector) => {
    await waitQualificationControl(page, selector, 60000);
    await page.locator(selector).click();
    action('public-click', { selector });
  };
  try {
    browser = await playwright[job.engine].launch({
      headless: false,
      ...(job.engine === 'chromium' ? { executablePath: plan.chromeExecutable } : {}),
      timeout: 30000,
    });
    report.browserVersion = browser.version();
    context = await browser.newContext({
      ...job.context,
      serviceWorkers: 'block',
      reducedMotion: 'no-preference',
    });
    page = await context.newPage();
    page.on('pageerror', (error) => {
      if (report.errors.length < 64) report.errors.push(String(error).slice(0, 8192));
      else report.errorOverflow = true;
    });
    page.on('requestfailed', (request) => {
      if (report.failedRequests.length < 64)
        report.failedRequests.push({ url: request.url().slice(0, 8192), error: request.failure() });
      else report.failedRequestOverflow = true;
    });
    deadline = setTimeout(() => {
      report.deadlineReached = true;
      void browser?.close().catch(() => {});
    }, 240000);
    await page.bringToFront();
    // Same prospective single fixed window; no retry or post-navigation recalibration.
    const expected = { ...job.context.viewport, dpr: job.context.deviceScaleFactor };
    report.blankViewportFixture = await page.evaluate(prepareCadenceViewport, expected);
    await page.waitForFunction(
      ({ width, height, dpr }) =>
        innerWidth === width && innerHeight === height && devicePixelRatio === dpr,
      expected,
      { timeout: 2000 },
    );
    const cadence = await page.evaluate(observeSettledCadence, { expected });
    report.externalCadence = calibrateSettledCadence(cadence);
    await page.addInitScript(installTouchProbe, { mode: job.mode });
    const url = new URL(plan.address);
    url.searchParams.set('journey', 'opening');
    url.searchParams.set('performance', '1');
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    report.csp = response.headers()['content-security-policy'];
    assert.equal(report.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
    if (await page.locator('input[name=password]').isVisible()) {
      await page.locator('input[name=password]').fill('fixture-password');
      await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    }
    await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
      timeout: 120000,
    });
    const identityURL = new URL('build-info.json', plan.address).href;
    const identityBytes = await page.evaluate(async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Identity HTTP${response.status}`);
      return response.text();
    }, identityURL);
    const identity = JSON.parse(identityBytes);
    report.buildIdentity = {
      url: identityURL,
      sourceRevision: identity.sourceRevision,
      version: identity.version,
      sha256: digest(identityBytes),
    };
    assert.equal(identity.sourceRevision, plan.artifact.sourceRevision);
    assert.equal(report.buildIdentity.sha256, plan.artifact.buildInfoSHA256);
    report.environment = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      maxTouchPoints: navigator.maxTouchPoints,
      userAgent: navigator.userAgent,
    }));
    assert.equal(report.environment.dpr, job.context.deviceScaleFactor);
    assert.equal(report.environment.viewport.width, job.context.viewport.width);
    assert.equal(report.environment.viewport.height, job.context.viewport.height);
    if (job.engine === 'chromium') assert(report.environment.maxTouchPoints > 0);
    report.nativeCapability = {
      reportedMaxTouchPoints: report.environment.maxTouchPoints,
      authority:
        'Actual trusted native touch with meaningful movement and exact tick/render counts.',
      metadataIsNotCapabilityGate: job.engine === 'webkit',
      syntheticDOMEvents: false,
    };

    await click('#shell-options');
    await click('#settings-tab-controls');
    await page.locator('#touch-mode').selectOption(job.mode);
    await page.locator('#screen-controls').selectOption('always');
    action('public-control-preferences', { mode: job.mode, screenControls: 'always' });
    report.settingsExit = [];
    for (let step = 0; step < 2 && (await page.locator('#settings-dialog').isVisible()); step++) {
      const before = await page.locator('#settings-dialog').getAttribute('data-settings-view');
      await click('[data-close="settings-dialog"]');
      report.settingsExit.push({
        step,
        before,
        openAfter: await page.locator('#settings-dialog').isVisible(),
        viewAfter: await page.locator('#settings-dialog').getAttribute('data-settings-view'),
      });
    }
    await page.waitForFunction(() => !document.getElementById('settings-dialog')?.open, null, {
      timeout: 5000,
    });
    report.beforeStart = await page.evaluate(() => ({
      retained: window.soloTouchProbe.read(),
      application: window.RevealLineSoloPerformance.export(),
    }));
    await click('#shell-featured');
    await requirePhase('running', 60000);
    await page.waitForFunction(
      () => {
        const state = window.soloTouchProbe.read();
        return state.phase === 'running' && state.levelId !== null && state.tick !== null;
      },
      null,
      { timeout: 5000 },
    );
    action('first-active-retained-paint-observed');
    await observeTouchCadenceAfterStart(page, report);
    const initial = await page.evaluate(() => window.soloTouchProbe.read());
    report.initial = initial;
    assert.equal(initial.levelId, 'first-return');
    assert.equal(initial.trailCells, 0);
    let anchor;
    if (job.mode !== 'dpad') {
      await waitQualificationControl(page, '#touch-surface', 10000);
      const box = await page.locator('#touch-surface').boundingBox();
      assert(
        box && box.width >= 100 && box.height >= 20,
        'Public surface too small for the declared native gesture',
      );
      anchor = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const hit = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest('#touch-surface')?.id ?? null,
        anchor,
      );
      assert.equal(hit, 'touch-surface', 'Gesture must begin on the visible public touch surface');
      cdp = await context.newCDPSession(page);
      report.nativeDispatch = {
        protocol: 'CDP Input.dispatchTouchEvent',
        pointerContactId: 1,
        anchor,
        displacementCSSPixels: 40,
        eventSequence: 'touchStart;24 alternating touchMove;touchEnd',
        syntheticDOMEvents: false,
      };
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ ...anchor, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
      });
      contact = true;
      action('native-touch-neutral-down', { anchor, expectedDirectionChanges: 0 });
      await wait(250);
      report.afterNeutralDown = await page.evaluate(() => window.soloTouchProbe.read());
      assert.equal(report.afterNeutralDown.phase, 'running');
      assert.equal(report.afterNeutralDown.x, initial.x);
      assert.equal(report.afterNeutralDown.y, initial.y);
    }
    for (let index = 0; index < plan.protocol.directionChanges; index++) {
      const direction = index % 2 ? 'left' : 'right';
      const before = await page.evaluate(() => window.soloTouchProbe.read());
      const dispatched = await dispatchTouchDirection({ page, cdp, anchor, mode: job.mode, index });
      action(dispatched.name, dispatched);
      await wait(plan.protocol.holdAfterTapMs);
      const after = await page.evaluate(() => window.soloTouchProbe.read());
      report.movement.push({ index, direction, before, after });
      assert.equal(after.phase, 'running');
      assert(after.visible && after.focused);
      assert.equal(after.levelId, initial.levelId);
      assert.equal(after.lives, initial.lives);
      assert.equal(after.trailCells, 0, 'Safe border recipe unexpectedly cut');
      assert.equal(after.y, initial.y, 'Left/right border recipe left its legal row');
      assert(after.tick > before.tick);
      assert(
        direction === 'right' ? after.x > before.x : after.x < before.x,
        'Each native direction command must cause actual movement; event padding cannot pass',
      );
    }
    if (contact) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      contact = false;
      action('native-touch-end');
    }
    await page.keyboard.press('Escape');
    action('public-pause');
    await requirePhase('paused');
    report.application = await page.evaluate(() => window.RevealLineSoloPerformance.export());
    report.nativeInput = await page.evaluate(() => window.soloTouchProbe.export());
    assert.equal(report.nativeInput.events.length, expectedCount);
    assert.equal(
      report.nativeInput.events.filter((event) => event.type === 'pointerdown').length,
      job.mode === 'dpad' ? 24 : 1,
    );
    assert.equal(
      report.nativeInput.events.filter((event) => event.type === 'pointermove').length,
      job.mode === 'dpad' ? 0 : 24,
    );
    report.acceptedInputAccounting = {
      meaningfulDirectionCommands: 24,
      acceptedNeutralDowns: Number(job.mode !== 'dpad'),
      expectedObservations: expectedCount,
    };
    assert(
      report.nativeInput.events.every(
        (event) => event.isTrusted && event.pointerType === 'touch' && event.defaultPrevented,
      ),
    );
    assertTouchMovement(report, job);
    assertTouchEvents(report, job);
    const touch = report.application.inputLatency.byKind.touch;
    Object.assign(report, touchLatency(report, quantileBound));
    assert.equal(
      touch.toTick.count,
      expectedCount,
      'Every accepted native down/move must have one tick observation',
    );
    assert.equal(
      touch.toRender.count,
      expectedCount,
      'Every accepted native down/move must have one submitted-render observation',
    );
    recording = await readPublicQualificationReplay(page, 20000);
    assert.equal(report.errors.length, 0, 'Native page errors retained');
    report.status = 'scenario-passed-awaiting-strict-replay';
  } catch (error) {
    report.status = 'fail';
    report.failure = String(error.stack ?? error);
  } finally {
    clearTimeout(deadline);
    if (contact && cdp) {
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        action('harness-cleanup-native-touch-end');
      } catch (error) {
        report.contactCleanupFailure = String(error);
      }
      contact = false;
    }
    if (page && !page.isClosed()) {
      try {
        report.preCleanupPhase = await phase();
        if (report.preCleanupPhase === 'running') {
          await page.keyboard.press('Escape');
          action('harness-failure-cleanup-pause');
          await requirePhase('paused', 5000);
        }
        report.application ??= await page.evaluate(
          () => window.RevealLineSoloPerformance?.export() ?? null,
        );
        report.nativeInput ??= await page.evaluate(() => window.soloTouchProbe?.export() ?? null);
        if (!recording) {
          const partial = await readPartialTouchReplay(page, 10000);
          recording = partial.recording;
          report.partialReplay = true;
          report.partialReplayReadback = {
            source: partial.source,
            authority: 'public-text-only; the original scenario failure remains failed',
          };
        }
      } catch (error) {
        report.partialExportFailure = String(error.stack ?? error);
      }
    }
    await closeTouchOwner(context, 'context', report);
    await closeTouchOwner(browser, 'browser', report);
    observedClosed = Boolean(browser && !browser.isConnected());
    report.observedBrowserClosed = observedClosed;
    report.observedBrowserClosedAt = new Date().toISOString();
    await save();
  }
  if (recording) {
    assert(
      Buffer.byteLength(recording) <= TOUCH_PROTOCOL.replayBytes,
      'Replay evidence exceeds bound',
    );
    await writeFile(`${output}.replay.json`, recording, { flag: 'wx' });
    report.recording = {
      path: `${output}.replay.json`,
      sha256: digest(recording),
      bytes: Buffer.byteLength(recording),
    };
    try {
      report.nativeReplay = await verifyNativeQualificationReplay({
        playwright,
        engine: job.engine,
        executablePath: plan.chromeExecutable,
        observedBrowserClosed: observedClosed,
        expected: {
          browserVersion: report.browserVersion,
          buildIdentity: report.buildIdentity,
          csp: report.csp,
        },
        recordingText: recording,
        requirements: { movingTicks: 240 },
        expectedDefinition: recipe.expectedReplayDefinition,
      });
    } catch (error) {
      report.nativeReplay = { status: 'fail', failure: String(error.stack ?? error) };
    }
    if (report.status === 'scenario-passed-awaiting-strict-replay')
      report.status = report.nativeReplay.status === 'pass' ? 'pass' : 'fail';
  }
  if (
    !observedClosed ||
    [
      'contactCleanupFailure',
      'contextCloseFailure',
      'browserCloseFailure',
      'errorOverflow',
      'failedRequestOverflow',
    ].some((key) => report[key])
  )
    report.status = 'fail';
  report.completedAt = new Date().toISOString();
  await save();
  return report.status !== 'pass' ? 1 : report.inputGateStatus === 'fail' ? 2 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(
    process.argv.length,
    4,
    'Usage: observe-solo-native-touch.mjs execution-plan.json fresh-report.json',
  );
  process.exitCode = await observeTouch(process.argv[2], process.argv[3]);
}
