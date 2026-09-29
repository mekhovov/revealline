import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const converter = fileURLToPath(new URL('./convert-test-timings.mjs', import.meta.url));
const runner = fileURLToPath(new URL('./run-test-shard.mjs', import.meta.url));
const reporter = fileURLToPath(new URL('./file-timing-reporter.mjs', import.meta.url));
const hash = (data) => createHash('sha256').update(data).digest('hex');
const names = [
  'authoring/motion-lab/body.test.mjs',
  'game/test/game.test.mjs',
  'platforms/desktop/test/window.test.mjs',
  'platforms/ios/test/bridge.test.mjs',
  'scripts/test-empty.mjs',
  'scripts/test-script.mjs',
];
const measured = Object.fromEntries(names.map((name, index) => [name, 10.125 + index]));

async function fixture(t, executable = false) {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-timing-convert-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  const evidence = path.join(directory, 'evidence');
  await fs.mkdir(evidence);
  await fs.mkdir(root);
  for (const name of names) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(
      path.join(root, name),
      name.endsWith('test-empty.mjs')
        ? ''
        : executable
          ? "import test from 'node:test';\ntest('real telemetry fixture', () => {});\n"
          : 'throw new Error("Converter/list must never execute tests");\n',
    );
  }
  await fs.writeFile(path.join(root, 'game/test/helper.mjs'), '// Not a test entry.\n');
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-q');
  git('add', '.');
  git(
    '-c',
    'user.name=Timing Fixture',
    '-c',
    'user.email=timing@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'fixture',
  );
  const sourceRevision = git('rev-parse', 'HEAD');
  const sourceTree = git('rev-parse', 'HEAD^{tree}');
  const tools = { runnerSha256: 'a'.repeat(64), reporterSha256: 'b'.repeat(64) };
  const environment = {
    platform: 'linux',
    arch: 'x64',
    runnerImage: 'ubuntu-24.04',
    runnerImageVersion: '20260907.300.1',
    availableParallelism: 4,
    testConcurrency: 'node-default',
  };
  const receipt = {
    schemaVersion: 1,
    repository: 'mekhovov/revealline',
    sourceRevision,
    sourceTree,
    inventorySha256: hash(names.join('\n') + '\n'),
    nodeVersion: 'v20.19.6',
    run: {
      id: '1001',
      attempt: '1',
      headSha: sourceRevision,
      workflowSha: sourceRevision,
      workflowPath: '.github/workflows/deploy-pages.yml',
      status: 'completed',
      conclusion: 'success',
    },
    environment,
    tools,
    shards: [],
  };
  const streams = [];
  for (let index = 1; index <= 4; index++) {
    const selected = names.filter((_, offset) => offset % 4 === index - 1);
    streams.push([
      {
        schemaVersion: 1,
        type: 'metadata',
        sourceRevision,
        nodeVersion: receipt.nodeVersion,
        root: '/home/runner/work/source',
        runnerCwd: '/home/runner/work/source',
        runId: receipt.run.id,
        runAttempt: receipt.run.attempt,
        platform: environment.platform,
        arch: environment.arch,
        availableParallelism: environment.availableParallelism,
        selectedFiles: selected,
        measurement: 'node-file-container-duration-ms',
      },
      ...selected.map((file) => ({
        schemaVersion: 1,
        type: 'file',
        file,
        durationMs: measured[file],
        passed: true,
      })),
      {
        schemaVersion: 1,
        type: 'summary',
        supported: true,
        usable: true,
        expectedFileCount: selected.length,
        measuredFileCount: selected.length,
        missingFiles: [],
        extraFiles: [],
        errors: [],
      },
    ]);
    receipt.shards.push({
      index,
      jobId: String(2000 + index),
      status: 'completed',
      conclusion: 'success',
      exitCode: 0,
      sourceRoot: '/home/runner/work/source',
      runnerCwd: '/home/runner/work/source',
      sourceChecks: {
        before: { revision: sourceRevision, tree: sourceTree, clean: true },
        after: { revision: sourceRevision, tree: sourceTree, clean: true },
      },
      tools: { ...tools },
      artifact: { id: String(3000 + index), path: 'shard-' + index + '.jsonl' },
    });
  }
  const receiptPath = path.join(evidence, 'receipt.json');
  const output = path.join(directory, 'profile.json');
  async function save() {
    for (let index = 0; index < 4; index++) {
      const bytes = streams[index].map((row) => JSON.stringify(row)).join('\n') + '\n';
      const artifact = receipt.shards[index].artifact;
      await fs.writeFile(path.join(evidence, artifact.path), bytes);
      artifact.bytes = Buffer.byteLength(bytes);
      artifact.sha256 = hash(bytes);
    }
    await saveReceipt();
  }
  async function saveReceipt() {
    await fs.writeFile(receiptPath, JSON.stringify(receipt));
  }
  function run(out = output, overrides = {}) {
    const result = spawnSync(
      process.execPath,
      [
        converter,
        '--root',
        overrides.root ?? root,
        '--receipt',
        overrides.receipt ?? receiptPath,
        '--out',
        out,
      ],
      {
        encoding: 'utf8',
        timeout: 15000,
        env: { ...process.env, NODE_TEST_CONTEXT: undefined },
      },
    );
    assert.ifError(result.error);
    return result;
  }
  await save();
  return {
    root,
    evidence,
    directory,
    receiptPath,
    output,
    receipt,
    streams,
    save,
    saveReceipt,
    run,
    git,
  };
}
async function refused(f, pattern) {
  const result = f.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  if (pattern) assert.match(result.stderr, pattern);
  await assert.rejects(fs.stat(f.output), { code: 'ENOENT' });
}

test('four complete streams produce deterministic exact weights accepted by the existing runner', async (t) => {
  const f = await fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const bytes = await fs.readFile(f.output);
  const profile = JSON.parse(bytes);
  assert.deepEqual(profile, {
    schemaVersion: 1,
    sourceRevision: f.receipt.sourceRevision,
    nodeVersion: 'v20.19.6',
    durationsMs: measured,
  });
  assert.match(JSON.parse(result.stdout).evidence, /not cryptographic authentication/);
  const second = path.join(f.directory, 'second.json');
  f.receipt.shards.reverse();
  await f.saveReceipt();
  assert.equal(f.run(second).status, 0);
  assert.deepEqual(await fs.readFile(second), bytes);
  const all = [];
  for (let shard = 1; shard <= 4; shard++) {
    const result = spawnSync(
      process.execPath,
      [runner, '--shard', shard + '/4', '--root', f.root, '--timings', f.output, '--list'],
      { encoding: 'utf8', timeout: 15000 },
    );
    assert.equal(result.status, 0, result.stderr);
    all.push(...result.stdout.trim().split('\n').slice(1));
  }
  assert.deepEqual(all.sort(), names);
  assert.equal(new Set(all).size, names.length);
});

test('actual reporter streams convert without replacing genuine file durations or runtime identity', async (t) => {
  const f = await fixture(t, true);
  f.receipt.nodeVersion = process.version;
  Object.assign(f.receipt.environment, {
    platform: process.platform,
    arch: process.arch,
    availableParallelism: os.availableParallelism(),
    runnerImage: 'local-fixture-only',
    runnerImageVersion: os.release(),
    testConcurrency: '2',
  });
  f.receipt.tools = {
    runnerSha256: hash(await fs.readFile(runner)),
    reporterSha256: hash(await fs.readFile(reporter)),
  };
  const expected = {};
  for (const shard of f.receipt.shards) {
    const selected = names.filter((_, index) => index % 4 === shard.index - 1);
    shard.sourceRoot = f.root;
    shard.runnerCwd = f.root;
    shard.tools = { ...f.receipt.tools };
    const output = path.join(f.evidence, shard.artifact.path);
    const result = spawnSync(
      process.execPath,
      [
        '--test',
        '--test-concurrency=2',
        '--test-reporter=tap',
        '--test-reporter-destination=stdout',
        '--test-reporter=' + reporter,
        '--test-reporter-destination=' + output,
        ...selected,
      ],
      {
        cwd: f.root,
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          NODE_TEST_CONTEXT: undefined,
          REVEALLINE_TIMING_SOURCE_REVISION: f.receipt.sourceRevision,
          REVEALLINE_TIMING_SELECTED_FILES: JSON.stringify(selected),
          REVEALLINE_TIMING_ROOT: f.root,
          GITHUB_RUN_ID: f.receipt.run.id,
          GITHUB_RUN_ATTEMPT: f.receipt.run.attempt,
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# fail 0/);
    const bytes = await fs.readFile(output);
    shard.artifact.bytes = bytes.length;
    shard.artifact.sha256 = hash(bytes);
    const rows = bytes.toString().trim().split('\n').map(JSON.parse);
    assert.equal(rows.at(-1).usable, true);
    for (const row of rows.filter((row) => row.type === 'file'))
      expected[row.file] = row.durationMs;
  }
  await f.saveReceipt();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const profile = JSON.parse(await fs.readFile(f.output));
  assert.equal(profile.nodeVersion, process.version);
  assert.deepEqual(profile.durationsMs, expected);
});

test('existing output and output symlinks are never overwritten', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run().status, 0);
  const before = await fs.readFile(f.output);
  assert.equal(f.run().status, 1);
  assert.deepEqual(await fs.readFile(f.output), before);
  const link = path.join(f.directory, 'linked.json');
  await fs.symlink(f.output, link);
  assert.equal(f.run(link).status, 1);
  assert.deepEqual(await fs.readFile(f.output), before);
});

test('cancelled, failed, mixed-attempt and incomplete source/tool receipt evidence refuses output', async (t) => {
  const f = await fixture(t);
  const original = structuredClone(f.receipt);
  const mutations = [
    (r) => {
      r.schemaVersion = 2;
    },
    (r) => {
      r.run.status = 'in_progress';
    },
    (r) => {
      r.run.conclusion = 'cancelled';
    },
    (r) => {
      r.run.headSha = 'f'.repeat(40);
    },
    (r) => {
      r.run.attempt = '2';
    },
    (r) => {
      r.run.workflowSha = 'main';
    },
    (r) => {
      r.shards[0].conclusion = 'failure';
    },
    (r) => {
      r.shards[0].exitCode = 1;
    },
    (r) => {
      r.shards[0].sourceChecks.after.clean = false;
    },
    (r) => {
      r.shards[0].sourceChecks.before.tree = 'f'.repeat(40);
    },
    (r) => {
      r.shards[0].tools.reporterSha256 = 'c'.repeat(64);
    },
    (r) => {
      r.environment.runnerImage = '';
    },
    (r) => {
      r.shards[1].jobId = r.shards[0].jobId;
    },
    (r) => {
      r.shards[1].artifact.id = r.shards[0].artifact.id;
    },
    (r) => {
      r.shards[1].index = r.shards[0].index;
    },
    (r) => {
      r.shards.pop();
    },
  ];
  for (const mutate of mutations) {
    Object.assign(f.receipt, structuredClone(original));
    mutate(f.receipt);
    await f.saveReceipt();
    await refused(f);
  }
});

test('raw runtime/run/environment mismatch or unusable verdict cannot become a profile', async (t) => {
  const f = await fixture(t);
  const original = structuredClone(f.streams[0]);
  const mutations = [
    (rows) => {
      rows[0].nodeVersion = 'v22.22.2';
    },
    (rows) => {
      rows[0].sourceRevision = 'f'.repeat(40);
    },
    (rows) => {
      rows[0].runId = '9999';
    },
    (rows) => {
      rows[0].runAttempt = '2';
    },
    (rows) => {
      rows[0].availableParallelism = 8;
    },
    (rows) => {
      rows[0].root = '/different/source';
    },
    (rows) => {
      rows[0].measurement = 'sum-of-test-cases';
    },
    (rows) => {
      rows.at(-1).supported = false;
    },
    (rows) => {
      rows.at(-1).usable = false;
    },
    (rows) => {
      rows.at(-1).errors = ['skipped-or-todo-cases'];
    },
    (rows) => {
      rows.at(-1).missingFiles = ['scripts/test-missing.mjs'];
    },
    (rows) => {
      rows.at(-1).measuredFileCount = 1;
    },
    (rows) => {
      rows[1].passed = false;
    },
    (rows) => {
      rows[1].schemaVersion = 2;
    },
  ];
  for (const mutate of mutations) {
    f.streams[0] = structuredClone(original);
    mutate(f.streams[0]);
    await f.save();
    await refused(f);
  }
});

test('duplicate, missing, extra, escaping and nonpositive file measurements refuse output', async (t) => {
  const f = await fixture(t);
  const original = structuredClone(f.streams[0]);
  const mutations = [
    (rows) => {
      rows.splice(1, 0, rows[1]);
    },
    (rows) => {
      rows.splice(1, 1);
    },
    (rows) => {
      rows[0].selectedFiles.push(rows[0].selectedFiles[0]);
    },
    (rows) => {
      rows[1].file = '../outside.test.mjs';
    },
    (rows) => {
      rows[1].file = 'scripts/test-untracked.mjs';
    },
    ...[0, -1, '10', null, 1e400].map((duration) => (rows) => {
      rows[1].durationMs = duration;
    }),
  ];
  for (const mutate of mutations) {
    f.streams[0] = structuredClone(original);
    mutate(f.streams[0]);
    await f.save();
    await refused(f);
  }
});

test('separately usable but overlapping streams and an omitted full-source file refuse output', async (t) => {
  const f = await fixture(t);
  f.streams[1] = structuredClone(f.streams[0]);
  await f.save();
  await refused(f, /multiple shard streams/);
  const g = await fixture(t);
  const rows = g.streams[0];
  rows[0].selectedFiles.pop();
  rows.splice(2, 1);
  rows.at(-1).expectedFileCount--;
  rows.at(-1).measuredFileCount--;
  await g.save();
  await refused(g, /cover every source test/);
});

test('full-checkout source identity, inventory and bytes are independently verified', async (t) => {
  const f = await fixture(t);
  f.receipt.sourceTree = 'f'.repeat(40);
  for (const shard of f.receipt.shards)
    for (const check of Object.values(shard.sourceChecks)) check.tree = f.receipt.sourceTree;
  await f.saveReceipt();
  await refused(f, /Checkout tree/);
  const g = await fixture(t);
  await fs.writeFile(path.join(g.root, names[0]), '// changed source\n');
  await refused(g, /Test bytes/);
  const h = await fixture(t);
  await fs.rm(path.join(h.root, names[0]));
  await refused(h, /Materialized test inventory/);
  const i = await fixture(t);
  await fs.writeFile(path.join(i.root, 'scripts/test-extra.mjs'), '// untracked\n');
  await refused(i, /Materialized test inventory/);
  const j = await fixture(t);
  j.git('config', 'core.sparseCheckout', 'true');
  await refused(j, /Sparse checkouts/);
});

test('artifact bytes, truncation, record order and UTF8 must remain exact', async (t) => {
  const f = await fixture(t);
  const artifact = f.receipt.shards[0].artifact;
  const filename = path.join(f.evidence, artifact.path);
  const original = await fs.readFile(filename);
  const samples = [
    original.subarray(0, original.length - 1),
    Buffer.from(original.toString().split('\n').slice(0, -2).join('\n') + '\n'),
    Buffer.from('\n' + original.toString()),
    Buffer.from(original.toString().split('\n').filter(Boolean).reverse().join('\n') + '\n'),
    Buffer.from([0xff, 0x0a]),
    Buffer.from('{malformed}\n'),
  ];
  await fs.appendFile(filename, 'tampered');
  await refused(f, /digest mismatch/);
  for (const bytes of samples) {
    await fs.writeFile(filename, bytes);
    artifact.bytes = bytes.length;
    artifact.sha256 = hash(bytes);
    await f.saveReceipt();
    await refused(f);
  }
});

test('unsafe artifact paths, symlink inputs and overlarge inputs are refused before writes', async (t) => {
  const f = await fixture(t);
  const artifact = f.receipt.shards[0].artifact;
  const original = artifact.path;
  for (const name of [
    '../escape.jsonl',
    '/tmp/escape.jsonl',
    'a/../shard-1.jsonl',
    'a\\bad.jsonl',
  ]) {
    artifact.path = name;
    await f.saveReceipt();
    await refused(f);
  }
  artifact.path = 'alias.jsonl';
  await fs.symlink(path.join(f.evidence, original), path.join(f.evidence, artifact.path));
  await f.saveReceipt();
  await refused(f, /ordinary non-symlink/);
  await fs.symlink(f.evidence, path.join(f.evidence, 'aliasdir'));
  artifact.path = 'aliasdir/' + original;
  await f.saveReceipt();
  await refused(f, /ordinary non-symlink directory/);
  const linkedReceipt = path.join(f.directory, 'receipt-link.json');
  await fs.symlink(f.receiptPath, linkedReceipt);
  assert.equal(f.run(f.output, { receipt: linkedReceipt }).status, 1);
  const huge = path.join(f.directory, 'huge.json');
  await fs.writeFile(huge, ' '.repeat(5 * 1024 * 1024 + 1));
  assert.equal(f.run(f.output, { receipt: huge }).status, 1);
  await assert.rejects(fs.stat(f.output), { code: 'ENOENT' });
});
