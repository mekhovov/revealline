const neutralUI = (ui) => ({ ...ui, confirm: false });

export function createControllerConfirmLifecycle({ releaseMs = 120 } = {}) {
  if (!Number.isFinite(releaseMs) || releaseMs < 0 || releaseMs > 1000)
    throw new RangeError('Controller Confirm release timing is out of bounds.');

  let active = false,
    neutralAt = null,
    lastTime = 0;

  function reset() {
    active = false;
    neutralAt = null;
  }

  function filter(frame, timeMs) {
    const clock = Number.isFinite(timeMs) ? timeMs : lastTime,
      time = Math.max(lastTime, clock);
    lastTime = time;

    if (!frame || frame.disconnected || !frame.assigned) {
      reset();
      return frame;
    }

    const held = frame.confirmHeld === true,
      confirm = frame.ui?.confirm === true;

    if (confirm) {
      const rearmed = !active || (neutralAt !== null && time - neutralAt >= releaseMs);
      active = true;
      neutralAt = null;
      if (!rearmed) return { ...frame, ui: neutralUI(frame.ui) };
      return frame;
    }

    if (held) {
      active = true;
      neutralAt = null;
    } else if (active) {
      if (releaseMs === 0) reset();
      else if (neutralAt === null) neutralAt = time;
      else if (time - neutralAt >= releaseMs) reset();
    }
    return frame;
  }

  return {
    filter,
    owned: () => active,
    reset,
  };
}
