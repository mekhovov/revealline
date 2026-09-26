import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editionAdmissionFixture as fixture } from './edition-fixture.mjs';
import { createEditionZip } from './edition-zip.mjs';
import {
  validateEditionSourceInventory,
  validatePublicSourceEligibility,
  validateEditionAdmission,
} from './edition-admission.mjs';

const bytes = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
const descriptor = (path, value) => ({
  path,
  bytes: value.length,
  sha256: createHash('sha256').update(value).digest('hex'),
});
const picture = bytes('<svg xmlns="http://www.w3.org/2000/svg"/>');
const asset = {
  ...descriptor('game/editions/assets/coupa.svg', picture),
  approved: true,
  publication: 'public',
};

test('public runtime verifies original asset bytes and excludes private or authoring history', () => {
  const files = new Map([
    [asset.path, picture],
    ['game/edition.json', bytes('{}')],
  ]);
  assert.equal(validateEditionSourceInventory({ files, assets: [asset] }).assets, 1);
  for (const bad of [
    { ...asset, approved: false },
    { ...asset, publication: 'restricted' },
    { ...asset, sha256: 'f'.repeat(64) },
  ])
    assert.throws(() => validateEditionSourceInventory({ files, assets: [bad] }));
  for (const path of [
    'authoring/source.json',
    'game/presentation/studio.json',
    'game/private/token.json',
    '../outside.json',
  ])
    assert.throws(() =>
      validateEditionSourceInventory({
        files: new Map([...files, [path, bytes('{}')]]),
        assets: [asset],
      }),
    );
});

test('source archive gate includes unselected assets and permits public repository metadata', () => {
  const files = new Map([
    [asset.path, picture],
    ['.github/workflows/check.yml', bytes('name: Check')],
  ]);
  assert.equal(validatePublicSourceEligibility({ files, assets: [asset] }).files, 2);
  assert.throws(
    () => validatePublicSourceEligibility({ files, assets: [] }),
    /no public eligibility/,
  );
  assert.throws(
    () =>
      validatePublicSourceEligibility({ files, assets: [{ ...asset, publication: 'restricted' }] }),
    /unapproved/,
  );
  for (const name of [
    '.env',
    '.env.production',
    '.git/config',
    'research/private/drive-export.json',
  ])
    assert.throws(() =>
      validatePublicSourceEligibility({
        files: new Map([...files, [name, bytes('hidden')]]),
        assets: [asset],
      }),
    );
});

test('edition envelope binds exact source and original descriptors without changing legacy artifacts', async () => {
  const f = fixture();
  const result = await validateEditionAdmission(f.envelope, f);
  assert.ok(result.editions[0].totalBytes > 4);
  assert.equal(result.zipMembersVerified, true);
  assert.equal(result.publicEligible, false);
  assert.equal(result.status, 'verified-candidate-members');
  f.files.set('distribution-coupa.zip', bytes('replaced'));
  await assert.rejects(validateEditionAdmission(f.envelope, f), /bytes differ/);
});

test('missing, duplicate, over-budget and mismatched source bindings reject admission', async () => {
  for (const mutate of [
    (f) => f.envelope.editions.push(f.envelope.editions[0]),
    (f) => {
      f.envelope.sourceRevision = 'e'.repeat(40);
    },
    (f) => {
      f.envelope.editions[0].distribution.bytes = 950_000_001;
    },
    (f) => {
      f.envelope.editions[0].sourceInventory.path = 'source.tar';
    },
    (f) => {
      f.envelope.editions[0].packs[0].revision = '../1';
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(validateEditionAdmission(f.envelope, f));
  }
});

test('original ZIP inspection rejects injected undeclared members even with a valid outer hash', async () => {
  const f = fixture(),
    row = f.envelope.editions[0];
  const archive = createEditionZip(
    new Map([
      ...f.runtime,
      ['manifest.json', f.files.get(row.manifest.path)],
      ['private/sentinel.json', bytes('DO_NOT_PUBLISH')],
    ]),
  );
  f.files.set(row.distribution.path, archive);
  row.distribution = descriptor(row.distribution.path, archive);
  await assert.rejects(validateEditionAdmission(f.envelope, f), /directory differs/);
});

test('source archive cannot self-attest private inputs eligible', async () => {
  const f = fixture(),
    row = f.envelope.editions[0];
  const original = JSON.parse(f.files.get(row.sourceInventory.path));
  const secret = bytes('DO_NOT_PUBLISH'),
    name = 'private/drive-export.json';
  original.files.push(descriptor(name, secret));
  original.totalBytes += secret.length;
  const inventory = bytes(original),
    archive = createEditionZip(
      new Map([...f.sourceFiles, [name, secret], ['source-inventory.json', inventory]]),
    );
  for (const [role, content] of [
    ['sourceInventory', inventory],
    ['sourceArchive', archive],
  ]) {
    f.files.set(row[role].path, content);
    row[role] = descriptor(row[role].path, content);
  }
  await assert.rejects(validateEditionAdmission(f.envelope, f), /Source-only material/);
});

test('undeclared company font originals cannot enter a public source archive', () => {
  assert.throws(
    () =>
      validatePublicSourceEligibility({
        files: new Map([['game/editions/assets/private-font.ttf', bytes('font')]]),
      }),
    /no public eligibility/,
  );
});

test('whole-source eligibility permits existing Unicode and native scale filenames without relaxing runtime paths', () => {
  const names = [
    'platforms/ios/native/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    'publishing/pages-controller/delivery/evidence/cross-mode-p05/public-v0605/native-fixtures/Preview-ҐґЄєІіЇї-’ʼ.png',
  ];
  const files = new Map(names.map((name) => [name, bytes('public fixture')]));
  assert.equal(validatePublicSourceEligibility({ files }).files, 2);
  for (const name of names)
    assert.throws(
      () => validateEditionSourceInventory({ files: new Map([[name, bytes('fixture')]]) }),
      /Invalid edition artifact path/,
    );
  for (const name of [
    '',
    '/absolute.png',
    '../outside.png',
    'folder/../outside.png',
    'folder//file.png',
    'folder/',
    'C:/drive.png',
    'folder\\outside.png',
    'line\nbreak.png',
    'null\0byte.png',
    '.GIT/config',
  ])
    assert.throws(
      () => validatePublicSourceEligibility({ files: new Map([[name, bytes('invalid')]]) }),
      /Invalid edition artifact path/,
    );
});
