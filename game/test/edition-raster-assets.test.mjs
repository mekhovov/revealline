import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { rasterFixtures } from './helpers/raster-fixtures.mjs';
import { compileEdition, collectEditionSelectedFiles } from '../../scripts/compile-edition.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { validatePublicSourceEligibility } from '../../publishing/edition-admission.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import { captureEditionPresentation } from '../editions/retained-presentation.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(raster) {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    source = structuredClone(f.source),
    descriptor = catalog.campaigns[0];
  const asset = {
    format: 'AssetRevisionV1',
    id: 'compact-art',
    revision: '1',
    kind: 'reveal-background',
    path: `editions/assets/fixture/picture.${raster.extension}`,
    sha256: sha256(raster.bytes),
    bytes: raster.bytes.length,
    width: 1,
    height: 1,
    alt: 'Injected raster fixture',
    review: 'candidate',
  };
  source.assets = [asset];
  source.missions[0].presentation.backgroundAssetId = asset.id;
  const published = {
    id: asset.id,
    path: `game/${asset.path}`,
    sha256: asset.sha256,
    bytes: asset.bytes,
    publication: 'public',
    approved: true,
    dependencies: [],
  };
  catalog.assets.push(published);
  descriptor.assetIds.push(asset.id);
  const files = new Map(
    [...f.files]
      .filter(([name]) => !name.endsWith('catalog.json'))
      .map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
  );
  files.set(descriptor.sourcePath, Buffer.from(JSON.stringify(source)));
  files.set(published.path, raster.bytes);
  files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  const build = () =>
    compileEdition({
      catalog,
      editionIds: [catalog.editions[0].id],
      files,
      enginePaths: ['game/company.html'],
    });
  return { ...f, catalog, source, descriptor, asset, published, files, build };
}

test('compact raster editions retain exact selected dependencies, source admission and Studio round trips', async () => {
  for (const raster of rasterFixtures()) {
    const f = await fixture(raster);
    const sentinel = {
      ...f.published,
      id: 'unselected',
      path: 'game/editions/assets/unselected.webp',
      publication: 'restricted',
      approved: false,
    };
    f.catalog.publication = 'restricted';
    f.catalog.assets.push(sentinel);
    f.files.set(sentinel.path, raster.bytes);
    const selected = await collectEditionSelectedFiles({
      catalog: f.catalog,
      editionIds: [f.catalog.editions[0].id],
      read: async (name) => f.files.get(name),
    });
    assert.equal(selected.has(sentinel.path), false);
    const first = await f.build(),
      second = await f.build();
    assert.deepEqual(first.manifest, second.manifest);
    assert.deepEqual(first.files.get(f.published.path), raster.bytes);
    assert.equal(first.files.has(sentinel.path), false);
    assert.equal(first.eligibility.assets, 1);
    assert.equal(
      first.manifest.files.find((row) => row.path === f.published.path).sha256,
      f.asset.sha256,
    );
    const restored = companyDraftFiles(companySourceDraft({ ...f, catalog: first.runtimeCatalog }));
    assert.deepEqual(JSON.parse(restored.files.get(f.descriptor.sourcePath)).assets, [f.asset]);
    const projected = compileContentProject(f.source);
    assert.equal(
      resolveMission(projected, f.source.missions[0].id).simulationIdentity,
      resolveMission(f.project, f.source.missions[0].id).simulationIdentity,
    );
    assert.equal(
      validatePublicSourceEligibility({
        files: new Map([[f.published.path, raster.bytes]]),
        assets: [f.published],
      }).assets,
      1,
    );
    assert.throws(
      () =>
        validatePublicSourceEligibility({
          files: new Map([[f.published.path, raster.bytes]]),
          assets: [{ ...f.published, approved: false }],
        }),
      /unapproved/,
    );
    f.files.set(f.published.path, Buffer.from('wrong'));
    await assert.rejects(f.build(), /length|digest/);
  }
});

test('compiler checks raster headers against approved path and dimensions, not merely matching hashes', async () => {
  const f = await fixture(rasterFixtures().find((row) => row.extension === 'webp'));
  f.asset.width = 2;
  f.files.set(f.descriptor.sourcePath, Buffer.from(JSON.stringify(f.source)));
  await assert.rejects(f.build(), /dimensions or raster header/);
  f.asset.width = 1;
  const original = f.published.path;
  f.asset.path = f.asset.path.replace('.webp', '.jpg');
  f.published.path = `game/${f.asset.path}`;
  f.files.set(f.published.path, f.files.get(original));
  f.files.delete(original);
  f.files.set(f.descriptor.sourcePath, Buffer.from(JSON.stringify(f.source)));
  await assert.rejects(f.build(), /dimensions or raster header/);
});

test('retained compact artwork stays in the exact approved historical closure after a new picture revision', async () => {
  const f = await fixture(rasterFixtures().find((row) => row.extension === 'webp'));
  const bootstrap = await loadEditionBootstrap({
    editionId: f.catalog.editions[0].id,
    catalogURL: 'http://localhost/edition-catalog.json',
    contentBaseURL: 'http://localhost/',
    fetcher: async (url) => {
      const name = new URL(url).pathname.slice(1);
      return new Response(
        name === 'edition-catalog.json' ? JSON.stringify(f.catalog) : f.files.get(name),
      );
    },
  });
  const snapshot = await captureEditionPresentation(bootstrap),
    encoded = Buffer.from(JSON.stringify(snapshot)),
    historyPath = `game/editions/retained/${snapshot.authoredPresentationSha256}.json`,
    originalPath = f.published.path,
    originalBytes = f.files.get(originalPath);
  f.catalog.editions[0].presentationHistory = [
    {
      id: snapshot.authoredPresentationSha256,
      path: historyPath,
      sha256: sha256(encoded),
      bytes: encoded.length,
    },
  ];
  f.files.set(historyPath, encoded);
  const next = rasterFixtures().find((row) => row.extension === 'png');
  Object.assign(f.asset, {
    revision: '2',
    path: 'editions/assets/fixture/picture-r2.png',
    sha256: sha256(next.bytes),
    bytes: next.bytes.length,
  });
  Object.assign(f.published, {
    path: `game/${f.asset.path}`,
    sha256: f.asset.sha256,
    bytes: f.asset.bytes,
  });
  f.files.set(f.published.path, next.bytes);
  f.files.set(f.descriptor.sourcePath, Buffer.from(JSON.stringify(f.source)));
  const result = await f.build();
  assert.deepEqual(result.files.get(originalPath), originalBytes);
  assert.deepEqual(result.files.get(f.published.path), next.bytes);
  assert.equal(result.eligibility.assets, 2);
  f.files.set(originalPath, Buffer.alloc(originalBytes.length));
  await assert.rejects(f.build(), /digest/);
});
