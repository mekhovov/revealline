/** Offline policy-boundary fixture; no real publisher binding or HTTP inventory. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SOURCE, TREE, VERSION, sha, validateModels } from './audit-main.mjs';
const retained = JSON.parse(await readFile(new URL('./retained-catalog.json', import.meta.url)));
const hash = 'a'.repeat(64);
const catalog = {
  format: 'revealline-frozen-catalog.v1',
  sourceRepository: 'mekhovov/revealline',
  releases: [...retained.releases, {
    version: VERSION, sourceRevision: SOURCE, tagObject: 'b'.repeat(40),
    recordSha256: hash, manifestSha256: hash, checksumSha256: hash,
  }],
};
const raw = Buffer.from(JSON.stringify(catalog));
const binding = {
  reviewed: true, format: 'revealline-final-main-public-binding.v1',
  base: 'https://mekhovov.github.io/revealline/', currentVersion: VERSION,
  gameSourceRevision: SOURCE, qualifiedSourceTree: TREE,
  controllerCommit: 'c'.repeat(40), controllerTree: 'd'.repeat(40),
  deploymentId: 1, runId: 2, inventorySha256: hash,
  pins: {
    catalog: { sha256: sha(raw) }, manifest: { sha256: hash },
    record: { sha256: hash }, qualification: { sha256: hash },
  },
};
const reachedReceipt = new Error('Fixture reached receipt authority boundary');
let receiptReads = 0;
const receipt = new Proxy({}, { get() { receiptReads++; throw reachedReceipt; } });
const configuration = {
  format: 'revealline-pages-controller.v1', catalogSha256: sha(raw),
  currentVersion: VERSION, deploymentEnabled: true, retainedReleasesPerMajor: 'all',
  testingRoutes: {}, currentSourceQualification: { sha256: hash },
};
const models = { catalog, configuration, receipt };
// Exercise the live validator until the next independent authority boundary.
// This is not a complete receipt, deployment, inventory or publisher fixture.
assert.throws(() => validateModels(binding, models, { catalog: raw }, retained),
  (error) => error === reachedReceipt);
assert.equal(receiptReads, 1);
for (const value of [100, 1, 101, '100', 'ALL', true, null, undefined]) {
  assert.throws(() => validateModels(binding,
    { ...models, configuration: { ...configuration, retainedReleasesPerMajor: value } },
    { catalog: raw }, retained), /Pinned full-history publication policy differs/);
}
assert.equal(receiptReads, 1, 'Rejected policy must not reach receipt authority');
console.log(JSON.stringify({
  status: 'ALL_HISTORY_POLICY_BOUNDARY_CHECK_PASS', exactAllPolicyAcceptedAtBoundary: true,
  rejectedPolicyVariants: 8, retainedAuthorities: retained.releases.length,
  completeAuthorityFixture: false, realNetworkRequests: 0, publicAcceptance: false,
}));
