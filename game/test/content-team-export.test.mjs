import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { createCoop } from '../coop/core.mjs';

test('Studio exports precisely one selected Team mission from the shared compiler at all presets', () => {
  const source = createTeamOpeningCandidates();
  const before = structuredClone(source);
  const identities = new Set();
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const pack = createTeamTestPack(source, 'twin-landings', difficulty);
    const manifest = resolveMission(compileContentProject(source), 'twin-landings', {
      mode: 'team',
      difficulty,
    });
    assert.deepEqual(pack.levels, [manifest.level]);
    assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
    assert.equal(createCoop(pack.levels[0]).difficulty, difficulty);
    assert(Object.isFrozen(pack));
    assert(Object.isFrozen(pack.levels[0]));
    assert.deepEqual(createTeamTestPack(source, 'twin-landings', difficulty), pack);
    identities.add(pack.revision);
  }
  assert.equal(identities.size, 3);
  assert.deepEqual(source, before);
});

test('Team export refuses another mode, missing mission, bad preset and known impossible quota', () => {
  const source = createTeamOpeningCandidates();
  assert.throws(() => createTeamTestPack(createStarterProject(), 'nearby-shore'), /mode/);
  assert.throws(() => createTeamTestPack(source, 'missing'));
  assert.throws(() => createTeamTestPack(source, 'twin-landings', 'random'));
  source.maps[0].walls = [
    { x: 30, y: 3, w: 12, h: 1 },
    { x: 30, y: 12, w: 12, h: 1 },
    { x: 30, y: 4, w: 1, h: 8 },
    { x: 41, y: 4, w: 1, h: 8 },
  ];
  source.missions[0].coverage = 0.99;
  assert.throws(() => createTeamTestPack(source, 'twin-landings'), /topology errors/);
});
