import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fileTimingReporter from './file-timing-reporter.mjs';

const reporter = fileURLToPath(new URL('./file-timing-reporter.mjs', import.meta.url));
const revision = 'a'.repeat(40);
const eventReporter =
  'data:text/javascript,' +
  encodeURIComponent(
    'export default async function* (stream) { for await (const event of stream) yield JSON.stringify(event) + "\\n"; }',
  );
const jsonLines = (text) => text.trim().split('\n').map(JSON.parse);

async function fixture(t, sources) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'revealline-file-timing-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(sources))
    await writeFile(path.join(root, name), content);
  return root;
}

function run(root, files, options = {}) {
  const env = {
    ...process.env,
    REVEALLINE_TIMING_SOURCE_REVISION: revision,
    REVEALLINE_TIMING_SELECTED_FILES: JSON.stringify(files),
    REVEALLINE_TIMING_ROOT: root,
    ...options.env,
  };
  // A nested subprocess must use its own top-level test runner.
  delete env.NODE_TEST_CONTEXT;
  const args = ['--test', '--test-concurrency=2', '--test-reporter=tap'];
  if (!options.tapOnly)
    args.push(
      '--test-reporter-destination=stdout',
      '--test-reporter=' + reporter,
      '--test-reporter-destination=' + path.join(root, 'timings.jsonl'),
      '--test-reporter=' + eventReporter,
      '--test-reporter-destination=' + path.join(root, 'events.jsonl'),
    );
  const result = spawnSync(process.execPath, [...args, ...files], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.ifError(result.error);
  return result;
}
const recordsAt = async (root) =>
  jsonLines(await readFile(path.join(root, 'timings.jsonl'), 'utf8'));
const single = "import test from 'node:test';\ntest('one', () => {});\n";

test('real file containers retain nested/concurrent time, module startup, normal TAP and exact inventory', async (t) => {
  const root = await fixture(t, {
    'nested.test.mjs':
      "import test from 'node:test';\nimport { setTimeout as delay } from 'node:timers/promises';\nawait delay(40);\ntest('parent', { concurrency: true }, async (t) => {\nawait Promise.all([t.test('first', () => delay(60)), t.test('second', () => delay(60))]);\n});\n",
    'other.test.mjs':
      "import test from 'node:test';\nimport { setTimeout as delay } from 'node:timers/promises';\ntest('other concurrent file', () => delay(30));\n",
  });
  const result = run(root, ['nested.test.mjs', 'other.test.mjs']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /TAP version 13/);
  assert.match(result.stdout, /# pass 4/);
  assert.match(result.stdout, /# fail 0/);
  const records = await recordsAt(root);
  const events = jsonLines(await readFile(path.join(root, 'events.jsonl'), 'utf8'));
  assert.equal(records[0].sourceRevision, revision);
  assert.equal(records[0].nodeVersion, process.version);
  assert.equal(
    records.at(-1).usable,
    true,
    JSON.stringify({
      summary: records.at(-1),
      fileEvents: events.filter((event) => event.data?.line === 1 && event.data?.column === 1),
    }),
  );
  const measured = records.filter((record) => record.type === 'file');
  assert.deepEqual(
    measured.map((record) => record.file),
    ['nested.test.mjs', 'other.test.mjs'],
  );
  for (const record of measured) {
    const completions = events.filter(
      (event) =>
        event.type === 'test:complete' &&
        event.data.file === path.join(root, record.file) &&
        path.resolve(root, event.data.name) === event.data.file &&
        event.data.line === 1 &&
        event.data.column === 1 &&
        event.data.nesting === 0,
    );
    assert.equal(completions.length, 1);
    assert.equal(record.durationMs, completions[0].data.details.duration_ms);
    assert.equal(record.passed, true);
  }
  const parent = events.find(
    (event) => event.type === 'test:complete' && event.data.name === 'parent',
  );
  assert(
    measured[0].durationMs > parent.data.details.duration_ms + 20,
    'module startup is included',
  );
});

test('failing assertions preserve ordinary failing exit and TAP, invalidating qualification', async (t) => {
  const root = await fixture(t, {
    'failure.test.mjs':
      "import test from 'node:test';\ntest('expected failure', () => { throw new Error('fixture failure'); });\n",
  });
  const normal = run(root, ['failure.test.mjs'], { tapOnly: true });
  const profiled = run(root, ['failure.test.mjs']);
  assert.equal(normal.status, 1);
  assert.equal(profiled.status, normal.status);
  assert.match(profiled.stdout, /not ok 1 - expected failure/);
  const records = await recordsAt(root);
  assert.equal(records.find((record) => record.type === 'file').passed, false);
  assert.equal(records.at(-1).usable, false);
  assert(records.at(-1).errors.includes('failed-file'));
});

test('empty files remain measured and nonzero subprocess exits remain failing', async (t) => {
  const root = await fixture(t, {
    'empty.test.mjs': '// No declarations.\n',
    'exit.test.mjs': 'process.exitCode = 3;\n',
  });
  assert.equal(run(root, ['empty.test.mjs', 'exit.test.mjs']).status, 1);
  const records = await recordsAt(root);
  assert.equal(records.filter((record) => record.type === 'file').length, 2);
  assert.equal(records.at(-1).usable, false);
});

test('missing source and selected inventory cannot silently qualify the cwd checkout', async (t) => {
  const root = await fixture(t, { 'one.test.mjs': single });
  assert.equal(
    run(root, ['one.test.mjs'], {
      env: { REVEALLINE_TIMING_SOURCE_REVISION: '', REVEALLINE_TIMING_SELECTED_FILES: '' },
    }).status,
    0,
  );
  const records = await recordsAt(root);
  assert.equal(records[0].sourceRevision, null);
  assert.equal(records.at(-1).usable, false);
  assert(records.at(-1).errors.includes('missing-or-invalid-source-revision'));
  assert(records.at(-1).errors.includes('missing-or-invalid-selected-inventory'));
});

test('inventory mismatch records missing and extra files without hiding tests', async (t) => {
  const root = await fixture(t, { 'one.test.mjs': single });
  assert.equal(
    run(root, ['one.test.mjs'], {
      env: { REVEALLINE_TIMING_SELECTED_FILES: '["missing.test.mjs"]' },
    }).status,
    0,
  );
  const summary = (await recordsAt(root)).at(-1);
  assert.equal(summary.usable, false);
  assert.deepEqual(summary.missingFiles, ['missing.test.mjs']);
  assert.deepEqual(summary.extraFiles, ['one.test.mjs']);
});

test('skipped cases cannot qualify a full sample', async (t) => {
  const root = await fixture(t, {
    'skip.test.mjs': "import test from 'node:test';\ntest.skip('not run', () => {});\n",
  });
  assert.equal(run(root, ['skip.test.mjs']).status, 0);
  const summary = (await recordsAt(root)).at(-1);
  assert.equal(summary.usable, false);
  assert(summary.errors.includes('skipped-or-todo-cases'));
});

test('malformed revision and duplicate or escaping inventory bindings remain unqualified', async (t) => {
  const root = await fixture(t, { 'one.test.mjs': single });
  for (const selected of ['["one.test.mjs","one.test.mjs"]', '["../one.test.mjs"]', '{}']) {
    assert.equal(
      run(root, ['one.test.mjs'], {
        env: {
          REVEALLINE_TIMING_SOURCE_REVISION: 'main',
          REVEALLINE_TIMING_SELECTED_FILES: selected,
        },
      }).status,
      0,
    );
    const records = await recordsAt(root);
    assert.equal(records[0].sourceRevision, null);
    assert.equal(records.at(-1).usable, false);
    assert(records.at(-1).errors.includes('missing-or-invalid-source-revision'));
    assert(records.at(-1).errors.includes('missing-or-invalid-selected-inventory'));
  }
});

async function synthetic(events) {
  const records = [];
  for await (const chunk of fileTimingReporter(events)) records.push(JSON.parse(chunk));
  return records;
}
const container = (file, duration = 25) =>
  ['test:enqueue', 'test:dequeue', 'test:complete'].map((type) => ({
    type,
    data: {
      nesting: 0,
      line: 1,
      column: 1,
      name: file,
      file,
      details: { duration_ms: duration, passed: true },
    },
  }));

test('Node22 relative container names bind to the same exact absolute file, not a similarly named case', async () => {
  const file = path.join(process.cwd(), 'relative.test.mjs');
  const events = container(file).map((event) => ({
    ...event,
    data: { ...event.data, name: 'relative.test.mjs' },
  }));
  const records = await synthetic(events);
  assert.deepEqual(
    records.filter((record) => record.type === 'file'),
    [
      {
        schemaVersion: 1,
        type: 'file',
        file: 'relative.test.mjs',
        durationMs: 25,
        passed: true,
      },
    ],
  );
  const mismatched = await synthetic(
    events.map((event) => ({
      ...event,
      data: { ...event.data, name: 'different.test.mjs' },
    })),
  );
  assert.equal(mismatched.filter((record) => record.type === 'file').length, 0);
  assert.equal(mismatched.at(-1).supported, false);
});

test('missing file containers are unsupported; case durations are never summed', async () => {
  const records = await synthetic([
    {
      type: 'test:complete',
      data: {
        nesting: 0,
        line: 2,
        column: 1,
        name: 'case',
        file: '/tmp/case.test.mjs',
        details: { duration_ms: 999 },
      },
    },
  ]);
  assert.equal(records.filter((record) => record.type === 'file').length, 0);
  assert.equal(records.at(-1).supported, false);
  assert(records.at(-1).errors.includes('unsupported-no-file-container-events'));
});

test('duplicate, unordered, incomplete or invalid-duration containers emit no duration', async () => {
  const file = path.join(process.cwd(), 'fixture.test.mjs');
  for (const events of [
    [...container(file), ...container(file)],
    container(file).reverse(),
    container(file).slice(1),
    container(file, NaN),
    container(file, 0),
    container(file, -1),
  ]) {
    const records = await synthetic(events);
    assert.equal(records.filter((record) => record.type === 'file').length, 0);
    assert.equal(records.at(-1).usable, false);
    assert.equal(records.at(-1).supported, false);
  }
});
