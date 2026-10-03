import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnakeHuntCandidates } from '../content-design/snake-hunt-candidates.mjs';
import { createTeamSnakeHuntCandidates } from '../content-design/team-snake-hunt-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { selectedMissionPursuitSource } from '../studio/pursuit-editor.mjs';
import { prepareRunningEnemyLevel, runningEnemyBaseLevel } from '../hunt/running-enemies.mjs';
import {
  prepareTeamRunningEnemies,
  teamRunningEnemyBaseLevel,
} from '../hunt/team-running-enemies.mjs';
import { pursuitPopulation } from '../hunt/pursuit-goals.mjs';
import { createRun, stepRun, validateLevel, FIXED_DT } from '../core/index.mjs';
import { createCoop, startCoop, stepCoop, validateCoopLevel } from '../coop/core.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { createTeamHuntRecorder, restoreTeamHuntAttempt } from '../coop/hunt-attempts.mjs';
import { recordSnakeCatch, snakeSummary } from '../snake/rules.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { matchReplayInstalledRules } from '../replay-installed-rules.mjs';
import { dataIdentity } from '../data-json.mjs';

function fixture(team = false, index = 0) {
  const source = team
    ? createTeamSnakeHuntCandidates({ artwork: false })
    : createSnakeHuntCandidates({ artwork: false });
  const project = compileContentProject(source);
  const mission = project.missions[index];
  const base = resolveMission(project, mission.id, {
    mode: team ? 'team' : 'solo',
    difficulty: 'standard',
  }).level;
  const level = team
    ? prepareTeamRunningEnemies(base, { style: 'varied' })
    : prepareRunningEnemyLevel(base, { style: 'varied' });
  return { source, project, mission, base, level };
}

test('Capture Snake varied selection creates explicit successors while original selection and inherited rules stay exact', () => {
  for (const team of [false, true]) {
    const { base, level } = fixture(team);
    const prepare = team ? prepareTeamRunningEnemies : prepareRunningEnemyLevel;
    const unwrap = team ? teamRunningEnemyBaseLevel : runningEnemyBaseLevel;
    assert.deepEqual(prepare(base, { style: 'original' }), base);
    assert.equal(base.version, team ? 'revealline-coop-level.v10' : 'xonix-level.v11');
    assert.equal(level.version, team ? 'revealline-coop-level.v12' : 'xonix-level.v13');
    assert.equal(level.runningEnemies.version, 'running-enemies.v3');
    assert.deepEqual(unwrap(level), base);
    assert.deepEqual(level.snake, base.snake);
    assert.deepEqual(team ? level.hunt : level.classic.hunt, team ? base.hunt : base.classic.hunt);
    assert.ok(
      level.pursuit.actors.every(
        ({ behavior }) => !['shield', 'brace', 'guard'].includes(behavior),
      ),
    );
  }
});

test('combined recipes reject historical relabelling and edits to pinned tail or required population', () => {
  for (const team of [false, true]) {
    const { level } = fixture(team);
    const validate = team ? validateCoopLevel : validateLevel;
    for (const edit of [
      (value) => {
        value.version = team ? 'revealline-coop-level.v11' : 'xonix-level.v12';
      },
      (value) => {
        value.runningEnemies.version = 'running-enemies.v2';
      },
      (value) => {
        value.snake.initialLength++;
      },
      (value) => {
        (team ? value.hunt : value.classic.hunt).targets.pop();
      },
    ]) {
      const changed = structuredClone(level);
      edit(changed);
      assert.equal(validate(changed).valid, false);
    }
  }
});

test('Studio JSON round-trip preserves ordered bonuses and Team tail ownership through native pack export', () => {
  for (const team of [false, true]) {
    const source = team
      ? createTeamSnakeHuntCandidates({ artwork: false })
      : createSnakeHuntCandidates({ artwork: false });
    const index = source.missions.findIndex((mission) => mission.snake.bonus === 'ordered');
    assert.ok(index >= 0);
    const { mission, base, level } = fixture(team, index);
    const before = JSON.stringify(source);
    const updated = selectedMissionPursuitSource(source, mission.id, pursuitPopulation(level));
    const imported = compileContentProject(JSON.parse(JSON.stringify(updated)));
    const resolved = resolveMission(imported, mission.id, {
      mode: team ? 'team' : 'solo',
      difficulty: 'standard',
    }).level;
    assert.equal(JSON.stringify(source), before);
    assert.deepEqual(resolved.snake, base.snake);
    assert.deepEqual(
      team ? resolved.hunt : resolved.classic.hunt,
      team ? base.hunt : base.classic.hunt,
    );
    assert.deepEqual(pursuitPopulation(resolved), pursuitPopulation(level));
    if (team) {
      const pack = createTeamTestPack(updated, mission.id);
      assert.equal(pack.version, 'revealline-coop-pack.v12');
      assert.equal(pack.ruleset, 'revealline-coop.v14');
      assert.equal(validateCoopPack(pack).valid, true);
      assert.equal(validateCoopPack({ ...pack, version: 'revealline-coop-pack.v10' }).valid, false);
    }
  }
});

test('combined replay pins tail and pursuit phases and verifies the original installed Snake source', () => {
  const { base, level } = fixture();
  const run = createRun(level, { seed: 17 });
  const recorder = createRecorder(level, { seed: 17 });
  for (let i = 0; i < 61; i++) {
    const input = { direction: null };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  const replay = exportReplay(recorder, run);
  const proof = verifyReplay(replay);
  assert.equal(replay.version, 'xonix-replay.v15');
  assert.equal(proof.match, true);
  assert.equal(combatView(run).valid, true);
  const checkpoint = authoritativeCheckpoint(run);
  assert.equal(checkpoint.algorithm, 'fnv1a64-state-v14');
  assert.ok(
    checkpoint.sections.snake && checkpoint.sections.pursuit && checkpoint.sections.classic,
  );
  const changed = structuredClone(run);
  changed.snake.bodies[0].capacity++;
  assert.notEqual(authoritativeCheckpoint(changed).hash, checkpoint.hash);
  const actor = changed.classic.combatPatrols.actors.find((entry) => entry.pursuit);
  assert.ok(actor);
  actor.pursuit.nextDecisionTick++;
  assert.notEqual(authoritativeCheckpoint(changed).sections.classic, checkpoint.sections.classic);
  assert.deepEqual(
    matchReplayInstalledRules({
      campaign: { levels: [base], classRecipes: replay.options.classRecipes },
      replay,
      state: proof.state,
    }),
    base,
  );
  const forged = structuredClone(replay);
  forged.version = 'xonix-replay.v13';
  assert.throws(() => verifyReplay(forged));
});

test('combined rules retain native self-tail failure and once-only growth', () => {
  const { level } = fixture();
  const run = createRun(level, { seed: 5 });
  const capacity = run.snake.bodies[0].capacity;
  const id = level.classic.hunt.targets[0].id;
  recordSnakeCatch(run, id);
  recordSnakeCatch(run, id);
  assert.equal(
    run.snake.bodies[0].capacity,
    Math.min(level.snake.maxLength, capacity + level.snake.growthPerCatch),
  );
  assert.equal(snakeSummary(run).catches, 1);
  // On safe ground, reversing into a populated tail remains a native collision.
  for (let i = 0; i < 90; i++) stepRun(run, { direction: 'right' });
  let failure = null;
  for (let i = 0; i < 90 && !failure; i++) {
    stepRun(run, { direction: 'left' });
    failure = run.events.find((event) => event.type === 'player.failed');
  }
  assert.equal(failure?.cause, 'snake-body');
});

test('Team combined restore reconstructs target phases, shared quota and both tails', async () => {
  const { base, source, mission } = fixture(true);
  const pack = createTeamTestPack(source, mission.id);
  const tuning = resolveGameplayTuning('standard');
  const level = prepareTeamRunningEnemies(applyGameplayTuning(base, tuning), { style: 'varied' });
  const run = startCoop(createCoop(level, { seed: 17 }));
  const recorder = createTeamHuntRecorder({
    run,
    pack,
    level: base,
    tuning,
    encounterLevel: base,
    encounterVariant: 'authored',
    runningEnemies: true,
    attemptId: 'snake-pursuit-restore',
    gameplayId: dataIdentity({ ruleset: run.ruleset, level }),
  });
  const commands = [0, 1].map(() => ({ direction: null, boost: false, support: false }));
  for (let i = 0; i < 61; i++) {
    stepCoop(run, commands);
    recorder.append(commands);
  }
  const saved = recorder.snapshot();
  assert.equal(saved.ruleset, 'revealline-coop.v14');
  const restored = await restoreTeamHuntAttempt(saved, { pack, level: base });
  assert.deepEqual(restored.run, run);
  assert.equal(restored.run.snake.bodies.length, 2);
  assert.deepEqual(restored.run.level.hunt, base.hunt);
  const forged = structuredClone(saved);
  forged.runningEnemyStyle = 'original';
  await assert.rejects(restoreTeamHuntAttempt(forged, { pack, level: base }));
});

test('raw Playground successor transport preserves native pursuit and refuses changed pinned geometry', async () => {
  const { readFile } = await import('node:fs/promises');
  const { entryScenario, expansionFromScenario, prepareDocument, editScenario } = await import(
    '../playground/model.mjs'
  );
  const { preparePack, scenarioFromPack, validatePack, emptyPackLibrary } = await import(
    '../packs.mjs'
  );
  const { validateScenario } = await import('../content.mjs');
  const { createCandidateSoloHost } = await import('../content-design/solo-host.mjs');
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  const { source } = fixture();
  const host = createCandidateSoloHost(source, {
    themes,
    buildVersion: 'dev',
    corePackIds: [source.packs[0].id],
  });
  const entry = host.entries[0];
  const level = prepareRunningEnemyLevel(entry.campaign.levels[0], { style: 'varied' });
  const scenario = entryScenario({ ...entry, campaign: { ...entry.campaign, levels: [level] } });
  assert.equal(scenario.format, 'xonix-playground.v13');
  const pack = expansionFromScenario(scenario);
  assert.equal(pack.format, 'xonix-pack.v13');
  assert.equal(validatePack(pack).valid, true);
  assert.equal(validatePack({ ...pack, format: 'xonix-pack.v11' }).valid, false);
  assert.equal(validateScenario({ ...scenario, format: 'xonix-playground.v11' }).valid, false);
  const prepared = await preparePack(pack);
  const restored = scenarioFromPack(prepared.pack, pack.campaigns[0].id, level.id);
  assert.deepEqual(restored.level, level);
  const imported = await prepareDocument(restored.level, {
    current: restored,
    packLibrary: emptyPackLibrary(),
  });
  assert.deepEqual(imported.scenario.level, level);
  const cosmetic = editScenario(imported.scenario, {
    presentation: { style: 'props', showGrid: true },
  });
  assert.deepEqual(cosmetic.level, level);
  assert.throws(() =>
    editScenario(cosmetic, {
      level: { ...level, walls: [...level.walls, { x: 10, y: 10, w: 1, h: 1 }] },
    }),
  );
});
