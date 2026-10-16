/** LOCAL ONLY: bind parent-reviewed exact request/head to retained terminal evidence. No APIs or Git writes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const [requestSha256, auditHead, runText] = process.argv.slice(2);
assert(process.argv.length === 5 && /^[a-f0-9]{64}$/.test(requestSha256) &&
  /^[a-f0-9]{40}$/.test(auditHead) && /^[1-9][0-9]*$/.test(runText),
  'Usage: bind-acceptance-context.mjs REVIEWED_REQUEST_SHA256 REVIEWED_AUDIT_HEAD ACTUAL_TERMINAL_AUDIT_RUN_ID');
const auditRunId = Number(runText); assert(Number.isSafeInteger(auditRunId));
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
function read(relative, max = 16_000_000) {
  const file = path.join(root, relative), stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= max);
  return fs.readFileSync(file);
}
const parse = relative => JSON.parse(read(relative));
const raw = read('execution-request.reviewed.json', 32768), request = JSON.parse(raw);
assert.equal(sha(raw), requestSha256); assert.equal(request.reviewed, true);
assert.equal(request.format, 'revealline-archive57-http-request.v1');
assert.equal(request.archiveTree, '5d00558b78f917cd7bb40d718fbcf0ef55b2ed86');
assert.match(request.archiveCommit, /^[a-f0-9]{40}$/);
assert.equal(request.sourceCheckoutCommit, request.archiveCommit);
for (const key of ['runId', 'deploymentId', 'deploymentStatusId', 'receiptArtifactId'])
  assert(Number.isSafeInteger(request[key]) && request[key] > 0);
const sourcePins = [];
for (const [output, source, local] of [
  ['auditor.py', 'audit/http-tools/http_audit.py', 'http-audit-preparation/http-tools/http_audit.py'],
  ['audit_binding.py', 'audit/http-tools/audit_binding.py', 'http-audit-preparation/http-tools/audit_binding.py'],
  ['execution-request.json', 'audit/execution-request.reviewed.json', 'execution-request.reviewed.json'],
  [null, '.github/workflows/deploy.yml', 'http-audit-preparation/deploy.audit-only.yml'],
]) {
  const committed = execFileSync('git', ['-C', path.join(root, 'audit-repository'), 'show', auditHead + ':' + source], {
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 1024 * 1024, timeout: 10000,
  });
  assert.deepEqual(committed, read(local), 'Reviewed audit source differs: ' + source);
  sourcePins.push([output, source, sha(committed)]);
}
const run = parse('hosted-http-run-original.json');
assert.equal(run.id, auditRunId); assert.equal(run.head_sha, auditHead);
assert.equal(run.repository.full_name, 'mekhovov/revealline-archive-57');
assert.equal(run.head_branch, 'codex/audit-archive57-http');
assert.equal(run.path, '.github/workflows/deploy.yml'); assert.equal(run.event, 'workflow_dispatch');
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
const artifacts = parse('hosted-http-artifacts-original.json');
assert.equal(artifacts.total_count, 1); assert.equal(artifacts.artifacts.length, 1);
const artifact = artifacts.artifacts[0], zip = read('hosted-http-evidence-original.zip', 8_000_000);
assert.equal(artifact.name, 'archive57-public-http-evidence'); assert.equal(artifact.expired, false);
assert.equal(artifact.workflow_run.id, auditRunId); assert.equal(artifact.workflow_run.head_sha, auditHead);
assert.equal(artifact.size_in_bytes, zip.length); assert.equal(artifact.digest, 'sha256:' + sha(zip));
const context = {
  format: 'archive57-actual-acceptance-context.v1', status: 'BOUND_NOT_PUBLIC_ACCEPTANCE',
  requestSha256, archiveCommit: request.archiveCommit, archiveTree: request.archiveTree,
  productionRunId: request.runId, auditHead, auditRunId, sourcePins,
  artifact: { id: artifact.id, bytes: zip.length, sha256: sha(zip) },
};
fs.writeFileSync(path.join(root, 'acceptance-context.bound.json'), JSON.stringify(context, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(context));
