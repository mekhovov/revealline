import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const workflows = new URL('../.github/workflows/', import.meta.url);

function assertSharedDemoBrowserWorkflow(source) {
  assert.match(source, /^  pull_request:$/mu);
  assert.doesNotMatch(source, /^\s+(?:pull_request_target|workflow_run|push):/mu);
  assert.match(source, /^permissions:\n  contents: read$/mu);
  assert.doesNotMatch(
    source,
    /permissions:\s*write-all|[\w-]+:\s*write\b|environment:|github-pages|actions\/(?:upload-pages-artifact|deploy-pages)@/u,
  );
  assert.match(source, /^      DEMO_HEAD: \$\{\{ github.event.pull_request.head.sha \}\}$/mu);
  assert.equal((source.match(/uses: actions\/checkout@/gu) ?? []).length, 1);
  assert.match(
    source,
    /^          ref: \$\{\{ github.event.pull_request.head.sha \}\}\n          persist-credentials: false$/mu,
  );
  assert.ok(source.includes('test "$(git rev-parse HEAD)" = "$DEMO_HEAD"'));
  assert.ok(source.includes('test -z "$(git status --porcelain --untracked-files=no)"'));
  assert.match(source, /^    timeout-minutes: 90$/mu);
  assert.ok(
    source.includes(
      'timeout --signal=TERM --kill-after=10s 11m node scripts/qualify-demo-main-pages.mjs --report=.cache/hosted-demo-browser/main-pages.json --preview-output=.cache/hosted-demo-emitted 2>&1 | head -c 4194305 > .cache/hosted-demo-browser/main-pages.log',
    ),
  );
  assert.ok(
    source.includes('test "$(wc -c < .cache/hosted-demo-browser/main-pages.log)" -le 4194304'),
  );
  const phases = [
    ...source.matchAll(
      /^        timeout-minutes: (\d+)\n        run: >-\n((?:          .+\n)+)/gmu,
    ),
  ];
  assert.equal(phases.length, 3);
  for (const [index, phase] of ['matrix', 'additional', 'offline'].entries()) {
    const [, minutes, command] = phases[index];
    assert.equal(Number(minutes), phase === 'offline' ? 11 : 32);
    assert.ok(command.includes('python3 scripts/qualify-shared-demo-hosted-browser.py'));
    for (const argument of [
      '--node="$(command -v node)" --runtime="$DEMO_PLAYWRIGHT"',
      '--head="$DEMO_HEAD" --base="$DEMO_BASE" --fingerprint="$DEMO_RUNTIME_SHA"',
      '--emitted-preview=.cache/hosted-demo-emitted',
      `--report=.cache/hosted-demo-browser/${phase}.json --phase=${phase}`,
    ])
      assert.ok(command.includes(argument), argument);
  }
  assert.match(
    source,
    /name: Retain exact-source reports and bounded incomplete diagnostics\n        if: \$\{\{ always\(\) \}\}\n        timeout-minutes: 3\n        uses: actions\/upload-artifact@[a-f0-9]{40}/u,
  );
  assert.ok(
    source.includes(
      'name: shared-demo-browser-${{ github.event.pull_request.head.sha }}-${{ github.run_attempt }}',
    ),
  );
  assert.match(
    source,
    /path: \|\n            \.cache\/hosted-demo-browser\/\n            \.cache\/hosted-demo-emitted\/manifest.json/u,
  );
  assert.match(source, /include-hidden-files: true\n          if-no-files-found: error/u);
  assert.match(source, /retention-days: 7/u);
  assert.doesNotMatch(source, /continue-on-error: true|if-no-files-found: (?:ignore|warn)/u);
}

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
    let pagesReferences = source;
    if (name === 'shared-demo-browser-qualification.yml') {
      // This canonical builder only captures local emitted bytes for real browser
      // admission. Permit its exact command/report names after verifying that
      // the workflow has no publishing authority; retain the generic Pages ban.
      assertSharedDemoBrowserWorkflow(source);
      for (const localPath of [
        'scripts/qualify-demo-main-pages.mjs',
        '.cache/hosted-demo-browser/main-pages.json',
        '.cache/hosted-demo-browser/main-pages.log',
      ])
        pagesReferences = pagesReferences.replaceAll(localPath, 'local-demo-capture');
    }
    assert.doesNotMatch(pagesReferences, /main-pages|stage-pages|pages-production/u, name);
  }
});

test('shared demo browser admission rejects publishing authority and weakened qualification', async () => {
  const source = await fs.readFile(
    new URL('shared-demo-browser-qualification.yml', workflows),
    'utf8',
  );
  assertSharedDemoBrowserWorkflow(source);
  for (const [before, after] of [
    ['contents: read', 'contents: write'],
    ['    runs-on: ubuntu-24.04', '    environment: production\n    runs-on: ubuntu-24.04'],
    ['actions/upload-artifact@', 'actions/upload-pages-artifact@'],
    ['ref: ${{ github.event.pull_request.head.sha }}', 'ref: main'],
    ['--preview-output=.cache/hosted-demo-emitted', '--preview-output=public'],
    ['--phase=offline', '--phase=matrix'],
    ['if: ${{ always() }}', 'if: ${{ success() }}'],
    ['if-no-files-found: error', 'if-no-files-found: warn'],
  ]) {
    assert.ok(source.includes(before), before);
    assert.throws(() => assertSharedDemoBrowserWorkflow(source.replace(before, after)), before);
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
    /fail-fast: false\n      max-parallel: 4\n      matrix:\n        shard: \[1, 2, 3, 4\]/u,
  );
  assert.match(shards, /needs: preflight/u);
  for (const condition of [
    "needs.preflight.result == 'success'",
    "needs.preflight.outputs.admission != 'hold'",
    "needs.preflight.outputs.focusedRequired == 'true'",
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
  assert.ok(shards.includes('--shard ${{ matrix.shard }}/4'));
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
});

test('aggregate preserves the required focused status and rejects any nonsuccess matrix result', async () => {
  const { spawnSync } = await import('node:child_process');
  const source = await fs.readFile(new URL('deploy-pages.yml', workflows), 'utf8');
  const aggregate = source.split('\n  focused:\n')[1]?.split('\n  test:\n')[0];
  assert.match(aggregate, /always\(\) && github.event_name == 'pull_request'/u);
  for (const condition of [
    "needs.preflight.result == 'success'",
    "needs.preflight.outputs.admission != 'hold'",
    "needs.preflight.outputs.focusedRequired == 'true'",
  ])
    assert.ok(aggregate.includes(condition), condition);
  assert.match(aggregate, /needs: \[preflight, focused_shards\]/u);
  assert.match(aggregate, /timeout-minutes: 5/u);
  assert.match(aggregate, /ref: \$\{\{ github.workflow_sha \}\}\n          path: automation/u);
  assert.doesNotMatch(aggregate, /path: source|npm ci|working-directory: source/u);
  assert.match(aggregate, /SHARDS_RESULT: \$\{\{ needs.focused_shards.result \}\}/u);
  const guard = aggregate.match(/        run: (test "\$SHARDS_RESULT" = success)\n/u)?.[1];
  assert.ok(guard);
  for (const status of ['success', 'failure', 'cancelled', 'skipped', '']) {
    const result = spawnSync('bash', ['-c', guard], {
      env: { ...process.env, SHARDS_RESULT: status },
      timeout: 1000,
    });
    assert.equal(result.status === 0, status === 'success', status);
  }
  assert.ok(
    aggregate.includes('pattern: focused-shard-${{ github.run_id }}-${{ github.run_attempt }}-*'),
  );
  assert.match(aggregate, /merge-multiple: false/u);
  assert.ok(aggregate.includes('--verify-shards "$RUNNER_TEMP/focused-shards"'));
  assert.ok(
    aggregate.includes(
      '--artifact-prefix "focused-shard-${{ github.run_id }}-${{ github.run_attempt }}-"',
    ),
  );
  assert.ok(aggregate.includes('--admission "$RUNNER_TEMP/preflight-admission/admission.json"'));
  assert.ok(aggregate.includes('--test-policy automation/publishing/test-policy.json'));
  const ready = source.split('\n  release-ready:\n')[1];
  assert.match(ready, /needs: \[preflight, focused, test, build\]/u);
  assert.match(ready, /FOCUSED_RESULT: \$\{\{ needs.focused.result \}\}/u);
  assert.ok(ready.includes('test "$FOCUSED_RESULT" = success'));
  assert.ok(ready.includes('test "$FOCUSED_RESULT" = skipped'));
});
