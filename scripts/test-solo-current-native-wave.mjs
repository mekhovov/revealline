import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { validateBaselineReuse } from './solo-remote-baseline.mjs';
import {
  bindSupplementalJob,
  supplementalArguments,
  validateSupplementalScenario,
} from './solo-remote-supplemental.mjs';

const root = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');
const json = async (path) => JSON.parse(await read(path));
const pathFor = (role) => `docs/performance/solo-remote-current-${role}-plan.json`;
const plans = Object.fromEntries(
  await Promise.all(
    ['correctness', 'retry', 'next'].map(async (role) => [role, await json(pathFor(role))]),
  ),
);
const candidate = 'adb1c0c7b7dd1a526a0693917f2012d1dbc08b22';
const guard =
  "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '" +
  candidate +
  "'";

test('the new native wave binds the actual successful intermediate package and exact normal main baseline', () => {
  for (const plan of Object.values(plans)) {
    assert.equal(plan.candidate.revision, candidate);
    assert.equal(plan.candidate.tree, 'fc162d7d3a7bc0d8e7212d230b4f2eb0d31ba508');
    assert.equal(plan.runtimeRevision, '488eae03aee7f58dd5837451363015888faa429f');
    assert.equal(plan.candidate.run, 39004951633);
    assert.equal(plan.candidate.artifact, 12090923917);
    assert.deepEqual(plan.candidate.outer, {
      bytes: 1091842485,
      sha256: 'f4d227caf2152d4de62a3e638e1ffda9e8373bac4d8fbf1b1300d15fb236e010',
    });
    assert.deepEqual(plan.candidate.inner, {
      bytes: 1073748678,
      sha256: '66eff1484b7e7e6e39f67aa70533e13be7b345fb68d270b857a5cacfb5ac642f',
    });
    assert.equal(
      plan.candidate.manifestSHA256,
      '9152f392cadc6caebea9237e041fd3041943bec73b21be2b26fb4d781cacc38a',
    );
    assert.deepEqual(plan.baseline, plans.correctness.baseline);
    validateBaselineReuse(plan.baseline.reusableArtifact, plan);
    assert.equal(plan.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
    assert.equal(plan.baseline.reusableArtifact.artifact, 12088541389);
    assert.equal(plan.packageBinding.metadataArtifact, 12091855599);
    assert.equal(plan.performanceExclusion, true);
    assert.equal(plan.currentSourceCorrectness.status, 'pending-not-run');
    assert.equal(plan.currentSourceCorrectness.receipt, null);
    assert.match(plan.sourceScope, /separate final-source package/);
    assert.equal(plan.releaseTrigger.onceOnlyBefore, candidate);
    assert.equal(plan.priorQualificationReview.unrelatedCI.run, 39004951600);
    assert.equal(plan.priorQualificationReview.unrelatedCI.status, 'in_progress');
    assert.match(plan.priorQualificationReview.scope, /concurrent members/);
  }
});

test('current correctness keeps the original eight rows, recipe and resource limits without diagnostic flags', async () => {
  const historical = await json('docs/performance/solo-remote-correctness-plan.json');
  for (const key of ['rows', 'fixture', 'helperTimeoutMs', 'evidenceBytes'])
    assert.deepEqual(plans.correctness[key], historical[key], key);
  for (const key of [
    'automaticRetries',
    'perCommandRSSBytes',
    'perCommandLogBytes',
    'perRowEvidenceBytes',
    'aggregateEvidenceBytes',
    'minimumInitialMemoryBytes',
    'minimumInitialDiskBytes',
    'minimumRemainingDiskBytes',
  ])
    assert.equal(plans.correctness.resources[key], historical.resources[key], key);
  assert.equal(plans.correctness.rows.length, 8);
  assert.equal(plans.correctness.currentSourceCorrectness.historicalPredecessor.failedRows, 1);
  assert(!plans.correctness.probe && !plans.correctness.hitchJournal);
});

test('the two new transition phases retain exactly eight inline native observations and all raw numerical failures', async () => {
  const inventory = [];
  for (const role of ['retry', 'next']) {
    const manifest = plans[role];
    assert.equal(manifest.sourceCohort, 'first-return-main8b-candidateadb');
    assert.equal(manifest.phase, `first-return-${role}`);
    assert.equal(manifest.release.firstEightAllCorrectnessPassed, false);
    assert.equal(manifest.release.diagnosticPredecessor.failedRows, 1);
    assert.equal(manifest.release.allPriorPlannedJobsClosed, true);
    assert.match(manifest.release.closureScope, /qualification/);
    assert.equal(manifest.automaticRetries, 0);
    assert.equal(manifest.automaticPhaseContinuation, false);
    assert.equal(manifest.maxParallel, 2);
    for (const engine of ['chromium', 'webkit']) {
      const plan = bindSupplementalJob(manifest, engine);
      const recipe = JSON.parse(await read(plan.phases[plan.phase].recipe.path));
      validateSupplementalScenario(plan, recipe);
      assert.equal(recipe.evidenceStorage, undefined);
      assert.equal(plan.phases[plan.phase].scenarioTimeoutMs, 240000);
      assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
      assert.deepEqual(
        plan.rows.map((row) => row.source),
        ['baseline', 'candidate'],
      );
      for (const row of plan.rows) {
        assert.equal(row.timeoutMs, 480000);
        const args = supplementalArguments(
          { here: '/tools', modeState: { recipePath: '/input/scenario.json' } },
          row,
          'http://localhost/game/',
          '/evidence',
        );
        assert(args.includes('--cpu=1') && args.includes('--work-probe'));
        assert(
          !args.some((arg) =>
            /^--(hitch-journal|journal-cost-probe|snapshot-chunks|cpu-profile)/.test(arg),
          ),
        );
        inventory.push(row.id);
      }
    }
  }
  assert.equal(new Set(inventory).size, 8);
});

test('new declarations freeze every actual adapter, tool, recipe and upload byte without rewriting old authority', async () => {
  for (const plan of Object.values(plans)) {
    const refs = [...plan.adapterInputs, ...(plan.frozenTools ?? [])];
    if (plan.fixture) refs.push(plan.fixture);
    for (const phase of Object.values(plan.phases ?? {}))
      refs.push(phase.recipe, ...(phase.upload ? [phase.upload] : []));
    for (const ref of refs) {
      const bytes = await readFile(new URL(ref.path, root));
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    }
  }
});

test('new workflows release only the declared same-repository PR edge with separate bounded owners', async () => {
  for (const role of ['correctness', 'transitions']) {
    const workflow = await read(`.github/workflows/solo-remote-current-${role}-temporary.yml`);
    assert.equal(workflow.match(/^    if: (.+)$/m)?.[1], guard);
    assert(!workflow.includes('workflow_dispatch'));
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, new RegExp(`group: solo-linux-current-${role}-`));
    assert.match(workflow, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
    assert.match(workflow, /SOLO_TOOLING_REVISION: \$\{\{ github.event.pull_request.head.sha \}\}/);
    assert(workflow.includes(`ref: ${candidate}`));
    assert.match(workflow, /ref: 8b01991942dc764b8aa4726851699ce1985e53ae/);
    assert(!workflow.includes('fetch-depth: 0'));
    assert(!/--(hitch-journal|journal-cost-probe|snapshot-chunks|cpu-profile)/.test(workflow));
    if (role === 'correctness') {
      assert.match(workflow, /timeout-minutes: 145/);
      assert.match(workflow, /timeout-minutes: 79/);
      assert.match(workflow, /78m node scripts\/run-solo-remote-correctness.mjs/);
    } else {
      assert.match(workflow, /max-parallel: 2/);
      assert.match(workflow, /fail-fast: false/);
    }
  }
});

test('the actual four-job declaration executes from only its sparse adapter and two selected manifests', async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'solo-current-wave-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  for (const path of ['scripts/solo-remote-supplemental.mjs', pathFor('retry'), pathFor('next')]) {
    const target = join(temporary, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await read(path), { flag: 'wx' });
  }
  const workflow = await read('.github/workflows/solo-remote-current-transitions-temporary.yml');
  const source = workflow
    .split('          node --input-type=module <<\'NODE\' >> "$GITHUB_OUTPUT"\n')[1]
    ?.split('          NODE')[0]
    ?.replace(/^          /gm, '');
  assert(source, 'Actual workflow declaration script is present');
  const result = execFileSync(process.execPath, ['--input-type=module', '-'], {
    cwd: temporary,
    input: source,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  const matrix = JSON.parse(result.trim().replace(/^matrix=/, ''));
  assert.deepEqual(
    matrix.include.map(({ phase, engine }) => [phase, engine]),
    [
      ['first-return-retry', 'chromium'],
      ['first-return-retry', 'webkit'],
      ['first-return-next', 'chromium'],
      ['first-return-next', 'webkit'],
    ],
  );
  for (const row of matrix.include) {
    assert.equal(row.jobMinutes, 130);
    assert.equal(row.stepMinutes, 78);
    assert.equal(row.outerSeconds, 4620);
  }
});
