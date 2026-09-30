import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COOLING_LOOP_EROSION_REVISION,
  createCoolingLoopErosionCandidates,
} from '../content-design/cooling-loop-erosion-candidates.mjs';
import { createPressureCorridorTriptychCandidates } from '../content-design/pressure-corridor-triptych-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';

for (const artwork of [false, true])
  test(`Cooling loop successor changes only its existing eroder and design: artwork=${artwork}`, () => {
    const previous = createPressureCorridorTriptychCandidates({ artwork });
    const next = createCoolingLoopErosionCandidates({ artwork });
    assert.deepEqual(createPressureCorridorTriptychCandidates({ artwork }), previous);
    assert.equal(next.revision, COOLING_LOOP_EROSION_REVISION);
    for (const key of ['maps', 'assets', 'policyId', 'actorCatalogId', 'difficultyCatalogId'])
      assert.deepEqual(next[key], previous[key], key);
    assert.deepEqual(
      next.missions.map((item) => item.id),
      previous.missions.map((item) => item.id),
    );
    const changedCampaigns = new Set();
    for (const mission of next.missions) {
      const before = previous.missions.find((item) => item.id === mission.id);
      if (mission.id !== 'cooling-loop') assert.deepEqual(mission, before);
      else {
        const { revision, actors, design, ...unchanged } = mission;
        const {
          revision: priorRevision,
          actors: priorActors,
          design: priorDesign,
          ...prior
        } = before;
        assert.equal(revision, COOLING_LOOP_EROSION_REVISION);
        assert.notEqual(revision, priorRevision);
        assert.deepEqual(unchanged, prior);
        assert.equal(actors.length, priorActors.length);
        for (const actor of actors) {
          const old = priorActors.find((item) => item.id === actor.id);
          if (actor.id !== 'eroder') assert.deepEqual(actor, old);
          else assert.deepEqual(actor, { ...old, y: 24.5, heading: [1, 1] });
        }
        for (const key of ['introduces', 'practices', 'combines', 'difficulty', 'durationSeconds'])
          assert.deepEqual(design[key], priorDesign[key]);
        assert.match(design.captureConsequence, /erodible links/);
        assert.doesNotMatch(design.memorableMoment, /permanent loop|bank reopens/);
      }
    }
    for (const campaign of next.campaigns) {
      const before = previous.campaigns.find((item) => item.id === campaign.id);
      if (campaign.missionIds.includes('cooling-loop')) {
        changedCampaigns.add(campaign.id);
        assert.deepEqual(campaign, { ...before, revision: COOLING_LOOP_EROSION_REVISION });
      } else assert.deepEqual(campaign, before);
    }
    for (const pack of next.packs) {
      const before = previous.packs.find((item) => item.id === pack.id);
      assert.deepEqual(
        pack,
        pack.campaignIds.some((id) => changedCampaigns.has(id))
          ? { ...before, revision: COOLING_LOOP_EROSION_REVISION }
          : before,
      );
    }
  });

const previous = compileContentProject(createPressureCorridorTriptychCandidates({ artwork: true }));
const next = compileContentProject(createCoolingLoopErosionCandidates({ artwork: true }));

for (const difficulty of ['gentle', 'standard', 'expert'])
  test(`Cooling loop ${difficulty} preserves effective speeds, roles, geometry and equal boards`, () => {
    const before = resolveMission(previous, 'cooling-loop', { difficulty, mode: 'solo' });
    const solo = resolveMission(next, 'cooling-loop', { difficulty, mode: 'solo' });
    const versus = resolveMission(next, 'cooling-loop', { difficulty, mode: 'versus' });
    assert.deepEqual(versus.level, solo.level);
    const oldLevel = applyGameplayTuning(before.level, resolveGameplayTuning(difficulty));
    const level = applyGameplayTuning(solo.level, resolveGameplayTuning(difficulty));
    assert.equal(level.enemies.length, oldLevel.enemies.length);
    for (const enemy of level.enemies) {
      const old = oldLevel.enemies.find((item) => item.id === enemy.id);
      if (enemy.id.startsWith('pressure-extra-')) {
        // Existing Expert preparation recomputes maximum-clearance placement
        // against the moved eroder. Count/role/speed stay unchanged, but the
        // successor need not reuse the previous edition's exact position.
        const { x, y, ...same } = enemy;
        const { x: oldX, y: oldY, ...oldSame } = old;
        assert.equal(difficulty, 'expert');
        assert.deepEqual(same, oldSame);
        assert.deepEqual([oldX, oldY], [44.5, 2.5]);
        assert.deepEqual([x, y], [41.5, 2.5]);
      } else if (enemy.type !== 'eroder') assert.deepEqual(enemy, old);
      else {
        const { x, y, vx, vy, ...same } = enemy;
        const { x: oldX, y: oldY, vx: oldVx, vy: oldVy, ...oldSame } = old;
        assert.deepEqual(same, oldSame);
        assert.equal(x, oldX);
        assert.equal(y, 24.5);
        assert.equal(oldY, 9.5);
        assert(Math.abs(Math.hypot(vx, vy) - Math.hypot(oldVx, oldVy)) < 1e-10);
      }
    }
    for (const key of ['rules', 'walls', 'foundations', 'terrain', 'objectives', 'goal', 'spawn'])
      assert.deepEqual(level[key], oldLevel[key], key);
    for (const seed of [1, 917]) {
      const run = createRun(level, { seed });
      const oldRun = createRun(oldLevel, { seed });
      assert.equal(run.totalClaimable, oldRun.totalClaimable);
      for (let tick = 0; tick < 180; tick++) stepRun(run, { direction: null }, FIXED_DT);
      assert.equal(run.status, 'running');
      assert.equal(run.classic.livesLost, 0);
    }
  });

test('Cooling loop candidate does not change the normal Solo, Versus or Team defaults', () => {
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v25',
    versus: 'whole-spatial-v25',
    team: 'team-cultural-specialist-originals-2',
  });
});
