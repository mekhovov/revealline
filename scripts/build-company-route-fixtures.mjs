import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { promisify } from 'node:util';
import { COMPANY_MISSIONS } from '../game/company-campaigns/catalog.mjs';
import { createCompanyProject } from '../game/company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createContentExecutionCatalog } from '../game/content-design/execution.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';

import {
  COMPANY_ROUTE_EVIDENCE_FORMAT,
  COMPANY_ROUTE_EVENT_TYPES,
  companyCheckpointRuntime,
  companyRouteWitness,
} from './lib/company-route-evidence.mjs';

const execute = promisify(execFile);
const path = 'game/test/fixtures/company-campaign-routes.json';
const previous = JSON.parse(readFileSync(path, 'utf8')).rows;
const projects = new Map(
  ['coupa', 'droneaid-nl', 'droneaid'].map((brandId) => {
    const source = createCompanyProject({ brandId });
    createContentExecutionCatalog(source);
    return [brandId, compileContentProject(source)];
  }),
);
const difficulties = ['gentle', 'standard', 'expert'];
const policies = ['immediate', 'grid-center'];
const rows = new Map(),
  failures = [];
const jobs = Math.max(
  1,
  Math.min(4, Number(process.argv.find((a) => a.startsWith('--jobs='))?.slice(7) ?? 3)),
);
if (!Number.isInteger(jobs)) throw new Error('Route worker count must be 1..4.');
let cursor = 0;
const key = (id, difficulty, turnPolicy) => `${id}/${difficulty}/${turnPolicy}`;

// Trying an existing input sequence is cheap, but never accepts its claimed
// outcome. Execute the selected new manifest and prove its public replay again.
function replayInputs(candidate, mission, difficulty, turnPolicy) {
  const manifest = resolveMission(projects.get(mission.brandId), mission.id, { difficulty });
  const gameplayTuning = mission.brandId === 'droneaid' ? null : resolveGameplayTuning(difficulty);
  const level = gameplayTuning
    ? applyGameplayTuning(manifest.level, gameplayTuning)
    : manifest.level;
  const options = { seed: 1, classId: 'scout', turnPolicy },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  const segments = [],
    events = [],
    closures = [];
  for (const segment of candidate.segments) {
    let ticks = 0;
    for (; ticks < segment.ticks && run.status === 'running' && !run.classic.livesLost; ticks++) {
      const input = { direction: segment.direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
      for (const event of run.events)
        if (COMPANY_ROUTE_EVENT_TYPES.has(event.type))
          events.push([run.tick, event.type, event.id ?? null]);
      if (run.events.some((event) => event.type === 'cut.closed'))
        closures.push([run.tick, run.coverage]);
    }
    if (ticks) segments.push({ direction: segment.direction, ticks });
    if (run.status !== 'running' || run.classic.livesLost) break;
  }
  if (run.status !== 'won' || run.classic.livesLost) return null;
  if (!verifyReplay(exportReplay(recorder, run)).match)
    throw new Error(`Public replay mismatch: ${mission.id}`);
  return {
    id: mission.id,
    difficulty,
    turnPolicy,
    delaySeconds: 0,
    seed: 1,
    status: run.status,
    simulationIdentity: manifest.simulationIdentity,
    ...(gameplayTuning ? { gameplayTuning } : {}),
    ticks: run.tick,
    lives: run.lives,
    coverage: run.coverage,
    cuts: closures.length,
    proofMethod: 're-executed-input-sequence',
    checkpoint: authoritativeCheckpoint(run).hash,
    witness: companyRouteWitness(run),
    events,
    closures,
    segments,
  };
}
function persist() {
  const ordered = COMPANY_MISSIONS.flatMap((mission) =>
    difficulties.flatMap((difficulty) =>
      policies
        .map((turnPolicy) => rows.get(key(mission.id, difficulty, turnPolicy)))
        .filter(Boolean),
    ),
  );
  writeFileSync(
    `${path}.tmp`,
    `${JSON.stringify({ format: COMPANY_ROUTE_EVIDENCE_FORMAT, checkpointRuntime: companyCheckpointRuntime(), evidence: 'Offline omniscient feasibility search and re-executed input sequences. Not human pacing, accessibility, or enjoyment evidence.', seed: 1, rows: ordered }, null, 2)}\n`,
  );
  renameSync(`${path}.tmp`, path);
}
async function worker() {
  while (cursor < COMPANY_MISSIONS.length) {
    const mission = COMPANY_MISSIONS[cursor++];
    const pool = previous.filter((row) => row.id === mission.id);
    for (const difficulty of difficulties)
      for (const turnPolicy of policies) {
        let row = null;
        const attempts = [...pool].sort(
          (a, b) =>
            Number(b.difficulty === difficulty) * 2 +
            Number(b.turnPolicy === turnPolicy) -
            Number(a.difficulty === difficulty) * 2 -
            Number(a.turnPolicy === turnPolicy),
        );
        for (const candidate of attempts) {
          row = replayInputs(candidate, mission, difficulty, turnPolicy);
          if (row) break;
        }
        if (!row) {
          for (const options of [['--no-wait'], [], ['--bent']]) {
            const { stdout } = await execute(
              process.execPath,
              [
                'scripts/qualify-company-route.mjs',
                mission.id,
                difficulty,
                turnPolicy,
                ...options,
                '--max-ms=20000',
              ],
              { maxBuffer: 4 * 1024 * 1024 },
            );
            const candidate = JSON.parse(stdout);
            if (candidate.status === 'won') {
              row = replayInputs(candidate, mission, difficulty, turnPolicy);
              break;
            }
          }
        }
        if (!row) {
          failures.push(key(mission.id, difficulty, turnPolicy));
          console.error(`UNPROVEN ${failures.at(-1)}`);
          continue;
        }
        rows.set(key(mission.id, difficulty, turnPolicy), row);
        pool.unshift(row);
        persist();
        console.log(
          `${rows.size}/${COMPANY_MISSIONS.length * 6} ${mission.id} ${difficulty} ${turnPolicy}: ${row.ticks} ticks`,
        );
      }
  }
}
if (process.argv.includes('--witness-only')) {
  // A bounded evidence migration, never a route search or outcome rewrite.
  // Run on the original reference runtime: every raw hash must still match.
  for (const candidate of previous) {
    const mission = COMPANY_MISSIONS.find((entry) => entry.id === candidate.id);
    assert(mission, `Unknown existing route: ${candidate.id}`);
    const proven = replayInputs(candidate, mission, candidate.difficulty, candidate.turnPolicy);
    assert(proven, `Existing route no longer wins: ${candidate.id}`);
    for (const field of [
      'simulationIdentity',
      'gameplayTuning',
      'ticks',
      'lives',
      'coverage',
      'cuts',
      'checkpoint',
      'events',
      'closures',
      'segments',
    ])
      assert.deepEqual(proven[field], candidate[field], `${candidate.id}: unchanged ${field}`);
    rows.set(key(candidate.id, candidate.difficulty, candidate.turnPolicy), {
      ...candidate,
      witness: proven.witness,
    });
  }
  assert.equal(rows.size, COMPANY_MISSIONS.length * difficulties.length * policies.length);
  persist();
  console.log(`Added portable witnesses to ${rows.size} unchanged route references.`);
} else {
  await Promise.all(Array.from({ length: jobs }, worker));
  if (failures.length) throw new Error(`Unproven routes: ${failures.join(', ')}`);
}
