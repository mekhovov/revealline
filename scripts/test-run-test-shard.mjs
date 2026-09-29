import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, symlink } from 'node:fs/promises';
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
  await add(
    'timings.json',
    JSON.stringify({
      schemaVersion: 1,
      sourceRevision: 'a'.repeat(40),
      nodeVersion: '20.19.5',
      durationsMs: { 'game/test/source.test.mjs': 1 },
    }),
  );
  const timed = run([
    '--shard',
    '1/1',
    '--root',
    'selected source',
    '--timings',
    path.join(source, 'timings.json'),
  ]);
  assert.equal(timed.status, 0, timed.stderr || timed.stdout);
  assert.match(timed.stdout, /selected source context/);
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

test('timed partition balances measured work without losing new files or admitting old files', async (t) => {
  const { source, add, run } = await fixture(t);
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
    (name) => `game/test/${name}.test.mjs`,
  );
  for (const name of names) await add(name, 'throw new Error("List must not execute");\n');
  const timings = {
    schemaVersion: 1,
    sourceRevision: 'a'.repeat(40),
    nodeVersion: '20.19.5',
    durationsMs: Object.fromEntries(
      names.slice(0, -1).map((name, index) => [name, index < 4 ? 100 : 1]),
    ),
  };
  timings.durationsMs['scripts/test-removed.mjs'] = 999999;
  const serialized = JSON.stringify(timings);
  await add('timings.json', serialized);
  const manifest = path.join(source, 'timings.json');
  const listed = [];
  const partitions = [];
  for (let shard = 1; shard <= 4; shard += 1) {
    const args = ['--shard', `${shard}/4`, '--root', source, '--timings', manifest, '--list'];
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const selected = result.stdout.trim().split('\n').slice(1);
    assert.deepEqual(run(args).stdout, result.stdout, 'assignment is repeatable');
    assert.equal(selected.length, 2);
    assert.ok(selected.includes(names[shard - 1]));
    partitions.push(selected);
    listed.push(...selected);
  }
  assert.deepEqual(listed.sort(), names);
  assert.equal(new Set(listed).size, names.length);
  assert.equal(await readFile(manifest, 'utf8'), serialized, 'timings remain immutable');
  assert.deepEqual(partitions, [
    [names[0], names[7]],
    [names[1], names[4]],
    [names[2], names[5]],
    [names[3], names[6]],
  ]);
});

test('timing inputs refuse malformed identities, unsafe paths and invalid durations before execution', async (t) => {
  const { source, add, run } = await fixture(t);
  await add('scripts/test-sentinel.mjs', 'console.log("TEST_EXECUTED_SENTINEL");\n');
  const base = {
    schemaVersion: 1,
    sourceRevision: 'b'.repeat(40),
    nodeVersion: 'v20.19.5',
    durationsMs: { 'scripts/test-sentinel.mjs': 1 },
  };
  const invalid = [
    null,
    { ...base, schemaVersion: 2 },
    { ...base, sourceRevision: 'moving-main' },
    { ...base, sourceRevision: ['b'.repeat(40)] },
    { ...base, nodeVersion: 'unknown' },
    { ...base, durationsMs: [] },
    { ...base, durationsMs: {} },
    ...[0, -1, '10', null, Infinity].map((duration) => ({
      ...base,
      durationsMs: { 'scripts/test-sentinel.mjs': duration },
    })),
    ...[
      '../scripts/test-escape.mjs',
      'scripts/../test-escape.mjs',
      'scripts//test-empty.mjs',
      'scripts/./test-dot.mjs',
      'scripts/test-\\escape.mjs',
      '/scripts/test-absolute.mjs',
      'other/test-outside.mjs',
      'scripts/helper.mjs',
    ].map((name) => ({
      ...base,
      durationsMs: { [name]: 1 },
    })),
    { ...base, durationsMs: { 'scripts/test-deleted.mjs': 1 } },
  ];
  for (const manifest of invalid) {
    await add('timings.json', JSON.stringify(manifest));
    const result = run([
      '--shard',
      '1/1',
      '--root',
      source,
      '--timings',
      path.join(source, 'timings.json'),
    ]);
    assert.equal(result.status, 1, result.stdout);
    assert.doesNotMatch(result.stdout, /TEST_EXECUTED_SENTINEL/);
  }
  await add('timings.json', '{');
  const malformed = run([
    '--shard',
    '1/1',
    '--root',
    source,
    '--timings',
    path.join(source, 'timings.json'),
  ]);
  assert.equal(malformed.status, 1);
  await add('timings.json', ' '.repeat(5 * 1024 * 1024 + 1));
  const oversized = run([
    '--shard',
    '1/1',
    '--root',
    source,
    '--timings',
    path.join(source, 'timings.json'),
  ]);
  assert.equal(oversized.status, 1);
  assert.match(oversized.stderr, /5 MiB/);
  await symlink(path.join(source, 'timings.json'), path.join(source, 'linked-timings.json'));
  const linked = run([
    '--shard',
    '1/1',
    '--root',
    source,
    '--timings',
    path.join(source, 'linked-timings.json'),
  ]);
  assert.equal(linked.status, 1);
  assert.match(linked.stderr, /regular file/);
  if (process.platform !== 'win32') {
    const fifo = path.join(source, 'timings-fifo');
    const made = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
    assert.equal(made.status, 0, made.stderr);
    const special = run(['--shard', '1/1', '--root', source, '--timings', fifo]);
    assert.equal(special.status, 1, 'special files must reject without hanging');
    assert.match(special.stderr, /regular file/);
  }
});

test('timed execution retains selected-source imports, failures and empty-shard refusal', async (t) => {
  const { source, add, run } = await fixture(t);
  await add('scripts/test-failure.mjs', 'throw new Error("TIMED_FAILURE_SENTINEL");\n');
  const manifest = path.join(source, 'timings.json');
  await add(
    'timings.json',
    JSON.stringify({
      schemaVersion: 1,
      sourceRevision: 'c'.repeat(40),
      nodeVersion: '20.19.5',
      durationsMs: { 'scripts/test-failure.mjs': 1 },
    }),
  );
  const failed = run(['--shard', '1/1', '--timings', manifest, '--root', source]);
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /TIMED_FAILURE_SENTINEL/);
  const empty = run(['--shard', '4/4', '--root', source, '--timings', manifest, '--list']);
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /has no test files/);
  for (const suffix of [
    ['--timings'],
    ['--timings', ''],
    ['--root', source, '--root', source],
    ['--timings', manifest, '--timings', manifest],
  ]) {
    const result = run(['--shard', '1/1', ...suffix]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  }
});

test('measured longest-first partition reduces a synthetic imbalance with identical coverage', async (t) => {
  const { source, add, run } = await fixture(t);
  const names = Array.from(
    { length: 16 },
    (_, index) => `scripts/test-${String(index).padStart(2, '0')}.mjs`,
  );
  const durationsMs = Object.fromEntries(
    names.map((name, index) => [name, index % 4 === 0 ? 100 : 1]),
  );
  for (const name of names) await add(name, 'throw new Error("List must not execute");\n');
  await add(
    'timings.json',
    JSON.stringify({
      schemaVersion: 1,
      sourceRevision: 'd'.repeat(40),
      nodeVersion: '20.19.5',
      durationsMs,
    }),
  );
  const maxLoad = (timed) => {
    const union = [];
    const loads = [];
    for (let shard = 1; shard <= 4; shard += 1) {
      const result = run([
        '--shard',
        `${shard}/4`,
        '--root',
        source,
        ...(timed ? ['--timings', path.join(source, 'timings.json')] : []),
        '--list',
      ]);
      assert.equal(result.status, 0, result.stderr);
      const selected = result.stdout.trim().split('\n').slice(1);
      union.push(...selected);
      loads.push(selected.reduce((sum, name) => sum + durationsMs[name], 0));
    }
    assert.deepEqual(union.sort(), names);
    return Math.max(...loads);
  };
  assert.equal(maxLoad(false), 400);
  assert.equal(maxLoad(true), 103);
  // This proves the scheduling algorithm only, not a hosted performance gain.
});
