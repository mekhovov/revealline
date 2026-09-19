/** Offline boundary fixtures only; modified prior config is not an actual publisher authority. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAdmissions } from './audit-main.mjs';
const prior = JSON.parse(await readFile(new URL('./test-fixtures/prior-configuration.json', import.meta.url)));
const configured = structuredClone(prior);
configured.admissions.push(JSON.parse(await readFile(new URL('./test-fixtures/new-admission.json', import.meta.url))));
const observed = c => ({ admittedArchives: 32, observations: c.admissions.map(a => ({ archiveId: a.id,
  infrastructureCommit: a.infrastructureCommit, deploymentId: a.deploymentId, deploymentState: 'success' })) });
assert.deepEqual(validateAdmissions(configured, observed(configured)),
  { total: 32, retainedUnchanged: 31, updated: ['archive-32'], externalBodiesReaudited: false });
const duplicate = structuredClone(configured); duplicate.admissions[1] = duplicate.admissions[0];
assert.throws(() => validateAdmissions(duplicate, observed(duplicate)), /identities differ/);
const missing = structuredClone(configured); missing.admissions.pop();
assert.throws(() => validateAdmissions(missing, observed(missing)), /Exactly32/);
const changed = structuredClone(configured); changed.admissions[0].deploymentId++;
assert.throws(() => validateAdmissions(changed, observed(changed)), /Previously admitted/);
const mismatch = observed(configured); mismatch.observations[0].deploymentId++;
assert.throws(() => validateAdmissions(configured, mismatch), /observation differs/);
assert.throws(() => validateAdmissions(prior, observed(prior)), /Exactly32/);
const duplicateEvidence = structuredClone(configured); duplicateEvidence.admissions[0].evidence.push(duplicateEvidence.admissions[0].evidence[0]);
assert.throws(() => validateAdmissions(duplicateEvidence, observed(duplicateEvidence)), /Invalid archive evidence/);
const missingRole = structuredClone(configured); missingRole.admissions[0].evidence = missingRole.admissions[0].evidence.filter(e => e.kind !== 'browser');
assert.throws(() => validateAdmissions(missingRole, observed(missingRole)), /required evidence roles/);
const wrongNew = structuredClone(configured); wrongNew.admissions.at(-1).deploymentId++;
assert.throws(() => validateAdmissions(wrongNew, observed(wrongNew)), /accepted initial v64.1 archive/);
console.log(JSON.stringify({ status: 'ARCHIVE_ADMISSION_BOUNDARY_CHECK_PASS', authorities: 32,
 retainedUnchanged: 31, cases: 9, fixtureOnly: true, realNetworkRequests: 0, publicAcceptance: false }));
