/* global document, localStorage, navigator */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  readPublicQualificationReplay,
  waitQualificationControl,
} from './solo-qualification-export.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
export const OFFLINE_GAMEPLAY = Object.freeze({
  format: 'SoloOfflinePublicGameplayV1',
  diagnosticTimeoutMs: 600000,
  playTimeoutMs: 120000,
  replayTimeoutMs: 120000,
  maximumExports: 2,
  maximumExportBytes: 256 * 1024,
});

export function validateOfflineGameplayPlan(value) {
  assert.deepEqual(value, OFFLINE_GAMEPLAY);
  return value;
}

export const NATIVE_OFFLINE_STATE_POLICY = 'owned-cdp-after-navigation-v1';
const nativeOfflineParameters = Object.freeze({
  offline: true,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});

export function nativeOfflineStateApplied(value, expectedURL) {
  return Boolean(
    expectedURL &&
      value?.status === 'applied' &&
      value.session === 'existing-worker-observer' &&
      value.commandCompleted === true &&
      typeof value.before?.online === 'boolean' &&
      value.before.url === expectedURL &&
      value.after?.online === false &&
      value.after.url === expectedURL,
  );
}

// Chromium 151 loses native navigator state on document navigation. Reapply it
// on the already-owned observer session; Playwright's transport remains offline.
// The mutable witness retains a failed stage before rejection, without retries.
export async function restoreNativeOfflineState({
  page,
  cdp,
  expectedURL,
  witness,
  ensureOwner,
  isServerStopped,
  bounded,
  remaining = () => 5000,
}) {
  assert.equal(witness.status, undefined, 'Native offline witness cannot be reused');
  witness.status = 'running';
  witness.session = 'existing-worker-observer';
  const check = () => {
    ensureOwner();
    assert(isServerStopped(), 'Offline origin restarted during native-state correction');
  };
  const operation = async (label, run) => {
    check();
    const timeout = Math.min(5000, remaining(5000));
    assert(Number.isFinite(timeout) && timeout > 0, 'Native offline operation deadline exhausted');
    const result = await bounded(label, run, timeout);
    check();
    return result;
  };
  const snapshot = (label) =>
    operation(label, () =>
      page.evaluate(() => ({ online: navigator.onLine, url: globalThis.location.href })),
    );
  try {
    witness.before = await snapshot('Read native state before offline correction');
    assert.equal(typeof witness.before.online, 'boolean');
    assert.equal(witness.before.url, expectedURL, 'Unexpected offline document before correction');
    await operation('Restore owned native offline state', () =>
      cdp.send('Network.overrideNetworkState', nativeOfflineParameters),
    );
    witness.commandCompleted = true;
    witness.after = await snapshot('Read native state after offline correction');
    assert.equal(witness.after.url, expectedURL, 'Unexpected offline document after correction');
    assert.equal(witness.after.online, false, 'Native offline state was not restored');
    witness.status = 'applied';
    assert(nativeOfflineStateApplied(witness, expectedURL));
    return witness;
  } catch (error) {
    witness.status = 'failed';
    witness.failure = String(error.message ?? error).slice(0, 2048);
    throw error;
  }
}

const nativePolicyAllows = (report, witness, expectedURL) =>
  report.nativeOfflineStatePolicy === undefined ||
  (report.nativeOfflineStatePolicy === NATIVE_OFFLINE_STATE_POLICY &&
    nativeOfflineStateApplied(witness, expectedURL));

export function offlineLaunchAllowsGameplay(report) {
  const after = report.workerSnapshots?.find((row) => row.stage === 'after-restart-navigation');
  return Boolean(
    report.offlineNavigation?.publicBootReady === true &&
      report.offlineNavigation.serverStopped === true &&
      report.offlineNavigation.offlineEmulation === true &&
      nativePolicyAllows(
        report,
        report.offlineNavigation.nativeState,
        report.offlineNavigation.selectedGame?.url,
      ) &&
      after?.identityMatches === true &&
      after.keysMatch === true &&
      after.indexMatches === true &&
      !after.unobserved &&
      !report.deadlineReached &&
      !report.failure &&
      report.diagnosticOutcome === 'observed-launcher-and-cache-retained',
  );
}

export function offlineGameplayAssessment(report) {
  const value = report.gameplay;
  if (!report.gameplayRequested) return 'not-requested';
  if (!offlineLaunchAllowsGameplay(report))
    return value?.status === 'not-run-launch-unqualified' && report.replays?.length === 0
      ? 'not-run-launch-unqualified'
      : 'failed';
  if (
    value?.status !== 'passed' ||
    value.route !== 'explicit-installed-starter-url' ||
    report.preparedGameplay?.routeId !== 'whole-spatial-v25' ||
    report.preparedGameplay?.groupId !== 'solo:horizon-starter' ||
    value.serverStoppedThroughout !== true ||
    !value.observedBrowserClosed ||
    value.exportCount !== 2 ||
    report.replays?.length !== 2 ||
    value.failure ||
    value.deadlineReached ||
    !nativePolicyAllows(report, value.nativeState, value.address)
  )
    return 'failed';
  for (const [index, entry] of report.replays.entries()) {
    const native = entry.nativeReplay;
    if (
      entry.levelId !== ['first-return', 'choose-your-share'][index] ||
      !(entry.bytes > 0 && entry.bytes <= OFFLINE_GAMEPLAY.maximumExportBytes) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      native?.status !== 'pass' ||
      native.engine !== 'chromium' ||
      native.observation?.match !== true ||
      native.observation?.status !== 'pass' ||
      native.observation?.levelId !== entry.levelId ||
      native.browserVersion !== report.browserVersion ||
      native.buildIdentity?.sourceRevision !== report.artifact.sourceRevision ||
      native.recording?.sha256 !== entry.sha256 ||
      native.recording?.bytes !== entry.bytes
    )
      return 'failed';
  }
  return 'passed';
}

// The original 600-second diagnostic has already closed before this function.
// All actions share one new 120-second deadline; none can repair a failed launch.
export async function playOfflineStarter({
  page,
  report,
  address,
  entryHTMLSha256,
  csp,
  accessKey,
  ensureOwner,
  isServerStopped,
  step,
  pending,
  restoreNativeState,
  now = Date.now,
}) {
  assert(offlineLaunchAllowsGameplay(report), 'No gameplay after unqualified offline launch');
  assert.equal(report.preparedGameplay?.routeId, 'whole-spatial-v25');
  assert.equal(report.preparedGameplay?.groupId, 'solo:horizon-starter');
  assert.equal(new URL(address).search, '?journey=whole-spatial-v25');
  const started = now(),
    deadline = started + OFFLINE_GAMEPLAY.playTimeoutMs;
  const remaining = (cap = OFFLINE_GAMEPLAY.playTimeoutMs) => {
    ensureOwner();
    assert(!report.gameplay?.deadlineReached, 'Offline public-play deadline exceeded');
    assert(isServerStopped(), 'Offline origin restarted during public play');
    const ms = deadline - now();
    assert(ms > 0, 'Offline public-play deadline exceeded');
    return Math.min(cap, ms);
  };
  const click = async (selector) => {
    await waitQualificationControl(page, selector, remaining());
    await page.locator(selector).click({ timeout: remaining() });
    remaining();
    step('offline-public-click', { selector });
  };
  const state = async (value) => {
    await page.waitForFunction((wanted) => document.body?.dataset.flightState === wanted, value, {
      timeout: remaining(),
    });
    remaining();
  };
  const wait = async (ms) => {
    assert(remaining() >= ms, 'Insufficient public-play deadline for fixed input');
    await delay(ms);
    remaining();
  };
  const key = async (value, ms) => {
    remaining();
    await page.keyboard.down(value);
    try {
      await wait(ms);
    } finally {
      await page.keyboard.up(value);
    }
    step('offline-public-key', { value, ms });
  };
  const value = (report.gameplay = {
    status: 'running',
    route: 'explicit-installed-starter-url',
    address,
    startedAt: new Date().toISOString(),
    exports: [],
    scope:
      'Public installed Starter URL only after successful installed launcher routing; not default-mission or OS installation proof.',
  });
  const exported = [];
  const action = (async () => {
    try {
      step('offline-direct-starter-gameplay-leg', { destination: address });
      const response = await page.goto(address, { waitUntil: 'load', timeout: remaining() });
      remaining();
      assert.equal(response.status(), 200);
      assert.equal(response.fromServiceWorker(), true);
      // Response-body read is bounded by the shared play deadline, then drained by
      // the parent observation owner if the browser aborts it on closure.
      let bodyTimer;
      const bodyRead = response.body();
      bodyRead.catch(() => {});
      pending.push(bodyRead);
      const html = await Promise.race([
        bodyRead,
        new Promise((_, reject) => {
          bodyTimer = setTimeout(
            () => reject(Error('Offline HTML body deadline')),
            remaining(5000),
          );
        }),
      ]).finally(() => clearTimeout(bodyTimer));
      remaining();
      assert.equal(sha(html), entryHTMLSha256);
      assert.equal(response.headers()['content-security-policy'], csp);
      if (report.nativeOfflineStatePolicy !== undefined) {
        assert.equal(report.nativeOfflineStatePolicy, NATIVE_OFFLINE_STATE_POLICY);
        value.nativeState = {};
        await restoreNativeState(value.nativeState, address, remaining);
        remaining();
        assert(nativeOfflineStateApplied(value.nativeState, address));
      }
      await page.waitForFunction(
        () => document.documentElement.dataset.bootState === 'ready',
        null,
        {
          timeout: remaining(),
        },
      );
      remaining();
      step('offline-direct-starter-boot-ready');
      const restart = await page.evaluate(
        (key) => ({
          unlocked: document.documentElement.dataset.accessState === 'unlocked',
          remembered: localStorage.getItem(key) !== null,
          online: navigator.onLine,
          controller: navigator.serviceWorker.controller?.scriptURL ?? null,
        }),
        accessKey,
      );
      remaining();
      value.offlineRestart = restart;
      assert(
        restart.unlocked && restart.remembered && restart.online === false && restart.controller,
      );
      await click('#shell-featured');
      await state('running');
      await key('ArrowRight', 1358);
      await key('ArrowDown', 3908);
      const winDeadline = now() + Math.min(20000, remaining());
      while (true) {
        remaining();
        const overlay = page.locator('#game-overlay');
        if (
          (await overlay.isVisible()) &&
          ['won', 'lost'].includes(await overlay.getAttribute('data-kind'))
        ) {
          assert.equal(await overlay.getAttribute('data-kind'), 'won');
          break;
        }
        assert(now() < winDeadline, 'Public earned win did not appear');
        for (const selector of ['#skip-celebration', '#show-result'])
          if (await page.locator(selector).isVisible())
            await page.locator(selector).click({ timeout: remaining() });
        await wait(100);
      }
      step('offline-earned-first-capture');
      const exportReplay = async (label, levelId) => {
        assert(exported.length < OFFLINE_GAMEPLAY.maximumExports);
        const text = await readPublicQualificationReplay(page, remaining(20000));
        remaining();
        const bytes = Buffer.byteLength(text);
        assert(bytes > 0 && bytes <= OFFLINE_GAMEPLAY.maximumExportBytes);
        const parsed = JSON.parse(text),
          native = parsed.replay ?? parsed;
        assert.equal(native.level?.id, levelId);
        assert(native.checkpoint && Array.isArray(native.segments));
        const entry = {
          label,
          levelId,
          bytes,
          sha256: sha(text),
          segmentCount: native.segments.length,
        };
        value.exports.push(entry);
        exported.push({ text, native, entry });
      };
      await exportReplay('offline-first-earned-capture', 'first-return');
      await click('#replay-dialog .dialog-close');
      await click('#shell-workshop-dialog [data-close="shell-workshop-dialog"]');
      await click('#settings-dialog .dialog-close');
      await key('Escape', 20);
      await click('#next-button');
      await state('running');
      await key('ArrowRight', 600);
      await key('ArrowLeft', 600);
      await wait(3000);
      await state('running');
      await click('#pause-button');
      await state('paused');
      await exportReplay('offline-next-continued', 'choose-your-share');
      assert(exported[1].native.segments.reduce((n, s) => n + s.ticks, 0) >= 120);
      remaining();
      value.serverStoppedThroughout = true;
      value.exportCount = exported.length;
      value.playCompletedAt = new Date().toISOString();
      value.playElapsedMs = now() - started;
      value.status = 'awaiting-post-close-strict-replay';
      return exported;
    } catch (error) {
      value.status = 'failed';
      value.failure = String(error.stack ?? error);
      throw error;
    }
  })();
  action.catch(() => {});
  pending.push(action);
  let timer;
  try {
    return await Promise.race([
      action,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          value.deadlineReached = true;
          value.status = 'failed';
          reject(Error('Offline public-play deadline exceeded'));
        }, remaining());
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
