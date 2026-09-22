import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createCulturalWorkshopCandidates } from '../content-design/cultural-workshop-candidates.mjs';
import { createPursuitInterceptCandidates } from '../content-design/pursuit-intercept-candidates.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  journeyActors,
  journeyPressureTiming,
  PRESSURE_ACTOR_CATALOG,
} from '../content-design/catalogs.mjs';
import { inspectPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('additive pressure catalogue preserves older roles, absent descriptors and identities', () => {
  assert(Object.isFrozen(PRESSURE_ACTOR_CATALOG.roles['trail-pursuer'].pressureRecipe));
  for (let v = 1; v <= 6; v++) {
    const catalog = journeyActors(`journey-actors-v${v}`);
    assert(!catalog.roles['trail-pursuer'] && !catalog.roles['heading-interceptor']);
    for (const [id, role] of Object.entries(catalog.roles))
      assert.deepEqual(PRESSURE_ACTOR_CATALOG.roles[id], role);
  }
  const old = createStarterProject(),
    next = structuredClone(old);
  next.actorCatalogId = PRESSURE_ACTOR_CATALOG.id;
  const a = resolveMission(compileContentProject(old), old.missions[0].id);
  const b = resolveMission(compileContentProject(next), next.missions[0].id);
  assert.deepEqual(a.level, b.level);
  assert.equal(a.simulationIdentity, b.simulationIdentity);
  assert(!Object.hasOwn(b.level.classic, 'enemyPressure'));
});

test('registered recipes share immutable tells and scale only existing movement and rest dimensions', () => {
  const project = compileContentProject(createPursuitInterceptCandidates());
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const mission of project.missions) {
      const manifest = resolveMission(project, mission.id, { difficulty });
      const peer = resolveMission(project, mission.id, { difficulty, mode: 'versus' });
      assert.deepEqual(peer.level, manifest.level);
      assert.equal(peer.simulationIdentity, manifest.simulationIdentity);
      const actor = mission.actors[0],
        recipe = manifest.level.classic.enemyPressure.actors[0];
      assert.deepEqual(recipe, {
        id: actor.id,
        ...journeyPressureTiming(actor.role, difficulty, project.actors.id, project.difficulty.id),
      });
      assert.equal(recipe.warningTicks, 120);
      assert.equal(recipe.commitTicks, 180);
      assert.equal(recipe.cooldownTicks, { gentle: 450, standard: 306, expert: 234 }[difficulty]);
      assert.equal(recipe.scanTicks, 24);
      assert.equal(recipe.senseRadius, 18);
      assert.equal(recipe.leadTicks, actor.role === 'trail-pursuer' ? 0 : 36);
      assert.equal(journeyPressureTiming(actor.role, difficulty).cooldownTicks, 360);
      const compiled = manifest.level.enemies.find((e) => e.id === actor.id);
      assert(
        Math.abs(
          Math.hypot(compiled.vx, compiled.vy) -
            { gentle: 3.2, standard: 4.48, expert: 5.6 }[difficulty],
        ) < 1e-9,
      );
      const run = createRun(manifest.level, { seed: 1 }),
        other = createRun(manifest.level, { seed: 1 });
      for (let i = 0; i < 1200; i++) {
        stepRun(run, { direction: null }, FIXED_DT);
        stepRun(other, { direction: null }, FIXED_DT);
      }
      assert.equal(run.status, 'running');
      assert.equal(run.lives, manifest.level.rules.lives);
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(other));
    }
  const audit = inspectPressureDifficulty(project.source);
  assert(audit.rows.every((row) => row.actors[0].pressureTiming.warningTicks === 120));
});

test('six variants preserve six original map geometries, isolated introductions and mode boundaries', () => {
  const original = createCulturalWorkshopCandidates(),
    before = structuredClone(original);
  const source = createPursuitInterceptCandidates(),
    project = compileContentProject(source);
  assert.deepEqual(createCulturalWorkshopCandidates(), before);
  assert.equal(project.missions.length, 6);
  assert.equal(project.campaigns.length, 2);
  for (const map of source.maps)
    assert.deepEqual(
      map,
      original.maps.find((m) => m.id === map.id),
    );
  for (const campaign of project.campaigns) {
    const missions = campaign.missionIds.map((id) => project.missions.find((m) => m.id === id));
    assert.equal(missions[0].design.introduces.length, 1);
    assert(missions.slice(1).every((m) => m.design.introduces.length === 0));
  }
  for (const mission of project.missions) {
    assert.deepEqual(mission.modes, ['solo', 'versus']);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.bonuses.length, 0);
  }
  for (const role of ['trail-pursuer', 'heading-interceptor']) {
    const team = createTeamOpeningCandidates();
    team.actorCatalogId = PRESSURE_ACTOR_CATALOG.id;
    team.missions[0].actors[0].role = role;
    assert.throws(() => compileContentProject(team));
  }
});

test('unregistered pressure roles and inline overrides fail closed; emitted recipes sort IDs', () => {
  for (const mutate of [
    (p) => {
      p.actorCatalogId = 'journey-actors-v6';
    },
    (p) => {
      p.missions[0].actors[0].warningTicks = 0;
    },
    (p) => {
      p.missions[0].actors[0].pressureRecipe = { mode: 'omniscient' };
    },
    (p) => {
      p.missions[0].actors[0].tier = 'turbo';
    },
  ]) {
    const source = createPursuitInterceptCandidates();
    mutate(source);
    assert.throws(() => compileContentProject(source));
  }
  const source = createPursuitInterceptCandidates();
  source.missions[0].actors[1].role = 'heading-interceptor';
  const manifest = resolveMission(compileContentProject(source), source.missions[0].id);
  assert.deepEqual(
    manifest.level.classic.enemyPressure.actors.map((a) => a.id),
    ['east', 'west'],
  );
  assert.throws(() => journeyPressureTiming('field-keeper'));
});
