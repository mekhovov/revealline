import { SAFE } from '../../coop/core.mjs';
import { TEAM_FOUNDATION_CANDIDATES } from '../../content-design/team-journey-candidates.mjs';

// Read-only test evidence, never an official award or a mutable runtime rule.
export const createTeamFoundationEvidence = () => ({
  lastTick: -1,
  claimed: -1,
  downs: 0,
  closed: new Set(),
  connected: new Set(),
  visits: [new Set(), new Set()],
  departures: [null, null],
  chamberClosures: [new Set(), new Set()],
});

export function perimeterConnectedFoundations(run) {
  const queue = [0],
    seen = new Set(queue);
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head],
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
      if (seen.has(next) || run.cells[next] !== SAFE) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return new Set(
    run.level.safeRects.flatMap((r, i) => (seen.has(r.y * run.width + r.x) ? [i] : [])),
  );
}

export function observeTeamFoundationGoal(run, evidence) {
  if (evidence.lastTick === run.tick) return;
  evidence.lastTick = run.tick;
  if (run.claimedCount !== evidence.claimed) {
    evidence.connected = perimeterConnectedFoundations(run);
    evidence.claimed = run.claimedCount;
  }
  for (const event of run.events) {
    if (event.type === 'player.downed') evidence.downs++;
    if (event.type === 'cut.closed') {
      evidence.closed.add(event.player);
      const departure = evidence.departures[event.player];
      if (departure !== null) evidence.chamberClosures[event.player].add(departure);
      evidence.departures[event.player] = null;
    }
  }
  for (const player of run.players) {
    if (player.cutting) {
      const x = player.trail[0]?.x;
      if (x !== undefined)
        evidence.departures[player.id] = x < 35 ? 'west' : x > 36 ? 'east' : 'middle';
      continue;
    }
    if (player.status !== 'active' || run.cells[player.cellIndex] !== SAFE) continue;
    for (const [index, r] of run.level.safeRects.entries())
      if (
        evidence.connected.has(index) &&
        player.x >= r.x &&
        player.x < r.x + r.w &&
        player.y >= r.y &&
        player.y < r.y + r.h
      )
        evidence.visits[player.id].add(index);
  }
}

export function inspectTeamFoundationGoal(run, evidence) {
  const layout = TEAM_FOUNDATION_CANDIDATES.find((candidate) => candidate.id === run.level.id);
  if (!layout) throw new Error('Unknown Team foundation practice goal.');
  const connected = perimeterConnectedFoundations(run);
  const condition =
    layout.masteryFoundations.every((index) => connected.has(index)) &&
    (layout.id !== 'switchback-partners' || evidence.visits.every((visits) => visits.has(2))) &&
    (layout.id !== 'divided-workshop' ||
      run.level.spawns.every((spawn, seat) =>
        evidence.chamberClosures[seat].has(spawn.x < 35 ? 'west' : 'east'),
      ));
  return {
    achieved:
      run.status === 'won' && evidence.downs === 0 && evidence.closed.size === 2 && condition,
    condition,
    connected: [...connected],
    visits: evidence.visits.map((visits) => [...visits]),
    chamberClosures: evidence.chamberClosures.map((values) => [...values]),
  };
}
