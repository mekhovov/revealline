import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import {
  executeIndustrialPhase,
  observeIndustrialPhase,
  selectIndustrialPhases,
  summarizeIndustrialTap,
} from './verify-industrial-features.mjs';

test('the feature manifest selects every required stream and real test paths', async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL('../publishing/industrial-feature-tests.json', import.meta.url)),
  );
  const phases = selectIndustrialPhases(manifest);
  assert.deepEqual(
    phases.map((phase) => phase.id),
    ['gameplay', 'creator', 'presentation', 'recordings', 'rooms', 'local-ux'],
  );
  for (const phase of phases) {
    assert.deepEqual(selectIndustrialPhases(manifest, phase.id), [phase]);
    for (const file of phase.files)
      assert.ok((await fs.stat(new URL(`../${file}`, import.meta.url))).isFile());
  }
  assert.throws(() => selectIndustrialPhases(manifest, 'unknown'), /Unknown/);
  assert.throws(
    () => selectIndustrialPhases({ ...manifest, phases: [...phases, phases[0]] }),
    /Invalid/,
  );
  assert.throws(
    () =>
      selectIndustrialPhases({ ...manifest, phases: [{ id: 'x', files: ['../secret.test.mjs'] }] }),
    /Invalid/,
  );
});

test('industrial host phases install their locked SIM fixtures before executing native Studio checks', async () => {
  const read = (file) => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const manifest = JSON.parse(await read('publishing/industrial-feature-tests.json'));
  const consumers = [];
  for (const phase of selectIndustrialPhases(manifest)) {
    const sources = await Promise.all(phase.files.map(read));
    if (sources.some((source) => source.includes("requireAuthoring('fake-indexeddb')")))
      consumers.push(phase.id);
  }
  assert.deepEqual(
    consumers,
    ['local-ux'],
    'Update the workflow dependency scope when another phase adds native IndexedDB fixtures.',
  );
  const workflow = await read('.github/workflows/industrial-feature-tests.yml');
  const steps = workflow.split(/\n      - /);
  const installIndex = steps.findIndex((step) =>
    step.startsWith('name: Install pinned SIM host-test dependencies\n'),
  );
  const executeIndex = steps.findIndex((step) =>
    step.startsWith('name: Execute the feature phase on the exact PR head\n'),
  );
  assert.ok(installIndex >= 0 && executeIndex > installIndex);
  assert.match(steps[installIndex], /if: matrix\.phase == 'local-ux'/);
  assert.match(
    steps[installIndex],
    /run: npm ci --prefix authoring\/fpv-worlds --ignore-scripts\s*$/,
  );
  assert.doesNotMatch(steps[installIndex], /--omit=dev|continue-on-error/);
  const owner = JSON.parse(await read('authoring/fpv-worlds/package.json'));
  const lock = JSON.parse(await read('authoring/fpv-worlds/package-lock.json'));
  assert.match(owner.devDependencies['fake-indexeddb'], /^\d+\.\d+\.\d+$/);
  assert.equal(
    lock.packages[''].devDependencies['fake-indexeddb'],
    owner.devDependencies['fake-indexeddb'],
  );
  assert.equal(
    lock.packages['node_modules/fake-indexeddb'].version,
    owner.devDependencies['fake-indexeddb'],
  );
  assert.equal(lock.packages['node_modules/fake-indexeddb'].dev, true);
  assert.match(lock.packages['node_modules/fake-indexeddb'].integrity, /^sha512-/);
});

test('TAP receipts cannot turn skipped, failed, absent or canceled tests into passing evidence', () => {
  const tap = '# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(summarizeIndustrialTap(tap, 0, null).passed, true);
  assert.equal(summarizeIndustrialTap(tap, 1, null).passed, false);
  assert.equal(summarizeIndustrialTap(tap, null, 'SIGTERM').passed, false);
  for (const key of ['fail', 'cancelled', 'skipped', 'todo'])
    assert.equal(
      summarizeIndustrialTap(tap.replace(`# ${key} 0`, `# ${key} 1`), 0, null).passed,
      false,
    );
  assert.equal(summarizeIndustrialTap('', 0, null).passed, false);
  assert.equal(
    summarizeIndustrialTap(tap.replace('# tests 3', '# tests 0'), 0, null).passed,
    false,
  );
  assert.equal(summarizeIndustrialTap(tap.replace('# pass 3', '# pass 2'), 0, null).passed, false);
});

async function processFixture(t, exitOnTerm = false) {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'industrial-process-'));
  const heartbeat = path.join(directory, 'heartbeat');
  const ready = path.join(directory, 'ready');
  const parent = path.join(directory, 'parent.cjs');
  const descendant = path.join(directory, 'descendant.cjs');
  await fs.writeFile(
    descendant,
    `
    const fs = require('node:fs');
    process.on('SIGTERM', () => {});
    let tick = 0;
    const beat = () => fs.writeFileSync(${JSON.stringify(heartbeat)}, String(++tick));
    beat();
    setInterval(beat, 10);
    process.send(process.pid);
  `,
  );
  await fs.writeFile(
    parent,
    `
    const { spawn } = require('node:child_process');
    const fs = require('node:fs');
    const descendant = spawn(process.execPath, [${JSON.stringify(descendant)}], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    descendant.once('message', (pid) => {
      descendant.disconnect();
      fs.writeFileSync(${JSON.stringify(ready)}, String(pid));
    });
    ${exitOnTerm ? "process.on('SIGTERM', () => { process.stdout.write('# tests 1\\n# pass 1\\n# fail 0\\n# cancelled 0\\n# skipped 0\\n# todo 0\\n'); process.exit(0); });" : ''}
    setInterval(() => {}, 1000);
  `,
  );
  t.after(async () => {
    try {
      process.kill(Number(await fs.readFile(ready, 'utf8')), 'SIGKILL');
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { directory, heartbeat, ready, parent, log: path.join(directory, 'output.tap') };
}

async function waitForReady(ready) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try {
      await fs.access(ready);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await delay(10);
  }
  assert.fail('child fixture did not become ready');
}

async function assertDescendantStopped(heartbeat) {
  await delay(80);
  const stopped = await fs.readFile(heartbeat, 'utf8');
  await delay(120);
  assert.equal(await fs.readFile(heartbeat, 'utf8'), stopped, 'owned descendant survived shutdown');
}

test('deadline cleanup kills a descendant after its parent closes early', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX owned process groups');
  const fixture = await processFixture(t);
  const result = await executeIndustrialPhase({
    command: [fixture.parent],
    cwd: fixture.directory,
    log: fixture.log,
    deadlineMs: 1200,
    graceMs: 5000,
  });
  assert.equal(result.timedOut, true);
  assert.equal(result.interrupted, false);
  await fs.access(fixture.ready);
  await assertDescendantStopped(fixture.heartbeat);
});

test('aborting cannot accept an exit-zero child and kills its surviving descendants', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX owned process groups');
  const fixture = await processFixture(t, true);
  const controller = new AbortController();
  const running = executeIndustrialPhase({
    command: [fixture.parent],
    cwd: fixture.directory,
    log: fixture.log,
    signal: controller.signal,
    deadlineMs: 5000,
    graceMs: 5000,
  });
  await waitForReady(fixture.ready);
  controller.abort();
  const result = await running;
  assert.equal(result.exitCode, 0);
  assert.equal(result.interrupted, true);
  assert.equal(result.timedOut, false);
  assert.equal(
    summarizeIndustrialTap(await fs.readFile(fixture.log, 'utf8'), 0, null).passed,
    true,
  );
  await assertDescendantStopped(fixture.heartbeat);
});

test('cleanup EPERM preserves the interrupted exit-zero outcome as failed execution evidence', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX owned process groups');
  const fixture = await processFixture(t, true);
  const controller = new AbortController();
  const originalKill = process.kill.bind(process);
  let cleanupCalls = 0;
  t.mock.method(process, 'kill', (pid, signal) => {
    const result = originalKill(pid, signal);
    if (pid < 0 && signal === 'SIGKILL') {
      cleanupCalls++;
      // Actually retire the owned descendant, then inject the OS-error result
      // at the same boundary. A failed cleanup must never be reported as clean.
      throw Object.assign(new Error('Injected cleanup permission failure'), { code: 'EPERM' });
    }
    return result;
  });
  const running = observeIndustrialPhase({
    command: [fixture.parent],
    cwd: fixture.directory,
    log: fixture.log,
    signal: controller.signal,
    deadlineMs: 5000,
    graceMs: 5000,
  });
  await waitForReady(fixture.ready);
  controller.abort();
  const result = await running;
  assert.equal(cleanupCalls, 1);
  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(result.interrupted, true);
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.executionError, {
    name: 'Error',
    message: 'Injected cleanup permission failure',
    code: 'EPERM',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, 'The receipt retains all metadata.');
  assert.equal(
    summarizeIndustrialTap(await fs.readFile(fixture.log, 'utf8'), 0, null).passed,
    true,
    'Passing TAP alone cannot override the captured execution failure.',
  );
  await assertDescendantStopped(fixture.heartbeat);
});

test('a failed child spawn still produces serializable failed execution evidence', async (t) => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'industrial-missing-cwd-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const result = await observeIndustrialPhase({
    command: ['-e', 'process.exit(0)'],
    cwd: path.join(directory, 'missing'),
    log: path.join(directory, 'output.tap'),
    deadlineMs: 5000,
  });
  assert.equal(result.executionError.code, 'ENOENT');
  assert.equal(result.timedOut, false);
  assert.equal(result.interrupted, false);
  assert.equal(
    summarizeIndustrialTap(
      await fs.readFile(path.join(directory, 'output.tap'), 'utf8'),
      result.exitCode,
      result.signal,
    ).passed,
    false,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});
