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
      format: 'SoloDarwinProcessInventoryV2',
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

test('held non-browser workflow declares finite setup, native observation and upload separately', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-darwin-owner-preflight-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /    if: false/);
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
