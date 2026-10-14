import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDuelExpansionCandidates } from '../game/content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../game/multiplayer.mjs';
import { dataIdentity } from '../game/data-json.mjs';

// Reproduce ordinary-input routes across each real difficulty and steering
// projection. Reusing a route never reuses its result or native-state hash.
const directory = process.argv[2] ?? '.cache/multiplayer-expansion';
const output = process.argv[3] ?? directory;
const candidates = new Map();
for (const file of (await readdir(directory)).filter((name) => /^duel-.*\.json$/.test(name))) {
  const proof = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
  for (const row of proof.rows.filter((row) => row.status === 'won')) {
    const routes = candidates.get(row.missionId) ?? new Map();
    routes.set(JSON.stringify([row.difficulty, row.options.turnPolicy, row.segments]), row);
    candidates.set(row.missionId, routes);
  }
}
const project = compileContentProject(createDuelExpansionCandidates());
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const rows = [],
      missing = [];
    for (const mission of project.missions) {
      const authored = resolveMission(project, mission.id, { mode: 'versus', difficulty }).level;
      const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
      const options = { seed: 17, classId: 'scout', turnPolicy };
      let result;
      const priority = (row) =>
        Number(row.difficulty === difficulty) * 2 + Number(row.options.turnPolicy === turnPolicy);
      const choices = [...(candidates.get(mission.id)?.values() ?? [])].sort(
        (a, b) => priority(b) - priority(a),
      );
      for (const { segments } of choices) {
        const match = createDuel(level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
        resumeDuel(match);
        const accepted = [];
        for (const segment of segments) {
          let ticks = 0;
          const input = {
            direction: segment.direction,
            boost: false,
            action: false,
            pickup: false,
          };
          while (ticks < segment.ticks && match.status === 'running') {
            stepDuel(match, [input, input]);
            ticks++;
          }
          if (ticks) accepted.push({ direction: segment.direction, ticks });
          if (match.status !== 'running') break;
        }
        if (
          match.runs[0].status === 'won' &&
          match.runs[1].status === 'won' &&
          match.winner === null &&
          match.reason === 'First clear'
        ) {
          result = {
            missionId: mission.id,
            difficulty,
            options,
            authoredIdentity: dataIdentity(authored),
            tunedIdentity: dataIdentity(level),
            status: 'won',
            coverage: match.runs[0].coverage,
            tick: match.tick,
            winner: match.winner,
            reason: match.reason,
            segments: accepted,
            checkpoint: createHash('sha256').update(JSON.stringify(match)).digest('hex'),
          };
          break;
        }
      }
      if (result) rows.push(result);
      else missing.push(mission.id);
    }
    const prefix = path.join(output, `duel-replayed-${difficulty}-${turnPolicy}`);
    await writeFile(
      `${prefix}.json`,
      JSON.stringify({ kind: 'rehearsed-duel-routes-not-human-review', rows }, null, 2) + '\n',
    );
    await writeFile(`${prefix}-missing.txt`, missing.join(',') + '\n');
    console.log(`${difficulty}/${turnPolicy}: ${rows.length}/72; missing ${missing.join(',')}`);
  }
