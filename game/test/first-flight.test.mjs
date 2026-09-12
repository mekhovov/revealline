import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_FLIGHT_LESSONS,
  getFirstFlightLesson,
  resolveCourseRequest,
  createLessonScenario,
  captureLessonFacts,
  createLessonObserver,
} from '../first-flight.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { validateScenario } from '../content.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createAttempt, feedAttempt, segment, theme } from './first-flight-helpers.mjs';

const query = (value) => resolveCourseRequest(new URLSearchParams(value));
const clone = (value) => structuredClone(value);

test('finite course query allows exact lessons, default policy and the existing session-bound preview bridge', () => {
  assert.equal(query(''), null);
  assert.deepEqual(query('course=first-flight'), {
    course: 'first-flight',
    lessonId: 'close-line',
  });
  for (const { id: lessonId } of FIRST_FLIGHT_LESSONS)
    for (const turnPolicy of ['immediate', 'grid-center'])
      assert.deepEqual(
        query(
          `course=first-flight&lesson=${lessonId}&turn-policy=${turnPolicy}&controller-preview=1&controller-session=${'a'.repeat(32)}`,
        ),
        { course: 'first-flight', lessonId, turnPolicy },
      );
  assert.ok(Object.isFrozen(query('course=first-flight')));
});
test('ambiguous or conflicting course queries cannot fall through to the ordinary game', () => {
  for (const input of [
    'course=other',
    'course=',
    'course=first-flight&course=first-flight',
    'course=first-flight&lesson=close-line&lesson=empty-side',
    'course=first-flight&turn-policy=immediate&turn-policy=immediate',
    'course=first-flight&lesson=other',
    'course=first-flight&lesson=',
    'course=first-flight&turn-policy=other',
    'course=first-flight&practice=1',
    'course=first-flight&practice=0',
    'lesson=close-line',
    `course=first-flight&extra=${'x'.repeat(4096)}`,
  ])
    assert.throws(() => query(input));
  assert.throws(() => resolveCourseRequest({ get: () => 'first-flight' }));
});
test('registry metadata and finite markers are immutable, local and bounded', () => {
  assert.equal(FIRST_FLIGHT_LESSONS.length, 3);
  for (const lesson of FIRST_FLIGHT_LESSONS) {
    assert.equal(getFirstFlightLesson(lesson.id), lesson);
    assert.ok(Object.isFrozen(lesson.steps[0]) && Object.isFrozen(lesson.instructions));
    for (const marker of lesson.markers)
      assert.ok(
        marker.x >= 0 &&
          marker.y >= 0 &&
          marker.w > 0 &&
          marker.h > 0 &&
          marker.x + marker.w <= 48 &&
          marker.y + marker.h <= 36,
      );
    assert.ok(lesson.instructions.join(' ').length < 1400);
  }
  assert.throws(() => getFirstFlightLesson('__proto__'));
  assert.throws(() => {
    FIRST_FLIGHT_LESSONS[0].steps[0].id = 'reward';
  });
});
test('scenario factory validates owned FPV visuals while binding sole unchanged Scout and legacy rules', () => {
  const original = clone(theme);
  for (const lesson of FIRST_FLIGHT_LESSONS) {
    const value = createLessonScenario(lesson.id, { theme });
    assert.equal(validateScenario(value).valid, true);
    assert.equal(value.format, 'xonix-playground.v1');
    assert.equal(value.level.version, 'xonix-level.v1');
    assert.deepEqual(value.classRecipes, [CLASSES.find((c) => c.id === 'scout')]);
    assert.deepEqual(value.settings, { classId: 'scout', seed: 1, turnPolicy: 'immediate' });
    assert.deepEqual(value.level.hangars, []);
    value.theme.palette.safe = '#123456';
    value.level.enemies[0].x = 1.5;
    assert.notEqual(createLessonScenario(lesson.id, { theme }).level.enemies[0].x, 1.5);
  }
  assert.deepEqual(theme, original);
});
test('theme injection rejects absent, non-FPV and accessor-bearing cosmetic data before adoption', () => {
  assert.throws(() => createLessonScenario('close-line'));
  assert.throws(() => createLessonScenario('close-line', { theme: { ...theme, id: 'ukraine' } }));
  assert.throws(() => createLessonScenario('close-line', { theme, turnPolicy: 'other' }));
  let called = 0;
  const bad = clone(theme);
  Object.defineProperty(bad, 'palette', {
    enumerable: true,
    get() {
      called++;
      return theme.palette;
    },
  });
  assert.throws(() => createLessonScenario('close-line', { theme: bad }));
  assert.equal(called, 0);
});
test('facts require the explicit host attempt and exact normalized lesson, roster, recipe, policy and seed', () => {
  const a = createAttempt();
  assert.throws(() => captureLessonFacts(a.run));
  for (const change of [
    (r) => {
      r.level.rules.moveSpeed++;
    },
    (r) => {
      r.rules = { ...r.rules, lives: 2 };
    },
    (r) => {
      r.classRecipe.cooldown++;
    },
    (r) => {
      r.classRecipes[0].radius++;
    },
    (r) => {
      r.activeClassId = 'carrier';
    },
    (r) => {
      r.seed = 2;
    },
    (r) => {
      r.turnPolicy = 'other';
    },
    (r) => {
      r.levelId = 'signal-01';
    },
  ]) {
    const run = createRun(a.scenario.level, a.options);
    change(run);
    assert.throws(() => captureLessonFacts(run, { runId: 'test' }));
  }
});
test('captured facts and returned guidance have independent ownership and leave the core unchanged', () => {
  const a = createAttempt();
  const checkpoint = authoritativeCheckpoint(a.run);
  const facts = captureLessonFacts(a.run, { runId: a.runId });
  assert.ok(Object.isFrozen(facts.cells) && Object.isFrozen(facts.setup));
  assert.throws(() => {
    facts.cells[48 + 1] = 1;
  });
  const output = a.observer.snapshot();
  output.steps[0].status = 'complete';
  assert.equal(a.observer.snapshot().steps[0].status, 'current');
  assert.deepEqual(authoritativeCheckpoint(a.run), checkpoint);
  feedAttempt(a, [segment('down', 12)]);
  assert.equal(facts.tick, 0);
  assert.equal(facts.player.y, 0.5);
});
test('observer requires a fresh attempt and rejects imported initial getters without executing them', () => {
  const a = createAttempt();
  feedAttempt(a, [segment('down', 1)]);
  assert.equal(
    createLessonObserver({ lessonId: 'empty-side', runId: a.runId, initial: a.facts }).snapshot()
      .available,
    false,
  );
  let calls = 0;
  const bad = clone(a.initial);
  Object.defineProperty(bad, 'cells', {
    enumerable: true,
    get() {
      calls++;
      return a.initial.cells;
    },
  });
  assert.equal(
    createLessonObserver({ lessonId: 'empty-side', runId: a.runId, initial: bad }).snapshot()
      .available,
    false,
  );
  assert.equal(calls, 0);
  assert.equal(
    createLessonObserver({ lessonId: 'empty-side', runId: 'other', initial: a.initial }).snapshot()
      .available,
    false,
  );
});
test('bounded facts reject unknown fields, sparse cells, overflow, prototypes and unknown events', () => {
  const source = createAttempt().initial;
  const changes = [
    (f) => {
      f.extra = true;
    },
    (f) => {
      delete f.cells[100];
    },
    (f) => {
      f.tick = 216001;
    },
    (f) => {
      f.cells[100] = 2;
    },
    (f) => {
      f.events = [{ type: 'award', tick: 0 }];
    },
    (f) => {
      Object.defineProperty(f, '__proto__', { value: {}, enumerable: true });
    },
  ];
  for (const change of changes) {
    const bad = clone(source);
    change(bad);
    const observer = createLessonObserver({
      lessonId: 'empty-side',
      runId: 'first-flight-proof',
      initial: bad,
    });
    assert.equal(observer.snapshot().available, false);
    assert.ok(observer.snapshot().steps.every((step) => step.status !== 'complete'));
  }
});
test('zero-time sampling and ordinary pause release cannot grant or erase lesson steps', () => {
  const a = createAttempt();
  const before = a.observer.snapshot();
  assert.deepEqual(a.observer.observe(a.facts, a.facts), before);
  stepRun(a.run, { direction: 'down' }, 0);
  assert.deepEqual(
    a.observer.observe(a.facts, captureLessonFacts(a.run, { runId: a.runId })),
    before,
  );
});
test('a skipped tick, repeated older step or changed run identity disables guidance without awarding a step', () => {
  for (const change of ['gap', 'repeat', 'identity', 'ownership']) {
    const a = createAttempt();
    const before = a.facts;
    stepRun(a.run, { direction: 'down' }, FIXED_DT);
    const after = captureLessonFacts(a.run, { runId: a.runId });
    if (change === 'gap') {
      stepRun(a.run, { direction: 'down' }, FIXED_DT);
      a.observer.observe(before, captureLessonFacts(a.run, { runId: a.runId }));
    } else if (change === 'repeat') {
      a.observer.observe(before, after);
      a.observer.observe(before, after);
    } else {
      const bad = clone(after);
      if (change === 'identity') bad.setup.runId = 'different';
      else bad.cells[48 + 1] = 1;
      a.observer.observe(before, bad);
    }
    assert.equal(a.observer.snapshot().available, false);
    assert.ok(a.observer.snapshot().steps.every((s) => s.status !== 'complete'));
    assert.deepEqual(
      a.observer.observe(before, after),
      a.observer.snapshot(),
      'Unavailable observer stays closed.',
    );
  }
});
test('malformed closure cannot grant credit even when its terminal flags look successful', () => {
  const a = createAttempt('close-line');
  feedAttempt(a, [segment('down', 413)]);
  const before = a.facts;
  stepRun(a.run, { direction: 'down' }, FIXED_DT);
  const bad = clone(captureLessonFacts(a.run, { runId: a.runId }));
  bad.events = bad.events.filter((e) => e.type !== 'run.completed');
  a.observer.observe(before, bad);
  assert.equal(a.observer.snapshot().available, false);
  assert.equal(a.observer.snapshot().steps[0].status, 'current');
});
test('set equality accepts reordered owned trail and claim arrays for the same actual closure', () => {
  const a = createAttempt('empty-side');
  feedAttempt(a, [segment('down', 413)]);
  const before = clone(a.facts);
  before.trail.reverse();
  stepRun(a.run, { direction: 'down' }, FIXED_DT);
  const after = clone(captureLessonFacts(a.run, { runId: a.runId }));
  after.events.find((e) => e.type === 'cells.claimed').indices.reverse();
  a.observer.observe(before, after);
  assert.equal(a.observer.snapshot().available, true);
  assert.equal(a.observer.snapshot().steps[0].status, 'complete');
});
test('retained-territory guidance is tied to the actual nonterminal failed cut and resets on terminal loss', () => {
  const a = createAttempt('empty-side');
  feedAttempt(a, [segment('down', 420), segment('up', 216), segment('left', 60)]);
  const cells = [...a.run.cells];
  feedAttempt(a, [segment('right', 1)]);
  assert.equal(a.run.status, 'respawning');
  assert.equal(a.observer.snapshot().territoryKept, true);
  assert.equal(a.observer.snapshot().steps[0].status, 'complete');
  assert.deepEqual([...a.run.cells], cells);
  for (let life = 2; life > 0; life--) {
    feedAttempt(a, [
      segment(null, 83),
      segment('down', 204),
      segment('left', 60),
      segment('right', 1),
    ]);
  }
  assert.equal(a.run.status, 'lost');
  assert.equal(a.observer.snapshot().outcome, 'lost');
  assert.equal(a.observer.snapshot().territoryKept, false);
  assert.equal(a.observer.snapshot().steps[0].status, 'complete');
  assert.equal(createAttempt('empty-side').observer.snapshot().steps[0].status, 'current');
});
