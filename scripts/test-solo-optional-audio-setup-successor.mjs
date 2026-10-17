import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { parse } from 'acorn';
import {
  bindReadinessJob,
  readinessMatrix,
  validateReadinessPlan,
} from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const oldPath = 'docs/performance/solo-optional-start-audio-e1cc-plan.json';
const path = 'docs/performance/solo-optional-start-audio-e1cc-v2-plan.json';
const workflowPath = '.github/workflows/solo-remote-optional-start-audio-e1cc-v2-temporary.yml';
const old = JSON.parse(await read(oldPath)),
  manifest = JSON.parse(await read(path)),
  workflow = (await read(workflowPath)).toString();
const before = '239c574ecddd5bb6d5896e621d9edc53e7f6a313';
function engineInventory(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
    found = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ForOfStatement' &&
      source.slice(node.start, node.end).includes('report.playwright.engines[engine]')
    )
      found.push(node);
    for (const child of Object.values(node))
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
  }
  visit(ast);
  assert.equal(found.length, 1, 'execute the unique complete common-runner engine inventory loop');
  return vm.runInNewContext(
    `(async ({extension,plan,pw,digest})=>{const report={playwright:{engines:{}}};${source.slice(found[0].start, found[0].end)};return report;})`,
    {},
    { timeout: 1000 },
  );
}
const runner = await read('scripts/run-solo-remote-correctness.mjs');
async function inventory(installed, extension = 'readiness', engine = 'chromium') {
  const checks = [],
    pw = Object.fromEntries(
      ['chromium', 'webkit'].map((name) => [name, { executablePath: () => '/installed/' + name }]),
    );
  const report = await engineInventory(runner.toString())({
    extension,
    plan: { engine },
    pw,
    digest: async (path) => {
      checks.push(path);
      if (!installed.includes(path.split('/').at(-1)))
        throw Object.assign(new Error('ENOENT ' + path), { code: 'ENOENT' });
      return { path, bytes: 1, sha256: 'a'.repeat(64) };
    },
  });
  return { report, checks };
}
function installed(text) {
  const commands = [...text.matchAll(/playwright" install --with-deps ([^\n]+?) 2>&1/g)];
  assert.equal(commands.length, 1);
  return commands[0][1].trim().split(/\s+/);
}
test('actual common-runner inventory reproduces missing WebKit and accepts the two-engine setup for one Chromium row', async () => {
  const failed = await read(
    '.github/workflows/solo-remote-optional-start-audio-e1cc-temporary.yml',
  );
  assert.deepEqual(installed(failed.toString()), ['chromium']);
  await assert.rejects(
    inventory(installed(failed.toString())),
    (e) => e.code === 'ENOENT' && e.message.endsWith('/webkit'),
  );
  assert.deepEqual(installed(workflow), ['chromium', 'webkit']);
  const result = await inventory(installed(workflow));
  assert.deepEqual(Object.keys(result.report.playwright.engines), ['chromium', 'webkit']);
  assert.deepEqual(result.checks, ['/installed/chromium', '/installed/webkit']);
  await assert.rejects(
    inventory(installed(workflow.replace('chromium webkit 2>&1', 'chromium 2>&1'))),
    { code: 'ENOENT' },
  );
  for (const extension of ['cpu-profile', 'lifecycle', 'offline', 'demo', 'demo-active'])
    assert.deepEqual((await inventory(['chromium'], extension)).checks, ['/installed/chromium']);
  assert.deepEqual((await inventory(['webkit'], 'diagnostics', 'webkit')).checks, [
    '/installed/webkit',
  ]);
});
test('new explicit setup edge preserves every candidate-only workload field and rejects invented failure provenance', async () => {
  const p = bindReadinessJob(manifest, 'chromium'),
    prior = bindReadinessJob(old, 'chromium');
  assert.deepEqual(readinessMatrix(manifest), readinessMatrix(old));
  assert.equal(p.rows.length, 1);
  assert.throws(() => bindReadinessJob(manifest, 'webkit'));
  for (const key of Object.keys(prior).filter(
    (k) =>
      !['adapterInputs', 'frozenTools', 'release', 'releaseTrigger', 'priorResults'].includes(k),
  ))
    assert.deepEqual(p[key], prior[key], key);
  assert.equal(p.release.onceOnlyBefore, before);
  assert.equal(p.release.setupCorrection.priorNativeObservations, 0);
  const raw = await read(oldPath);
  assert.deepEqual(p.release.setupCorrection.originalDeclaration, {
    path: oldPath,
    bytes: raw.length,
    sha256: hash(raw),
  });
  for (const change of [
    (p) => delete p.release.setupCorrection,
    (p) => p.release.setupCorrection.priorRun++,
    (p) => p.release.setupCorrection.priorJob++,
    (p) => p.release.setupCorrection.priorRowsNotRun++,
    (p) => p.release.setupCorrection.priorNativeObservations++,
    (p) => (p.release.setupCorrection.runtimeChanged = true),
    (p) => (p.release.setupCorrection.scenarioChanged = true),
    (p) => (p.release.setupCorrection.gateChanged = true),
    (p) => p.release.setupCorrection.automaticRetries++,
    (p) => (p.release.setupCorrection.originalDeclaration.sha256 = '0'.repeat(64)),
    (p) => (p.release.setupCorrection.priorTooling = '0'.repeat(40)),
    (p) => (p.release.onceOnlyBefore = old.release.onceOnlyBefore),
    (p) => (p.cpu = 2),
    (p) => p.rows.push(p.rows[0]),
    (p) => p.protocol.observationTimeoutMs++,
    (p) => p.rows[0].timeoutMs++,
  ]) {
    const q = structuredClone(p);
    change(q);
    assert.throws(() => validateReadinessPlan(q));
  }
  const oldWithNewProof = structuredClone(prior);
  oldWithNewProof.release.setupCorrection = p.release.setupCorrection;
  assert.throws(() => validateReadinessPlan(oldWithNewProof));
});
test('current prospective inputs, exact source/limits and four-condition before239 guard are checked independently', async () => {
  const terms = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    `github.event.before == '${before}'`,
  ];
  const guard = (text) => {
    assert(text.includes('    if: ' + terms.join(' && ') + '\n'));
    for (const word of [
      'workflow_dispatch',
      'workflow_run',
      'continue-on-error',
      'if: ${{ false }}',
    ])
      assert(!text.includes(word), word);
  };
  guard(workflow);
  for (const term of terms) assert.throws(() => guard(workflow.replace(term, 'true')));
  assert.equal(manifest.releaseTrigger.onceOnlyBefore, before);
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  for (const value of [
    'engine: [chromium]',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
    'bind-plan ' + path,
    'ref: ' + manifest.candidate.revision,
    'cancel-in-progress: false',
  ])
    assert(workflow.includes(value), value);
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(sparse.length, new Set(sparse).size);
  for (const ref of [...manifest.adapterInputs, ...manifest.frozenTools, manifest.fixture]) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(hash(b), ref.sha256, ref.path);
    assert(sparse.includes(ref.path), ref.path);
  }
  for (const input of [
    path,
    workflowPath,
    oldPath,
    'docs/performance/fixtures/solo-optional-start-audio/239-execution-source.json',
    'scripts/test-solo-optional-audio-setup-successor.mjs',
    'docs/performance/fixtures/solo-readiness-media/required-original-cancel-start-v2.qualification.fixture',
    'docs/performance/fixtures/solo-readiness-resume/warm-compact-v2.qualification.fixture',
    '.github/workflows/solo-remote-readiness-diagnosed-239-temporary.yml',
    'docs/performance/solo-readiness-diagnosed-239-plan.json',
  ])
    assert(sparse.includes(input), input);
  const tests = workflow.match(/node --test --test-concurrency=2 ([^\n]+) 2>&1/)[1].split(' ');
  for (const input of tests) {
    assert(sparse.includes(input), input);
    assert((await read(input)).length > 0);
  }
});
test('actual one-module command binds only the reviewed successor and preserves the original recipe arguments', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-audio-setup-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'adapter.mjs'), await read('scripts/solo-remote-readiness.mjs'));
  await writeFile(join(dir, 'plan.json'), await read(path));
  const result = spawnSync(
    process.execPath,
    [
      join(dir, 'adapter.mjs'),
      'bind-plan',
      join(dir, 'plan.json'),
      join(dir, 'bound.json'),
      'chromium',
    ],
    { cwd: dir, encoding: 'utf8', timeout: 5000, maxBuffer: 65536 },
  );
  assert.equal(result.status, 0, result.stderr);
  const bound = JSON.parse(await readFile(join(dir, 'bound.json')));
  const expected = bindReadinessJob(manifest, 'chromium'),
    bytes = await read(path);
  expected.manifestInput = {
    path: join(dir, 'plan.json'),
    bytes: bytes.length,
    sha256: hash(bytes),
  };
  assert.deepEqual(bound, expected);
});
