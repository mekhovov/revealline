export const CONTINUOUS_PLAY_KEY = 'revealline.continuous-play.v1';
export const CONTINUOUS_PLAY_DEFAULTS = Object.freeze({
  autoNext: true,
  autoRetry: true,
  autoReplay: true,
});
export const VICTORY_CELEBRATION_MS = 3800;
export const AUTO_NEXT_MS = 5000;

let sharedPreferences;
function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
export function continuousPlayPreferences({
  storage = defaultStorage(),
  window: target = globalThis.window,
} = {}) {
  const shared = storage === defaultStorage();
  if (sharedPreferences && shared) return sharedPreferences;
  let value = { ...CONTINUOUS_PLAY_DEFAULTS };
  const listeners = new Set();
  const read = () => {
    try {
      const saved = JSON.parse(storage?.getItem(CONTINUOUS_PLAY_KEY) ?? '{}');
      for (const key of Object.keys(value))
        if (typeof saved?.[key] === 'boolean') value[key] = saved[key];
    } catch {
      /* In-memory preferences remain usable when storage is unavailable. */
    }
  };
  read();
  const notify = () => {
    for (const listener of listeners) listener({ ...value });
  };
  const changed = (event) => {
    if (event.key === CONTINUOUS_PLAY_KEY) {
      read();
      notify();
    }
  };
  target?.addEventListener?.('storage', changed);
  const preferences = {
    snapshot: () => ({ ...value }),
    set(key, enabled) {
      if (!(key in CONTINUOUS_PLAY_DEFAULTS))
        throw new TypeError('Unknown continuous-play preference.');
      value[key] = !!enabled;
      try {
        storage?.setItem(CONTINUOUS_PLAY_KEY, JSON.stringify(value));
      } catch {
        /* Session choice remains active. */
      }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      target?.removeEventListener?.('storage', changed);
      listeners.clear();
    },
  };
  if (shared) sharedPreferences = preferences;
  return preferences;
}

/** Presentation clock only. Hosts retain simulation, persistence and loading ownership.
 * Identity is checked again immediately before dispatch, and inactive owners cancel
 * instead of silently restarting a countdown when focus returns. */
export function createContinuousPlayController({
  onNext = () => {},
  onRetry = () => {},
  onChange = () => {},
  isCurrent = () => true,
  isActive = () => true,
  preferences = continuousPlayPreferences(),
} = {}) {
  let state = { phase: 'idle', identity: null, remainingMs: 0 },
    alive = true,
    epoch = 0;
  const listeners = new Set();
  const snapshot = () => ({ ...state });
  const publish = () => {
    onChange(snapshot());
    for (const fn of listeners) fn(snapshot());
  };
  const current = () => alive && isCurrent(state.identity);
  function cancel(reason = 'interaction') {
    epoch++;
    if (state.phase === 'idle' || state.phase === 'cancelled') return;
    state = { ...state, phase: 'cancelled', remainingMs: 0, reason };
    publish();
  }
  function dispatch(action) {
    if (!current()) return cancel('superseded');
    const identity = state.identity;
    const dispatchEpoch = ++epoch;
    state = { ...state, phase: 'idle', remainingMs: 0 };
    publish();
    if (dispatchEpoch !== epoch || !current()) return;
    (action === 'next' ? onNext : onRetry)(identity);
  }
  function phase(name, duration) {
    state = { ...state, phase: name, remainingMs: duration };
    publish();
  }
  function afterLoss() {
    if (state.canRetry && preferences.snapshot().autoRetry) phase('ready', state.readyMs);
    else phase('cancelled', 0);
  }
  function proceed() {
    if (state.phase === 'celebration') {
      if (state.canAdvance && preferences.snapshot().autoNext) phase('countdown', AUTO_NEXT_MS);
      else phase('cancelled', 0);
    } else if (state.phase === 'countdown') dispatch('next');
    else if (state.phase === 'loss-effect') {
      if (preferences.snapshot().autoReplay && state.replayMs > 0) phase('replay', state.replayMs);
      else afterLoss();
    } else if (state.phase === 'replay') afterLoss();
    else if (state.phase === 'ready') dispatch('retry');
  }
  const stopPreferences = preferences.subscribe?.(() => {
    const selected = preferences.snapshot();
    if (
      (state.phase === 'countdown' && !selected.autoNext) ||
      (state.phase === 'ready' && !selected.autoRetry)
    )
      cancel('preference');
  });
  return {
    begin({
      identity,
      outcome,
      canAdvance = false,
      canRetry = true,
      lossEffectMs = 650,
      replayMs = 1920,
      readyMs = 600,
    }) {
      if (!alive) return;
      epoch++;
      state = {
        identity,
        outcome,
        canAdvance,
        canRetry,
        replayMs,
        readyMs,
        phase: outcome === 'won' ? 'celebration' : 'loss-effect',
        remainingMs: outcome === 'won' ? VICTORY_CELEBRATION_MS : lossEffectMs,
      };
      publish();
    },
    advance(deltaMs) {
      if (!alive || ['idle', 'cancelled'].includes(state.phase)) return;
      if (!current()) return cancel('superseded');
      if (!isActive()) return cancel('inactive');
      if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
      const ticket = epoch;
      let available = Math.min(deltaMs, 250);
      while (available >= 0 && ticket === epoch && !['idle', 'cancelled'].includes(state.phase)) {
        const spent = Math.min(available, state.remainingMs);
        state = { ...state, remainingMs: state.remainingMs - spent };
        available -= spent;
        if (state.remainingMs > 0) {
          publish();
          break;
        }
        proceed();
        if (available === 0) break;
      }
    },
    cancel,
    activate(action) {
      if (!['next', 'retry'].includes(action)) throw new TypeError('Unknown continuation action.');
      dispatch(action);
    },
    snapshot,
    subscribe(fn) {
      listeners.add(fn);
      fn(snapshot());
      return () => listeners.delete(fn);
    },
    dispose() {
      cancel('disposed');
      alive = false;
      stopPreferences?.();
      listeners.clear();
    },
  };
}

const FLOW_COPY = {
  en: {
    countdown: 'Next level in {seconds}s',
    celebrating: 'Mission complete!',
    replay: 'Final 8 moves',
    ready: 'Ready…',
    cancel: 'Stay here',
    autoNext: 'Play next level automatically',
    autoRetry: 'Retry automatically after defeat',
    autoReplay: 'Show failure replay automatically',
  },
  uk: {
    countdown: 'Наступний рівень за {seconds} с',
    celebrating: 'Місію завершено!',
    replay: 'Останні 8 ходів',
    ready: 'Приготуйтесь…',
    cancel: 'Залишитися тут',
    autoNext: 'Починати наступний рівень автоматично',
    autoRetry: 'Автоматично повторювати після поразки',
    autoReplay: 'Автоматично показувати повтор поразки',
  },
};
export function continuousPlayBindings(preferences = continuousPlayPreferences()) {
  return Object.fromEntries(
    Object.keys(CONTINUOUS_PLAY_DEFAULTS).map((key) => [
      key,
      {
        get: () => preferences.snapshot()[key],
        set: (value) => preferences.set(key, value),
        subscribe: (fn) => preferences.subscribe(fn),
      },
    ]),
  );
}
export function mountContinuousPlayControls({
  document: doc = globalThis.document,
  parent,
  controller,
  locale = 'en',
  preferences = continuousPlayPreferences(),
} = {}) {
  const root = doc.createElement('div'),
    status = doc.createElement('p'),
    cancel = doc.createElement('button');
  root.className = 'continuous-play-controls';
  root.dataset.continuousPlay = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  cancel.type = 'button';
  cancel.className = 'button secondary';
  cancel.addEventListener('click', () => controller.cancel('player'));
  root.append(status, cancel);
  parent.append(root);
  let language = locale;
  const render = (state) => {
    const copy =
      FLOW_COPY[(typeof language === 'function' ? language() : language) === 'uk' ? 'uk' : 'en'];
    const value =
      state.phase === 'countdown'
        ? copy.countdown.replace('{seconds}', Math.ceil(state.remainingMs / 1000))
        : state.phase === 'celebration'
          ? copy.celebrating
          : state.phase === 'replay'
            ? copy.replay
            : state.phase === 'ready'
              ? copy.ready
              : '';
    if (status.textContent !== value) status.textContent = value;
    cancel.textContent = copy.cancel;
    root.hidden = !value;
    cancel.hidden = state.phase !== 'countdown' && state.phase !== 'celebration';
  };
  const stop = controller.subscribe(render);
  const interaction = (event) => {
    if (event.target === cancel || root.contains(event.target)) return;
    if (
      event.type === 'keydown' &&
      !['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)
    )
      return;
    controller.cancel('interaction');
  };
  parent.addEventListener('keydown', interaction);
  parent.addEventListener('pointerdown', interaction);
  return {
    root,
    status,
    cancel,
    preferences,
    setLocale(value) {
      language = value;
      render(controller.snapshot());
    },
    dispose() {
      stop();
      parent.removeEventListener('keydown', interaction);
      parent.removeEventListener('pointerdown', interaction);
      root.remove();
    },
  };
}
