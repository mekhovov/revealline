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
  assert.match(aggregate, /!cancelled\(\) && github.event_name == 'pull_request'/u);
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
  assert.match(ready, /if: \$\{\{ !cancelled\(\) && github.event_name == 'pull_request' \}\}/u);
  assert.match(ready, /needs: \[preflight, focused_shards, focused, test, build\]/u);
  assert.match(ready, /FOCUSED_RESULT: \$\{\{ needs.focused.result \}\}/u);
  assert.ok(ready.includes('test "$FOCUSED_RESULT" = success'));
  assert.ok(ready.includes('test "$FOCUSED_CONTRACT" = revealline-focused-plan.v2'));
});
async function fieldKitArtifactFixture(t) {
  const os = await import('node:os');
  const path = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { promisify } = await import('node:util');
  const { execFile } = await import('node:child_process');
  const execute = promisify(execFile);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'field-kit-artifact-control-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const output = path.join(root, '.cache/field-kit-candidate');
  await fs.mkdir(path.join(output, 'compiled'), { recursive: true });
  const files = new Map([
    ['production.rltheme', Buffer.from('isolated ledger fixture')],
    ['compiled/manifest.json', Buffer.from('{"format":"fixture"}\n')],
    ['compiled/studio.json', Buffer.from('{"id":"fixture"}\n')],
  ]);
  for (const [name, bytes] of files) await fs.writeFile(path.join(output, name), bytes);
  const review = {
    format: 'revealline-field-kit-candidate.v1',
    source: {
      sourceRevision: 'a'.repeat(40),
      sourceTree: 'b'.repeat(40),
      aggregateSha256: 'c'.repeat(64),
    },
    files: [...files].map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })),
  };
  const save = () => fs.writeFile(path.join(output, 'review.json'), JSON.stringify(review));
  await save();
  const source = await fs.readFile(new URL('company-edition-candidate.yml', workflows), 'utf8');
  const match = source.match(
    /node --input-type=module <<'FIELD_KIT_ARTIFACT'\n([\s\S]+?)\n          FIELD_KIT_ARTIFACT/u,
  );
  assert(match, 'The exact workflow artifact verifier must be present.');
  const script = match[1].replace(/^          /gmu, '');
  const env = {
    ...process.env,
    EXPECTED_FIELD_KIT_SOURCE: 'a'.repeat(40),
    FIELD_KIT_SOURCE_TREE: 'b'.repeat(40),
    FIELD_KIT_WORKFLOW_SHA: 'a'.repeat(40),
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_REPOSITORY: 'mekhovov/revealline',
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '2',
  };
  return {
    root,
    output,
    review,
    env,
    save,
    path,
    run: () =>
      execute(process.execPath, ['--input-type=module', '-e', script], {
        cwd: root,
        env,
        timeout: 5000,
        maxBuffer: 256 * 1024,
      }),
    binding: () =>
      fs
        .readFile(path.join(root, '.cache/field-kit-candidate-binding.json'), 'utf8')
        .then(JSON.parse),
  };
}

test('Field Kit candidate is an optional exact-source manual step without adoption or new jobs', async () => {
  const source = await fs.readFile(new URL('company-edition-candidate.yml', workflows), 'utf8');
  assert.deepEqual(
    [...source.split('\njobs:\n')[1].matchAll(/^  ([a-z-]+):$/gmu)].map((m) => m[1]),
    ['optional-practice', 'candidate'],
  );
  assert.match(source, /field_kit_candidate:\n[\s\S]+?default: false\n        type: boolean/u);
  const candidate = source.split('\n  candidate:\n')[1];
  const route = candidate
    .split('      - name: Create and reproduce isolated Field Kit candidate\n')[1]
    .split('      - name: Report qualification boundary\n')[0];
  assert(route);
  const condition =
    "github.event_name == 'workflow_dispatch' && inputs.field_kit_candidate && github.repository == 'mekhovov/revealline'";
  assert.equal(route.split('if: ' + condition).length - 1, 2);
  assert.match(route, /steps\.field_kit_candidate\.outcome == 'success'/u);
  assert.match(source, /permissions:\n  contents: read/u);
  assert.match(candidate, /persist-credentials: false/u);
  assert.match(route, /EXPECTED_FIELD_KIT_SOURCE: \$\{\{ inputs\.field_kit_source_sha \}\}/u);
  assert.equal(
    route.split('test "$(git rev-parse HEAD)" = "$EXPECTED_FIELD_KIT_SOURCE"').length - 1,
    3,
  );
  assert.equal(
    route.split('test -z "$(git status --porcelain --untracked-files=all)"').length - 1,
    3,
  );
  for (const flag of ['--candidate', '--check-candidate'])
    assert.ok(
      route.includes(
        'timeout --signal=TERM --kill-after=30s 300s node scripts/produce-field-kit-theme.mjs ' +
          flag +
          ' .cache/field-kit-candidate',
      ),
    );
  assert.match(route, /timeout-minutes: 15/u);
  assert.match(route, /timeout-minutes: 5/u);
  assert.match(
    route,
    /name: field-kit-candidate-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/u,
  );
  assert.match(route, /if-no-files-found: error/u);
  assert.match(route, /retention-days: 14/u);
  assert.doesNotMatch(
    route,
    /--write|continue-on-error|git (?:add|commit|push)|download-artifact|contents: write/u,
  );
});

test('Field Kit artifact verifier binds exact bytes to source and run without granting approval', async (t) => {
  const fixture = await fieldKitArtifactFixture(t);
  await fixture.run();
  const binding = await fixture.binding();
  assert.equal(binding.sourceRevision, fixture.env.EXPECTED_FIELD_KIT_SOURCE);
  assert.equal(binding.sourceTree, fixture.env.FIELD_KIT_SOURCE_TREE);
  assert.equal(binding.runId, 123);
  assert.equal(binding.runAttempt, 2);
  assert.equal(binding.files.length, 4);
  assert.deepEqual(
    binding.files.map((file) => file.path),
    ['compiled/manifest.json', 'compiled/studio.json', 'production.rltheme', 'review.json'],
  );
  assert(binding.files.every((file) => /^[a-f0-9]{64}$/u.test(file.sha256)));
  assert.equal(
    binding.totalBytes,
    binding.files.reduce((sum, file) => sum + file.bytes, 0),
  );
  assert.equal(binding.productionAdopted, false);
  assert.equal(binding.continuationApproved, false);
  await assert.rejects(fixture.run(), /EEXIST/u);
});

test('Field Kit artifacts reject moved or foreign source and inconsistent file declarations', async (t) => {
  const changes = [
    (f) => {
      f.env.GITHUB_SHA = 'd'.repeat(40);
    },
    (f) => {
      f.env.FIELD_KIT_WORKFLOW_SHA = 'd'.repeat(40);
    },
    (f) => {
      f.env.GITHUB_REPOSITORY = 'foreign/repository';
    },
    (f) => {
      f.env.GITHUB_RUN_ATTEMPT = '0';
    },
    (f) => {
      f.review.source.sourceRevision = 'd'.repeat(40);
    },
    (f) => {
      f.review.source.sourceTree = 'd'.repeat(40);
    },
    (f) => {
      f.review.files[0].sha256 = 'd'.repeat(64);
    },
    (f) => {
      f.review.files[0].bytes++;
    },
    (f) => {
      f.review.files.push({ ...f.review.files[0] });
    },
    (f) => {
      f.review.files[0].path = '../production.rltheme';
    },
    (f) => {
      f.review.files[0].path = 'compiled/.hidden';
    },
    async (f) => {
      await fs.unlink(f.path.join(f.output, 'production.rltheme'));
    },
    async (f) => {
      await fs.writeFile(f.path.join(f.output, 'extra.json'), '{}');
    },
  ];
  for (const [index, change] of changes.entries())
    await t.test(String(index + 1), async (t) => {
      const fixture = await fieldKitArtifactFixture(t);
      await change(fixture);
      await fixture.save();
      await assert.rejects(fixture.run());
      await assert.rejects(fixture.binding(), /ENOENT/u);
    });
});

test('Field Kit artifact output caps and linked-file rejection apply before upload', async (t) => {
  const changes = [
    {
      name: 'linked candidate file',
      error: /Candidate links or special files are forbidden/u,
      mutate: async (f) => {
        await fs.unlink(f.path.join(f.output, 'production.rltheme'));
        await fs.symlink('compiled/studio.json', f.path.join(f.output, 'production.rltheme'));
      },
    },
    {
      name: 'oversized candidate file',
      error: /Candidate output exceeds its bound/u,
      mutate: async (f) => {
        const file = await fs.open(f.path.join(f.output, 'production.rltheme'), 'r+');
        try {
          await file.truncate(64 * 1024 * 1024 + 1);
        } finally {
          await file.close();
        }
      },
    },
    {
      name: 'oversized candidate receipt',
      error: /Invalid candidate receipt size or type/u,
      mutate: async (f) => {
        const file = await fs.open(f.path.join(f.output, 'review.json'), 'r+');
        try {
          await file.truncate(2 * 1024 * 1024 + 1);
        } finally {
          await file.close();
        }
      },
    },
    {
      name: 'too many candidate files',
      error: /Candidate file count exceeds its bound/u,
      mutate: async (f) => {
        while (f.review.files.length < 512)
          f.review.files.push({
            path: 'compiled/file-' + f.review.files.length,
            bytes: 0,
            sha256: 'd'.repeat(64),
          });
        await f.save();
      },
    },
    {
      name: 'aggregate candidate bytes exceed the upload bound',
      error: /Declared candidate output exceeds its bound/u,
      mutate: async (f) => {
        for (const file of f.review.files) file.bytes = 64 * 1024 * 1024;
        await f.save();
      },
    },
  ];
  for (const change of changes)
    await t.test(change.name, async (t) => {
      const fixture = await fieldKitArtifactFixture(t);
      await change.mutate(fixture);
      await assert.rejects(fixture.run(), change.error);
      await assert.rejects(fixture.binding(), /ENOENT/u);
    });
});

test('release policy rejects failed dependencies and keeps only explicit policy skips', async () => {
  const { spawnSync } = await import('node:child_process');
  const source = await fs.readFile(new URL('deploy-pages.yml', workflows), 'utf8');
  const ready = source.split('\n  release-ready:\n')[1];
  // The v2 job first verifies typed zero-work evidence. Select the final policy
  // step by name; the job's first run block is no longer the admission policy.
  const policy = ready?.split('      - name: Apply the selected PR gate policy\n')[1];
  const body = policy?.split('        run: |\n')[1]?.replace(/^ {10}/gmu, '');
  assert.ok(body);
  const passing = {
    ADMISSION: 'release',
    PREFLIGHT_RESULT: 'success',
    FOCUSED_CONTRACT: 'revealline-focused-plan.v2',
    FOCUSED_SHARDS: '1',
    FOCUSED_RESULT: 'success',
    SHARDS_RESULT: 'success',
    ZERO_FOCUSED_RESULT: 'skipped',
    BUILD_RESULT: 'success',
    FULL_CI: 'true',
    TEST_RESULT: 'success',
  };
  const check = (overrides, expected) => {
    // Exercise the workflow's actual gate body; this does not model GitHub's
    // scheduler or claim that cancellation was observed on a hosted runner.
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', body], {
      env: { ...process.env, ...passing, ...overrides },
      timeout: 1000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status === 0, expected, JSON.stringify(overrides));
  };
  check({}, true);
  // A dependency reporting cancelled while its workflow remains live must
  // still fail admission. Whole-workflow cancellation stops the job instead.
  for (const name of ['PREFLIGHT_RESULT', 'FOCUSED_RESULT', 'BUILD_RESULT', 'TEST_RESULT']) {
    for (const status of ['failure', 'cancelled', 'skipped', '']) {
      check({ [name]: status }, false);
    }
  }
  for (const ADMISSION of ['maintenance', 'scheduled']) {
    check({ ADMISSION, BUILD_RESULT: 'skipped', TEST_RESULT: 'skipped', FULL_CI: 'false' }, true);
  }
  check({ ADMISSION: 'release-evidence', TEST_RESULT: 'skipped', FULL_CI: 'false' }, true);
  // The former focusedRequired=false case is now authenticated zero work:
  // both jobs skip, but only an explicit successful v2 zero-work proof admits it.
  const zeroWork = {
    FOCUSED_SHARDS: '0',
    FOCUSED_RESULT: 'skipped',
    SHARDS_RESULT: 'skipped',
    ZERO_FOCUSED_RESULT: 'success',
  };
  check(zeroWork, true);
  check({ ...zeroWork, FOCUSED_RESULT: 'success' }, false);
  for (const FOCUSED_CONTRACT of ['', 'revealline-focused-plan.v1', 'unknown']) {
    check({ FOCUSED_CONTRACT }, false);
    check({ ...zeroWork, FOCUSED_CONTRACT }, false);
  }
  for (const FOCUSED_SHARDS of ['', '5', '-1', 'true']) {
    check({ FOCUSED_SHARDS }, false);
  }
  for (const SHARDS_RESULT of ['success', 'failure', 'cancelled', '']) {
    check({ ...zeroWork, SHARDS_RESULT }, false);
  }
  for (const ZERO_FOCUSED_RESULT of ['failure', 'cancelled', 'skipped', '']) {
    check({ ...zeroWork, ZERO_FOCUSED_RESULT }, false);
  }
  // The policy trusts nonzero aggregate success only after the existing worker
  // guard/receipt verifier; assert that those admission dependencies remain.
  assert.match(ready, /needs: \[preflight, focused_shards, focused, test, build\]/u);
  assert.match(ready, /ZERO_FOCUSED_RESULT: \$\{\{ steps\.zero_focused\.outcome \}\}/u);
  assert.ok(ready.includes('test "$WORKERS_RESULT" = skipped'));
  assert.ok(ready.includes('focused-compact-cli.mjs verify'));
  assert.ok(ready.includes('--plan-sha256 "$EXPECTED_PLAN_SHA256"'));
  check({ ADMISSION: 'hold' }, false);
  check({ ADMISSION: 'unknown' }, false);
  check({ TEST_RESULT: 'skipped', FULL_CI: 'false' }, true);
});

