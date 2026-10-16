import test from 'node:test';
import assert from 'node:assert/strict';
import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import { createTeamSnakeHuntCandidates } from '../content-design/team-snake-hunt-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { selectedMissionPursuitSource } from '../studio/pursuit-editor.mjs';
import { createCoop } from '../coop/core.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { teamPictureArenaLevel } from '../coop/picture-source.mjs';
import { prepareTeamRunningEnemies } from '../hunt/team-running-enemies.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

test('authored Team pilot pictures retain their pursuit edition through every native difficulty', () => {
  const source = createPursuitPilotCandidates({ team: true }),
    host = createCandidateTeamHost(source, { corePackIds: source.packs.map((pack) => pack.id) });
  for (const row of host.rows) {
    for (const runtimeLevel of [
      row.level,
      applyGameplayTuning(row.level, resolveGameplayTuning(row.difficulty)),
    ]) {
      const run = createCoop(runtimeLevel),
        before = structuredClone(run),
        arena = teamPictureArenaLevel(run, { runtimeLevel, sourceLevel: row.level });
      assert.equal(arena.version, row.level.version);
      assert.deepEqual(arena, runtimeLevel);
      assert.deepEqual(run, before);
      const wrong = structuredClone(row.level);
      wrong.goal.coverage -= 0.01;
      assert.throws(() => teamPictureArenaLevel(run, { runtimeLevel, sourceLevel: wrong }));
      assert.throws(() => teamPictureArenaLevel(run, { sourceLevel: row.level }), /exact prepared/);
    }
  }
});

test('a Studio successor authenticates its v2 picture edition without accepting a historical ruleset', () => {
  const source = createPursuitPilotCandidates({ team: true }),
    mission = source.missions.find((entry) => entry.id === 'pincer-yard'),
    successor = selectedMissionPursuitSource(source, mission.id, mission.pursuit.actors),
    project = compileContentProject(successor);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const sourceLevel = resolveMission(project, mission.id, { mode: 'team', difficulty }).level,
      runtimeLevel = applyGameplayTuning(sourceLevel, resolveGameplayTuning(difficulty)),
      run = createCoop(runtimeLevel);
    assert.equal(sourceLevel.version, 'revealline-coop-level.v13');
    assert.equal(run.ruleset, 'revealline-coop.v15');
    assert.deepEqual(teamPictureArenaLevel(run, { runtimeLevel, sourceLevel }), runtimeLevel);
    run.ruleset = 'revealline-coop.v13';
    assert.throws(
      () => teamPictureArenaLevel(run, { runtimeLevel, sourceLevel }),
      /exact prepared arena/,
    );
  }
});

test('ordinary Team optional rosters retain only the exact inherited picture source', () => {
  const sourceLevel = COOP_STARTER_PACK.levels[0],
    tuned = applyGameplayTuning(sourceLevel, resolveGameplayTuning('standard'));
  for (const generation of ['pursuit-goals.v1', 'pursuit-goals.v2']) {
    const runtimeLevel = prepareTeamRunningEnemies(tuned, { style: 'varied', generation }),
      run = createCoop(runtimeLevel);
    assert.deepEqual(teamPictureArenaLevel(run, { runtimeLevel, sourceLevel }), tuned);
    const wrong = structuredClone(sourceLevel);
    wrong.walls.push({ x: 30, y: 10, w: 1, h: 1 });
    assert.throws(() => teamPictureArenaLevel(run, { runtimeLevel, sourceLevel: wrong }));
  }
});

test('Capture Snake picture ownership distinguishes authored pursuit from optional roster overlays in both generations', () => {
  const project = compileContentProject(createTeamSnakeHuntCandidates({ artwork: false })),
    base = resolveMission(project, project.missions[0].id, {
      mode: 'team',
      difficulty: 'standard',
    }).level,
    tuning = resolveGameplayTuning('standard');
  for (const generation of ['pursuit-goals.v1', 'pursuit-goals.v2']) {
    for (const authored of [false, true]) {
      const sourceLevel = authored
          ? prepareTeamRunningEnemies(base, { style: 'varied', generation })
          : base,
        tuned = applyGameplayTuning(sourceLevel, tuning),
        runtimeLevel = authored
          ? tuned
          : prepareTeamRunningEnemies(tuned, { style: 'varied', generation }),
        run = createCoop(runtimeLevel),
        arena = teamPictureArenaLevel(run, { runtimeLevel, sourceLevel });
      assert.deepEqual(arena, authored ? runtimeLevel : tuned);
      assert.equal(arena.version, sourceLevel.version);
      const wrong = structuredClone(sourceLevel);
      wrong.goal.coverage -= 0.01;
      assert.throws(() => teamPictureArenaLevel(run, { runtimeLevel, sourceLevel: wrong }));
    }
  }
});
