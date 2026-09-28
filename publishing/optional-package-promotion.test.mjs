import test from 'node:test';
import assert from 'node:assert/strict';
import { optionalPackageFixture } from './optional-package-fixture.mjs';
import {
  validateOptionalPackagePublication,
  frozenOptionalPackageOverlay,
  selectRetainedOptionalPackageRelease,
} from './optional-package-promotion.mjs';
import { verifyAdditiveEditionAssets, RELEASE_ASSET_NAMES } from './fastline-release-publisher.mjs';
import { editionHash, readEditionZip } from './edition-zip.mjs';
const selector = (...releases) => ({
  format: 'revealline-optional-package-publication.v1',
  releases,
});
function readers(...fixtures) {
  return {
    targetBasePath: '/revealline/',
    resolveReleaseIdentity: async (version) =>
      fixtures.find((f) => f.envelope.version === version).envelope,
    readReleaseAsset: async (version, name, limit) => {
      const bytes = fixtures.find((f) => f.envelope.version === version)?.files.get(name);
      assert.ok(bytes && bytes.length <= limit, `Bounded existing fixture ${name}`);
      return bytes;
    },
  };
}

test('only reviewed original package bytes enter isolated versioned paths and the stable launcher', async () => {
  const f = await optionalPackageFixture();
  const overlay = await frozenOptionalPackageOverlay(selector(f.release), readers(f));
  const archive = readEditionZip(f.files.get(f.package.distribution.path));
  for (const [name, bytes] of archive)
    assert.deepEqual(overlay.get(`practice/civilian-flight/releases/v1.2.3/site/${name}`), bytes);
  for (const [name, bytes] of archive)
    if (name.startsWith('launcher/'))
      assert.deepEqual(overlay.get(`practice/civilian-flight/app/${name.slice(9)}`), bytes);
  const app = JSON.parse(overlay.get('practice/civilian-flight/app/app.webmanifest'));
  assert.equal(app.id, '/revealline/practice/civilian-flight/');
  assert.equal(app.start_url, '/revealline/practice/civilian-flight/app/');
  assert.deepEqual(JSON.parse(overlay.get('practice/civilian-flight/app/current.json')), {
    id: 'civilian-flight',
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: f.package.entry,
  });
  assert.ok([...overlay.keys()].every((name) => name.startsWith('practice/')));
  assert.equal(
    JSON.parse(overlay.get('practice/index.json')).packages[0].href,
    'civilian-flight/app/',
  );
  await assert.rejects(
    frozenOptionalPackageOverlay(selector(f.release), {
      ...readers(f),
      targetBasePath: '/elsewhere/',
    }),
    /another deployment target/,
  );
  await assert.rejects(
    frozenOptionalPackageOverlay(selector(f.release), {
      ...readers(f),
      resolveReleaseIdentity: async () => ({
        sourceRevision: 'c'.repeat(40),
        sourceTree: f.envelope.sourceTree,
      }),
    }),
    /immutable release tag/,
  );
});

test('rollback changes only active launcher pointers and retains every frozen release byte', async () => {
  const old = await optionalPackageFixture({ version: 'v1.2.2' }),
    current = await optionalPackageFixture();
  old.release.activePackageIds = [];
  const original = selector(old.release, current.release),
    before = JSON.stringify(original);
  const rolled = await selectRetainedOptionalPackageRelease(
    original,
    { version: 'v1.2.2', packageIds: ['civilian-flight'] },
    readers(old, current),
  );
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(
    rolled.releases.map((row) => row.activePackageIds),
    [['civilian-flight'], []],
  );
  const prior = await frozenOptionalPackageOverlay(original, readers(old, current));
  const after = await frozenOptionalPackageOverlay(rolled, readers(old, current));
  for (const [name, bytes] of prior)
    if (name.includes('/releases/')) assert.deepEqual(after.get(name), bytes);
  assert.equal(
    JSON.parse(after.get('practice/civilian-flight/app/current.json')).version,
    'v1.2.2',
  );
  const conflict = structuredClone(original);
  conflict.releases[0].activePackageIds = ['civilian-flight'];
  assert.throws(() => validateOptionalPackagePublication(conflict), /conflicting active/);
  await assert.rejects(
    selectRetainedOptionalPackageRelease(
      original,
      { version: 'v9.0.0', packageIds: ['civilian-flight'] },
      readers(old, current),
    ),
    /explicit packages retained/,
  );
});

test('the exact core release contract admits optional additions only with complete review and no unknown extras', async () => {
  const f = await optionalPackageFixture();
  const core = Buffer.from('original core bytes');
  const expected = RELEASE_ASSET_NAMES.map((name) => ({
    name,
    size: core.length,
    digest: `sha256:${editionHash(core)}`,
  }));
  const options = () => ({
    repository: 'mekhovov/revealline',
    version: f.envelope.version,
    sourceSha: f.envelope.sourceRevision,
    release: { tag_name: f.envelope.version, target_commitish: f.envelope.sourceRevision },
    expected,
    actual: [
      ...expected,
      ...[...f.files].map(([name, bytes]) => ({
        name,
        size: bytes.length,
        digest: `sha256:${editionHash(bytes)}`,
      })),
    ],
    request: async () => ({ sha: f.envelope.sourceRevision, tree: { sha: f.envelope.sourceTree } }),
    readAsset: async ({ asset }) => f.files.get(asset.name),
  });
  assert.deepEqual(await verifyAdditiveEditionAssets(options()), [...f.files.keys()].sort());
  f.files.set('private-note.txt', Buffer.from('not admitted'));
  await assert.rejects(verifyAdditiveEditionAssets(options()), /outside the admitted/);
  f.files.delete('private-note.txt');
  f.files.delete('optional-package-review.json');
  await assert.rejects(verifyAdditiveEditionAssets(options()), /complete edition envelope/);
});
