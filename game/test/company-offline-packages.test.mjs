import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { companyOfflinePackages } from '../../scripts/company-offline-packages.mjs';
import { editionOfflinePackageId } from '../editions/offline-package-id.mjs';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { downloadFiles } from '../download-catalogue.mjs';

const entriesFor = (fixture) => [
  ...[...fixture.files].map(([name, value]) => ({
    name,
    bytes: Buffer.from(JSON.stringify(value)),
  })),
  ...[...(fixture.binary || [])].map(([name, bytes]) => ({ name, bytes: Buffer.from(bytes) })),
];
test('company ownership is exact, historical and outside both static traversal paths', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  f.replacePicture();
  const entries = entriesFor(f);
  entries.push(
    { name: 'game/index.html', bytes: Buffer.from('<script src="app.mjs"></script>') },
    { name: 'game/app.mjs', bytes: Buffer.from('const catalogue="editions/catalog.json";') },
  );
  const result = await companyOfflinePackages(entries);
  const current = result.groups.find((g) => g.id === editionOfflinePackageId('sample-public'));
  const retained = result.groups.find(
    (g) => g.id === editionOfflinePackageId('sample-public', f.descriptor.id),
  );
  assert.deepEqual(current.files, ['game/editions/assets/new-picture.png']);
  assert.deepEqual(retained.files, ['game/editions/assets/old-picture.png']);
  assert.equal(current.current, true);
  assert.equal(retained.current, false);
  assert.equal(retained.category, 'archive');
  assert.equal(result.paths.size, 2);
  const before = entries.map((e) => [e.name, e.bytes.toString('base64')]);
  const core = selectOfflineCore(entries, result.paths);
  assert.ok([...core.retained].every((p) => !result.paths.has(p)));
  assert.ok(core.retained.has('game/editions/catalog.json'));
  assert.ok(core.retained.has(f.descriptor.path));
  assert.deepEqual(
    entries.map((e) => [e.name, e.bytes.toString('base64')]),
    before,
  );
  const catalogue = {
    format: 'revealline-offline-content.v2',
    groups: result.groups,
    files: f.catalog.assets.map((a) => ({ ...a, kind: 'gameplay' })),
  };
  const downloaded = downloadFiles(catalogue, [retained.id]);
  assert.equal(downloaded.length, 1);
  assert.equal(downloaded[0].path, 'game/editions/assets/old-picture.png');
});
test('company artwork is excluded before core traversal and cannot re-enter shared fallback', async () => {
  const source = await readFile(
    new URL('../../scripts/offline-content.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(
    source.indexOf('companyOfflinePackages(entries)') < source.indexOf('selectOfflineCore(entries'),
  );
  assert.match(source, /for \(const name of company.paths\) excluded.add\(name\)/);
  assert.match(source, /!company.paths.has\(file.path\)/);
});
test('unselected registered originals get tooling ownership, never current/shared ownership', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  f.catalog.campaigns[0].assetIds = [];
  f.source.assets = [];
  f.source.missions[0].presentation.backgroundAssetId = null;
  f.catalog.editions[0].presentationHistory = [];
  const r = await companyOfflinePackages(entriesFor(f));
  assert.deepEqual(r.groups.find((g) => g.id === 'company:sample-public').files, []);
  const group = r.groups.find((g) => g.id === 'tooling:company-artwork');
  assert.equal(group.current, false);
  assert.equal(group.category, 'tooling');
  assert.deepEqual(group.files, ['game/editions/assets/old-picture.png']);
});
test('empty editions have explicit identities and ordinary distributions stay unchanged', async () => {
  const f = await editionProviderFixture();
  const r = await companyOfflinePackages(entriesFor(f));
  assert.equal(r.groups.length, 1);
  assert.deepEqual(r.groups[0].files, []);
  assert.equal(r.groups[0].id, 'company:sample-public');
  assert.equal(r.paths.size, 0);
  const no = await companyOfflinePackages([]);
  assert.equal(no.paths.size, 0);
  assert.deepEqual(no.groups, []);
  assert.throws(() => editionOfflinePackageId('', null));
  assert.throws(() => editionOfflinePackageId('sample-public', 'wrong'));
});
for (const fault of ['missing', 'corrupt', 'duplicate', 'retained-hash', 'retained-id'])
  test('company packaging fails closed for ' + fault, async () => {
    const f = await retainedEditionFixture({ originalArtwork: true });
    let entries = entriesFor(f);
    const path = 'game/editions/assets/old-picture.png';
    if (fault === 'missing') entries = entries.filter((e) => e.name !== path);
    if (fault === 'corrupt') entries.find((e) => e.name === path).bytes.fill(0);
    if (fault === 'duplicate') entries.push(entries.find((e) => e.name === path));
    if (fault === 'retained-hash') entries.find((e) => e.name === f.descriptor.path).bytes.fill(32);
    if (fault === 'retained-id') {
      f.catalog.editions[0].presentationHistory[0].id = 'f'.repeat(64);
      entries = entriesFor(f);
    }
    await assert.rejects(companyOfflinePackages(entries));
  });
