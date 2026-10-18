import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createEditionZip, inspectEditionZip } from '../publishing/edition-zip.mjs';
import {
  soloBuildVerificationArguments,
  verifyExternalBuildArchive,
} from './solo-build-archive.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('external archive options require an explicit paired receipt and reject ambiguous arguments', () => {
  assert.deepEqual(soloBuildVerificationArguments(['payload', 'report.json']), {
    artifact: 'payload',
    output: 'report.json',
  });
  const args = soloBuildVerificationArguments([
    'payload',
    'report.json',
    '--archive=/external/distribution.zip',
    '--archive-receipt=extraction.json',
    '--base=main',
  ]);
  assert.equal(args.archive, '/external/distribution.zip');
  assert.equal(args['archive-receipt'], 'extraction.json');
  assert.equal(args.base, 'main');
  for (const values of [
    [],
    ['payload'],
    ['--archive=x', 'report'],
    ['payload', 'report', '--archive=x'],
    ['payload', 'report', '--archive-receipt=x'],
    ['payload', 'report', '--source='],
    ['payload', 'report', '--base=x', '--base=y'],
    ['payload', 'report', '--unknown=x'],
  ])
    assert.throws(() => soloBuildVerificationArguments(values));
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'solo-build-archive-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifactRoot = join(root, 'payload'),
    external = join(root, 'external');
  await mkdir(artifactRoot);
  await mkdir(external);
  const source = Buffer.from('export const fixture = true;\n');
  const manifest = {
    formatVersion: 1,
    sourceRevision: 'b'.repeat(40),
    version: 'fixture',
    entry: 'app.mjs',
    files: [{ path: 'app.mjs', bytes: source.length, sha256: sha256(source) }],
    totalBytes: source.length,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest) + '\n');
  const zip = createEditionZip(
    new Map([
      ['app.mjs', source],
      ['manifest.json', manifestBytes],
    ]),
  );
  // Reuse the independent existing ZIP inspector to produce the test receipt.
  // The helper under test does not parse ZIP members itself.
  const members = inspectEditionZip(zip, [
    ...manifest.files,
    { path: 'manifest.json', bytes: manifestBytes.length, sha256: sha256(manifestBytes) },
  ]);
  for (const [name, bytes] of members) await writeFile(join(artifactRoot, name), bytes);
  const archive = join(external, 'distribution.zip'),
    receipt = join(root, 'extraction.json');
  const evidence = {
    status: 'passed',
    sourceRevision: manifest.sourceRevision,
    destination: artifactRoot,
    manifestSHA256: sha256(manifestBytes),
    zipSHA256: sha256(zip),
    zipBytes: zip.length,
    verifiedMembers: members.size,
    verifiedBytes: [...members.values()].reduce((total, bytes) => total + bytes.length, 0),
  };
  await writeFile(archive, zip);
  await writeFile(`${archive}.sha256`, `${sha256(zip)}  distribution.zip\n`);
  await writeFile(receipt, JSON.stringify(evidence));
  return { archive, receipt, artifactRoot, manifestBytes, zip, evidence };
}

test('fresh external ZIP hash binds the independent member receipt to a local payload without a ZIP copy', async (t) => {
  const f = await fixture(t);
  const report = await verifyExternalBuildArchive(f);
  assert.equal(report.sha256, sha256(f.zip));
  assert.equal(report.payloadManifestSHA256, sha256(f.manifestBytes));
  assert.equal(
    report.independentMemberVerification.receiptSHA256,
    sha256(await readFile(f.receipt)),
  );
  assert.equal(report.independentMemberVerification.verifiedMembers, 2);
  assert.equal(report.external, true);
  await assert.rejects(readFile(join(f.artifactRoot, 'distribution.zip')), { code: 'ENOENT' });
});

test('a rewritten archive and matching sidecar cannot reuse an earlier passing member receipt', async (t) => {
  const f = await fixture(t);
  const changed = Buffer.from(f.zip);
  changed[changed.length - 1] ^= 1;
  await writeFile(f.archive, changed);
  await writeFile(`${f.archive}.sha256`, `${sha256(changed)}  distribution.zip\n`);
  await assert.rejects(verifyExternalBuildArchive(f), /belongs to another ZIP/);
});

test('the archive sidecar is checked independently of a matching extraction receipt', async (t) => {
  const f = await fixture(t);
  await writeFile(`${f.archive}.sha256`, `${'0'.repeat(64)}  distribution.zip\n`);
  await assert.rejects(verifyExternalBuildArchive(f), /sidecar differs/);
});

test('failed, partial, or differently bound extraction evidence cannot qualify the archive', async (t) => {
  const f = await fixture(t);
  for (const [patch, message] of [
    [{ status: 'failed' }, /did not pass/],
    [{ sourceRevision: 'c'.repeat(40) }, /revision differs/],
    [{ manifestSHA256: '0'.repeat(64) }, /manifest differs/],
    [{ verifiedMembers: 1 }, /member count differs/],
    [{ verifiedBytes: 0 }, /byte count differs/],
    [{ destination: join(f.artifactRoot, '..', 'external') }, /another extracted payload/],
  ]) {
    await writeFile(f.receipt, JSON.stringify({ ...f.evidence, ...patch }));
    await assert.rejects(verifyExternalBuildArchive(f), message);
  }
});
