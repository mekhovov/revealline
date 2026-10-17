import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  offlineEvidenceCopySuccessor,
  validateOfflinePlan,
  verifyOfflineFixedEvidence,
  prepareOfflineMode,
} from './solo-remote-offline.mjs';
const root = new URL('../', import.meta.url);
const historical = JSON.parse(
  await readFile(new URL('docs/performance/solo-remote-offline-candidate-v2-plan.json', root)),
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function candidate() {
  const plan = structuredClone(historical);
  plan.evidenceCopySuccessor = offlineEvidenceCopySuccessor();
  plan.fixedEvidenceInputs = plan.evidenceCopySuccessor.fixedPaths.map((path) =>
    plan.adapterInputs.find((r) => r.path === path),
  );
  plan.adapterInputs = plan.adapterInputs.filter(
    (r) => !plan.evidenceCopySuccessor.fixedPaths.includes(r.path),
  );
  plan.diagnosticRelease.onceOnlyBefore = plan.evidenceCopySuccessor.priorTooling;
  return plan;
}
async function fixture(t) {
  const repository = await mkdtemp(join(tmpdir(), 'offline-fixed-'));
  t.after(() => rm(repository, { recursive: true, force: true }));
  const evidence = join(repository, 'evidence');
  await mkdir(join(repository, 'scripts'));
  await mkdir(evidence);
  const plan = candidate();
  for (const ref of plan.fixedEvidenceInputs) {
    const bytes = Buffer.from(ref.path + '\n');
    ref.bytes = bytes.length;
    ref.sha256 = sha(bytes);
    await writeFile(join(repository, ref.path), bytes, { flag: 'wx' });
    await writeFile(join(evidence, ref.path.split('/').at(-1)), bytes, { flag: 'wx' });
  }
  plan.diagnosticRelease.ownerCorrection = plan.fixedEvidenceInputs[0];
  return { repository, evidence, plan };
}
test('historical fixed-copy collision remains reproducible and new placement is disjoint', async (t) => {
  const { evidence, plan } = await fixture(t);
  for (const ref of plan.fixedEvidenceInputs)
    await assert.rejects(
      writeFile(join(evidence, ref.path.split('/').at(-1)), 'again', { flag: 'wx' }),
      { code: 'EEXIST' },
    );
  assert(
    historical.adapterInputs.some((r) => r.path === 'scripts/run-solo-remote-correctness.mjs'),
  );
  validateOfflinePlan(historical);
  validateOfflinePlan(plan);
  assert(
    plan.fixedEvidenceInputs.every((ref) => !plan.adapterInputs.some((r) => r.path === ref.path)),
  );
});
test('bounded fixed source and retained copies have separate positive readback receipts', async (t) => {
  const { repository, evidence, plan } = await fixture(t);
  assert.equal((await verifyOfflineFixedEvidence(plan, repository)).records.length, 2);
  const result = await verifyOfflineFixedEvidence(plan, repository, evidence);
  assert.equal(result.records.length, 4);
  assert.equal(result.status, 'passed');
});
test('fixed evidence rejects unknown successor, missing ref, duplicate basename and changed owner authority', () => {
  for (const mutate of [
    (p) => delete p.setupSuccessor,
    (p) => delete p.evidenceCopySuccessor,
    (p) => p.fixedEvidenceInputs.pop(),
    (p) => p.adapterInputs.push(p.fixedEvidenceInputs[0]),
    (p) =>
      p.adapterInputs.push({
        ...p.fixedEvidenceInputs[0],
        path: 'scripts/other/run-solo-remote-correctness.mjs',
      }),
    (p) => p.evidenceCopySuccessor.priorRun++,
    (p) => (p.evidenceCopySuccessor.priorManifest.sha256 = '0'.repeat(64)),
    (p) =>
      (p.diagnosticRelease.ownerCorrection = {
        ...p.fixedEvidenceInputs[0],
        sha256: '0'.repeat(64),
      }),
    (p) => (p.diagnosticRelease.onceOnlyBefore = 'a7e0219818842f02399317ca6d2a14bdd506da3d'),
  ]) {
    const p = candidate();
    mutate(p);
    assert.throws(() => validateOfflinePlan(p));
  }
});
test('changed, missing, truncated, expanded and symlinked fixed bytes fail before native preparation', async (t) => {
  const { repository, evidence, plan } = await fixture(t);
  const ref = plan.fixedEvidenceInputs[0];
  const path = join(repository, ref.path),
    original = await readFile(path);
  for (const bytes of [
    Buffer.alloc(original.length),
    original.subarray(1),
    Buffer.concat([original, Buffer.from('x')]),
  ]) {
    await writeFile(path, bytes);
    await assert.rejects(verifyOfflineFixedEvidence(plan, repository));
  }
  await rm(path);
  await assert.rejects(verifyOfflineFixedEvidence(plan, repository));
  const target = join(evidence, ref.path.split('/').at(-1));
  await symlink(target, path);
  await assert.rejects(verifyOfflineFixedEvidence(plan, repository));
  await rm(path);
  await writeFile(path, original);
  await writeFile(target, Buffer.alloc(original.length));
  await assert.rejects(verifyOfflineFixedEvidence(plan, repository, evidence), /hash identity/);
  let called = false;
  await assert.rejects(
    prepareOfflineMode({
      plan,
      repository,
      evidence,
      required: () => {
        called = true;
      },
      admitted: {},
    }),
    /hash identity/,
  );
  assert.equal(called, false);
});
