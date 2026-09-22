import { TEAM_ROAMER_CANDIDATES } from '../../content-design/team-roamer-candidates.mjs';
import { perimeterConnectedFoundations } from './team-foundation-goal.mjs';

/** Local optional evidence, not an award or an excuse to force a wake-up in an
 * ordinary clear. Warning alone is not activation; shared credit is explicit. */
export function inspectTeamRoamerGoal(run, evidence) {
  const layout = TEAM_ROAMER_CANDIDATES.find((entry) => entry.id === run.level.id);
  if (!layout) throw new Error('Unknown Team roamer goal.');
  const roamers = run.enemies.filter((enemy) => enemy.type === 'claimed-rover');
  const activated = roamers
    .filter((enemy) => enemy.rover.mode === 'active')
    .map((enemy) => enemy.id);
  const connected = perimeterConnectedFoundations(run);
  const condition =
    activated.length === roamers.length &&
    (layout.id !== 'twin-depots' ||
      run.level.spawns.every((spawn, seat) =>
        evidence.chamberClosures[seat].has(spawn.x < 35 ? 'west' : 'east'),
      )) &&
    (layout.id !== 'changing-courtyard' || connected.has(2)) &&
    (layout.id !== 'last-rendezvous' || (connected.has(2) && connected.has(3)));
  return {
    achieved:
      run.status === 'won' && evidence.downs === 0 && evidence.closed.size === 2 && condition,
    condition,
    activated,
    connected: [...connected],
  };
}
