import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const workflows = new URL('../.github/workflows/', import.meta.url);

test('pull-request admission workflows do not require GitHub Pages', async () => {
  for (const name of await fs.readdir(workflows)) {
    if (!/\.ya?ml$/u.test(name)) continue;
    // Publishing the protected main snapshot is intentionally optional and
    // runs only after a merge. It must not become an admission dependency for
    // pull requests, but it is not itself a pull-request workflow.
    if (name === 'publish-main-pages.yml') continue;
    const source = await fs.readFile(new URL(name, workflows), 'utf8');
    if (name === 'measure-pages-candidate.yml' || name === 'measure-pages-stack.yml') {
      // Manual measurement has no admission/deployment authority. Its archive
      // uses the same pinned uploader but a non-deployment artifact name.
      assert.match(source, /workflow_dispatch:/u);
      assert.match(source, /github.ref == 'refs\/heads\/main'/u);
      assert.doesNotMatch(source, /^\s+(?:pull_request|pull_request_target|workflow_run|push):/mu);
      assert.doesNotMatch(
        source,
        /(?:contents|actions|pages|id-token):\s*write|environment:|actions\/deploy-pages@|pages-production/u,
      );
      if (name === 'measure-pages-candidate.yml') assert.match(source, /name: candidate-pages/u);
      else
        assert.match(
          source,
          /name: stack-pages-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/u,
        );
      assert.match(source, /MAX_PUBLISHED_BYTES: 980000000/u);
      assert.match(source, /group: pages-candidate-diagnostic/u);
      continue;
    }
    if (name === 'preserve-pages-recovery.yml') {
      // This manually dispatched post-deployment recovery operation is not PR
      // admission. Assert its separation instead of mistaking receipt names
      // and read-only artifact downloads for a Pages publishing dependency.
      assert.match(source, /workflow_dispatch:/u);
      assert.match(source, /github.ref == 'refs\/heads\/main'/u);
      assert.doesNotMatch(source, /^\s+(?:pull_request|pull_request_target|workflow_run|push):/mu);
      assert.doesNotMatch(
        source,
        /pages:\s*write|actions\/(?:upload-pages-artifact|deploy-pages)@/u,
      );
      continue;
    }
    assert.doesNotMatch(source, /github-pages|pages:\s*write/u, name);
    assert.doesNotMatch(source, /actions\/(?:upload-pages-artifact|deploy-pages)@/u, name);
    assert.doesNotMatch(source, /main-pages|stage-pages|pages-production/u, name);
  }
});

test('the optional Pages publisher cannot run for a pull request', async () => {
  const source = await fs.readFile(
    new URL('../.github/workflows/publish-main-pages.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /push:\n\s+branches: \[main\]/u);
  assert.match(source, /workflow_dispatch:/u);
  assert.doesNotMatch(source, /pull_request|pull_request_target|workflow_run/u);
});

test('the required exact-head source gate remains independent of hosted deployment', async () => {
  const source = await fs.readFile(
    new URL('../.github/workflows/deploy-pages.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /^name: Validate source for continuous main$/mu);
  for (const command of [
    'npm run validate',
    'node ../automation/scripts/run-test-shard.mjs --shard ${{ matrix.shard }}/4 --root .',
    'node .source-gate-automation/scripts/check-source-identity.mjs --root .',
  ])
    assert.ok(source.includes(command), command);
  assert.match(source, /  release-ready:\n/);
  assert.doesNotMatch(source, /release-train-boundary\.mjs public|public Pages|Main Pages/u);
});

test('auto-merge wakes from PR validation, never hosted deployment', async () => {
  const source = await fs.readFile(
    new URL('../.github/workflows/fastline-auto-merge.yml', import.meta.url),
    'utf8',
  );
  for (const name of [
    'Validate source for continuous main',
    'Appearance preview',
    'Industrial feature verification',
    'Company edition candidates',
    'Assemble full-test release evidence',
    'Community hosted acceptance',
    'Community MinIO recovery',
  ])
    assert.ok(source.includes(`- ${name}`), name);
  assert.doesNotMatch(source, /Build and deploy GitHub Pages|github-pages/u);
});

test('the package interface exposes no Pages build command', async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(Object.hasOwn(manifest.scripts, 'build:pages'), false);
});

test('the retired Pages playbook cannot prescribe a deployment path', async () => {
  const source = await fs.readFile(
    new URL('../.cursor/skills/deploy-release-pages/SKILL.md', import.meta.url),
    'utf8',
  );
  assert.match(source, /^# Retired GitHub Pages delivery$/mu);
  assert.match(
    source,
    /has no Pages deployment path\. Do not deploy, retry,\ndispatch, validate, or troubleshoot a Pages publication/u,
  );
  assert.doesNotMatch(source, /actions\/deploy-pages|upload-pages-artifact|pages:\s*write/u);
});

test('optional practice integrates the event workflow source while company admission retains the PR head', async () => {
  const source = await fs.readFile(new URL('company-edition-candidate.yml', workflows), 'utf8');
  const optional = source.split('\n  optional-practice:\n')[1]?.split('\n  candidate:\n')[0];
  const candidate = source.split('\n  candidate:\n')[1];
  assert.ok(optional && candidate);
  assert.match(optional, /^          ref: \$\{\{ github.sha \}\}$/mu);
  assert.doesNotMatch(optional, /^          ref: .*pull_request\.head\.sha/mu);
  assert.ok(optional.includes('test "$(git rev-parse HEAD)" = "$EVENT_SOURCE_REVISION"'));
  assert.ok(optional.includes('EVENT_SOURCE_REVISION: ${{ github.sha }}'));
  assert.ok(
    optional.includes('PR_HEAD_REVISION: ${{ github.event.pull_request.head.sha || github.sha }}'),
  );
  assert.ok(
    optional.includes(
      'name: optional-flight-integration-${{ github.sha }}-head-${{ github.event.pull_request.head.sha || github.sha }}',
    ),
  );
  assert.ok(optional.includes('npm run practice:test'));
  assert.doesNotMatch(optional, /continue-on-error: true|--if-present/u);
  assert.match(optional, /^    timeout-minutes: 30$/mu);
  assert.match(
    candidate,
    /^          ref: \$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}$/mu,
  );
  assert.ok(
    candidate.includes(
      'name: company-capacity-${{ github.event.pull_request.head.sha || github.sha }}',
    ),
  );
  assert.ok(
    candidate.includes(
      'name: company-candidate-${{ github.event.pull_request.head.sha || github.sha }}',
    ),
  );
});

test('focused matrix retains trusted automation, two workers per host, limits and failure evidence', async () => {
  const source = await fs.readFile(new URL('deploy-pages.yml', workflows), 'utf8');
  const shards = source.split('\n  focused_shards:\n')[1]?.split('\n  focused:\n')[0];
  const aggregate = source.split('\n  focused:\n')[1]?.split('\n  test:\n')[0];
  assert.ok(shards && aggregate);
  assert.match(shards, /timeout-minutes: 90/u);
  assert.match(
    shards,
    /fail-fast: false\n      max-parallel: 4\n      matrix: \$\{\{ fromJSON\(needs.preflight.outputs.focusedMatrix\) \}\}/u,
  );
  assert.match(shards, /needs: preflight/u);
  for (const condition of [
    "needs.preflight.result == 'success'",
    "needs.preflight.outputs.admission != 'hold'",
    "needs.preflight.outputs.focusedContract == 'revealline-focused-plan.v2'",
    "needs.preflight.outputs.focusedShards != '0'",
  ])
    assert.ok(shards.includes(condition), condition);
  for (const name of ['before', 'after'])
    assert.ok(shards.includes(`Verify exact tracked source ${name} commands`));
  assert.equal(
    shards.split('node ../automation/scripts/check-source-identity.mjs --root .').length - 1,
    2,
  );
  assert.match(shards, /EXPECTED_AUTOMATION: \$\{\{ github.workflow_sha \}\}/u);
  assert.match(shards, /ref: \$\{\{ github.workflow_sha \}\}\n          path: automation/u);
  assert.ok(shards.includes('--shard ${{ matrix.shard }}'));
  assert.ok(shards.includes('--plan-sha256 "$EXPECTED_PLAN_SHA256"'));
  assert.ok(shards.includes('--receipt "$RUNNER_TEMP/focused-shard/receipt.json"'));
  assert.ok(shards.includes('--admission "$RUNNER_TEMP/preflight-admission/admission.json"'));
  assert.match(shards, /set -euo pipefail\n          mkdir -p "\$RUNNER_TEMP\/focused-shard"/u);
  assert.ok(shards.includes('2>&1 | tee "$RUNNER_TEMP/focused-shard/output.log"'));
  assert.match(shards, /name: Retain available focused shard evidence\n        if: always\(\)/u);
  assert.ok(
    shards.includes(
      'name: focused-shard-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.shard }}',
    ),
  );
  assert.match(shards, /if-no-files-found: error/u);
  assert.doesNotMatch(
    shards + aggregate,
    /continue-on-error|if-no-files-found: (?:ignore|warn)|node source\/publishing\/focused-tests/u,
  );
  const runner = await fs.readFile(new URL('./focused-tests.mjs', import.meta.url), 'utf8');
  assert.match(
    runner,
    /runFocusedCommandsParallel\(partition\?\.commands \?\? execution.commands,\s*\{\s*root,\s*concurrency: 2/u,
  );
  assert.match(runner, /command\.timeoutMs \?\? timeoutMs/u);
  const compact = await fs.readFile(new URL('./focused-compact.mjs', import.meta.url), 'utf8');
  assert.match(compact, /execute\(commands, \{ root: options.root, concurrency: 2 \}\)/u);
});

test('positive-work aggregate preserves focused status and rejects nonsuccess or invalid matrix results', async () => {
  const { spawnSync } = await import('node:child_process');
  const source = await fs.readFile(new URL('deploy-pages.yml', workflows), 'utf8');
  const aggregate = source.split('\n  focused:\n')[1]?.split('\n  test:\n')[0];
  assert.match(aggregate, /always\(\) && github.event_name == 'pull_request'/u);
  for (const condition of [
    "needs.preflight.result == 'success'",
    "needs.preflight.outputs.admission != 'hold'",
    "needs.preflight.outputs.focusedContract == 'revealline-focused-plan.v2'",
    "needs.preflight.outputs.focusedShards != '0'",
  ])
    assert.ok(aggregate.includes(condition), condition);
  assert.match(aggregate, /needs: \[preflight, focused_shards\]/u);
  assert.match(aggregate, /timeout-minutes: 5/u);
  assert.match(aggregate, /ref: \$\{\{ github.workflow_sha \}\}\n          path: automation/u);
  assert.doesNotMatch(aggregate, /path: source|npm ci|working-directory: source/u);
  assert.match(aggregate, /SHARDS_RESULT: \$\{\{ needs.focused_shards.result \}\}/u);
  const guard = aggregate.match(/        run: \|\n([\s\S]*?)\n\n/u)?.[1];
  assert.ok(guard);
  for (const count of ['0', '1', '2', '3', '4', '5', ''])
    for (const status of ['success', 'failure', 'cancelled', 'skipped', '']) {
      const result = spawnSync('bash', ['-c', guard], {
        env: { ...process.env, SHARDS_RESULT: status, SHARDS_COUNT: count },
        timeout: 1000,
      });
      assert.equal(
        result.status === 0,
        /^[1-4]$/u.test(count) && status === 'success',
        `${count}/${status}`,
      );
    }
  assert.ok(
    aggregate.includes('pattern: focused-shard-${{ github.run_id }}-${{ github.run_attempt }}-*'),
  );
  assert.match(aggregate, /merge-multiple: false/u);
  assert.ok(aggregate.includes('focused-compact-cli.mjs verify'));
  assert.ok(aggregate.includes('--receipts "$RUNNER_TEMP/focused-shards"'));
  assert.ok(
    aggregate.includes('--prefix "focused-shard-${{ github.run_id }}-${{ github.run_attempt }}-"'),
  );
  assert.ok(aggregate.includes('--admission "$RUNNER_TEMP/preflight-admission/admission.json"'));
  assert.ok(aggregate.includes('--automation automation'));
  assert.ok(aggregate.includes('--plan-sha256 "$EXPECTED_PLAN_SHA256"'));
  const ready = source.split('\n  release-ready:\n')[1];
  assert.match(ready, /needs: \[preflight, focused_shards, focused, test, build\]/u);
  assert.match(ready, /FOCUSED_RESULT: \$\{\{ needs.focused.result \}\}/u);
  assert.ok(ready.includes('test "$FOCUSED_RESULT" = success'));
  assert.ok(ready.includes('test "$FOCUSED_CONTRACT" = revealline-focused-plan.v2'));
});
