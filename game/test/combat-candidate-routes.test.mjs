import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { playCombatRoute } from './helpers/combat-route-evidence.mjs';

const readFixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const { routes } = readFixture('combat-candidate-routes');
const evidence = readFixture('combat-candidate-observations');
const source = createCombatCandidates(),
  on = compileContentProject(source);
const disabled = structuredClone(source);
for (const mission of disabled.missions) mission.combat.enabled = false;
const off = compileContentProject(disabled);
const key = (row) => `${row.id}/${row.difficulty}/${row.turnPolicy}/seed${row.seed}`;

test('original combat studies have complete preset/control evidence, explicit limits and independent authored copies', () => {
  assert.equal(source.missions.length, 3);
  assert.equal(routes.length, 21);
  assert.equal(new Set(routes.map(key)).size, 21);
  assert.deepEqual(new Set(routes.map(key)), new Set(evidence.map(key)));
  for (const mission of source.missions) {
    assert.deepEqual(mission.modes, ['solo', 'versus']);
    assert.equal(mission.bonuses.length, 0);
    assert.equal(mission.objectives.length, 0);
    assert.equal(mission.presentation.backgroundAssetId, null, 'greyboxes are not final art');
    for (const field of [
      'routeDecision',
      'lesson',
      'counterplay',
      'captureConsequence',
      'memorableMoment',
      'mastery',
    ])
      assert(mission.design[field].length > 10);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center'])
        assert(
          routes.some(
            (r) =>
              r.id === mission.id &&
              r.difficulty === difficulty &&
              r.turnPolicy === turnPolicy &&
              r.seed === 1,
          ),
        );
  }
  const copy = createCombatCandidates();
  copy.maps[0].walls[0].x++;
  copy.missions[0].actors[0].heading[0] = 0;
  assert.deepEqual(createCombatCandidates(), source);
  const removed = evidence.flatMap((r) => r.on.removals);
  assert(removed.some((r) => r.cause === 'ram'));
  assert(removed.some((r) => r.cause === 'capture'));
  for (const policy of ['immediate', 'grid-center']) {
    const evasion = evidence.find((r) => r.turnPolicy === policy && r.on.shots > 0);
    assert(evasion, 'actual fired-shot evasion, not just cancelled warnings');
    assert(evasion.on.liveShotExposureTicks > 0);
    assert.equal(evasion.on.impacts, 0);
    assert.equal(evasion.on.losses, 0);
    assert(evasion.on.removals.some((r) => r.cause === 'capture'));
  }
});

for (const row of routes) {
  const expected = evidence.find((r) => key(r) === key(row));
  test(`combat study clears and replays with combat on/off: ${key(row)}`, () => {
    for (const [enabled, project] of [
      [true, on],
      [false, off],
    ]) {
      const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
      const { run, observations } = playCombatRoute(manifest.level, row);
      assert.deepEqual(observations, enabled ? expected.on : expected.off);
      assert.equal(run.status, 'won');
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.tick, row.ticks);
      assert.equal(run.classic.combatPatrols !== undefined, enabled);
      assert.deepEqual(
        manifest.level,
        resolveMission(project, row.id, { difficulty: row.difficulty, mode: 'versus' }).level,
      );
      if (enabled) {
        assert.equal(manifest.simulationIdentity, row.simulationIdentity);
        assert.equal(observations.checkpoint, row.checkpoint);
      } else {
        assert.notEqual(manifest.simulationIdentity, row.simulationIdentity);
        assert.equal(observations.shots, 0);
        assert.deepEqual(observations.removals, []);
      }
    }
    assert.equal(
      expected.on.coverage,
      expected.off.coverage,
      'optional actors do not retain territory',
    );
  });
  test(`combat study equal independent paired races with combat on/off: ${key(row)}`, () => {
    for (const [enabled, project] of [
      [true, on],
      [false, off],
    ]) {
      const { level } = resolveMission(project, row.id, {
        difficulty: row.difficulty,
        mode: 'versus',
      });
      const match = createDuel(
        level,
        { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      resumeDuel(match);
      for (const { direction, ticks } of row.segments)
        for (let i = 0; i < ticks; i++) {
          assert.equal(match.status, 'running');
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished');
      assert.equal(match.winner, null);
      assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
      );
      assert.equal(
        authoritativeCheckpoint(match.runs[0]).hash,
        enabled ? expected.on.checkpoint : expected.off.checkpoint,
      );
      if (enabled) {
        assert.notEqual(match.runs[0].classic.combatPatrols, match.runs[1].classic.combatPatrols);
        assert.notEqual(
          match.runs[0].classic.combatPatrols.actors,
          match.runs[1].classic.combatPatrols.actors,
        );
      }
    }
  });
}
