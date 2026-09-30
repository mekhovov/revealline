import { createCoop, startCoop, stepCoop } from '../../../game/coop/core.mjs';
import { COOP_BONUS_LEVEL_VERSION } from '../../../game/coop/foundations.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../../../game/core/timed-bonuses.mjs';

export const teamReviewCommand = (direction = null) => ({
  direction,
  boost: false,
  support: false,
});
export const TEAM_REVIEW_IDLE = Object.freeze([teamReviewCommand(), teamReviewCommand()]);

/** Authored bonus-edition fixture. Pickups, movement and expiry use the public
 * Team core; no effect, enemy state or clock is injected after creation. */
export function teamBonusReviewLevel(kind = 'enemy-freeze') {
  return {
    version: COOP_BONUS_LEVEL_VERSION,
    id: 'team-freeze-motion-review',
    revision: '1',
    name: 'Team freeze moving parts',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: 8.5, y: 0.5 },
      { x: 71.5, y: 30.5 },
    ],
    walls: [],
    safeRects: [{ x: 30, y: 10, w: 5, h: 5 }],
    terrain: [],
    enemies: [
      { id: 'keeper', type: 'drifter', x: 55.5, y: 18.5, vx: 1.2, vy: 0.8, radius: 0.25 },
      { id: 'rover', type: 'claimed-rover', x: 32.5, y: 12.5, vx: 1, vy: 0, radius: 0.25 },
    ],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 8, boostMultiplier: 1 },
    timedBonuses: {
      version: TIMED_BONUS_TRAIL_VERSION,
      schedules: [
        {
          id: 'opportunity',
          kind,
          anchors: [
            { x: 8.5, y: 8.5 },
            { x: 8.5, y: 18.5 },
          ],
          initialDelayTicks: 0,
          announcementTicks: 120,
          availableTicks: 1200,
          cooldownTicks: 240,
          maxAppearances: 1,
          maxCollections: 1,
        },
      ],
    },
  };
}

export function teamBonusReviewInitial(kind = 'enemy-freeze') {
  return startCoop(createCoop(teamBonusReviewLevel(kind), { seed: 17 }));
}

export function teamBonusReviewCheckpoints(kind = 'enemy-freeze') {
  const run = teamBonusReviewInitial(kind),
    checkpoints = [];
  let grant = null;
  for (let guard = 0; guard < 1200; guard++) {
    stepCoop(
      run,
      run.tick >= 121 && !grant
        ? [teamReviewCommand('down'), teamReviewCommand()]
        : TEAM_REVIEW_IDLE,
    );
    grant ??= run.events.find((event) => event.type === 'powerup.collected');
    if (
      run.tick === 121 ||
      (grant &&
        [
          grant.activationTick,
          grant.activationTick + 120,
          grant.untilTick,
          grant.untilTick + 60,
        ].includes(run.tick))
    )
      checkpoints.push(structuredClone(run));
    if (grant && run.tick === grant.untilTick + 60) break;
  }
  if (checkpoints.length !== 5 || checkpoints.some((run) => run.status !== 'running'))
    throw new Error('The Team bonus review did not reach five live public-core checkpoints.');
  return checkpoints;
}
