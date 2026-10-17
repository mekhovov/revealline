import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  auxiliaryMatrix,
  auxiliarySetupSuccessor,
  bindAuxiliaryJob,
} from './solo-remote-auxiliary.mjs';
import { offlineSetupSuccessor, validateOfflinePlan } from './solo-remote-offline.mjs';
const root = new URL('../', import.meta.url);
const pairs = {
  audio: [
    'docs/performance/solo-final-audio-plan.json',
    'docs/performance/solo-final-audio-v2-plan.json',
    '.github/workflows/solo-remote-final-audio-v2-temporary.yml',
  ],
  offline: [
    'docs/performance/solo-remote-offline-candidate-plan.json',
    'docs/performance/solo-remote-offline-candidate-v2-plan.json',
    '.github/workflows/solo-remote-offline-candidate-v2-temporary.yml',
  ],
};
const guard =
  "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'";
for (const [kind, [oldPath, path, workflowPath]] of Object.entries(pairs)) {
  const original = JSON.parse(await readFile(new URL(oldPath, root))),
    plan = JSON.parse(await readFile(new URL(path, root))),
    workflow = await readFile(new URL(workflowPath, root), 'utf8');
  const correction = kind === 'audio' ? auxiliarySetupSuccessor('audio') : offlineSetupSuccessor();
  function check(value, text) {
    assert.deepEqual(value.candidate, original.candidate);
    assert.deepEqual(value.baseline, original.baseline);
    assert.deepEqual(value.setupSuccessor, correction);
    for (const key of kind === 'audio'
      ? [
          'recipes',
          'uploads',
          'musicBundle',
          'jobs',
          'runtimeRevision',
          'setupTimeoutMs',
          'fixturePreparationTimeoutMs',
          'evidenceBytes',
          'rowEvidenceBytes',
        ]
      : [
          'rows',
          'resources',
          'offline',
          'helperTimeoutMs',
          'setupTimeoutMs',
          'evidenceBytes',
          'profileEvidenceBytes',
          'bindingScope',
        ])
      assert.deepEqual(value[key], original[key], key);
    assert(text.includes('if: ' + guard));
    assert(text.includes('cancel-in-progress: false'));
    assert(text.includes('node --test --test-concurrency=2'));
    const command = text.split('\n').find((line) => line.includes('node --test'));
    assert(command.includes('scripts/test-solo-source-verifier-smoke.mjs'));
    assert(command.includes('scripts/test-solo-verifier-successor-admission.mjs'));
    assert(command.includes('scripts/test-solo-final-offline-audio-v2-release.mjs'));
    for (const name of [...correction.dynamicRoots, path, workflowPath])
      assert(text.includes('/' + name + '\n'));
    assert(text.includes('if: ${{ always() }}'));
    if (kind === 'audio') {
      const matrix = auxiliaryMatrix(value);
      assert.equal(matrix.include.length, 4);
      for (const job of matrix.include) {
        assert.equal(job.jobMinutes, 122);
        assert.deepEqual(
          bindAuxiliaryJob(value, job.job).rows.map((r) => r.source),
          ['baseline', 'candidate'],
        );
      }
    } else {
      validateOfflinePlan(value);
      assert(text.includes('timeout-minutes: 165'));
      assert(text.includes('timeout-minutes: 104'));
      assert(text.includes('103m node scripts/run-solo-remote-correctness.mjs'));
    }
  }
  test(`${kind} v2 preserves actual sources, original scenarios and strict reviewed setup-only admission`, async () => {
    check(plan, workflow);
    const refs =
      kind === 'audio'
        ? [...plan.adapterInputs, ...plan.frozenTools]
        : [...plan.adapterInputs, plan.diagnosticRelease.ownerCorrection];
    for (const ref of refs) {
      const bytes = await readFile(new URL(ref.path, root));
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    }
  });
  test(`${kind} v2 rejects changed scenario, source, gate, one-shot or smoke omission`, () => {
    for (const mutate of [
      (v) => v.candidate.artifact++,
      (v) => (v.setupSuccessor.gateChanged = true),
      (v) => delete v.setupSuccessor,
      (v) => v.setupTimeoutMs++,
    ]) {
      const value = structuredClone(plan);
      mutate(value);
      assert.throws(() => check(value, workflow));
    }
    for (const alter of [
      (w) => w.replace(guard, 'true'),
      (w) =>
        w.replaceAll('scripts/test-solo-source-verifier-smoke.mjs', 'scripts/missing-smoke.mjs'),
      (w) =>
        w.replaceAll('/scripts/soundtrack-distribution.mjs', '/scripts/missing-distribution.mjs'),
    ])
      assert.throws(() => check(plan, alter(workflow)));
  });
}
