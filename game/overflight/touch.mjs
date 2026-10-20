import { createTouchPreferences } from '../touch-preferences.mjs';
import {
  nextInputModality,
  showScreenControls,
  resolveScreenControls,
} from '../input-presentation.mjs';
import { attachTouchSteering } from '../ui/touch-steering.mjs';
import {
  mountTouchControlsView,
  mountTouchPresentationSettings,
} from '../ui/touch-controls-view.mjs';

/** Shared thumb presentation and gestures, adapted to continuous flight + Boost.
 * Physical ownership outlives logical clearing so menus cannot rearm a held finger. */
export function createOverflightTouch({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  arena,
  mount,
  settingsMount,
  active,
  actionLabel,
  actionName = null,
  onInterrupt = () => {},
  onLayoutChange = () => {},
  visibilitySettings = null,
}) {
  const listeners = [];
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    storage = null;
  }
  let disposed = false,
    vector = { x: 0, y: 0 },
    boostPointer = null,
    controlKey = null,
    suppressAssistiveClick = false,
    assistiveClickTimer = null,
    modality = win.matchMedia?.('(any-pointer: coarse)').matches ? 'touch' : 'keyboard',
    screenControls = 'auto';
  const pointers = new Set();
  const actionPointers = new Set();
  const keys = new Set();
  const view = mountTouchControlsView({
    document: doc,
    mount,
    idPrefix: 'overflight-touch',
    actionLabel: actionLabel(),
  });
  view.root.classList.add('overflight-touch');
  view.setVisible(false);
  const enabled = () => !disposed && active() && screenControls !== 'off';
  const preferences = createTouchPreferences({
    storage,
    eventTarget: win,
    onChange: (settings) => {
      clear();
      view.apply(settings);
      settingsView.refresh();
      onLayoutChange();
    },
  });
  const settingsView = mountTouchPresentationSettings({
    document: doc,
    mount: settingsMount,
    preferences,
    idPrefix: 'overflight',
    visibility: visibilitySettings
      ? {
          get: () => screenControls,
          set: (value) => {
            const next = resolveScreenControls(value);
            if (next === screenControls) return;
            screenControls = next;
            clear();
            refresh();
          },
          help: visibilitySettings.help,
          mount: visibilitySettings.mount,
          title: visibilitySettings.title,
        }
      : null,
  });
  view.apply(preferences.snapshot());

  function refreshAction(readiness = '') {
    const visible = actionLabel();
    const full = actionName?.() ?? visible;
    const suffix = readiness ? ` · ${readiness}` : '';
    view.actionButton.textContent = `${visible}${readiness ? `\n${readiness}` : ''}`;
    if (full !== visible)
      view.actionButton.setAttribute('aria-label', `${visible} · ${full}${suffix}`);
    else view.actionButton.removeAttribute('aria-label');
  }
  function releaseBoost() {
    const id = boostPointer;
    boostPointer = null;
    view.actionButton.removeAttribute('data-pressed');
    try {
      if (id !== null && view.actionButton.hasPointerCapture(id))
        view.actionButton.releasePointerCapture(id);
    } catch {
      // Window release listeners also work without pointer capture.
    }
  }
  function clear({ forgetPointers = false } = {}) {
    steering.clear();
    vector = { x: 0, y: 0 };
    controlKey = null;
    if (assistiveClickTimer !== null)
      (win.clearTimeout ?? globalThis.clearTimeout)(assistiveClickTimer);
    assistiveClickTimer = null;
    suppressAssistiveClick = false;
    releaseBoost();
    if (forgetPointers) {
      pointers.clear();
      actionPointers.clear();
      keys.clear();
    }
  }
  function refresh() {
    if (disposed) return;
    if (!enabled()) clear();
    const visible = showScreenControls({
      preference: screenControls,
      modality,
      scope: 'flight',
      running: enabled(),
    });
    const layout =
      !!visibilitySettings &&
      showScreenControls({
        preference: screenControls,
        modality,
        scope: 'flight',
        running: true,
      });
    const changed =
      view.root.hidden === visible || mount.classList.contains('has-touch-layout') !== layout;
    view.setVisible(visible);
    mount.classList.toggle('has-touch-controls', visible);
    mount.classList.toggle('has-touch-layout', layout);
    if (changed) onLayoutChange();
  }

  const steering = attachTouchSteering({
    arena,
    pad: view.pad,
    surface: view.surface,
    indicator: view.indicator,
    window: win,
    getSettings: () => preferences.snapshot(),
    active: enabled,
    onVector: (next) => {
      vector = next;
    },
    onCancel: onInterrupt,
  });
  // Observe the original press, even when a modal clears logical input before
  // pointerup. Merely closing that modal must not count as releasing a finger.
  listen(
    doc,
    'pointerdown',
    (event) => {
      const onControl = view.root.contains(event.target);
      if (!onControl) modality = nextInputModality(modality, event);
      refresh();
      if (!enabled() || (event.button !== undefined && event.button !== 0)) return;
      const onArena =
        arena.contains(event.target) &&
        preferences.snapshot().mode !== 'dpad' &&
        ['touch', 'pen'].includes(event.pointerType);
      if (onControl || onArena) pointers.add(event.pointerId);
      if (view.actionButton.contains(event.target)) actionPointers.add(event.pointerId);
    },
    true,
  );
  listen(
    doc,
    'keydown',
    (event) => {
      if (!view.root.contains(event.target)) {
        modality = nextInputModality(modality, event);
        refresh();
      }
    },
    true,
  );
  listen(view.actionButton, 'pointerdown', (event) => {
    if (!enabled() || boostPointer !== null || (event.button !== undefined && event.button !== 0))
      return;
    event.preventDefault();
    boostPointer = event.pointerId;
    view.actionButton.dataset.pressed = 'true';
    try {
      view.actionButton.setPointerCapture(boostPointer);
    } catch {}
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    actionPointers.delete(event.pointerId);
    if (boostPointer !== event.pointerId) return;
    releaseBoost();
    if (event.type === 'pointercancel') onInterrupt();
  };
  for (const type of ['pointerup', 'pointercancel']) listen(win, type, release, true);
  listen(view.actionButton, 'lostpointercapture', (event) => {
    if (event.pointerId !== boostPointer) return;
    releaseBoost();
    onInterrupt();
  });
  const activation = (event) => event.key === ' ' || event.key === 'Enter';
  const shortcut = (event) => event.ctrlKey || event.altKey || event.metaKey || event.isComposing;
  const finishKeyActivation = () => {
    if (!suppressAssistiveClick) return;
    if (assistiveClickTimer !== null)
      (win.clearTimeout ?? globalThis.clearTimeout)(assistiveClickTimer);
    assistiveClickTimer = (win.setTimeout ?? globalThis.setTimeout)(() => {
      suppressAssistiveClick = false;
      assistiveClickTimer = null;
    }, 0);
  };
  // Click-only assistive activation mirrors the main game: it toggles a
  // persistent intent, while a physical key remains active only until keyup.
  for (const [direction, button] of [
    ...Object.entries(view.directionButtons),
    ['boost', view.actionButton],
  ]) {
    listen(button, 'keydown', (event) => {
      if (!enabled() || !activation(event) || shortcut(event) || event.repeat) return;
      event.preventDefault();
      if (!keys.has(event.code)) {
        keys.add(event.code);
        controlKey = { code: event.code, direction };
      }
      suppressAssistiveClick = true;
    });
    listen(button, 'keyup', (event) => {
      if (!activation(event) || shortcut(event)) return;
      event.preventDefault();
      keys.delete(event.code);
      if (controlKey?.code === event.code) controlKey = null;
      finishKeyActivation();
    });
    listen(button, 'click', (event) => {
      event.preventDefault();
      if (event.detail !== 0 || suppressAssistiveClick || shortcut(event) || !enabled()) return;
      controlKey =
        controlKey?.code === 'assistive' && controlKey.direction === direction
          ? null
          : { code: 'assistive', direction };
    });
  }
  listen(
    win,
    'keyup',
    (event) => {
      if (!activation(event) || shortcut(event)) return;
      keys.delete(event.code);
      if (controlKey?.code === event.code) controlKey = null;
    },
    true,
  );
  listen(win, 'blur', () => clear({ forgetPointers: true }));
  listen(win, 'pagehide', () => clear({ forgetPointers: true }));
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) clear({ forgetPointers: true });
  });
  listen(win, 'resize', () => {
    const interrupted = pointers.size > 0 || keys.size > 0;
    clear({ forgetPointers: true });
    if (interrupted) onInterrupt();
    refresh();
  });
  refresh();
  return {
    sample() {
      refresh();
      const direction = controlKey?.direction;
      return {
        x: direction === 'left' ? -1 : direction === 'right' ? 1 : vector.x,
        y: direction === 'up' ? -1 : direction === 'down' ? 1 : vector.y,
        boost: boostPointer !== null || direction === 'boost',
        neutral: pointers.size === 0 && keys.size === 0 && controlKey === null,
      };
    },
    // Steering ownership never blocks a fresh Boost. A held action still must
    // physically release even if a modal cleared its logical state.
    actionsNeutral: () =>
      actionPointers.size === 0 && keys.size === 0 && controlKey?.direction !== 'boost',
    clear,
    refresh,
    refreshCopy() {
      clear();
      view.apply(preferences.snapshot());
      settingsView.refresh();
      refreshAction();
      onLayoutChange();
    },
    updateBoost({ cooldown = 0, readyLabel }) {
      const value = Math.ceil(Math.max(0, cooldown) * 10) / 10;
      refreshAction(value > 0 ? `${value.toFixed(1)}s` : readyLabel);
      view.actionButton.dataset.ready = String(value === 0);
    },
    dispose() {
      if (disposed) return;
      clear({ forgetPointers: true });
      disposed = true;
      steering.destroy();
      preferences.destroy();
      settingsView.dispose();
      listeners.forEach((remove) => remove());
      view.dispose();
      mount.classList.remove('has-touch-controls', 'has-touch-layout');
    },
  };
}
