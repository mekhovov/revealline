import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { tuneContentMission } from '../content-design/tuning.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';

test('mission tuning changes authored target/deadline but preserves global physics and preset policy', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  const next = tuneContentMission(source, 'nearby-shore', { coverage: 0.72, timeLimitSeconds: 90 });
  assert.deepEqual(source, before);
  assert.deepEqual(next.maps, source.maps);
  assert.deepEqual(next.missions[0].actors, source.missions[0].actors);
  assert.notEqual(next.missions[0].revision, source.missions[0].revision);
  for (const [difficulty, lives] of [
    ['gentle', 5],
    ['standard', 3],
    ['expert', 2],
  ]) {
    const level = resolveMission(compileContentProject(next), 'nearby-shore', { difficulty }).level;
    assert.equal(level.goal.coverage, 0.72);
    assert.equal(level.rules.timeLimitSeconds, difficulty === 'gentle' ? 0 : 90);
    assert.equal(level.rules.moveSpeed, 10);
    assert.equal(level.rules.lives, lives);
  }
});

test('difficulty ratings preserve simulation and cannot escape any parent campaign band', () => {
  const source = createStarterProject(),
    original = structuredClone(source);
  const before = resolveMission(compileContentProject(source), 'nearby-shore').simulationIdentity;
  const tuned = tuneContentMission(source, 'nearby-shore', {
    difficulty: { ...source.missions[0].design.difficulty, band: 2, planning: 2 },
  });
  assert.equal(
    resolveMission(compileContentProject(tuned), 'nearby-shore').simulationIdentity,
    before,
  );
  assert.throws(
    () =>
      tuneContentMission(source, 'nearby-shore', {
        difficulty: { ...source.missions[0].design.difficulty, band: 3 },
      }),
    /band/,
  );
  assert.deepEqual(source, original);
});

test('invalid or privileged edits are refused atomically; undo restores exact authored tuning', () => {
  const source = createStarterProject(),
    original = structuredClone(source);
  for (const edit of [
    {},
    { coverage: 0 },
    { coverage: 1.01 },
    { timeLimitSeconds: -1 },
    { timeLimitSeconds: 1.5 },
    { timeLimitSeconds: 601 },
    { difficulty: { band: 1 } },
    { moveSpeed: 99 },
    { lives: 99 },
    { officialProgressEligible: true },
  ]) {
    assert.throws(() => tuneContentMission(source, 'nearby-shore', edit));
    assert.deepEqual(source, original);
  }
  assert.throws(() => tuneContentMission(source, 'missing', { coverage: 0.5 }), /existing mission/);
  const history = createDraftHistory(source);
  history.replace(tuneContentMission(source, 'nearby-shore', { coverage: 0.7 }));
  assert.equal(history.current().missions[0].coverage, 0.7);
  assert.deepEqual(history.undo(), original);
  assert.equal(history.redo().missions[0].coverage, 0.7);
});
