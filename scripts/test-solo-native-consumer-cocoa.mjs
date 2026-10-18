import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const workflow = await read('.github/workflows/solo-native-package-consumer.yml');
const prior = await read('.github/workflows/solo-native-mp3-cocoa-identity-v2-temporary.yml');
const cocoa = workflow.split('  cocoa:\n')[1].split('  correctness:\n')[0];
const guard =
  "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'cocoa'";

function admission(job) {
  assert.equal(job.match(/^    if: (.+)$/m)?.[1], guard);
  for (const text of [
    'runs-on: macos-15-intel',
    'timeout-minutes: 28',
    "SOLO_DARWIN_AMBIGUITY_EVIDENCE: 'identity-maps-v2'",
    'SOLO_TOOLING_REVISION: ${{ github.sha }}',
    'ref: ${{ github.sha }}',
    'persist-credentials: false',
    "node-version: '22.13.1'",
    'playwright@1.62.1',
    "SOLO_RUN_DARWIN_OWNER_TESTS: '1'",
    'node scripts/solo-native-mp3-control.mjs run-cocoa "$RUNNER_TEMP/solo-native-mp3-evidence"',
    'verifyCommittedInputs(inputs, committedInputMap(root))',
    'verifyCommittedInputs(inputs, committedInputMap(process.cwd()))',
    'assert.equal(identity.sourceRevision, process.env.SOLO_TOOLING_REVISION)',
    'solo-cocoa-source-before.json',
    'solo-cocoa-source-after.json',
  ])
    assert(job.includes(text), text);
  assert.equal((job.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(
    !job.includes('inputs.source') && !job.includes('inputs.timeout') && !job.includes('--force'),
  );
}

test('Cocoa is a fixed separate manual main lane with original browser, media and ownership gates', () => {
  admission(cocoa);
  const evaluate = new Function('github', 'inputs', `return (${guard})`);
  const event = {
    repository: 'mekhovov/revealline',
    event_name: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assert.equal(evaluate(event, { lane: 'cocoa' }), true);
  for (const patch of [
    { repository: 'foreign/repository' },
    { event_name: 'pull_request' },
    { event_name: 'push' },
    { ref: 'refs/heads/arbitrary' },
  ])
    assert.equal(evaluate({ ...event, ...patch }, { lane: 'cocoa' }), false);
  for (const lane of ['first-eight', 'next', 'all', undefined])
    assert.equal(evaluate(event, { lane }), false);
  for (const [from, to] of [
    ['timeout-minutes: 28', 'timeout-minutes: 29'],
    ['playwright@1.62.1', 'playwright@latest'],
    ['refs/heads/main', 'refs/heads/arbitrary'],
    ["SOLO_RUN_DARWIN_OWNER_TESTS: '1'", "SOLO_RUN_DARWIN_OWNER_TESTS: '0'"],
    ['verifyCommittedInputs(inputs, committedInputMap(root))', 'void inputs'],
  ])
    assert.throws(() => admission(cocoa.replace(from, to)));
});

test('Cocoa retains the complete prior sparse closure and adds only reviewed evidence/control dependencies', async () => {
  const sparse = (text) => [...text.matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
  const oldPaths = sparse(prior),
    paths = sparse(cocoa);
  assert.equal(paths.length, new Set(paths).size);
  for (const path of oldPaths) assert(paths.includes(path), path);
  assert.deepEqual(
    paths.filter((path) => !oldPaths.includes(path)).sort(),
    [
      '.gitignore',
      '.github/workflows/solo-native-package-consumer.yml',
      'docs/performance/fixtures/solo-cocoa-identity/3e640-executed-source.json',
      'scripts/frozen-source.mjs',
      'scripts/test-solo-native-consumer-cocoa.mjs',
    ].sort(),
  );
  for (const path of paths) await read(path);
  for (const name of [
    'Compile the exact read-only SDK inventory and pin its owned binary',
    'Verify native inventory and existing process/media ownership contracts',
    'Install exact Cocoa WebKit without changing the declared browser version',
    'Require clean blank-context ownership then observe the original Bossa Blob',
  ]) {
    const block = (text) => text.split('      - name: ' + name + '\n')[1].split('      - name:')[0];
    assert.equal(block(cocoa), block(prior), name);
  }
  assert(
    cocoa.indexOf('solo-cocoa-source-before.json') <
      cocoa.indexOf('Compile the exact read-only SDK'),
  );
  assert(cocoa.indexOf('solo-cocoa-source-after.json') > cocoa.indexOf('run-cocoa'));
});
