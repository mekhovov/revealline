import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { bindLifecycleJob, lifecycleMatrix } from './solo-remote-lifecycle.mjs';
import {
  validateOfflinePlan,
  verifyOfflineFixedEvidence,
  offlineEvidenceCopySuccessor,
} from './solo-remote-offline.mjs';
const root = new URL('../', import.meta.url),
  repository = fileURLToPath(root);
const head = 'c41a02216c0811952232a387fd1743e09452c269';
const guard = `github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${head}'`;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const paths = {
  offline: [
    'docs/performance/solo-remote-offline-candidate-v2-plan.json',
    'docs/performance/solo-remote-offline-candidate-v3-plan.json',
    '.github/workflows/solo-remote-offline-candidate-v3-temporary.yml',
  ],
  lifecycle: [
    'docs/performance/solo-native-lifecycle-plan.json',
    'docs/performance/solo-native-lifecycle-v2-plan.json',
    '.github/workflows/solo-remote-native-lifecycle-v2-temporary.yml',
  ],
};
// Actual executed helper identities are historical; they must not follow HEAD.
const lifecycleWitnessBytes = await readFile(
  new URL('docs/performance/fixtures/solo-native-lifecycle/696-execution-source.json', root),
);
assert.equal(
  createHash('sha256').update(lifecycleWitnessBytes).digest('hex'),
  'd7eeda3b2500754e80a870904deb77508006c21f9076a525a8c9b31ad070b27b',
);
const lifecycleWitness = JSON.parse(lifecycleWitnessBytes);
assert.equal(lifecycleWitness.sourceRevision, '69639b30d985ffa723a4d0c11756b632fc2da5c1');
assert.equal(lifecycleWitness.sourceTree, 'd022c57efa75dbe7b7aeeca00a1950f61426595b');
// The actual696 runner is historical too; its receipt does not authorize current helpers.
const historicalRunnerBytes = await readFile(
  new URL('docs/performance/fixtures/solo-native-lifecycle/696-runner-source.json', root),
);
assert.equal(
  createHash('sha256').update(historicalRunnerBytes).digest('hex'),
  '98b44d2a23cee5e124504cb2e3d4f97f2024846771d920e6e22ec61746f0dfbc',
);
const historicalRunner = JSON.parse(historicalRunnerBytes);
const assertHistoricalRunnerRef = (ref, witness = historicalRunner) => {
  assert.deepEqual(witness, {
    format: 'SoloLifecycleHistoricalRunnerV1',
    sourceRevision: '69639b30d985ffa723a4d0c11756b632fc2da5c1',
    sourceTree: 'd022c57efa75dbe7b7aeeca00a1950f61426595b',
    path: 'scripts/run-solo-remote-correctness.mjs',
    gitBlob: 'b3a8d041cdb70697183f1b3562a5f852f70c26fd',
    bytes: 57545,
    sha256: 'cdec62bc65481f30bb36d7055227594a727f390e75d5bbb86415f1b7fa2a07c7',
    scope:
      'Exact actual696 source runner for already executed a6 lifecycle and offline declarations; no authority for a new source release.',
  });
  if (ref.path !== witness.path) return false;
  assert.deepEqual(ref, { path: witness.path, bytes: witness.bytes, sha256: witness.sha256 });
  return true;
};
const recordedLifecycleRef = (ref) => {
  if (assertHistoricalRunnerRef(ref)) return true;
  if (
    !['scripts/solo-remote-lifecycle.mjs', 'scripts/observe-solo-native-lifecycle.mjs'].includes(
      ref.path,
    )
  )
    return false;
  const recorded = lifecycleWitness.files.find((file) => file.path === ref.path);
  assert.deepEqual(ref, { path: recorded.path, bytes: recorded.bytes, sha256: recorded.sha256 });
  return true;
};
for (const recorded of lifecycleWitness.files.filter((file) => !file.path.startsWith('scripts/'))) {
  const bytes = await readFile(new URL(recorded.path, root));
  assert.equal(bytes.length, recorded.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), recorded.sha256);
}
async function check(kind, plan, workflow) {
  const [oldPath, path, workflowPath] = paths[kind];
  const oldBytes = await readFile(new URL(oldPath, root)),
    old = JSON.parse(oldBytes);
  for (const key of kind === 'offline'
    ? [
        'candidate',
        'baseline',
        'rows',
        'resources',
        'offline',
        'helperTimeoutMs',
        'setupTimeoutMs',
        'evidenceBytes',
        'profileEvidenceBytes',
        'bindingScope',
        'setupSuccessor',
      ]
    : [
        'candidate',
        'baseline',
        'protocol',
        'resources',
        'rows',
        'jobs',
        'runtimeRevision',
        'setupTimeoutMs',
        'helperTimeoutMs',
        'evidenceBytes',
        'rowEvidenceBytes',
        'fixture',
        'predecessor',
      ])
    assert.deepEqual(plan[key], old[key], key);
  assert(workflow.includes('    if: ' + guard + '\n'));
  assert(!workflow.includes('workflow_dispatch'));
  assert(workflow.includes('cancel-in-progress: false'));
  const command = workflow.split('\n').find((l) => l.includes('node --test'));
  for (const file of [
    'scripts/test-solo-source-verifier-smoke.mjs',
    'scripts/test-solo-c41-setup-successors.mjs',
  ])
    assert(command.includes(file));
  for (const file of [
    ...Object.values(paths).flat(),
    'scripts/test-solo-c41-setup-successors.mjs',
    'game/build-config.json',
  ])
    assert(workflow.includes('            /' + file + '\n'), file);
  assert.equal((workflow.match(/if: \$\{\{ always\(\) \}\}/g) || []).length, 2);
  assert(workflow.includes('persist-credentials: false'));
  assert(workflow.includes('fetch-depth: 1'));
  let refs;
  if (kind === 'offline') {
    validateOfflinePlan(plan);
    assert.deepEqual(plan.evidenceCopySuccessor, offlineEvidenceCopySuccessor());
    assert.equal(plan.evidenceCopySuccessor.priorManifest.sha256, sha(oldBytes));
    assert.equal(plan.evidenceCopySuccessor.priorManifest.bytes, oldBytes.length);
    // This executed declaration intentionally rejects today's different runner.
    // Verify its old authority independently; future declarations must pin current bytes.
    const runnerRef = plan.fixedEvidenceInputs.find((r) => r.path === historicalRunner.path);
    assertHistoricalRunnerRef(runnerRef);
    const currentRunner = await readFile(new URL(runnerRef.path, root));
    if (currentRunner.length === runnerRef.bytes && sha(currentRunner) === runnerRef.sha256)
      await verifyOfflineFixedEvidence(plan, repository);
    else
      await assert.rejects(
        () => verifyOfflineFixedEvidence(plan, repository),
        /Exact regular fixed evidence|Fixed evidence byte identity|Fixed evidence hash/,
      );
    assert(workflow.includes('console.log(receipt);'));
    assert(workflow.includes('verifyOfflineFixedEvidence(plan,process.cwd())'));
    assert(
      workflow.indexOf('verifyOfflineFixedEvidence(plan,process.cwd())') <
        workflow.indexOf('103m node scripts/run-solo-remote-correctness.mjs'),
    );
    assert(workflow.includes('timeout-minutes: 165'));
    assert(workflow.includes('timeout-minutes: 104'));
    assert(workflow.includes("<= 28*1024*1024, 'Aggregate setup cap'"));
    refs = [...plan.adapterInputs, ...plan.fixedEvidenceInputs];
  } else {
    const bound = bindLifecycleJob(plan, 'chromium-background');
    assert.equal(lifecycleMatrix(plan).include[0].jobMinutes, 100);
    assert.deepEqual(plan.setupSuccessor, {
      format: 'SoloNativeDisplayDependencySuccessorV1',
      priorRun: 39015298892,
      priorTooling: head,
      priorConclusion: 'failure',
      priorNativeObservations: 0,
      priorManifest: { path: oldPath, bytes: oldBytes.length, sha256: sha(oldBytes) },
      priorSummarySHA256: '43809e719324c40661c923921c2f23894f736c24bfec2628a69e70ef7d7b13aa',
      package: 'x11-utils',
      runtimeChanged: false,
      scenarioChanged: false,
      gateChanged: false,
      automaticRetries: 0,
    });
    assert.equal(plan.release.onceOnlyBefore, head);
    assert.equal(plan.releaseTrigger.onceOnlyBefore, head);
    assert(
      workflow.includes(
        'timeout --signal=TERM --kill-after=10s 120s sudo env DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y x11-utils',
      ),
    );
    assert(
      workflow.includes(
        "dpkg-query -W -f='${binary:Package}\\t${Version}\\n' x11-utils xvfb xauth",
      ),
    );
    assert(
      workflow.includes(
        'for tool in xvfb-run Xvfb xauth xdpyinfo; do test -x "/usr/bin/$tool"; done',
      ),
    );
    assert(
      workflow.includes(
        'sha256sum /usr/bin/xvfb-run /usr/bin/Xvfb /usr/bin/xauth /usr/bin/xdpyinfo',
      ),
    );
    assert(workflow.includes('/usr/bin/xdpyinfo -version'));
    assert(workflow.includes("'tools-npm.log','display-dependencies.log'"));
    assert(workflow.includes('timeout-minutes: 100'));
    assert(workflow.includes('timeout-minutes: 58'));
    assert(workflow.includes('3420s node'));
    refs = [...bound.adapterInputs, ...bound.frozenTools, bound.fixture];
  }
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  for (const ref of refs) {
    if (assertHistoricalRunnerRef(ref) || (kind === 'lifecycle' && recordedLifecycleRef(ref))) {
      assert(workflow.includes('            /' + ref.path + '\n'), ref.path);
      continue;
    }
    const bytes = await readFile(new URL(ref.path, root));
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
    assert(workflow.includes('            /' + ref.path + '\n'), ref.path);
  }
  for (const source of ['baseline', 'candidate'])
    assert(
      workflow.includes('          ref: ' + plan[source].revision + '\n          path: ' + source),
    );
  assert(workflow.includes(path));
  assert(workflow.includes(workflowPath));
}
for (const [kind, [, path, wf]] of Object.entries(paths)) {
  const plan = JSON.parse(await readFile(new URL(path, root))),
    workflow = await readFile(new URL(wf, root), 'utf8');
  test(`${kind} separately declared c41 setup successor preserves exact source and complete protocol`, () =>
    check(kind, plan, workflow));
  test(`${kind} successor rejects changed source, bounds, failed predecessor or setup proof`, async () => {
    for (const mutate of [
      (p) => p.candidate.artifact++,
      (p) => (p.adapterInputs[0].sha256 = '0'.repeat(64)),
      (p) => p.helperTimeoutMs++,
      (p) => {
        (kind === 'offline' ? p.evidenceCopySuccessor : p.setupSuccessor).priorRun++;
      },
    ]) {
      const value = structuredClone(plan);
      mutate(value);
      await assert.rejects(check(kind, value, workflow));
    }
    for (const value of [
      workflow.replace(guard, 'true'),
      workflow.replaceAll('scripts/test-solo-source-verifier-smoke.mjs', 'missing-smoke'),
      workflow.replace(
        kind === 'offline' ? 'verifyOfflineFixedEvidence(plan,process.cwd())' : '-y x11-utils',
        kind === 'offline' ? '{}' : '-y xvfb',
      ),
    ])
      await assert.rejects(check(kind, plan, value));
  });
}

test('historical runner source witness rejects changed manifest references and witness identity', () => {
  const ref = {
    path: historicalRunner.path,
    bytes: historicalRunner.bytes,
    sha256: historicalRunner.sha256,
  };
  assert.equal(assertHistoricalRunnerRef(ref), true);
  assert.throws(() => assertHistoricalRunnerRef({ ...ref, bytes: ref.bytes + 1 }));
  assert.throws(() => assertHistoricalRunnerRef({ ...ref, sha256: '0'.repeat(64) }));
  for (const field of ['sourceRevision', 'sourceTree', 'gitBlob', 'sha256']) {
    const changed = structuredClone(historicalRunner);
    changed[field] = '0'.repeat(changed[field].length);
    assert.throws(() => assertHistoricalRunnerRef(ref, changed));
  }
});
