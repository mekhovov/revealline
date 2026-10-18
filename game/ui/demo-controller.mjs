import {
  createControllerRouter,
  neutralControllerFlight,
  neutralControllerUI,
} from './controller-router.mjs';

const completeFrame = (frame) =>
  frame?.confirmSnapshot &&
  Object.keys(neutralControllerFlight()).every((key) => Object.hasOwn(frame.flight ?? {}, key));

/** Normalize the originating page's one captured sample. This owner never reads
 * hardware, writes preferences, or installs a second disconnect listener. */
export function createDemoControllerFrame({ getPreferences = () => ({}) } = {}) {
  let pads = [],
    configuration = '',
    previousMode = null,
    needsNeutral = true,
    disposed = false;
  const router = createControllerRouter({
    readPads: () => pads,
    eventTarget: null,
    autoJoin: true,
  });
  const clear = () => {
    pads = [];
    needsNeutral = true;
    router.clear();
  };
  return {
    clear,
    sample(frame = {}, { modeId, scope, spectator, toggleBoostEligible } = {}) {
      if (previousMode !== modeId) {
        previousMode = modeId;
        clear();
      }
      // SIM owns its native radio, throttle pickup and controller release gates.
      // Legacy normalized callers without captured pads remain supported.
      if (modeId === 'sim' || !Object.hasOwn(frame, 'gamepads')) return frame;
      const authoritative = completeFrame(frame)
        ? frame
        : completeFrame(frame.sharedController)
          ? frame.sharedController
          : null;
      if (authoritative) {
        if (needsNeutral && authoritative.confirmSnapshot.neutral === true) needsNeutral = false;
        const result = {
          ...frame,
          ...authoritative,
          gamepads: frame.gamepads,
          now: frame.now,
          // The native host may own Confirm's release/echo suppression.
          ui: frame.sharedController
            ? { ...authoritative.ui, confirm: frame.ui?.confirm ?? authoritative.ui.confirm }
            : (frame.ui ?? authoritative.ui),
        };
        if (disposed || needsNeutral)
          return {
            ...result,
            flight: neutralControllerFlight(),
            ui: neutralControllerUI(),
            status: { ...result.status, code: disposed ? 'disposed' : 'waiting-neutral' },
          };
        // Survival's admitted vector retains diagonals and its native dash.
        // Other adapters consume the shared router's exact mapped direction.
        if (modeId === 'survival' && Number.isFinite(frame.flight?.x))
          result.flight = {
            ...result.flight,
            direction: null,
            x: frame.flight.x,
            y: frame.flight.y,
            boost: frame.flight.boost,
            pause: frame.flight.pause,
          };
        return result;
      }
      pads = frame.gamepads ?? [];
      const preferences = getPreferences(),
        bindings = preferences.controllerBindings ?? null,
        boostMode = preferences.controllerBoostMode ?? 'hold',
        next = JSON.stringify([bindings, boostMode]);
      if (configuration !== next) {
        router.setBindings(bindings);
        router.setBoostMode(boostMode);
        configuration = next;
      }
      const normalized = router.sample({
        scope,
        timeMs: frame.now,
        spectator,
        toggleBoostEligible,
      });
      return { ...frame, ...normalized, gamepads: frame.gamepads, now: frame.now };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      router.destroy();
    },
  };
}
