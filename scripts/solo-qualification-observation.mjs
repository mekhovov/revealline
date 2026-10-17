import { evaluateQualificationBudgets } from './solo-qualification.mjs';

/** Node-side error-event metadata only. Never stringify arbitrary thrown values
 * or inspect nested properties; even hostile accessors must not break retention.
 * The three UTF-16 limits keep added JSON below 32 KiB even when every character
 * requires a six-byte JSON escape. The existing legacy string stays separate. */
export function qualificationPageErrorDetails(error) {
  const fields = {};
  for (const [name, limit] of [
    ['name', 128],
    ['message', 1024],
    ['stack', 4096],
  ]) {
    let value;
    try {
      value = error?.[name];
    } catch {
      fields[name] = { value: null, type: 'unavailable', readFailed: true, truncated: false };
      continue;
    }
    const type = value === null ? 'null' : typeof value;
    fields[name] =
      type === 'string'
        ? {
            value: value.slice(0, limit),
            type,
            readFailed: false,
            truncated: value.length > limit,
            originalCodeUnits: value.length,
          }
        : { value: null, type, readFailed: false, truncated: false };
  }
  return {
    format: 'SoloQualificationPageErrorDetailsV1',
    thrownType: error === null ? 'null' : typeof error,
    fields,
    scope: 'Error-event fields only; top-level page URL is not the exception frame identity.',
  };
}

/** rAF timestamps describe frame time, which can precede observer registration.
 * Only two callbacks establish an interval. Preserve later gaps unchanged. */
export function createRafIntervalClock(
  registeredAtMs,
  callbackClock = () => globalThis.performance.now(),
) {
  let previous = null,
    first = null;
  return {
    observe(timestampMs) {
      if (previous === null) {
        const callbackAtMs = callbackClock();
        first = {
          registeredAtMs,
          timestampMs,
          callbackAtMs,
          registrationToFirstCallbackMs: callbackAtMs - registeredAtMs,
          timestampMinusRegistrationMs: timestampMs - registeredAtMs,
        };
        previous = timestampMs;
        return null;
      }
      const elapsed = timestampMs - previous;
      previous = timestampMs;
      return elapsed;
    },
    snapshot: () =>
      first ? { ...first } : { registeredAtMs, timestampMs: null, callbackAtMs: null },
  };
}

/** Self-contained browser collector. One fixed window, before game navigation;
 * a lost foreground interval or deadline never starts a replacement window. */
export function observeLowWorkCadence({ timeoutMs = 5000 } = {}, environment = globalThis) {
  const documentRef = environment.document;
  const registeredAtMs = environment.performance.now();
  const state = () => ({
    url: environment.location.href,
    visible: !documentRef.hidden && documentRef.visibilityState === 'visible',
    focused: documentRef.hasFocus(),
    viewport: { width: environment.innerWidth, height: environment.innerHeight },
    devicePixelRatio: environment.devicePixelRatio,
  });
  const initialState = state();
  let foregroundThroughout = initialState.visible && initialState.focused;
  let environmentStableThroughout = true;
  let previous = null,
    firstRafCallback = null,
    frameId,
    timerId,
    finished = false;
  const samples = [];
  return new Promise((resolve) => {
    const loseFocus = () => {
      foregroundThroughout = false;
    };
    const observeState = () => {
      const current = state();
      foregroundThroughout &&= current.visible && current.focused;
      environmentStableThroughout &&=
        current.url === initialState.url &&
        current.viewport.width === initialState.viewport.width &&
        current.viewport.height === initialState.viewport.height &&
        current.devicePixelRatio === initialState.devicePixelRatio;
      return current;
    };
    const finish = (deadlineReached) => {
      if (finished) return;
      finished = true;
      environment.cancelAnimationFrame(frameId);
      environment.clearTimeout(timerId);
      environment.removeEventListener('blur', loseFocus);
      environment.removeEventListener('resize', observeState);
      documentRef.removeEventListener('visibilitychange', observeState);
      resolve({
        samples,
        initialState,
        finalState: observeState(),
        foregroundThroughout,
        environmentStableThroughout,
        firstRafCallback,
        elapsedMs: environment.performance.now() - registeredAtMs,
        timeoutMs,
        deadlineReached,
      });
    };
    const frame = (timestampMs) => {
      if (finished) return;
      observeState();
      const callbackAtMs = environment.performance.now();
      if (previous === null)
        firstRafCallback = {
          registeredAtMs,
          timestampMs,
          callbackAtMs,
          registrationToFirstCallbackMs: callbackAtMs - registeredAtMs,
          timestampMinusRegistrationMs: timestampMs - registeredAtMs,
        };
      else samples.push(timestampMs - previous);
      previous = timestampMs;
      if (callbackAtMs - registeredAtMs >= timeoutMs) finish(true);
      else if (samples.length === 30) finish(false);
      else frameId = environment.requestAnimationFrame(frame);
    };
    environment.addEventListener('blur', loseFocus);
    environment.addEventListener('resize', observeState);
    documentRef.addEventListener('visibilitychange', observeState);
    timerId = environment.setTimeout(() => finish(true), timeoutMs);
    frameId = environment.requestAnimationFrame(frame);
  });
}

export function calibrateLowWorkCadence(observation) {
  const state = {
    ready:
      observation.foregroundThroughout === true &&
      observation.environmentStableThroughout === true &&
      observation.initialState?.url === 'about:blank' &&
      observation.finalState?.url === 'about:blank' &&
      observation.initialState?.viewport?.width === observation.finalState?.viewport?.width &&
      observation.initialState?.viewport?.height === observation.finalState?.viewport?.height &&
      observation.initialState?.devicePixelRatio === observation.finalState?.devicePixelRatio &&
      observation.deadlineReached === false,
    phase: 'before-game-navigation',
    ...observation,
  };
  const result = calibrateReadyCadence(observation.samples, state);
  return {
    ...result,
    protocol: 'foreground-about-blank-fixed-30-v1',
    scope:
      'One fixed window of 30 consecutive rAF intervals on foreground about:blank before game navigation, in the same browser page, context, viewport, DPR and CPU setting. No retry, trimming or gameplay recalibration. Browser scheduling cadence is not physical refresh rate, asset readiness or idle-application readiness. The admitted external B stays fixed across navigation and reload; application B remains independent.',
  };
}

/** Installed separately in every document with the same pre-navigation value.
 * Startup observations have no setter for this cadence or its admitted B. */
export function frozenExternalCadence(calibration) {
  return Object.freeze({
    calibration,
    baselineMs:
      calibration?.status === 'measured-before-play' &&
      Number.isFinite(calibration.baselineMs) &&
      calibration.baselineMs > 0
        ? calibration.baselineMs
        : null,
  });
}

/** Self-contained for installation before page scripts. Cadence eligibility is
 * not application/asset readiness: packaged title launches prepare on Start. */
export function readPrePlayReadiness(documentRef = globalThis.document) {
  const controls = ['#shell-featured', '#start-button'].map((selector) => {
    const element = documentRef.querySelector(selector);
    return {
      selector,
      present: Boolean(element),
      visible: Boolean(
        element &&
          !element.hidden &&
          element.getClientRects().length &&
          documentRef.defaultView.getComputedStyle(element).visibility === 'visible',
      ),
      enabled: Boolean(
        element && !element.disabled && element.getAttribute('aria-disabled') !== 'true',
      ),
    };
  });
  let packageConsent = false;
  const marker = documentRef.querySelector('meta[name="revealline-offline"]')?.content;
  if (marker && marker.length <= 65536) {
    try {
      packageConsent = JSON.parse(marker).packageConsent === true;
    } catch {
      // An invalid marker cannot establish preparation deferred by the package.
    }
  }
  const boot = documentRef.documentElement.dataset.bootState ?? null,
    phase = documentRef.body?.dataset.flightState ?? null,
    picture = documentRef.body?.dataset.pictureState ?? null,
    publicLaunch = controls.find((control) => control.visible && control.enabled)?.selector ?? null;
  const preparationDeferredToStart =
    packageConsent && phase === 'briefing' && picture === 'pending';
  return {
    ready:
      boot === 'ready' &&
      ['briefing', 'paused'].includes(phase) &&
      Boolean(publicLaunch) &&
      (picture === 'ready' || preparationDeferredToStart) &&
      !documentRef.hidden,
    boot,
    phase,
    picture,
    pictureReady: picture === 'ready',
    preparationDeferredToStart,
    packageConsent,
    publicLaunch,
    controls,
    visibility: documentRef.visibilityState,
    scope: preparationDeferredToStart
      ? 'Prelaunch title; required preparation deferred to Start. Cadence eligibility does not establish application or asset readiness.'
      : 'Foreground public launch with observable picture readiness; other preparation may remain.',
  };
}

/** Declared stability check for a single, fixed pre-play30-frame window. Never
 * recalibrate after starting to make missed frames disappear. */
export function calibrateReadyCadence(samples, state = {}) {
  const valid =
    samples.length === 30 && samples.every((value) => Number.isFinite(value) && value > 0);
  if (!valid)
    return { status: 'provisional-incomplete', samples: samples.slice(), state, baselineMs: null };
  const sorted = samples.slice().sort((a, b) => a - b);
  const baselineMs = (sorted[14] + sorted[15]) / 2;
  const meanMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const standardDeviationMs = Math.sqrt(
    samples.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / samples.length,
  );
  const coefficientOfVariation = standardDeviationMs / meanMs;
  const p05Ms = sorted[1],
    p95Ms = sorted[28];
  const spread = (p95Ms - p05Ms) / baselineMs;
  const stable =
    state.ready === true &&
    state.phase !== 'running' &&
    coefficientOfVariation <= 0.1 &&
    spread <= 0.2;
  return {
    status: stable ? 'measured-before-play' : 'provisional-unstable',
    baselineMs,
    samples: samples.slice(),
    state,
    meanMs,
    standardDeviationMs,
    coefficientOfVariation,
    p05Ms,
    p95Ms,
    minimumMs: sorted[0],
    maximumMs: sorted.at(-1),
    relativeP05P95Spread: spread,
    limits: { coefficientOfVariation: 0.1, relativeP05P95Spread: 0.2 },
    scope:
      'Thirty foreground rAF intervals after boot with a visible enabled public launch, before playing. Packaged title preparation may be explicitly deferred to Start; asset readiness is recorded separately. This does not prove application readiness, host quiescence or physical refresh rate.',
  };
}

export function externalQualificationBudgets(probe) {
  const playing = probe?.phases?.indexOf('running');
  if (playing === undefined || playing < 0 || !probe.work)
    return { status: 'unobserved', reason: 'Independent application work probe unavailable.' };
  const stats = probe.work.totals,
    width = probe.work.width,
    offset = playing * width;
  const frameOffset = playing * 5,
    missedOffset = playing * 3;
  const evidence = {
    enabled: true,
    baselineMs: probe.calibration?.baselineMs,
    cadenceCalibration: { status: probe.calibration?.status },
    histogramUpperBoundsMs: probe.bounds,
    phases: {
      playing: {
        durationMs: probe.totals[frameOffset + 1],
        frames: {
          count: probe.totals[frameOffset],
          totalMs: probe.totals[frameOffset + 1],
          maxMs: probe.totals[frameOffset + 2],
          histogram: probe.counts[playing],
          missedOpportunities: probe.missed[missedOffset],
          maxMissedStreak: probe.missed[missedOffset + 1],
        },
        work: {
          count: stats[offset],
          totalMs: stats[offset + 1],
          maxMs: stats[offset + 2],
          histogram: stats.slice(offset + 3, offset + width),
          histogramUpperBoundsMs: probe.work.bounds,
        },
      },
    },
  };
  const result = evaluateQualificationBudgets(evidence);
  const checks = result.checks.slice(0, 4);
  const numericalStatus = checks.some((row) => row.status === 'fail')
    ? 'fail'
    : checks.every((row) => row.status === 'pass')
      ? 'pass'
      : 'inconclusive';
  let exactRunningWork = null;
  if (probe.work.omittedCount === 0 && probe.work.recent.length === probe.work.count * 2) {
    const samples = [];
    for (let i = 0; i < probe.work.recent.length; i += 2)
      if (probe.work.recent[i + 1] === playing) samples.push(probe.work.recent[i]);
    if (samples.length === stats[offset] && samples.length) {
      samples.sort((a, b) => a - b);
      const value = (fraction) => samples[Math.ceil(fraction * samples.length) - 1];
      exactRunningWork = {
        samples: samples.length,
        p50Ms: value(0.5),
        p95Ms: value(0.95),
        p99Ms: value(0.99),
        maximumMs: samples.at(-1),
        method:
          'Exact nearest-rank quantiles; the independent ring retained every application callback in this document.',
      };
    }
  }
  return {
    ...result,
    checks,
    numericalStatus,
    exactRunningWork,
    status:
      numericalStatus === 'fail'
        ? 'fail'
        : result.review.length
          ? 'review-required'
          : numericalStatus === 'pass'
            ? 'pass-observed-external-window'
            : 'inconclusive',
    unobserved: [
      'Internal input-to-render latency',
      'Internal safety interruptions/failures',
      'Owned resources when application export is absent',
    ],
    scope:
      'Same external Phaser PRE_STEP→POST_RENDER observer on both builds, plus rAF cadence. Includes observer overhead and render submission, not GPU completion. External success never establishes missing internal checks.',
  };
}

/** Preserve unresolved independent measurements in the headline; source rows
 * remain explicit because a single severity label cannot express every gap. */
export function aggregateQualificationGates({
  application,
  external,
  workProbe = false,
  baselineRuntime = false,
  applicationAvailable = !baselineRuntime,
}) {
  const components = [
    {
      source: 'application',
      status:
        baselineRuntime && !applicationAvailable
          ? 'partial-baseline-internal-unknown'
          : (application?.status ?? 'unobserved'),
    },
  ];
  if (workProbe)
    components.push({ source: 'external-work-probe', status: external?.status ?? 'unobserved' });
  const passes = new Set(['pass-observed-window', 'pass-observed-external-window']);
  const unresolved = components.filter(({ status }) => !passes.has(status));
  const has = (status) => components.some((row) => row.status === status);
  const status = has('invalid-evidence')
    ? 'invalid-evidence'
    : has('fail')
      ? 'fail'
      : has('review-required')
        ? 'review-required'
        : unresolved.some((row) => row.status !== 'partial-baseline-internal-unknown')
          ? 'inconclusive'
          : unresolved.length
            ? 'partial-baseline-internal-unknown'
            : 'pass-observed-window';
  return {
    status,
    components,
    unresolved,
    scope:
      'All requested independent components must resolve before a combined observed-window pass; baseline internal observations remain unknown.',
  };
}
