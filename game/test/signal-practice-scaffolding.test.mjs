import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';

const source = createSignalCandidates({ artwork: true });
const project = compileContentProject(source);
const cases = [
  ['dry-spine', 'up', 'slow-field'],
  ['garden-refuges', 'down', 'lethal-field'],
];

test('Signal practice warnings stay visible and refer to an already introduced rule', () => {
  const inspection = inspectContentPacing(source, { packIds: ['journey-signal'] });
  for (const [id, , lesson] of cases) {
    const index = source.missions.findIndex((m) => m.id === id);
    assert(source.missions[index - 1].design.introduces.includes(lesson));
    assert(source.missions[index].design.practices.includes(lesson));
    assert.deepEqual(source.missions[index].design.introduces, []);
    assert(
      inspection.diagnostics.some(
        (d) =>
          d.missionId === id &&
          d.code === 'combination-before-selected-practice' &&
          d.lessons.includes(lesson),
      ),
    );
  }
});

test('sampled Signal practice starts have a clear first return without entering either marked material', () => {
  let checked = 0;
  for (const [id, direction] of cases)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center'])
        for (const seed of [1, 7, 19, 37, 101])
          for (const delay of [0, 60, 240]) {
            const manifest = resolveMission(project, id, { difficulty });
            const map = source.maps.find(
              (m) => m.id === source.missions.find((m) => m.id === id).map.id,
            );
            const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
            for (let i = 0; i < delay; i++) stepRun(run, { direction: null }, FIXED_DT);
            let closure = false;
            for (let i = 0; i < 400 && !closure; i++) {
              stepRun(run, { direction }, FIXED_DT);
              assert.equal(
                run.classic.livesLost,
                0,
                `${id}/${difficulty}/${turnPolicy}/${seed}/${delay}`,
              );
              const x = Math.floor(run.player.x),
                y = Math.floor(run.player.y);
              assert(
                !map.terrain.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h),
              );
              closure = run.events.some((e) => e.type === 'capture.stopped');
            }
            assert(closure);
            assert.equal(run.player.speed, 0);
            assert(run.coverage > 0 && run.coverage < 0.01);
            assert.equal(run.status, 'running');
            // Each practice still has two separate material decisions after the
            // short return. This is not a board-clearing tutorial bypass.
            assert.equal(map.terrain.length, 2);
            checked++;
          }
  assert.equal(checked, 180);
});
