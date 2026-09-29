import test from 'node:test';
import assert from 'node:assert/strict';
import { encounterHelpModel } from '../ui/encounter-help.mjs';
import { validateLevel } from '../core/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { combatLevel } from './helpers/combat-fixture.mjs';

const topic = (id, players) => ({ id, players });

// Use the existing combined pressure/combat authoring fixture so applicability
// is derived from admitted core rules, not manufactured Help metadata.
function combinedLevel(role) {
  const source = createStarterProject('encounter-help-combined');
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
  const missionId = source.missions[0].id,
    prepared = prepareCombatAuthoring(source, missionId),
    edited = editContentActor(prepared, missionId, {
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
  // The compiler owns a frozen manifest; each test owns its editable fixture.
  return structuredClone(
    resolveMission(
      compileContentProject(setMissionCombatEnabled(edited, missionId, true)),
      missionId,
    ).level,
  );
}

function checkedModel(levels, topics) {
  for (const level of levels) {
    const validation = validateLevel(level);
    assert.equal(validation.valid, true, validation.errors.join('; '));
  }
  const before = structuredClone(levels),
    model = encounterHelpModel(levels);
  assert.deepEqual(model, { valid: true, topics });
  assert.deepEqual(levels, before, 'Reading Help must preserve both authored boards.');
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.topics));
  for (const row of model.topics) {
    assert.ok(Object.isFrozen(row));
    assert.ok(Object.isFrozen(row.players));
  }
  return model;
}

function invalidModel(levels) {
  const model = encounterHelpModel(levels);
  assert.deepEqual(model, { valid: false, topics: [] });
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.topics));
}

test('empty and valid boards without enabled encounter roles have no extra Help', () => {
  checkedModel([], []);
  const absent = combatLevel();
  delete absent.classic.combatPatrols;
  const disabled = combatLevel('scout');
  disabled.classic.combatPatrols.enabled = false;
  const empty = combatLevel();
  empty.classic.combatPatrols.actors = [];
  checkedModel([absent], []);
  checkedModel([disabled], []);
  checkedModel([empty], []);
  checkedModel([absent, disabled], []);
});

test('optional scouts and sentries remain distinct and repeated actors do not duplicate advice', () => {
  const scout = combatLevel('scout'),
    sentry = combatLevel();
  checkedModel([scout], [topic('optional-scout', [0])]);
  checkedModel([sentry], [topic('optional-sentry', [0])]);
  const both = combatLevel();
  both.classic.combatPatrols.actors.push(
    { ...scout.classic.combatPatrols.actors[0], id: 'scout-a' },
    { ...scout.classic.combatPatrols.actors[0], id: 'scout-b', x: 12.5 },
  );
  checkedModel([both], [topic('optional-scout', [0]), topic('optional-sentry', [0])]);
  checkedModel([both, both], [topic('optional-scout', [0, 1]), topic('optional-sentry', [0, 1])]);
});

for (const [role, id] of [
  ['trail-pursuer', 'trail-pursuit'],
  ['heading-interceptor', 'head-intercept'],
])
  test(`${role}: combined authored roles are independent of the optional patrol switch`, () => {
    const level = combinedLevel(role);
    checkedModel([level], [topic('optional-sentry', [0]), topic(id, [0])]);
    level.classic.combatPatrols.enabled = false;
    checkedModel([level], [topic(id, [0])]);
    delete level.classic.combatPatrols;
    checkedModel([level], [topic(id, [0])]);
  });

test('different boards preserve each player’s applicability in canonical topic order', () => {
  const first = combinedLevel('heading-interceptor'),
    second = combinedLevel('trail-pursuer');
  second.classic.combatPatrols.actors = combatLevel('scout').classic.combatPatrols.actors;
  checkedModel(
    [first, second],
    [
      topic('optional-scout', [1]),
      topic('optional-sentry', [0]),
      topic('trail-pursuit', [1]),
      topic('head-intercept', [0]),
    ],
  );
  checkedModel(
    [second, first],
    [
      topic('optional-scout', [0]),
      topic('optional-sentry', [1]),
      topic('trail-pursuit', [0]),
      topic('head-intercept', [1]),
    ],
  );
  const quiet = combatLevel();
  delete quiet.classic.combatPatrols;
  checkedModel([quiet, first], [topic('optional-sentry', [1]), topic('head-intercept', [1])]);
});

test('only a dense array of zero to two actual levels is accepted', () => {
  const level = combatLevel();
  for (const levels of [
    undefined,
    null,
    false,
    level,
    JSON.stringify([level]),
    { 0: level, length: 1 },
    [level, level, level],
    Array(1),
    [null],
    [undefined],
  ])
    invalidModel(levels);
});

test('one invalid board suppresses all advice, including valid roles on the other board', () => {
  const valid = combinedLevel('trail-pursuer');
  for (const mutate of [
    (level) => {
      level.version = 'xonix-level.v9';
    },
    (level) => {
      level.classic.combatPatrols.enabled = 'true';
    },
    (level) => {
      level.classic.combatPatrols.version = 'combat-patrols.v2';
    },
    (level) => {
      level.classic.combatPatrols.enabled = false;
      delete level.classic.combatPatrols.actors[0].speed;
    },
    (level) => {
      level.classic.enemyPressure.actors[0].id = 'missing-keeper';
    },
    (level) => {
      level.classic.enemyPressure.actors[0].mode = 'future-pressure';
    },
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    const before = structuredClone([valid, invalid]);
    assert.equal(validateLevel(invalid).valid, false, 'The rejection fixture must be invalid.');
    invalidModel([invalid]);
    invalidModel([valid, invalid]);
    invalidModel([invalid, valid]);
    assert.deepEqual([valid, invalid], before, 'Help must not repair or partially accept input.');
  }
});

test('accessor-bearing levels and board arrays are rejected without executing getters', () => {
  const valid = combatLevel();
  let reads = 0;
  const getter = () => {
    reads++;
    throw new Error('Help must inspect own data rather than invoke a getter.');
  };
  for (const key of ['version', 'classic']) {
    const level = structuredClone(valid);
    Object.defineProperty(level, key, { enumerable: true, get: getter });
    invalidModel([level]);
    invalidModel([valid, level]);
  }
  const levels = [valid];
  Object.defineProperty(levels, '0', { enumerable: true, get: getter });
  invalidModel(levels);
  assert.equal(reads, 0);
});

test('models own their immutable rows and a later refresh reflects replacement rules', () => {
  const levels = [combatLevel('scout')],
    first = checkedModel(levels, [topic('optional-scout', [0])]);
  assert.throws(() => first.topics.push(topic('optional-sentry', [0])), TypeError);
  assert.throws(() => first.topics[0].players.push(1), TypeError);
  levels[0].classic.combatPatrols.enabled = false;
  checkedModel(levels, []);
  levels[0] = combatLevel();
  checkedModel(levels, [topic('optional-sentry', [0])]);
  assert.deepEqual(first, { valid: true, topics: [topic('optional-scout', [0])] });
});
