import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENCOUNTER_GUIDE_TOPICS,
  encounterGuideEntry,
  encounterGuideAvailability,
  createEncounterGuideScenario,
} from '../encounter-guide.mjs';
import {
  createEnemyGuideScenario,
  enemyGuideEntry,
  enemyGuidePracticeInstructions,
} from '../enemy-guide.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { validateScenario } from '../content.mjs';
import { prepareScenario } from '../imports.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { combatLevel, combat, patrol } from './helpers/combat-fixture.mjs';

const theme = JSON.parse(
  readFileSync(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes.find((candidate) => candidate.id === 'horizon');
const topics = ['optional-scout', 'optional-sentry', 'trail-pursuit', 'head-intercept'];
const runOptions = { seed: 7, classId: 'scout', classRecipes: CLASSES };
const lesson = (topic, level, options = {}) =>
  createEncounterGuideScenario({
    topic,
    level,
    theme,
    turnPolicy: 'immediate',
    runOptions,
    ...options,
  });

// Reuse the authored setup and public-input routes from the existing combined
// pressure study. These fixtures are not new Guide missions or live-run patches.
function combinedLevel(role) {
  const source = createStarterProject('encounter-guide-combined');
  source.actorCatalogId = 'journey-actors-v9';
  source.difficultyCatalogId = 'journey-difficulty-v2';
  source.missions[0].actors[0] = {
    id: 'keeper',
    role,
    tier: 'measured',
    x: 40.5,
    y: 12.5,
    heading: [-1, -1],
  };
  const missionId = source.missions[0].id;
  const prepared = prepareCombatAuthoring(source, missionId);
  const edited = editContentActor(prepared, missionId, {
    action: 'add',
    id: 'optional-sentry',
    actor: {
      id: 'optional-sentry',
      role: 'optional-sentry',
      tier: 'measured',
      x: 44.5,
      y: 10.5,
      heading: [-1, 0],
    },
  });
  return resolveMission(
    compileContentProject(setMissionCombatEnabled(edited, missionId, true)),
    missionId,
  ).level;
}

function play(level, options, route) {
  const run = createRun(level, options),
    recorder = createRecorder(level, options),
    events = [];
  for (const [count, direction] of route)
    for (let tick = 0; tick < count && run.status === 'running'; tick++) {
      const input = { direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
      events.push(...structuredClone(run.events));
    }
  const replay = exportReplay(recorder, run);
  assert.equal(verifyReplay(replay).match, true);
  return { run, events, replay };
}

function playExactLesson(topic, level, turnPolicy, route, seed = 7) {
  const before = structuredClone(level),
    scenario = lesson(topic, level, {
      turnPolicy,
      runOptions: { ...runOptions, seed },
    }),
    options = { ...scenario.settings, classRecipes: scenario.classRecipes },
    original = play(level, { ...runOptions, seed, turnPolicy }, route),
    practice = play(scenario.level, options, route);
  assert.deepEqual(scenario.level, before);
  assert.deepEqual(
    level,
    before,
    'Preparing and playing a lesson cannot rewrite its loaded level.',
  );
  assert.deepEqual(practice.events, original.events);
  assert.deepEqual(authoritativeCheckpoint(practice.run), authoritativeCheckpoint(original.run));
  assert.deepEqual(practice.replay, original.replay);
  return practice;
}

test('encounter topics resolve concise EN/UK copy and distinguish removable bodies from live attacks', (t) => {
  const previous = getLocale();
  t.after(() => setLocale(previous, { persist: false }));
  assert.deepEqual(
    ENCOUNTER_GUIDE_TOPICS.map(({ id }) => id),
    topics,
  );
  assert.ok(Object.isFrozen(ENCOUNTER_GUIDE_TOPICS));
  const localized = {};
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    localized[locale] = Object.fromEntries(
      topics.map((topic) => {
        const entry = encounterGuideEntry(topic);
        assert.ok(Object.isFrozen(entry));
        assert.deepEqual(enemyGuideEntry(topic), entry);
        for (const field of ['label', 'form', 'spot', 'risk', 'try', 'note']) {
          assert.equal(typeof entry[field], 'string');
          assert.ok(
            entry[field].length > 5 && entry[field].length < 200,
            `${locale}/${topic}/${field}`,
          );
          assert.doesNotMatch(
            entry[field],
            /encounterGuide\.|studio\.actor\.counterplay\.|(?:interface|content):|\{\{/,
          );
        }
        const instructions = enemyGuidePracticeInstructions(topic);
        assert.doesNotMatch(instructions, /encounterGuide\.|\{\{/);
        assert.ok(instructions.length < 220);
        return [topic, entry];
      }),
    );
  }
  const english = localized.en;
  assert.match(english['optional-scout'].risk, /do not damage your craft or unfinished line/);
  assert.match(english['optional-scout'].try, /contact or enclose/);
  assert.match(english['optional-scout'].try, /Ordinary keepers still damage body and trail/);
  assert.match(english['optional-sentry'].spot, /Later steering does not move that aim/);
  assert.match(english['optional-sentry'].risk, /exposed craft, not its trail/);
  assert.match(english['optional-sentry'].risk, /recovering sentry can still have a live shot/);
  assert.match(english['optional-sentry'].risk, /do not cross it/);
  assert.match(english['trail-pursuit'].spot, /TRAIL.*unfinished line/);
  assert.match(english['head-intercept'].spot, /HEAD.*observed heading/);
  for (const topic of ['trail-pursuit', 'head-intercept'])
    assert.match(english[topic].risk, /Body contact remains dangerous during recovery/);
  for (const topic of topics) {
    assert.match(english[topic].note, /Other roles and attacks.*remain active/);
    assert.match(english[topic].note, /original spawn.*does not continue your paused cut/);
    assert.notEqual(localized.uk[topic].risk, english[topic].risk);
    assert.match(localized.uk[topic].risk, /[А-Яа-яІіЇїЄєҐґ]/);
  }
  assert.match(localized.uk['optional-sentry'].risk, /а не його лінії/);
  assert.match(localized.uk['optional-sentry'].risk, /під час відновлення/);
  assert.throws(() => encounterGuideEntry('unregistered-role'), TypeError);
});

test('availability requires a valid loaded role and keeps optional and pressure populations independent', () => {
  const scout = combatLevel('scout'),
    sentry = combinedLevel('trail-pursuer'),
    interceptor = combinedLevel('heading-interceptor');
  for (const [topic, level] of [
    ['optional-scout', scout],
    ['optional-sentry', sentry],
    ['trail-pursuit', sentry],
    ['head-intercept', interceptor],
  ]) {
    const before = structuredClone(level);
    assert.deepEqual(encounterGuideAvailability(topic, level), {
      available: true,
      reason: 'available',
    });
    assert.deepEqual(level, before);
  }
  const disabled = structuredClone(sentry);
  disabled.classic.combatPatrols.enabled = false;
  assert.deepEqual(encounterGuideAvailability('optional-sentry', disabled), {
    available: false,
    reason: 'unavailable',
  });
  assert.equal(encounterGuideAvailability('trail-pursuit', disabled).available, true);
  const absent = structuredClone(sentry);
  delete absent.classic.combatPatrols;
  const empty = structuredClone(sentry);
  empty.classic.combatPatrols.actors = [];
  for (const [topic, level] of [
    ['optional-sentry', absent],
    ['optional-sentry', empty],
    ['optional-sentry', scout],
    ['optional-scout', sentry],
    ['head-intercept', sentry],
    ['trail-pursuit', scout],
    ...topics.map((topic) => [topic, null]),
  ]) {
    assert.deepEqual(encounterGuideAvailability(topic, level), {
      available: false,
      reason: 'unavailable',
    });
    assert.throws(() => lesson(topic, level), TypeError);
  }
  assert.throws(() => lesson('optional-sentry', disabled), TypeError);
});

test('malformed, future and mismatched level definitions fail closed without repairs or getter reads', () => {
  const source = combinedLevel('trail-pursuer');
  for (const mutate of [
    (level) => {
      level.classic.combatPatrols.enabled = 'true';
    },
    (level) => {
      level.classic.combatPatrols.version = 'combat-patrols.v2';
    },
    (level) => {
      delete level.classic.combatPatrols.actors[0].speed;
    },
    (level) => {
      level.classic.combatPatrols.actors[0].id = level.enemies[0].id;
    },
    (level) => {
      level.classic.enemyPressure.version = 'enemy-pressure.v2';
    },
    (level) => {
      level.classic.enemyPressure.actors[0].id = 'missing-keeper';
    },
    (level) => {
      level.version = 'xonix-level.v9';
    },
    (level) => {
      level.version = 'xonix-level.v4';
    },
  ]) {
    const level = structuredClone(source);
    mutate(level);
    const before = structuredClone(level);
    for (const topic of ['optional-sentry', 'trail-pursuit']) {
      assert.deepEqual(encounterGuideAvailability(topic, level), {
        available: false,
        reason: 'invalid',
      });
      assert.throws(() => lesson(topic, level), TypeError);
    }
    assert.deepEqual(level, before);
  }
  let reads = 0;
  const accessor = { ...source };
  Object.defineProperty(accessor, 'classic', {
    enumerable: true,
    get() {
      reads++;
      return source.classic;
    },
  });
  assert.deepEqual(encounterGuideAvailability('optional-sentry', accessor), {
    available: false,
    reason: 'invalid',
  });
  assert.throws(() => lesson('optional-sentry', accessor), TypeError);
  assert.equal(reads, 0);
});

test('practice imports the exact already-tuned level, selected craft and setup as an independent copy', async () => {
  const authored = combatLevel();
  authored.rules.stopOnCapture = false;
  const level = applyGameplayTuning(authored, resolveGameplayTuning('expert')),
    classRecipes = structuredClone(CLASSES);
  classRecipes[0].id = 'guide-craft';
  classRecipes[0].label = 'Loaded custom craft';
  const options = { seed: 0xffffffff, classId: 'guide-craft', classRecipes },
    before = structuredClone({ level, theme, options });
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const scenario = createEnemyGuideScenario({
      topic: 'optional-sentry',
      themeId: 'retro',
      encounterTheme: theme,
      encounterLevel: level,
      turnPolicy,
      runOptions: options,
    });
    assert.equal(scenario.format, 'xonix-playground.v6');
    assert.equal(validateScenario(scenario).valid, true);
    assert.equal(scenario.masteryDefinition, null);
    assert.deepEqual(scenario.level, level);
    assert.equal(scenario.level.rules.stopOnCapture, false);
    assert.deepEqual(
      scenario.theme,
      theme,
      'The loaded theme wins over the Guide illustration picker.',
    );
    assert.deepEqual(scenario.settings, {
      seed: options.seed,
      classId: options.classId,
      turnPolicy,
    });
    assert.deepEqual(scenario.classRecipes, classRecipes);
    const prepared = (await prepareScenario(scenario)).scenario,
      expected = createRun(level, { ...options, turnPolicy }),
      actual = createRun(prepared.level, {
        ...prepared.settings,
        classRecipes: prepared.classRecipes,
      });
    assert.deepEqual(authoritativeCheckpoint(actual), authoritativeCheckpoint(expected));
    assert.equal(actual.tick, 0);
    assert.deepEqual(actual.trail, []);
    assert.equal(actual.player.cutting, false);
    assert.deepEqual({ x: actual.player.x, y: actual.player.y }, level.spawn);
    scenario.level.rules.moveSpeed = 1;
    scenario.classRecipes[0].label = 'Child edit';
    scenario.theme.name = 'Child theme';
    assert.deepEqual({ level, theme, options }, before);
    assert.deepEqual(prepared.level, level, 'Prepared child owns its own validated level.');
  }
});

test('unknown craft, invalid seed, steering and theme are rejected without fallback settings', () => {
  const level = combatLevel();
  for (const runOptions of [
    { seed: 7, classId: 'missing-craft', classRecipes: CLASSES },
    { seed: -1, classId: 'scout', classRecipes: CLASSES },
    { seed: 1.5, classId: 'scout', classRecipes: CLASSES },
    { seed: 7, classId: 'scout', classRecipes: [] },
  ])
    assert.throws(() => lesson('optional-sentry', level, { runOptions }), TypeError);
  assert.throws(() => lesson('optional-sentry', level, { turnPolicy: 'diagonal' }), TypeError);
  assert.throws(() => lesson('optional-sentry', level, { theme: { id: theme.id } }), TypeError);
  assert.throws(() => lesson('unregistered-role', level), TypeError);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: sentry lesson preserves locked aim, live recovery shot and replay identity`, () => {
    const { run, events } = playExactLesson('optional-sentry', combatLevel(), turnPolicy, [
      [300, 'right'],
      [80, 'down'],
    ]);
    const lock = events.find(({ type }) => type === 'combat.locked'),
      shot = events.find(({ type }) => type === 'combat.fired');
    assert.equal(lock.tick, 240);
    assert.equal(shot.tick, 360);
    assert.equal(shot.tick, lock.warningUntil);
    assert.deepEqual(shot.aim, lock.aim);
    assert.notDeepEqual(shot.aim, { x: run.player.x, y: run.player.y });
    assert.equal(patrol(run).phase, 'recovery');
    assert.equal(combat(run).projectiles.length, 1);
    assert.equal(run.lives, 3);
  });

  test(`${turnPolicy}: closing the loaded return cancels the sentry warning before it fires`, () => {
    const level = combatLevel();
    level.goal.coverage = 0.9;
    level.foundations = [{ x: 1, y: 20, w: 70, h: 1 }];
    const { run, events } = playExactLesson('optional-sentry', level, turnPolicy, [
      [300, 'right'],
      [30, 'down'],
    ]);
    const lock = events.find(({ type }) => type === 'combat.locked'),
      closure = events.find(({ type }) => type === 'cut.closed'),
      cancelled = events.find(({ type }) => type === 'combat.cancelled');
    assert.ok(closure.tick < lock.warningUntil);
    assert.equal(cancelled.tick, closure.tick);
    assert.equal(cancelled.reason, 'capture');
    assert.ok(!events.some(({ type }) => type === 'combat.fired'));
    assert.equal(combat(run).projectiles.length, 0);
    assert.equal(run.player.cutting, false);
    assert.equal(run.lives, 3);
  });

  for (const cause of ['ram', 'capture'])
    test(`${turnPolicy}: scout lesson allows ${cause} without removing the ordinary keeper`, () => {
      const level = combatLevel('scout');
      if (cause === 'capture') level.classic.combatPatrols.actors[0].y = 25.5;
      const { run, events } = playExactLesson('optional-scout', level, turnPolicy, [
        [cause === 'ram' ? 150 : 900, 'right'],
      ]);
      assert.equal(events.find(({ type }) => type === 'combat.eliminated').cause, cause);
      assert.equal(patrol(run).alive, false);
      assert.deepEqual(
        run.enemies.map(({ id }) => id),
        ['keeper'],
      );
      assert.equal(run.lives, 3);
    });

  for (const [role, topic] of [
    ['trail-pursuer', 'trail-pursuit'],
    ['heading-interceptor', 'head-intercept'],
  ])
    test(`${turnPolicy}/${topic}: the same combined lesson keeps both attacks and real closure counterplay`, () => {
      const level = combinedLevel(role);
      assert.deepEqual(lesson(topic, level), lesson('optional-sentry', level));
      const { run, events } = playExactLesson(
        topic,
        level,
        turnPolicy,
        [
          [480, null],
          [140, 'right'],
          [240, 'down'],
        ],
        1,
      );
      const warning = events.find(({ type }) => type === 'pressure.warning'),
        committed = events.find(({ type }) => type === 'pressure.committed'),
        lock = events.find(({ type }) => type === 'combat.locked'),
        shot = events.find(({ type }) => type === 'combat.fired');
      assert.equal(warning.id, 'keeper');
      assert.equal(committed.tick - warning.tick, 90);
      assert.deepEqual(committed.target, warning.target);
      assert.equal(lock.id, 'optional-sentry');
      assert.equal(shot.actorId, 'optional-sentry');
      assert.equal(shot.tick - lock.tick, 180);
      assert.deepEqual(shot.aim, lock.aim);
      assert.equal(run.enemies[0].classic.pressure.phase, 'committed');
      assert.equal(patrol(run).phase, 'recovery');
      assert.equal(combat(run).projectiles.length, 1);
      assert.equal(run.lives, 3);
      const safe = playExactLesson(
        'optional-sentry',
        level,
        turnPolicy,
        [
          [480, null],
          [300, 'down'],
        ],
        1,
      );
      const capture = safe.events.find(({ type }) => type === 'cells.claimed');
      assert.ok(capture.indices.length > 0);
      assert.ok(safe.events.some(({ type }) => type === 'pressure.committed'));
      assert.ok(safe.events.some(({ type }) => type === 'combat.locked'));
      for (const [type, reason] of [
        ['pressure.cancelled', 'trail-closed'],
        ['combat.cancelled', 'capture'],
      ])
        assert.ok(
          safe.events.some(
            (event) =>
              event.type === type && event.reason === reason && event.tick === capture.tick,
          ),
        );
      assert.ok(!safe.events.some(({ type }) => type === 'combat.fired'));
      assert.equal(safe.run.lives, 3);
    });
}
