import { createExecutedFrameReader } from './solo-frame-trace-executed-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  auxiliaryMatrix,
  bindAuxiliaryJob,
  prepareAuxiliaryMode,
} from './solo-remote-auxiliary.mjs';
import {
  SHARED_OWNER_WITNESS,
  sharedOwnerDeclaredRefs,
  assertSharedOwnerDeclaredTool,
} from './solo-shared-owner-declared-source.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const historicalFrameRead = createExecutedFrameReader(read);
// These exact qualifier and recorder bytes precede the additive v2 protocol.
// Production still rejects stale input; no declaration or execution result changes.
const declaredRead = (path) =>
  ['scripts/qualify-solo-runtime.mjs', 'scripts/solo-qualification-cpu-profile.mjs'].includes(path)
    ? historicalFrameRead(path)
    : read(path);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const path = 'docs/performance/solo-shared-mode-public-return-797e03-owner-plan.json';
const priorPath = 'docs/performance/solo-shared-mode-public-return-797e03-boot-plan.json';
const plan = JSON.parse(await read(path)),
  prior = JSON.parse(await read(priorPath));
test('named owner successor retains exact797 package, proof, public actions and all original bounds', async () => {
  assert.deepEqual(auxiliaryMatrix(plan), auxiliaryMatrix(prior));
  for (const key of [
    'candidate',
    'baseline',
    'recipes',
    'cpu',
    'performanceExclusion',
    'fixturePreparationTimeoutMs',
    'setupTimeoutMs',
    'rowEvidenceBytes',
    'evidenceBytes',
  ])
    assert.deepEqual(plan[key], prior[key], key);
  assert.deepEqual(plan.release.firstEightEvidence, prior.release.firstEightEvidence);
  assert.equal(plan.release.pageInitialization, 'fresh-persistent-single-blank-v1');
  assert.equal(plan.toolingSuccessor.priorRun, 39131052691);
  assert.equal(plan.toolingSuccessor.currentObservation, 'unobserved');
  assert.equal(
    plan.toolingSuccessor.priorAudit.gitDataBlob,
    'e643200ce44df75125cd46039ac12d01f8684a9e',
  );
  assert.equal(
    plan.toolingSuccessor.priorAudit.sha256,
    '69cfdcd9c55ca973646e2e6907e6d58797d44e5aa2386cd432bdbced2d7b20be',
  );
  for (const job of plan.release.selectedJobs) {
    const p = bindAuxiliaryJob(plan, job);
    assert.equal(p.rows[0].timeoutMs, 420000);
    assert.equal(p.helperTimeoutMs, 3600000);
    assert.equal(p.performanceExclusion, true);
  }
  for (const mutate of [
    (p) => (p.release.firstEightEvidence = null),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => (p.cpu = 2),
    (p) => p.setupTimeoutMs++,
    (p) => (p.status = 'held-awaiting-source-and-dispatch-review'),
  ]) {
    const p = structuredClone(plan);
    mutate(p);
    assert.throws(() => auxiliaryMatrix(p));
  }
});
test('owner declaration retains exact prior qualifier bytes and stale tooling cannot reach native work', async () => {
  for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.recipes.recovery]) {
    const b = await declaredRead(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(hash(b), ref.sha256, ref.path);
  }
  const selected = bindAuxiliaryJob(plan, 'recovery-webkit');
  let effects = 0,
    digests = 0;
  await assert.rejects(
    () =>
      prepareAuxiliaryMode({
        plan: selected,
        repository: new URL('../', import.meta.url).pathname.replace(/\/$/, ''),
        digest: async (file) => {
          digests++;
          const b = await readFile(file);
          return {
            bytes: b.length,
            sha256: file.endsWith('/scripts/qualify-solo-runtime.mjs') ? '0'.repeat(64) : hash(b),
          };
        },
        get admitted() {
          effects++;
          throw Error('admission must remain unread');
        },
        required: async () => effects++,
      }),
    { name: 'AssertionError' },
  );
  assert(digests > 1);
  assert.equal(effects, 0);
});
test('old executed shared declaration is immutable and cannot use a history witness for production admission', async () => {
  let effects = 0;
  await assert.rejects(
    () =>
      prepareAuxiliaryMode({
        plan: bindAuxiliaryJob(prior, 'recovery-webkit'),
        repository: new URL('../', import.meta.url).pathname.replace(/\/$/, ''),
        digest: async (file) => {
          const b = await readFile(file);
          return { bytes: b.length, sha256: hash(b) };
        },
        get admitted() {
          effects++;
          throw Error('admission must remain unread');
        },
        required: async () => effects++,
      }),
    { name: 'AssertionError' },
  );
  assert.equal(effects, 0);
});
test('exact executed source witness rejects changed bytes, declaration or invented authority', async () => {
  const w = await read(SHARED_OWNER_WITNESS);
  for (const declaration of [
    'docs/performance/solo-remote-9d5139b-correctness-plan.json',
    priorPath,
  ]) {
    const m = await read(declaration),
      refs = sharedOwnerDeclaredRefs(w, declaration, m);
    assert.equal(refs.size, declaration === priorPath ? 2 : 1);
    for (const [b, p, d] of [
      [Buffer.concat([w, Buffer.from(' ')]), declaration, m],
      [w, declaration, Buffer.concat([m, Buffer.from(' ')])],
      [w, path, m],
      [Buffer.from(JSON.stringify({ ...JSON.parse(w), revision: '0'.repeat(40) })), declaration, m],
    ])
      assert.throws(() => sharedOwnerDeclaredRefs(b, p, d));
  }
});

test('retained recorder readback binds the original declaration and refuses changed references', async () => {
  for (const declaration of [
    'docs/performance/solo-remote-9d5139b-correctness-plan.json',
    'docs/performance/solo-shared-mode-public-return-797e03-boot-plan.json',
  ]) {
    const saved = JSON.parse(await read(declaration));
    const ref = saved.frozenTools.find(
      (entry) => entry.path === 'scripts/solo-qualification-cpu-profile.mjs',
    );
    assert(ref);
    assert.equal(await assertSharedOwnerDeclaredTool(declaration, ref), true);
    for (const changed of [
      { ...ref, bytes: ref.bytes + 1 },
      { ...ref, sha256: '0'.repeat(64) },
    ])
      await assert.rejects(() => assertSharedOwnerDeclaredTool(declaration, changed));
    await assert.rejects(() => assertSharedOwnerDeclaredTool(path, ref), /Unwitnessed declaration/);
  }
});
