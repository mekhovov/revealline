import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  writeQualificationReport,
  diagnoseQualificationFailure,
  finishQualification,
} from './shared-demo-browser-report.mjs';

const fullDisk = () => Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });
function memoryFiles({ failWrite = false, failRename = false, collide = false } = {}) {
  const files = new Map([['receipt.json', '{"complete":true,"samples":[1]}\n']]);
  const events = [];
  return {
    files,
    events,
    fs: {
      async writeFile(path, body, options) {
        events.push('write');
        assert.equal(options.flag, 'wx');
        if (collide) {
          files.set(path, 'another writer');
          throw Object.assign(new Error('Exists'), { code: 'EEXIST' });
        }
        files.set(path, failWrite ? body.slice(0, 9) : body);
        if (failWrite) throw fullDisk();
      },
      async rename(from, to) {
        events.push('rename');
        if (failRename) throw fullDisk();
        files.set(to, files.get(from));
        files.delete(from);
      },
      async rm(path) {
        events.push('remove');
        files.delete(path);
      },
    },
  };
}

for (const fault of ['failWrite', 'failRename']) {
  test(`atomic report preserves the last complete sample after ${fault}`, async () => {
    const fake = memoryFiles({ [fault]: true });
    const original = fake.files.get('receipt.json');
    await assert.rejects(
      writeQualificationReport(
        'receipt.json',
        { complete: false, samples: [1, 2] },
        { fs: fake.fs, token: 'fixture' },
      ),
      { code: 'ENOSPC' },
    );
    assert.equal(fake.files.get('receipt.json'), original);
    assert.deepEqual([...fake.files.keys()], ['receipt.json']);
    assert.equal(fake.events.at(-1), 'remove');
  });
}

test('atomic report replaces after a complete write and leaves colliding files alone', async () => {
  const good = memoryFiles();
  await writeQualificationReport(
    'receipt.json',
    { complete: true, samples: [2] },
    { fs: good.fs, token: 'fixture' },
  );
  assert.deepEqual(JSON.parse(good.files.get('receipt.json')), { complete: true, samples: [2] });
  assert.deepEqual(good.events, ['write', 'rename']);
  const collision = memoryFiles({ collide: true });
  await assert.rejects(
    writeQualificationReport('receipt.json', {}, { fs: collision.fs, token: 'fixture' }),
    { code: 'EEXIST' },
  );
  assert.equal(collision.files.size, 2);
  assert.deepEqual(collision.events, ['write']);
});

test('dead-page diagnostics and ENOSPC still close and emit the primary failure', async () => {
  const report = { complete: true, checks: [1] };
  const events = [];
  await diagnoseQualificationFailure({
    report,
    error: new Error('Primary replay assertion'),
    page: {
      locator: () => ({
        innerText: async () => {
          throw new Error('Page is closed');
        },
      }),
      screenshot: async () => {
        throw fullDisk();
      },
    },
    screenshotPath: 'unused.png',
  });
  const summary = await finishQualification({
    report,
    reportPath: 'receipt.json',
    browser: { close: async () => events.push('close') },
    writeReport: async () => {
      events.push('write');
      throw fullDisk();
    },
    emit: (value) => {
      events.push('stdout');
      assert.match(value.failure, /Primary replay assertion/);
    },
  });
  assert.deepEqual(events, ['close', 'write', 'stdout']);
  assert.equal(summary.complete, false);
  assert.equal(summary.browserCloseCompleted, true);
  assert.deepEqual(
    summary.secondaryDiagnostics.map(({ stage }) => stage),
    ['failure-body-text', 'failure-screenshot', 'final-report-write'],
  );
});

test('hung diagnostics are bounded and a failed close cannot suppress output', async () => {
  const report = { complete: false, checks: [] };
  await diagnoseQualificationFailure({
    report,
    error: new Error('Original failure'),
    page: {
      locator: () => ({ innerText: () => new Promise(() => {}) }),
      screenshot: async () => {},
    },
    screenshotPath: 'unused.png',
    timeoutMs: 5,
  });
  let written = false,
    emitted = false;
  const summary = await finishQualification({
    report,
    reportPath: 'receipt.json',
    browser: {
      close: async () => {
        throw new Error('Browser already disconnected');
      },
    },
    writeReport: async () => {
      written = true;
    },
    emit: () => {
      emitted = true;
    },
  });
  assert.equal(written, true);
  assert.equal(emitted, true);
  assert.equal(summary.browserCloseCompleted, false);
  assert.match(summary.failure, /Original failure/);
  assert.deepEqual(
    summary.secondaryDiagnostics.map(({ stage }) => stage),
    ['failure-body-text', 'browser-close'],
  );
});

test('a persistence-only failure fails qualification with bounded diagnostics', async () => {
  const summary = await finishQualification({
    report: { complete: true, checks: [] },
    reportPath: 'receipt.json',
    browser: { close: async () => {} },
    writeReport: async () => {
      throw new Error('ENOSPC '.repeat(2000));
    },
    emit: () => {},
  });
  assert.equal(summary.complete, false);
  assert.match(summary.failure, /could not be saved/);
  assert.ok(summary.secondaryDiagnostics[0].error.length <= 2048);
});

test('the actual CLI closes a launched browser when context setup fails', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'demo-harness-fixture-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runtime = join(directory, 'fake runtime.mjs');
  const reportPath = join(directory, 'report.json');
  const trace = join(directory, 'trace.txt');
  const executable = '/Fixture Browser.app/Contents/MacOS/Browser';
  await writeFile(
    runtime,
    `import { appendFile } from 'node:fs/promises';
export const chromium = { async launch(options) {
  if (options.executablePath !== ${JSON.stringify(executable)}) throw new Error('Executable path changed');
  await appendFile(${JSON.stringify(trace)}, 'launch\\n');
  return {
    async newContext() { throw new Error('Context setup failed'); },
    async close() { await appendFile(${JSON.stringify(trace)}, 'close\\n'); }
  };
}};`,
  );
  const result = await promisify(execFile)(
    process.execPath,
    [
      new URL('./qualify-shared-demo-browser.mjs', import.meta.url).pathname,
      `--runtime=${runtime}`,
      `--executable=${executable}`,
      `--report=${reportPath}`,
    ],
    { timeout: 5000 },
  ).then(
    () => assert.fail('The CLI must return a failure status.'),
    (error) => error,
  );
  assert.equal(result.code, 1);
  assert.equal(await readFile(trace, 'utf8'), 'launch\nclose\n');
  const summary = JSON.parse(result.stdout.trim());
  assert.match(summary.failure, /Context setup failed/);
  assert.equal(summary.browserCloseCompleted, true);
  assert.equal(JSON.parse(await readFile(reportPath, 'utf8')).complete, false);
});
