import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'acorn';
import { runInNewContext, createContext, runInContext } from 'node:vm';
import * as readiness from './solo-qualification-readiness.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import { verifyTimingHitchJournal } from './solo-remote-sustained.mjs';
import { createHash } from 'node:crypto';
import {
  bindReadinessJob,
  readinessMatrix,
  readinessArguments,
  readinessAssessment,
  validateReadinessPlan,
  SELECTED_FONT_DIRECT_COHORT,
  SELECTED_FONT_DIRECT_CORRECTION,
} from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root));
const manifestPath = 'docs/performance/solo-selected-font-direct-sheet-e1cc-plan.json';
const workflowPath = '.github/workflows/solo-remote-selected-font-direct-sheet-e1cc-temporary.yml';
const priorPath = 'docs/performance/solo-selected-font-settlement-e1cc-plan.json';
const manifest = JSON.parse(await read(manifestPath));
const prior = JSON.parse(await read(priorPath));
const plan = () => bindReadinessJob(manifest, 'webkit');
const sha = (b) => createHash('sha256').update(b).digest('hex');
test('direct-sheet successor changes only declared observer attribution and preserves old V4 source and workload', () => {
  const p = plan(),
    old = bindReadinessJob(prior, 'webkit');
  assert.equal(p.sourceCohort, SELECTED_FONT_DIRECT_COHORT);
  assert.deepEqual(p.release.observationCorrection, SELECTED_FONT_DIRECT_CORRECTION);
  assert.equal(p.release.onceOnlyBefore, '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0');
  for (const k of [
    'candidate',
    'runtimeRevision',
    'baseline',
    'cpu',
    'maxParallel',
    'automaticRetries',
    'performanceExclusion',
    'hitchJournal',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'rowEvidenceBytes',
    'evidenceBytes',
    'fixture',
    'protocol',
    'rows',
  ])
    assert.deepEqual(p[k], old[k], k);
  assert.deepEqual(readinessMatrix(manifest), readinessMatrix(prior));
  assert.equal(p.priorResults.run, 39066188215);
  assert.equal(p.priorResults.status, 'failed');
  assert.equal(p.priorResults.selectedThemeActivated, false);
  assert.equal(p.release.firstEightRequired, false);
  assert.deepEqual(manifest.dispatchSupersession, {
    toolingRevision: '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0',
    observedAt: '2026-10-17T21:40:58.671026+00:00',
    runCount: 0,
    pullRequestMergeable: 'CONFLICTING',
    receipt: {
      path: '.cache/solo-followup/integration-397-batch/no-dispatch-5e9/receipt.json',
      bytes: 621,
      sha256: '07ca45eba16843a6b3e37080d28fbb4d21ddcee2f30671120a2d1942fc902595',
    },
    scope:
      'No workflow/native observation existed for this head at the retained API readback. This edge replacement is not a native retry; fresh owners and original runtime/package/source gates remain required.',
  });
  assert.throws(() => bindReadinessJob(manifest, 'chromium'));
});
test('substituted correction, prior outcome, source, runtime, action identity and owner limits reject', () => {
  for (const mutate of [
    (p) => p.release.observationCorrection.priorRun++,
    (p) => p.release.observationCorrection.priorArtifact++,
    (p) => {
      p.release.observationCorrection.priorTooling = 'f'.repeat(40);
    },
    (p) => {
      p.release.observationCorrection.priorConclusion = 'success';
    },
    (p) => {
      p.release.observationCorrection.priorSelectedThemeActivated = true;
    },
    (p) => {
      p.release.observationCorrection.cssObservation = 'all-document-sheets';
    },
    (p) => p.release.observationCorrection.targetLinkCount++,
    (p) => {
      p.release.observationCorrection.originalDemandOnly = false;
    },
    (p) => {
      p.release.observationCorrection.runtimeChanged = true;
    },
    (p) => {
      p.release.observationCorrection.publicActionsChanged = true;
    },
    (p) => {
      p.release.observationCorrection.numericalGatesChanged = true;
    },
    (p) => {
      p.release.onceOnlyBefore = prior.release.onceOnlyBefore;
    },
    (p) => {
      p.release.onceOnlyBefore = '39774cce8697d412d138ef4da11ac547a5f8e535';
    },
    (p) => {
      p.sourceCohort = prior.sourceCohort;
    },
    (p) => {
      p.release.observationCorrection = prior.release.observationCorrection;
    },
    (p) => p.candidate.artifact++,
    (p) => {
      p.candidate.tree = '0'.repeat(40);
    },
    (p) => {
      p.runtimeRevision = '0'.repeat(40);
    },
    (p) => {
      p.fixture.sha256 = '0'.repeat(64);
    },
    (p) => p.rows.push(p.rows[0]),
    (p) => p.rows[0].timeoutMs++,
    (p) => p.helperTimeoutMs++,
    (p) => p.rowEvidenceBytes++,
    (p) => p.automaticRetries++,
    (p) => {
      p.performanceExclusion = false;
    },
  ]) {
    const p = structuredClone(plan());
    mutate(p);
    assert.throws(() => validateReadinessPlan(p));
  }
});
test('actual enriched dispatch arguments preserve one existing font demand protocol and native gates', () => {
  const p = plan();
  const row = {
    ...p.rows[0],
    status: 'failed',
    startedAt: new Date(0).toISOString(),
    storage: { minimumRemainingBytes: 1024 ** 3 },
  };
  const args = readinessArguments(
    { plan: p, here: '/tools/scripts', repository: '/tools' },
    row,
    'http://127.0.0.1:4321/game/?journey=opening',
    '/evidence',
  );
  for (const flag of [
    '--readiness-probe=selected-font-request-settlement-v4',
    '--readiness-cancel-boundary=post-command-v3',
    '--context=persistent',
    '--cpu=1',
    '--cadence=settled120',
    '--hitch-journal',
    '--work-probe',
  ])
    assert(args.includes(flag), flag);
  assert(!args.includes('--baseline-runtime'));
});
test('one-shot workflow and all current helper references are exact; historical source is separate', async () => {
  const w = (await read(workflowPath)).toString();
  const terms = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0'",
  ];
  const activated = (s) => {
    assert.equal(s.match(/^    if: (.+)$/m)?.[1], terms.join(' && '));
    assert(!s.includes('workflow_dispatch'));
  };
  activated(w);
  for (const term of terms) {
    assert(w.includes(term));
    assert.throws(() => activated(w.replace(term, 'true')));
  }
  assert.throws(() => activated(w.replace(terms.join(' && '), 'false')));
  assert.deepEqual(manifest.releaseTrigger, {
    status: 'activated-once-before-5e9',
    pullRequest: 1544,
    sameRepositoryRequired: true,
    action: 'synchronize',
    onceOnlyBefore: '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0',
  });
  for (const text of [
    'engine: [webkit]',
    'install --with-deps chromium webkit',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
    'bind-plan ' + manifestPath,
    'cancel-in-progress: false',
  ])
    assert(w.includes(text), text);
  const sparse = [...w.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(sparse.length, new Set(sparse).size);
  for (const ref of [...manifest.adapterInputs, ...manifest.frozenTools, manifest.fixture]) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(sha(b), ref.sha256, ref.path);
    assert(sparse.includes(ref.path));
  }
  for (const path of [
    manifestPath,
    workflowPath,
    priorPath,
    'scripts/test-solo-selected-font-direct-sheet-release.mjs',
    'scripts/test-solo-selected-font-settlement-release.mjs',
    'docs/performance/fixtures/solo-readiness-font/397-settlement-execution-source.json',
  ])
    assert(sparse.includes(path), path);
});

// Exercise the existing real serialized-observer and binary-journal controls
// under the new plan. The algorithms and adverse assertions are not mirrored.
test('successor preserves actual serialized assessment and journal failure boundaries', async () => {
  const source = (await read('scripts/test-solo-selected-font-settlement-release.mjs')).toString();
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const definitions = ast.body
    .filter(
      (n) =>
        n.type === 'FunctionDeclaration' &&
        ['declarations', 'actualModel', 'raw'].includes(n.id.name),
    )
    .map((n) => source.slice(n.start, n.end))
    .join('\n');
  const names = [
    'independent adapter reads actual serialized settlement evidence and preserves numeric or native failures',
    'exact V4 source and protocol reuse actual complete binary journal; tampering or missing observation policy fails',
  ];
  const context = {
    assert,
    read,
    parse,
    JSON,
    Buffer,
    TextEncoder,
    URL,
    structuredClone,
    runInNewContext,
    createContext,
    runInContext,
    readiness,
    plan,
    readinessAssessment,
    realpath,
    mkdtemp,
    rm,
    join,
    tmpdir,
    createHitchJournalStore,
    createBrowserHitchJournal,
    verifyTimingHitchJournal,
  };
  for (const name of names) {
    const call = ast.body.find(
      (n) =>
        n.type === 'ExpressionStatement' &&
        n.expression.type === 'CallExpression' &&
        n.expression.callee.name === 'test' &&
        n.expression.arguments[0]?.value === name,
    )?.expression;
    assert(call, name);
    const body = call.arguments[1];
    const cleanup = [];
    try {
      await new Function(
        ...Object.keys(context),
        definitions + '\nreturn (' + source.slice(body.start, body.end) + ');',
      )(...Object.values(context))({ after: (fn) => cleanup.push(fn) });
    } finally {
      for (const fn of cleanup) await fn();
    }
  }
});
