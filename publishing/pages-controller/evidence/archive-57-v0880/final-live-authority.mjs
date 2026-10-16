import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { REPO, BASE, COMMIT, TREE, RUN, at, read, json, sha, deployment, httpEvidence, writeJSON } from './archive57-evidence-contract.mjs';
assert.equal(process.argv.length, 4, 'Usage: final-live-authority.mjs ABS_ACTUAL_DEPLOYMENT_BINDING ABS_HTTP_DIR');
const binding = deployment(process.argv[2]);
const checked = httpEvidence(process.argv[3], binding), report = checked.report;
const readback = json(at('raw-results-readback.json'));
assert.equal(report.status, 'PASS'); assert.equal(readback.reportSha256, sha(read(process.argv[3] + '/http-report.json')));
assert.equal(readback.archiveCommit, COMMIT);
for (const key of ['reportSha256', 'resultsSha256', 'attemptsSha256', 'inventorySha256', 'attempts', 'retries', 'failedAttempts', 'retriedFiles'])
  assert.deepEqual(readback[key], checked[key]);
const pins = [];
function api(suffix, name) {
  const raw = execFileSync('gh', ['api', 'repos/' + REPO + '/' + suffix], { maxBuffer: 4 * 1024 * 1024, timeout: 60_000 });
  fs.writeFileSync(at(name), raw, { flag: 'wx' });
  pins.push({ path: name, bytes: raw.length, sha256: sha(raw) }); return JSON.parse(raw);
}
const ref = api('git/ref/heads/main', 'after-main-original.json');
const commit = api('git/commits/' + COMMIT, 'after-commit-original.json');
const run = api('actions/runs/' + RUN, 'after-production-run-original.json');
const statuses = api('deployments/' + binding.deploymentId + '/statuses?per_page=100', 'after-deployment-statuses-original.json');
const deployments = api('deployments?environment=github-pages&per_page=100', 'after-deployments-original.json');
const latest = statuses.reduce((a, b) => a.id > b.id ? a : b);
assert.equal(ref.object.sha, COMMIT); assert.equal(commit.tree.sha, TREE);
assert.equal(run.head_sha, COMMIT); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
assert.equal(latest.id, binding.deploymentStatusId); assert.equal(latest.state, 'success');
assert.equal(latest.environment_url, BASE);
assert.equal(deployments[0].id, binding.deploymentId); assert.equal(deployments[0].sha, COMMIT);
const marker = execFileSync('curl', ['--fail', '--silent', '--show-error', '--max-time', '30', BASE + 'releases/v0.88.0/release.json'], { maxBuffer: 1024 * 1024, timeout: 35_000 });
fs.writeFileSync(at('after-public-release-original.json'), marker, { flag: 'wx' });
const pin = json(at('repository/expected-inventory.json')).files.find((row) => row.path === 'releases/v0.88.0/release.json');
assert.equal(marker.length, pin.bytes); assert.equal(sha(marker), pin.sha256);
pins.push({ path: 'after-public-release-original.json', bytes: marker.length, sha256: sha(marker) });
const result = { status: 'PASS_FRESH_POST_AUDIT_AUTHORITIES', checkedAt: new Date().toISOString(),
  archiveCommit: COMMIT, archiveTree: TREE, productionRunId: RUN, deploymentId: binding.deploymentId,
  deploymentStatusId: latest.id, pins, scope: 'Fresh authority/marker after the completed audit; not a native or gameplay pass.' };
assert.ok(Date.parse(result.checkedAt) >= Date.parse(report.verifiedAt));
writeJSON(at('final-live-authority.json'), result); console.log(JSON.stringify(result));
