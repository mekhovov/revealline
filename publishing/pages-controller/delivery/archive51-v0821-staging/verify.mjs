/** Local admission check only; no networking, publisher assembly or live selector writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAdmissions } from '../../assemble.mjs';
import { digest, validateMetadata } from '../../metadata.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const read = (name) => fs.readFile(path.join(directory, name));
const json = async (name) => JSON.parse(await read(name));
const authority = await json('controller-authority.json');
for (const pin of authority.files) {
  assert.equal(digest(await fs.readFile(path.join(root, pin.path))), pin.sha256, pin.path);
}
const allocationBytes = await read('allocations.json');
const allocation = JSON.parse(allocationBytes);
const baseline = await json('allocation-baseline-original.json');
assert.deepEqual(allocation.shards.slice(0, -1), baseline.shards);
assert.equal(allocation.shards.length, 51);
assert.deepEqual(allocation.shards.at(-1), await json('allocation-entry.json'));
assert.deepEqual(allocation.shards.at(-1), {
  id: 'archive-51',
  repository: 'mekhovov/revealline-archive-51',
  versions: ['v0.82.1'],
});
const admission = await json('admission-entry.approved.json');
assert.equal(admission.evidence.length, 51);
assert.equal(new Set(admission.evidence.map((pin) => pin.path)).size, 51);
for (const pin of admission.evidence) assert.equal(digest(await read(pin.path)), pin.sha256);
const fragment = await json('configuration-fragment.json');
assert.equal(fragment.allocationSha256, digest(allocationBytes));
assert.deepEqual(fragment.admissionToAppend, admission);
const prefix = 'metadata/v0.82.1/';
const [recordBytes, manifestBytes, checksumBytes, pin] = await Promise.all([
  read(prefix + 'release.json'),
  read(prefix + 'manifest.json'),
  read(prefix + 'distribution.zip.sha256'),
  json(prefix + 'catalog-pin.json'),
]);
const metadata = new Map([
  ['v0.82.1', validateMetadata({ recordBytes, manifestBytes, checksumBytes, pin })],
]);
const qualification = 'evidence/archive-51-v0821/source-qualification-original.json';
const configuration = {
  format: 'revealline-pages-controller.v1',
  currentVersion: 'v0.82.1',
  catalogSha256: authority.catalogSha256,
  allocationSha256: digest(allocationBytes),
  admissions: [admission],
  deploymentEnabled: true,
  currentSourceQualification: { path: qualification, sha256: digest(await read(qualification)) },
  retainedReleasesPerMajor: 'all',
  testingRoutes: {},
};
const check = (candidate) =>
  validateAdmissions({ directory, configuration: candidate, metadata, requireBrowser: true });
const result = await check(configuration);
assert.equal(result.admissions.length, 1);
assert.equal(result.admissions[0].id, 'archive-51');
// Current821 is deliberately not routed as historical. No future083 source qualification is invented.
assert.deepEqual(result.canonicalSites, {});
const pending = structuredClone(configuration);
const oldBrowser = 'evidence/archive-51-v0821/browser-admission.pending-original.json';
const digestPending = digest(await read(oldBrowser));
pending.admissions[0].evidence = pending.admissions[0].evidence.map((row) =>
  row.kind === 'browser' ? { ...row, path: oldBrowser, sha256: digestPending } : row,
);
await assert.rejects(check(pending), /Archive browser admission failed/);
const missing = structuredClone(configuration);
missing.admissions[0].evidence = missing.admissions[0].evidence.filter(
  (row) => row.kind !== 'browser',
);
await assert.rejects(check(missing), /Archive admission is incomplete/);
const changed = structuredClone(configuration);
changed.admissions[0].evidence[0].sha256 = '0'.repeat(64);
await assert.rejects(check(changed), /Archive evidence byte pin mismatch/);
console.log(
  JSON.stringify(
    {
      status: 'PASS_SCOPED_APPROVED_ADMISSION_INPUTS',
      controllerSource: authority.sourceCommit,
      checks: [
        '51 exact evidence pins',
        '50 historical allocation entries preserved',
        'requireBrowser true accepts independently reviewed owner-approved archive51',
        'pending browser record refused',
        'missing browser authority refused',
        'changed evidence refused',
      ],
      admittedArchive: 'archive-51',
      files: 1059,
      bytes: 590404002,
      futureSelectorValidated: false,
      networkRequests: 0,
      liveConfigurationChanged: false,
      boundary:
        'Bounded original821 metadata/admission check only. Later083 must supply its actual source qualification, complete catalogue/routing and capacity/build checks.',
    },
    null,
    2,
  ),
);
