import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindTouchJob, touchMatrix, TOUCH_JOBS } from './solo-remote-touch.mjs';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oldPlanPath = 'docs/performance/solo-native-touch-plan.json';
const oldWorkflowPath = '.github/workflows/solo-remote-native-touch-temporary.yml';
const planPath = 'docs/performance/solo-native-touch-v2-plan.json';
const workflowPath = '.github/workflows/solo-remote-native-touch-v2-temporary.yml';
const testPath = 'scripts/test-solo-native-touch-v2-release.mjs';
const edge = 'c41a02216c0811952232a387fd1743e09452c269';
const guard = `github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${edge}'`;
const originalBytes = await read(oldPlanPath);
const original = JSON.parse(originalBytes);
const oldWorkflowBytes = await read(oldWorkflowPath);
const oldWorkflow = oldWorkflowBytes.toString();
const plan = JSON.parse(await read(planPath));
const workflow = (await read(workflowPath)).toString();
const declarations = [
  {
    path: oldPlanPath,
    bytes: 10560,
    sha256: '37743d7f5336312093fa4c6f09338945483b90347d1fb4972e8ad6de990e60f2',
    blob: 'aa4cd778a70ed8a4aeea134f3a2b65a26eee109d',
  },
  {
    path: oldWorkflowPath,
    bytes: 14806,
    sha256: '2201784f3549a6995cce205eb3b2233078059ddc47ba9e7c224c49c68cba79b5',
    blob: '761b8ccac3fb82e563a6b60221ffccc1f86cf414',
  },
];
function check(value, text) {
  const normalized = structuredClone(value);
  delete normalized.setupSuccessor;
  normalized.release.onceOnlyBefore = original.release.onceOnlyBefore;
  normalized.releaseTrigger.onceOnlyBefore = original.releaseTrigger.onceOnlyBefore;
  assert.deepEqual(
    normalized,
    original,
    'Only setup metadata and the next one-shot edge may change',
  );
  assert.equal(value.release.onceOnlyBefore, edge);
  assert.equal(value.releaseTrigger.onceOnlyBefore, edge);
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert(
    !text.includes('workflow_dispatch') &&
      !text.includes('workflow_run:') &&
      !text.includes('filter:'),
  );
  assert.deepEqual(touchMatrix(value), touchMatrix(original));
  for (const job of TOUCH_JOBS) {
    const bound = bindTouchJob(value, job);
    assert.deepEqual(bound.rows, bindTouchJob(original, job).rows);
  }
  const next = value.setupSuccessor;
  assert.equal(next.format, 'SoloTouchDisplaySetupSuccessorV1');
  assert.equal(next.priorRun, 39015298647);
  assert.equal(next.priorToolingRevision, edge);
  assert.equal(next.priorToolingTree, '7fff7e134c67aa268e63cab5b08a7f3473bb5703');
  assert.deepEqual(next.priorDeclarations, declarations);
  assert.equal(next.priorConclusion, 'cancelled');
  assert.equal(next.nativeObservations, 0);
  assert.deepEqual(
    next.retainedJobs.map((r) => [
      r.job,
      r.mode,
      r.artifact,
      r.archive.bytes,
      r.archive.sha256,
      r.summary.bytes,
      r.summary.sha256,
    ]),
    [
      [
        117346062202,
        'chromium-dpad',
        12094696445,
        251883,
        '2c8d9ab1f5b8231b30df84f0540e62e97e38d9665600013fd39d28f104f26409',
        7099,
        'b62ed42ac33140471adf173633740667dccbd0532d33711a92c10b93c02d2ac7',
      ],
      [
        117346062334,
        'webkit-dpad',
        12095080292,
        251745,
        '5aea4b771609eba025d21c6dc1399844859bfede830beca90d8352cd9564fca7',
        7087,
        '06ca4005ff0f1e404976bb6a059e34060908af116c8907bc688410b2176bf7e0',
      ],
    ],
  );
  for (const r of next.retainedJobs) {
    assert.equal(r.conclusion, 'failure');
    assert.equal(r.candidateSetupStatus, 'passed');
    assert.equal(r.rowsNotRun, 3);
    assert.equal(r.setupOwnersClosed, true);
    assert.equal(r.failure, 'ENOENT /usr/bin/xdpyinfo before native row');
  }
  assert.deepEqual(next.cancelledBeforeStart, [
    { job: 117346062405, mode: 'chromium-swipe', status: 'cancelled', nativeObservations: 0 },
    { job: 117346062484, mode: 'chromium-stick', status: 'cancelled', nativeObservations: 0 },
  ]);
  assert.equal(next.package, 'x11-utils');
  assert.equal(next.packageVersion, 'observed-from-dpkg-query-not-fabricated');
  assert.equal(next.installTimeoutSeconds, 120);
  assert.equal(next.preflightBeforeCandidateDownload, true);
  for (const key of ['headlessFallback', 'changedNativeProtocol', 'changedLimits'])
    assert.equal(next[key], false);
  assert.equal(next.automaticRetries, 0);
  assert.deepEqual(
    [...text.matchAll(/timeout-minutes: (\d+)/g)].map((r) => r[1]),
    [...oldWorkflow.matchAll(/timeout-minutes: (\d+)/g)].map((r) => r[1]),
  );
  const steps = text.split(/\n      - /);
  const dependencies = steps.find((s) =>
    s.startsWith('name: Install the separately pinned browser cohort'),
  );
  assert.match(dependencies, /timeout-minutes: 10/);
  for (const line of [
    'timeout --signal=TERM --kill-after=10s 120s sudo env DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y x11-utils',
    "dpkg-query -W -f='${binary:Package} ${Version}\\n' x11-utils xvfb xauth",
    'for binary in /usr/bin/xvfb-run /usr/bin/Xvfb /usr/bin/xauth /usr/bin/xdpyinfo; do',
    'test -x "$binary"',
    'sha256sum /usr/bin/xvfb-run /usr/bin/Xvfb /usr/bin/xauth /usr/bin/xdpyinfo',
    'timeout 10s /usr/bin/xdpyinfo -version',
    '} 2>&1 | head -c 4194304 > "$RUNNER_TEMP/solo-linux-setup/display-dependencies.log"',
  ])
    assert(dependencies.includes(line), line);
  assert(
    text.indexOf('display-dependencies.log') <
      text.indexOf('4620s node scripts/run-solo-remote-correctness.mjs'),
  );
  assert.match(text, /max-parallel: 2/);
  assert.match(text, /cancel-in-progress: false/);
  assert(text.includes('bind-plan ' + planPath));
  assert(
    text.includes(
      'name: solo-linux-native-touch-v2-${{ matrix.job }}-${{ github.run_id }}-${{ github.run_attempt }}',
    ),
  );
  assert(
    text.includes(
      "['tools-npm.log','display-dependencies.log','browser-install.log','browser-dependencies.log','wrapper-tests.tap','browser-package-lock.json']",
    ),
  );
  assert(text.includes("'maximumTotalBytes':24*1024*1024"));
  const command = text.split('\n').find((line) => line.includes('node --test'));
  for (const path of [
    testPath,
    'scripts/test-solo-native-touch-release.mjs',
    'scripts/test-solo-remote-touch.mjs',
    'scripts/test-solo-source-verifier-smoke.mjs',
  ])
    assert(command.includes(path), path);
  const tools = steps.find((s) => s.includes('path: tools'));
  assert.match(tools, /sparse-checkout-cone-mode: false/);
  for (const path of [...value.frozenTools, ...value.adapterInputs, value.fixture]
    .map((r) => r.path)
    .concat(
      planPath,
      workflowPath,
      testPath,
      oldPlanPath,
      oldWorkflowPath,
      'game/build-config.json',
    ))
    assert(
      tools.split('\n').some((line) => line.trim() === '/' + path),
      path,
    );
  const sources = steps.filter(
    (s) => s.includes('uses: actions/checkout@') && !s.includes('path: tools'),
  );
  assert.equal(sources.length, 2);
  for (const s of sources) {
    assert(!s.includes('sparse-checkout'));
    assert.match(s, /timeout-minutes: 3/);
    assert(
      s.includes(
        'ref: ' +
          (s.includes('path: baseline') ? value.baseline.revision : value.candidate.revision),
      ),
    );
  }
}
test('touch display setup successor preserves exact failed declarations, twelve observations and every native bound', async () => {
  for (const [bytes, ref] of [
    [originalBytes, declarations[0]],
    [oldWorkflowBytes, declarations[1]],
  ]) {
    assert.equal(bytes.length, ref.bytes);
    assert.equal(hash(bytes), ref.sha256);
  }
  check(plan, workflow);
  for (const ref of [...plan.frozenTools, ...plan.adapterInputs, plan.fixture]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
  }
});
test('touch setup successor rejects package, preflight, historical evidence, edge, source and bound mutations', () => {
  for (const mutate of [
    (v) => v.candidate.artifact++,
    (v) => v.protocol.directionChanges--,
    (v) => v.setupSuccessor.nativeObservations++,
    (v) => v.setupSuccessor.installTimeoutSeconds++,
    (v) => (v.setupSuccessor.retainedJobs[0].archive.sha256 = '0'.repeat(64)),
    (v) => (v.setupSuccessor.priorDeclarations[0].sha256 = '0'.repeat(64)),
    (v) => (v.setupSuccessor.retainedJobs[0].summary.sha256 = '0'.repeat(64)),
    (v) => v.setupSuccessor.cancelledBeforeStart[0].nativeObservations++,
    (v) => (v.setupSuccessor.headlessFallback = true),
    (v) => (v.release.onceOnlyBefore = original.release.onceOnlyBefore),
    (v) => (v.frozenTools[0].sha256 = '0'.repeat(64)),
  ]) {
    const v = structuredClone(plan);
    mutate(v);
    assert.throws(() => check(v, workflow));
  }
  for (const change of [
    (s) => s.replace(guard, 'true'),
    (s) => s.replace('apt-get install --no-install-recommends -y x11-utils', 'true'),
    (s) => s.replace('120s sudo', '121s sudo'),
    (s) => s.replace('test -x "$binary"', 'true'),
    (s) => s.replace('dpkg-query -W', 'echo'),
    (s) => s.replace('timeout 10s /usr/bin/xdpyinfo -version', 'true'),
    (s) => s.replaceAll('scripts/test-solo-source-verifier-smoke.mjs', 'missing-smoke'),
    (s) => s.replace('timeout-minutes: 130', 'timeout-minutes: 131'),
    (s) => s.replace('path: candidate', 'path: candidate\n          sparse-checkout: game'),
  ])
    assert.throws(() => check(plan, change(workflow)));
});
