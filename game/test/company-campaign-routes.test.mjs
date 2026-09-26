import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { COMPANY_CAMPAIGNS, COMPANY_MISSIONS } from '../company-campaigns/catalog.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { createCompanyProject, createCompanyJourneyRoute } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const projects = new Map(
  ['coupa', 'droneaid', 'droneaid-nl'].map((brandId) => [
    brandId,
    compileContentProject(createCompanyProject({ brandId })),
  ]),
);
const evidence = JSON.parse(
  readFileSync(new URL('fixtures/company-campaign-routes.json', import.meta.url), 'utf8'),
);

test('66 current company missions and the historical three-mission pilot have distinct authored topologies', () => {
  assert.equal(COMPANY_MISSIONS.length, 69);
  assert.deepEqual(
    COMPANY_CAMPAIGNS.map((campaign) => campaign.missionIds.length),
    [6, 6, 6, 6, 6, 3, 6, 6, 6, 6, 6, 6],
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
  assert.equal(topologies.size, 69);
  assert.equal(simulations.size, 69);
  for (const mission of COMPANY_MISSIONS)
    assert.equal(
      COMPANY_LESSONS.find((lesson) => lesson.missionId === mission.id)?.id ?? null,
      mission.lessonId,
    );
});

test('414 pinned routes win with actual default Journey tuning, objectives and no life loss across both steering policies', () => {
  assert.equal(evidence.rows.length, 414);
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
    const tuning = mission.brandId === 'droneaid' ? null : resolveGameplayTuning(row.difficulty);
    assert.deepEqual(row.gameplayTuning ?? null, tuning, `${row.id}: exact default tuning recipe`);
    const level = tuning ? applyGameplayTuning(manifest.level, tuning) : manifest.level;
    const run = createRun(level, options);
    const recorder = createRecorder(level, options);
    const observedEvents = [];
    for (const segment of row.segments)
      for (let tick = 0; tick < segment.ticks; tick++) {
        assert.equal(run.status, 'running', `${row.id}: input after finish`);
        const input = { direction: segment.direction };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
        for (const event of run.events)
          if (event.type === 'relay.opened' || event.type === 'encounter.defeated')
            observedEvents.push({ type: event.type, id: event.id });
      }
    assert.equal(run.status, 'won', `${row.id}/${row.difficulty}/${row.turnPolicy}`);
    assert.equal(run.classic.livesLost, 0, row.id);
    for (const link of manifest.level.relayGates?.gates ?? [])
      assert(
        observedEvents.some((event) => event.type === 'relay.opened' && event.id === link.id),
        `${row.id}: required connector actually opened`,
      );
    if (manifest.level.encounter)
      assert(
        observedEvents.some((event) => event.type === 'encounter.defeated'),
        `${row.id}: shield-core encounter actually released`,
      );
    assert(
      run.objectives
        .filter((objective) => objective.required)
        .every((objective) => objective.captured),
    );
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint, row.id);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, row.id);
  }
  assert.equal(combinations.size, 414);
});

test('current company campaigns progress through real main Journey mechanics and their stated challenge bands', () => {
  const expected = { coupa: [1, 4, 6, 8, 11], 'droneaid-nl': [1, 3, 5, 7, 9, 11] };
  for (const [brandId, bands] of Object.entries(expected)) {
    const project = projects.get(brandId);
    const executions = createContentExecutionCatalog(project.source);
    assert.equal(executions.entries.length, bands.length * 3);
    assert(
      executions.entries.every(
        (entry) => new Set(entry.campaign.levels.map((level) => level.version)).size === 1,
      ),
    );
    assert.deepEqual(
      project.campaigns.map((campaign) => campaign.band),
      bands,
    );
    const roles = new Set(
      project.missions.flatMap((mission) => mission.actors.map((actor) => actor.role)),
    );
    for (const role of [
      'field-keeper',
      'frontier-patrol',
      'reclaimed-roamer',
      'territory-eroder',
      'trail-pursuer',
      'heading-interceptor',
      'lane-emitter',
      'relay-sentinel',
    ])
      assert(roles.has(role), `${brandId}: ${role} has a real engine actor`);
    for (const campaign of project.campaigns) {
      const missions = campaign.missionIds.map((id) =>
        project.missions.find((mission) => mission.id === id),
      );
      assert(missions.every((mission) => mission.design.introduces.length <= 1));
      assert(
        missions.slice(0, 3).every((mission) => mission.design.difficulty.band === campaign.band),
      );
      assert(
        missions.slice(3).every((mission) => mission.design.difficulty.band === campaign.band + 1),
      );
    }
    const last = project.missions.at(-1);
    assert.equal(last.format, 'MissionDesignV4');
    assert.equal(last.encounter.recipeId, 'shield-relays-v1');
    assert.equal(last.encounter.shieldObjectiveIds.length, 2);
    assert.equal(last.relayLinks.length, 2);
    const map = project.maps.find((item) => item.source.id === last.map.id).source;
    assert.equal(map.speedZones.length, 2);
    assert(map.gates.every((gate) => Math.max(gate.w, gate.h) >= 3));
    assert.match(last.design.routeDecision, /shield relays/);
    assert.match(last.design.counterplay, /CORE OPEN/);
    assert.match(last.design.counterplay, /connector/);
    assert.match(last.design.counterplay, /Arrows/);
  }
});

test('current missions pin the canonical Journey catalogs; historical pilot retains its original policy', () => {
  for (const brandId of ['coupa', 'droneaid-nl']) {
    const source = createCompanyProject({ brandId });
    assert.equal(source.policyId, 'journey-trail-impact-v3');
    assert.equal(source.actorCatalogId, 'journey-actors-v9');
    assert.equal(source.difficultyCatalogId, 'journey-difficulty-v2');
    assert(
      source.missions.every(
        (mission) =>
          mission.presentation.themeId ===
          `${COMPANY_MISSIONS.find((m) => m.id === mission.id).campaignId}-theme`,
      ),
    );
  }
  const historical = createCompanyProject({ brandId: 'droneaid' });
  assert.equal(historical.policyId, 'journey-arcade-v2');
  assert.equal(historical.actorCatalogId, 'journey-actors-v1');
  assert.equal(historical.difficultyCatalogId, 'journey-difficulty-v1');
});

test('the historical Portuguese pilot remains byte-identical in canonical source form', () => {
  const artwork = JSON.parse(
    readFileSync(new URL('../editions/artwork.json', import.meta.url), 'utf8'),
  );
  const historical = createCompanyProject({
    brandId: 'droneaid',
    campaignId: 'droneaid-community-relay',
    artwork,
  });
  // Frozen before the Netherlands addition; includes all three authored maps,
  // mission/policy pins, original artwork revisions and campaign metadata.
  assert.equal(
    createHash('sha256').update(canonicalJSON(historical)).digest('hex'),
    'ca06064820c5c7392238f4f6d5c7f8360799938e283fd552adb3c2aab89e0c4c',
  );
});
