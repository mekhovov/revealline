import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'acorn';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import test from 'node:test';
import {
  qualificationNextRouteOptions,
  NEXT_ROUTE_DE332_SOURCE,
  NEXT_ROUTE_SOURCE,
  NEXT_ROUTE_FINAL_SOURCE,
  NEXT_ROUTE_39774_SOURCE,
  NEXT_ROUTE_LIMITS,
  NEXT_ROUTE_IDENTITIES,
} from './solo-qualification-next-route.mjs';
import {
  bindSustainedJob,
  sustainedMatrix,
  prepareSustainedMode,
  geometricNextAssessment,
  verifyTimingHitchJournal,
  GEOMETRIC_NEXT_DE332_SOURCE,
} from './solo-remote-sustained.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root));
const json = async (p) => JSON.parse(await read(p));
const planPath = 'docs/performance/solo-next-geometric-de332-plan.json';
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const plan = await json(planPath);
const prior = await json('docs/performance/solo-next-geometric-39774-plan.json');
const first = await json('docs/performance/solo-remote-de332-correctness-plan.json');
const workflow = (await read(workflowPath)).toString();
const bytes = await read(plan.recipes.next.path);
const recipe = JSON.parse(bytes);
const source = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
const guard =
  "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'next'";
const flags = (revision) => [
  '--authored-next-route=authored-next-geometric-v1',
  '--work-probe',
  '--hitch-journal',
  '--cadence=settled120',
  '--source-revision=' + revision,
];

test('only exact de332 joins the unchanged public geometric recipe source enum', () => {
  assert.equal(NEXT_ROUTE_DE332_SOURCE, source);
  assert.equal(GEOMETRIC_NEXT_DE332_SOURCE.candidate, source);
  assert.equal(
    GEOMETRIC_NEXT_DE332_SOURCE.candidateTree,
    '2954fef5b0f1293ff2e6a97ce978a673dddaa7db',
  );
  for (const revision of [
    source,
    NEXT_ROUTE_SOURCE,
    NEXT_ROUTE_FINAL_SOURCE,
    NEXT_ROUTE_39774_SOURCE,
  ])
    assert.deepEqual(qualificationNextRouteOptions(flags(revision), recipe, bytes), {
      protocol: 'authored-next-geometric-v1',
      sourceRevision: revision,
    });
  for (const revision of [
    'f'.repeat(40),
    '56e29fd264f77df191b75b3425cc6e7bb0ce9e13',
    source.toUpperCase(),
  ])
    assert.throws(() => qualificationNextRouteOptions(flags(revision), recipe, bytes));
  for (const option of [
    '--cpu-profile',
    '--baseline-runtime',
    '--memory-profile',
    '--readiness-probe=first-running-v1',
    '--source-revision=' + source,
  ])
    assert.throws(() => qualificationNextRouteOptions([...flags(source), option], recipe, bytes));
  const changed = Buffer.from(bytes);
  changed[changed.length - 2] ^= 1;
  assert.throws(() => qualificationNextRouteOptions(flags(source), recipe, changed));
});

test('actual binder admits six exact-package candidate rows and rejects mixed source, package, authority and bounds', () => {
  assert.deepEqual(plan.candidate, first.candidate);
  assert.deepEqual(plan.packageBinding, first.packageBinding);
  const matrix = sustainedMatrix(plan);
  assert.equal(matrix.include.length, 6);
  for (const { engine, repetition, jobMinutes, stepMinutes, outerSeconds } of matrix.include) {
    const bound = bindSustainedJob(plan, engine, repetition);
    assert.equal(bound.rows.length, 1);
    assert.equal(bound.rows[0].source, 'candidate');
    assert.equal(bound.rows[0].timeoutMs, 1440000);
    assert.equal(bound.helperTimeoutMs, 6300000);
    assert.equal(jobMinutes, 152);
    assert.equal(stepMinutes, 108);
    assert.equal(outerSeconds, 6420);
  }
  for (const mutate of [
    ...['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'].map(
      (k) => (p) => {
        p.candidate[k] = prior.candidate[k];
      },
    ),
    (p) => {
      p.release.dispatch.source = prior.candidate.revision;
    },
    (p) => {
      p.release.dispatch.lane = 'first-eight';
    },
    (p) => {
      p.release.dispatch.workflow = '.github/workflows/arbitrary.yml';
    },
    (p) => {
      p.release.dispatch.reviewOrder = 'automatic';
    },
    (p) => {
      p.release.onceOnlyBefore = source;
    },
    (p) => {
      p.release.noUnclosedOwners = false;
    },
    (p) => {
      p.release.priorProofInspected = false;
    },
    (p) => {
      p.release.allPriorPlannedJobsClosed = false;
    },
    (p) => {
      p.release.automaticRetries = 1;
    },
    (p) => {
      p.release.firstEightAllCorrectnessPassed = true;
    },
    (p) => {
      p.release.firstEightRequired = true;
    },
    (p) => {
      p.evidenceBytes++;
    },
    (p) => {
      p.recipes.next.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.nativeRouteProtocol = 'arbitrary';
    },
  ]) {
    const p = structuredClone(plan);
    mutate(p);
    assert.throws(() => bindSustainedJob(p, 'webkit', 1));
  }
});

test('all historical Next source branches preserve their original six candidate jobs', async () => {
  for (const p of [
    'docs/performance/solo-next-geometric-c696-plan.json',
    'docs/performance/solo-next-geometric-e1cc-plan.json',
    'docs/performance/solo-next-geometric-39774-plan.json',
  ]) {
    const historical = await json(p);
    for (const engine of ['chromium', 'webkit'])
      for (const repetition of [1, 2, 3]) {
        const b = bindSustainedJob(historical, engine, repetition);
        assert.equal(b.rows.length, 1);
        assert.equal(b.rows[0].source, 'candidate');
        assert.equal(b.rows[0].timeoutMs, 1440000);
        assert.equal(b.helperTimeoutMs, 6300000);
      }
  }
});

test('eleven missions, ten Next, all sixty actions, native replay,100ms envelope and existing limits stay exact', () => {
  for (const key of [
    'jobs',
    'recipes',
    'resources',
    'deadlines',
    'baseline',
    'ordering',
    'evidenceBytes',
    'rowEvidenceBytes',
    'setupTimeoutMs',
    'calibrationTimeoutMs',
    'calibrationPreset',
    'candidateOnly',
    'nativeRouteProtocol',
    'performanceExclusion',
    'hitchJournal',
  ])
    assert.deepEqual(plan[key], prior[key], key);
  assert.equal(bytes.length, 9086);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '0fd24c7db64be144da0d05b57ae26289b2a676a4f90df547d918c6cc13cef1a8',
  );
  assert.equal(recipe.actions.length, 60);
  assert.equal(recipe.timeoutMs, 1200000);
  assert.equal(NEXT_ROUTE_IDENTITIES.length, 11);
  assert.deepEqual(NEXT_ROUTE_LIMITS, {
    missionMs: 60000,
    stageMs: 15000,
    pollMs: 50,
    operationMs: 100,
    reads: 1201,
    events: 128,
    stages: 32,
    evidenceBytes: 65536,
  });
  assert.equal(plan.release.firstEightRequired, false);
  assert.equal(plan.currentSourceCorrectness.status, 'not-yet-observed');
  assert.equal(plan.release.automaticPhaseContinuation, false);
});

function workflowAdmission(text) {
  const declare = text.split('  declare:\n')[1].split('  sustained:\n')[0];
  assert.equal(declare.match(/^    if: (.+)$/m)?.[1], guard);
  assert(declare.includes('matrix-plan ' + planPath));
  assert.match(text, /  sustained:\n    needs: declare\n/);
  assert(text.includes('bind-plan ' + planPath));
  assert(text.includes('max-parallel: 6'));
  assert(
    text.includes(
      'timeout --signal=TERM --kill-after=30s ${{ matrix.outerSeconds }}s node scripts/run-solo-remote-correctness.mjs',
    ),
  );
  assert.equal(
    (text.split('  sustained:\n')[1].match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length,
    2,
  );
}
test('Next is explicit main-branch manual selection only, never a PR event or automatic phase', () => {
  workflowAdmission(workflow);
  const evaluate = new Function('github', 'inputs', `return (${guard})`);
  const g = {
    repository: 'mekhovov/revealline',
    event_name: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assert.equal(evaluate(g, { lane: 'next' }), true);
  for (const mutate of [
    (x) => {
      x.repository = 'fork/revealline';
    },
    (x) => {
      x.event_name = 'pull_request';
    },
    (x) => {
      x.event_name = 'workflow_run';
    },
    (x) => {
      x.ref = 'refs/heads/arbitrary';
    },
  ]) {
    const x = structuredClone(g);
    mutate(x);
    assert.equal(evaluate(x, { lane: 'next' }), false);
  }
  for (const lane of ['first-eight', 'all', undefined]) assert.equal(evaluate(g, { lane }), false);
  for (const term of guard.split(' && '))
    assert.throws(() =>
      workflowAdmission(
        workflow.replace(
          guard,
          guard
            .split(' && ')
            .filter((x) => x !== term)
            .join(' && '),
        ),
      ),
    );
  assert.throws(() =>
    workflowAdmission(workflow.replace('    needs: declare', '    needs: correctness')),
  );
});

test('current helper digest mismatch rejects before any package or native operation', async () => {
  const target = 'scripts/run-solo-remote-correctness.mjs';
  let sideEffects = 0;
  await assert.rejects(
    prepareSustainedMode({
      plan: bindSustainedJob(plan, 'webkit', 1),
      repository: process.cwd(),
      digest: async (path) => {
        const b = await readFile(path);
        return {
          bytes: b.length,
          sha256: path.endsWith('/' + target)
            ? '0'.repeat(64)
            : createHash('sha256').update(b).digest('hex'),
        };
      },
      ensureBaseline: async () => {
        sideEffects++;
        throw Error('must not run');
      },
      required: async () => {
        sideEffects++;
        throw Error('must not run');
      },
    }),
    /Changed input: scripts\/run-solo-remote-correctness/,
  );
  assert.equal(sideEffects, 0);
});

test('prospective current references and both sparse checkout closures contain every declared dependency', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, ...Object.values(plan.recipes)];
  assert.deepEqual(
    plan.adapterInputs.map((x) => x.path),
    ['scripts/solo-remote-sustained.mjs'],
  );
  assert.equal(refs.length, new Set(refs.map((x) => x.path)).size);
  for (const ref of refs) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, ref.path);
  }
  const lists = [
    ...workflow
      .split('  declare:\n')[1]
      .matchAll(/          sparse-checkout: \|\n((?:            .+\n)+)/g),
  ].map((m) =>
    m[1]
      .trim()
      .split('\n')
      .map((x) => x.trim().slice(1)),
  );
  assert.equal(lists.length, 2);
  for (const sparse of lists) {
    assert.equal(sparse.length, new Set(sparse).size);
    for (const p of [
      workflowPath,
      planPath,
      'scripts/test-solo-next-de332-admission.mjs',
      ...refs.map((x) => x.path),
    ])
      assert(sparse.includes(p), p);
  }
  assert.equal(plan.toolingClosureStatus, 'current-source-confined-controls-required');
});

// Reuse actual existing test fixtures and adverse assertions under the new source.
// The final-source call uses the actual admitted declaration; all adverse assertions remain unchanged.
test('de332 exercises actual transition assessment and binary-journal positives and adverse controls', async (t) => {
  const source = (await read('scripts/test-solo-next-geometric-admission.mjs')).toString();
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const sample = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'sample',
  );
  assert(sample);
  const callbacks = [
    'post-child route assessment retains numerical failures and rejects missing transitions, owners, replay and cleanup',
    'actual candidate journal sidecar is independently reread and changed bytes remain invalid',
  ].map((name) => {
    const call = ast.body.find(
      (node) =>
        node.type === 'ExpressionStatement' &&
        node.expression.type === 'CallExpression' &&
        node.expression.callee.name === 'test' &&
        node.expression.arguments[0]?.value === name,
    )?.expression;
    assert(call, name);
    return source.slice(call.arguments[1].start, call.arguments[1].end);
  });
  const context = {
    assert,
    bindSustainedJob,
    prepareSustainedMode,
    geometricNextAssessment,
    verifyTimingHitchJournal,
    createBrowserHitchJournal,
    createHitchJournalStore,
    NEXT_ROUTE_IDENTITIES,
    manifest: plan,
    fixture: recipe,
    readFile,
    writeFile,
    mkdtemp,
    realpath,
    rm,
    join,
    tmpdir,
    URL,
    Buffer,
  };
  const evaluate = new Function(
    ...Object.keys(context),
    source.slice(sample.start, sample.end) +
      ';const assess = (s) => geometricNextAssessment(s.plan,s.row,s.raw,s.command,"test-version",s.journal);return [' +
      callbacks.join(',') +
      '];',
  );
  for (const run of evaluate(...Object.values(context))) await run(t);
});
