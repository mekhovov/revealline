import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { auxiliarySetupSuccessor, bindAuxiliaryJob } from './solo-remote-auxiliary.mjs';
import { offlineSetupSuccessor, validateOfflinePlan } from './solo-remote-offline.mjs';

const root = new URL('../', import.meta.url);
for (const kind of ['audio', 'recovery', 'offline']) {
  const expected = kind === 'offline' ? offlineSetupSuccessor() : auxiliarySetupSuccessor(kind);
  const bytes = await readFile(new URL(expected.priorManifest.path, root));
  assert.equal(bytes.length, expected.priorManifest.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.priorManifest.sha256);
  const original = JSON.parse(bytes);
  const validate = (plan) =>
    kind === 'offline'
      ? validateOfflinePlan(plan)
      : bindAuxiliaryJob(
          plan,
          kind === 'audio' ? 'speech-chromium' : 'recovery-chromium',
          kind === 'recovery' ? 1 : undefined,
        );
  function successor() {
    const plan = structuredClone(original);
    plan.setupSuccessor = structuredClone(expected);
    (kind === 'offline' ? plan.diagnosticRelease : plan.release).onceOnlyBefore =
      'a7e0219818842f02399317ca6d2a14bdd506da3d';
    const refs = kind === 'offline' ? plan.adapterInputs : plan.frozenTools;
    for (const path of expected.dynamicRoots)
      if (!refs.some((ref) => ref.path === path))
        refs.push({ path, bytes: 1, sha256: 'a'.repeat(64) });
    return plan;
  }
  test(`${kind} preserves original admission and permits only the explicit setup successor`, () => {
    validate(original);
    validate(successor());
  });
  test(`${kind} rejects missing or altered predecessor, source, gate and dependency proof`, () => {
    for (const mutate of [
      (p) => delete p.setupSuccessor,
      (p) => p.setupSuccessor.priorRun++,
      (p) => p.setupSuccessor.priorNativeObservations++,
      (p) => (p.setupSuccessor.priorManifest.sha256 = '0'.repeat(64)),
      (p) => (p.setupSuccessor.runtimeChanged = true),
      (p) => (p.setupSuccessor.gateChanged = true),
      (p) => p.setupSuccessor.automaticRetries++,
      (p) => p.setupSuccessor.dynamicRoots.pop(),
      (p) => (p.candidate.revision = '0'.repeat(40)),
      (p) => (p.performanceExclusion = false),
      (p) => {
        const key = kind === 'offline' ? 'adapterInputs' : 'frozenTools';
        p[key] = p[key].filter((r) => r.path !== expected.dynamicRoots[0]);
      },
    ]) {
      const value = successor();
      mutate(value);
      assert.throws(() => validate(value));
    }
  });
}
