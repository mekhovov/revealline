import { CELL } from '../../core/index.mjs';

// Read-only route evidence, never a runtime award or a change to victory rules.
export const createCrosswindGoalEvidence = () => ({
  visits: new Set(),
  used: new Set(),
  connected: new Set(),
  topologyRevision: -1,
});
export function observeCrosswindGoal(run, evidence) {
  if (evidence.topologyRevision !== run.classic.topologyRevision) {
    evidence.connected = connectedFoundations(run, 0);
    evidence.topologyRevision = run.classic.topologyRevision;
  }
  if (run.player.cutting) return;
  for (const [index, rectangle] of run.level.foundations.entries())
    if (
      evidence.connected.has(index) &&
      run.player.x >= rectangle.x &&
      run.player.x < rectangle.x + rectangle.w &&
      run.player.y >= rectangle.y &&
      run.player.y < rectangle.y + rectangle.h
    )
      evidence.visits.add(index);
  const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
  for (const gate of run.relay.gates)
    if (
      gate.openedTick !== null &&
      gate.openedTick <= run.tick &&
      run.cells[cell] === CELL.SAFE &&
      gate.cells.includes(cell)
    )
      evidence.used.add(gate.id);
}

function connectedFoundations(run, origin) {
  const from = run.level.foundations[origin];
  const root = from.y * run.width + from.x,
    queue = [root],
    seen = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor],
      x = cell % run.width,
      y = Math.floor(cell / run.width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || nx >= run.width || ny < 0 || ny >= run.height) continue;
      const next = ny * run.width + nx;
      if (run.cells[next] !== CELL.SAFE || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return new Set(
    run.level.foundations.flatMap((rectangle, index) =>
      seen.has(rectangle.y * run.width + rectangle.x) ? [index] : [],
    ),
  );
}

export function inspectCrosswindGoal({ missionId, run, evidence }) {
  const reclaimed = new Set(
    run.level.directionalFields.zones
      .filter((zone) => {
        for (let y = zone.y; y < zone.y + zone.h; y++)
          for (let x = zone.x; x < zone.x + zone.w; x++)
            if (run.cells[y * run.width + x] !== CELL.SAFE) return false;
        return true;
      })
      .map((zone) => zone.id),
  );
  const connected = connectedFoundations(run, 0);
  const all = (...ids) => ids.every((id) => reclaimed.has(id));
  const visited = (...indices) =>
    indices.every((index) => connected.has(index) && evidence.visits.has(index));
  const conditions = {
    'read-the-arrows': all('southbound', 'northbound'),
    'survey-markers': visited(1, 2),
    'windbreak-weave': [1, 2, 3, 4].filter((index) => connected.has(index)).length >= 3,
    'compass-array': all('north-neck', 'south-neck'),
    'outer-loop': visited(3, 4),
    'long-wave': all('west-up', 'east-up'),
    'crosswind-remix': all('west-current', 'east-current') && evidence.used.has('protected-return'),
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown Crosswind Array goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    condition: conditions[missionId],
    reclaimed: [...reclaimed],
    connected: [...connected],
    visits: [...evidence.visits],
    used: [...evidence.used],
  };
}
