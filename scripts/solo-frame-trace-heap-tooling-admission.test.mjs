import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { bindCpuProfileJob, prepareCpuProfileMode } from './solo-remote-cpu-profile.mjs';
import {
  PRE_HEAP_TOOLING_WITNESS,
  declaredPreHeapToolSource,
} from './solo-readiness-rejoin-declared-source.mjs';
import './solo-frame-trace-tasks-admission.test.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originalPath = 'docs/performance/solo-browser-frame-trace-9d-tasks-plan.json';
const path = 'docs/performance/solo-browser-frame-trace-9d-tasks-heap-tooling-plan.json';
const originalBytes = await read(originalPath);
const original = JSON.parse(originalBytes);
const candidate = JSON.parse(await read(path));
const changedTools = ['scripts/qualify-solo-runtime.mjs', 'scripts/solo-remote-sustained.mjs'];
const expected = structuredClone(original);
let updated = 0;
for (const key of ['adapterInputs', 'frozenTools']) {
  for (const ref of expected[key]) {
    if (!changedTools.includes(ref.path)) continue;
    const bytes = await read(ref.path);
    ref.bytes = bytes.length;
    ref.sha256 = hash(bytes);
    updated++;
  }
}
assert.equal(updated, 2);
const check = (plan) => {
  assert.deepEqual(
    plan,
    expected,
    'Only the two current tool identities may differ from frozen v2',
  );
  return bindCpuProfileJob(plan);
};

test('separately named trace tooling successor changes only two exact tool identities', async () => {
  assert.equal(originalBytes.length, 17005);
  assert.equal(
    hash(originalBytes),
    '21a6c7ea6245bffd3ce6b2d9b42c4cf2c56243823be8cb319ae327a276972bfa',
  );
  const witness = await read(PRE_HEAP_TOOLING_WITNESS);
  for (const ref of [...original.adapterInputs, ...original.frozenTools]) {
    if (!changedTools.includes(ref.path)) continue;
    const retained = declaredPreHeapToolSource(witness, originalPath, originalBytes, ref);
    assert.deepEqual({ path: ref.path, bytes: retained.length, sha256: hash(retained) }, ref);
  }
  check(candidate);
  for (const ref of [candidate.recipe, ...candidate.adapterInputs, ...candidate.frozenTools]) {
    const bytes = await read(ref.path);
    assert.deepEqual({ path: ref.path, bytes: bytes.length, sha256: hash(bytes) }, ref);
  }
  assert.deepEqual(JSON.parse(await read(originalPath)), original);
});

test('every non-tool field, extra field, replacement path and stale tool identity is rejected', () => {
  for (const key of Object.keys(original).filter(
    (key) => !['adapterInputs', 'frozenTools'].includes(key),
  )) {
    const bad = structuredClone(candidate);
    bad[key] = { altered: true };
    assert.throws(() => check(bad), key);
  }
  const extra = structuredClone(candidate);
  extra.unreviewed = true;
  assert.throws(() => check(extra));
  for (const key of ['adapterInputs', 'frozenTools']) {
    for (let i = 0; i < candidate[key].length; i++) {
      for (const mutate of [
        (ref) => ref.bytes++,
        (ref) => (ref.sha256 = '0'.repeat(64)),
        (ref) => (ref.path += '.other'),
      ]) {
        const bad = structuredClone(candidate);
        mutate(bad[key][i]);
        assert.throws(() => check(bad));
      }
    }
    const reordered = structuredClone(candidate);
    reordered[key].reverse();
    assert.throws(() => check(reordered));
  }
  assert.throws(() => check(original));
});

test('unchanged original v2 pins still fail production admission before native work', async () => {
  let admitted = 0,
    effects = 0,
    checked = 0;
  await assert.rejects(() =>
    prepareCpuProfileMode({
      plan: bindCpuProfileJob(original),
      repository: fileURLToPath(new URL('../', import.meta.url)),
      get admitted() {
        admitted++;
        throw Error('package admission must remain unread');
      },
      digest: async (path) => {
        checked++;
        const bytes = await readFile(path);
        return { bytes: bytes.length, sha256: hash(bytes) };
      },
      required: async () => effects++,
    }),
  );
  assert(checked > 0);
  assert.equal(admitted, 0);
  assert.equal(effects, 0);
});

test('current lane selects tooling successor with full inherited controls and unchanged owners', async () => {
  const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
  const body = workflow.split('\n  hud-cpu:\n')[1].split(/\n  [a-z][a-z-]+:\n/)[0];
  assert(body.includes('bind-plan ' + path));
  assert(!body.includes('bind-plan ' + originalPath));
  assert(body.includes("'solo-linux-9d5139-frame-tasks-heap-tooling'"));
  assert(
    body.includes(
      'node --test --test-concurrency=2 scripts/solo-frame-trace-heap-tooling-admission.test.mjs ',
    ),
  );
  for (const value of [
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
  ])
    assert(body.includes(value));
  for (const p of [
    path,
    originalPath,
    PRE_HEAP_TOOLING_WITNESS,
    'scripts/solo-readiness-rejoin-declared-source.mjs',
    'scripts/solo-frame-trace-heap-tooling-admission.test.mjs',
    'scripts/solo-frame-trace-tasks-admission.test.mjs',
  ])
    assert(body.includes('            /' + p + '\n'), p);
  assert(!body.includes('continue-on-error'));
  assert.match(body, /github\.event_name == 'workflow_dispatch'/);
  assert.match(body, /github\.ref == 'refs\/heads\/main'/);
});
