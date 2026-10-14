import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createMultiplayerExpansionCandidates } from '../game/content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../game/coop/core.mjs';
import { dataIdentity } from '../game/data-json.mjs';

// Offline route search. Every candidate and final verification uses ordinary
// public commands. Cloned search branches never alter the final reference run.
// This finds rehearsed clears; it does not certify human balance or host input.
const directions = ['up', 'right', 'down', 'left'];
const command = (direction) => ({ direction, boost: false, support: false });
const key = (run) =>
  (run.environment
    ? `${run.environment.stage}/${run.environment.relays.filter((r) => r.open).length}/`
    : '') +
  run.players.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join('/') +
  `/${Math.round(run.coverage * 1000)}`;
function advance(before, seat, direction, ticks) {
  const run = structuredClone(before),
    log = [],
    closed = [0, 0];
  for (let n = 0; n < ticks && run.status === 'running'; n++) {
    const inputs = run.players.map((p, i) =>
      command(run.needsNeutral[i] ? null : i === seat ? direction : p.direction),
    );
    stepCoop(run, inputs);
    log.push(inputs);
    if (run.events.some((e) => e.type === 'player.downed')) return null;
    for (const e of run.events) if (e.type === 'cut.closed') closed[e.player]++;
    if (closed[seat] || run.players[seat].blockedDirection) break;
  }
  if (key(run) === key(before)) return null;
  return { run, log, closed };
}
function candidates(node, visits) {
  const result = [];
  const targets = node.run.environment
    ? [
        ...node.run.environment.relays.filter((r) => !r.open).map((r) => r.objective),
        ...node.run.environment.stages.slice(
          node.run.environment.stage,
          node.run.environment.stage + 1,
        ),
        ...node.run.environment.emitters.filter((e) => !e.disabled),
      ]
    : [];
  for (const seat of [0, 1])
    for (const direction of directions)
      for (const cells of [
        ...new Set([
          3,
          8,
          15,
          27,
          72,
          ...targets
            .map((t) =>
              Math.abs(
                ['left', 'right'].includes(direction)
                  ? t.x - node.run.players[seat].x
                  : t.y - node.run.players[seat].y,
              ),
            )
            .filter((n) => n > 0.5),
        ]),
      ]) {
        const next = advance(
          node.run,
          seat,
          direction,
          Math.ceil((cells * 120) / node.run.rules.moveSpeed),
        );
        if (!next) continue;
        const closed = node.closed.map((n, i) => n + next.closed[i]);
        if (next.run.status === 'won' && closed.some((n) => n === 0)) continue;
        result.push({
          ...next,
          closed,
          log: [...node.log, ...next.log],
          score:
            (next.run.status === 'won' ? 100000 : 0) +
            next.run.coverage * 10000 -
            targets.reduce(
              (sum, t) =>
                sum +
                Math.min(...next.run.players.map((p) => Math.abs(p.x - t.x) + Math.abs(p.y - t.y))),
              0,
            ) *
              0.1 +
            (next.run.environment?.relays.filter((r) => r.open).length ?? 0) * 600 +
            (next.run.environment?.stage ?? 0) * 700 +
            closed.filter((n) => n > 0).length * 30 -
            (visits.get(key(next.run)) ?? 0) * 10 -
            next.run.tick * 0.002 -
            next.run.players.filter((p) => p.cutting).length * 2,
        });
      }
  return result;
}
function findRoute(level, { steps = 24, width = 6 } = {}) {
  let current = { run: startCoop(createCoop(level, { seed: 17 })), log: [], closed: [0, 0] };
  const initial = [command(null), command(null)];
  stepCoop(current.run, initial);
  current.log.push(initial);
  const visits = new Map();
  for (let iteration = 0; iteration < steps && current.run.status === 'running'; iteration++) {
    visits.set(key(current.run), (visits.get(key(current.run)) ?? 0) + 1);
    const first = candidates({ ...current, log: [] }, visits)
      .sort((a, b) => b.score - a.score)
      .slice(0, width);
    const second = first.flatMap((node) =>
      node.run.status === 'won' ? [node] : candidates(node, visits),
    );
    const best = [...first, ...second].sort((a, b) => b.score - a.score)[0];
    if (!best) break;
    current = { ...best, log: [...current.log, ...best.log] };
  }
  const replay = startCoop(createCoop(level, { seed: 17 }));
  for (const input of current.log) stepCoop(replay, input);
  if (JSON.stringify(replay) !== JSON.stringify(current.run))
    throw new Error('Route replay diverged.');
  const segments = [];
  for (const input of current.log) {
    const [a, b] = input.map((c) => c.direction),
      prior = segments.at(-1);
    if (prior?.a === a && prior?.b === b) prior.ticks++;
    else segments.push({ a, b, ticks: 1 });
  }
  return {
    status: replay.status,
    coverage: replay.coverage,
    tick: replay.tick,
    closed: current.closed,
    segments,
    checkpoint: createHash('sha256').update(JSON.stringify(replay)).digest('hex'),
  };
}

const args = process.argv.slice(2),
  missionId = args[0],
  difficulty = args[1] ?? 'standard',
  output = args[2];
const source = createMultiplayerExpansionCandidates({ mode: 'team' });
const project = compileContentProject(source);
const rows = [];
for (const mission of project.missions.filter(
  (m) =>
    !missionId ||
    (missionId.startsWith('@')
      ? source.campaigns
          .filter((c) =>
            missionId
              .slice(1)
              .split(',')
              .some((chapter) => c.id === 'team-expedition-' + chapter),
          )
          .some((c) => c.missionIds.includes(m.id))
      : missionId.split(',').includes(m.id)),
)) {
  const authored = resolveMission(project, mission.id, { mode: 'team', difficulty }).level;
  const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
  const result = findRoute(level, { steps: Number(args[3] ?? 24), width: Number(args[4] ?? 6) });
  rows.push({
    missionId: mission.id,
    difficulty,
    authoredIdentity: dataIdentity(authored),
    tunedIdentity: dataIdentity(level),
    ...result,
  });
  console.log(
    `${mission.id}/${difficulty}: ${result.status}, ${(result.coverage * 100).toFixed(1)}%, ${(result.tick / 120).toFixed(1)}s, closures ${result.closed.join('/')}`,
  );
}
if (!rows.length) throw new TypeError('Unknown expedition mission.');
if (output)
  await writeFile(
    output,
    JSON.stringify({ kind: 'rehearsed-core-routes-not-human-review', rows }, null, 2) + '\n',
  );
if (rows.some((row) => row.status !== 'won' || row.closed.some((n) => n === 0)))
  process.exitCode = 1;
