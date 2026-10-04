#!/usr/bin/env node
/** Bounded, repeatable verification of the unified industrial feature streams. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readTestPolicy } from '../publishing/test-policy.mjs';
import { checkSourceIdentity } from './check-source-identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = 'publishing/industrial-feature-tests.json';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function selectIndustrialPhases(manifest, selected = 'all') {
  if (
    manifest?.format !== 'revealline-industrial-feature-tests.v1' ||
    !Array.isArray(manifest.phases)
  )
    throw new Error('Invalid industrial test manifest');
  const ids = new Set();
  for (const phase of manifest.phases) {
    if (
      !/^[a-z][a-z-]{0,39}$/.test(phase?.id) ||
      ids.has(phase.id) ||
      !Array.isArray(phase.files) ||
      !phase.files.length ||
      phase.files.length > 100 ||
      new Set(phase.files).size !== phase.files.length ||
      phase.files.some((file) => !/^game\/test\/[a-z0-9-]+\.test\.mjs$/.test(file))
    )
      throw new Error('Invalid industrial test phase');
    ids.add(phase.id);
  }
  const result =
    selected === 'all' ? manifest.phases : manifest.phases.filter((p) => p.id === selected);
  if (!result.length) throw new Error(`Unknown industrial test phase: ${selected}`);
  return result;
}

export function summarizeIndustrialTap(text, exitCode, signal) {
  const count = (name) =>
    Number([...text.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gm'))].at(-1)?.[1] ?? NaN);
  const summary = Object.fromEntries(
    ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map((key) => [key, count(key)]),
  );
  return {
    ...summary,
    exitCode,
    signal,
    passed:
      exitCode === 0 &&
      !signal &&
      Object.values(summary).every(Number.isSafeInteger) &&
      summary.tests > 0 &&
      summary.pass === summary.tests &&
      summary.fail === 0 &&
      summary.cancelled === 0 &&
      summary.skipped === 0 &&
      summary.todo === 0,
  };
}

/** Run one owned process group. A terminating parent is not proof that its
 * descendants exited: close must kill the group before retiring escalation. */
export async function executeIndustrialPhase({
  command,
  cwd,
  log,
  signal,
  deadlineMs = 10 * 60 * 1000,
  graceMs = 5000,
}) {
  const writer = createWriteStream(log);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, command, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let timedOut = false,
      interrupted = false,
      killTimer,
      failure;
    const kill = (kind) => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, kind);
        else child.kill(kind);
      } catch (error) {
        if (error.code !== 'ESRCH') failure ??= error;
      }
    };
    const terminate = () => {
      kill('SIGTERM');
      killTimer ??= setTimeout(() => kill('SIGKILL'), graceMs);
      killTimer.unref();
    };
    const interrupt = () => {
      interrupted = true;
      terminate();
    };
    const deadline = setTimeout(() => {
      timedOut = true;
      terminate();
    }, deadlineMs);
    deadline.unref();
    signal?.addEventListener('abort', interrupt, { once: true });
    if (signal?.aborted) interrupt();
    child.stdout.pipe(writer, { end: false });
    child.stderr.pipe(writer, { end: false });
    writer.on('error', (error) => {
      failure ??= error;
      kill('SIGKILL');
    });
    child.on('error', (error) => {
      failure ??= error;
      kill('SIGKILL');
    });
    child.on('close', (exitCode, childSignal) => {
      // Descendants with closed stdio can outlive a SIGTERM'd test runner.
      if (timedOut || interrupted || failure) kill('SIGKILL');
      clearTimeout(deadline);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', interrupt);
      const finish = () =>
        failure
          ? reject(failure)
          : resolve({ exitCode, signal: childSignal, timedOut, interrupted });
      if (writer.destroyed) finish();
      else writer.end(finish);
    });
  });
}

async function main(args) {
  let selected = 'all';
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--phase')
      throw new Error('Usage: verify-industrial-features.mjs [--phase ID|all]');
    selected = args[1];
  }
  if ((await readTestPolicy()).mode !== 'required')
    throw new Error('Industrial verification requires the restored test policy');
  const manifestBytes = await fs.readFile(path.join(root, manifestPath));
  const phases = selectIndustrialPhases(JSON.parse(manifestBytes), selected);
  const source = {
    revision: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: Boolean(git('status', '--porcelain')),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
  if (source.dirty)
    throw new Error('Commit the feature stack before collecting source-bound industrial receipts');
  source.raw = await checkSourceIdentity({ root });
  const outputRoot = path.join(root, '.cache/industrial-verification');
  await fs.mkdir(outputRoot, { recursive: true });
  const output = await fs.mkdtemp(path.join(outputRoot, `${source.revision.slice(0, 12)}-`));
  const runPath = path.join(output, 'run.json');
  const run = {
    format: 'revealline-industrial-test-run.v1',
    source,
    selected,
    phases: phases.map((phase) => phase.id),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
  };
  await fs.writeFile(runPath, JSON.stringify(run, null, 2) + '\n');
  console.log(`Industrial verification receipts: ${output}`);
  let passed = true,
    completed = false;
  const controller = new AbortController();
  const interrupts = new Map(
    ['SIGINT', 'SIGTERM'].map((name) => [
      name,
      () => {
        run.interruption = name;
        controller.abort(new Error(`Industrial verification interrupted by ${name}`));
      },
    ]),
  );
  for (const [name, handler] of interrupts) process.on(name, handler);
  try {
    for (const phase of phases) {
      if (controller.signal.aborted) break;
      const startedAt = new Date().toISOString();
      const files = await Promise.all(
        phase.files.map(async (file) => ({
          file,
          sha256: sha256(await fs.readFile(path.join(root, file))),
        })),
      );
      const command = ['--test', '--test-reporter=tap', '--test-concurrency=2', ...phase.files];
      const log = path.join(output, `${phase.id}.tap`);
      const result = await executeIndustrialPhase({
        command,
        cwd: root,
        log,
        signal: controller.signal,
      });
      const bytes = await fs.readFile(log);
      const summary = summarizeIndustrialTap(bytes.toString(), result.exitCode, result.signal);
      let rawAfter = null,
        sourceVerificationError = null;
      try {
        controller.signal.throwIfAborted();
        rawAfter = await checkSourceIdentity({ root });
      } catch (error) {
        sourceVerificationError = error.message;
      }
      const sourceUnchanged =
        source.revision === git('rev-parse', 'HEAD') &&
        !git('status', '--porcelain') &&
        rawAfter?.sourceRevision === source.revision &&
        rawAfter?.aggregateSha256 === source.raw.aggregateSha256;
      const testedFilesUnchanged = (
        await Promise.all(
          files.map(
            async (file) => file.sha256 === sha256(await fs.readFile(path.join(root, file.file))),
          ),
        )
      ).every(Boolean);
      const receipt = {
        format: 'revealline-industrial-test-receipt.v1',
        phase: phase.id,
        startedAt,
        finishedAt: new Date().toISOString(),
        deadlineMs: 10 * 60 * 1000,
        timedOut: result.timedOut,
        interrupted: result.interrupted,
        source,
        manifestSha256: sha256(manifestBytes),
        command: ['node', ...command],
        files,
        logSha256: sha256(bytes),
        summary,
        sourceUnchanged,
        sourceVerificationError,
        testedFilesUnchanged,
        passed:
          summary.passed &&
          !result.timedOut &&
          !result.interrupted &&
          sourceUnchanged &&
          testedFilesUnchanged,
        scope:
          'Executed software regressions only; not physical-device, artistic, human-play or public-release qualification.',
      };
      await fs.writeFile(
        path.join(output, `${phase.id}.json`),
        JSON.stringify(receipt, null, 2) + '\n',
      );
      console.log(JSON.stringify({ phase: phase.id, ...summary, passed: receipt.passed, log }));
      passed &&= receipt.passed;
    }
    completed = true;
  } catch (error) {
    run.error = error.message;
    throw error;
  } finally {
    for (const [name, handler] of interrupts) process.removeListener(name, handler);
    run.finishedAt = new Date().toISOString();
    run.status = controller.signal.aborted
      ? 'interrupted'
      : completed && passed
        ? 'passed'
        : 'failed';
    await fs.writeFile(runPath, JSON.stringify(run, null, 2) + '\n');
    if (run.status !== 'passed') process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
