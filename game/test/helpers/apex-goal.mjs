import { CELL } from '../../core/index.mjs';

// Test-only evidence. No runtime awards, live predictions or state mutation.
export const createApexGoalEvidence = () => ({
  visits: new Set(),
  used: new Map(),
  connected: new Set(),
  topologyRevision: -1,
});

export function connectedApexFoundations(run) {
  // The authored spawn's reclaimed component is the durable route origin.
  const spawn = run.level.spawn,
    root = Math.floor(spawn.y) * run.width + Math.floor(spawn.x);
  const queue = [root],
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

export function observeApexGoal(run, evidence) {
  if (run.classic.topologyRevision !== evidence.topologyRevision) {
    evidence.connected = connectedApexFoundations(run);
    evidence.topologyRevision = run.classic.topologyRevision;
  }
  const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
  if (run.player.cutting || run.cells[cell] !== CELL.SAFE) return;
  for (const [index, rectangle] of run.level.foundations.entries())
    if (
      evidence.connected.has(index) &&
      run.player.x >= rectangle.x &&
      run.player.x < rectangle.x + rectangle.w &&
      run.player.y >= rectangle.y &&
      run.player.y < rectangle.y + rectangle.h
    )
      evidence.visits.add(index);
  for (const gate of run.relay.gates)
    if (
      gate.openedTick !== null &&
      gate.openedTick <= run.tick &&
      gate.cells.includes(cell) &&
      !evidence.used.has(gate.id)
    )
      evidence.used.set(gate.id, run.tick);
}

export function inspectApexGoal({ missionId, run, evidence }) {
  const connected = connectedApexFoundations(run);
  const visited = (index) => connected.has(index) && evidence.visits.has(index);
  const lethalReclaimed = run.level.classic.terrain
    .filter((tile) => tile.kind === 'lethal')
    .every((tile) => {
      for (let y = tile.y; y < tile.y + tile.h; y++)
        for (let x = tile.x; x < tile.x + tile.w; x++)
          if (run.cells[y * run.width + x] !== CELL.SAFE) return false;
      return true;
    });
  const used = (...ids) =>
    ids.every((id) => evidence.used.has(id) && evidence.used.get(id) < run.tick);
  const conditions = {
    'crossing-complete': lethalReclaimed && visited(3),
    'final-broadcast': used('upper-link', 'lower-link'),
    'returning-light': visited(1) && visited(3),
    'home-signal': [1, 2, 3, 4].some(visited) && [5, 6, 7, 8].some(visited),
    'apex-remix': lethalReclaimed && used('west-corner', 'east-corner'),
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown Apex Aurora goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    condition: conditions[missionId],
    lethalReclaimed,
    connected: [...connected],
    visits: [...evidence.visits],
    used: [...evidence.used],
  };
}
