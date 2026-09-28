import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalJSON } from '../data-json.mjs';
import {
  CURRICULUM_CAMPAIGNS,
  CURRICULUM_MISSIONS as COMPANY_MISSIONS,
} from '../company-campaigns/curriculum.mjs';
import { createCurriculumProject } from '../company-campaigns/curriculum-content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import {
  COMPANY_ROUTE_EVIDENCE_FORMAT,
  COMPANY_ROUTE_EVENT_TYPES,
  companyCheckpointRuntime,
  companyRouteWitness,
} from '../../scripts/lib/company-route-evidence.mjs';

const projects = new Map(
  CURRICULUM_CAMPAIGNS.map(({ id }) => [
    id,
    compileContentProject(createCurriculumProject({ campaignId: id })),
  ]),
);
const evidence = JSON.parse(
  readFileSync(new URL('fixtures/curriculum-campaign-routes.json', import.meta.url), 'utf8'),
);

test('216 pinned routes win with actual default Journey tuning, objectives and no life loss across both steering policies', () => {
  assert.equal(evidence.format, COMPANY_ROUTE_EVIDENCE_FORMAT);
  assert.equal(evidence.rows.length, 216);
  assert.deepEqual(Object.keys(evidence.checkpointRuntime).sort(), [
    'arch',
    'node',
    'platform',
    'v8',
  ]);
  for (const value of Object.values(evidence.checkpointRuntime))
    assert.equal(typeof value === 'string' && value.length > 0, true);
  const combinations = new Set();
  for (const row of evidence.rows) {
    const mission = COMPANY_MISSIONS.find((entry) => entry.id === row.id);
    assert(mission);
    combinations.add(`${row.id}/${row.difficulty}/${row.turnPolicy}`);
    const manifest = resolveMission(projects.get(mission.campaignId), row.id, {
      difficulty: row.difficulty,
    });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity, row.id);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const tuning = resolveGameplayTuning(row.difficulty);
    assert.deepEqual(row.gameplayTuning ?? null, tuning, `${row.id}: exact default tuning recipe`);
    const level = tuning ? applyGameplayTuning(manifest.level, tuning) : manifest.level;
    const run = createRun(level, options);
    const recorder = createRecorder(level, options);
    const observedEvents = [];
    const closures = [];
    for (const segment of row.segments)
      for (let tick = 0; tick < segment.ticks; tick++) {
        assert.equal(run.status, 'running', `${row.id}: input after finish`);
        const input = { direction: segment.direction };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
        for (const event of run.events)
          if (COMPANY_ROUTE_EVENT_TYPES.has(event.type))
            observedEvents.push([run.tick, event.type, event.id ?? null]);
        if (run.events.some((event) => event.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
      }
    assert.equal(run.status, 'won', `${row.id}/${row.difficulty}/${row.turnPolicy}`);
    assert.equal(run.classic.livesLost, 0, row.id);
    for (const link of manifest.level.relayGates?.gates ?? [])
      assert(
        observedEvents.some((event) => event[1] === 'relay.opened' && event[2] === link.id),
        `${row.id}: required connector actually opened`,
      );
    if (manifest.level.encounter)
      assert(
        observedEvents.some((event) => event[1] === 'encounter.defeated'),
        `${row.id}: shield-core encounter actually released`,
      );
    assert(
      run.objectives
        .filter((objective) => objective.required)
        .every((objective) => objective.captured),
    );
    const label = `${row.id}/${row.difficulty}/${row.turnPolicy}`;
    assert.match(row.checkpoint, /^[a-f0-9]{16}$/, `${label}: diagnostic raw reference`);
    assert.equal(run.tick, row.ticks, label);
    assert.equal(run.lives, row.lives, label);
    assert.equal(run.coverage, row.coverage, label);
    assert.equal(closures.length, row.cuts, label);
    assert.deepEqual(observedEvents, row.events, `${label}: exact discrete event history`);
    assert.deepEqual(closures, row.closures, `${label}: exact capture history`);
    assert.deepEqual(companyRouteWitness(run), row.witness, `${label}: portable outcome and grid`);
    const checkpoint = authoritativeCheckpoint(run);
    if (canonicalJSON(evidence.checkpointRuntime) === canonicalJSON(companyCheckpointRuntime()))
      assert.equal(checkpoint.hash, row.checkpoint, `${label}: recorded runtime reference`);
    const replay = verifyReplay(exportReplay(recorder, run));
    assert.equal(replay.match, true, label);
    assert.deepEqual(replay.actual.checkpoint, checkpoint, `${label}: exact independent replay`);
  }
  assert.equal(combinations.size, 216);
});
