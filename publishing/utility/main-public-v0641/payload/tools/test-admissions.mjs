/** Offline boundary fixtures only; modified prior config is not an actual publisher authority. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAdmissions } from './audit-main.mjs';
const prior = JSON.parse(await readFile(new URL('./test-fixtures/prior-configuration.json', import.meta.url)));
const configured = structuredClone(prior);
const last = configured.admissions.find(a => a.id === 'archive-31');
last.infrastructureCommit = '2ff1b312872857cf04b485f9c987a26c0432f356'; last.deploymentId = 6540533321;
const observed = c => ({ admittedArchives: 31, observations: c.admissions.map(a => ({ archiveId: a.id,
  infrastructureCommit: a.infrastructureCommit, deploymentId: a.deploymentId, deploymentState: 'success' })) });
assert.deepEqual(validateAdmissions(configured, observed(configured)),
  { total: 31, retainedUnchanged: 30, updated: ['archive-31'], externalBodiesReaudited: false });
const duplicate = structuredClone(configured); duplicate.admissions[1] = duplicate.admissions[0];
assert.throws(() => validateAdmissions(duplicate, observed(duplicate)), /identities differ/);
const missing = structuredClone(configured); missing.admissions.pop();
assert.throws(() => validateAdmissions(missing, observed(missing)), /Exactly31/);
const changed = structuredClone(configured); changed.admissions[0].deploymentId++;
assert.throws(() => validateAdmissions(changed, observed(changed)), /Previously admitted/);
const mismatch = observed(configured); mismatch.observations[0].deploymentId++;
assert.throws(() => validateAdmissions(configured, mismatch), /observation differs/);
assert.throws(() => validateAdmissions(prior, observed(prior)), /accepted v64 append/);
const duplicateEvidence = structuredClone(configured); duplicateEvidence.admissions[0].evidence.push(duplicateEvidence.admissions[0].evidence[0]);
assert.throws(() => validateAdmissions(duplicateEvidence, observed(duplicateEvidence)), /Invalid archive evidence/);
const missingRole = structuredClone(configured); missingRole.admissions[0].evidence = missingRole.admissions[0].evidence.filter(e => e.kind !== 'browser');
assert.throws(() => validateAdmissions(missingRole, observed(missingRole)), /required evidence roles/);
console.log(JSON.stringify({ status: 'ARCHIVE_ADMISSION_BOUNDARY_CHECK_PASS', authorities: 31,
 retainedUnchanged: 30, cases: 8, fixtureOnly: true, realNetworkRequests: 0, publicAcceptance: false }));
