import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  access,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  BASELINE_FILES,
  BASELINE_PROOF,
  publishBaseline,
  readBaselineBundle,
  validateBaselineReady,
  validateBaselineReuse,
} from './solo-remote-baseline.mjs';

const BASE = 'b11745223861c3973ad4bf440cc536198b8e0371';
const TREE = '09f68c3691a4ae1013c3073f0ccf301b3355903f';
const CURRENT_BASE = '8b01991942dc764b8aa4726851699ce1985e53ae';
const CURRENT_TREE = '9373b6a74aea8fa1ef47aa17ace140b4cf714609';
const CURRENT_WORKFLOW = '.github/workflows/solo-remote-baseline-temporary.yml';
const id = (data) => ({
  bytes: Buffer.byteLength(data),
  sha256: createHash('sha256').update(data).digest('hex'),
});
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const archiveHelper = fileURLToPath(new URL('./solo-remote-archive.py', import.meta.url));
async function fixture(t, revision = BASE, tree = TREE) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'solo-baseline-unit-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const buildPath = join(root, 'build'),
    evidence = join(root, 'evidence'),
    payloadPath = join(root, 'payload'),
    sourcePath = join(root, 'source');
  for (const path of [buildPath, evidence, payloadPath, sourcePath]) await mkdir(path);
  const sourceVerifier = join(root, 'verify.mjs');
  await writeFile(sourceVerifier, '// fixture verifier identity, not executed\n');
  const manifest = { sourceRevision: revision, totalBytes: 7, files: [] };
  const manifestText = json(manifest),
    archiveText = 'test-only ZIP identity';
  await writeFile(join(buildPath, 'manifest.json'), manifestText);
  await writeFile(join(buildPath, 'distribution.zip'), archiveText);
  const source = {
    status: 'passed',
    failures: [],
    source: { wholeTreeRevision: revision, dirty: false },
    manifest: { declaredSourceRevision: revision, sha256: id(manifestText).sha256 },
    verifiedArtifactBytes: 7,
  };
  const archive = {
    status: 'passed',
    sourceRevision: revision,
    manifestSHA256: source.manifest.sha256,
    zipBytes: id(archiveText).bytes,
    zipSHA256: id(archiveText).sha256,
  };
  const closed = (argv, timeoutMs, cwd = root) => ({
    argv,
    cwd,
    timeoutMs,
    status: 'closed',
    exitCode: 0,
    completedAt: '2026-10-17T00:00:00Z',
    violation: null,
    forcedCleanup: false,
    cleanupUnconfirmed: false,
    survivors: [],
    ambiguous: [],
  });
  const nodeExecutable = '/declared/node22';
  const commands = {
    build: closed(
      [
        nodeExecutable,
        join(sourcePath, 'scripts/game-cli.mjs'),
        'build',
        '--out',
        buildPath,
        '--revision',
        revision,
      ],
      1200000,
      sourcePath,
    ),
    inner: closed(
      [
        'python3',
        '-B',
        archiveHelper,
        'inner',
        join(buildPath, 'distribution.zip'),
        payloadPath,
        revision,
        join(evidence, 'baseline-archive.json'),
      ],
      600000,
    ),
    source: closed(
      [
        nodeExecutable,
        sourceVerifier,
        payloadPath,
        join(evidence, 'baseline-source.json'),
        `--source=${sourcePath}`,
        `--base=${revision}`,
        `--archive=${join(buildPath, 'distribution.zip')}`,
        `--archive-receipt=${join(evidence, 'baseline-archive.json')}`,
      ],
      480000,
    ),
  };
  await writeFile(join(evidence, 'baseline-source.json'), json(source));
  await writeFile(join(evidence, 'baseline-archive.json'), json(archive));
  for (const [name, value] of Object.entries(commands))
    await writeFile(join(evidence, `baseline-${name}.command.json`), json(value));
  const report = {
    baselineSetupStatus: 'passed',
    baselineSource: { revision: revision, tree: tree },
    tooling: { revision: 'a'.repeat(40), tree: 'b'.repeat(40) },
    plan: { path: 'declared', bytes: 3, sha256: 'c'.repeat(64) },
    runner: {
      node: 'v22.13.1',
      platform: 'linux',
      runId: '123',
      attempt: '1',
      workflowRef:
        'mekhovov/revealline/.github/workflows/solo-remote-offline-temporary.yml@refs/pull/1544/merge',
    },
  };
  const plan = {
    format: 'SoloHostedOfflinePairPlan.v1',
    repository: 'mekhovov/revealline',
    baseline: {
      revision: revision,
      tree: tree,
      publishVerifiedNormal: true,
      publisher: { workflow: '.github/workflows/solo-remote-offline-temporary.yml' },
    },
  };
  if (revision === CURRENT_BASE) {
    plan.format = 'SoloHostedNormalBaselineProducerPlanV2';
    plan.baseline.publisher.workflow = CURRENT_WORKFLOW;
    report.runner.workflowRef = `mekhovov/revealline/${CURRENT_WORKFLOW}@refs/pull/1544/merge`;
  }
  return {
    root,
    buildPath,
    payloadPath,
    evidence,
    sourcePath,
    nodeExecutable,
    archiveHelper,
    sourceVerifier,
    report,
    plan,
    source,
    archive,
    commands,
  };
}
async function documents(root) {
  const read = async (name) => JSON.parse(await readFile(join(root, name), 'utf8'));
  return {
    source: await read(`${BASELINE_PROOF}/source-proof.json`),
    archive: await read(`${BASELINE_PROOF}/archive-proof.json`),
    commands: await read(`${BASELINE_PROOF}/command-receipts.json`),
    environment: await read(`${BASELINE_PROOF}/environment.json`),
    manifest: await read('manifest.json'),
  };
}
test('positive publication is independently read back and survives a later negative offline outcome', async (t) => {
  const f = await fixture(t),
    before = await readFile(join(f.buildPath, 'distribution.zip'));
  const published = await publishBaseline(f);
  f.report.status = 'failed'; // no package readiness dependency on later diagnostic outcome
  const checked = await readBaselineBundle(f.buildPath);
  assert.equal(published.status, 'ready');
  assert.equal(checked.ready.profile, 'normal');
  assert.deepEqual(await readFile(join(f.buildPath, 'distribution.zip')), before);
  assert.deepEqual(checked.readyIdentity, {
    bytes: published.ready.bytes,
    sha256: published.ready.sha256,
  });
});
test('the first-eight mode publishes only its exact declared workflow authority', async (t) => {
  const f = await fixture(t);
  f.plan.format = 'SoloHostedCorrectnessPlan.v1';
  f.plan.baseline.publisher.workflow = '.github/workflows/solo-remote-correctness-temporary.yml';
  f.report.runner.workflowRef =
    'mekhovov/revealline/.github/workflows/solo-remote-correctness-temporary.yml@refs/pull/1544/merge';
  await publishBaseline(f);
  const { ready } = await readBaselineBundle(f.buildPath);
  assert.equal(ready.producer.workflow, f.plan.baseline.publisher.workflow);
  const wrong = await fixture(t);
  wrong.plan.format = 'SoloHostedCorrectnessPlan.v1';
  await assert.rejects(publishBaseline(wrong));
  await assert.rejects(access(join(wrong.buildPath, BASELINE_PROOF, 'ready.json')));
});

test('failed setup, forced cleanup, alternate build flags and source failures never publish positive ready', async (t) => {
  for (const mutation of ['setup', 'forced', 'flags', 'source', 'reused']) {
    const f = await fixture(t);
    if (mutation === 'setup') f.report.baselineSetupStatus = 'failed';
    if (mutation === 'reused') f.plan.baseline.reusableArtifact = {};
    if (mutation === 'forced') f.commands.build.forcedCleanup = true;
    if (mutation === 'flags') f.commands.build.argv.push('--profile=main-pages');
    if (mutation === 'source') f.source.failures.push('mismatch');
    await writeFile(join(f.evidence, 'baseline-build.command.json'), json(f.commands.build));
    await writeFile(join(f.evidence, 'baseline-source.json'), json(f.source));
    await assert.rejects(publishBaseline(f));
    await assert.rejects(access(join(f.buildPath, BASELINE_PROOF, 'ready.json')));
  }
});
test('reuse binds producer, exact archive, manifest and ready identity rather than only b117 revision', async (t) => {
  const f = await fixture(t);
  await publishBaseline(f);
  const checked = await readBaselineBundle(f.buildPath),
    ready = checked.ready;
  const reuse = {
    format: 'SoloHostedNormalBaselineReuseV1',
    run: 123,
    artifact: 456,
    name: 'solo-normal-baseline-b1174522-123-1',
    producer: ready.producer,
    outer: { bytes: 100, sha256: 'd'.repeat(64) },
    inner: ready.files['distribution.zip'],
    manifestSHA256: ready.files['manifest.json'].sha256,
    ready: checked.readyIdentity,
  };
  validateBaselineReuse(reuse, f.plan);
  await readBaselineBundle(f.buildPath, reuse);
  for (const mutation of [
    (r) => {
      r.inner.sha256 = 'e'.repeat(64);
    },
    (r) => {
      r.producer.toolingRevision = 'f'.repeat(40);
    },
    (r) => {
      r.ready.sha256 = 'e'.repeat(64);
    },
    (r) => {
      r.manifestSHA256 = 'f'.repeat(64);
    },
  ]) {
    const other = structuredClone(reuse);
    mutation(other);
    await assert.rejects(readBaselineBundle(f.buildPath, other));
  }
  for (const mutation of [
    (r) => {
      r.artifact = 0;
    },
    (r) => {
      r.producer.run++;
    },
    (r) => {
      r.outer.bytes = 3 * 1024 ** 3;
    },
    (r) => {
      r.producer.workflow = 'main-pages.yml';
    },
  ]) {
    const other = structuredClone(reuse);
    mutation(other);
    assert.throws(() => validateBaselineReuse(other, f.plan));
  }
});
test('proof semantics reject substituted source, command closure and producer environment', async (t) => {
  const f = await fixture(t);
  await publishBaseline(f);
  const { ready } = await readBaselineBundle(f.buildPath),
    proof = await documents(f.buildPath);
  for (const mutation of [
    (d) => {
      d.source.source.dirty = true;
    },
    (d) => {
      d.archive.zipBytes++;
    },
    (d) => {
      d.commands.inner.survivors = [1];
    },
    (d) => {
      d.environment.runner.node = 'v20';
    },
    (d) => {
      d.environment.runner.workflowRef = 'foreign/workflow';
    },
  ]) {
    const changed = structuredClone(proof);
    mutation(changed);
    assert.throws(() => validateBaselineReady(ready, changed));
  }
});
test('upload admission rejects later byte changes, aliases and missing checksums', async (t) => {
  for (const mutation of ['bytes', 'alias', 'checksums']) {
    const f = await fixture(t);
    await publishBaseline(f);
    if (mutation === 'bytes') await writeFile(join(f.buildPath, 'distribution.zip'), 'mutated');
    if (mutation === 'checksums') await rm(join(f.buildPath, BASELINE_PROOF, 'SHA256SUMS'));
    if (mutation === 'alias') {
      const path = join(f.buildPath, 'distribution.zip');
      const data = await readFile(path);
      await rm(path);
      const other = join(f.root, 'other');
      await writeFile(other, data);
      await symlink(other, path);
    }
    await assert.rejects(readBaselineBundle(f.buildPath));
  }
});
test('baseline outer verifier enforces fixed members, hashes and fresh destination before inner/source admission', async (t) => {
  const f = await fixture(t);
  await publishBaseline(f);
  const script = `import runpy,pathlib,zipfile,json,sys\na=runpy.run_path(sys.argv[1]);root=pathlib.Path(sys.argv[2]);names=json.loads(sys.argv[3])\nfor case in ['valid','extra','changed','missing']:\n z=root/(case+'.zip');dest=root/(case+'-out')\n with zipfile.ZipFile(z,'w') as out:\n  for name in names:\n   if case=='missing' and name.endswith('ready.json'):continue\n   data=(root/'build'/name).read_bytes()\n   if case=='changed' and name=='distribution.zip':data=b'changed'\n   out.writestr(name,data)\n  if case=='extra':out.writestr('unrelated',b'x')\n try:\n  result=a['verify_baseline_outer'](z,dest,${JSON.stringify(BASE)})\n except AssertionError:\n  if case=='valid':raise\n else:\n  assert case=='valid', 'invalid outer accepted'\n  assert result['status']=='passed'\n`;
  execFileSync(
    'python3',
    ['-B', '-c', script, archiveHelper, f.root, JSON.stringify(BASELINE_FILES)],
    { timeout: 10000, maxBuffer: 1024 ** 2 },
  );
});

test('V2 latest-main publication and reuse require explicit source/tree authority while V1 stays historical', async (t) => {
  const f = await fixture(t, CURRENT_BASE, CURRENT_TREE);
  const expected = { sourceRevision: CURRENT_BASE, sourceTree: CURRENT_TREE };
  await publishBaseline(f);
  const checked = await readBaselineBundle(f.buildPath, expected);
  assert.equal(checked.ready.format, 'SoloHostedNormalBaselineReadyV2');
  assert.equal(checked.ready.sourceRevision, CURRENT_BASE);
  assert.equal(checked.ready.sourceTree, CURRENT_TREE);
  await assert.rejects(readBaselineBundle(f.buildPath));
  for (const other of [
    { sourceRevision: BASE, sourceTree: TREE },
    { ...expected, sourceTree: TREE },
    { ...expected, sourceRevision: BASE },
  ])
    await assert.rejects(readBaselineBundle(f.buildPath, other));
  const reuse = {
    format: 'SoloHostedNormalBaselineReuseV2',
    ...expected,
    run: 123,
    artifact: 456,
    name: 'solo-normal-baseline-8b019919-123-1',
    producer: checked.ready.producer,
    outer: { bytes: 100, sha256: 'd'.repeat(64) },
    inner: checked.ready.files['distribution.zip'],
    manifestSHA256: checked.ready.files['manifest.json'].sha256,
    ready: checked.readyIdentity,
  };
  validateBaselineReuse(reuse, f.plan);
  await readBaselineBundle(f.buildPath, reuse);
  for (const mutate of [
    (x) => {
      x.format = 'SoloHostedNormalBaselineReuseV1';
    },
    (x) => {
      x.sourceRevision = BASE;
    },
    (x) => {
      x.sourceTree = TREE;
    },
    (x) => {
      x.name = 'solo-normal-baseline-b1174522-123-1';
    },
    (x) => {
      x.producer.workflow = '.github/workflows/solo-remote-correctness-temporary.yml';
    },
    (x) => {
      x.producer.workflow = '.github/workflows/publish-main-pages.yml';
    },
  ]) {
    const invalid = structuredClone(reuse);
    mutate(invalid);
    assert.throws(() => validateBaselineReuse(invalid, f.plan));
  }
  const proof = await documents(f.buildPath);
  for (const mutate of [
    (x) => {
      x.format = 'SoloHostedNormalBaselineReadyV1';
    },
    (x) => {
      x.sourceRevision = BASE;
    },
    (x) => {
      x.sourceTree = TREE;
    },
    (x) => {
      x.profile = 'main-pages';
    },
  ]) {
    const invalid = structuredClone(checked.ready);
    mutate(invalid);
    assert.throws(() => validateBaselineReady(invalid, proof, expected));
  }
  for (const mutate of [
    (x) => {
      x.commands.build.argv.push('--publication-profile', 'main-pages');
    },
    (x) => {
      x.commands.build.forcedCleanup = true;
    },
    (x) => {
      x.source.source.wholeTreeRevision = BASE;
    },
    (x) => {
      x.environment.source.tree = TREE;
    },
    (x) => {
      x.manifest.sourceRevision = BASE;
    },
  ]) {
    const invalid = structuredClone(proof);
    mutate(invalid);
    assert.throws(() => validateBaselineReady(checked.ready, invalid, expected));
  }
  const legacy = await fixture(t);
  await publishBaseline(legacy);
  assert.equal((await readBaselineBundle(legacy.buildPath)).ready.sourceRevision, BASE);
  await assert.rejects(readBaselineBundle(legacy.buildPath, expected));
});

test('V2 cannot publish with a cross-source/tree or reuse declaration, and outer type is source-bound', async (t) => {
  for (const mutate of [
    (x) => {
      x.plan.baseline.revision = BASE;
    },
    (x) => {
      x.plan.baseline.tree = TREE;
    },
    (x) => {
      x.plan.format = 'SoloHostedCorrectnessPlan.v1';
    },
    (x) => {
      x.plan.baseline.reusableArtifact = {};
    },
  ]) {
    const f = await fixture(t, CURRENT_BASE, CURRENT_TREE);
    mutate(f);
    await assert.rejects(publishBaseline(f));
    await assert.rejects(access(join(f.buildPath, BASELINE_PROOF, 'ready.json')));
  }
  const f = await fixture(t, CURRENT_BASE, CURRENT_TREE);
  await publishBaseline(f);
  const script = `import runpy,pathlib,zipfile,json,sys,hashlib\na=runpy.run_path(sys.argv[1]);root=pathlib.Path(sys.argv[2]);names=json.loads(sys.argv[3])\nfor case in ['valid','legacy-type','wrong-tree','wrong-source','old-expected']:\n data={name:(root/'build'/name).read_bytes() for name in names};key='normal-baseline-proof/ready.json';ready=json.loads(data[key])\n if case=='legacy-type':ready['format']='SoloHostedNormalBaselineReadyV1'\n if case=='wrong-tree':ready['sourceTree']='${TREE}'\n if case=='wrong-source':ready['sourceRevision']='${BASE}'\n data[key]=(json.dumps(ready)+chr(10)).encode();data['normal-baseline-proof/SHA256SUMS']=''.join(hashlib.sha256(value).hexdigest()+'  '+name+chr(10) for name,value in data.items() if not name.endswith('SHA256SUMS')).encode()\n z=root/(case+'.zip')\n with zipfile.ZipFile(z,'w') as out:\n  for name,value in data.items():out.writestr(name,value)\n try:result=a['verify_baseline_outer'](z,root/(case+'-out'),'${BASE}' if case=='old-expected' else '${CURRENT_BASE}')\n except AssertionError:\n  if case=='valid':raise\n else:assert case=='valid' and result['status']=='passed'\n`;
  execFileSync(
    'python3',
    ['-B', '-c', script, archiveHelper, f.root, JSON.stringify(BASELINE_FILES)],
    { timeout: 10000, maxBuffer: 1024 ** 2 },
  );
});
