import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPANY_CAMPAIGNS, COMPANY_MISSIONS } from '../company-campaigns/catalog.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { createCompanyProject, createCompanyJourneyRoute } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const projects = new Map(
  ['coupa', 'droneaid'].map((brandId) => [
    brandId,
    compileContentProject(createCompanyProject({ brandId })),
  ]),
);
const evidence = JSON.parse(
  readFileSync(new URL('fixtures/company-campaign-routes.json', import.meta.url), 'utf8'),
);

test('five six-mission Coupa campaigns and a separate DroneAid pilot have distinct authored topologies', () => {
  assert.equal(COMPANY_MISSIONS.length, 33);
  assert.deepEqual(
    COMPANY_CAMPAIGNS.map((campaign) => campaign.missionIds.length),
    [6, 6, 6, 6, 6, 3],
  );
  const topologies = new Set();
  const simulations = new Set();
  for (const campaign of COMPANY_CAMPAIGNS) {
    const source = createCompanyProject({ brandId: campaign.brandId, campaignId: campaign.id });
    assert.equal(source.campaigns.length, 1);
    assert.deepEqual(source.campaigns[0].missionIds, campaign.missionIds);
    assert(source.missions.every((mission) => mission.id.startsWith(campaign.id)));
    const route = createCompanyJourneyRoute({ brandId: campaign.brandId, campaignId: campaign.id });
    assert.deepEqual(route.optionalCampaignIds, []);
    for (const map of source.maps)
      topologies.add(
        JSON.stringify({ walls: map.walls, foundations: map.foundations, terrain: map.terrain }),
      );
    for (const mission of source.missions) {
      assert.deepEqual(mission.modes, ['solo']);
      simulations.add(
        resolveMission(projects.get(campaign.brandId), mission.id).simulationIdentity,
      );
    }
  }
  assert.equal(topologies.size, 33);
  assert.equal(simulations.size, 33);
  for (const mission of COMPANY_MISSIONS)
    assert.equal(
      COMPANY_LESSONS.find((lesson) => lesson.missionId === mission.id)?.id ?? null,
      mission.lessonId,
    );
});

test('198 pinned routes win from real input with objectives and no life loss, including both steering policies', () => {
  assert.equal(evidence.rows.length, 198);
  const combinations = new Set();
  for (const row of evidence.rows) {
    const mission = COMPANY_MISSIONS.find((entry) => entry.id === row.id);
    assert(mission);
    combinations.add(`${row.id}/${row.difficulty}/${row.turnPolicy}`);
    const manifest = resolveMission(projects.get(mission.brandId), row.id, {
      difficulty: row.difficulty,
    });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity, row.id);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options);
    const recorder = createRecorder(manifest.level, options);
    for (const segment of row.segments)
      for (let tick = 0; tick < segment.ticks; tick++) {
        assert.equal(run.status, 'running', `${row.id}: input after finish`);
        const input = { direction: segment.direction };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
      }
    assert.equal(run.status, 'won', `${row.id}/${row.difficulty}/${row.turnPolicy}`);
    assert.equal(run.classic.livesLost, 0, row.id);
    assert(
      run.objectives
        .filter((objective) => objective.required)
        .every((objective) => objective.captured),
    );
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint, row.id);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, row.id);
  }
  assert.equal(combinations.size, 198);
});
