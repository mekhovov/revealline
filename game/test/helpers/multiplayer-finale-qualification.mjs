import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createMultiplayerExpansionCandidates } from '../../content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../../coop/core.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../../multiplayer.mjs';
import { dataIdentity } from '../../data-json.mjs';

export const finaleProtocol = { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 };
export const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const finaleCommand = (direction) => ({
  direction,
  boost: false,
  action: false,
  pickup: false,
});
export const finaleInputs = (mode, segment) =>
  mode === 'team'
    ? [segment.a, segment.b].map((direction) => ({ direction, boost: false, support: false }))
    : [finaleCommand(segment.direction), finaleCommand(segment.direction)];
export const finaleStart = (mode, level, options) => {
  if (mode === 'team') return startCoop(createCoop(level, options));
  const match = createDuel(level, options, finaleProtocol);
  resumeDuel(match);
  return match;
};
export const finaleStep = (mode, run, inputs) =>
  (mode === 'team' ? stepCoop : stepDuel)(run, inputs);

export async function finaleCases(mode) {
  const source = createMultiplayerExpansionCandidates({ mode });
  const project = compileContentProject(source);
  const existing = JSON.parse(
    await readFile(
      new URL(
        `../fixtures/multiplayer-expansion/${mode === 'team' ? 'standard' : 'duel-standard-immediate'}.json`,
        import.meta.url,
      ),
    ),
  );
  return source.packs.map((pack) => {
    const campaign = source.campaigns.find((c) => c.id === pack.campaignIds.at(-1));
    const missionId = campaign.missionIds.at(-1);
    const primary = existing.rows.find((row) => row.missionId === missionId);
    const authored = resolveMission(project, missionId, { mode, difficulty: 'standard' }).level;
    const level = applyGameplayTuning(authored, resolveGameplayTuning('standard'));
    return {
      mode,
      chapter: pack.id,
      missionId,
      level,
      authoredIdentity: dataIdentity(authored),
      tunedIdentity: dataIdentity(level),
      options: mode === 'team' ? { seed: 17 } : primary.options,
      primary: primary.segments,
    };
  });
}

// Observations only: no source or run mutation, no search inside a regression test.
export function playFinale(row, segments, { onTick } = {}) {
  const run = finaleStart(row.mode, row.level, row.options);
  const captures = [],
    hazards = [],
    closed = [0, 0],
    trace = [];
  const openPaths = [new Set(), new Set()];
  for (const segment of segments) {
    let ticks = 0;
    for (; ticks < segment.ticks && run.status === 'running'; ticks++) {
      const inputs = finaleInputs(row.mode, segment);
      finaleStep(row.mode, run, inputs);
      const board = row.mode === 'team' ? run : run.runs[0];
      const trails = row.mode === 'team' ? board.players.map((p) => p.trail) : [board.trail];
      for (let seat = 0; seat < trails.length; seat++)
        for (const cell of trails[seat]) openPaths[seat].add(cell.index);
      const closures = board.events.filter((e) => e.type === 'cut.closed');
      if (closures.length) {
        const cells = Array.from(board.cells);
        captures.push({
          tick: run.tick,
          players: closures.map((e) => e.player ?? 0),
          cutPaths: closures.map((e) => [...openPaths[e.player ?? 0]].sort((a, b) => a - b)),
          // Actual newly claimed geometry, independent of timestamps/idle delays.
          gained: [
            ...new Set(
              board.events.filter((e) => e.type === 'cells.claimed').flatMap((e) => e.indices),
            ),
          ].sort((a, b) => a - b),
          footprint: hash(cells),
          objectives: board.events.filter((e) => /objective|relay|stage/.test(e.type)),
        });
        for (const event of closures) closed[event.player ?? 0]++;
        for (const event of closures) openPaths[event.player ?? 0].clear();
      }
      for (const event of board.events)
        if (/downed|failed|revived|lost|eroded|intercepted/.test(event.type)) {
          hazards.push({ ...event, tick: run.tick });
          if (/downed|failed/.test(event.type)) openPaths[event.player ?? 0].clear();
        }
      onTick?.(run, inputs);
    }
    if (ticks) trace.push({ ...segment, ticks });
    if (run.status !== 'running') break;
  }
  return {
    run,
    captures,
    hazards,
    closed,
    segments: trace,
    won:
      row.mode === 'team'
        ? run.status === 'won' && closed.every((n) => n > 0)
        : run.status === 'finished' &&
          run.runs.every((r) => r.status === 'won') &&
          run.winner === null,
  };
}

export function routeDifference(a, b) {
  const count = Math.max(a.captures.length, b.captures.length);
  let differentCaptures = 0,
    maxChangedCells = 0,
    maxChangedTrailCells = 0;
  for (let index = 0; index < count; index++) {
    const first = a.captures[index]?.gained ?? [],
      second = b.captures[index]?.gained ?? [];
    const firstSet = new Set(first),
      secondSet = new Set(second);
    const changed =
      first.filter((cell) => !secondSet.has(cell)).length +
      second.filter((cell) => !firstSet.has(cell)).length;
    if (changed) differentCaptures++;
    maxChangedCells = Math.max(maxChangedCells, changed);
    const aPath = new Set(a.captures[index]?.cutPaths.flat() ?? []);
    const bPath = new Set(b.captures[index]?.cutPaths.flat() ?? []);
    maxChangedTrailCells = Math.max(
      maxChangedTrailCells,
      [...aPath].filter((cell) => !bPath.has(cell)).length +
        [...bPath].filter((cell) => !aPath.has(cell)).length,
    );
  }
  return { differentCaptures, maxChangedCells, maxChangedTrailCells };
}
