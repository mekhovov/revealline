import { SAFE } from '../../coop/core.mjs';
import { TEAM_MATERIAL_CANDIDATES } from '../../content-design/team-material-candidates.mjs';
import { perimeterConnectedFoundations } from './team-foundation-goal.mjs';

/** Read-only optional-goal evidence: only a whole reclaimed patch counts. */
export function inspectTeamMaterialGoal(run, evidence) {
  const layout = TEAM_MATERIAL_CANDIDATES.find((candidate) => candidate.id === run.level.id);
  if (!layout) throw new Error('Unknown Team material practice goal.');
  const neutralized = run.level.terrain
    .filter((area) => {
      for (let y = area.y; y < area.y + area.h; y++)
        for (let x = area.x; x < area.x + area.w; x++)
          if (run.cells[y * run.width + x] !== SAFE) return false;
      return true;
    })
    .map((area) => area.id);
  const connected = perimeterConnectedFoundations(run);
  const condition =
    neutralized.length === run.level.terrain.length &&
    (layout.id !== 'weaver-crossing' || connected.has(2)) &&
    (layout.id !== 'split-orchards' ||
      run.level.spawns.every((spawn, seat) =>
        evidence.chamberClosures[seat].has(spawn.x < 35 ? 'west' : 'east'),
      ));
  return {
    achieved:
      run.status === 'won' && evidence.downs === 0 && evidence.closed.size === 2 && condition,
    condition,
    neutralized,
    connected: [...connected],
  };
}
