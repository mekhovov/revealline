import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

const json = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url)));

test('opening reference crosswalk preserves source pins and accounts for every original greybox', async () => {
  const crosswalk = await json('../../docs/research/horizon-reference-crosswalk.json');
  const ledger = await json('../../docs/research/xposed-journey-ledger.json');
  const project = compileContentProject(createOpeningCandidates());
  assert.equal(crosswalk.format, 'HorizonReferenceCrosswalkV1');
  assert.equal(crosswalk.status, 'greybox-feasibility-not-final-disposition');
  const references = new Map(
    crosswalk.references.map((reference) => [reference.designKey, reference]),
  );
  assert.equal(references.size, 4);
  for (const reference of references.values()) {
    const observation = ledger.references.find((row) => row.designKey === reference.designKey);
    assert(observation, reference.designKey);
    assert.equal(reference.sha256, observation.source.sha256);
    assert.equal(reference.finalDisposition, false);
    assert(reference.spatialIdea.length > 20 && reference.adaptation.length > 40);
  }
  assert.deepEqual(
    crosswalk.missions.map((row) => row.id),
    project.missions.map((mission) => mission.id),
  );
  for (const row of crosswalk.missions) {
    assert.equal(
      row.standardSimulationIdentity,
      resolveMission(project, row.id).simulationIdentity,
      `${row.id}: renew design/route review when simulation changes`,
    );
    assert.equal(new Set(row.references).size, row.references.length);
    for (const key of row.references) assert(references.has(key), key);
    assert(row.departureFromReference.length > 40);
  }
  assert.deepEqual(
    crosswalk.missions.filter((row) => !row.references.length).map((row) => row.id),
    ['courtyard-return'],
  );
  assert.equal(crosswalk.evidence.humanValidation, 'pending');
  assert.equal(crosswalk.evidence.releaseValidation, 'pending');
});

test('crosswalk feasibility binds all six exact preset/control routes, not just mission names', async () => {
  const crosswalk = await json('../../docs/research/horizon-reference-crosswalk.json');
  const standard = await json(`../../${crosswalk.evidence.standardRoutes}`);
  const presets = await json(`../../${crosswalk.evidence.otherPresetRoutes}`);
  const project = compileContentProject(createOpeningCandidates());
  const sets = [
    { difficulty: 'standard', turnPolicy: 'immediate', rows: standard.rows },
    ...presets.sets,
  ];
  assert.deepEqual(sets.map((set) => `${set.difficulty}/${set.turnPolicy}`).sort(), [
    'expert/grid-center',
    'expert/immediate',
    'gentle/grid-center',
    'gentle/immediate',
    'standard/grid-center',
    'standard/immediate',
  ]);
  for (const set of sets) {
    assert.deepEqual(
      set.rows.map((row) => row[0]),
      crosswalk.missions.map((mission) => mission.id),
    );
    for (const [id, identity, checkpoint, segments] of set.rows) {
      assert.equal(
        identity,
        resolveMission(project, id, { difficulty: set.difficulty }).simulationIdentity,
      );
      assert.match(checkpoint, /^[a-f0-9]{16}$/u);
      assert(segments.length > 0);
    }
  }
});
