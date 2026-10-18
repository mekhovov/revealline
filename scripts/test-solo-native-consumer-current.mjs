import {
  assertDeclaredReadinessTool,
  modelCurrentReadinessTools,
} from './solo-readiness-rejoin-declared-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DE332_EXECUTED_WITNESS,
  DE332_EXECUTED_WORKFLOW,
  executedDe332Source,
} from './solo-de332-executed-source.mjs';
import { bindSustainedJob, prepareSustainedMode } from './solo-remote-sustained.mjs';
import { bindRasterJob } from './solo-remote-raster.mjs';
import { bindCpuProfileJob } from './solo-remote-cpu-profile.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const json = async (path) => JSON.parse(await read(path));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const workflow = (await read(workflowPath)).toString();
const plans = {
  correctness: 'docs/performance/solo-remote-9d5139b-correctness-plan.json',
  sustained: 'docs/performance/solo-next-geometric-797e03-plan.json',
  raster: 'docs/performance/solo-remote-797e03-earned-raster-plan.json',
  'hud-cpu': 'docs/performance/solo-first-victory-cpu-797e03-plan.json',
};
const historicalToolingPlans = {
  correctness: 'docs/performance/solo-remote-de332-correctness-tooling-plan.json',
  sustained: 'docs/performance/solo-next-geometric-de332-tooling-plan.json',
};
const actualFirstEightProof = JSON.parse(
  await readFile(
    new URL(
      '../docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json',
      import.meta.url,
    ),
  ),
).proof;
function reviewedParserControl(value) {
  // Parser-only held-state control. The on-disk797 declaration carries no first-eight result.
  if (!value.status?.startsWith('held-')) return value;
  const plan = structuredClone(value);
  assert.equal(plan.candidate.revision, '797e03f28743921842df6aa57520a72016ba3dfc');
  assert.equal(plan.release.firstEightEvidence, null);
  plan.status = 'reviewed-diagnostic-only';
  if (plan.phase === 'next') plan.release.status = 'reviewed-diagnostic-only';
  plan.release.firstEightAllCorrectnessPassed = true;
  plan.release.firstEightEvidence = {
    format: 'SoloFirstEightCorrectnessEvidenceV1',
    sourceRevision: plan.candidate.revision,
    runId: 1,
    artifactId: 2,
    artifactSHA256: 'a'.repeat(64),
    summarySHA256: 'b'.repeat(64),
    correctness: 'passed',
    ownersClosed: true,
  };
  return plan;
}
const refs = (plan) => [
  ...(plan.adapterInputs ?? []),
  ...plan.frozenTools,
  ...Object.values(plan.recipes ?? {}),
  ...[plan.fixture, plan.recipe, plan.raster?.fixture].filter(Boolean),
];
function job(text, name) {
  const value = text.split(`\n  ${name}:\n`)[1];
  assert(value, name);
  return value.split(/\n  [a-z][a-z-]+:\n/)[0];
}
function sparse(text) {
  return [...text.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
}
async function current(ref, declarationPath = null) {
  if (declarationPath && (await assertDeclaredReadinessTool(declarationPath, ref))) return;
  const bytes = await read(ref.path);
  assert.equal(bytes.length, ref.bytes, ref.path);
  assert.equal(sha(bytes), ref.sha256, ref.path);
}

test('completed first-eight and Next declarations retain exact Git authority, including mutation refusals', async () => {
  const bytes = await read(DE332_EXECUTED_WITNESS);
  const oldWorkflow = await read(DE332_EXECUTED_WORKFLOW);
  for (const path of [
    'docs/performance/solo-remote-de332-correctness-plan.json',
    'docs/performance/solo-next-geometric-de332-plan.json',
  ]) {
    const manifest = await read(path);
    assert(executedDe332Source(bytes, path, manifest, oldWorkflow).size > 40);
    for (const [changedWitness, changedPath, changedPlan, changedWorkflow] of [
      [Buffer.concat([bytes, Buffer.from(' ')]), path, manifest, oldWorkflow],
      [bytes, plans.correctness, manifest, oldWorkflow],
      [bytes, path, Buffer.concat([manifest, Buffer.from(' ')]), oldWorkflow],
      [bytes, path, manifest, Buffer.concat([oldWorkflow, Buffer.from(' ')])],
      [
        Buffer.from(JSON.stringify({ ...JSON.parse(bytes), sources: [] })),
        path,
        manifest,
        oldWorkflow,
      ],
    ])
      assert.throws(() =>
        executedDe332Source(changedWitness, changedPath, changedPlan, changedWorkflow),
      );
  }
});

test('tooling successors retain exact packages, every scenario, limits and original raw-result declarations', async () => {
  for (const name of ['correctness', 'sustained']) {
    const plan = await json(historicalToolingPlans[name]);
    const old = await json(plan.toolingSuccessor.historicalDeclaration);
    assert.equal(plan.toolingSuccessor.format, 'SoloDe332CurrentToolingSuccessorV1');
    assert.equal(plan.toolingSuccessor.executedTooling, '68ad6a4730ae558cbfd14abf59800c8e462b1dc9');
    const strip = (value) => {
      const copy = structuredClone(value);
      for (const key of ['frozenTools', 'adapterInputs', 'toolingClosure', 'toolingSuccessor'])
        delete copy[key];
      return copy;
    };
    assert.deepEqual(strip(plan), strip(old));
    assert.equal(plan.candidate.revision, 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4');
    assert.equal(plan.candidate.run, 39091745654);
    assert.equal(plan.candidate.artifact, 12123463810);
  }
  assert.equal(
    bindSustainedJob(reviewedParserControl(await json(plans.sustained)), 'webkit', 3).rows[0]
      .timeoutMs,
    1440000,
  );
  assert.equal(bindRasterJob(await json(plans.raster), 'raster-webkit').raster.cases.length, 21);
  assert.equal(
    bindCpuProfileJob(reviewedParserControl(await json(plans['hud-cpu']))).rows[0].timeoutMs,
    480000,
  );
});

test('fixed declarations retain current or exact historical refs and their actual sparse reads', async () => {
  for (const [name, path] of Object.entries(plans)) {
    const plan = await json(path);
    const inputRefs = refs(plan);
    assert.equal(new Set(inputRefs.map((ref) => ref.path)).size, inputRefs.length);
    for (const ref of inputRefs) await current(ref, name === 'correctness' ? null : path);
    const selected = sparse(job(workflow, name));
    assert.equal(selected.length, new Set(selected).size);
    for (const input of [
      path,
      workflowPath,
      'scripts/test-solo-native-consumer-current.mjs',
      ...inputRefs.map((ref) => ref.path),
    ])
      assert(selected.includes(input), `${name}: ${input}`);
    const runner = inputRefs.find((ref) => ref.path === 'scripts/run-solo-remote-correctness.mjs');
    assert(runner);
    await assert.rejects(() => current({ ...runner, sha256: '0'.repeat(64) }));
    await assert.rejects(() => current({ ...runner, bytes: runner.bytes + 1 }));
  }
});

test('current Next admission still refuses changed tooling before package or native operations', async () => {
  // The modeled clone isolates the deliberately corrupt runner; the executed plan stays immutable.
  const current = await modelCurrentReadinessTools(plans.sustained, await json(plans.sustained));
  const plan = bindSustainedJob(reviewedParserControl(current), 'webkit', 1);
  let effects = 0;
  await assert.rejects(
    () =>
      prepareSustainedMode({
        plan,
        repository: process.cwd(),
        digest: async (path) => {
          const bytes = await readFile(path);
          return {
            bytes: bytes.length,
            sha256: path.endsWith('/scripts/run-solo-remote-correctness.mjs')
              ? '0'.repeat(64)
              : sha(bytes),
          };
        },
        ensureBaseline: async () => {
          effects++;
        },
        required: async () => {
          effects++;
        },
      }),
    /Changed input: scripts\/run-solo-remote-correctness/,
  );
  assert.equal(effects, 0);
});

test('current first-eight stays manual while historical Next retains its guard and explicit phase order', async () => {
  const historical = (await read(DE332_EXECUTED_WORKFLOW)).toString();
  function admission(text) {
    for (const name of ['declare']) {
      assert.equal(
        job(text, name).match(/^    if: (.+)$/m)?.[1],
        job(historical, name).match(/^    if: (.+)$/m)?.[1],
      );
    }
    assert.equal(
      job(text, 'correctness').match(/^    if: (.+)$/m)?.[1],
      "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'",
    );
    assert.match(job(text, 'correctness'), /^    timeout-minutes: 145$/m);
    assert.match(job(text, 'declare'), /^    timeout-minutes: 5$/m);
    assert.match(job(text, 'sustained'), /^    needs: declare$/m);
    assert(
      job(text, 'correctness').includes(
        `78m node scripts/run-solo-remote-correctness.mjs ${plans.correctness}`,
      ),
    );
    assert(job(text, 'declare').includes(`matrix-plan ${plans.sustained}`));
    assert(job(text, 'sustained').includes(`bind-plan ${plans.sustained}`));
  }
  admission(workflow);
  for (const name of ['correctness', 'declare']) {
    const guard = job(workflow, name).match(/^    if: (.+)$/m)[1];
    assert.throws(() => admission(workflow.replace(guard, 'true')));
    assert.throws(() =>
      admission(workflow.replace(guard, guard.replace("github.ref == 'refs/heads/main' && ", ''))),
    );
  }
  assert.throws(() => admission(workflow.replace('    needs: declare', '    needs: correctness')));
});

function manualAdmission(text, name, jobMinutes, stepMinutes) {
  const body = job(text, name);
  const guard = `github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && ${name === 'hud-cpu' ? "(inputs.lane == 'hud-cpu' || inputs.lane == 'frame-trace')" : "inputs.lane == '" + name + "'"}`;
  assert.equal(body.match(/^    if: (.+)$/m)?.[1], guard);
  assert.match(body, new RegExp(`^    timeout-minutes: ${jobMinutes}$`, 'm'));
  assert.match(
    body,
    new RegExp(`        timeout-minutes: ${stepMinutes}\\n        working-directory: tools`),
  );
  assert.match(body, /4620s node scripts\/run-solo-remote-correctness\.mjs/);
  assert.match(body, /SOLO_TOOLING_REVISION: \$\{\{ github.sha \}\}/);
  const candidate =
    '797e03f28743921842df6aa57520a72016ba3dfc bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5';
  assert(
    body.includes(
      'solo-shared-source-checkout.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 ' +
        candidate,
    ),
  );
  assert.equal((body.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(body.includes(`bind-plan ${plans[name]}`));
  assert(body.includes('playwright@1.62.1'));
  assert(body.includes("node-version: '22.13.1'"));
  assert(
    !body.includes('inputs.source') &&
      !body.includes('inputs.artifact') &&
      !body.includes('continue-on-error'),
  );
  return guard;
}
test('new fixed lanes require deliberate main dispatch and preserve native, retention and setup bounds', () => {
  assert.match(
    workflow,
    /options:\s*\[\s*first-eight,\s*next,\s*cocoa,\s*raster,\s*hud-cpu,\s*readiness,\s*touch,\s*app-overhead,\s*journal-cost,\s*timing,\s*lifecycle,\s*shared-return,\s*demo-recovery,\s*demo-resources,\s*replay-portability,\s*frame-trace,?\s*\]/,
  );
  assert.match(workflow, /cancel-in-progress: false/);
  for (const [name, jobMinutes, stepMinutes] of [
    ['raster', 125, 79],
    ['hud-cpu', 130, 78],
  ]) {
    const guard = manualAdmission(workflow, name, jobMinutes, stepMinutes);
    const evaluate = new Function('github', 'inputs', `return (${guard})`);
    const github = {
      repository: 'mekhovov/revealline',
      event_name: 'workflow_dispatch',
      ref: 'refs/heads/main',
    };
    assert.equal(evaluate(github, { lane: name }), true);
    for (const value of [
      { ...github, repository: 'fork/repo' },
      { ...github, event_name: 'pull_request' },
      { ...github, ref: 'refs/heads/other' },
    ])
      assert.equal(evaluate(value, { lane: name }), false);
    assert.equal(evaluate(github, { lane: 'all' }), false);
    for (const term of guard.split(' && '))
      assert.throws(() =>
        manualAdmission(
          workflow.replace(
            guard,
            guard
              .split(' && ')
              .filter((value) => value !== term)
              .join(' && '),
          ),
          name,
          jobMinutes,
          stepMinutes,
        ),
      );
    assert.throws(() =>
      manualAdmission(
        workflow.replace(
          job(workflow, name),
          job(workflow, name).replace(
            `    timeout-minutes: ${jobMinutes}\n`,
            `    timeout-minutes: ${jobMinutes + 1}\n`,
          ),
        ),
        name,
        jobMinutes,
        stepMinutes,
      ),
    );
  }
  assert.match(job(workflow, 'raster'), /job: \[raster-chromium, raster-webkit\]/);
  assert(job(workflow, 'hud-cpu').includes('scripts/test-solo-first-victory-cpu-de332.mjs'));
});

function wrapperCommand(text, name, newTest) {
  const command = job(text, name)
    .split('\n')
    .find((line) => line.trim().startsWith('node --test '));
  assert(command);
  const argv = command.trim().split(/\s+/);
  assert(argv.includes(newTest));
  const firstFile = argv.findIndex((arg) => arg.endsWith('.mjs'));
  assert(firstFile > 1);
  assert(!argv.slice(firstFile).some((arg) => arg.startsWith('--test')));
}
test('797 Next and HUD use exact setup commands and require actual same-source proof', async () => {
  for (const [name, file, binder] of [
    [
      'sustained',
      'scripts/test-solo-next-797e03-admission.mjs',
      (p) => bindSustainedJob(p, 'chromium', 1),
    ],
    ['hud-cpu', 'scripts/test-solo-first-victory-cpu-797e03.mjs', bindCpuProfileJob],
  ]) {
    wrapperCommand(workflow, name, file);
    const plan = await json(plans[name]);
    assert.deepEqual(plan.release.firstEightEvidence, actualFirstEightProof);
    assert.equal(binder(plan).candidate.revision, actualFirstEightProof.sourceRevision);
    const statusOnly = structuredClone(plan);
    statusOnly.release.firstEightEvidence = null;
    assert.throws(() => binder(statusOnly));
    const body = job(workflow, name),
      command = body.split('\n').find((line) => line.trim().startsWith('node --test '));
    assert.throws(() =>
      wrapperCommand(
        workflow.replace(
          command,
          command
            .replace('node --test --test-concurrency=2 ', 'node --test ')
            .replace(file, file + ' --test-concurrency=2'),
        ),
        name,
        file,
      ),
    );
    assert.throws(() =>
      wrapperCommand(
        workflow.replace(
          command,
          command.replace(file, 'scripts/test-solo-remote-correctness.mjs'),
        ),
        name,
        file,
      ),
    );
  }
});
