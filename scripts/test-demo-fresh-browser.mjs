import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

for (const mode of ['survival', 'sim']) {
  test(`${mode} Fresh CLI closes its browser and saves one failed receipt when context setup fails`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'demo-fresh-fixture-'));
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
    async newContext() { throw new Error('Fresh context setup failed'); },
    async close() { await appendFile(${JSON.stringify(trace)}, 'close\\n'); }
  };
}};`,
    );
    const result = await promisify(execFile)(
      process.execPath,
      [
        new URL(`./qualify-${mode}-fresh-browser.mjs`, import.meta.url).pathname,
        `--runtime=${runtime}`,
        `--executable=${executable}`,
        `--report=${reportPath}`,
      ],
      { timeout: 5000 },
    ).then(
      () => assert.fail('Failed setup must return a failure status.'),
      (error) => error,
    );
    assert.equal(result.code, 1);
    assert.equal(await readFile(trace, 'utf8'), 'launch\nclose\n');
    const saved = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(saved.complete, false);
    assert.equal(saved.browserCloseAttempted, true);
    assert.equal(saved.browserCloseCompleted, true);
    assert.match(saved.failure, /Fresh context setup failed/);
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).complete, false);
    assert.equal(JSON.parse(lines[0]).browserCloseCompleted, true);
  });
}

test('Survival Fresh CLI waits for the app API after its button becomes visible', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'demo-fresh-readiness-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runtime = join(directory, 'fake runtime.mjs');
  const reportPath = join(directory, 'report.json');
  const trace = join(directory, 'trace.txt');
  await writeFile(
    runtime,
    `import { appendFile } from 'node:fs/promises';
const record = value => appendFile(${JSON.stringify(trace)}, value + '\\n');
let ready = false;
const page = {
  on() {}, async goto() {},
  getByLabel() { return { async fill() {} }; },
  getByRole() { return { async click() {} }; },
  locator() { return { waitFor: () => record('button-visible'), async innerText() { return ''; } }; },
  async waitForFunction(predicate) {
    globalThis.RevealLineOverflight = { snapshot() {} };
    if (predicate() !== true) throw new Error('Expected the native API readiness predicate');
    delete globalThis.RevealLineOverflight;
    ready = true;
    await record('api-ready');
  },
  async evaluate() {
    await record('snapshot');
    if (!ready) throw new Error('Snapshot queried before native API readiness');
    throw new Error('Expected end of startup fixture');
  },
  async screenshot() {},
};
export const chromium = { async launch() { return {
  async newContext() { return {
    async exposeBinding() {}, async route() {}, async addInitScript() {},
    async newPage() { return page; },
  }; },
  close: () => record('close'),
}; } };`,
  );
  const result = await promisify(execFile)(
    process.execPath,
    [
      new URL('./qualify-survival-fresh-browser.mjs', import.meta.url).pathname,
      `--runtime=${runtime}`,
      `--report=${reportPath}`,
    ],
    { timeout: 5000 },
  ).then(
    () => assert.fail('The deliberately stopped fixture must return a failure status.'),
    (error) => error,
  );
  assert.equal(result.code, 1);
  assert.equal(await readFile(trace, 'utf8'), 'button-visible\napi-ready\nsnapshot\nclose\n');
  const saved = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.match(saved.failure, /Expected end of startup fixture/);
  assert.equal(saved.browserCloseCompleted, true);
  assert.deepEqual(saved.secondaryDiagnostics ?? [], []);
});
