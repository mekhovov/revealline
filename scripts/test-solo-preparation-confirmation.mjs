import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { auxiliaryMatrix, bindAuxiliaryJob } from './solo-remote-auxiliary.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL('docs/performance/solo-remote-preparation-plan.json', root)),
);
const workflow = await readFile(
  new URL('.github/workflows/solo-remote-preparation-temporary.yml', root),
  'utf8',
);

test('six recovery observations bind the actual successful bffc package without qualifying older runtime', () => {
  assert.equal(manifest.candidate.revision, 'bffcbd838a7bb925da8aaf030695773f893d8bda');
  assert.equal(manifest.candidate.tree, '42ab614e1ef687092782684560b6e6b68b21daad');
  assert.equal(manifest.candidate.run, 38992974796);
  assert.equal(manifest.candidate.artifact, 12086228392);
  assert.deepEqual(manifest.candidate.outer, {
    bytes: 1090953311,
    sha256: '0247a57c1678a3297c4d868b85fd6f63e3a8cf14246468006196aec814fff89d',
  });
  assert.deepEqual(manifest.candidate.inner, {
    bytes: 1073310187,
    sha256: '1cb186ffcde6f7b23ff24973f9a9cb42e6e53d5e4bd2ed1bcd6073502bafcee6',
  });
  assert.equal(
    manifest.candidate.manifestSHA256,
    '01c167afd80d771cfbd76591079b8b8003a3900050fd550f3fd9a7bebad5e048',
  );
  assert.equal(manifest.release.firstEightAllCorrectnessPassed, false);
  assert.equal(manifest.release.automaticRetries, 0);
  assert.equal(manifest.release.musicProofBytes, undefined);
  const matrix = auxiliaryMatrix(manifest);
  assert.deepEqual(
    matrix.include.map((row) => row.observation),
    [
      'recovery-chromium-r1',
      'recovery-chromium-r2',
      'recovery-chromium-r3',
      'recovery-webkit-r1',
      'recovery-webkit-r2',
      'recovery-webkit-r3',
    ],
  );
  for (const row of matrix.include) {
    const plan = bindAuxiliaryJob(manifest, row.job, row.repetition);
    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].source, 'candidate');
    assert.equal(plan.rows[0].timeoutMs, 420000);
    assert.equal(plan.performanceExclusion, true);
    assert.equal(plan.cpu, 1);
    assert.equal(plan.helperTimeoutMs, 3600000);
    assert.equal(row.jobMinutes, 105);
    assert.equal(row.stepMinutes, 63);
    assert.equal(row.outerSeconds, 3720);
  }
});

test('confirmation requires exact frozen recipe, uploaded mission and tool bytes', async () => {
  assert.deepEqual(
    manifest.frozenTools.find((ref) => ref.path === 'scripts/run-solo-remote-correctness.mjs'),
    {
      path: 'scripts/run-solo-remote-correctness.mjs',
      bytes: 52211,
      sha256: '42750c0bb862b5ca28dfb8394b6381694418b0ed9240a70f006652fcfde28235',
    },
  );
  for (const ref of [
    ...Object.values(manifest.recipes),
    ...manifest.uploads,
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
  ]) {
    const bytes = await readFile(new URL(ref.path, root));
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
  }
});

test('one push runs distinct owned recovery repetitions with full source admission and fixed shutdown reserves', () => {
  assert.match(workflow, /github\.event\.action == 'synchronize'/);
  assert.match(workflow, /github\.event\.before == 'bffcbd838a7bb925da8aaf030695773f893d8bda'/);
  assert(!workflow.includes('if: false'));
  const [declaration, observation] = workflow.split('  auxiliary:\n');
  assert(declaration && observation);
  const sparse = declaration
    .split('          sparse-checkout: |\n')[1]
    .split('      - timeout-minutes: 1')[0]
    .trim()
    .split('\n')
    .map((line) => line.trim());
  assert.deepEqual(sparse, [
    '/scripts/solo-remote-auxiliary.mjs',
    '/docs/performance/solo-remote-preparation-plan.json',
  ]);
  assert.match(declaration, /sparse-checkout-cone-mode: false/);
  assert(!observation.includes('sparse-checkout'));
  assert.match(observation, /ref: bffcbd838a7bb925da8aaf030695773f893d8bda/);
  assert.match(observation, /fail-fast: false/);
  assert.match(observation, /max-parallel: 2/);
  assert.match(observation, /'\$\{\{ matrix\.job \}\}' '\$\{\{ matrix\.repetition \}\}'/);
  assert.match(
    observation,
    /OUTPUT=\$RUNNER_TEMP\/solo-linux-preparation-\$\{\{ matrix\.observation \}\}/,
  );
  assert.match(
    observation,
    /name: solo-linux-preparation-\$\{\{ matrix\.observation \}\}-\$\{\{ github\.run_id \}\}/,
  );
  assert.match(
    observation,
    /timeout --signal=TERM --kill-after=30s \$\{\{ matrix\.outerSeconds \}\}s/,
  );
  assert.match(observation, /if: \$\{\{ always\(\) \}\}/);
  assert(!workflow.includes('fetch-depth: 0'));
});
