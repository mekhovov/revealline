import test from 'node:test';
import assert from 'node:assert/strict';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, CELL } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  createSentinelGoalEvidence,
  observeSentinelGoal,
  inspectSentinelGoal,
} from './helpers/sentinel-goal.mjs';

const project = compileContentProject(createSentinelCandidates());
const fixture = (id) => ({
  missionId: id,
  run: createRun(resolveMission(project, id).level),
  evidence: createSentinelGoalEvidence(),
});

test('Sentinel observers are read-only, initially false and reject unknown goals', () => {
  for (const mission of project.missions) {
    const f = fixture(mission.id),
      before = authoritativeCheckpoint(f.run);
    observeSentinelGoal(f.run, f.evidence);
    assert.equal(inspectSentinelGoal(f).achieved, false);
    assert.equal(inspectSentinelGoal(f).condition, false);
    assert.deepEqual(authoritativeCheckpoint(f.run), before);
  }
  assert.throws(
    () => inspectSentinelGoal({ ...fixture('first-relay'), missionId: 'unknown' }),
    /Unknown/,
  );
});

// These isolated arrangements test evidence boundaries, not playable solutions.
function captured(f, id, tick) {
  f.run.tick = tick;
  f.run.objectives.find((o) => o.id === id).captured = true;
  f.run.events = [
    { type: 'cut.closed', tick },
    { type: 'objective.captured', id, tick },
  ];
  observeSentinelGoal(f.run, f.evidence);
}
function finish(f) {
  f.run.status = 'won';
  f.run.encounter.defeated = true;
}

test('separate shield captures require actual distinct closure ticks in the requested order', () => {
  const f = fixture('twin-receivers');
  captured(f, 'east-shield', 10);
  captured(f, 'west-shield', 20);
  finish(f);
  assert.equal(inspectSentinelGoal(f).achieved, true);
  f.evidence.shields.set('west-shield', 10);
  assert.equal(
    inspectSentinelGoal(f).condition,
    false,
    'One closure is not two separate captures.',
  );
  f.evidence.shields.set('west-shield', 9);
  assert.equal(inspectSentinelGoal(f).condition, false, 'West first does not satisfy east first.');
  const crown = fixture('crown-audience');
  crown.run.level.encounter.shieldObjectiveIds.forEach((id, i) => captured(crown, id, 10 + i));
  finish(crown);
  assert.equal(inspectSentinelGoal(crown).achieved, true);
  crown.evidence.shields.set('southeast-shield', 12);
  assert.equal(inspectSentinelGoal(crown).condition, false);
});

test('first-opening goal cannot count duplicate observations, stale events, a second opening or an unfinished run', () => {
  const f = fixture('first-relay');
  captured(f, 'chamber-shield', 10);
  const event = {
    id: 'sentinel',
    tick: 20,
    type: 'encounter.phaseChanged',
    stage: 'exposed',
    phase: 'open',
    phaseStartTick: 20,
  };
  f.run.tick = 20;
  f.run.events = [event];
  observeSentinelGoal(f.run, f.evidence);
  observeSentinelGoal(f.run, f.evidence);
  f.run.tick = 21;
  observeSentinelGoal(f.run, f.evidence);
  assert.equal(f.evidence.openings.size, 1);
  f.run.tick = 30;
  f.run.events = [
    {
      type: 'encounter.defeated',
      id: 'sentinel',
      tick: 30,
      cause: 'cut-release',
      qualifyingCutCells: 8,
    },
  ];
  observeSentinelGoal(f.run, f.evidence);
  assert.equal(inspectSentinelGoal(f).condition, true);
  assert.equal(inspectSentinelGoal(f).achieved, false);
  finish(f);
  assert.equal(inspectSentinelGoal(f).achieved, true);
  f.run.classic.livesLost = 1;
  assert.equal(inspectSentinelGoal(f).achieved, false);
  f.run.classic.livesLost = 0;
  f.evidence.defeat.opening = 2;
  assert.equal(inspectSentinelGoal(f).condition, false);
});

test('corner traversal must use both open reclaimed connectors before the final shield', () => {
  const f = fixture('relay-perimeter');
  captured(f, 'west-shield', 10);
  captured(f, 'east-shield', 30);
  captured(f, 'north-shield', 40);
  finish(f);
  f.evidence.used.set('corner-top', 20);
  assert.equal(inspectSentinelGoal(f).condition, false);
  f.evidence.used.set('corner-side', 40);
  assert.equal(
    inspectSentinelGoal(f).condition,
    false,
    'Same-tick traversal is not before the final shield.',
  );
  f.evidence.used.set('corner-side', 25);
  assert.equal(inspectSentinelGoal(f).achieved, true);
});

test('Remix goal requires a real opened-dock visit and sixteen fresh release cells, not total filled area or isolated release', () => {
  const f = fixture('sentinel-remix'),
    gate = f.run.relay.gates[0],
    cell = gate.cells[0];
  Object.assign(f.run.player, {
    x: (cell % f.run.width) + 0.5,
    y: Math.floor(cell / f.run.width) + 0.5,
  });
  for (const [tick, openedTick, cellType, cutting] of [
    [1, null, CELL.SAFE, false],
    [2, 3, CELL.SAFE, false],
    [3, 1, CELL.FIELD, false],
    [4, 1, CELL.SAFE, true],
  ]) {
    f.run.tick = tick;
    gate.openedTick = openedTick;
    f.run.cells[cell] = cellType;
    f.run.player.cutting = cutting;
    observeSentinelGoal(f.run, f.evidence);
    assert.equal(f.evidence.used.size, 0);
  }
  f.run.tick = 5;
  f.run.player.cutting = false;
  observeSentinelGoal(f.run, f.evidence);
  assert.equal(f.evidence.used.get('release-dock'), 5);
  f.run.level.encounter.shieldObjectiveIds.forEach((id, i) => captured(f, id, 10 + i));
  finish(f);
  f.evidence.defeat = { tick: 20, opening: 1, cause: 'cut-release', cutCells: 15 };
  assert.equal(inspectSentinelGoal(f).condition, false);
  f.evidence.defeat.cutCells = 16;
  assert.equal(inspectSentinelGoal(f).achieved, true);
  f.evidence.defeat.cause = 'isolated';
  assert.equal(inspectSentinelGoal(f).condition, false);
  f.evidence.defeat.cause = 'cut-release';
  f.evidence.used.set('release-dock', 20);
  assert.equal(inspectSentinelGoal(f).condition, false);
});
