import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createNeonCandidates,
  NEON_ARCS,
  NEON_FIRST_RETURNS,
  NEON_REFERENCE_ADAPTATIONS,
} from '../content-design/neon-candidates.mjs';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { ACTOR_CATALOG } from '../content-design/catalogs.mjs';

const source = createNeonCandidates(),
  project = compileContentProject(source);
test('Neon deepens known spatial rules in two arcs without a speed reset or automatic Team substitution', () => {
  assert.equal(source.missions.length, 7);
  assert.equal(NEON_ARCS.length, 2);
  assert.equal(
    source.missions[0].design.difficulty.band,
    createSignalCandidates().missions.at(-2).design.difficulty.band,
  );
  let band = 4;
  for (const arc of NEON_ARCS) {
    assert.equal(arc.missionIds.length, 3);
    assert.equal(arc.introduces, null);
  }
  const geometries = new Set();
  for (const mission of source.missions) {
    assert.deepEqual(mission.design.introduces, []);
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.deepEqual(mission.modes, ['solo', 'versus']);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert.equal(
      mission.design.combines.includes('perimeter-patrol'),
      mission.actors.some((actor) => actor.role === 'perimeter-patrol'),
      `${mission.id}: authored combinations match actual perimeter threats`,
    );
    assert(
      mission.actors.every(
        (actor) => actor.tier === 'measured' && Object.hasOwn(ACTOR_CATALOG.roles, actor.role),
      ),
    );
    const map = project.maps.find((map) => map.source.id === mission.map.id);
    assert.match(map.geometryIdentity, /^[a-f0-9]{16}$/);
    geometries.add(map.geometryIdentity);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of mission.modes) {
        const manifest = resolveMission(project, mission.id, { difficulty, mode });
        assert.equal(manifest.level.rules.moveSpeed, 10);
        assert.equal(manifest.officialProgressEligible, false);
        assert(
          !manifest.diagnostics.some((d) => d.severity === 'error' || /auto-fill/.test(d.code)),
          mission.id,
        );
      }
  }
  assert.equal(geometries.size, 7);
  assert.equal(resolveContentJourney(project, { packIds: ['journey-neon'] }).missions.length, 6);
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('Neon starting field components are intentionally retained, including each separated quadrant', () => {
  for (const mission of source.missions) {
    const manifest = resolveMission(project, mission.id);
    const run = createRun(manifest.level, { seed: 1, classId: 'scout' });
    const capture = inspectCaptureSnapshot(run);
    assert.equal(capture.filledCells.length, 0, mission.id);
    assert(
      capture.components.every((c) => c.retained),
      mission.id,
    );
    if (mission.id === 'four-quarters') assert.equal(capture.components.length, 4);
    if (mission.id === 'dogleg-return') assert.equal(capture.components.length, 2);
  }
});

test('each Neon candidate has a reachable first closure with all shared presets and steering settings', () => {
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const manifest = resolveMission(project, mission.id, { difficulty });
        const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
        const denominator = run.totalClaimable;
        assert(Number.isSafeInteger(denominator) && denominator > 0);
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          stepRun(run, { direction: NEON_FIRST_RETURNS[mission.id] }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${mission.id}/${difficulty}/${turnPolicy}`);
        }
        assert(
          run.claimedCount > 0,
          `${mission.id}/${difficulty}/${turnPolicy}: legal first return`,
        );
        assert.equal(run.totalClaimable, denominator);
        assert.notEqual(
          run.status,
          'won',
          'An opening cut must not substitute for a complete campaign challenge.',
        );
      }
});

test('all seven assigned reference proposals have explicit non-final original dispositions', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    NEON_REFERENCE_ADAPTATIONS.map((r) => r.reference).sort(),
    ledger.references
      .filter((r) => r.proposal?.campaign === 'Neon Contours')
      .map((r) => r.designKey)
      .sort(),
  );
  for (const row of NEON_REFERENCE_ADAPTATIONS) {
    assert.equal(row.final, false);
    assert.equal(row.decision, 'redesign');
    assert(source.missions.some((m) => m.id === row.missionId));
  }
});
