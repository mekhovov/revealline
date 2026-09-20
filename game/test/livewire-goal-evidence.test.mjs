import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun } from '../core/index.mjs';
import {
  createLivewireGoalEvidence,
  livewireBeforeStep,
  observeLivewireGoal,
  inspectLivewireGoal,
} from './helpers/livewire-goal.mjs';

const source = createLivewireCandidates(),
  project = compileContentProject(source);
const make = (id = 'read-the-lock') => createRun(resolveMission(project, id).level, { seed: 1 });

test('warning evidence needs actual prior trail overlap, on either axis, and a closure', () => {
  for (const axis of ['horizontal', 'vertical'])
    for (const phase of ['idle', 'warning', 'active'])
      for (const overlap of [false, true])
        for (const closed of [false, true]) {
          const run = make(),
            evidence = createLivewireGoalEvidence(run);
          const actor = run.enemies.find((e) => e.type === 'lane-boss');
          // Synthetic states test the evidence predicate only, not engine feasibility.
          Object.assign(actor, { axis, bossPhase: phase, lane: 10.5 });
          run.trail = [{ x: overlap ? 10 : 20, y: overlap ? 10 : 20, index: 730 }];
          const before = livewireBeforeStep(run);
          run.events = closed ? [{ type: 'cut.closed' }] : [];
          observeLivewireGoal(run, evidence, before);
          assert.equal(evidence.warningClosure, phase === 'warning' && overlap && closed);
        }
});

test('a same-tick warning cannot invent a pre-existing exposed warning trail', () => {
  const run = make(),
    evidence = createLivewireGoalEvidence(run);
  const before = livewireBeforeStep(run);
  run.events = [{ type: 'boss.warning' }, { type: 'cut.closed' }];
  observeLivewireGoal(run, evidence, before);
  assert.equal(evidence.warningClosure, false);
  assert.deepEqual(before.playerFrontIds, [], 'Non-impact missions have no impact fronts');
});

test('Remix requires an already-active roamer and a matching capture-cleared front in one closure', () => {
  const run = make('livewire-remix'),
    evidence = createLivewireGoalEvidence(run);
  run.events = [
    { type: 'cut.closed' },
    { type: 'lineImpact.cleared', reason: 'capture', ids: [7] },
  ];
  observeLivewireGoal(run, evidence, {
    trail: [],
    warningTrail: false,
    activeRoamer: false,
    playerFrontIds: [7],
  });
  observeLivewireGoal(run, evidence, {
    trail: [],
    warningTrail: false,
    activeRoamer: true,
    playerFrontIds: [8],
  });
  assert.equal(evidence.activeImpactClosure, false);
  observeLivewireGoal(run, evidence, {
    trail: [],
    warningTrail: false,
    activeRoamer: true,
    playerFrontIds: [7],
  });
  assert.equal(evidence.activeImpactClosure, true);
});

test('optional goals never award an unfinished or life-losing attempt', () => {
  const run = make(),
    evidence = createLivewireGoalEvidence(run);
  evidence.warningClosure = true;
  const inspect = () =>
    inspectLivewireGoal({
      missionId: 'read-the-lock',
      run,
      foundations: source.maps[0].foundations,
      evidence,
    });
  assert.equal(inspect().achieved, false);
  run.status = 'won';
  assert.equal(inspect().achieved, true);
  run.classic.livesLost = 1;
  assert.equal(inspect().achieved, false);
  assert.throws(
    () =>
      inspectLivewireGoal({
        missionId: 'unknown',
        run,
        foundations: source.maps[0].foundations,
        evidence,
      }),
    /Unknown/,
  );
});
