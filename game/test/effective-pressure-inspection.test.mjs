import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareCombatAuthoring } from '../content-design/combat-authoring.mjs';
import {
  inspectEffectiveGameplay,
  inspectPressureDifficulty,
  withPressureDifficulty,
} from '../content-design/pressure-candidates.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  GAMEPLAY_TUNING_VERSION,
} from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';
import { sentinelProjectFixture } from './helpers/sentinel-project.mjs';

const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8);

for (const [name, create] of [
  ['Solo and Versus', createStarterProject],
  ['Team', createTeamOpeningCandidates],
])
  test(`${name} report preserves authored facts and projects the actual fresh-attempt recipe`, () => {
    const source = withPressureDifficulty(create());
    const original = structuredClone(source);
    const project = compileContentProject(source);
    const report = inspectPressureDifficulty(project);
    assert.equal(report.format, 'JourneyPressureAuditV1');
    assert.equal(report.rows.length, name === 'Team' ? 3 : 6);
    for (const row of report.rows) {
      const manifest = resolveMission(project, row.missionId, row);
      const recipe = resolveGameplayTuning(row.difficulty);
      // This is the same public preparation used by all three game hosts.
      const runtime = applyGameplayTuning(manifest.level, recipe);
      const effective = row.effectiveGameplay;
      assert.equal(row.simulationIdentity, manifest.simulationIdentity);
      assert.equal(row.playerSpeed, 10);
      assert.equal(row.actors.length, source.missions[0].actors.length);
      assert.equal(effective.recipe.version, GAMEPLAY_TUNING_VERSION);
      assert.deepEqual(effective.recipe, recipe);
      assert.equal(effective.runtimeLevelIdentity, dataIdentity(runtime));
      assert.equal(effective.runtimeRevision, runtime.revision);
      assert.deepEqual(
        effective.actors.map((actor) => actor.runtime),
        runtime.enemies,
      );
      assert.equal(effective.population.actualEnemies, runtime.enemies.length);
      near(effective.playerSpeed, 8.84);
      near(
        effective.actors[0].speed,
        { gentle: 8.2875, standard: 11.05, expert: 13.26 }[row.difficulty],
      );
      assert(effective.actors.every((actor) => actor.domain === 'unclaimed-field'));
      assert(effective.actors.every((actor) => actor.retainsField));
      assert.equal(effective.population.addedKeepers, row.difficulty === 'expert' ? 1 : 0);
      assert.equal(effective.lives, { gentle: 5, standard: 3, expert: 2 }[row.difficulty]);
      assert.equal(effective.recipe.adminOverride, false);
      assert(Object.isFrozen(effective.actors[0].runtime));
      assert(
        effective.warnings.some((warning) => warning.code === 'projection-not-balance-evidence'),
      );
    }
    assert.deepEqual(source, original);
    assert.deepEqual(compileContentProject(source).source, project.source);
  });

test('explicit admin settings report actual clamped rates without changing the authored edition', () => {
  const source = withPressureDifficulty(createStarterProject());
  source.missions[0].actors.push({
    id: 'outer',
    role: 'perimeter-patrol',
    tier: 'measured',
    x: 71.5,
    y: 25.5,
    clockwise: true,
  });
  const before = structuredClone(source);
  const overrides = { enemySpeed: 2, playerSpeed: 1.5, enemyDensity: 2 };
  const result = inspectEffectiveGameplay(source, 'nearby-shore', { overrides });
  assert.deepEqual(result.recipe.overrides, overrides);
  assert.equal(result.recipe.adminOverride, true);
  near(result.playerSpeed, 13.26);
  near(result.actors[0].speed, 20);
  assert.equal(result.actors.find((actor) => actor.id === 'outer').speed, 15);
  assert.equal(result.actors.find((actor) => actor.id === 'outer').domain, 'outer-perimeter');
  assert.equal(result.actors.find((actor) => actor.id === 'outer').retainsField, false);
  assert(result.warnings.some((warning) => warning.code === 'admin-playtest-no-awards'));
  assert.equal(result.population.addedKeepers, 1);
  assert.deepEqual(source, before);
  assert.throws(
    () =>
      inspectEffectiveGameplay(source, 'nearby-shore', {
        overrides: { enemySpeed: 100 },
      }),
    /Invalid enemySpeed/,
  );
  assert.equal(inspectEffectiveGameplay(source, 'nearby-shore').recipe.adminOverride, false);
});

test('density inspection reports skipped additions when the retained chamber has no safe footprint', () => {
  const source = createStarterProject();
  source.maps[0].walls = [
    { x: 59, y: 1, w: 1, h: 34 },
    { x: 62, y: 1, w: 1, h: 34 },
  ];
  const result = inspectEffectiveGameplay(source, 'nearby-shore', { difficulty: 'expert' });
  assert.equal(result.population.requestedAdditionalKeepers, 1);
  assert.equal(result.population.addedKeepers, 0);
  assert.equal(result.population.actualEnemies, 1);
  assert(result.warnings.some((warning) => warning.code === 'density-target-not-reached'));
});

test('boss projection preserves sole field retention and the warning/release contract', () => {
  const source = sentinelProjectFixture();
  const manifest = resolveMission(compileContentProject(source), 'nearby-shore', {
    difficulty: 'expert',
  });
  const result = inspectEffectiveGameplay(source, 'nearby-shore', { difficulty: 'expert' });
  assert.equal(result.population.actualEnemies, 1);
  assert.equal(result.population.addedKeepers, 0);
  assert.equal(result.actors[0].role, 'relay-sentinel');
  assert.equal(
    result.encounter.shielded.warningTicks,
    manifest.level.encounter.shielded.warningTicks,
  );
  assert.deepEqual(result.encounter.exposed, manifest.level.encounter.exposed);
  assert(result.warnings.some((warning) => warning.code === 'encounter-roster-preserved'));
});

test('disabled optional actors remain visible without being counted as enabled pressure', () => {
  const source = prepareCombatAuthoring(createStarterProject(), 'nearby-shore');
  source.missions[0].combat.enabled = false;
  source.missions[0].actors.push({
    id: 'scout',
    role: 'optional-scout',
    tier: 'measured',
    x: 12.5,
    y: 10.5,
    heading: [1, 1],
  });
  const result = inspectEffectiveGameplay(source, 'nearby-shore');
  const optional = result.actors.find((actor) => actor.id === 'scout');
  assert.equal(optional.enabled, false);
  assert.equal(optional.activeSpeed, 0);
  assert.equal(optional.retainsField, false);
  assert.equal(result.population.authoredOptionalActors, 1);
  assert.equal(result.population.enabledOptionalActors, 0);
  assert.equal(result.population.actualEnemies, 1);
});

test('Studio labels both rule contexts and inspects the selected browser settings without rewriting preview', async () => {
  const [host, html] = await Promise.all([
    readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../studio/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="current-gameplay"/);
  assert.match(html, /authored Studio preview values/);
  const board = host.slice(
    host.indexOf('function inspectBoard('),
    host.indexOf('function render('),
  );
  assert.match(board, /inspectEffectiveGameplay\(compiledProject, mission\.id/);
  assert.match(board, /overrides: tuningStatus\.overrides/);
  assert.match(board, /bindStudioPreviewCopy\(document, project, mission, preview\)/);
  assert.match(board, /studioGameplayText\(effectiveGameplay, tuningStatus\)/);
  assert.match(board, /effectiveGameplay,/);
  assert.doesNotMatch(board, /applyGameplayTuning\(/);
});
