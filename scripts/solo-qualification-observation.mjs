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

// Prospective comparison only. No release or artifact authority is supplied here.
export const QUALITY_COMPARISON_SOURCE = '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7';
export const QUALITY_COMPARISON_RECIPES = Object.freeze({
  full: '6b8a1228961eb06e3731ed1db82f7a3852e45b0b1e0c41ba566cd3c9fbc7f71a',
  reduced: 'd25dca66beea78f53725a594bdcdd3c6228f5dd6d81e85cd21e092d031114b96',
});
// Corrected public compact-menu routes are admitted only for their separately
// declared source. Historical 4bf recipes retain their exact original identity.
export const COMPACT_QUALITY_COMPARISON_SOURCE = 'c696af41857840359ae473558b90682f3d71f2db';
export const COMPACT_QUALITY_COMPARISON_RECIPES = Object.freeze({
  full: 'ed26c97daf58226b48d02eb014cbfa5d9351e686916fd91d41c1741445051ab5',
  reduced: '2e7c56516c53b6fbcb9f63a807662ecc3d9e63d8812f0ef6377ac41c2532bd9d',
});
export function qualificationQualityOptions(flags, scenario, hash) {
  const selected = flags.filter((f) => f.startsWith('--visual-quality-observation'));
  if (!selected.length) return null;
  const require = (ok, reason) => {
    if (!ok) throw Error(reason);
  };
  require(selected.length === 1, 'One quality observation selector');
  const tier = selected[0].slice('--visual-quality-observation='.length);
  require(selected[0] === `--visual-quality-observation=${tier}` &&
    ['full', 'reduced'].includes(tier), 'Exact quality selector');
  const sourceRevision = flags.find((flag) => flag.startsWith('--source-revision='))?.slice(18);
  require([QUALITY_COMPARISON_SOURCE, COMPACT_QUALITY_COMPARISON_SOURCE].includes(
    sourceRevision,
  ), 'Exact public-effects source');
  const compact = sourceRevision === COMPACT_QUALITY_COMPARISON_SOURCE;
  const recipes = compact ? COMPACT_QUALITY_COMPARISON_RECIPES : QUALITY_COMPARISON_RECIPES;
  require(hash === recipes[tier], 'Exact public-effects recipe bytes');
  require(scenario.id ===
    `public-effects-${tier}-first30-border-v1${compact ? '-compact-close-v2' : ''}`, 'Exact public-effects recipe');
  require(scenario.timeoutMs === 240000, 'Original scenario deadline');
  for (const flag of [
    '--browser=webkit',
    '--context=persistent',
    '--cpu=1',
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--viewport=400x850',
    '--dpr=3',
    '--mobile-context',
    `--source-revision=${sourceRevision}`,
  ])
    require(flags.filter((f) => f === flag).length === 1, `Required ${flag}`);
  for (const prefix of [
    '--browser=',
    '--context=',
    '--cpu=',
    '--cadence=',
    '--viewport=',
    '--dpr=',
    '--source-revision=',
  ])
    require(flags.filter((f) => f.startsWith(prefix)).length === 1, 'Duplicate comparison option');
  require(!flags.some((f) =>
    /^--(?:baseline-runtime|readiness-probe|journal-cost-probe|cpu-profile|memory-profile|audio-proof|hitch-journal-preparation|hitch-journal-active-document|snapshot-chunks)/.test(
      f,
    ),
  ), 'No mixed observer modes');
  return {
    format: 'SoloPublicEffectsComparisonArmV1',
    tier,
    sourceRevision,
    scenarioSHA256: hash,
    performanceQualification: false,
  };
}

// Serialized into the same top-level init script as the existing observer.
// No callbacks, DOM reads, allocation or serialization in observe(). It records
// the application's retained submitted-board record, not physical scanout.
export function createSubmittedTierObservation() {
  const counts = new Uint32Array(3),
    transitions = new Float64Array(32 * 3);
  let scene = null,
    run = null,
    bound = false,
    invalid = false,
    overflow = false,
    samples = 0,
    changed = 0,
    previousTier = -1,
    firstAtMs = null,
    lastAtMs = null,
    firstTick = null,
    lastTick = null,
    activeEntries = 0,
    priorActive = false;
  return {
    bind(value) {
      if (bound || !value) invalid = true;
      else {
        scene = value;
        bound = true;
      }
    },
    observe(nowMs, phase) {
      const active = phase === 2;
      if (active && !priorActive) activeEntries++;
      priorActive = active;
      if (!active) return;
      if (samples >= 5000) {
        overflow = true;
        return;
      }
      samples++;
      if (!Number.isFinite(nowMs) || (lastAtMs !== null && nowMs < lastAtMs)) {
        invalid = true;
        return;
      }
      firstAtMs ??= nowMs;
      lastAtMs = nowMs;
      const paint = scene?.lastPaint,
        current = paint?.run;
      if (
        !bound ||
        !current ||
        scene.frameActive !== true ||
        scene.displayedBoardValid !== true ||
        scene.submittedRun !== current ||
        current.status !== 'running' ||
        paint.tick !== current.tick ||
        !Number.isSafeInteger(paint.tick) ||
        paint.tick < 0 ||
        (lastTick !== null && paint.tick < lastTick)
      ) {
        invalid = true;
        return;
      }
      if (run === null) run = current;
      else if (run !== current) {
        invalid = true;
        return;
      }
      const tier =
        paint.quality === 'full'
          ? 0
          : paint.quality === 'reduced'
            ? 1
            : paint.quality === 'minimal'
              ? 2
              : -1;
      if (tier < 0) {
        invalid = true;
        return;
      }
      firstTick ??= paint.tick;
      lastTick = paint.tick;
      counts[tier]++;
      if (tier !== previousTier) {
        if (changed < 32) {
          const offset = changed * 3;
          transitions[offset] = nowMs;
          transitions[offset + 1] = samples;
          transitions[offset + 2] = tier;
        } else overflow = true;
        changed++;
        previousTier = tier;
      }
    },
    export() {
      return {
        format: 'SoloSubmittedTierObservationV1',
        status: invalid || overflow || !samples ? 'incomplete' : 'complete',
        samples,
        counts: Array.from(counts),
        activeEntries,
        firstAtMs,
        lastAtMs,
        firstTick,
        lastTick,
        transitionCount: changed,
        transitions: Array.from(transitions.subarray(0, Math.min(changed, 32) * 3)),
        overflow,
        invalid,
        scope:
          'Existing active POST_RENDER callbacks; submitted record only, not physical display completion.',
      };
    },
  };
}

/** Paused public snapshot gate, called before public Start and after Pause only. */
export function qualificationQualityAudioBoundary(snapshot, index) {
  const require = (condition, label) => {
    if (!condition) throw new Error(`Public Effects muted case: ${label}`);
  };
  require(index === 0 || index === 1, 'unexpected snapshot');
  const group = ['original-art-ready', 'first30-border-paused'][index];
  require(snapshot?.group === group, 'snapshot group');
  require(snapshot.phase === (index ? 'paused' : 'briefing'), 'snapshot phase');
  const master = snapshot.application?.audio;
  require(master?.muted === true && master.volume === 0.8, 'master muted true / volume 0.8');
  require(snapshot.application?.interruptions?.count === 0, 'automatic interruption');
  const activation = snapshot.probe?.audio;
  require(activation, 'missing native operation counters');
  const counts = [
    'oscillatorStarts',
    'sourceStarts',
    'sourceStartFailures',
    'mediaPlayRequests',
    'mediaPlayResolved',
    'mediaPlayRejected',
  ].map((name) => {
    require(activation[name] === 0, `nonzero or missing ${name}`);
    return activation[name];
  });
  return {
    group,
    master: { muted: master.muted, volume: master.volume },
    observedNativeOperations: counts,
  };
}
