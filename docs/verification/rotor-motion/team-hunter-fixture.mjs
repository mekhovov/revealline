import { createCoop, startCoop, stepCoop } from '../../../game/coop/core.mjs';
import { FIRST_CONNECTION } from '../../../game/coop/first-connection.mjs';

/** Finite review scenario. Only initial placement/trail is arranged; the real
 * Team simulation owns every captured warning, commitment and recovery. */
export function hunterReviewCheckpoints() {
  const level = structuredClone(FIRST_CONNECTION);
  level.enemies = [
    { id: 'review-hunter', type: 'hunter', x: 30.5, y: 10.5, vx: 0, vy: 0.8, radius: 0.35 },
  ];
  const run = startCoop(createCoop(level));
  Object.assign(run.players[0], {
    x: 20.5,
    y: 10.5,
    cellIndex: 10 * 72 + 20,
    trail: Array.from({ length: 10 }, (_, i) => ({
      x: 20,
      y: i + 1,
      index: (i + 1) * 72 + 20,
    })),
    cutting: true,
    safeAnchor: { x: 20.5, y: 0.5 },
    departureIndex: 20,
  });
  const checkpoints = [structuredClone(run)];
  let phase = run.enemies[0].phase;
  for (let i = 0; i < 600 && phase !== 'recovery'; i++) {
    stepCoop(
      run,
      [0, 1].map(() => ({ direction: null, boost: false, support: false })),
    );
    if (run.enemies[0].phase !== phase) {
      phase = run.enemies[0].phase;
      checkpoints.push(structuredClone(run));
    }
  }
  if (
    checkpoints.map((entry) => entry.enemies[0].phase).join(',') !==
    'patrol,warning,commit,recovery'
  )
    throw new Error('The real Team simulation did not reach the four review phases.');
  return checkpoints;
}
