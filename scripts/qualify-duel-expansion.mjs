import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createMultiplayerExpansionCandidates } from '../game/content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../game/multiplayer.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import { authoritativeCheckpoint } from '../game/replay.mjs';

// Search the actual two-board untimed protocol. Clones are planning branches;
// all retained evidence is reproduced from a fresh match with ordinary input.
const protocol = { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 };
const command = (direction) => ({ direction, boost: false, action: false, pickup: false });
const key = (match) => {
  const r = match.runs[0];
  return `${Math.round(r.player.x)},${Math.round(r.player.y)}/${Math.round(r.coverage * 1000)}/${r.objectives.map((o) => Number(o.captured)).join('')}/${r.encounter?.stage}/${r.encounter?.phase}`;
};
function advance(before, direction, ticks) {
  const match = structuredClone(before),
    log = [];
  for (let i = 0; i < ticks && match.status === 'running'; i++) {
    const input = command(direction);
    stepDuel(match, [input, input]);
    log.push(input);
    const r = match.runs[0];
    if (r.lives < before.runs[0].lives || r.status === 'lost') return null;
    if (r.events.some((e) => e.type === 'cut.closed') || (direction && r.player.speed === 0)) break;
  }
  return key(match) === key(before) ? null : { match, log };
}
function candidates(node, visits) {
  const result = [],
    r = node.match.runs[0],
    targets = r.objectives.filter((o) => !o.captured);
  for (const direction of [null, 'up', 'right', 'down', 'left']) {
    const spans = direction
      ? [
          3,
          8,
          15,
          27,
          72,
          ...targets
            .map((t) =>
              Math.abs(['left', 'right'].includes(direction) ? t.x - r.player.x : t.y - r.player.y),
            )
            .filter((n) => n > 0.5),
        ]
      : [r.rules.moveSpeed, 3 * r.rules.moveSpeed];
    for (const cells of new Set(spans)) {
      const next = advance(
        node.match,
        direction,
        Math.ceil((cells * 120) / (r.rules.moveSpeed * (r.classRecipe.moveSpeedMultiplier ?? 1))),
      );
      if (!next) continue;
      const state = next.match.runs[0];
      result.push({
        ...next,
        log: [...node.log, ...next.log],
        score:
          (state.status === 'won' ? 100000 : 0) +
          state.coverage * 10000 +
          state.objectives.filter((o) => o.captured).length * 1500 +
          (state.encounter?.stage === 'exposed' ? 1000 : 0) +
          (state.encounter?.defeated ? 3000 : 0) -
          next.match.tick * 0.002 -
          (visits.get(key(next.match)) ?? 0) * 30 -
          targets.reduce(
            (n, t) => n + Math.abs(state.player.x - t.x) + Math.abs(state.player.y - t.y),
            0,
          ) *
            0.1,
      });
    }
  }
  return result;
}
function find(level, options, steps, width) {
  const match = createDuel(level, options, protocol);
  resumeDuel(match);
  let current = { match, log: [] };
  const visits = new Map();
  const alternatives = [],
    rejected = new Set();
  for (let i = 0; i < steps && current.match.status === 'running'; i++) {
    visits.set(key(current.match), (visits.get(key(current.match)) ?? 0) + 1);
    const first = candidates({ ...current, log: [] }, visits)
      .sort((a, b) => b.score - a.score)
      .slice(0, width);
    const second = first.flatMap((n) =>
      n.match.status === 'finished' ? [n] : candidates(n, visits),
    );
    const ranked = [...first, ...second]
      .filter((node) => !rejected.has(key(node.match)))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || (visits.get(key(current.match)) ?? 0) > 4) {
      rejected.add(key(current.match));
      while (alternatives.length && rejected.has(key(alternatives.at(-1).match)))
        alternatives.pop();
      if (!alternatives.length) break;
      current = alternatives.pop();
      continue;
    }
    for (const other of ranked.slice(1, 5).reverse())
      alternatives.push({ ...other, log: [...current.log, ...other.log] });
    if (alternatives.length > 100) alternatives.splice(0, alternatives.length - 100);
    current = { ...best, log: [...current.log, ...best.log] };
  }
  const replay = createDuel(level, options, protocol);
  resumeDuel(replay);
  for (const input of current.log) stepDuel(replay, [input, input]);
  if (JSON.stringify(replay) !== JSON.stringify(current.match))
    throw new Error('Duel replay diverged.');
  if (
    JSON.stringify(authoritativeCheckpoint(replay.runs[0])) !==
    JSON.stringify(authoritativeCheckpoint(replay.runs[1]))
  )
    throw new Error('Equal-input boards diverged.');
  const segments = [];
  for (const input of current.log) {
    const p = segments.at(-1);
    if (p?.direction === input.direction) p.ticks++;
    else segments.push({ direction: input.direction, ticks: 1 });
  }
  return {
    status: replay.runs[0].status,
    coverage: replay.runs[0].coverage,
    tick: replay.tick,
    winner: replay.winner,
    reason: replay.reason,
    segments,
    checkpoint: createHash('sha256').update(JSON.stringify(replay)).digest('hex'),
  };
}
const [
  filter,
  difficulty = 'standard',
  turnPolicy = 'immediate',
  output,
  steps = '48',
  width = '6',
] = process.argv.slice(2);
const project = compileContentProject(createMultiplayerExpansionCandidates({ mode: 'versus' }));
const rows = [];
for (const mission of project.missions.filter(
  (m) => !filter || filter === 'all' || filter.split(',').includes(m.id),
)) {
  const authored = resolveMission(project, mission.id, { mode: 'versus', difficulty }).level;
  const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
  const options = { seed: 17, classId: 'scout', turnPolicy };
  const result = find(level, options, Number(steps), Number(width));
  rows.push({
    missionId: mission.id,
    difficulty,
    options,
    authoredIdentity: dataIdentity(authored),
    tunedIdentity: dataIdentity(level),
    ...result,
  });
  console.log(
    `${mission.id}/${difficulty}/${turnPolicy}: ${result.status}, ${(result.coverage * 100).toFixed(1)}%, ${(result.tick / 120).toFixed(1)}s`,
  );
  if (output)
    await writeFile(
      output,
      JSON.stringify({ kind: 'rehearsed-duel-routes-not-human-review', rows }, null, 2) + '\n',
    );
}
if (!rows.length) throw new TypeError('Unknown expedition mission.');
if (rows.some((r) => r.status !== 'won' || r.winner !== null || r.reason !== 'First clear'))
  process.exitCode = 1;
