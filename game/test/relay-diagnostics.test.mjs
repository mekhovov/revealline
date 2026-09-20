import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';

function chamber({ insideTrigger = false, occupied = true } = {}) {
  const source = createStarterProject(),
    map = source.maps[0],
    mission = source.missions[0];
  map.format = 'MapDesignV2';
  map.foundations = [];
  map.walls = [
    { x: 40, y: 8, w: 22, h: 1 },
    { x: 40, y: 28, w: 22, h: 1 },
    { x: 40, y: 9, w: 1, h: 7 },
    { x: 40, y: 20, w: 1, h: 8 },
    { x: 61, y: 9, w: 1, h: 19 },
  ];
  map.gates = [{ id: 'chamber-door', x: 40, y: 16, w: 1, h: 4 }];
  mission.format = 'MissionDesignV2';
  mission.actors[0].x = occupied ? 50.5 : 20.5;
  mission.actors[0].y = 18.5;
  mission.objectives = [
    { id: 'trigger', x: insideTrigger ? 50.5 : 20.5, y: 12.5, required: true },
    { id: 'inside', x: 52.5, y: 12.5, required: true },
  ];
  mission.relayLinks = [{ gateId: 'chamber-door', objectiveId: 'trigger' }];
  mission.coverage = 0.99;
  return source;
}
const inspect = (source) => resolveMission(compileContentProject(source), 'nearby-shore');

test('reachable relay trigger opens optimistic route diagnostics without claiming a proven solution', () => {
  const source = chamber(),
    before = structuredClone(source),
    result = inspect(source);
  assert.equal(result.topology.inaccessibleRetainedCells, 0);
  assert.equal(result.topology.optimisticCoverageCeiling, 1);
  assert.deepEqual(result.topology.relays.potentiallyOpenGateIds, ['chamber-door']);
  assert(
    result.topology.relays.optimisticReachableCells >
      result.topology.relays.initiallyReachableCells,
  );
  assert(!result.diagnostics.some((d) => d.code.startsWith('unreachable-')));
  assert.match(result.topology.assumption, /not proven capturable/);
  assert.deepEqual(source, before);
});

test('a retained trigger behind its own gate is a blocked dependency, not an assumed unlock', () => {
  const result = inspect(chamber({ insideTrigger: true }));
  assert.equal(result.topology.inaccessibleRetainedCells, 380);
  assert.deepEqual(result.topology.relays.blockedGateIds, ['chamber-door']);
  assert(result.diagnostics.some((d) => d.code === 'blocked-relay-dependency'));
  assert(
    result.diagnostics.some(
      (d) => d.code === 'unreachable-objective' && d.objectiveId === 'trigger',
    ),
  );
  assert(result.diagnostics.some((d) => d.code === 'unreachable-coverage-quota'));
});

test('remote empty-region capture can open a relay but remains visibly diagnosed as automatic fill', () => {
  const source = chamber({ insideTrigger: true, occupied: false });
  const result = inspect(source);
  assert.deepEqual(result.topology.relays.potentiallyOpenGateIds, ['chamber-door']);
  assert(!result.diagnostics.some((d) => d.code === 'blocked-relay-dependency'));
  assert(result.diagnostics.some((d) => d.code.includes('auto-fill')));
  const preview = prepareContentPreview(source, 'nearby-shore');
  assert.deepEqual(preview.capture.affectedGateIds, ['chamber-door']);
  assert(preview.capture.affectedObjectiveIds.includes('trigger'));
  assert.equal(preview.capture.reservedGateCells.length, 4);
  assert(
    preview.capture.reservedGateCells.every((cell) => !preview.capture.filledCells.includes(cell)),
  );
  assert.match(preview.capture.assumption, /legal closure must be verified/);
});

test('snapshot previews link secured-trail objectives without mutating gates or field retention', () => {
  const source = chamber(),
    trailCells = [12 * 72 + 20];
  const before = prepareContentPreview(source, 'nearby-shore');
  const after = prepareContentPreview(source, 'nearby-shore', { trailCells });
  assert.deepEqual(before.capture.affectedGateIds, ['chamber-door']); // Empty exterior fills regardless of the proposed trail.
  assert.deepEqual(after.capture.affectedGateIds, ['chamber-door']);
  assert(
    after.capture.components.some(
      (component) => component.retained && component.enemyIds.includes('keeper'),
    ),
  );
  assert.deepEqual(before.geometry.cells, after.geometry.cells);
  assert.deepEqual(after.capture.securedTrail, trailCells);
});
