import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpatialNextBatchCandidates,
  SPATIAL_NEXT_BATCH_SELECTIONS,
} from '../content-design/spatial-next-batch-candidates.mjs';
import { createWholeErosionReviewCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const ids = SPATIAL_NEXT_BATCH_SELECTIONS.map((item) => item.id);
const difficulties = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];
const allowedCollisionRoles = new Set(['field-keeper', 'frontier-patrol', 'perimeter-patrol']);
const alreadyOwnedByOpenSpatialPRs = new Set([
  'two-bays',
  'neon-remix',
  'broken-yard',
  'read-the-arrows',
  'twin-receivers',
  'crossing-complete',
  'cross-stitch-crossings',
  'rushnyk-bands',
  'pysanka-sections',
  'four-motor-landings',
  'circuit-lanes',
  'twin-lens-chambers',
  'toolbench-weave',
  'dnipro-crossings',
  'two-districts',
  'two-ways-home',
  'second-approach',
  'windbreak-weave',
]);

const source = createSpatialNextBatchCandidates();
const project = compileContentProject(source);
const originalSource = createWholeErosionReviewCandidates();
const original = compileContentProject(originalSource);

test('the bounded disposition selects exactly three non-overlapping existing identities', () => {
  assert.deepEqual(ids, ['stepping-stones', 'four-quarters', 'survey-markers']);
  assert.equal(new Set(ids).size, 3);
  assert(ids.every((id) => original.missions.some((mission) => mission.id === id)));
  assert(ids.every((id) => !alreadyOwnedByOpenSpatialPRs.has(id)));
  assert.deepEqual(
    SPATIAL_NEXT_BATCH_SELECTIONS.map((item) => item.disposition),
    [
      'early-foundation-route-fork',
      'original-stepped-woven-band-study',
      'offset-flight-controller-trace-study',
    ],
  );
  assert.match(SPATIAL_NEXT_BATCH_SELECTIONS[1].visualStudy, /no-copied-pattern$/);
  assert.match(SPATIAL_NEXT_BATCH_SELECTIONS[2].visualStudy, /no-copied-component-layout$/);
});

for (const artwork of [false, true])
  test(`three-map successor is copy-on-write and preserves every other mission: artwork=${artwork}`, () => {
    const before = createWholeErosionReviewCandidates({ artwork });
    const snapshot = structuredClone(before);
    const next = createSpatialNextBatchCandidates({ artwork });
    assert.deepEqual(createWholeErosionReviewCandidates({ artwork }), snapshot);
    assert.equal(next.revision, 'spatial-next-draft-1');
    assert.equal(next.policyId, before.policyId);
    assert.equal(next.actorCatalogId, before.actorCatalogId);
    assert.equal(next.difficultyCatalogId, before.difficultyCatalogId);
    assert.equal(next.missions.length, before.missions.length);
    assert.equal(next.maps.length, before.maps.length);
    assert.deepEqual(next.assets, before.assets);

    for (const mission of next.missions) {
      const priorMission = before.missions.find((item) => item.id === mission.id);
      if (!ids.includes(mission.id)) {
        assert.deepEqual(mission, priorMission);
        continue;
      }
      assert.equal(mission.revision, 'spatial-next-draft-1');
      for (const key of [
        'format',
        'id',
        'name',
        'spawnId',
        'modes',
        'actors',
        'objectives',
        'bonuses',
        'timedBonuses',
        'coverage',
        'timeLimitSeconds',
        'presentation',
      ])
        assert.deepEqual(mission[key], priorMission[key], `${mission.id}/${key}`);
      assert.deepEqual(mission.design.difficulty, priorMission.design.difficulty);
      assert.deepEqual(mission.design.introduces, priorMission.design.introduces);
      assert.deepEqual(mission.design.practices, priorMission.design.practices);

      const priorMap = before.maps.find(
        (item) => item.id === priorMission.map.id && item.revision === priorMission.map.revision,
      );
      const nextMap = next.maps.find(
        (item) => item.id === mission.map.id && item.revision === mission.map.revision,
      );
      for (const key of ['format', 'id', 'name', 'width', 'height', 'terrain', 'spawns'])
        assert.deepEqual(nextMap[key], priorMap[key], `${mission.id}/map/${key}`);
      for (const key of ['gates', 'speedZones'])
        if (Object.hasOwn(priorMap, key))
          assert.deepEqual(nextMap[key], priorMap[key], `${mission.id}/map/${key}`);
    }

    next.maps.find((map) => map.id === 'four-quarters-map').walls.length = 0;
    assert.deepEqual(createWholeErosionReviewCandidates({ artwork }), snapshot);
  });

test('all presets and both modes retain current scaling, actors, objectives and rules', () => {
  for (const id of ids) {
    const mission = project.missions.find((item) => item.id === id);
    assert(mission.actors.every((actor) => allowedCollisionRoles.has(actor.role)));
    assert(
      !mission.actors.some((actor) => /pursuer|interceptor|emitter|eroder|roamer/.test(actor.role)),
    );
    for (const difficulty of difficulties) {
      const prior = resolveMission(original, id, { difficulty });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(solo.level.rules, prior.level.rules, `${id}/${difficulty}/rules`);
      assert.deepEqual(solo.level.enemies, prior.level.enemies, `${id}/${difficulty}/enemies`);
      assert.deepEqual(
        solo.level.objectives,
        prior.level.objectives,
        `${id}/${difficulty}/objectives`,
      );
      assert.deepEqual(solo.level.timedBonuses, prior.level.timedBonuses);
      assert.deepEqual(versus.level, solo.level, `${id}/${difficulty}/mode parity`);
      assert.equal(solo.officialProgressEligible, false);
    }
  }
});

test('geometry keeps genuine returns, open fields and a keeper in every Four quarters region', () => {
  for (const id of ids) {
    const mission = project.missions.find((item) => item.id === id);
    const map = project.maps.find((item) => item.source.id === mission.map.id);
    assert(map.geometry.safeComponents.every((component) => component.departures.length >= 4));
    assert(map.geometry.diagnostics.every((item) => item.code === 'disconnected-foundations'));
    const manifest = resolveMission(project, id, { difficulty: 'standard' });
    const regions = inspectCaptureSnapshot(createRun(manifest.level, { seed: 1 })).components;
    assert(regions.every((region) => region.cells.length > 0));
    if (id === 'four-quarters') {
      const keepers = new Set(
        mission.actors.filter((actor) => actor.role === 'field-keeper').map((actor) => actor.id),
      );
      assert.equal(regions.length, 4);
      assert(regions.every((region) => region.enemyIds.some((enemyId) => keepers.has(enemyId))));
    } else assert.equal(regions.length, 1);
  }
});

for (const id of ids)
  for (const difficulty of difficulties)
    test(`${id} has no unavoidable idle collision at ${difficulty}`, () => {
      const manifest = resolveMission(project, id, { difficulty });
      const run = createRun(manifest.level, { seed: 1, classId: 'scout' });
      for (let tick = 0; tick < 1200; tick++) stepRun(run, { direction: null }, FIXED_DT);
      assert.equal(run.status, 'running');
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.claimedCount, 0);
    });

const approaches = {
  'stepping-stones': {
    upper: {
      immediate: [
        ['right', 210],
        ['down', 78],
      ],
      'grid-center': [
        ['right', 216],
        ['down', 78],
      ],
    },
    lower: {
      immediate: [
        ['right', 288],
        ['down', 270],
      ],
      'grid-center': [
        ['right', 288],
        ['down', 270],
      ],
    },
  },
  'four-quarters': {
    upper: {
      immediate: [
        ['left', 30],
        ['up', 198],
      ],
      'grid-center': [
        ['left', 36],
        ['up', 198],
      ],
    },
    lower: {
      immediate: [
        ['right', 252],
        ['down', 210],
      ],
      'grid-center': [
        ['right', 252],
        ['down', 210],
      ],
    },
  },
  'survey-markers': {
    north: { immediate: [['up', 117]], 'grid-center': [['up', 117]] },
    west: { immediate: [['left', 208]], 'grid-center': [['left', 208]] },
  },
};

for (const [id, choices] of Object.entries(approaches))
  for (const [approach, byControl] of Object.entries(choices))
    for (const difficulty of difficulties)
      for (const turnPolicy of controls)
        test(`${id} ${approach} is a no-loss Solo/replay and equal Versus opening: ${difficulty}/${turnPolicy}`, () => {
          const manifest = resolveMission(project, id, { difficulty });
          const options = { seed: 1, classId: 'scout', turnPolicy };
          const run = createRun(manifest.level, options);
          const recorder = createRecorder(manifest.level, options);
          const match = createDuel(manifest.level, options, {
            protocol: UNTIMED_DUEL_PROTOCOL,
            seconds: 0,
          });
          resumeDuel(match);
          const closures = [];
          for (const [direction, ticks] of byControl[turnPolicy])
            for (let tick = 0; tick < ticks; tick++) {
              assert.equal(run.status, 'running');
              assert.equal(match.status, 'running');
              const claimed = run.claimedCount;
              recordInput(recorder, { direction });
              stepRun(run, { direction }, FIXED_DT);
              stepDuel(match, [{ direction }, { direction }]);
              assert.equal(run.classic.livesLost, 0);
              if (run.events.some((event) => event.type === 'cut.closed'))
                closures.push(run.claimedCount - claimed);
            }
          assert.equal(run.status, 'running');
          assert.equal(run.player.cutting, false);
          assert.equal(run.player.speed, 0);
          assert.equal(closures.length, 1);
          assert(closures[0] > 0);
          assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
          assert(match.runs.every((candidate) => candidate.classic.livesLost === 0));
          assert.deepEqual(
            authoritativeCheckpoint(match.runs[0]),
            authoritativeCheckpoint(match.runs[1]),
          );
        });
