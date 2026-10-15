const TIERS = Object.freeze([
  Object.freeze({ tier: 'full', reduced: false, minimal: false }),
  Object.freeze({ tier: 'reduced', reduced: true, minimal: false }),
  Object.freeze({ tier: 'minimal', reduced: true, minimal: true }),
]);

// Presentation only. No device identification or simulation/input rate changes.
export function createVisualQualityPolicy() {
  let level = 0,
    reducedPreference = false,
    baselineMs = 1000 / 60,
    windowStart = null,
    count = 0,
    missed = 0,
    work = 0,
    expensive = 0,
    overloadWindows = 0,
    headroomWindows = 0,
    lastChange = -Infinity;
  const snapshot = () => TIERS[Math.max(level, reducedPreference ? 1 : 0)];
  const resetWindow = (nowMs) => {
    windowStart = nowMs;
    count = missed = work = expensive = 0;
  };
  return {
    snapshot,
    setReducedPreference(value) {
      reducedPreference = Boolean(value);
      return snapshot();
    },
    // Calibrate while ready/preparing, then freeze this value for active play.
    setBaseline(frameMs) {
      if (Number.isFinite(frameMs) && frameMs >= 4 && frameMs <= 50) baselineMs = frameMs;
      resetWindow(null);
      overloadWindows = headroomWindows = 0;
    },
    observe(nowMs, frameMs, workMs) {
      if (
        !Number.isFinite(nowMs) ||
        !Number.isFinite(frameMs) ||
        !Number.isFinite(workMs) ||
        frameMs <= 0 ||
        workMs < 0
      )
        return snapshot();
      if (windowStart === null || nowMs < windowStart) resetWindow(nowMs);
      // A lifecycle interruption does not contribute a fictitious second of load.
      if (frameMs > 250) {
        resetWindow(nowMs);
        overloadWindows = headroomWindows = 0;
        return snapshot();
      }
      count++;
      work += workMs;
      if (frameMs > baselineMs * 1.5) missed++;
      if (workMs > baselineMs * 0.6) expensive++;
      if (nowMs - windowStart < 1000) return snapshot();
      const average = work / count;
      // Cadence alone cannot distinguish OS power throttling from overload.
      // Cheap, regular 30 Hz callbacks must not progressively erase decoration.
      const overloaded =
        average > baselineMs * 0.6 || (missed / count > 0.1 && expensive / count > 0.2);
      overloadWindows = overloaded ? overloadWindows + 1 : 0;
      headroomWindows =
        !overloaded && average < baselineMs * 0.35 && missed / count <= 0.02
          ? headroomWindows + 1
          : 0;
      const effectiveLevel = Math.max(level, reducedPreference ? 1 : 0);
      if (overloadWindows >= 2 && effectiveLevel < 2 && nowMs - lastChange >= 10000) {
        level = effectiveLevel + 1;
        lastChange = nowMs;
        overloadWindows = headroomWindows = 0;
      }
      resetWindow(nowMs);
      return snapshot();
    },
    safeTransition(nowMs) {
      if (
        Number.isFinite(nowMs) &&
        level > 0 &&
        headroomWindows >= 10 &&
        nowMs - lastChange >= 10000
      ) {
        level--;
        lastChange = nowMs;
        overloadWindows = headroomWindows = 0;
      }
      // Overload must be consecutive active windows, not separated by a pause.
      overloadWindows = 0;
      resetWindow(null);
      return snapshot();
    },
  };
}
