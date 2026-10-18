import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'acorn';
import {
  qualificationNextRouteOptions,
  NEXT_ROUTE_797E03_SOURCE,
  NEXT_ROUTE_IDENTITIES,
  NEXT_ROUTE_LIMITS,
} from './solo-qualification-next-route.mjs';
import {
  bindSustainedJob,
  sustainedMatrix,
  prepareSustainedMode,
  geometricNextAssessment,
  verifyTimingHitchJournal,
  GEOMETRIC_NEXT_797E03_SOURCE,
} from './solo-remote-sustained.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const source = '797e03f28743921842df6aa57520a72016ba3dfc';
// Modeled parser control only; actual797 first-eight evidence remains null in the held plans.
const modeledProof = {
  format: 'SoloFirstEightCorrectnessEvidenceV1',
  sourceRevision: source,
  runId: 1,
  artifactId: 2,
  artifactSHA256: 'a'.repeat(64),
  summarySHA256: 'b'.repeat(64),
  correctness: 'passed',
  ownersClosed: true,
};

const manifest = JSON.parse(await read('docs/performance/solo-next-geometric-797e03-plan.json'));
const prior = JSON.parse(
  await read('docs/performance/solo-next-geometric-de332-tooling-plan.json'),
);
const bytes = await read(manifest.recipes.next.path),
  recipe = JSON.parse(bytes);
const reviewed = () => {
  const p = structuredClone(manifest);
  p.status = 'reviewed-diagnostic-only';
  p.release.status = 'reviewed-diagnostic-only';
  p.release.firstEightAllCorrectnessPassed = true;
  p.release.firstEightEvidence = structuredClone(modeledProof);
  return p;
};
const flags = (revision) => [
  '--authored-next-route=authored-next-geometric-v1',
  '--work-probe',
  '--hitch-journal',
  '--cadence=settled120',
  '--source-revision=' + revision,
];
test('held797 Next requires new same-source first-eight proof and retains the exact six jobs', () => {
  assert.equal(NEXT_ROUTE_797E03_SOURCE, source);
  assert.equal(
    GEOMETRIC_NEXT_797E03_SOURCE.candidateTree,
    'bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5',
  );
  assert.equal(manifest.release.firstEightEvidence, null);
  assert.throws(() => sustainedMatrix(manifest));
  const statusOnly = structuredClone(manifest);
  statusOnly.release.status = 'reviewed-diagnostic-only';
  assert.throws(() => sustainedMatrix(statusOnly));
  assert.deepEqual(qualificationNextRouteOptions(flags(source), recipe, bytes), {
    protocol: 'authored-next-geometric-v1',
    sourceRevision: source,
  });
  assert.throws(() => qualificationNextRouteOptions(flags('f'.repeat(40)), recipe, bytes));
  const matrix = sustainedMatrix(reviewed());
  assert.equal(matrix.include.length, 6);
  for (const row of matrix.include) {
    const p = bindSustainedJob(reviewed(), row.engine, row.repetition);
    assert.equal(p.rows.length, 1);
    assert.equal(p.rows[0].source, 'candidate');
    assert.equal(p.rows[0].timeoutMs, 1440000);
    assert.equal(p.helperTimeoutMs, 6300000);
    assert.equal(row.jobMinutes, 152);
    assert.equal(row.stepMinutes, 108);
    assert.equal(row.outerSeconds, 6420);
  }
});
test('797 keeps60actions,11missions,10Next, exact replay and100ms input envelope', () => {
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
    assert.deepEqual(manifest[key], prior[key], key);
  assert.equal(bytes.length, 9086);
  assert.equal(sha(bytes), '0fd24c7db64be144da0d05b57ae26289b2a676a4f90df547d918c6cc13cef1a8');
  assert.equal(recipe.actions.length, 60);
  assert.equal(recipe.timeoutMs, 1200000);
  assert.equal(
    recipe.actions.filter((a) => a.type === 'click' && a.selector === '#next-button').length,
    10,
  );
  assert.deepEqual(
    recipe.actions.filter((a) => a.type === 'authored-next-route').map((a) => a.mission),
    NEXT_ROUTE_IDENTITIES.map((a) => a.id),
  );
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
  assert.deepEqual(manifest.priorQualificationReview, prior.priorQualificationReview);
});
test('package/source/proof/action/budget substitutions fail before another runtime can be admitted', () => {
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => (p.candidate.revision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
    (p) => (p.release.firstEightEvidence = null),
    (p) =>
      (p.release.firstEightEvidence.sourceRevision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
    (p) => (p.release.firstEightEvidence.correctness = 'failed'),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.release.firstEightEvidence.artifactId = 0),
    (p) => (p.release.firstEightRequired = false),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => (p.release.dispatch.lane = 'first-eight'),
    (p) => (p.release.dispatch.source = prior.candidate.revision),
    (p) => p.release.automaticRetries++,
    (p) => (p.release.noUnclosedOwners = false),
    (p) => (p.release.priorProofInspected = false),
    (p) => (p.release.allPriorPlannedJobsClosed = false),
    (p) => (p.recipes.next.sha256 = '0'.repeat(64)),
    (p) => p.evidenceBytes++,
  ]) {
    const p = reviewed();
    mutate(p);
    assert.throws(() => bindSustainedJob(p, 'webkit', 1));
  }
  for (const option of [
    '--cpu-profile',
    '--baseline-runtime',
    '--memory-profile',
    '--source-revision=' + source,
  ])
    assert.throws(() => qualificationNextRouteOptions([...flags(source), option], recipe, bytes));
  assert.throws(() =>
    qualificationNextRouteOptions(flags(source), recipe, Buffer.concat([bytes, Buffer.from(' ')])),
  );
});
test('actual797 transition and binary journal keep original adverse owner/replay/input controls', async (t) => {
  const text = (await read('scripts/test-solo-next-geometric-admission.mjs')).toString(),
    ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const sample = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'sample');
  assert(sample);
  const names = [
    'post-child route assessment retains numerical failures and rejects missing transitions, owners, replay and cleanup',
    'actual candidate journal sidecar is independently reread and changed bytes remain invalid',
  ];
  const callbacks = names.map((name) => {
    const call = ast.body.find(
      (n) =>
        n.type === 'ExpressionStatement' &&
        n.expression.callee?.name === 'test' &&
        n.expression.arguments[0]?.value === name,
    )?.expression;
    assert(call, name);
    return text.slice(call.arguments[1].start, call.arguments[1].end);
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
    manifest: reviewed(),
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
    text.slice(sample.start, sample.end) +
      ';const assess=(s)=>geometricNextAssessment(s.plan,s.row,s.raw,s.command,"test-version",s.journal);return [' +
      callbacks.join(',') +
      '];',
  );
  for (const callback of evaluate(...Object.values(context))) await callback(t);
});
test('current797 helper substitution rejects before package/native effects', async () => {
  let effects = 0;
  await assert.rejects(
    () =>
      prepareSustainedMode({
        plan: bindSustainedJob(reviewed(), 'webkit', 1),
        repository: new URL('../', import.meta.url).pathname.replace(/\/$/, ''),
        digest: async (p) => {
          const b = await readFile(p);
          return {
            bytes: b.length,
            sha256: p.endsWith('/solo-remote-sustained.mjs') ? '0'.repeat(64) : sha(b),
          };
        },
        ensureBaseline: async () => {
          effects++;
        },
        required: async () => {
          effects++;
        },
      }),
    /Changed input/,
  );
  assert.equal(effects, 0);
});
test('797 observer refs freeze current bytes while prior declarations remain unchanged', async () => {
  for (const ref of [
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
    ...Object.values(manifest.recipes),
  ]) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(sha(b), ref.sha256, ref.path);
  }
  const b = await read(manifest.priorDeclaration.path);
  assert.equal(b.length, manifest.priorDeclaration.bytes);
  assert.equal(sha(b), manifest.priorDeclaration.sha256);
});
