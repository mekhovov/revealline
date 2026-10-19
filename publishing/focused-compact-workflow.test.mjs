import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { POLICY_FILES } from './admission-binding.mjs';
import { focusedTestPlan } from './focused-tests.mjs';
const workflow = await fs.readFile(
  new URL('../.github/workflows/deploy-pages.yml', import.meta.url),
  'utf8',
);
const job = (name) => {
  const match = new RegExp(
    `^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z_-]*:|$(?![\\s\\S]))`,
    'mu',
  ).exec(workflow);
  assert.ok(match, `${name} missing`);
  return match[1];
};

test('every new planner and workflow regression is explicitly registered for affected policy paths', async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL('./focused-test-map.json', import.meta.url), 'utf8'),
  );
  const suites = [
    'focused-shard-plan',
    'focused-git-inputs',
    'focused-execution-plan',
    'focused-compact',
    'focused-compact-cli',
    'focused-compact-integration',
    'focused-compact-workflow',
  ];
  for (const changed of [
    'publishing/focused-compact.mjs',
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/fastline-auto-merge.yml',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    const commands = plan.commands.filter((x) => x.id === 'publishing-controller');
    assert.equal(commands.length, 1);
    for (const suite of suites)
      assert.ok(commands[0].args.includes(`publishing/${suite}.test.mjs`), `${changed}: ${suite}`);
  }
});

test('focused matrix comes from the final preflight plan, never four fixed empty assignments', () => {
  const shards = job('focused_shards');
  assert.match(shards, /matrix: \$\{\{ fromJSON\(needs\.preflight\.outputs\.focusedMatrix\) \}\}/u);
  assert.match(shards, /needs\.preflight\.outputs\.focusedShards != '0'/u);
  assert.doesNotMatch(shards, /shard: \[1, 2, 3, 4\]/u);
  assert.match(shards, /max-parallel: 4/u);
  assert.match(shards, /timeout-minutes: 90/u);
  assert.match(shards, /npm ci --prefer-offline/u);
  assert.match(
    shards,
    /npm ci --prefix authoring\/fpv-worlds --ignore-scripts --include=dev --prefer-offline/u,
  );
  assert.match(shards, /--plan-sha256 "\$EXPECTED_PLAN_SHA256"/u);
});

test('all executable planner imports are bound and present in every trusted sparse checkout', () => {
  for (const file of [
    'focused-shard-plan.mjs',
    'focused-git-inputs.mjs',
    'focused-compact.mjs',
    'focused-compact-cli.mjs',
  ])
    assert.ok(POLICY_FILES.includes('publishing/' + file), file);
  for (const name of ['preflight', 'focused_shards', 'focused', 'release-ready'])
    for (const file of POLICY_FILES) assert.ok(job(name).includes(file), `${name}: ${file}`);
});

test('every workflow sparse checkout consuming admission policy contains the complete policy closure', async () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  let consumers = 0;
  for (const name of await fs.readdir(directory)) {
    if (!/\.ya?ml$/u.test(name)) continue;
    const source = await fs.readFile(new URL(name, directory), 'utf8');
    for (const match of source.matchAll(/sparse-checkout: \|\n((?:            [^\n]+\n)+)/gu)) {
      if (!match[1].includes('publishing/admission-binding.mjs')) continue;
      consumers++;
      const files = match[1].trim().split(/\s+/u);
      for (const file of POLICY_FILES) assert.ok(files.includes(file), `${name}: ${file}`);
    }
  }
  assert.equal(consumers, 5);
  const controller = await fs.readFile(new URL('fastline-auto-merge.yml', directory), 'utf8');
  assert.match(controller, /ref: main/u);
  assert.doesNotMatch(
    controller,
    /ref: .*pull_request|focused-compact-cli\.mjs (?:prepare|execute)/u,
  );
});

test('preflight reads only bounded source data and adds no install or candidate execution', () => {
  const preflight = job('preflight');
  assert.match(preflight, /path: focused-plan-inputs/u);
  for (const file of [
    'package.json',
    'package-lock.json',
    '.npmrc',
    'authoring/fpv-worlds/package.json',
    'authoring/fpv-worlds/package-lock.json',
    'authoring/fpv-worlds/.npmrc',
  ])
    assert.ok(preflight.includes('/' + file), file);
  assert.doesNotMatch(preflight, /run: npm|npm ci|working-directory: focused-plan-inputs/u);
  assert.match(preflight, /focused-compact-cli\.mjs prepare/u);
  assert.equal((preflight.match(/GH_TOKEN:/gu) || []).length, 1);
  assert.match(
    preflight,
    /focusedPlanSha256: \$\{\{ steps\.compact_plan\.outputs\.focusedPlanSha256 \}\}/u,
  );
});

test('zero work is authenticated inside existing release-ready without an extra focused runner', () => {
  const aggregate = job('focused'),
    ready = job('release-ready');
  assert.doesNotMatch(aggregate, /focusedRequired == 'true'/u);
  assert.match(aggregate, /WORKERS_RESULT: \$\{\{ needs\.focused_shards\.result \}\}/u);
  assert.match(
    aggregate,
    /EXPECTED_PLAN_SHA256: \$\{\{ needs\.preflight\.outputs\.focusedPlanSha256 \}\}/u,
  );
  assert.match(aggregate, /focused-compact-cli\.mjs verify/u);
  assert.match(aggregate, /needs\.preflight\.outputs\.focusedShards != '0'/u);
  assert.match(ready, /needs: \[preflight, focused_shards, focused, test, build\]/u);
  assert.match(ready, /WORKERS_RESULT: \$\{\{ needs\.focused_shards\.result \}\}/u);
  assert.match(
    ready,
    /EXPECTED_PLAN_SHA256: \$\{\{ needs\.preflight\.outputs\.focusedPlanSha256 \}\}/u,
  );
  assert.match(ready, /focused-compact-cli\.mjs verify/u);
  assert.ok(ready.includes('--receipts "$RUNNER_TEMP/focused-zero-receipts"'));
  assert.ok(ready.includes('--plan-sha256 "$EXPECTED_PLAN_SHA256"'));
  assert.doesNotMatch(ready, /npm ci|path: source|GH_TOKEN:|GITHUB_TOKEN:/u);
  assert.equal((ready.match(/needs\.preflight\.outputs\.focusedShards == '0'/gu) || []).length, 5);
  assert.match(ready, /test "\$FOCUSED_CONTRACT" = revealline-focused-plan\.v2/u);
  assert.match(ready, /test "\$FOCUSED_RESULT" = success/u);
  assert.match(ready, /test "\$FOCUSED_RESULT" = skipped/u);
  assert.match(ready, /ZERO_FOCUSED_RESULT: \$\{\{ steps\.zero_focused\.outcome \}\}/u);
  assert.match(ready, /if: always\(\) && github.event_name == 'pull_request'/u);
});

test('release-ready fails closed on unverified zero work, malformed plans and worker outcomes', () => {
  const guard = job('release-ready')
    .split('      - name: Apply the selected PR gate policy\n')[1]
    ?.match(
      /        run: \|\n([\s\S]*?)          if \[ "\$ADMISSION" = maintenance \]; then/u,
    )?.[1];
  assert.ok(guard);
  const base = {
    ADMISSION: 'maintenance',
    PREFLIGHT_RESULT: 'success',
    FOCUSED_CONTRACT: 'revealline-focused-plan.v2',
    FOCUSED_SHARDS: '0',
    FOCUSED_RESULT: 'skipped',
    SHARDS_RESULT: 'skipped',
    ZERO_FOCUSED_RESULT: 'success',
  };
  const accepts = (overrides) =>
    spawnSync('bash', ['-e', '-c', guard], {
      env: { ...process.env, ...base, ...overrides },
      timeout: 1000,
    }).status === 0;
  assert.equal(accepts({}), true);
  for (const key of ['PREFLIGHT_RESULT', 'FOCUSED_CONTRACT', 'ZERO_FOCUSED_RESULT'])
    for (const invalid of ['', 'failure', 'cancelled', 'skipped'])
      assert.equal(accepts({ [key]: invalid }), false, `${key}/${invalid}`);
  for (const key of ['FOCUSED_RESULT', 'SHARDS_RESULT'])
    for (const invalid of ['', 'failure', 'cancelled', 'success'])
      assert.equal(accepts({ [key]: invalid }), false, `${key}/${invalid}`);
  for (const count of ['1', '2', '3', '4']) {
    const nonzero = {
      FOCUSED_SHARDS: count,
      FOCUSED_RESULT: 'success',
      SHARDS_RESULT: 'success',
      ZERO_FOCUSED_RESULT: 'skipped',
    };
    assert.equal(accepts(nonzero), true);
    for (const bad of ['', 'failure', 'cancelled', 'skipped'])
      assert.equal(accepts({ ...nonzero, FOCUSED_RESULT: bad }), false, `${count}/${bad}`);
  }
  for (const invalid of ['', '00', '01', '5', '-1', '1.0'])
    assert.equal(accepts({ FOCUSED_SHARDS: invalid, FOCUSED_RESULT: 'success' }), false, invalid);
});
