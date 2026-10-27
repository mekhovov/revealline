/** Fairness is measured in performances: modes, then level/variant entries,
 * then recordings. Extra recordings never increase an entry's weight. */
export function createDemoRotation({ random = Math.random } = {}) {
  const visitedModes = new Set();
  const visitedLevels = new Map();
  const previousLevels = new Map();
  let previous = null;
  let first = true;
  const mode = (source) => source.modeId ?? 'solo';
  const level = (source) => `${source.levelKey ?? source.levelId}\u0000${source.variantId ?? ''}`;
  const visit = (source) => {
    const id = mode(source);
    visitedModes.add(id);
    if (!visitedLevels.has(id)) visitedLevels.set(id, new Set());
    visitedLevels.get(id).add(level(source));
  };
  const pick = (items) => {
    const value = random();
    return items[
      Math.min(
        items.length - 1,
        Math.floor(Math.max(0, Number.isFinite(value) ? value : 0) * items.length),
      )
    ];
  };
  return {
    hasPendingModes(available) {
      return available.some((source) => !visitedModes.has(mode(source)));
    },
    choose(available) {
      if (!available.length) return null;
      const modes = [...new Set(available.map(mode))];
      let modeBag = modes.filter((id) => !visitedModes.has(id));
      if (!modeBag.length) {
        visitedModes.clear();
        modeBag = modes;
      }
      if (modeBag.length > 1 && previous) modeBag = modeBag.filter((id) => id !== mode(previous));
      if (first) {
        const approachable = modeBag.filter((id) =>
          available.some((s) => mode(s) === id && s.approachable),
        );
        if (approachable.length) modeBag = approachable;
      }
      const modeId = pick(modeBag);
      const entries = available.filter((source) => mode(source) === modeId);
      const keys = [...new Set(entries.map(level))];
      let visited = visitedLevels.get(modeId);
      if (!visited) visitedLevels.set(modeId, (visited = new Set()));
      let levelBag = keys.filter((key) => !visited.has(key));
      if (!levelBag.length) {
        visited.clear();
        levelBag = keys;
      }
      if (levelBag.length > 1 && previousLevels.has(modeId))
        levelBag = levelBag.filter((key) => key !== previousLevels.get(modeId));
      if (first) {
        const approachable = levelBag.filter((key) =>
          entries.some((s) => level(s) === key && s.approachable),
        );
        if (approachable.length) levelBag = approachable;
      }
      const key = pick(levelBag);
      let recordings = entries.filter((source) => level(source) === key);
      if (first && recordings.some((s) => s.approachable))
        recordings = recordings.filter((s) => s.approachable);
      return pick(recordings);
    },
    defer(source) {
      // A bad recording gets one attempt for this mode/entry cycle. Its other
      // recordings remain eligible next cycle instead of monopolizing recovery.
      visit(source);
    },
    accept(source) {
      const id = mode(source);
      visit(source);
      previous = source;
      previousLevels.set(id, level(source));
      first = false;
    },
  };
}
