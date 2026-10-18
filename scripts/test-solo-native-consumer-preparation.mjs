import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  bindReadinessJob,
  readinessMatrix,
  prepareReadinessMode,
} from './solo-remote-readiness.mjs';
import { bindTouchJob, touchMatrix, prepareTouchMode } from './solo-remote-touch.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const workflow = (await read(workflowPath)).toString();
const lanes = {
  readiness: {
    path: 'docs/performance/solo-readiness-preparation-rejoin-797e03-plan.json',
    status: 'reviewed-readiness-diagnostic-only',
    key: 'engine',
    values: ['chromium', 'webkit'],
    matrix: readinessMatrix,
    bind: bindReadinessJob,
    prepare: prepareReadinessMode,
  },
  touch: {
    path: 'docs/performance/solo-native-touch-797e03-plan.json',
    status: 'reviewed-input-diagnostic-only',
    key: 'job',
    values: ['chromium-dpad', 'webkit-dpad', 'chromium-stick', 'chromium-swipe'],
    matrix: touchMatrix,
    bind: bindTouchJob,
    prepare: prepareTouchMode,
  },
};
const actualFirstEight = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
).proof;
const manifest = async (lane) => {
  const value = JSON.parse(await read(lanes[lane].path));
  if (lane === 'readiness') {
    assert.equal(value.status, 'held-awaiting-source-and-dispatch-review');
    assert.throws(() => lanes[lane].matrix(value));
    // Source-only model: actual successor remains held until complete controls and review.
    value.status = lanes[lane].status;
  } else assert.equal(value.status, lanes[lane].status);
  assert.equal(value.currentSourceCorrectness.status, 'passed-correctness-only');
  assert.deepEqual(value.release.firstEightEvidence, actualFirstEight);
  assert.deepEqual(value.currentSourceCorrectness.receipt, actualFirstEight);
  assert.equal(value.release.firstEightAllCorrectnessPassed, true);
  const missing = structuredClone(value);
  missing.release.firstEightEvidence = null;
  assert.throws(() => lanes[lane].matrix(missing));
  assert.throws(() =>
    lanes[lane].matrix({
      ...structuredClone(value),
      status: 'held-awaiting-source-and-dispatch-review',
    }),
  );
  return value;
};
function job(text, lane) {
  const result = text.split(`\n  ${lane}:\n`)[1];
  assert(result, lane);
  return result.split(/\n  [a-z][a-z-]+:\n/)[0];
}
function checkJob(text, lane) {
  const body = job(text, lane),
    spec = lanes[lane];
  assert.equal(
    body.match(/^    if: (.+)$/m)?.[1],
    `github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == '${lane}'`,
  );
  assert(body.includes(`${spec.key}: [${spec.values.join(', ')}]`));
  assert.match(body, /^    timeout-minutes: 130$/m);
  assert.match(body, /^      max-parallel: 2$/m);
  assert.match(body, /^      fail-fast: false$/m);
  assert.match(body, /timeout-minutes: 78\n        working-directory: tools/);
  assert(
    body.includes(
      `4620s node scripts/run-solo-remote-correctness.mjs "$RUNNER_TEMP/${lane}-plan.json" "$OUTPUT"`,
    ),
  );
  assert(
    body.includes(
      `node scripts/solo-remote-${lane}.mjs bind-plan ${spec.path} "$RUNNER_TEMP/${lane}-plan.json" "${'${{ matrix.' + spec.key + ' }}'}"`,
    ),
  );
  const command = body.match(/^\s*node (--test .+?) 2>&1 \|/m)?.[1];
  assert(command, 'Actual source-control command is present');
  const argv = command.trim().split(/\s+/);
  assert.deepEqual(argv.slice(0, 2), ['--test', '--test-concurrency=2']);
  assert(argv.slice(2).every((arg) => /^scripts\/test-[a-z0-9-]+\.mjs$/.test(arg)));
  assert(body.includes('scripts/test-solo-native-consumer-preparation.mjs'));
  assert(
    body.includes(
      'scripts/test-solo-' +
        (lane === 'readiness' ? 'readiness' : 'touch') +
        '-797e03-admission.mjs',
    ),
  );
  assert.match(body, /SOLO_TOOLING_REVISION: \$\{\{ github.sha \}\}/);
  assert.match(body, /ref: \$\{\{ github.sha \}\}/);
  assert(
    body.includes(
      'solo-shared-source-checkout.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 797e03f28743921842df6aa57520a72016ba3dfc bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5',
    ),
  );
  assert(body.includes("node-version: '22.13.1'"));
  assert(body.includes('playwright@1.62.1'));
  assert(body.includes('install --with-deps chromium webkit'));
  assert.equal((body.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(body.includes('source-checkout.json'));
  assert(body.includes('retention-days: 14'));
  assert(
    !body.includes('inputs.source') &&
      !body.includes('inputs.artifact') &&
      !body.includes('inputs.timeout'),
  );
  return body;
}

test('readiness and touch are exact main-only choices with their unchanged adapter matrices and native bounds', async () => {
  assert.match(
    workflow,
    /options:\s*\[\s*first-eight,\s*next,\s*cocoa,\s*raster,\s*hud-cpu,\s*readiness,\s*touch,\s*app-overhead,\s*journal-cost,\s*timing,\s*lifecycle,\s*shared-return,\s*demo-recovery,\s*demo-resources,\s*replay-portability,\s*frame-trace,?\s*\]/,
  );
  assert.match(workflow, /cancel-in-progress: false/);
  for (const [lane, spec] of Object.entries(lanes)) {
    const body = checkJob(workflow, lane);
    const plan = await manifest(lane);
    assert.equal(plan.status, spec.status);
    assert.throws(() =>
      spec.matrix({ ...structuredClone(plan), status: 'held-awaiting-source-and-dispatch-review' }),
    );
    assert.deepEqual(
      spec.matrix(plan).include,
      spec.values.map((value) => ({
        [spec.key]: value,
        jobMinutes: 130,
        stepMinutes: 78,
        outerSeconds: 4620,
      })),
    );
    for (const clause of [
      "github.repository == 'mekhovov/revealline' && ",
      "github.event_name == 'workflow_dispatch' && ",
      "github.ref == 'refs/heads/main' && ",
      ` && inputs.lane == '${lane}'`,
    ]) {
      assert(body.includes(clause));
      assert.throws(() => checkJob(workflow.replace(body, body.replace(clause, '')), lane));
    }
    const sourceTest = `scripts/test-solo-${lane === 'readiness' ? 'readiness' : 'touch'}-797e03-admission.mjs`;
    assert.throws(() =>
      checkJob(
        workflow.replace(
          body,
          body.replace(
            `node --test --test-concurrency=2 ${sourceTest}`,
            `node --test ${sourceTest} --test-concurrency=2`,
          ),
        ),
        lane,
      ),
    );
    for (const [before, after] of [
      ['timeout-minutes: 130', 'timeout-minutes: 131'],
      ['timeout-minutes: 78', 'timeout-minutes: 79'],
      ['4620s node', '9999s node'],
      ['max-parallel: 2', 'max-parallel: 4'],
      ['install --with-deps chromium webkit', 'install --with-deps chromium'],
    ])
      assert.throws(() => checkJob(workflow.replace(body, body.replace(before, after)), lane));
  }
});

test('each new lane binds actual current tools and all declared reads in its own sparse checkout', async () => {
  for (const lane of Object.keys(lanes)) {
    const value = await manifest(lane);
    const refs = [
      ...value.adapterInputs,
      ...value.frozenTools,
      value.fixture,
      ...(value.additionalFixtures ?? []),
    ];
    assert.equal(new Set(refs.map((ref) => ref.path)).size, refs.length);
    const sparse = [...job(workflow, lane).matchAll(/^            \/(.+)$/gm)].map(
      (match) => match[1],
    );
    assert.equal(sparse.length, new Set(sparse).size);
    for (const path of [
      workflowPath,
      lanes[lane].path,
      'scripts/test-solo-native-consumer-preparation.mjs',
      ...refs.map((ref) => ref.path),
    ])
      assert(sparse.includes(path), `${lane}: ${path}`);
    for (const ref of refs) {
      const bytes = await read(ref.path);
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(sha(bytes), ref.sha256, ref.path);
    }
    assert.equal(value.candidate.revision, '797e03f28743921842df6aa57520a72016ba3dfc');
    assert.equal(value.candidate.run, 39104551453);
    assert.equal(value.candidate.artifact, 12128990483);
    assert.equal(value.performanceExclusion, true);
    assert.equal(value.automaticRetries, 0);
    assert.equal(value.release.physicalQualification, 'unobserved');
  }
});

test('actual preparation adapters reject changed current bytes before package admission or display effects', async () => {
  for (const [lane, spec] of Object.entries(lanes)) {
    const plan = spec.bind(await manifest(lane), spec.values[0]);
    let admittedReads = 0,
      effects = 0,
      checked = 0;
    const ctx = {
      plan,
      repository: process.cwd(),
      report: {},
      get admitted() {
        admittedReads++;
        throw Error('admission must remain unread');
      },
      digest: async (path) => {
        checked++;
        const bytes = await readFile(path);
        return { bytes: bytes.length, sha256: '0'.repeat(64) };
      },
      required: async () => {
        effects++;
      },
    };
    await assert.rejects(() => spec.prepare(ctx), { name: 'AssertionError' });
    assert(checked > 0);
    assert.equal(admittedReads, 0);
    assert.equal(effects, 0);
  }
});

test('every job executing shared preparation controls retains the complete cross-lane read set', async () => {
  const required = new Set([
    'scripts/solo-readiness-rejoin-declared-source.mjs',
    'docs/performance/fixtures/solo-readiness-797e03/9aaf-declared-tooling-source.json',
    workflowPath,
    'scripts/test-solo-native-consumer-preparation.mjs',
    'docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json',
  ]);
  for (const lane of Object.keys(lanes)) {
    const value = await manifest(lane);
    required.add(lanes[lane].path);
    for (const ref of [
      ...value.adapterInputs,
      ...value.frozenTools,
      value.fixture,
      ...(value.additionalFixtures ?? []),
    ])
      required.add(ref.path);
  }
  const check = (text, lane) => {
    const body = text.split('\n  ' + lane + ':\n')[1]?.split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
    assert(body, lane);
    const commands = [...body.matchAll(/^\s*node (--test [^\n]+)$/gm)];
    if (
      !commands.some((match) =>
        match[1].trim().split(/\s+/).includes('scripts/test-solo-native-consumer-preparation.mjs'),
      )
    )
      return false;
    const sparse = new Set([...body.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]));
    for (const path of required)
      assert(sparse.has(path), lane + ': missing shared preparation read ' + path);
    return true;
  };
  const jobsStart = workflow.indexOf('\njobs:\n');
  assert(jobsStart >= 0);
  const jobNames = [...workflow.slice(jobsStart).matchAll(/^  ([A-Za-z_][A-Za-z0-9_-]*):$/gm)].map(
    (match) => match[1],
  );
  const observed = [];
  for (const lane of jobNames) {
    if (!check(workflow, lane)) continue;
    observed.push(lane);
    const body = workflow
      .split('\n  ' + lane + ':\n')[1]
      .split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
    for (const path of required) {
      const entry = '            /' + path + '\n';
      assert.equal(body.split(entry).length, 2);
      assert.throws(
        () => check(workflow.replace(body, body.replace(entry, '')), lane),
        /missing shared preparation read/,
      );
    }
  }
  for (const lane of Object.keys(lanes)) assert(observed.includes(lane));
});
