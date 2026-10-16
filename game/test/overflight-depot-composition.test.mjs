import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import { createOverflightRun, spawnOverflightEnemy } from '../overflight/core.mjs';

test('Depot courier encounters combine a normal front, a fast interceptor and bounded standoff support', () => {
  const base = createOverflightProject({ rulesVersion: 3, encounterSet: 'crossing' });
  const project = createOverflightProject({
    rulesVersion: 3,
    encounterSet: 'crossing',
    world: 'freight-depot',
  });
  assert.deepEqual(
    project.encounters.map((item) => item.spawnPerSecond),
    base.encounters.map((item) => item.spawnPerSecond),
    'composition never silently reduces density',
  );
  const run = createOverflightRun(compileOverflightProject(project));
  for (const encounter of project.encounters.filter((item) => item.pattern === 'flank')) {
    const actors = encounter.families.map((family) =>
      spawnOverflightEnemy(run, {
        family,
        speed: 58,
        pattern: encounter.pattern,
      }),
    );
    assert.ok(actors.some((actor) => actor.speed === 58 && !actor.specialist));
    assert.ok(actors.some((actor) => actor.speed === 96));
    assert.ok(actors.some((actor) => actor.family === 'radar-truck' && actor.specialist));
    assert.ok(
      actors.filter((actor) => actor.speed === 96).length < actors.length / 2,
      'the full ordinary budget cannot become fast flankers',
    );
  }
  assert.notEqual(
    compileOverflightProject(project).projectIdentity,
    compileOverflightProject(base).projectIdentity,
  );
});
