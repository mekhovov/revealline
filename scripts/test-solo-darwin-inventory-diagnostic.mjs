import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';

const workflow = await readFile(
  new URL('../.github/workflows/solo-darwin-inventory-diagnostic-temporary.yml', import.meta.url),
  'utf8',
);
const block = workflow
  .split("          node --input-type=module <<'NODE'\n")[1]
  ?.split('\n          NODE')[0];
assert(block);
const code = block.replace(/^          /gm, '');
const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
const body = ast.body
  .filter((node) => node.type !== 'ImportDeclaration')
  .map((node) => code.slice(node.start, node.end))
  .join('\n');
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
  'assert',
  'spawnSync',
  'mkdir',
  'writeFile',
  'readFile',
  'join',
  'createHash',
  'admitDarwinBuildReceipt',
  'process',
  body,
);
async function run(result) {
  const files = new Map(),
    calls = [],
    process = {
      env: { RUNNER_TEMP: '/owned', SOLO_TOOLING_REVISION: 'a'.repeat(40) },
      getuid: () => 501,
      geteuid: () => 501,
    };
  await execute(
    assert,
    (command, args, options) => {
      calls.push({ command, args, options });
      return calls.length === 1
        ? result
        : { status: 0, stdout: Buffer.from('42 1 42 0 protected-process\n') };
    },
    async () => {},
    async (path, bytes, options) => {
      assert.equal(options.flag, 'wx');
      assert(!files.has(path));
      files.set(path, Buffer.from(bytes));
    },
    async (path) => files.get(path),
    join,
    createHash,
    () => ({ receipt: { binary: { path: '/owned/inventory' } } }),
    process,
  );
  return {
    files,
    calls,
    exitCode: process.exitCode,
    report: JSON.parse(files.get('/owned/solo-darwin-inventory-diagnostic/report.json')),
  };
}
test('one-shot browser-free diagnostic retains finite setup, inspection and upload bounds', () => {
  assert.match(
    workflow,
    /if: github\.event\.pull_request\.number == 1544 && github\.event\.pull_request\.head\.repo\.full_name == github\.repository && github\.event\.action == 'synchronize' && github\.event\.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'/,
  );
  assert.match(workflow, /runs-on: macos-15/);
  assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert(!/npm |playwright|sudo |kill\(/i.test(code));
  assert.equal((workflow.match(/timeout-minutes:/g) ?? []).length, 6);
});
test('permission denial stays failed and preserves bounded diagnostic-only PID hint', async () => {
  const result = await run({
    status: 1,
    stdout: Buffer.from(''),
    stderr: Buffer.from(
      'Darwin inventory: process identity inspection (1) pid=42 selector=all result=-1 expected=136\n',
    ),
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, 'failed-inventory-retained');
  assert.equal(result.report.mediaObservations, 0);
  assert.equal(result.report.ownershipQualification, false);
  assert.equal(result.report.performanceQualification, false);
  assert.equal(result.report.deniedIdentityHint.identityAuthority, false);
  assert.equal(result.calls[0].command, '/owned/inventory');
  assert.deepEqual(result.calls[1].args, ['-p', '42', '-o', 'pid=,ppid=,pgid=,uid=,comm=']);
  assert.equal(result.calls[0].options.timeout, 3000);
  assert.equal(result.calls[1].options.timeout, 3000);
});
test('unknown failure without a PID remains failed without additional inspection', async () => {
  const result = await run({
    status: null,
    error: { code: 'ETIMEDOUT' },
    stderr: Buffer.from('incomplete'),
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.calls.length, 1);
  assert.equal(result.report.deniedIdentityHint, null);
});
test('complete inventory does not imply ownership or media qualification', async () => {
  const result = await run({ status: 0, stdout: Buffer.from('[]\n'), stderr: Buffer.alloc(0) });
  assert.equal(result.exitCode, undefined);
  assert.equal(result.report.status, 'inventory-observed');
  assert.equal(result.report.ownershipQualification, false);
  assert.equal(result.report.mediaObservations, 0);
});
test('full output cap fails even with a zero command exit', async () => {
  const result = await run({
    status: 0,
    stdout: Buffer.alloc(8 * 1024 * 1024 + 1),
    stderr: Buffer.alloc(0),
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.records[0].bytes, 8 * 1024 * 1024);
  assert.equal(result.report.records[0].capped, true);
});
