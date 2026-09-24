import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCreatorProject,
  verifyCreatorRoutes,
  validateCreatorProvenance,
} from '../creator/templates.mjs';

test('both bounded variants replay actual generated identities in every Solo preset and steering policy', async () => {
  for (const seed of [0, 1]) {
    const made = generateCreatorProject({ id: `image-${seed}`, name: 'My pictures', seed });
    assert.deepEqual(
      made,
      generateCreatorProject({ id: `image-${seed}`, name: 'My pictures', seed }),
    );
    const routes = await verifyCreatorRoutes(made.project, made.provenance);
    assert.equal(routes.length, 6);
    for (const route of routes) {
      assert.equal(route.seed, seed);
      assert.equal(route.replay.level.id, made.provenance.missionId);
      assert.equal(route.replay.options.seed, seed);
      assert.equal(route.replay.summary.won, true);
      assert.equal(route.kind, 'automated');
    }
    assert.deepEqual(
      new Set(routes.map((r) => r.difficulty)),
      new Set(['gentle', 'standard', 'expert']),
    );
    assert.deepEqual(
      new Set(routes.map((r) => r.turnPolicy)),
      new Set(['immediate', 'grid-center']),
    );
  }
});

test('artwork and labels preserve simulation evidence, while a gameplay edit invalidates template approval', async () => {
  const made = generateCreatorProject({ id: 'picture', name: 'First collection', seed: 20 });
  const original = await verifyCreatorRoutes(made.project, made.provenance);
  const edited = structuredClone(made.project);
  edited.missions[0].name = 'A renamed picture';
  edited.assets.push({
    format: 'AssetRevisionV1',
    id: 'poster',
    revision: '1',
    kind: 'reveal-background',
    path: 'content-design/assets/creator/poster.png',
    sha256: 'a'.repeat(64),
    bytes: 123,
    width: 72,
    height: 36,
    alt: 'My reveal picture',
    review: 'candidate',
  });
  edited.missions[0].presentation.backgroundAssetId = 'poster';
  const changedArt = await verifyCreatorRoutes(edited, made.provenance);
  assert.deepEqual(
    changedArt.map((r) => r.simulationIdentity),
    original.map((r) => r.simulationIdentity),
  );
  assert.equal(changedArt[0].replay.level.name, 'A renamed picture');
  edited.missions[0].coverage = 0.6;
  await assert.rejects(verifyCreatorRoutes(edited, made.provenance), /Gameplay changed/);
});

test('unknown template versions, forged variants and cancellation cannot mint feasibility evidence', async () => {
  const made = generateCreatorProject({ id: 'picture', name: 'Collection', seed: 3 });
  assert.throws(
    () => validateCreatorProvenance({ ...made.provenance, templateVersion: 'future' }),
    /Unsupported/,
  );
  assert.throws(
    () => validateCreatorProvenance({ ...made.provenance, variantId: 'center' }),
    /variant/,
  );
  assert.throws(() => validateCreatorProvenance({ ...made.provenance, runtimeSeed: 4 }), /seed/);
  const stopped = new AbortController();
  stopped.abort();
  await assert.rejects(
    verifyCreatorRoutes(made.project, made.provenance, { signal: stopped.signal }),
    { name: 'AbortError' },
  );
  const running = new AbortController();
  const pending = verifyCreatorRoutes(made.project, made.provenance, { signal: running.signal });
  running.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
