import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, getSummary } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  authoritativeCheckpoint,
  verifyReplay,
} from '../replay.mjs';
import {
  createLessonScenario,
  captureLessonFacts,
  createLessonObserver,
} from '../first-flight.mjs';
export const theme = JSON.parse(
  await readFile(new URL('../content/themes.json', import.meta.url), 'utf8'),
).themes.find((value) => value.id === 'fpv');
export const segment = (direction, ticks, extras = {}) => ({
  input: { direction, boost: false, action: false, pickup: false, ...extras },
  ticks,
});
export const ordinarySegments = (lessonId, row = 17) =>
  lessonId === 'close-line'
    ? [segment('down', 414)]
    : [
        segment('down', 420),
        segment('up', (35 - row) * 12),
        segment(
          lessonId === 'empty-side' ? 'left' : 'right',
          lessonId === 'empty-side' ? 282 : 270,
        ),
      ];
export const recoverySegments = () => [
  segment('down', 420),
  segment('up', 216),
  segment('left', 60),
  segment('right', 1),
  segment(null, 83),
  segment('down', 204),
  segment('left', 282),
];
export const alternateSegments = () => [
  segment('left', 288),
  segment('down', 204),
  segment('right', 558),
];
export const lossSegments = () => [
  segment('down', 96),
  segment('up', 1),
  segment(null, 83),
  segment('down', 96),
  segment('up', 1),
  segment(null, 83),
  segment('down', 96),
  segment('up', 1),
];
export function createAttempt(
  lessonId = 'empty-side',
  turnPolicy = 'immediate',
  runId = 'first-flight-proof',
) {
  const scenario = createLessonScenario(lessonId, { theme, turnPolicy });
  const options = { ...scenario.settings, classRecipes: scenario.classRecipes };
  const run = createRun(scenario.level, options);
  const recorder = createRecorder(scenario.level, options, 'first-flight-proof.v1');
  const initial = captureLessonFacts(run, { runId });
  const observer = createLessonObserver({ lessonId, runId, initial });
  return { scenario, options, run, recorder, observer, initial, runId, facts: initial };
}
export function feedAttempt(attempt, segments, { observe = true, onStep = () => {} } = {}) {
  const { run, recorder, runId, observer } = attempt;
  for (const segment of segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      assert.ok(
        ['running', 'respawning'].includes(run.status),
        'Proof inputs must stop at terminal state.',
      );
      const before = attempt.facts;
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
      const after = captureLessonFacts(run, { runId });
      if (observe) {
        observer.observe(before, after);
        assert.equal(
          observer.snapshot().available,
          true,
          observer.snapshot().error ?? 'Lesson unavailable.',
        );
      }
      attempt.facts = after;
      onStep(before, after, observer.snapshot());
    }
  return attempt;
}
export function proveRoute(route) {
  const attempt = createAttempt(route.lessonId, route.turnPolicy);
  const closures = [],
    failures = [],
    recoveries = [];
  feedAttempt(attempt, route.segments, {
    onStep(before, after, lesson) {
      if (after.events.some((e) => e.type === 'cut.closed'))
        closures.push({
          tick: after.tick,
          trail: before.trail,
          claimed: after.events.find((e) => e.type === 'cells.claimed').indices,
          enemyCells: after.enemies.map((e) => Math.floor(e.y) * 48 + Math.floor(e.x)),
          objectives: after.objectives,
          lesson,
        });
      if (after.events.some((e) => e.type === 'player.failed'))
        failures.push({ tick: after.tick, lives: after.lives, lesson });
      if (after.events.some((e) => e.type === 'player.respawned'))
        recoveries.push({ tick: after.tick, lives: after.lives, lesson });
    },
  });
  const replay = exportReplay(attempt.recorder, attempt.run);
  assert.equal(verifyReplay(replay).match, true);
  return {
    summary: getSummary(attempt.run),
    checkpoint: authoritativeCheckpoint(attempt.run),
    lesson: attempt.observer.snapshot(),
    setup: attempt.initial.setup,
    closures,
    failures,
    recoveries,
  };
}
