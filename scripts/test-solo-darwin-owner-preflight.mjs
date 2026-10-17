import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';
import { assessDarwinOwnerCase, DARWIN_OWNER_PREFLIGHT } from './solo-darwin-owner-preflight.mjs';
const source = 'a'.repeat(40);
function fixture(id) {
  const spec = DARWIN_OWNER_PREFLIGHT.cases.find((row) => row.id === id);
  const observations = spec.roles.map((role, i) => ({
    format: 'SoloDarwinOwnerChildV1',
    sourceRevision: source,
    case: id,
    role,
    platform: 'darwin',
    architecture: 'x64',
    pid: 42 + i,
    ppid: i === 0 ? 12 : 41 + i,
    completed: id !== 'deadline',
    exitCode: 0,
    ...(id === 'tree' && i < 2 ? { childPid: 43 + i } : {}),
  }));
  const command = {
    argv: [
      '/node',
      '/tools/scripts/solo-darwin-owner-preflight.mjs',
      'child',
      id,
      '/owned/output',
      source,
    ],
    processInventory: {
      platform: 'darwin',
      format: 'SoloDarwinProcessInventoryV3',
      identityKind: 'private-unique-id-uint64',
    },
    initialLeaderCapture: 'direct-child-birth',
    ambiguous: [],
    survivors: [],
    cleanupUnconfirmed: false,
    peakRSS: 2048,
    timeoutMs: spec.timeoutMs,
    rssBytes: DARWIN_OWNER_PREFLIGHT.rssBytes,
    outputBytes: DARWIN_OWNER_PREFLIGHT.maximumLogBytes,
    status: id === 'deadline' ? 'failed' : 'closed',
    exitCode: id === 'deadline' ? null : 0,
    violation: id === 'deadline' ? 'deadline' : null,
    forcedCleanup: id === 'deadline',
    signal: id === 'deadline' ? 'SIGTERM' : null,
    tracked: observations.map((o) => ({
      pid: o.pid,
      ppid: o.ppid,
      birth: String(o.pid).padStart(20, '0'),
      identityKind: 'private-unique-id-uint64',
      parentUniqueId: String(o.ppid),
      inspectionIncomplete: false,
    })),
  };
  return { command, observations };
}
test('pure assessment admits only declared finite families and the explicit negative', () => {
  for (const id of ['leader', 'tree', 'deadline']) {
    const f = fixture(id);
    assert.equal(
      assessDarwinOwnerCase(id, f.command, f.observations, source).status,
      id === 'deadline' ? 'expected-negative-observed' : 'passed',
    );
  }
});
test('missing, incomplete or mismatched descendant authority rejects the complete family', () => {
  for (const change of [
    (f) => f.command.tracked.pop(),
    (f) => f.observations.pop(),
    (f) => f.command.tracked[1].ppid++,
    (f) => (f.command.tracked[1].birth = '0'),
    (f) => (f.command.tracked[1].birth = '18446744073709551616'),
    (f) => (f.command.tracked[1].parentUniqueId = '999'),
    (f) => (f.observations[1].pid = f.observations[0].pid),
    (f) => (f.command.tracked[1].inspectionIncomplete = true),
    (f) => f.observations[0].childPid++,
    (f) => (f.observations[1].sourceRevision = 'b'.repeat(40)),
    (f) => (f.observations[1].case = 'leader'),
    (f) => (f.observations[1].role = 'tree'),
    (f) => (f.observations[1].completed = false),
  ]) {
    const f = fixture('tree');
    change(f);
    assert.equal(assessDarwinOwnerCase('tree', f.command, f.observations, source).status, 'failed');
  }
});
test('native owner identity, bounds, residency and closure cannot be inferred from exit zero', () => {
  for (const change of [
    (f) => (f.command.processInventory.format = 'SoloDarwinProcessInventoryV1'),
    (f) => (f.command.processInventory.identityKind = 'timestamp'),
    (f) => (f.command.processInventory.platform = 'linux'),
    (f) => (f.command.argv[3] = 'browser'),
    (f) => (f.command.argv[5] = 'b'.repeat(40)),
    (f) => (f.command.initialLeaderCapture = 'not-observed'),
    (f) => (f.command.peakRSS = 0),
    (f) => (f.command.peakRSS = Infinity),
    (f) => f.command.timeoutMs++,
    (f) => f.command.rssBytes++,
    (f) => f.command.outputBytes++,
    (f) => f.command.ambiguous.push({ pid: 99 }),
    (f) => f.command.survivors.push({ pid: 99 }),
    (f) => (f.command.cleanupUnconfirmed = true),
    (f) => (f.command.forcedCleanup = true),
    (f) => (f.command.exitCode = 1),
  ]) {
    const f = fixture('leader');
    change(f);
    assert.equal(
      assessDarwinOwnerCase('leader', f.command, f.observations, source).status,
      'failed',
    );
  }
});
test('deadline control requires its precise failed owner and confirmed owned cleanup', () => {
  for (const change of [
    (f) => (f.command.status = 'closed'),
    (f) => (f.command.violation = 'rss-cap'),
    (f) => (f.command.forcedCleanup = false),
    (f) => (f.command.signal = 'SIGKILL'),
    (f) => (f.command.cleanupUnconfirmed = true),
  ]) {
    const f = fixture('deadline');
    change(f);
    assert.equal(
      assessDarwinOwnerCase('deadline', f.command, f.observations, source).status,
      'failed',
    );
  }
  assert.throws(() => assessDarwinOwnerCase('browser', {}, [], source));
});

test('one-shot non-browser workflow declares finite setup, native observation and upload separately', async () => {
  const completeWorkflow = await readFile(
    new URL('../.github/workflows/solo-darwin-owner-preflight-temporary.yml', import.meta.url),
    'utf8',
  );
  const workflow = completeWorkflow.split('\n  cocoa:\n')[0];
  assert.equal(
    workflow.match(/^    if: (.+)$/m)?.[1],
    "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
  );
  assert.match(workflow, /runs-on: macos-15-intel/);
  assert.match(workflow, /timeout-minutes: 24/);
  assert.match(workflow, /node-version: '22.13.1'/);
  assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
  const limits = [...workflow.matchAll(/timeout-minutes: (\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(limits, [24, 2, 1, 6, 2, 3, 6, 2]);
  assert.equal(
    limits.slice(1).reduce((a, b) => a + b, 0),
    22,
  );
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(
    workflow,
    /SOLO_RUN_DARWIN_OWNER_TESTS|playwright install|run-cocoa|run-backend/,
  );
  assert.match(workflow, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  const source = await readFile(
    new URL('./solo-darwin-owner-preflight.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /assert.equal\(process.env.GITHUB_ACTIONS, 'true'/);
  assert.match(source, /assert.equal\(process.arch, 'x64'/);
  assert(!source.includes('process.kill('));
  assert(!source.includes('playwright'));
  assert(!source.includes('startProductionPreview'));
});

test('tools sparse checkout contains complete static owner graph and actual dynamic/data roots', async () => {
  const root = new URL('../', import.meta.url),
    workflow = await readFile(
      new URL('.github/workflows/solo-darwin-owner-preflight-temporary.yml', root),
      'utf8',
    );
  const block = workflow.match(/          sparse-checkout: \|\n((?:            .+\n)+)/)?.[1];
  assert(block);
  const listed = block
      .trim()
      .split('\n')
      .map((s) => s.trim().slice(1)),
    declared = new Set(listed);
  assert.equal(listed.length, declared.size);
  assert.doesNotMatch(workflow, /\n +filter:/);
  assert.match(workflow, /sparse-checkout-cone-mode: false/);
  assert.match(workflow, /fetch-depth: 1/);
  const roots = [
    'scripts/solo-darwin-owner-preflight.mjs',
    'scripts/solo-darwin-process-inventory.mjs',
    'scripts/run-solo-remote-correctness.mjs',
    'scripts/test-solo-darwin-process-inventory.mjs',
    'scripts/test-solo-darwin-process-inventory-sdk.mjs',
    'scripts/test-solo-darwin-owner-preflight.mjs',
  ];
  const data = [
    'package.json',
    'package-lock.json',
    'game/vendor/lz-string-1.5.0.min.js',
    'game/vendor/LZ-STRING-LICENSE.txt',
    'scripts/solo-darwin-process-inventory.c',
    'docs/performance/fixtures/solo-darwin-inventory/696-v1-source.json',
    '.github/workflows/solo-darwin-owner-preflight-temporary.yml',
    '.github/workflows/solo-darwin-inventory-diagnostic-temporary.yml',
    '.github/workflows/solo-native-mp3-cocoa-temporary.yml',
  ];
  const visited = new Set();
  async function visit(path) {
    if (visited.has(path)) return;
    visited.add(path);
    assert(declared.has(path), 'Missing source ' + path);
    const url = new URL(path, root);
    const tree = parse(await readFile(url, 'utf8'), {
      sourceType: 'module',
      ecmaVersion: 'latest',
    });
    for (const n of tree.body)
      if (
        ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(n.type) &&
        n.source?.value.startsWith('.')
      ) {
        const d = new URL(n.source.value, url);
        assert(d.href.startsWith(root.href));
        await visit(decodeURIComponent(d.href.slice(root.href.length)));
      }
  }
  for (const path of roots) await visit(path);
  for (const path of data) {
    assert(declared.has(path), 'Missing data ' + path);
    await readFile(new URL(path, root));
  }
  assert(visited.size > 100);
  assert(!declared.has('node_modules'));
  assert(listed.length < 200);
});

test('successor workflow requires every exact one-shot condition before 7c7', async () => {
  const text = await readFile(
    new URL('../.github/workflows/solo-darwin-owner-preflight-temporary.yml', import.meta.url),
    'utf8',
  );
  const expected =
    "    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'";
  const check = (value) => {
    assert.deepEqual(
      value.split('\n').filter((s) => s.startsWith('    if: ')),
      [expected],
    );
    assert(!value.includes('workflow_dispatch'));
  };
  const preflight = text.split('\n  cocoa:\n')[0];
  check(preflight);
  for (const condition of [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
  ])
    assert.throws(() => check(preflight.replace(condition, 'true')));
  assert.throws(() => check(preflight.replace(expected, '')));
  assert.throws(() => check(preflight.replace(expected, '    if: true')));
});

test('Cocoa remains gated behind the exact successful prerequisite and keeps its independent owner gate', async () => {
  const whole = await readFile(
    new URL('../.github/workflows/solo-darwin-owner-preflight-temporary.yml', import.meta.url),
    'utf8',
  );
  const [preflight, cocoa] = whole.split('\n  cocoa:\n');
  assert(cocoa);
  assert.match(cocoa, /^    needs: preflight\n/);
  assert.match(cocoa, /^    if: needs\.preflight\.result == 'success'/m);
  assert.doesNotMatch(cocoa.split('    steps:')[0], /always\(|continue-on-error/);
  assert.match(preflight, /owner-source: \$\{\{ steps.owner-proof.outputs.source \}\}/);
  assert.match(preflight, /owner-status: \$\{\{ steps.owner-proof.outputs.status \}\}/);
  assert.match(
    preflight,
    /owner-report-sha256: \$\{\{ steps.owner-proof.outputs.reportSha256 \}\}/,
  );
  assert.match(preflight, /owner-report-bytes: \$\{\{ steps.owner-proof.outputs.reportBytes \}\}/);
  assert.match(
    preflight,
    /set -euo pipefail\n          node scripts\/solo-darwin-owner-preflight.mjs run/,
  );
  const limits = [...cocoa.matchAll(/timeout-minutes: (\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(limits, [28, 2, 1, 1, 2, 2, 5, 12, 1]);
  assert.equal(
    limits.slice(1).reduce((a, b) => a + b, 0),
    26,
  );
  assert(
    cocoa.indexOf('Retain the exact successful prerequisite') < cocoa.indexOf('Compile the exact'),
  );
  assert(
    cocoa.indexOf('Retain the exact successful prerequisite') <
      cocoa.indexOf('Install exact Cocoa WebKit'),
  );
  for (const field of ['SOURCE', 'REPORT_SHA256', 'REPORT_BYTES', 'STATUS'])
    assert(cocoa.includes('PRIOR_OWNER_' + field));
  assert.match(cocoa, /run: node scripts\/solo-native-mp3-control.mjs run-cocoa/);
  assert.match(cocoa, /solo-native-mp3-prerequisite.json/);
  assert.match(cocoa, /if: always\(\)/);
  assert.match(cocoa, /playwright@1\.62\.1/);
  assert.doesNotMatch(cocoa, /workflow_dispatch|workflow_run|game-cli\.mjs build|--with-deps/);
});

test('the actual prerequisite publisher re-assesses all three cases and exact sources before producing outputs', async () => {
  const whole = await readFile(
    new URL('../.github/workflows/solo-darwin-owner-preflight-temporary.yml', import.meta.url),
    'utf8',
  );
  const code = whole
    .split('          // BEGIN OWNER HANDOFF ADMISSION\n')[1]
    .split('          // END OWNER HANDOFF ADMISSION')[0];
  const admit = Function(
    'assert',
    'assessDarwinOwnerCase',
    `return (${code.trim()})`,
  )(assert, assessDarwinOwnerCase);
  const sources = [{ path: 'scripts/fixture.mjs', bytes: 2, sha256: '1'.repeat(64) }];
  const complete = () => ({
    format: 'SoloDarwinNonBrowserOwnerPreflightV1',
    sourceRevision: source,
    platform: 'darwin',
    architecture: 'x64',
    status: 'passed',
    sources: structuredClone(sources),
    ownershipQualification: false,
    browserObservations: 0,
    mediaObservations: 0,
    performanceQualification: false,
    cases: ['leader', 'tree', 'deadline'].map((id) => {
      const f = fixture(id),
        assessment = assessDarwinOwnerCase(id, f.command, f.observations, source);
      return { id, ...f, assessment, status: assessment.status };
    }),
  });
  assert.equal(admit(complete(), source, sources), true);
  for (const change of [
    (r) => (r.status = 'failed'),
    (r) => (r.sourceRevision = 'b'.repeat(40)),
    (r) => (r.platform = 'linux'),
    (r) => (r.architecture = 'arm64'),
    (r) => (r.failure = 'partial'),
    (r) => (r.browserObservations = 1),
    (r) => (r.mediaObservations = 1),
    (r) => (r.ownershipQualification = true),
    (r) => (r.performanceQualification = true),
    (r) => (r.sources[0].sha256 = '2'.repeat(64)),
    (r) => r.cases.pop(),
    (r) => r.cases.reverse(),
    (r) => (r.cases[0].status = 'withheld'),
    (r) => (r.cases[0].failure = 'failed readback'),
    (r) => r.cases[0].command.survivors.push({ pid: 99 }),
    (r) => r.cases[0].command.ambiguous.push({ pid: 99 }),
    (r) => (r.cases[0].command.cleanupUnconfirmed = true),
    (r) => (r.cases[0].command.peakRSS = 0),
    (r) => r.cases[1].observations.pop(),
    (r) => (r.cases[2].command.violation = 'rss-cap'),
    (r) => (r.cases[2].command.signal = 'SIGKILL'),
    (r) => r.cases[0].assessment.failures.push('altered'),
  ]) {
    const report = complete();
    change(report);
    assert.throws(() => admit(report, source, sources));
  }
});

test('dependent Cocoa checkout preserves the original closure and includes its current immutable owner witness', async () => {
  const root = new URL('../', import.meta.url);
  const original = await readFile(
    new URL('.github/workflows/solo-native-mp3-cocoa-temporary.yml', root),
    'utf8',
  );
  const whole = await readFile(
    new URL('.github/workflows/solo-darwin-owner-preflight-temporary.yml', root),
    'utf8',
  );
  const cocoa = whole.split('\n  cocoa:\n')[1];
  const selected = (text) =>
    text
      .match(/          sparse-checkout: \|\n((?:            .+\n)+)/)[1]
      .trim()
      .split('\n')
      .map((line) => line.trim().slice(1));
  const expected = [
    ...selected(original),
    '.github/workflows/solo-darwin-inventory-diagnostic-temporary.yml',
    'docs/performance/fixtures/solo-darwin-inventory/696-v1-source.json',
  ].sort();
  const check = (paths) => {
    assert.equal(paths.length, new Set(paths).size);
    assert.deepEqual([...paths].sort(), expected);
  };
  const actual = selected(cocoa);
  check(actual);
  const preflight = selected(whole.split('\n  cocoa:\n')[0]);
  const requireTestInputs = (paths) => {
    assert.equal(paths.length, new Set(paths).size);
    for (const path of actual)
      assert(paths.includes(path), 'Preflight test reads missing Cocoa input: ' + path);
  };
  requireTestInputs(preflight);
  for (const path of actual)
    assert.throws(() => requireTestInputs(preflight.filter((item) => item !== path)));
  for (const path of actual) assert((await readFile(new URL(path, root))).length > 0);
  for (const missing of [
    'scripts/solo-darwin-process-inventory.c',
    'scripts/solo-native-mp3-control.mjs',
    ...expected.filter((path) => path.includes('696-v1') || path.includes('inventory-diagnostic')),
  ])
    assert.throws(() => check(actual.filter((path) => path !== missing)));
  assert.doesNotMatch(whole, /continue-on-error/);
});

test('prospective Cocoa condition rejects every nonpositive or mismatched prerequisite result', async () => {
  const whole = await readFile(
    new URL('../.github/workflows/solo-darwin-owner-preflight-temporary.yml', import.meta.url),
    'utf8',
  );
  const cocoa = whole.split('\n  cocoa:\n')[1];
  const actual = cocoa.match(/^    if: (.+)$/m)[1];
  const expected =
    "needs.preflight.result == 'success' && needs.preflight.outputs.owner-status == 'passed' && needs.preflight.outputs.owner-source == github.event.pull_request.head.sha";
  assert.equal(actual, expected);
  const expression = actual
    .replaceAll('.outputs.owner-status', ".outputs['owner-status']")
    .replaceAll('.outputs.owner-source', ".outputs['owner-source']");
  const check = Function('needs', 'github', 'return ' + expression);
  const github = { event: { pull_request: { head: { sha: source } } } };
  const needs = () => ({
    preflight: { result: 'success', outputs: { 'owner-status': 'passed', 'owner-source': source } },
  });
  assert.equal(check(needs(), github), true);
  for (const result of ['failure', 'cancelled', 'skipped', '', null]) {
    const value = needs();
    value.preflight.result = result;
    assert.equal(check(value, github), false);
  }
  for (const status of ['failed', 'withheld', '', null]) {
    const value = needs();
    value.preflight.outputs['owner-status'] = status;
    assert.equal(check(value, github), false);
  }
  for (const revision of ['b'.repeat(40), '', null]) {
    const value = needs();
    value.preflight.outputs['owner-source'] = revision;
    assert.equal(check(value, github), false);
  }
  assert.equal(
    Function('needs', 'github', 'return false && (' + expression + ')')(needs(), github),
    false,
  );
});
