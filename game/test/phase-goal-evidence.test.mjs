import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhaseCandidates } from '../content-design/phase-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun } from '../core/index.mjs';
import {
  createPhaseGoalEvidence,
  observePhaseGoal,
  inspectPhaseGoal,
  phaseBeforeStep,
} from './helpers/phase-goal.mjs';

const source = createPhaseCandidates();
const project = compileContentProject(source);
const makeRun = () => createRun(resolveMission(project, 'phase-remix').level, { seed: 1 });

test('mastery evidence requires a real closure and capture-cleared pre-existing playerward front', () => {
  for (const reason of ['ended', 'recovery', 'capture'])
    for (const closed of [false, true])
      for (const matching of [false, true]) {
        const run = makeRun(),
          evidence = createPhaseGoalEvidence(run);
        // Synthetic events exercise the test predicate, not a gameplay replay.
        run.events = [
          { type: 'lineImpact.cleared', reason, ids: [7] },
          ...(closed ? [{ type: 'cut.closed' }] : []),
        ];
        observePhaseGoal(run, evidence, {
          trail: [],
          activeRoamer: false,
          playerFrontIds: matching ? [7] : [8],
        });
        assert.equal(evidence.impactClosure, closed && matching && reason === 'capture');
        assert.equal(evidence.activeImpactClosure, false);
      }
});

test('a new seed or capture-triggered roamer warning cannot counterfeit simultaneous mastery', () => {
  const run = makeRun(),
    evidence = createPhaseGoalEvidence(run);
  const before = phaseBeforeStep(run);
  assert.equal(before.activeRoamer, false);
  assert.deepEqual(before.playerFrontIds, []);
  run.events = [
    { type: 'lineImpact.seeded', ids: [7] },
    { type: 'lineImpact.cleared', reason: 'capture', ids: [7] },
    { type: 'cut.closed' },
  ];
  observePhaseGoal(run, evidence, before);
  assert.equal(evidence.impactClosure, false);
  assert.equal(evidence.activeClosure, false);
  assert.equal(evidence.activeImpactClosure, false);
});

test('active-roamer and impact conditions must coincide in one closure for the Remix', () => {
  const run = makeRun(),
    evidence = createPhaseGoalEvidence(run);
  run.events = [
    { type: 'cut.closed' },
    { type: 'lineImpact.cleared', reason: 'capture', ids: [7] },
  ];
  observePhaseGoal(run, evidence, { trail: [], activeRoamer: false, playerFrontIds: [7] });
  run.events = [{ type: 'cut.closed' }];
  observePhaseGoal(run, evidence, { trail: [], activeRoamer: true, playerFrontIds: [] });
  assert.equal(evidence.impactClosure, true);
  assert.equal(evidence.activeClosure, true);
  assert.equal(evidence.activeImpactClosure, false);
  run.events.push({ type: 'lineImpact.cleared', reason: 'capture', ids: [8] });
  observePhaseGoal(run, evidence, { trail: [], activeRoamer: true, playerFrontIds: [8] });
  assert.equal(evidence.activeImpactClosure, true);
});

test('a running mission or any lost life cannot satisfy optional mastery', () => {
  const run = makeRun(),
    evidence = createPhaseGoalEvidence(run);
  evidence.impactClosure = true;
  const foundations = source.maps[0].foundations;
  const inspect = () =>
    inspectPhaseGoal({ missionId: 'return-in-reserve', run, foundations, evidence });
  assert.equal(inspect().achieved, false);
  run.status = 'won';
  assert.equal(inspect().achieved, true);
  run.classic.livesLost = 1;
  assert.equal(inspect().achieved, false);
  assert.throws(
    () => inspectPhaseGoal({ missionId: 'unknown', run, foundations, evidence }),
    /Unknown/,
  );
});
