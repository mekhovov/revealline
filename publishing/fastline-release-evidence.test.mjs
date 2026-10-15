import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { fastlineEvidencePolicy } from './fastline-release-evidence.mjs';

const required = JSON.parse(await readFile(new URL('./test-policy.json', import.meta.url)));
const waived = {
  ...required,
  mode: 'waived',
  authorization: 'explicit-user-request-20260922',
};

test('required source cannot enter waived evidence through publish or resume', () => {
  assert.equal(required.mode, 'required');
  for (const mode of ['publish', 'resume'])
    assert.throws(() => fastlineEvidencePolicy(required, mode), /exact source requires full-test/);
  assert.deepEqual(fastlineEvidencePolicy(required, 'shadow'), {
    sourceTestPolicy: 'required',
    evidenceAdapter: 'unsupported-required',
    evidenceAdapterSupported: false,
  });
});

test('historical explicit waivers retain their adapter and malformed policies never grant one', () => {
  for (const mode of ['shadow', 'publish', 'resume']) {
    assert.equal(fastlineEvidencePolicy(waived, mode).evidenceAdapter, 'waived');
    for (const policy of [null, {}, { ...waived, authorization: 'invented' }, '{'])
      assert.throws(() => fastlineEvidencePolicy(policy, mode));
  }
  assert.throws(() => fastlineEvidencePolicy(waived, 'force'), /Unknown Fastline mode/);
});

test('the admission CLI rejects required source without emitting success outputs', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fastline-evidence-policy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const policyPath = path.join(root, 'source-policy.json');
  const output = path.join(root, 'outputs');
  await writeFile(policyPath, JSON.stringify(required));
  await writeFile(output, 'existing=value\n');
  const cli = fileURLToPath(new URL('./fastline-release-evidence.mjs', import.meta.url));
  const env = { ...process.env, SOURCE_TEST_POLICY: policyPath, GITHUB_OUTPUT: output };
  const rejected = spawnSync(process.execPath, [cli], {
    env: { ...env, MODE: 'publish' },
    encoding: 'utf8',
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Do not waive tests/);
  assert.equal(await readFile(output, 'utf8'), 'existing=value\n');
  const shadow = spawnSync(process.execPath, [cli], {
    env: { ...env, MODE: 'shadow' },
    encoding: 'utf8',
  });
  assert.equal(shadow.status, 0);
  assert.match(shadow.stdout, /Publication remains blocked/);
  assert.match(await readFile(output, 'utf8'), /evidenceAdapterSupported=false/);
});

test('Fastline checks the exact source policy before qualification, inspection or resume lookup', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/fastline-release.yml', import.meta.url),
    'utf8',
  );
  const trusted = workflow.split('      - name: Set up admission runtime')[0];
  for (const name of ['fastline-release-evidence.mjs', 'test-policy.mjs'])
    assert.ok(trusted.includes(`publishing/${name}`));
  const source = workflow
    .split('      - name: Check out exact merged source metadata')[1]
    .split('      - name: Require exact source identity')[0];
  assert.match(source, /ref: \$\{\{ inputs.source_sha \}\}/);
  assert.match(source, /publishing\/test-policy\.json/);
  const guard = workflow.indexOf(
    '      - name: Require a supported exact-source evidence contract',
  );
  assert.ok(guard > workflow.indexOf('      - name: Require exact source identity'));
  assert.ok(guard < workflow.indexOf('      - name: Locate an exact completed qualification'));
  assert.ok(guard < workflow.indexOf('\n  qualify:'));
  const step = workflow.slice(guard).split('      - name: Require merged PR')[0];
  assert.doesNotMatch(step, /\n\s+if:/);
  assert.match(step, /SOURCE_TEST_POLICY: source\/publishing\/test-policy\.json/);
  assert.match(step, /MODE: \$\{\{ inputs.mode \}\}/);
  assert.match(step, /run: node publishing\/fastline-release-evidence\.mjs/);
});
