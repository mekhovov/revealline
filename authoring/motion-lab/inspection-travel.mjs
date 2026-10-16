// Inspection presentation only. Never writes movement, recipes or clock state.
export function inspectionTravelRatio(mode, state, motion) {
  const follow = state.visualSpeed / Math.max(0.01, motion.cruiseSpeed);
  const ratio =
    mode === 'idle'
      ? 0
      : mode === 'cruise'
        ? 1
        : mode === 'boost'
          ? motion.boostMultiplier
          : mode === 'slow'
            ? motion.slowMultiplier
            : follow;
  return Number.isFinite(ratio) ? Math.min(4, Math.max(0, ratio)) : 0;
}
