// Prospective opt-in protocol. Historical fixed-30 observations stay unchanged.
export function qualificationCadenceOption(flags) {
  if (flags.includes('--cadence')) throw new Error('Cadence protocol value required');
  const values = flags.filter((value) => value.startsWith('--cadence='));
  if (values.length > 1) throw new Error('Declare one cadence protocol');
  const value = values[0]?.slice('--cadence='.length) ?? 'blank30';
  if (!['blank30', 'settled120'].includes(value)) throw new Error('Unknown cadence protocol');
  return value;
}

/** This fixture exists only on about:blank, before any game request. */
export function prepareCadenceViewport(expected, environment = globalThis) {
  if (environment.location.href !== 'about:blank')
    throw new Error('Cadence viewport fixture must precede game navigation');
  const documentRef = environment.document;
  const before = {
    width: environment.innerWidth,
    height: environment.innerHeight,
    dpr: environment.devicePixelRatio,
  };
  let meta = documentRef.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = documentRef.createElement('meta');
    meta.name = 'viewport';
    documentRef.head.append(meta);
  }
  meta.content = 'width=device-width, initial-scale=1';
  return { before, expected, metaContent: meta.content, url: environment.location.href };
}

/** One fixed 2 s settle followed by 120 consecutive intervals, total deadline10 s.
 * Every settle interval is retained. No quality-based selection or retry. */
export function observeSettledCadence({ expected } = {}, environment = globalThis) {
  const settleMs = 2000,
    timeoutMs = 10000,
    targetIntervals = 120;
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
  let foregroundThroughout = initialState.visible && initialState.focused,
    environmentStableThroughout = true,
    previous = null,
    firstRafCallback = null,
    measurementAnchor = null,
    frameId,
    timerId,
    finished = false,
    overflow = false;
  const settleSamples = [],
    samples = [];
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
        protocol: 'foreground-about-blank-settled-120-v1',
        registeredAtMs,
        expected,
        settleMs,
        timeoutMs,
        targetIntervals,
        settleSamples,
        samples,
        firstRafCallback,
        measurementAnchor,
        initialState,
        finalState: observeState(),
        foregroundThroughout,
        environmentStableThroughout,
        elapsedMs: environment.performance.now() - registeredAtMs,
        deadlineReached,
        overflow,
      });
    };
    const frame = (timestampMs) => {
      if (finished) return;
      observeState();
      const callbackAtMs = environment.performance.now();
      if (previous === null) {
        firstRafCallback = {
          registeredAtMs,
          timestampMs,
          callbackAtMs,
          registrationToFirstCallbackMs: callbackAtMs - registeredAtMs,
          timestampMinusRegistrationMs: timestampMs - registeredAtMs,
        };
      } else if (measurementAnchor) samples.push(timestampMs - previous);
      else if (settleSamples.length < 4096) settleSamples.push(timestampMs - previous);
      else overflow = true;
      previous = timestampMs;
      // The boundary callback anchors measurement; its preceding interval stays
      // in settleSamples, including a long interval crossing the fixed boundary.
      if (!measurementAnchor && callbackAtMs - registeredAtMs >= settleMs)
        measurementAnchor = { timestampMs, callbackAtMs };
      if (callbackAtMs - registeredAtMs >= timeoutMs) finish(true);
      else if (samples.length === targetIntervals || overflow) finish(false);
      else frameId = environment.requestAnimationFrame(frame);
    };
    environment.addEventListener('blur', loseFocus);
    environment.addEventListener('resize', observeState);
    documentRef.addEventListener('visibilitychange', observeState);
    timerId = environment.setTimeout(() => finish(true), timeoutMs);
    frameId = environment.requestAnimationFrame(frame);
  });
}

export function calibrateSettledCadence(observation) {
  const samples = observation.samples ?? [],
    expected = observation.expected;
  const ready =
    observation.protocol === 'foreground-about-blank-settled-120-v1' &&
    observation.settleMs === 2000 &&
    observation.timeoutMs === 10000 &&
    observation.targetIntervals === 120 &&
    observation.foregroundThroughout === true &&
    observation.environmentStableThroughout === true &&
    observation.deadlineReached === false &&
    observation.overflow === false &&
    observation.measurementAnchor?.callbackAtMs - observation.registeredAtMs >= 2000 &&
    [observation.initialState, observation.finalState].every(
      (state) =>
        state?.url === 'about:blank' &&
        state.visible &&
        state.focused &&
        state.viewport.width === expected?.width &&
        state.viewport.height === expected?.height &&
        state.devicePixelRatio === expected?.dpr,
    );
  const result = {
    protocol: 'foreground-about-blank-settled-120-v1',
    state: { ...observation, ready, phase: 'before-game-navigation' },
    samples: samples.slice(),
    status: 'provisional-incomplete',
    baselineMs: null,
    limits: { coefficientOfVariation: 0.1, relativeP05P95Spread: 0.2 },
    scope:
      'One fixed 2-second foreground blank settle then 120 consecutive intervals, all retained, with one 10-second total deadline and matching CSS viewport/DPR. No retry, trimming, sliding selection or loaded-gameplay recalibration. Browser scheduling cadence is not physical refresh, asset readiness or application quiescence. Historical fixed30 reports are a separate protocol.',
  };
  if (samples.length !== 120 || !samples.every((value) => Number.isFinite(value) && value > 0))
    return result;
  const sorted = samples.slice().sort((a, b) => a - b);
  const baselineMs = (sorted[59] + sorted[60]) / 2;
  const meanMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const standardDeviationMs = Math.sqrt(
    samples.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / samples.length,
  );
  const coefficientOfVariation = standardDeviationMs / meanMs;
  const p05Ms = sorted[5],
    p95Ms = sorted[113],
    relativeP05P95Spread = (p95Ms - p05Ms) / baselineMs;
  return {
    ...result,
    status:
      ready && coefficientOfVariation <= 0.1 && relativeP05P95Spread <= 0.2
        ? 'measured-before-play'
        : 'provisional-unstable',
    baselineMs,
    meanMs,
    standardDeviationMs,
    coefficientOfVariation,
    p05Ms,
    p95Ms,
    relativeP05P95Spread,
    minimumMs: sorted[0],
    maximumMs: sorted[119],
  };
}
