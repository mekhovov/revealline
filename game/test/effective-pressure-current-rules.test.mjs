import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../data-json.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { inspectEffectiveGameplay } from '../content-design/pressure-candidates.mjs';
import { createWholeErosionReviewCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { createTeamImpactOriginalCandidates } from '../content-design/team-impact-originals.mjs';
import {
  createTeamSpecialistOriginalCandidates,
  TEAM_SPECIALIST_MISSIONS,
} from '../content-design/team-specialist-originals.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createCoop } from '../coop/core.mjs';
import { stepRun, FIXED_DT } from '../core/index.mjs';

const route = createAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
const project = compileContentProject(route.source);
const pressureMissions = [
  'return-in-reserve',
  'two-ways-home',
  'dogleg-transfer',
  'crossed-bands',
  'pressure-ladder',
  'signal-channels',
  'cross-stitch-crossings',
  'pysanka-sections',
  'rushnyk-bands',
  'four-motor-landings',
  'circuit-lanes',
  'twin-lens-chambers',
];

test('all twelve current pressure adaptations report exact tuned attacks and global trail impacts', () => {
  assert.equal(route.id, 'whole-spatial-v11');
  for (const id of pressureMissions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        const manifest = resolveMission(project, id, { difficulty, mode });
        const recipe = resolveGameplayTuning(difficulty);
        const level = applyGameplayTuning(manifest.level, recipe);
        const actual = inspectEffectiveGameplay(project, id, { difficulty, mode });
        assert.equal(actual.sourceSimulationIdentity, manifest.simulationIdentity);
        assert.equal(actual.runtimeLevelIdentity, dataIdentity(level));
        assert.deepEqual(
          actual.actors.map((actor) => actor.runtime),
          level.enemies,
        );
        assert.deepEqual(actual.enemyPressure, level.classic.enemyPressure);
        assert.equal(actual.enemyPressure.actors.length, 1);
        const [attack] = actual.enemyPressure.actors;
        assert.equal(attack.warningTicks, 90);
        assert.equal(attack.commitTicks, 144);
        assert.equal(attack.cooldownTicks, { gentle: 441, standard: 300, expert: 229 }[difficulty]);
        assert.deepEqual(actual.lineImpact, level.classic.lineImpact);
        assert.equal(actual.lineImpact.version, 'line-impact.v1');
        assert(actual.lineImpact.speed > 0);
        const actor = actual.actors.find((item) => item.id === attack.id);
        assert.equal(
          actor.role,
          attack.mode === 'trail-pursuit' ? 'trail-pursuer' : 'heading-interceptor',
        );
        assert.equal(actor.domain, 'unclaimed-field');
        assert.equal(actor.retainsField, true);
        assert.equal(actual.population.actualEnemies, level.enemies.length);
        assert(
          actual.actors
            .filter((item) => item.origin === 'density-addition')
            .every((item) => item.role === 'field-keeper'),
        );
      }
});

test('inspection matches actual Solo attempt preparation with fresh admin settings, without changing the authored preview', async () => {
  // Greybox and pictured current factories compile byte-equivalent gameplay.
  // Use that real greybox preparation to avoid claiming image decode acceptance.
  const source = createWholeErosionReviewCandidates();
  const greybox = compileContentProject(source);
  const { themes } = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const preparer = createContentAttemptPreparer(greybox, {
    themes: journeyActorThemeCandidates(themes, { includeOriginals: true }),
  });
  const original = structuredClone(source);
  try {
    for (const id of ['return-in-reserve', 'crossed-bands'])
      for (const difficulty of ['standard', 'expert'])
        for (const overrides of [{}, { enemySpeed: 1.5, playerSpeed: 1.25, enemyDensity: 1.5 }]) {
          const mission = preparer.catalog.journey().missions.find((item) => item.levelId === id);
          const authored = resolveMission(greybox, id, { difficulty });
          assert.deepEqual(authored.level, resolveMission(project, id, { difficulty }).level);
          const gameplayTuning = resolveGameplayTuning(difficulty, overrides);
          const prepared = await preparer.prepare(
            {
              missionId: mission.id,
              difficulty,
              seed: 1,
              turnPolicy: 'immediate',
            },
            { gameplayTuning },
          );
          const inspected = inspectEffectiveGameplay(project, id, { difficulty, overrides });
          assert.equal(inspected.runtimeLevelIdentity, dataIdentity(prepared.run.level));
          assert.deepEqual(inspected.rules, prepared.run.level.rules);
          assert.deepEqual(inspected.enemyPressure, prepared.run.level.classic.enemyPressure);
          assert.deepEqual(inspected.lineImpact, prepared.run.level.classic.lineImpact);
          assert.deepEqual(
            inspected.actors.map((actor) => actor.runtime),
            prepared.run.level.enemies,
          );
          assert.equal(inspected.population.actualEnemies, prepared.run.enemies.length);
          assert.equal(inspected.recipe.adminOverride, gameplayTuning.adminOverride);
          assert.equal(
            inspected.warnings.some((warning) => warning.code === 'admin-playtest-no-awards'),
            gameplayTuning.adminOverride,
          );
          assert.equal(authored.level.rules.moveSpeed, 10);
          assert.equal(
            prepared.run.player.speed,
            0,
            'a freshly stopped craft is not a moving rate',
          );
          stepRun(prepared.run, { direction: 'left' }, FIXED_DT);
          assert.equal(inspected.playerSpeed, prepared.run.player.speed);
          assert.notEqual(inspected.playerSpeed, authored.level.rules.moveSpeed);
        }
  } finally {
    preparer.dispose();
  }
  assert.deepEqual(source, original);
});

test('current Team impact and specialist diagnostics read their actual top-level runtime contracts', () => {
  assert.equal(DEFAULT_JOURNEY_ROUTES.team, 'team-complete-specialist-originals-1');
  for (const source of [
    createTeamImpactOriginalCandidates(),
    createTeamSpecialistOriginalCandidates(),
  ]) {
    const compiled = compileContentProject(source);
    const id = source.missions.some((mission) => mission.id === TEAM_SPECIALIST_MISSIONS[0])
      ? TEAM_SPECIALIST_MISSIONS[0]
      : source.missions[0].id;
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const manifest = resolveMission(compiled, id, { difficulty, mode: 'team' });
      const level = applyGameplayTuning(manifest.level, resolveGameplayTuning(difficulty));
      const run = createCoop(level, { seed: 1 });
      const inspected = inspectEffectiveGameplay(compiled, id, { difficulty, mode: 'team' });
      // Team initializes live patrol state on its owned actor objects. Its
      // mutable run.level is not the immutable input/replay-recipe identity.
      assert.equal(inspected.identityScope, 'fresh-attempt-level-input-not-live-state');
      assert.equal(inspected.runtimeLevelIdentity, dataIdentity(level));
      assert.deepEqual(inspected.lineImpact, run.level.lineImpact);
      assert.equal(inspected.lineImpact.version, 'team-line-impact.v2');
      assert.equal(inspected.lineImpact.speed, run.level.lineImpact.speed);
      assert.deepEqual(inspected.supportRoles, run.level.supportRoles ?? null);
      assert.deepEqual(
        inspected.actors.map((actor) => actor.runtime),
        level.enemies,
      );
      assert.equal(inspected.population.actualEnemies, run.enemies.length);
    }
  }
});
