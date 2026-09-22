import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRelayGoalEvidence,
  relayBeforeStep,
  observeRelayGoal,
  inspectRelayGoal,
} from './helpers/relay-goal.mjs';

function snapshot(overrides = {}) {
  return {
    status: 'won',
    tick: 30,
    width: 10,
    player: { x: 2.5, y: 1.5 },
    classic: { livesLost: 0 },
    events: [],
    relay: { gates: [] },
    level: { foundations: [{ x: 2, y: 1, w: 2, h: 2 }] },
    ...overrides,
  };
}
const opened = (id, openedTick) => ({ id, openedTick, cells: [12, 13] });
const inspect = (missionId, run, evidence = createRelayGoalEvidence()) =>
  inspectRelayGoal({ missionId, run, evidence });

test('relay observations are read-only, and only opened occupied connectors count as used', () => {
  const run = snapshot({
    relay: {
      gates: [
        opened('closed', null),
        opened('used', 10),
        { id: 'elsewhere', openedTick: 10, cells: [99] },
      ],
    },
  });
  const original = structuredClone(run),
    evidence = createRelayGoalEvidence();
  observeRelayGoal(run, evidence, relayBeforeStep(run));
  assert.deepEqual(run, original);
  assert.deepEqual([...evidence.used], ['used']);
  assert.deepEqual([...evidence.landingVisits], [[0, 30]]);
});

test('alternate-order goals reject tied, reversed and missing openings', () => {
  for (const [mission, first, second] of [
    ['second-approach', 'east-bridge', 'west-bridge'],
    ['nested-relays', 'lower-link', 'inner-link'],
  ]) {
    for (const [a, b, expected] of [
      [10, 20, true],
      [10, 10, false],
      [20, 10, false],
      [null, 20, false],
      [10, null, false],
    ]) {
      const run = snapshot({ relay: { gates: [opened(first, a), opened(second, b)] } });
      assert.equal(inspect(mission, run).achieved, expected);
    }
  }
});

test('landing goals require post-opening visits, not merely initial platform occupancy', () => {
  const run = snapshot({
    relay: {
      gates: [opened('south-bridge', 10), opened('west-link', 10), opened('east-link', 20)],
    },
  });
  const evidence = createRelayGoalEvidence();
  evidence.used.add('south-bridge');
  for (const visit of [9, 10, 11]) {
    evidence.landingVisits.set(1, visit);
    evidence.landingVisits.set(2, 21);
    assert.equal(inspect('first-link', run, evidence).achieved, visit > 10);
    assert.equal(inspect('three-compounds', run, evidence).achieved, visit > 10);
  }
  evidence.landingVisits.set(2, 20);
  assert.equal(inspect('three-compounds', run, evidence).achieved, false);
  evidence.used.clear();
  assert.equal(inspect('first-link', run, evidence).achieved, false);
});

test('consecutive-capture goal requires different triggers without an intervening capture', () => {
  const gate = (objectiveId) => ({ type: 'relay.opened', objectiveId });
  for (const [events, expected] of [
    [[gate('a'), gate('b')], false],
    [[{ type: 'cut.closed' }, gate('a'), gate('a')], false],
    [[{ type: 'cut.closed' }, gate('a'), gate('b')], true],
  ]) {
    const run = snapshot({ events }),
      evidence = createRelayGoalEvidence();
    observeRelayGoal(run, evidence, relayBeforeStep(run));
    assert.equal(inspect('spiral-stores', run, evidence).achieved, expected);
  }
  const evidence = createRelayGoalEvidence();
  for (const id of ['a', 'b']) {
    const run = snapshot({ events: [{ type: 'cut.closed' }, gate(id)] });
    observeRelayGoal(run, evidence, relayBeforeStep(run));
  }
  assert.equal(evidence.simultaneous, false);
  assert.equal(inspect('spiral-stores', snapshot(), evidence).achieved, true);
  for (const gap of [1, 2, 3]) {
    const separated = createRelayGoalEvidence();
    const steps = [[gate('a')], ...Array.from({ length: gap }, () => []), [gate('b')]];
    for (const events of steps) {
      const run = snapshot({ events: [{ type: 'cut.closed' }, ...events] });
      observeRelayGoal(run, separated, relayBeforeStep(run));
    }
    assert.equal(inspect('spiral-stores', snapshot(), separated).achieved, false);
  }
});

test('impact goal requires capture clearing the same previously active player-directed front', () => {
  for (const [direction, reason, id, hasRelay, hasCut, expected] of [
    [1, 'capture', 'front', true, true, true],
    [-1, 'capture', 'front', true, true, false],
    [1, 'failure', 'front', true, true, false],
    [1, 'capture', 'unrelated', true, true, false],
    [1, 'capture', 'front', false, true, false],
    [1, 'capture', 'front', true, false, false],
  ]) {
    const before = relayBeforeStep(
      snapshot({ classic: { lineImpact: { fronts: [{ id: 'front', direction }] } } }),
    );
    const run = snapshot({
      events: [
        ...(hasCut ? [{ type: 'cut.closed' }] : []),
        ...(hasRelay ? [{ type: 'relay.opened', objectiveId: 'relay' }] : []),
        { type: 'lineImpact.cleared', reason, ids: [id] },
      ],
    });
    const evidence = createRelayGoalEvidence();
    observeRelayGoal(run, evidence, before);
    assert.equal(inspect('relay-remix', run, evidence).achieved, expected);
  }
});

test('conditions alone never certify an unfinished or life-loss clear', () => {
  const evidence = createRelayGoalEvidence();
  evidence.used.add('west-junction');
  assert.equal(inspect('watchpost-exchange', snapshot(), evidence).achieved, false);
  evidence.used.add('east-junction');
  assert.equal(inspect('watchpost-exchange', snapshot(), evidence).achieved, true);
  for (const run of [snapshot({ status: 'running' }), snapshot({ classic: { livesLost: 1 } })]) {
    const goal = inspect('watchpost-exchange', run, evidence);
    assert.equal(goal.condition, true);
    assert.equal(goal.achieved, false);
  }
  assert.throws(() => inspect('unknown', snapshot()), /Unknown/);
});
