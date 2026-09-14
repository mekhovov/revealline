import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('./run-test-shard.mjs', import.meta.url));

async function fixture(t) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'revealline-shard-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'selected source');
  const automation = path.join(directory, 'automation', 'scripts', 'run-test-shard.mjs');
  await mkdir(source);
  await mkdir(path.dirname(automation), { recursive: true });
  await writeFile(automation, await readFile(runner));
  await writeFile(
    path.join(path.dirname(automation), 'test-automation-only.mjs'),
    'throw new Error("Automation checkout must never supply game tests");\n',
  );
  const add = async (name, content) => {
    const destination = path.join(source, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  };
  const run = (args) =>
    spawnSync(process.execPath, [automation, ...args], {
      cwd: directory,
      env: { ...process.env, NODE_TEST_CONTEXT: undefined },
      encoding: 'utf8',
      timeout: 10000,
    });
  return { source, add, run };
}

test('an external runner partitions only the selected source across all five test roots', async (t) => {
  const { source, add, run } = await fixture(t);
  const expected = [
    'authoring/motion-lab/body.test.mjs',
    'game/test/alpha.test.mjs',
    'game/test/zeta.test.mjs',
    'platforms/desktop/test/window.test.mjs',
    'platforms/ios/test/bridge.test.mjs',
    'scripts/test-source.mjs',
  ];
  for (const name of expected) await add(name, 'throw new Error("List must not execute");\n');
  await add('game/test/helper.mjs', 'throw new Error("Helpers are not test entries");\n');
  await add('unselected/test-outside.mjs', 'throw new Error("Outside test roots");\n');
  const listed = [];
  for (let shard = 1; shard <= 4; shard += 1) {
    const result = run(['--shard', `${shard}/4`, '--root', source, '--list']);
    assert.equal(result.status, 0, result.stderr);
    const names = result.stdout.trim().split('\n').slice(1);
    assert.deepEqual(
      names,
      expected.filter((_, index) => index % 4 === shard - 1),
    );
    listed.push(...names);
  }
  assert.deepEqual(listed.sort(), expected);
  assert.equal(new Set(listed).size, expected.length);
});

test('an external runner executes imports and cwd from selected source and propagates failure', async (t) => {
  const { source, add, run } = await fixture(t);
  await add('game/test/helper.mjs', 'export const value = 42;\n');
  await add('marker.txt', 'selected immutable source\n');
  const body = [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { readFile } from 'node:fs/promises';",
    "import { value } from './helper.mjs';",
    "test('selected source context', async () => {",
    '  assert.equal(value, 42);',
    `  assert.equal(process.cwd(), ${JSON.stringify(source)});`,
    "  assert.equal(await readFile('marker.txt', 'utf8'), 'selected immutable source\\n');",
    '});',
    '',
  ].join('\n');
  await add('game/test/source.test.mjs', body);
  const passed = run(['--shard', '1/1', '--root', 'selected source']);
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);
  assert.match(passed.stdout, /selected source context/);
  assert.equal(await readFile(path.join(source, 'game/test/source.test.mjs'), 'utf8'), body);
  await add('scripts/test-failure.mjs', 'throw new Error("selected failure sentinel");\n');
  const failed = run(['--shard', '1/1', '--root', source]);
  assert.equal(failed.status, 1, failed.stderr || failed.stdout);
  assert.match(failed.stdout, /selected failure sentinel/);
});

test('invalid selected roots and arguments refuse before test execution', async (t) => {
  const { source, add, run } = await fixture(t);
  await add('scripts/test-sentinel.mjs', 'console.log("TEST_EXECUTED_SENTINEL");\n');
  for (const args of [
    ['--shard', '1/1', '--root'],
    ['--shard', '1/1', '--root', ''],
    ['--shard', '1/1', '--unknown', source],
    ['--shard', '0/4', '--root', source],
    ['--shard', '1/1', '--root', path.join(source, 'absent')],
    ['--shard', '1/1', '--root', path.join(source, 'scripts/test-sentinel.mjs')],
  ]) {
    const result = run(args);
    assert.equal(result.status, 1, result.stderr);
    assert.doesNotMatch(result.stdout, /TEST_EXECUTED_SENTINEL/);
  }
});
