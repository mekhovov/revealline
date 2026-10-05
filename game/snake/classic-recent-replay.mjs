// Nine boundaries describe eight moves. This buffer never owns input journals,
// archived verification proofs, or copies of immutable level recipes.
export const RECENT_REPLAY_MOVES = 8;
export const RECENT_REPLAY_STEP_MS = 240;
const VISUAL_FIELDS = [
  'version',
  'levelId',
  'levelIdentity',
  'mode',
  'seed',
  'hazardSeed',
  'tick',
  'elapsedMs',
  'status',
  'score',
  'catches',
  'bonusCatches',
  'snakes',
  'targets',
  'target',
  'pickup',
  'shutters',
  'pulseTicks',
  'recentCatches',
  'failure',
  'signal',
  'projectiles',
  'relays',
  'removedWalls',
  'danger',
];

export function classicVisualSnapshot(run) {
  const frame = { level: run.level };
  for (const key of VISUAL_FIELDS)
    if (run[key] !== undefined) frame[key] = structuredClone(run[key]);
  return frame;
}

export function createClassicRecentReplay() {
  let boards = [];
  const capture = (run, board = 0) => {
    const frames = (boards[board] ??= []),
      snapshot = classicVisualSnapshot(run);
    // A failure caused by an input cap can alter the current boundary without
    // moving. Keep that collision/result, but do not invent an extra move.
    if (frames.at(-1)?.tick === run.tick) frames[frames.length - 1] = snapshot;
    else frames.push(snapshot);
    if (frames.length > RECENT_REPLAY_MOVES + 1) frames.shift();
  };
  return {
    reset(runs = []) {
      boards = [];
      runs.forEach(capture);
    },
    capture,
    observe({ run, board }) {
      capture(run, board);
    },
    frames() {
      return boards.map((frames) => frames.slice());
    },
    durationMs() {
      return Math.max(0, ...boards.map((frames) => frames.length - 1)) * RECENT_REPLAY_STEP_MS;
    },
    frame(board, timeMs) {
      const frames = boards[board] ?? [];
      return frames[
        Math.min(frames.length - 1, Math.max(0, Math.floor(timeMs / RECENT_REPLAY_STEP_MS)))
      ];
    },
  };
}
