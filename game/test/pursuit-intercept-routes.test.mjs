import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPursuitInterceptCandidates } from '../content-design/pursuit-intercept-candidates.mjs';
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
  await readFile(new URL('./fixtures/pursuit-intercept-clear-routes.json', import.meta.url)),
);
const project = compileContentProject(createPursuitInterceptCandidates());
for (const { difficulty, turnPolicy, rows } of fixture.sets) {
  test(`six played pressure variants clear, warn and replay without loss: ${difficulty}/${turnPolicy}`, () => {
    assert.deepEqual(
      rows.map((r) => r[0]),
      project.missions.map((m) => m.id),
    );
    let commits = 0;
    for (const [id, identity, checkpoint, segments, expectedEvents] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      const options = { seed: fixture.seed, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options),
        events = {};
      for (const [direction, ticks] of segments)
        for (let i = 0; i < ticks; i++) {
          assert.equal(run.status, 'running', id);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, manifest.level.rules.lives, id);
          for (const event of run.events.filter((e) => e.type.startsWith('pressure.'))) {
            const key = `${event.id}:${event.type}`;
            events[key] = (events[key] ?? 0) + 1;
            if (event.type === 'pressure.committed') commits++;
          }
        }
      assert.equal(run.status, 'won', id);
      assert.deepEqual(events, expectedEvents, id);
      assert(
        Object.keys(events).some((k) => k.endsWith('pressure.warning')),
        `${id} must expose the role, not merely avoid it`,
      );
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, id);
    }
    assert(
      commits > 0,
      'The preset/steering arc must exercise actual committed attacks as well as warning cancellation.',
    );
  });
  test(`six equal independent pressure races finish without loss: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, , , segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty, mode: 'versus' });
      const match = createDuel(
        manifest.level,
        { seed: fixture.seed, classId: 'scout', turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      resumeDuel(match);
      for (const [direction, ticks] of segments)
        for (let i = 0; i < ticks; i++) {
          assert.equal(match.status, 'running', id);
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished', id);
      assert.equal(match.winner, null, id);
      assert(
        match.runs.every((r) => r.status === 'won' && r.lives === manifest.level.rules.lives),
        id,
      );
      assert.notEqual(
        match.runs[0].enemies[0].classic.pressure,
        match.runs[1].enemies[0].classic.pressure,
      );
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        id,
      );
    }
  });
}
