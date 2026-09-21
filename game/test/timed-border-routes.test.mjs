import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { createTimedBorderCandidates } from '../content-design/timed-border-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/border-clear-routes.json', import.meta.url)),
);
const ids = ['behind-the-patrol', 'second-landing', 'long-rail'];
const sources = new Map(
  [true, false].map((fixed) => {
    const source = createTimedBorderCandidates();
    if (!fixed) for (const mission of source.missions) mission.bonuses = [];
    return [fixed, compileContentProject(source)];
  }),
);

test('timed Border is an explicit three-mission study, not new maps or a historical rewrite', () => {
  const original = createBorderCandidates(),
    before = structuredClone(original);
  const study = createTimedBorderCandidates();
  assert.deepEqual(createBorderCandidates(), before);
  assert.deepEqual(study.maps, original.maps);
  assert.deepEqual(study.assets, original.assets);
  assert.notEqual(study.id, original.id);
  assert.match(study.name, /unvalidated/);
  assert.deepEqual(
    study.missions.filter((m) => m.timedBonuses).map((m) => m.id),
    ids,
  );
  const oldProject = compileContentProject(original);
  for (const mission of study.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const current = resolveMission(sources.get(true), mission.id, { difficulty });
      const old = resolveMission(oldProject, mission.id, { difficulty });
      assert.equal(
        current.simulationIdentity === old.simulationIdentity,
        !ids.includes(mission.id),
      );
      assert.deepEqual(
        resolveMission(sources.get(true), mission.id, { difficulty, mode: 'versus' }).level,
        current.level,
      );
      assert.equal(current.officialProgressEligible, false);
    }
});

for (const { bonuses, difficulty, turnPolicy, rows } of fixture.sets) {
  const label = `${difficulty}/${turnPolicy}/${bonuses ? 'fixed-available' : 'no-fixed'}`;
  test(`timed Border clear/replay with every window missed: ${label}`, () => {
    for (const [id, , , segments] of rows.filter((row) => ids.includes(row[0]))) {
      const manifest = resolveMission(sources.get(bonuses), id, { difficulty });
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      let appearances = 0;
      for (const [direction, ticks] of segments)
        for (let n = 0; n < ticks; n++) {
          assert.equal(run.status, 'running', id);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, manifest.level.rules.lives, id);
          appearances += run.events.filter((e) => e.type === 'bonus.appeared').length;
        }
      assert.equal(run.status, 'won', id);
      assert(appearances > 0, `${id}: test must exercise a live optional window`);
      assert(
        run.classic.timedBonuses.schedules.every((s) => s.collections === 0),
        id,
      );
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, id);
    }
  });
  test(`timed Border paired-board clear and equal schedule checkpoints: ${label}`, () => {
    for (const [id, , , segments] of rows.filter((row) => ids.includes(row[0]))) {
      const manifest = resolveMission(sources.get(bonuses), id, { difficulty, mode: 'versus' });
      const match = createDuel(
        manifest.level,
        { seed: 1, classId: 'scout', turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      assert.notEqual(match.runs[0].classic.timedBonuses, match.runs[1].classic.timedBonuses);
      resumeDuel(match);
      for (const [direction, ticks] of segments)
        for (let n = 0; n < ticks; n++) {
          assert.equal(match.status, 'running', id);
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished', id);
      assert.equal(match.winner, null, id);
      assert(
        match.runs.every((run) => run.status === 'won' && run.lives === manifest.level.rules.lives),
        id,
      );
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        id,
      );
    }
  });
}
