import { withDemoLoadingDeadline } from './demo-loading.mjs';
import { createDemoRotation } from './demo-rotation.mjs';
import { createDemoPrefetch } from './demo-prefetch.mjs';
import { identifyDemoSource } from './demo-source-metadata.mjs';
import { createDemoPreparation } from './demo-preparation.mjs';

export const DEMO_RECOVERY_TIMEOUT_MS = 30000;
const unavailableMode = (error) =>
  [
    'demo-mode-unavailable',
    'demo-renderer-unavailable',
    'renderer-unavailable',
    'package-unavailable',
  ].includes(error?.code);
const timedOut = (error) => ['demo-load-timeout', 'demo-recovery-timeout'].includes(error?.code);

/** Presentation-only rotation. Each prepared player owns an isolated run; this
 * controller never reads input, advances a hidden clock, or writes a profile. */
export function createDemoDirector({
  sources = [],
  prepare = (source, options) => source.create(options),
  random = Math.random,
  onChange = () => {},
  loading = {},
  modeId = 'solo',
  scope = 'all',
} = {}) {
  if (!Array.isArray(sources) || typeof prepare !== 'function' || typeof random !== 'function')
    throw new TypeError('Demo rotation needs sources, a preparation adapter and a random source.');
  const ids = new Set();
  const candidates = sources
    .map((source) => {
      if (!source || typeof source.id !== 'string' || !source.id || ids.has(source.id))
        throw new TypeError('Demo sources need unique nonempty IDs.');
      if (typeof source.levelId !== 'string' || !source.levelId)
        throw new TypeError('Demo sources need a level identity.');
      ids.add(source.id);
      return Object.freeze(identifyDemoSource(source, source.modeId ?? 'solo'));
    })
    .filter((source) => scope === 'all' || source.modeId === modeId);
  const failed = new Set();
  const diagnostics = [];
  const record = (event, item, failure = null, loadingMs = null, preparation = null) => {
    diagnostics.push({
      event,
      sourceId: item?.id ?? null,
      modeId: item?.modeId ?? null,
      at: Date.now(),
      loadingMs,
      preparation,
      code: failure?.code ?? null,
      message: failure ? String(failure.message ?? failure).slice(0, 240) : null,
      stack:
        typeof failure?.stack === 'string'
          ? failure.stack.split('\n').slice(0, 6).join('\n').slice(0, 1600)
          : null,
    });
    if (diagnostics.length > 128) diagnostics.shift();
  };
  const suspendedModes = new Set();
  const rotation = createDemoRotation({ random });
  const prefetch = createDemoPrefetch();
  const setTimer = loading.setTimer ?? globalThis.setTimeout;
  const clearTimer = loading.clearTimer ?? globalThis.clearTimeout;
  const now = loading.now ?? (() => performance.now());
  let retirement = null;
  let recoveryTimer = null;
  let lastVerified = null;
  let preparingCandidate = null;
  let source = null,
    player = null,
    phase = 'idle',
    error = '',
    pending = null,
    generation = 0,
    desired = false,
    disposed = false,
    requiredNextKind = null;
  const emit = () => onChange({ source, player, phase, error });
  const release = (item) => {
    const result = item?.dispose?.();
    if (!result?.then) return retirement;
    // A replacement may not mount while the previous graphics engine retires.
    const previous = retirement;
    const joined = Promise.all([previous, result]);
    retirement = joined;
    joined
      .finally(() => {
        if (retirement === joined) retirement = null;
      })
      .catch(() => {});
    return joined;
  };
  function cancel() {
    generation++;
    pending?.abort();
    pending = null;
    if (recoveryTimer !== null) clearTimer(recoveryTimer);
    recoveryTimer = null;
  }
  function choose() {
    const available = candidates.filter(
      (item) =>
        !failed.has(item.id) &&
        !suspendedModes.has(item.modeId) &&
        (!requiredNextKind || item.kind === requiredNextKind),
    );
    if (
      error &&
      lastVerified &&
      available.includes(lastVerified) &&
      !rotation.hasPendingModes(available)
    )
      return lastVerified;
    if (prefetch.source && available.includes(prefetch.source)) return prefetch.source;
    return rotation.choose(available);
  }
  async function next({ play: resume = false } = {}) {
    if (disposed) return false;
    // Synchronous retirement belongs to the same recovery budget as loading.
    const recoveryDeadline =
      now() +
      Math.min(DEMO_RECOVERY_TIMEOUT_MS, loading.recoveryTimeoutMs ?? DEMO_RECOVERY_TIMEOUT_MS);
    if (resume) desired = true;
    cancel();
    const ticket = generation;
    preparingCandidate = null;
    release(player);
    player = null;
    source = null;
    error = '';
    const controller = new AbortController();
    pending = controller;
    const current = () => !disposed && generation === ticket && !controller.signal.aborted;
    const finishLoading = () => {
      if (generation !== ticket) return;
      if (recoveryTimer !== null) clearTimer(recoveryTimer);
      recoveryTimer = null;
      pending = null;
    };
    const stopRecovery = () => {
      if (!current()) return;
      if (preparingCandidate) failed.add(preparingCandidate.id);
      error = 'Demo recovery exceeded its 30-second budget.';
      controller.abort(Object.assign(new Error(error), { code: 'demo-recovery-timeout' }));
      finishLoading();
      phase = 'unavailable';
      emit();
    };
    const expired = () => {
      if (now() < recoveryDeadline) return false;
      stopRecovery();
      return true;
    };
    recoveryTimer = setTimer(stopRecovery, Math.max(0, recoveryDeadline - now()));
    phase = 'loading';
    emit();
    while (current()) {
      if (expired()) return false;
      // Failed preparation can also return an owned player. Retire it before
      // trying another source, just as for an ordinary Next transition.
      if (retirement) {
        try {
          await withDemoLoadingDeadline(() => retirement, {
            ...loading,
            timeoutMs: Math.min(5000, loading.timeoutMs ?? 5000),
            signal: controller.signal,
          });
        } catch (failure) {
          if (!current() || expired()) return false;
          if (current()) {
            error = String(failure?.message || failure);
            finishLoading();
            phase = 'unavailable';
            emit();
          }
          return false;
        }
      }
      if (!current() || expired()) return false;
      const candidate = choose();
      preparingCandidate = candidate;
      if (!candidate) {
        phase = 'unavailable';
        finishLoading();
        emit();
        return false;
      }
      phase = 'loading';
      emit();
      let prepared = null;
      const preparationStarted = now();
      const preparation = createDemoPreparation({ now });
      try {
        prepared = await withDemoLoadingDeadline(
          (signal) => {
            preparation.bind(signal);
            const reportPreparation = preparation.report;
            if (prefetch.source !== candidate)
              return prepare(candidate, { signal, reportPreparation });
            reportPreparation('prefetch');
            return prefetch.take(candidate, { signal }).then((payload) => {
              signal.throwIfAborted();
              return prepare(candidate, { signal, payload, reportPreparation });
            });
          },
          {
            ...loading,
            signal: controller.signal,
            onLateResult: release,
          },
        );
        if (!current() || expired()) {
          const event = timedOut(controller.signal.reason) ? 'failed' : 'cancelled';
          record(
            event,
            candidate,
            controller.signal.reason,
            now() - preparationStarted,
            preparation.finish(event),
          );
          release(prepared);
          return false;
        }
        if (
          !prepared ||
          !['play', 'pause', 'advance'].every((key) => typeof prepared[key] === 'function')
        )
          throw new TypeError('A demo source did not return a playback adapter.');
        player = prepared;
        source = candidate;
        rotation.accept(candidate);
        lastVerified = candidate;
        record('ready', candidate, null, now() - preparationStarted, preparation.finish('ready'));
        requiredNextKind = null;
        finishLoading();
        error = '';
        if (desired) player.play();
        else player.pause();
        phase = desired ? 'playing' : 'paused';
        emit();
        prefetch.start(choose());
        return true;
      } catch (failure) {
        const event = current() || timedOut(failure) ? 'failed' : 'cancelled';
        record(event, candidate, failure, now() - preparationStarted, preparation.finish(event));
        release(prepared);
        if (player === prepared) {
          player = null;
          source = null;
        }
        if (!current() || expired()) return false;
        if (unavailableMode(failure)) suspendedModes.add(candidate.modeId);
        if (candidate.kind === 'bot') requiredNextKind = 'replay';
        if (candidate.kind !== 'bot' || failure?.code !== 'no-safe-macro') failed.add(candidate.id);
        rotation.defer(candidate);
        error = String(failure?.message || failure).slice(0, 240);
      }
    }
    return false;
  }
  function pause() {
    if (disposed) return;
    desired = false;
    player?.pause();
    if (player && phase !== 'complete') phase = 'paused';
    emit();
  }
  function suspend() {
    if (disposed) return;
    pause();
    if (pending) {
      cancel();
      phase = 'paused';
      emit();
    }
  }
  function play() {
    if (disposed) return Promise.resolve(false);
    desired = true;
    if (pending) return Promise.resolve(false);
    if (!player || phase === 'complete') return next();
    player.play();
    phase = 'playing';
    emit();
    return Promise.resolve(true);
  }
  function advance(seconds) {
    if (disposed || phase !== 'playing' || !player)
      return { phase, events: [], reason: 'inactive' };
    // Spectator time is disposable. A slow visible render or asset decode must
    // not leave an unattended demo at a permanent pause or fast-forward it.
    // The host clock owns bounded slices in both visible and hidden playback.
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.25)
      return { phase, events: [], reason: 'spectator-frame-skipped' };
    try {
      const result = player.advance(seconds);
      if (source.kind === 'bot' && result?.reason === 'no-safe-macro') {
        // Expected safe-boundary exhaustion keeps its board for the recap; it
        // must then hand off to a reviewed recording, not another live planner.
        requiredNextKind = 'replay';
        phase = 'complete';
        emit();
        return { ...result, phase };
      }
      if (player.phase === 'error' || result?.phase === 'error')
        throw new Error(player.error || result?.reason || 'Demo playback failed.');
      if (player.phase === 'complete' || result?.phase === 'complete') phase = 'complete';
      else if (player.phase === 'paused' || result?.reason === 'frame-gap') {
        desired = false;
        phase = 'paused';
      }
      if (phase !== 'playing') emit();
      return { ...result, phase };
    } catch (failure) {
      return fail(failure);
    }
  }
  function fail(failure) {
    if (disposed || !source) return { phase, events: [], reason: 'inactive' };
    if (source.kind === 'bot') requiredNextKind = 'replay';
    failed.add(source.id);
    record('playback-failed', source, failure);
    if (unavailableMode(failure)) suspendedModes.add(source.modeId);
    error = String(failure?.message || failure).slice(0, 240);
    void next();
    return { phase, events: [], reason: 'source-error' };
  }
  return Object.freeze({
    get source() {
      return source;
    },
    get player() {
      return player;
    },
    get phase() {
      return phase;
    },
    get error() {
      return error;
    },
    get failedSourceIds() {
      return Object.freeze([...failed]);
    },
    get diagnostics() {
      return diagnostics.map((item) => Object.freeze({ ...item }));
    },
    get suspendedModeIds() {
      return Object.freeze([...suspendedModes]);
    },
    retry() {
      failed.clear();
      suspendedModes.clear();
      return next({ play: true });
    },
    start: play,
    next,
    play,
    pause,
    suspend,
    advance,
    fail,
    dispose() {
      if (disposed) return;
      disposed = true;
      prefetch.clear();
      desired = false;
      cancel();
      release(player);
      player = null;
      source = null;
      phase = 'disposed';
      emit();
      return retirement;
    },
  });
}
