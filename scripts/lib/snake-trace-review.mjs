/** Local design-review signals; these thresholds are heuristics, not fun scores. */
const decisions = new Set([
  'target.spawned',
  'target.caught',
  'target.warning',
  'target.opened',
  'cargo.collected',
  'cargo.delivered',
  'operation.stage-completed',
  'relay.collected',
  'wall.opened',
  'switchyard.changed',
  'plate.activated',
  'plate.released',
  'plate.gate-closed',
  'pickup.spawned',
  'pickup.collected',
]);
function encounter(run) {
  return JSON.stringify({
    actors: (run.targets ?? []).map((t) => [
      t.id,
      t.kind,
      t.phase,
      t.tactical?.phase,
      t.tactical?.end,
    ]),
    interference: Boolean(run.signal?.jammed),
  });
}
export function createSnakeTraceReview() {
  const boards = new Map();
  function begin(run, board) {
    boards.set(board, {
      lastTick: run.tick ?? 0,
      lastMs: run.elapsedMs ?? 0,
      encounter: encounter(run),
      captures: 0,
      spots: new Map(),
      lastSpot: null,
      streak: 0,
      longestSameSpotStreak: 0,
      idleMoves: 0,
      idleMs: 0,
      maxNoChangeMoves: 0,
      maxNoChangeMs: 0,
      meaningfulSteps: 0,
      eventCounts: {},
    });
  }
  return {
    start(match) {
      match.runs.forEach(begin);
    },
    observe({ run, board = 0, elapsedMs = run.elapsedMs }) {
      if (!boards.has(board)) begin({ ...run, tick: 0, elapsedMs: 0, targets: [] }, board);
      const state = boards.get(board);
      if (run.tick === state.lastTick) return;
      if (run.tick !== state.lastTick + 1 || elapsedMs < state.lastMs)
        throw new Error('Trace requires ordered per-step observations.');
      const fingerprint = encounter(run);
      const meaningful =
        fingerprint !== state.encounter || run.events.some((e) => decisions.has(e.type));
      for (const event of run.events) {
        if (decisions.has(event.type))
          state.eventCounts[event.type] = (state.eventCounts[event.type] ?? 0) + 1;
        if (event.type !== 'target.caught') continue;
        const spot = `${event.target.x},${event.target.y}`;
        state.captures++;
        state.spots.set(spot, (state.spots.get(spot) ?? 0) + 1);
        state.streak = spot === state.lastSpot ? state.streak + 1 : 1;
        state.lastSpot = spot;
        state.longestSameSpotStreak = Math.max(state.longestSameSpotStreak, state.streak);
      }
      if (meaningful) {
        state.meaningfulSteps++;
        state.idleMoves = 0;
        state.idleMs = 0;
      } else {
        state.idleMoves++;
        state.idleMs += elapsedMs - state.lastMs;
        state.maxNoChangeMoves = Math.max(state.maxNoChangeMoves, state.idleMoves);
        state.maxNoChangeMs = Math.max(state.maxNoChangeMs, state.idleMs);
      }
      state.lastTick = run.tick;
      state.lastMs = elapsedMs;
      state.encounter = fingerprint;
    },
    result() {
      return [...boards.entries()].map(([board, state]) => {
        const captureLocations = [...state.spots]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([cell, count]) => ({ cell, count }));
        const maxRepeatedSpot = captureLocations[0]?.count ?? 0;
        const captureConcentration = state.captures ? maxRepeatedSpot / state.captures : 0;
        const signals = [];
        if (maxRepeatedSpot >= 3 && captureConcentration >= 0.5)
          signals.push('concentrated-captures');
        if (state.maxNoChangeMoves >= 24 || state.maxNoChangeMs >= 6000)
          signals.push('long-interval-without-encounter-change');
        return {
          board,
          steps: state.lastTick,
          elapsedMs: state.lastMs,
          captures: state.captures,
          captureLocations,
          maxRepeatedSpot,
          captureConcentration,
          longestSameSpotStreak: state.longestSameSpotStreak,
          maxNoChangeMoves: state.maxNoChangeMoves,
          maxNoChangeMs: state.maxNoChangeMs,
          meaningfulSteps: state.meaningfulSteps,
          eventCounts: state.eventCounts,
          signals,
        };
      });
    },
  };
}
