import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

test('only fully owned frozen compiled registries may be reused without recompilation', () => {
  const source = projectFixture(),
    project = compileContentProject(source);
  assert.equal(compileContentProject(project), project);
  assert(Object.isFrozen(project));
  assert(Object.isFrozen(project.source.missions[0].design));
  assert.throws(() => compileContentProject(structuredClone(project)));
  assert.throws(() => compileContentProject({ ...project }));
  source.missions[0].coverage = 0.7;
  const next = compileContentProject(source);
  assert.notEqual(next, project);
  assert.equal(next.missions[0].coverage, 0.7);
  assert.equal(project.missions[0].coverage, 0.6);
});

export function projectFixture() {
  return {
    format: 'ContentProjectV1',
    id: 'horizon-project',
    revision: '1',
    name: 'Horizon authoring',
    policyId: 'journey-v1',
    actorCatalogId: 'journey-actors-v1',
    difficultyCatalogId: 'journey-difficulty-v1',
    maps: [
      {
        format: 'MapDesignV1',
        id: 'shore',
        revision: '1',
        name: 'Shore',
        width: 72,
        height: 36,
        walls: [],
        foundations: [{ x: 30, y: 15, w: 5, h: 5 }],
        terrain: [],
        spawns: [{ id: 'home', x: 32.5, y: 0.5 }],
      },
    ],
    missions: [
      {
        format: 'MissionDesignV1',
        id: 'nearby-shore',
        revision: '1',
        name: 'Nearby shore',
        map: { id: 'shore', revision: '1' },
        spawnId: 'home',
        modes: ['solo', 'versus'],
        actors: [
          {
            id: 'keeper',
            role: 'field-keeper',
            tier: 'measured',
            x: 60.5,
            y: 18.5,
            heading: [1, 1],
          },
        ],
        objectives: [],
        bonuses: [],
        coverage: 0.6,
        timeLimitSeconds: 0,
        design: {
          routeDecision: 'Near island or outer boundary?',
          lesson: 'Foundations close cuts.',
          counterplay: 'Watch the field keeper before departing.',
          captureConsequence: 'The island becomes connected to the perimeter.',
          introduces: ['foundations'],
          practices: ['closure'],
          combines: [],
          memorableMoment: 'The first return lands inside the board.',
          mastery: 'Connect the island in one cut.',
          durationSeconds: [45, 90],
          difficulty: {
            band: 1,
            planning: 1,
            execution: 1,
            threatDensity: 1,
            timePressure: 0,
            mechanicLoad: 1,
            coordination: 0,
          },
        },
        presentation: { themeId: 'horizon', backgroundAssetId: null },
      },
    ],
    campaigns: [
      {
        format: 'CampaignDesignV1',
        id: 'horizon-school',
        revision: '1',
        name: 'Horizon School',
        band: 1,
        missionIds: ['nearby-shore'],
      },
    ],
    packs: [
      {
        format: 'PackDesignV1',
        id: 'journey-opening',
        revision: '1',
        name: 'Opening',
        campaignIds: ['horizon-school'],
      },
    ],
  };
}

test('one project resolves maps, missions, campaign order and packs without hidden rules', () => {
  const source = projectFixture(),
    compiled = compileContentProject(source);
  assert.equal(compiled.missions.length, 1);
  const solo = resolveMission(compiled, 'nearby-shore', { mode: 'solo', difficulty: 'standard' });
  const versus = resolveMission(compiled, 'nearby-shore', {
    mode: 'versus',
    difficulty: 'standard',
  });
  assert.deepEqual(solo.level, versus.level);
  assert.equal(solo.level.version, 'xonix-level.v5');
  assert.equal(solo.level.rules.lives, 3);
  assert.equal(solo.level.rules.moveSpeed, 10);
  assert.equal(solo.level.rules.stopOnCapture, true);
  assert.equal(solo.policyId, 'journey-v1');
  assert.equal(solo.officialProgressEligible, false);
  assert(Object.isFrozen(compiled));
  assert(Object.isFrozen(solo.level));
  assert.throws(() => resolveMission(compiled, 'nearby-shore', { mode: 'team' }), /mode/);
});

test('presets are deterministic with explicit lives and bounded changed dimensions', () => {
  const compiled = compileContentProject(projectFixture());
  const standard = resolveMission(compiled, 'nearby-shore');
  const gentle = resolveMission(compiled, 'nearby-shore', { difficulty: 'gentle' });
  const expert = resolveMission(compiled, 'nearby-shore', { difficulty: 'expert' });
  assert.equal(gentle.level.rules.lives, 5);
  assert.equal(expert.level.rules.lives, 2);
  assert.equal(gentle.level.rules.moveSpeed, standard.level.rules.moveSpeed);
  assert.equal(expert.level.goal.coverage, standard.level.goal.coverage);
  assert.notEqual(standard.simulationIdentity, gentle.simulationIdentity);
  assert.deepEqual(resolveMission(compiled, 'nearby-shore', { difficulty: 'expert' }), expert);
  assert.throws(() => resolveMission(compiled, 'nearby-shore', { difficulty: 'automatic' }));
});

test('campaign titles and ordering cannot change physics identity', () => {
  const first = compileContentProject(projectFixture());
  const changed = projectFixture();
  changed.name = 'Renamed project';
  changed.campaigns[0].name = 'Renamed campaign';
  changed.missions[0].name = 'Renamed mission';
  changed.missions[0].design.lesson = 'Rephrased lesson';
  const second = compileContentProject(changed);
  assert.equal(
    resolveMission(first, 'nearby-shore').simulationIdentity,
    resolveMission(second, 'nearby-shore').simulationIdentity,
  );
});

test('compiler rejects dangling references, hidden physics overrides and false mode compatibility', () => {
  for (const change of [
    (p) => {
      p.missions[0].map.revision = 'unpublished';
    },
    (p) => {
      p.missions[0].rules = { moveSpeed: 20 };
    },
    (p) => {
      p.missions[0].modes.push('team');
    },
    (p) => {
      p.packs[0].campaignIds.push('missing');
    },
    (p) => {
      p.campaigns[0].missionIds.push('missing');
    },
    (p) => {
      p.missions[0].actors[0].speed = 8;
    },
    (p) => {
      p.missions[0].actors[0].tier = 'secret-fast';
    },
    (p) => {
      p.policyId = 'unregistered';
    },
  ]) {
    const source = projectFixture();
    change(source);
    assert.throws(() => compileContentProject(source));
  }
});

test('immutable map revisions resolve exactly and Versus-only candidates compile', () => {
  const source = projectFixture();
  source.maps.push({ ...structuredClone(source.maps[0]), revision: '2', foundations: [] });
  source.missions[0].map.revision = '2';
  source.missions[0].modes = ['versus'];
  const compiled = compileContentProject(source);
  assert.equal(
    resolveMission(compiled, 'nearby-shore', { mode: 'versus' }).level.foundations.length,
    0,
  );
  assert.equal(compiled.maps[0].geometry.foundationCount, 25);
});
