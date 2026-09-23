import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const REPO = 'mekhovov/revealline-archive-57';
export const BASE = 'https://mekhovov.github.io/revealline-archive-57/';
const CONTEXT = JSON.parse(fs.readFileSync(path.join(ROOT, 'acceptance-context.bound.json')));
assert.equal(CONTEXT.format, 'archive57-actual-acceptance-context.v1');
assert.equal(CONTEXT.status, 'BOUND_NOT_PUBLIC_ACCEPTANCE');
assert.match(CONTEXT.archiveCommit, /^[a-f0-9]{40}$/);
assert.match(CONTEXT.auditHead, /^[a-f0-9]{40}$/);
assert.match(CONTEXT.requestSha256, /^[a-f0-9]{64}$/);
export const COMMIT = CONTEXT.archiveCommit;
export const TREE = '5d00558b78f917cd7bb40d718fbcf0ef55b2ed86';
export const SOURCE = '950f19045facacf5151c90661de1ca28d30658df';
export const RUN = CONTEXT.productionRunId;
assert.equal(CONTEXT.archiveTree, TREE);
for (const id of [RUN, CONTEXT.auditRunId, CONTEXT.artifact.id]) assert.ok(Number.isSafeInteger(id) && id > 0);
export const FILES = 1088, BYTES = 590907371;
export const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export function read(file, limit = 16_000_000) {
  assert.ok(typeof file === 'string' && path.isAbsolute(file), 'Explicit absolute input path required');
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit, 'Ordinary bounded input required: ' + file);
  return fs.readFileSync(file);
}
export const json = (file) => JSON.parse(read(file));
export const at = (name) => path.join(ROOT, name);
export function contained(root, name) {
  assert.ok(typeof name === 'string' && !path.isAbsolute(name));
  const target = path.resolve(root, name);
  assert.ok(target.startsWith(path.resolve(root) + path.sep), 'Unsafe evidence path');
  return target;
}
export function writeJSON(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
export function deployment(file) {
  const raw = read(file), binding = JSON.parse(raw);
  assert.equal(sha(raw), CONTEXT.requestSha256);
  assert.equal(binding.reviewed, true);
  assert.equal(binding.format, 'revealline-archive57-http-request.v1');
  assert.equal(binding.archiveCommit, COMMIT);
  assert.equal(binding.archiveTree, TREE);
  assert.equal(binding.sourceCheckoutCommit, COMMIT);
  assert.equal(binding.runId, RUN);
  for (const key of ['deploymentId', 'deploymentStatusId', 'receiptArtifactId'])
    assert.ok(Number.isSafeInteger(binding[key]) && binding[key] > 0, 'Actual ' + key + ' required');
  const pinned = {};
  for (const role of ['run', 'main', 'commit', 'deployment', 'statuses', 'artifacts', 'receiptZIP']) {
    const pin = binding.pins[role], raw = read(contained(ROOT, pin.path));
    assert.equal(raw.length, pin.bytes); assert.equal(sha(raw), pin.sha256);
    if (role !== 'receiptZIP') pinned[role] = JSON.parse(raw);
  }
  assert.equal(pinned.run.id, RUN);
  assert.equal(pinned.run.head_sha, COMMIT);
  assert.equal(pinned.run.status, 'completed');
  assert.equal(pinned.run.conclusion, 'success');
  assert.equal(pinned.main.object.sha, COMMIT);
  assert.equal(pinned.commit.tree.sha, TREE);
  assert.equal(pinned.deployment.id, binding.deploymentId);
  assert.equal(pinned.deployment.sha, COMMIT);
  assert.equal(pinned.deployment.environment, 'github-pages');
  const latest = pinned.statuses.reduce((a, b) => a.id > b.id ? a : b);
  assert.equal(latest.id, binding.deploymentStatusId);
  assert.equal(latest.state, 'success');
  const artifact = pinned.artifacts.artifacts.find((row) => row.id === binding.receiptArtifactId);
  assert.equal(artifact.name, 'archive57-verification-receipts');
  assert.equal(artifact.digest, 'sha256:' + binding.pins.receiptZIP.sha256);
  return binding;
}
const MIMES = {
  '.html': ['text/html'], '.mjs': ['text/javascript', 'application/javascript'],
  '.js': ['text/javascript', 'application/javascript'], '.css': ['text/css'],
  '.json': ['application/json'], '.webmanifest': ['application/manifest+json', 'application/json'],
  '.png': ['image/png'], '.jpg': ['image/jpeg'], '.svg': ['image/svg+xml'],
  '.woff2': ['font/woff2'], '.ttf': ['font/ttf', 'application/x-font-ttf', 'application/font-sfnt'],
  '.txt': ['text/plain'], '.md': ['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream'],
  '.pb': ['application/octet-stream', 'text/plain'], '.rlmedia': ['application/octet-stream'],
  '.rlstory': ['application/octet-stream'], '.sha256': ['application/octet-stream', 'text/plain'],
  '': ['application/octet-stream', 'text/plain'],
};
export function httpEvidence(dir, binding) {
  assert.ok(path.isAbsolute(dir), 'Explicit absolute actual HTTP directory required');
  const get = (name) => read(contained(dir, name));
  const inventoryRaw = get('expected-inventory.json'), expected = JSON.parse(inventoryRaw);
  assert.deepEqual(inventoryRaw, read(at('repository/expected-inventory.json')));
  const lock = json(at('repository/source-lock.json'));
  assert.equal(sha(inventoryRaw), lock.expectedInventorySha256);
  assert.equal(expected.base, BASE); assert.equal(expected.files.length, FILES);
  const byPath = new Map(expected.files.map((row) => [row.path, row]));
  assert.equal(byPath.size, FILES);
  const report = JSON.parse(get('http-report.json'));
  const requestRaw = get('execution-request.json'), request = JSON.parse(requestRaw);
  assert.deepEqual(requestRaw, read(at('execution-request.reviewed.json')));
  assert.equal(sha(requestRaw), CONTEXT.requestSha256);
  const auditHead = CONTEXT.auditHead;
  const sourcePins = CONTEXT.sourcePins;
  assert.deepEqual(sourcePins.map(row => row.slice(0, 2)), [
    ['auditor.py', 'audit/http-tools/http_audit.py'],
    ['audit_binding.py', 'audit/http-tools/audit_binding.py'],
    ['execution-request.json', 'audit/execution-request.reviewed.json'],
    [null, '.github/workflows/deploy.yml'],
  ]);
  for (const [output, source, digest] of sourcePins) {
    const original = execFileSync('git', ['-C', at('audit-repository'), 'show', auditHead + ':' + source], { maxBuffer: 1024 * 1024, timeout: 10_000 });
    assert.equal(sha(original), digest, 'Reviewed audit source pin: ' + source);
    if (output) assert.deepEqual(get(output), original, 'Hosted helper/request differs from reviewed source');
  }
  const hosted = json(at('hosted-http-run-original.json'));
  assert.equal(hosted.id, CONTEXT.auditRunId); assert.equal(hosted.head_sha, auditHead);
  assert.equal(hosted.head_branch, 'codex/audit-archive57-http');
  assert.equal(hosted.repository.full_name, REPO); assert.equal(hosted.event, 'workflow_dispatch');
  assert.equal(hosted.path, '.github/workflows/deploy.yml');
  assert.equal(hosted.status, 'completed'); assert.equal(hosted.conclusion, 'success');
  const jobs = json(at('hosted-http-jobs-original.json'));
  assert.equal(jobs.total_count, 1); assert.equal(jobs.jobs.length, 1);
  assert.equal(jobs.jobs[0].name, 'audit-public-bytes');
  assert.equal(jobs.jobs[0].run_id, hosted.id); assert.equal(jobs.jobs[0].head_sha, auditHead);
  assert.equal(jobs.jobs[0].status, 'completed'); assert.equal(jobs.jobs[0].conclusion, 'success');
  const artifacts = json(at('hosted-http-artifacts-original.json'));
  assert.equal(artifacts.total_count, 1); assert.equal(artifacts.artifacts.length, 1);
  const artifact = artifacts.artifacts[0], zip = read(at('hosted-http-evidence-original.zip'));
  assert.equal(artifact.id, CONTEXT.artifact.id); assert.equal(artifact.name, 'archive57-public-http-evidence');
  assert.equal(artifact.expired, false); assert.equal(artifact.workflow_run.id, hosted.id);
  assert.equal(artifact.workflow_run.head_sha, auditHead);
  assert.equal(zip.length, artifact.size_in_bytes); assert.equal(artifact.digest, 'sha256:' + sha(zip));
  assert.equal(sha(zip), CONTEXT.artifact.sha256); assert.equal(zip.length, CONTEXT.artifact.bytes);
  for (const [role, pin] of Object.entries(request.pins)) {
    const raw = get('authority-originals/' + role + (role === 'receiptZIP' ? '.zip' : '.json'));
    assert.equal(raw.length, pin.bytes); assert.equal(sha(raw), pin.sha256);
  }
  assert.equal(request.reviewed, true);
  for (const key of ['format', 'archiveCommit', 'archiveTree', 'sourceCheckoutCommit', 'runId', 'deploymentId', 'deploymentStatusId', 'receiptArtifactId'])
    assert.deepEqual(request[key], binding[key]);
  assert.equal(report.executionRequestSha256, sha(requestRaw));
  for (const key of ['archiveCommit', 'archiveTree', 'sourceCheckoutCommit', 'runId', 'deploymentId', 'deploymentStatusId', 'receiptArtifactId'])
    assert.deepEqual(report[key], binding[key]);
  const parseLines = (name) => get(name).toString().trim().split('\n').map(JSON.parse);
  const rows = parseLines('http-results.jsonl'), attempts = parseLines('http-attempts.jsonl');
  assert.equal(rows.length, FILES);
  assert.equal(new Set(rows.map((row) => row.path)).size, FILES);
  const grouped = new Map();
  for (const row of attempts) {
    const pin = byPath.get(row.path); assert.ok(pin, 'Unexpected attempt path');
    assert.equal(row.url, BASE + pin.path.split('/').map(encodeURIComponent).join('/'));
    assert.equal(row.expectedBytes, pin.bytes); assert.equal(row.expectedSha256, pin.sha256);
    assert.ok(['PASS', 'FAIL'].includes(row.status));
    assert.equal(typeof row.requestStarted, 'boolean');
    const previous = grouped.get(row.path) ?? [];
    assert.equal(row.attempt, previous.length + 1);
    assert.ok(row.attempt <= 3);
    assert.ok(previous.every((item) => item.status === 'FAIL'), 'Attempt after accepted result');
    previous.push(row); grouped.set(row.path, previous);
  }
  let total = 0;
  for (const row of rows) {
    const pin = byPath.get(row.path), history = grouped.get(row.path);
    assert.ok(pin && history?.length, 'Missing path/attempt');
    assert.deepEqual(row, history.at(-1), 'Final result differs from final raw attempt');
    assert.equal(row.status, 'PASS'); assert.equal(row.statusCode, 200);
    assert.equal(row.requestStarted, true); assert.equal(row.finalURL, row.url);
    assert.equal(row.bytes, pin.bytes); assert.equal(row.sha256, pin.sha256);
    assert.ok(['', 'identity'].includes(row.contentEncoding.trim().toLowerCase()));
    assert.ok(MIMES[path.posix.extname(pin.path).toLowerCase()]?.includes(row.contentType.split(';', 1)[0].trim().toLowerCase()));
    if (row.contentLength !== null) {
      assert.match(row.contentLength.trim(), /^\d+$/); assert.equal(Number(row.contentLength), pin.bytes);
    }
    total += row.bytes;
  }
  assert.equal(grouped.size, FILES); assert.equal(total, BYTES);
  const failedAttempts = attempts.filter((row) => row.status === 'FAIL').length;
  const retriedFiles = rows.filter((row) => row.attempt > 1).length;
  assert.equal(report.status, 'PASS'); assert.equal(report.base, BASE);
  assert.equal(report.files, FILES); assert.equal(report.expectedBytes, BYTES);
  assert.equal(report.verifiedBytes, total); assert.equal(report.failedFiles, 0);
  assert.deepEqual(report.failures, []); assert.deepEqual(report.skipped, []);
  assert.equal(report.attempts, attempts.length); assert.equal(report.failedAttempts, failedAttempts);
  assert.equal(report.retriedFiles, retriedFiles); assert.equal(report.auditDeadlineExceeded, false);
  assert.equal(report.sourcePinsUnchanged, true); assert.equal(report.authorityError, null);
  assert.equal(report.allFinalURLsExact, true); assert.equal(report.payloadFilesPersisted, false);
  assert.equal(report.preservedOldCanonicalRows, 0);
  assert.equal(report.expectedInventorySha256, sha(inventoryRaw));
  return { report, paths: rows.length, attempts: attempts.length, bytes: total, failedAttempts, retriedFiles,
    retries: attempts.length - rows.length, reportSha256: sha(get('http-report.json')),
    resultsSha256: sha(get('http-results.jsonl')), attemptsSha256: sha(get('http-attempts.jsonl')),
    inventorySha256: sha(inventoryRaw) };
}
export function nativeEvidence(file, expectedSha, binding) {
  assert.match(expectedSha, /^[a-f0-9]{64}$/);
  const raw = read(file), receipt = JSON.parse(raw);
  assert.equal(sha(raw), expectedSha);
  assert.equal(receipt.kind, 'scoped native public availability');
  assert.equal(receipt.version, 'v0.88.0'); assert.equal(receipt.sourceRevision, SOURCE);
  assert.equal(receipt.archivePublisher, COMMIT); assert.equal(receipt.productionRun, RUN);
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.deployment, binding.deploymentId); assert.equal(receipt.deploymentStatus, binding.deploymentStatusId);
  assert.equal(receipt.productionReceipt.artifact, binding.receiptArtifactId);
  assert.equal(receipt.productionReceipt.bytes, binding.pins.receiptZIP.bytes);
  assert.equal(receipt.productionReceipt.sha256, binding.pins.receiptZIP.sha256);
  assert.equal(receipt.entry, BASE);
  assert.equal(receipt.gameURL, BASE + 'releases/v0.88.0/site/game/');
  assert.equal(receipt.canonicalReleaseMarker, BASE + 'releases/v0.88.0/release.json');
  assert.ok(Array.isArray(receipt.steps) && receipt.steps.length > 0);
  assert.ok(receipt.steps.every((step) => typeof step.action === 'string' && typeof step.result === 'string'));
  assert.ok(Array.isArray(receipt.productFailures) && Array.isArray(receipt.automationFailures));
  assert.ok(Array.isArray(receipt.limits) && Array.isArray(receipt.knownObservations));
  assert.ok(Array.isArray(receipt.screenshots));
  for (const shot of receipt.screenshots) {
    assert.ok(typeof shot.name === 'string' && Number.isSafeInteger(shot.bytes) && shot.bytes > 0);
    assert.match(shot.sha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(Number.isSafeInteger(receipt.retries) && receipt.retries >= 0);
  assert.ok(Number.isSafeInteger(receipt.reloads) && receipt.reloads >= 0);
  return { raw, receipt };
}
