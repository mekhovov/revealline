import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CHAPTERS,
} from '../content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const source = createWholeJourneyCandidates(),
  original = structuredClone(source);
const historical = compileContentProject(source);
const project = compileContentProject(withPressureDifficulty(source));
const key = (r) => [r.missionId, r.difficulty, r.turnPolicy].join('/');
test('whole-library pressure evidence accounts for every mission, preset and steering combination', () => {
  assert.equal(fixture.projectRevision, project.source.revision);
  assert.equal(fixture.rows.length, 498);
  assert.equal(new Set(fixture.rows.map(key)).size, 498);
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const row = fixture.rows.find(
          (r) => key(r) === [mission.id, difficulty, turnPolicy].join('/'),
        );
        assert(row);
        assert.equal(row.seed, 1);
        assert.equal(
          row.oldIdentity,
          resolveMission(historical, mission.id, { difficulty }).simulationIdentity,
        );
        assert.equal(
          row.simulationIdentity,
          resolveMission(project, mission.id, { difficulty }).simulationIdentity,
        );
        assert.equal(
          row.qualification,
          row.chosen ? 'legal-route-and-replay-only' : 'needs-new-route-not-proven-impossible',
        );
        assert(row.attempts.length >= 1 && row.attempts.length <= 30);
        if (!row.chosen) assert.equal(row.attempts.length, 30);
        for (let i = 0; i < row.attempts.length; i++)
          assert.equal(row.attempts[i][1], fixture.delayTicks[i % 10]);
        assert.equal(
          row.attempts.some((a) => a[2] === 'no-loss-clear'),
          Boolean(row.chosen),
        );
        assert.equal(row.attempts[0][0], row.difficulty);
        if (row.chosen) {
          assert.equal(row.chosen.routeSourceDifficulty, row.attempts.at(-1)[0]);
          assert.equal(row.chosen.initialDelayTicks, row.attempts.at(-1)[1]);
        } else {
          assert.equal(row.lastFailure.status, row.attempts.at(-1)[2]);
          assert.equal(row.lastFailure.ticks, row.attempts.at(-1)[3]);
        }
      }
  assert.deepEqual(source, original);
  assert.equal(source.difficultyCatalogId, 'journey-difficulty-v1');
});
for (const { id } of WHOLE_JOURNEY_CHAPTERS) {
  test(`unresolved rows reproduce their final bounded attempt, without claiming impossibility: ${id}`, async () => {
    const read = async (name) =>
      JSON.parse(await readFile(new URL(`./fixtures/${name}-routes.json`, import.meta.url)));
    const baseline = await read(id === 'horizon' ? 'horizon-greybox' : `${id}-clear`);
    const sets =
      id === 'horizon'
        ? [
            { difficulty: 'standard', turnPolicy: 'immediate', rows: baseline.rows },
            ...(await read('horizon-preset')).sets,
          ]
        : baseline.sets.filter((s) => s.bonuses !== false);
    for (const row of fixture.rows.filter((r) => r.chapter === id && !r.chosen)) {
      const [routeDifficulty, initialDelayTicks] = row.attempts.at(-1);
      const segmentRow = sets
        .find((s) => s.difficulty === routeDifficulty && s.turnPolicy === row.turnPolicy)
        .rows.find((r) => r[0] === row.missionId);
      const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
      assert.deepEqual(
        assessPressureRoute(manifest.level, {
          segments: segmentRow[3],
          turnPolicy: row.turnPolicy,
          seed: row.seed,
          initialDelayTicks,
        }),
        row.lastFailure,
        key(row),
      );
    }
  });
  test(`fresh pressure clears, exact metrics and public replays: ${id}`, () => {
    for (const row of fixture.rows.filter((r) => r.chapter === id && r.chosen)) {
      const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
      const { initialDelayTicks: _delay, routeSourceDifficulty: _route, ...expected } = row.chosen;
      const result = assessPressureRoute(manifest.level, {
        segments: row.chosen.segments,
        turnPolicy: row.turnPolicy,
        seed: row.seed,
        replay: true,
      });
      assert.deepEqual(result, expected, key(row));
      assert.equal(result.losses, 0);
      assert(result.maxExposureTicks <= result.exposureTicks);
      assert(result.exposureTicks <= result.ticks);
    }
  });
  test(`equal independent pressure races for each passing route: ${id}`, () => {
    for (const row of fixture.rows.filter((r) => r.chapter === id && r.chosen)) {
      const manifest = resolveMission(project, row.missionId, {
        difficulty: row.difficulty,
        mode: 'versus',
      });
      const match = createDuel(
        manifest.level,
        { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      resumeDuel(match);
      for (const [direction, ticks] of row.chosen.segments)
        for (let i = 0; i < ticks; i++) {
          assert.equal(match.status, 'running', key(row));
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished', key(row));
      assert.equal(match.winner, null, key(row));
      assert(
        match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0),
        key(row),
      );
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        key(row),
      );
    }
  });
}

test('assessment rejects malformed/unbounded input and distinguishes unfinished routes from impossibility', () => {
  const row = fixture.rows.find((r) => r.chosen),
    level = resolveMission(project, row.missionId, { difficulty: row.difficulty }).level;
  const valid = { segments: [[null, 1]], turnPolicy: 'immediate' };
  for (const patch of [
    { segments: [] },
    { segments: [['warp', 10]] },
    { segments: [[null, 0]] },
    { segments: [[null, 120001]] },
    { initialDelayTicks: 1201 },
    { initialDelayTicks: -1 },
    { seed: 0 },
    { turnPolicy: 'unknown' },
  ])
    assert.throws(() => assessPressureRoute(level, { ...valid, ...patch }), /Invalid bounded/);
  const before = structuredClone(level),
    result = assessPressureRoute(level, valid);
  assert.equal(result.status, 'route-exhausted');
  assert.equal(result.losses, 0);
  assert.equal(result.firstCutTick, null);
  assert.equal(result.allRequiredCapturedTick, null);
  assert(!Object.hasOwn(result, 'segments'));
  assert.deepEqual(level, before);
});
