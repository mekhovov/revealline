import { CELL } from '../../core/index.mjs';

// Read-only optional-goal evidence, never runtime awards or modified win rules.
export const createSentinelGoalEvidence = () => ({
  lastTick: -1,
  shields: new Map(),
  openings: new Set(),
  used: new Map(),
  defeat: null,
});

export function observeSentinelGoal(run, evidence) {
  if (run.tick === evidence.lastTick) return;
  evidence.lastTick = run.tick;
  const recipe = run.level.encounter;
  const closed = run.events.some((event) => event.type === 'cut.closed');
  for (const event of run.events) {
    if (event.tick !== run.tick) continue;
    if (
      closed &&
      event.type === 'objective.captured' &&
      recipe.shieldObjectiveIds.includes(event.id) &&
      run.objectives.some((objective) => objective.id === event.id && objective.captured) &&
      !evidence.shields.has(event.id)
    )
      evidence.shields.set(event.id, run.tick);
    if (event.id !== recipe.enemyId) continue;
    if (
      event.type === 'encounter.phaseChanged' &&
      event.stage === 'exposed' &&
      event.phase === 'open'
    )
      evidence.openings.add(event.phaseStartTick);
    if (event.type === 'encounter.defeated')
      evidence.defeat = {
        tick: run.tick,
        cause: event.cause,
        cutCells: event.qualifyingCutCells,
        opening: evidence.openings.size,
      };
  }
  if (run.player.cutting) return;
  const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
  if (run.cells[cell] !== CELL.SAFE) return;
  for (const gate of run.relay.gates)
    if (
      gate.openedTick !== null &&
      gate.openedTick <= run.tick &&
      gate.cells.includes(cell) &&
      !evidence.used.has(gate.id)
    )
      evidence.used.set(gate.id, run.tick);
}

export function inspectSentinelGoal({ missionId, run, evidence }) {
  const ids = run.level.encounter.shieldObjectiveIds;
  const allShields = ids.every((id) => evidence.shields.has(id));
  const finalShield = allShields ? Math.max(...ids.map((id) => evidence.shields.get(id))) : null;
  const east = evidence.shields.get('east-shield'),
    west = evidence.shields.get('west-shield');
  const usedBefore = (id, tick) =>
    evidence.used.has(id) && tick !== null && evidence.used.get(id) < tick;
  const conditions = {
    'first-relay': evidence.defeat?.opening === 1,
    'twin-receivers': east !== undefined && west !== undefined && east < west,
    'relay-perimeter': ['corner-top', 'corner-side'].every((id) => usedBefore(id, finalShield)),
    'crown-audience': allShields && new Set(ids.map((id) => evidence.shields.get(id))).size === 4,
    'sentinel-remix':
      usedBefore('release-dock', evidence.defeat?.tick ?? null) &&
      evidence.defeat?.cause === 'cut-release' &&
      evidence.defeat.cutCells >= 16,
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown Sentinel Crown goal.');
  return {
    achieved:
      run.status === 'won' &&
      run.classic.livesLost === 0 &&
      run.encounter.defeated &&
      allShields &&
      conditions[missionId],
    condition: conditions[missionId],
    shields: [...evidence.shields],
    openings: [...evidence.openings],
    used: [...evidence.used],
    defeat: evidence.defeat ? { ...evidence.defeat } : null,
  };
}
