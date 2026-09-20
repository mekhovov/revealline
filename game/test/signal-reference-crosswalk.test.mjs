import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url)));

test('Signal crosswalk retains four exact observed reference pins and all seven original greyboxes', async () => {
  const crosswalk = await json('docs/research/signal-reference-crosswalk.json');
  const ledger = await json(crosswalk.ledger),
    project = compileContentProject(createSignalCandidates());
  assert.equal(crosswalk.format, 'SignalReferenceCrosswalkV1');
  assert.equal(crosswalk.status, 'greybox-feasibility-not-final-disposition');
  assert.equal(crosswalk.policyId, project.policy.id);
  assert.equal(crosswalk.references.length, 4);
  assert.equal(new Set(crosswalk.references.map((row) => row.designKey)).size, 4);
  for (const reference of crosswalk.references) {
    const observed = ledger.references.find((row) => row.designKey === reference.designKey);
    assert.equal(reference.sha256, observed.source.sha256);
    assert.equal(reference.bytes, observed.source.bytes);
    assert(crosswalk.review.files.includes(observed.source.file));
    assert.equal(reference.finalDisposition, false);
  }
  assert.deepEqual(
    crosswalk.missions.map((row) => row.id),
    project.missions.map((row) => row.id),
  );
  for (const row of crosswalk.missions) {
    const manifest = resolveMission(project, row.id);
    assert.equal(row.standardSimulationIdentity, manifest.simulationIdentity);
    assert.equal(row.backgroundAsset, null);
    assert.equal(manifest.background, null);
    assert.equal(row.masteryQualification, 'pending');
    assert(row.departureFromReference.length > 100);
    assert(row.distinctiveDecision.length > 60);
    for (const key of row.references)
      assert(crosswalk.references.some((ref) => ref.designKey === key));
  }
  assert.equal(crosswalk.evidence.humanValidation, 'pending');
  assert.equal(crosswalk.evidence.releaseValidation, 'pending');
  assert.equal(crosswalk.evidence.artworkValidation, 'not-produced');
});

test('Signal crosswalk pins all119 current full-clear and delayed routes without inventing acceptance', async () => {
  const crosswalk = await json('docs/research/signal-reference-crosswalk.json');
  let count = 0;
  for (const path of [crosswalk.evidence.clearRoutes, crosswalk.evidence.delayedRoutes]) {
    const fixture = await json(path);
    for (const set of fixture.sets) {
      const source = createSignalCandidates();
      if (set.bonuses === false) for (const mission of source.missions) mission.bonuses = [];
      const project = compileContentProject(source);
      assert.deepEqual(
        set.rows.map((row) => row[0]),
        crosswalk.missions.map((row) => row.id),
      );
      for (const [id, identity, checkpoint, segments] of set.rows) {
        assert.equal(
          identity,
          resolveMission(project, id, { difficulty: set.difficulty ?? fixture.difficulty })
            .simulationIdentity,
        );
        assert.match(checkpoint, /^[a-f0-9]{16}$/u);
        assert(segments.length > 0);
        count++;
      }
    }
  }
  assert.equal(count, 119);
  assert.equal(count, crosswalk.evidence.routeCount);
});
