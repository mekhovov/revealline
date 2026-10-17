import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateQualification } from './solo-qualification.mjs';
import {
  bindReadinessJob,
  readinessMatrix,
  readinessArguments,
  validateReadinessPlan,
  OPTIONAL_AUDIO_SETTINGS_FIXTURE,
  OPTIONAL_AUDIO_ROUTE_CORRECTION,
} from './solo-remote-readiness.mjs';
import {
  MEDIA_FAULT_PILOTS,
  OPTIONAL_AUDIO_SETTINGS_PILOT,
  qualificationReadinessOptions,
  optionalStartAudio,
} from './solo-qualification-readiness.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const oldPath = 'docs/performance/solo-optional-start-audio-e1cc-v2-plan.json';
const path = 'docs/performance/solo-optional-start-audio-e1cc-v3-plan.json';
const workflowPath = '.github/workflows/solo-remote-optional-start-audio-e1cc-v3-temporary.yml';
const old = JSON.parse(await read(oldPath)),
  manifest = JSON.parse(await read(path));
const raw = await read(manifest.fixture.path),
  fixture = JSON.parse(raw),
  oldRaw = await read(old.fixture.path),
  oldFixture = JSON.parse(oldRaw);
const workflow = (await read(workflowPath)).toString();
const protocol = 'optional-audio-start-missing-v1',
  before = '92ff7ef800e542617b4fc3efad96bd07ce6cbecb';
const historicalBytes = await read(
  'docs/performance/fixtures/solo-optional-start-audio/34d95-execution-source.json',
);
assert.equal(
  hash(historicalBytes),
  '506bdb703b1ce3f9ff0198aa60d2cd6852c429b3972d40e81b765b195ec65e11',
);
const historical = JSON.parse(historicalBytes);
assert.equal(historical.revision, '34d95cb9fe471ca56c243f05c4330826ba822fb9');
const historicalPaths = new Set([
  'scripts/solo-remote-readiness.mjs',
  'scripts/solo-qualification-readiness.mjs',
]);
for (const p of [path, workflowPath]) {
  const b = await read(p),
    r = historical.records.find((r) => r.path === p);
  assert.equal(b.length, r.bytes);
  assert.equal(hash(b), r.sha256);
}

const flags = [
  '--readiness-probe=' + protocol,
  '--source-revision=' + manifest.candidate.revision,
  '--work-probe',
  '--hitch-journal',
  '--cadence=settled120',
  '--server-fixture-access',
];

// Exact prior execution source, never a substitute for current prospective inputs.
const priorToolBytes = await readFile(
  new URL(
    'docs/performance/fixtures/solo-native-816/legacy-tool-supplement.json',
    process.env.SOLO_EXECUTED_816_PROPOSAL || new URL('../', import.meta.url),
  ),
);
function priorToolBindings(bytes, declarationBytes, workflowBytes) {
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    'ed447c4cf0031ab5767539a617344a9a1eb402c54d5959adfe07a2f2744dc067',
  );
  const supplement = JSON.parse(bytes);
  assert.equal(supplement.format, 'SoloPriorExecutedToolSupplementV1');
  assert.equal(supplement.postHocExactGitReadback, true);
  const execution = supplement.executions.find(
    (v) => v.revision === '34d95cb9fe471ca56c243f05c4330826ba822fb9',
  );
  assert(execution);
  assert.equal(execution.tree, 'de4ea7b4c23988eeee54f5d082dd3d9fa65eddbb');
  assert.equal(execution.records.length, 56);
  assert.equal(new Set(execution.records.map((r) => r.path)).size, execution.records.length);
  for (const ref of execution.records) assert.match(ref.blob, /^[a-f0-9]{40}$/);
  for (const [p, b] of [
    [path, declarationBytes],
    [workflowPath, workflowBytes],
  ]) {
    const ref = execution.records.find((r) => r.path === p);
    assert(ref, p);
    assert.equal(b.length, ref.bytes, p);
    assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, p);
  }
  return execution;
}
const priorTools = priorToolBindings(priorToolBytes, await read(path), await read(workflowPath));
function priorToolRef(ref) {
  const exact = priorTools.records.find((r) => r.path === ref.path);
  assert(exact, ref.path);
  assert.equal(exact.bytes, ref.bytes, ref.path);
  assert.equal(exact.sha256, ref.sha256, ref.path);
}
test('prior tool supplement rejects changed original source, declaration, workflow and reference', () => {
  assert.throws(() => priorToolBindings(Buffer.from('{}'), Buffer.from('{}'), Buffer.from('{}')));
  assert.throws(() => priorToolBindings(priorToolBytes, Buffer.from('{}'), Buffer.from(workflow)));
  assert.throws(() =>
    priorToolBindings(priorToolBytes, Buffer.from(JSON.stringify(manifest)), Buffer.from('{}')),
  );
  const ref = manifest.frozenTools.find(
    (r) => r.path === 'scripts/run-solo-remote-correctness.mjs',
  );
  priorToolRef(ref);
  assert.throws(() => priorToolRef({ ...ref, sha256: '0'.repeat(64) }));
});
test('only exact Settings route/source/bytes replace the hidden Home summary; all later audio/replay actions stay exact', () => {
  assert.equal(qualificationReadinessOptions(flags, fixture, raw), OPTIONAL_AUDIO_SETTINGS_PILOT);
  assert.equal(
    qualificationReadinessOptions(flags, oldFixture, oldRaw),
    MEDIA_FAULT_PILOTS[protocol],
  );
  assert.deepEqual(fixture.actions.slice(6), oldFixture.actions.slice(3));
  for (const key of [
    'timeoutMs',
    'kind',
    'query',
    'expectAudio',
    'replayRequirements',
    'expectedReplayDefinition',
  ])
    assert.deepEqual(fixture[key], oldFixture[key], key);
  assert.deepEqual(fixture.actions.slice(0, 6), [
    { type: 'click', selector: '#shell-options' },
    { type: 'click', selector: '#settings-tab-gameplay' },
    oldFixture.actions[1],
    { type: 'click', selector: '#settings-dialog .dialog-close' },
    { type: 'click', selector: '#settings-dialog[open] .dialog-close', optional: true },
    { type: 'expect', selector: 'body:not(:has(#settings-dialog[open]))', timeoutMs: 10000 },
  ]);
  assert.equal(optionalStartAudio.bytes, 28844);
  assert.equal(
    optionalStartAudio.sha256,
    '4f9093b56201eca492f784986446c247fbde5dcd6f67e364e145984e03c80135',
  );
  for (const change of [
    (q) => delete q.mediaReadinessFault.route,
    (q) => (q.mediaReadinessFault.route = 'other'),
    (q) => (q.mediaReadinessFault.sourceRevision = 'a'.repeat(40)),
    (q) => q.timeoutMs++,
    (q) => q.actions.splice(4, 1),
    (q) => (q.expectAudio.nativeStartsAtLeast = 0),
  ]) {
    const q = structuredClone(fixture);
    change(q);
    assert.throws(() => qualificationReadinessOptions(flags, q, Buffer.from(JSON.stringify(q))));
  }
  assert.throws(() => qualificationReadinessOptions(flags, oldFixture, raw));
  assert.throws(() => qualificationReadinessOptions(flags, fixture, oldRaw));
  assert.throws(() =>
    qualificationReadinessOptions(
      flags.map((f) => (f.startsWith('--source-revision') ? '--source-revision=' + before : f)),
      fixture,
      raw,
    ),
  );
});

test('typed route correction preserves package, setup correction, one candidate row and every bound', () => {
  const p = bindReadinessJob(manifest, 'chromium'),
    prior = bindReadinessJob(old, 'chromium');
  assert.deepEqual(readinessMatrix(manifest), readinessMatrix(old));
  for (const key of Object.keys(prior).filter(
    (k) =>
      ![
        'fixture',
        'adapterInputs',
        'frozenTools',
        'release',
        'releaseTrigger',
        'priorResults',
      ].includes(k),
  ))
    assert.deepEqual(p[key], prior[key], key);
  assert.deepEqual(p.release.setupCorrection, prior.release.setupCorrection);
  assert.deepEqual(p.release.routeCorrection, OPTIONAL_AUDIO_ROUTE_CORRECTION);
  assert.deepEqual(p.fixture, OPTIONAL_AUDIO_SETTINGS_FIXTURE);
  const args = readinessArguments(
    { plan: p, repository: '/tools', here: '/tools/scripts' },
    p.rows[0],
    'http://127.0.0.1:1234/game/',
    '/evidence',
  );
  const priorArgs = readinessArguments(
    { plan: prior, repository: '/tools', here: '/tools/scripts' },
    prior.rows[0],
    'http://127.0.0.1:1234/game/',
    '/evidence',
  );
  assert.deepEqual(
    args,
    priorArgs.map((v) =>
      v === '/tools/' + old.fixture.path ? '/tools/' + manifest.fixture.path : v,
    ),
  );
  for (const change of [
    (q) => delete q.release.routeCorrection,
    (q) => delete q.release.setupCorrection,
    (q) => q.release.routeCorrection.priorRun++,
    (q) => q.release.routeCorrection.priorJob++,
    (q) => q.release.routeCorrection.priorClaimedAudioRequests++,
    (q) => (q.release.routeCorrection.scenarioChanged = false),
    (q) => (q.release.routeCorrection.runtimeChanged = true),
    (q) => (q.release.routeCorrection.originalDeclaration.sha256 = '0'.repeat(64)),
    (q) => (q.release.onceOnlyBefore = prior.release.onceOnlyBefore),
    (q) => (q.fixture = prior.fixture),
    (q) => q.candidate.artifact++,
    (q) => q.rows.push(q.rows[0]),
    (q) => q.protocol.observationTimeoutMs++,
  ]) {
    const q = structuredClone(p);
    change(q);
    assert.throws(() => validateReadinessPlan(q));
  }
  const mixed = structuredClone(prior);
  mixed.release.routeCorrection = p.release.routeCorrection;
  assert.throws(() => validateReadinessPlan(mixed));
});

test('exact before92ff one-shot guard, both installed engines, all current refs and sparse inputs bind the successor', async () => {
  const terms = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    `github.event.before == '${before}'`,
  ];
  const check = (text) => assert(text.includes('    if: ' + terms.join(' && ') + '\n'));
  check(workflow);
  for (const term of terms) assert.throws(() => check(workflow.replace(term, 'true')));
  assert.equal(manifest.releaseTrigger.onceOnlyBefore, before);
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  for (const term of [
    'engine: [chromium]',
    'install --with-deps chromium webkit',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
    'bind-plan ' + path,
    'cancel-in-progress: false',
  ])
    assert(workflow.includes(term), term);
  for (const term of ['workflow_dispatch', 'workflow_run', 'continue-on-error'])
    assert(!workflow.includes(term));
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(sparse.length, new Set(sparse).size);
  for (const ref of [...manifest.adapterInputs, ...manifest.frozenTools, manifest.fixture]) {
    priorToolRef(ref);
    if (historicalPaths.has(ref.path)) {
      const r = historical.records.find((r) => r.path === ref.path);
      assert.deepEqual({ path: r.path, bytes: r.bytes, sha256: r.sha256 }, ref);
    }
    assert(sparse.includes(ref.path));
  }
  for (const p of [
    path,
    workflowPath,
    oldPath,
    'scripts/test-solo-optional-audio-settings-successor.mjs',
    'docs/performance/fixtures/solo-optional-start-audio/92ff-execution-source.json',
  ])
    assert(sparse.includes(p), p);
  const b = await read(oldPath);
  assert.deepEqual(manifest.release.routeCorrection.originalDeclaration, {
    path: oldPath,
    bytes: b.length,
    sha256: hash(b),
  });
  assert.equal(manifest.priorResults.routeFailure.nativeAudioObservations, 0);
  const witness = JSON.parse(
    await read('docs/performance/fixtures/solo-optional-start-audio/92ff-execution-source.json'),
  );
  assert.equal(witness.revision, before);
  assert.equal(witness.run, 39054542054);
  for (const p of [
    oldPath,
    '.github/workflows/solo-remote-optional-start-audio-e1cc-v2-temporary.yml',
  ]) {
    const b = await read(p),
      r = witness.records.find((r) => r.path === p);
    assert.equal(b.length, r.bytes);
    assert.equal(hash(b), r.sha256);
  }
});

test('one-module actual command binds only the declared successor without workspace imports', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-audio-settings-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'adapter.mjs'), await read('scripts/solo-remote-readiness.mjs'));
  await writeFile(join(dir, 'plan.json'), await read(path));
  const r = spawnSync(
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
  assert.equal(r.status, 0, r.stderr);
  const bound = JSON.parse(await readFile(join(dir, 'bound.json')));
  assert.deepEqual(bound.fixture, manifest.fixture);
  assert.deepEqual(bound.release.routeCorrection, manifest.release.routeCorrection);
  assert.equal(bound.rows.length, 1);
});
