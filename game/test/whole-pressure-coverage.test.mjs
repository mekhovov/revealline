import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

const project = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const historical = await read('journey-pressure-route-assessment');
const refinements = await Promise.all(
  [
    'livewire-pressure-clear-routes',
    'late-journey-pressure-routes',
    'relay-fracture-pressure-routes',
    'opening-pressure-routes',
    'middle-pressure-routes',
  ].map(read),
);
const key = (r) => [r.id ?? r.missionId, r.difficulty, r.turnPolicy].join('/');

test('the actual pinned evidence inventory covers all498 pressure manifests, without replacing historical successes', () => {
  // Inventory/identity check. Per-packet tests execute the public replays and races.
  const selected = new Map(historical.rows.filter((r) => r.chosen).map((r) => [key(r), r]));
  const historicalKeys = new Set(selected.keys());
  assert.equal(historicalKeys.size, 312);
  for (const fixture of refinements) {
    assert.equal(fixture.projectRevision, project.source.revision);
    for (const row of fixture.rows) {
      assert.equal(row.status, 'won');
      assert.equal(row.metrics.status, 'no-loss-clear');
      assert.equal(row.checkpoint, row.metrics.checkpoint);
      // The original Livewire packet pins seed1 in its scope/replay verifier,
      // while later packet versions store it on every row. Preserve that edition.
      const seed = row.seed ?? (fixture.format === 'LivewirePressureFeasibilityV1' ? 1 : undefined);
      if (!selected.has(key(row))) selected.set(key(row), { ...row, seed });
    }
  }
  const expected = project.missions.flatMap((m) =>
    ['gentle', 'standard', 'expert'].flatMap((difficulty) =>
      ['immediate', 'grid-center'].map((turnPolicy) => key({ id: m.id, difficulty, turnPolicy })),
    ),
  );
  assert.equal(project.missions.length, 83);
  assert.equal(expected.length, 498);
  assert.deepEqual([...selected.keys()].sort(), expected.sort());
  for (const row of selected.values()) {
    const manifest = resolveMission(project, row.id ?? row.missionId, {
      difficulty: row.difficulty,
    });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity, key(row));
    assert.equal(row.seed, 1, key(row));
    if (historicalKeys.has(key(row))) assert(row.chosen, 'preserve the original passing route');
  }
});
