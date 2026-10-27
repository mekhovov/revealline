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
    rawProfile = null,
    configuration = '',
    previousMode = null,
    simMenuActive = false,
    needsNeutral = true,
    disposed = false;
  const router = createControllerRouter({
    readPads: () => pads,
    rawProfile: (index) => rawProfile?.(index) ?? null,
    eventTarget: null,
    autoJoin: true,
  });
  const clear = () => {
    pads = [];
    rawProfile = null;
    needsNeutral = true;
    simMenuActive = false;
    router.clear();
  };
  const normalize = (frame, options, assigned = undefined) => {
    pads = frame.gamepads ?? [];
    // A native owner has already admitted its device. Reusing its calibration
    // must not auto-join another captured device or perform another hardware read.
    if (assigned !== undefined)
      pads = Array.from(pads).filter((pad) => pad?.index === assigned?.index);
    rawProfile = frame.sharedRawProfile ?? null;
    const preferences = getPreferences(),
      bindings = preferences.controllerBindings ?? null,
      boostMode = preferences.controllerBoostMode ?? 'hold',
      next = JSON.stringify([bindings, boostMode]);
    if (configuration !== next) {
      router.setBindings(bindings);
      router.setBoostMode(boostMode);
      configuration = next;
    }
    return router.sample(options);
  };
  return {
    clear,
    sample(frame = {}, { modeId, scope, spectator, toggleBoostEligible } = {}) {
      if (previousMode !== modeId) {
        previousMode = modeId;
        clear();
      }
      // SIM keeps its native flight/radio sample. Its standalone entry supplies
      // only captured pads, so derive menu edges while shared controls own focus.
      // Existing native UI/Confirm owners keep the edges they already admitted.
      if (modeId === 'sim') {
        if (scope === 'flight') {
          if (simMenuActive) clear();
          return frame;
        }
        if (!Object.hasOwn(frame, 'gamepads') || frame.ui) return frame;
        simMenuActive = true;
        const normalized = normalize(frame, { scope, timeMs: frame.now, spectator: true });
        return {
          ...frame,
          ui: normalized.ui,
          assigned: normalized.assigned,
          status: normalized.status,
          disconnected: normalized.disconnected,
        };
      }
      // Legacy normalized callers without captured pads remain supported.
      if (!Object.hasOwn(frame, 'gamepads')) return frame;
      const authoritative = completeFrame(frame)
        ? frame
        : completeFrame(frame.sharedController)
          ? frame.sharedController
          : null;
      if (authoritative) {
        const sharedFlight =
          frame.sharedController && ['solo', 'snake'].includes(modeId)
            ? normalize(
                frame,
                { scope, timeMs: frame.now, spectator, toggleBoostEligible },
                authoritative.assigned ?? null,
              ).flight
            : null;
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
          // Survival has a momentary native dash. Other modes use their saved
          // shared flight bindings/boost policy, while native UI edges stay owned.
          ...(sharedFlight ? { flight: sharedFlight } : {}),
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
      const normalized = normalize(frame, {
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
