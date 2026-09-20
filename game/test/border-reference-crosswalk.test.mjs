import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url)));
test('Border spatial crosswalk binds original source pins, all seven current missions and original asset revisions', async () => {
  const crosswalk = await json('docs/research/border-reference-crosswalk.json');
  const ledger = await json(crosswalk.ledger);
  const project = compileContentProject(createBorderCandidates({ artwork: true }));
  assert.equal(crosswalk.format, 'BorderReferenceCrosswalkV1');
  assert.equal(crosswalk.status, 'greybox-feasibility-not-final-disposition');
  assert.equal(crosswalk.policyId, project.policy.id);
  assert.equal(crosswalk.evidence.humanValidation, 'pending');
  assert.equal(crosswalk.evidence.releaseValidation, 'pending');
  assert.deepEqual(
    crosswalk.missions.map((row) => row.id),
    project.missions.map((row) => row.id),
  );
  const keys = new Set();
  for (const reference of crosswalk.references) {
    assert(!keys.has(reference.designKey));
    keys.add(reference.designKey);
    assert.equal(reference.finalDisposition, false);
    assert.equal(
      reference.sha256,
      ledger.references.find((row) => row.designKey === reference.designKey).source.sha256,
    );
  }
  for (const row of crosswalk.missions) {
    const manifest = resolveMission(project, row.id);
    assert.equal(row.standardSimulationIdentity, manifest.simulationIdentity);
    assert.deepEqual(row.backgroundAsset, manifest.background);
    assert(row.departureFromReference.length > 60 && row.distinctiveDecision.length > 50);
    for (const key of row.references) assert(keys.has(key));
  }
  assert.deepEqual(
    crosswalk.missions.filter((row) => !row.references.length).map((row) => row.id),
    ['return-pocket'],
  );
});
test('Border crosswalk evidence covers exact current clear and delayed routes without inventing acceptance', async () => {
  const crosswalk = await json('docs/research/border-reference-crosswalk.json');
  const ids = crosswalk.missions.map((row) => row.id);
  let total = 0;
  for (const filename of [crosswalk.evidence.clearRoutes, crosswalk.evidence.delayedRoutes]) {
    const fixture = await json(filename);
    for (const set of fixture.sets) {
      const source = createBorderCandidates();
      if (set.bonuses === false) for (const mission of source.missions) mission.bonuses = [];
      const project = compileContentProject(source);
      assert.deepEqual(
        set.rows.map((row) => row[0]),
        ids,
      );
      for (const [id, identity, checkpoint, segments] of set.rows) {
        assert.equal(
          identity,
          resolveMission(project, id, { difficulty: set.difficulty ?? fixture.difficulty })
            .simulationIdentity,
        );
        assert.match(checkpoint, /^[a-f0-9]{16}$/u);
        assert(segments.length > 0);
        total++;
      }
    }
  }
  assert.equal(total, 119);
});
