/** Presentation-only rotation. Each prepared player owns an isolated run; this
 * controller never reads input, advances a hidden clock, or writes a profile. */
export function createDemoDirector({
  sources = [],
  prepare = (source, options) => source.create(options),
  random = Math.random,
  onChange = () => {},
} = {}) {
  if (!Array.isArray(sources) || typeof prepare !== 'function' || typeof random !== 'function')
    throw new TypeError('Demo rotation needs sources, a preparation adapter and a random source.');
  const ids = new Set();
  const candidates = sources.map((source) => {
    if (!source || typeof source.id !== 'string' || !source.id || ids.has(source.id))
      throw new TypeError('Demo sources need unique nonempty IDs.');
    if (typeof source.levelId !== 'string' || !source.levelId)
      throw new TypeError('Demo sources need a level identity.');
    ids.add(source.id);
    return Object.freeze({ ...source });
  });
  const failed = new Set();
  let source = null,
    player = null,
    phase = 'idle',
    error = '',
    pending = null,
    generation = 0,
    desired = false,
    disposed = false,
    first = true,
    previous = null,
    visited = new Set();
  const levelKey = (item) => item.levelKey ?? item.levelId;
  const emit = () => onChange({ source, player, phase, error });
  const release = (item) => item?.dispose?.();
  function cancel() {
    generation++;
    pending?.abort();
    pending = null;
  }
  function choose() {
    const available = candidates.filter((item) => !failed.has(item.id));
    if (!available.length) return null;
    let pool = available.filter((item) => !visited.has(item.id));
    if (!pool.length) {
      visited = new Set();
      pool = available;
    }
    if (previous) {
      const different = pool.filter((item) => levelKey(item) !== levelKey(previous));
      const anyDifferent = available.filter((item) => levelKey(item) !== levelKey(previous));
      if (different.length) pool = different;
      else if (anyDifferent.length) pool = anyDifferent;
    }
    if (first) {
      const approachable = pool.filter((item) => item.approachable === true);
      if (approachable.length) pool = approachable;
      first = false;
    }
    const sample = random();
    const index = Math.min(
      pool.length - 1,
      Math.floor(Math.max(0, Number.isFinite(sample) ? sample : 0) * pool.length),
    );
    return pool[index];
  }
  async function next() {
    if (disposed) return false;
    cancel();
    const ticket = generation;
    release(player);
    player = null;
    source = null;
    error = '';
    const controller = new AbortController();
    pending = controller;
    const current = () => !disposed && generation === ticket && !controller.signal.aborted;
    while (current()) {
      const candidate = choose();
      if (!candidate) {
        phase = 'unavailable';
        pending = null;
        emit();
        return false;
      }
      phase = 'loading';
      emit();
      let prepared = null;
      try {
        prepared = await prepare(candidate, { signal: controller.signal });
        if (!current()) {
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
        previous = candidate;
        visited.add(candidate.id);
        pending = null;
        error = '';
        if (desired) player.play();
        else player.pause();
        phase = desired ? 'playing' : 'paused';
        emit();
        return true;
      } catch (failure) {
        release(prepared);
        if (player === prepared) {
          player = null;
          source = null;
        }
        if (!current()) return false;
        failed.add(candidate.id);
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
    try {
      const result = player.advance(seconds);
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
      failed.add(source.id);
      error = String(failure?.message || failure).slice(0, 240);
      void next();
      return { phase, events: [], reason: 'source-error' };
    }
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
    start: play,
    next,
    play,
    pause,
    suspend,
    advance,
    dispose() {
      if (disposed) return;
      disposed = true;
      desired = false;
      cancel();
      release(player);
      player = null;
      source = null;
      phase = 'disposed';
      emit();
    },
  });
}
