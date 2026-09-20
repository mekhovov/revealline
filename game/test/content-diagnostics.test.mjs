import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

function enclosed({ occupied = true, required = true } = {}) {
  const source = createStarterProject();
  source.maps[0].foundations = [];
  source.maps[0].walls = [
    { x: 40, y: 8, w: 22, h: 1 },
    { x: 40, y: 28, w: 22, h: 1 },
    { x: 40, y: 9, w: 1, h: 19 },
    { x: 61, y: 9, w: 1, h: 19 },
  ];
  source.missions[0].actors[0].x = occupied ? 50.5 : 20.5;
  source.missions[0].actors[0].y = 18.5;
  source.missions[0].objectives = [{ id: 'remote', x: 50.5, y: 12.5, required, hidden: false }];
  source.missions[0].coverage = 0.99;
  return source;
}

test('shared resolution identifies an impossible required objective and optimistic quota ceiling', () => {
  const source = enclosed(),
    before = structuredClone(source);
  const result = resolveMission(compileContentProject(source), 'nearby-shore');
  assert.equal(result.topology.inaccessibleRetainedCells, 380);
  assert(result.topology.optimisticCoverageCeiling < 0.99);
  assert(
    result.diagnostics.some((d) => d.code === 'unreachable-objective' && d.severity === 'error'),
  );
  assert(
    result.diagnostics.some(
      (d) => d.code === 'unreachable-coverage-quota' && d.severity === 'error',
    ),
  );
  assert.equal(result.officialProgressEligible, false);
  assert.deepEqual(source, before);
});

test('empty remote chambers and objectives are diagnosed as automatic fill, not falsely impossible', () => {
  const result = resolveMission(
    compileContentProject(enclosed({ occupied: false })),
    'nearby-shore',
  );
  assert.equal(result.topology.inaccessibleRetainedCells, 0);
  assert.equal(result.topology.optimisticCoverageCeiling, 1);
  assert(result.diagnostics.some((d) => d.code === 'remote-auto-fill'));
  assert(result.diagnostics.some((d) => d.code === 'remote-objective-auto-fill'));
  assert.equal(
    result.diagnostics.some((d) => d.code.startsWith('unreachable-')),
    false,
  );
});

test('optional inaccessible objectives warn without masquerading as completion blockers', () => {
  const source = enclosed({ required: false });
  source.missions[0].coverage = 0.5;
  const result = resolveMission(compileContentProject(source), 'nearby-shore');
  assert(
    result.diagnostics.some((d) => d.code === 'unreachable-objective' && d.severity === 'warning'),
  );
  assert.equal(
    result.diagnostics.some((d) => d.severity === 'error'),
    false,
  );
});

test('all opening candidates avoid known unreachable objectives, impossible quotas and initial empty auto-fill', () => {
  const project = compileContentProject(createOpeningCandidates());
  for (const mission of project.missions) {
    const result = resolveMission(project, mission.id);
    assert.equal(result.topology.inaccessibleRetainedCells, 0, mission.id);
    assert.equal(result.topology.diagnostics.length, 0, mission.id);
    assert.match(result.topology.assumption, /not a solution/);
  }
});
