#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseTestPolicy, readTestPolicy } from './test-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function safeChangedPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4096 &&
    !path.isAbsolute(value) &&
    !value.split('/').includes('..') &&
    !value.includes('\0')
  );
}

function compilePatterns(patterns) {
  if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== 'string'))
    throw new Error('Focused-test manifest contains invalid path patterns.');
  return patterns.map((pattern) => new RegExp(pattern, 'u'));
}

function validateCommand(command) {
  if (
    !command ||
    typeof command.id !== 'string' ||
    !['node', 'npm'].includes(command.command) ||
    !Array.isArray(command.args) ||
    command.args.some((argument) => typeof argument !== 'string' || argument.includes('\0')) ||
    (command.timeoutMs !== undefined &&
      (!Number.isSafeInteger(command.timeoutMs) || command.timeoutMs < 1))
  )
    throw new Error('Focused-test manifest contains an invalid command.');
  return command;
}

export function validateFocusedTestMap(manifest) {
  if (
    manifest?.format !== 'revealline-focused-test-map.v1' ||
    !Array.isArray(manifest.categories) ||
    !manifest.categories.length ||
    !Array.isArray(manifest.fallbackCommands)
  )
    throw new Error('Invalid focused-test manifest.');
  const ids = new Set();
  const categories = manifest.categories.map((category) => {
    if (
      typeof category?.id !== 'string' ||
      ids.has(category.id) ||
      !Array.isArray(category.commands) ||
      !category.commands.length
    )
      throw new Error('Focused-test manifest contains an invalid category.');
    ids.add(category.id);
    return {
      ...category,
      patterns: compilePatterns(category.pathPatterns),
      deferredChangedTestPatterns: compilePatterns(category.deferredChangedTestPatterns || []),
      commands: category.commands.map(validateCommand),
    };
  });
  return {
    categories,
    ignoredPatterns: compilePatterns(manifest.ignoredPathPatterns || []),
    runtimePatterns: compilePatterns(manifest.runtimePathPatterns || []),
    fallbackCommands: manifest.fallbackCommands.map(validateCommand),
  };
}

export function focusedTestPlan(paths, manifest, { fallbackHandled = false } = {}) {
  if (!Array.isArray(paths) || !paths.length || paths.some((item) => !safeChangedPath(item)))
    throw new Error('Focused-test selection requires bounded repository-relative paths.');
  const map = validateFocusedTestMap(manifest);
  const categories = map.categories.filter((category) =>
    paths.some((changed) => category.patterns.some((pattern) => pattern.test(changed))),
  );
  const matched = new Set(
    paths.filter((changed) =>
      categories.some((category) => category.patterns.some((pattern) => pattern.test(changed))),
    ),
  );
  const unknownRuntime = paths.filter(
    (changed) =>
      !matched.has(changed) &&
      !map.ignoredPatterns.some((pattern) => pattern.test(changed)) &&
      map.runtimePatterns.some((pattern) => pattern.test(changed)),
  );
  const commands = [...categories.flatMap((category) => category.commands)];
  if (unknownRuntime.length && !fallbackHandled) commands.push(...map.fallbackCommands);

  const deferredTests = [];
  for (const changed of paths) {
    if (!changed.endsWith('.test.mjs')) continue;
    if (!/^(game\/test|publishing(?:\/pages-controller)?|scripts)\//u.test(changed)) continue;
    if (
      commands.some(
        (command) =>
          command.command === 'node' &&
          command.args[0] === '--test' &&
          command.args.includes(changed),
      )
    )
      continue;
    if (
      categories.some((category) =>
        category.deferredChangedTestPatterns.some((pattern) => pattern.test(changed)),
      )
    ) {
      deferredTests.push(changed);
      continue;
    }
    commands.push({
      id: `changed-test:${changed}`,
      command: 'node',
      args: ['--test', changed],
    });
  }

  const uniqueCommands = [...new Map(commands.map((command) => [command.id, command])).values()];
  return {
    categories: categories.map((category) => category.id),
    unknownRuntime,
    deferredTests,
    commands: uniqueCommands,
  };
}

function packageScriptName(command) {
  if (
    command?.command !== 'npm' ||
    command.args?.length !== 2 ||
    command.args[0] !== 'run' ||
    !/^[a-z0-9:_-]+$/iu.test(command.args[1])
  )
    return null;
  return command.args[1];
}

function singleNodeTestPath(command) {
  if (
    command?.command !== 'node' ||
    command.args?.length !== 2 ||
    command.args[0] !== '--test' ||
    !safeChangedPath(command.args[1]) ||
    !command.args[1].endsWith('.mjs') ||
    command.args[1].includes('*')
  )
    return null;
  return command.args[1];
}

function packageNodeTestPatterns(script) {
  if (typeof script !== 'string') return null;
  const tokens = script.trim().split(/\s+/u);
  if (tokens.length < 3 || tokens[0] !== 'node' || tokens[1] !== '--test') return null;
  const patterns = tokens.slice(2);
  if (
    patterns.some(
      (pattern) =>
        !safeChangedPath(pattern) ||
        !/^[a-z0-9_./*-]+$/iu.test(pattern) ||
        pattern.startsWith('-') ||
        !pattern.endsWith('.mjs') ||
        pattern.includes('**') ||
        path.dirname(pattern).includes('*'),
    )
  )
    return null;
  return patterns;
}

// Waive only unambiguous test-only commands. Mixed scripts, lifecycle hooks,
// validation, generation and unknown syntax stay mandatory.
export function applyFocusedTestPolicy(commands, policy, { packageScripts = {} } = {}) {
  if (policy === null || policy === undefined) return { commands: [...commands], waivedTests: [] };
  const parsed = parseTestPolicy(policy);
  if (parsed.mode !== 'waived') return { commands: [...commands], waivedTests: [] };
  const waivedTests = [];
  const retained = commands.filter((command) => {
    validateCommand(command);
    const directTests =
      command.command === 'node' &&
      command.args.every((argument) => !/\s/u.test(argument)) &&
      packageNodeTestPatterns(['node', ...command.args].join(' '));
    const scriptName = packageScriptName(command);
    const packageTests =
      scriptName &&
      Object.hasOwn(packageScripts, scriptName) &&
      !Object.hasOwn(packageScripts, 'pre' + scriptName) &&
      !Object.hasOwn(packageScripts, 'post' + scriptName) &&
      packageNodeTestPatterns(packageScripts[scriptName]);
    if (!directTests && !packageTests) return true;
    waivedTests.push({ ...command, verdict: 'WAIVED_SKIPPED_NOT_PASSED' });
    return false;
  });
  return { commands: retained, waivedTests };
}

function escapeRegularExpression(value) {
  let escaped = '';
  for (const character of value) {
    if ('.*+?^$()|[]\\{}'.includes(character)) escaped += '\\';
    escaped += character;
  }
  return escaped;
}

function expandPackageNodeTests(patterns, repositoryFiles) {
  const files = new Set(repositoryFiles.filter(safeChangedPath));
  const expanded = [];
  for (const pattern of patterns) {
    if (!pattern.includes('*')) {
      if (!files.has(pattern)) return null;
      expanded.push(pattern);
      continue;
    }
    const basenamePattern = path.basename(pattern);
    const escaped = basenamePattern.split('*').map(escapeRegularExpression).join('.*');
    const matcher = new RegExp('^' + escaped + '$', 'u');
    const directory = path.dirname(pattern);
    const matches = [...files]
      .filter((candidate) => {
        const basename = path.basename(candidate);
        return (
          path.dirname(candidate) === directory &&
          (!basename.startsWith('.') || basenamePattern.startsWith('.')) &&
          matcher.test(basename)
        );
      })
      .sort();
    if (!matches.length) return null;
    expanded.push(...matches);
  }
  return [...new Set(expanded)];
}

export function focusedCommandExecutionPlan(
  commands,
  { packageScripts = {}, repositoryFiles = [], shellSemantics = null } = {},
) {
  const packageCoverage = [];
  const diagnostics = [];
  const coveredTests = new Set();
  for (const command of commands) {
    const scriptName = packageScriptName(command);
    if (!scriptName) continue;
    if (!Object.hasOwn(packageScripts, scriptName)) {
      diagnostics.push({
        id: command.id,
        script: scriptName,
        reason: 'missing-package-script',
      });
      continue;
    }
    const script = packageScripts[scriptName];
    if (typeof script !== 'string') {
      diagnostics.push({
        id: command.id,
        script: scriptName,
        reason: 'invalid-package-script',
      });
      continue;
    }
    if (!/^node\s+--test(?:\s|$)/u.test(script.trim())) continue;
    if (shellSemantics !== 'posix') {
      diagnostics.push({
        id: command.id,
        script: scriptName,
        reason: 'unsupported-script-shell',
      });
      continue;
    }
    const patterns = packageNodeTestPatterns(script);
    if (!patterns) {
      diagnostics.push({
        id: command.id,
        script: scriptName,
        reason: 'unsupported-package-script',
      });
      continue;
    }
    const tests = expandPackageNodeTests(patterns, repositoryFiles);
    if (!tests) {
      diagnostics.push({
        id: command.id,
        script: scriptName,
        reason: 'unresolved-package-tests',
      });
      continue;
    }
    packageCoverage.push({ id: command.id, script: scriptName, tests });
    for (const testFile of tests) coveredTests.add(testFile);
  }

  const deduplicated = [];
  const executionCommands = commands.filter((command) => {
    const testFile = singleNodeTestPath(command);
    if (!testFile || !coveredTests.has(testFile)) return true;
    const coveredBy = packageCoverage
      .filter(({ tests }) => tests.includes(testFile))
      .map(({ id }) => id);
    deduplicated.push({ id: command.id, testFile, coveredBy });
    return false;
  });
  return {
    commands: executionCommands,
    packageCoverage,
    deduplicated,
    diagnostics,
  };
}

export function packageScriptShellSemantics(
  root,
  { platform = process.platform, spawn = spawnSync } = {},
) {
  if (platform === 'win32') return null;
  let result;
  try {
    result = spawn('npm', ['config', 'get', 'script-shell'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, CI: 'true' },
    });
  } catch {
    return null;
  }
  if (result?.error || result?.signal || result?.status !== 0 || typeof result.stdout !== 'string')
    return null;
  return result.stdout.trim() === 'null' ? 'posix' : null;
}

export async function loadFocusedExecutionInputs(
  commands,
  root,
  {
    readFile = fs.readFile,
    readDirectory = fs.readdir,
    statPath = fs.stat,
    shellSemantics = null,
  } = {},
) {
  let packageScripts = {};
  try {
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    if (
      packageJson?.scripts &&
      typeof packageJson.scripts === 'object' &&
      !Array.isArray(packageJson.scripts)
    )
      packageScripts = packageJson.scripts;
  } catch {
    return { packageScripts, repositoryFiles: [], shellSemantics };
  }

  const repositoryFiles = new Set();
  const patterns = commands.flatMap((command) => {
    const scriptName = packageScriptName(command);
    const script = scriptName ? packageScripts[scriptName] : null;
    return typeof script === 'string' ? packageNodeTestPatterns(script) || [] : [];
  });
  for (const pattern of patterns) {
    if (!pattern.includes('*')) {
      try {
        if ((await statPath(path.join(root, pattern))).isFile()) repositoryFiles.add(pattern);
      } catch {
        // An incomplete script cannot authorize deduplication.
      }
      continue;
    }
    const directory = path.dirname(pattern);
    try {
      const entries = await readDirectory(path.join(root, directory), {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const candidate = path.posix.join(directory, entry.name);
        if (entry.isFile()) {
          repositoryFiles.add(candidate);
          continue;
        }
        if (!entry.isSymbolicLink()) continue;
        try {
          if ((await statPath(path.join(root, candidate))).isFile()) repositoryFiles.add(candidate);
        } catch {
          // An unreadable link cannot authorize deduplication.
        }
      }
    } catch {
      // An incomplete glob cannot authorize deduplication.
    }
  }
  return {
    packageScripts,
    repositoryFiles: [...repositoryFiles],
    shellSemantics,
  };
}

export function runFocusedCommands(
  commands,
  {
    root = '.',
    spawn = spawnSync,
    stdout = process.stdout,
    stderr = process.stderr,
    timeoutMs = 10 * 60 * 1000,
  } = {},
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    throw new Error('Focused command timeout must be a positive safe integer.');
  const failures = [];
  let attempted = 0;
  for (const command of commands) {
    attempted += 1;
    const commandTimeoutMs = command.timeoutMs ?? timeoutMs;
    stdout.write(`\n[focused:${command.id}] ${command.command} ${command.args.join(' ')}\n`);
    let result;
    try {
      result = spawn(command.command, command.args, {
        cwd: root,
        encoding: 'utf8',
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' },
        timeout: commandTimeoutMs,
        killSignal: 'SIGTERM',
      });
    } catch (error) {
      result = { error };
    }
    const status = Number.isInteger(result?.status) ? result.status : null;
    const signal =
      typeof result?.signal === 'string' && result.signal.length ? result.signal : null;
    if (!result?.error && status === 0 && signal === null) continue;
    const timedOut = result?.error?.code === 'ETIMEDOUT';
    const failure = {
      id: command.id,
      command: command.command,
      args: command.args,
      status,
      signal,
      error: result?.error
        ? result.error instanceof Error
          ? result.error.message
          : String(result.error)
        : null,
      ...(timedOut ? { timedOut: true } : {}),
    };
    failures.push(failure);
    stderr.write(`[focused:${command.id}] failed ${JSON.stringify(failure)}\n`);
    if (timedOut) {
      stderr.write(
        `[focused:${command.id}] timed out after ${commandTimeoutMs}ms; remaining focused commands were not run.\n`,
      );
      return { attempted, failures, exitCode: 124 };
    }
  }
  return {
    attempted,
    failures,
    exitCode:
      failures.find(({ status }) => Number.isInteger(status) && status !== 0)?.status ||
      (failures.length ? 1 : 0),
  };
}

/** Execute independent focused commands with a bounded worker pool.  A large
 * stacked PR can legitimately select many orthogonal checks; serial execution
 * turns that coverage into a workflow timeout instead of a useful verdict.
 * Each command still has its own timeout and every non-zero result remains a
 * failure. */
export async function runFocusedCommandsParallel(
  commands,
  {
    root = '.',
    concurrency = 1,
    spawnChild = spawn,
    stdout = process.stdout,
    stderr = process.stderr,
    timeoutMs = 10 * 60 * 1000,
  } = {},
) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error('Focused command concurrency must be a positive safe integer.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    throw new Error('Focused command timeout must be a positive safe integer.');
  const failures = [];
  let next = 0;
  const execute = async (command) => {
    const commandTimeoutMs = command.timeoutMs ?? timeoutMs;
    stdout.write(`\n[focused:${command.id}] ${command.command} ${command.args.join(' ')}\n`);
    const result = await new Promise((resolve) => {
      let settled = false,
        timedOut = false,
        deadline;
      const finish = (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(deadline);
          resolve({ ...value, timedOut });
        }
      };
      try {
        if (
          !Number.isSafeInteger(commandTimeoutMs) ||
          commandTimeoutMs < 1 ||
          commandTimeoutMs > 0x7fffffff
        )
          throw new RangeError('Focused command timeout must be a positive signed 32-bit integer.');
        const child = spawnChild(command.command, command.args, {
          cwd: root,
          stdio: 'inherit',
          env: { ...process.env, CI: 'true' },
          killSignal: 'SIGTERM',
        });
        child.once('error', (error) => finish({ error }));
        child.once('close', (status, signal) => finish({ status, signal }));
        // Node's test runner can handle SIGTERM and close with exit 1 and no
        // signal/error. Own the same deadline so that close cannot erase it.
        deadline = setTimeout(() => {
          if (settled) return;
          timedOut = true;
          try {
            child.kill('SIGTERM');
          } catch (error) {
            finish({ error });
          }
        }, commandTimeoutMs);
        deadline.unref();
      } catch (error) {
        finish({ error });
      }
    });
    const status = Number.isInteger(result?.status) ? result.status : null;
    const signal =
      typeof result?.signal === 'string' && result.signal.length ? result.signal : null;
    const timedOut = result?.timedOut || result?.error?.code === 'ETIMEDOUT';
    if (!timedOut && !result?.error && status === 0 && signal === null) return;
    const failure = {
      id: command.id,
      command: command.command,
      args: command.args,
      status,
      signal,
      error: result?.error
        ? result.error instanceof Error
          ? result.error.message
          : String(result.error)
        : null,
      ...(timedOut
        ? { timedOut: true, timeoutMs: commandTimeoutMs, timeoutReason: 'command-deadline' }
        : {}),
    };
    failures.push(failure);
    stderr.write(`[focused:${command.id}] failed ${JSON.stringify(failure)}\n`);
  };
  const worker = async () => {
    while (next < commands.length) {
      const command = commands[next++];
      await execute(command);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, commands.length) }, worker));
  return {
    attempted: commands.length,
    failures,
    exitCode: failures.some(({ timedOut }) => timedOut)
      ? 124
      : failures.find(({ status }) => Number.isInteger(status) && status !== 0)?.status ||
        (failures.length ? 1 : 0),
  };
}

const FOCUSED_SHARDS = 4;
const SHARD_RECEIPT_LIMIT = 8 * 1024 * 1024;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceRevision = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

function assertShardIdentity(identity) {
  if (
    !identity ||
    !sourceRevision(identity.sourceRevision) ||
    !sourceRevision(identity.workflowRevision) ||
    !['policyDigest', 'testPolicySha256', 'manifestSha256', 'changedPathsSha256'].every((key) =>
      digest(identity[key]),
    ) ||
    typeof identity.fallbackHandled !== 'boolean'
  )
    throw new Error('Invalid expected focused identity.');
}

export function parseFocusedShard(value) {
  const match = typeof value === 'string' && /^([1-4])\/4$/u.exec(value);
  if (!match) throw new Error('Focused shard must be one of 1/4, 2/4, 3/4 or 4/4.');
  return { index: Number(match[1]), total: FOCUSED_SHARDS };
}

// Partition only the final execution plan: selection, waiver and exact package
// coverage must already have run. Preserve command objects, order and deadlines.
export function focusedCommandShard(commands, shard) {
  if (
    !Array.isArray(commands) ||
    shard?.total !== FOCUSED_SHARDS ||
    !Number.isInteger(shard.index) ||
    shard.index < 1 ||
    shard.index > FOCUSED_SHARDS
  )
    throw new Error('Invalid focused shard.');
  const ids = new Set();
  for (const command of commands) {
    validateCommand(command);
    if (!command.id || ids.has(command.id)) throw new Error('Focused command IDs must be unique.');
    ids.add(command.id);
  }
  const indices = commands.flatMap((_, index) =>
    index % FOCUSED_SHARDS === shard.index - 1 ? [index] : [],
  );
  return { commands: indices.map((index) => commands[index]), indices };
}

export function assertFocusedShardCoverage(receipts, expectedIdentity) {
  assertShardIdentity(expectedIdentity);
  if (!Array.isArray(receipts) || receipts.length !== FOCUSED_SHARDS)
    throw new Error('All four focused shard receipts are required.');
  const seen = new Set(),
    covered = new Set();
  let commonPlan = null,
    commonTree = null;
  for (const receipt of receipts) {
    if (receipt?.format !== 'revealline-focused-shard.v1' || receipt.state !== 'complete')
      throw new Error('Focused shard did not complete.');
    const shard = receipt.shard;
    if (seen.has(shard?.index)) throw new Error('Duplicate focused shard.');
    const planned = focusedCommandShard(receipt.plan?.commands, shard);
    seen.add(shard.index);
    if (!sourceRevision(receipt.identity?.sourceTree))
      throw new Error('Invalid focused source tree.');
    for (const [key, value] of Object.entries(expectedIdentity))
      if (receipt.identity[key] !== value)
        throw new Error(`Focused shard identity mismatch: ${key}`);
    const bytes = JSON.stringify(receipt.plan.commands),
      hash = sha256(bytes);
    if (receipt.plan.sha256 !== hash || (commonPlan !== null && commonPlan !== bytes))
      throw new Error('Focused shards disagree on the complete execution plan.');
    if (commonTree !== null && commonTree !== receipt.identity.sourceTree)
      throw new Error('Focused shards disagree on the source tree.');
    commonPlan = bytes;
    commonTree = receipt.identity.sourceTree;
    if (JSON.stringify(receipt.indices) !== JSON.stringify(planned.indices))
      throw new Error('Focused shard assignment changed.');
    for (const index of receipt.indices) {
      if (covered.has(index)) throw new Error('Focused command executed in multiple shards.');
      covered.add(index);
    }
    if (
      receipt.result?.exitCode !== 0 ||
      receipt.result.attempted !== planned.commands.length ||
      !Array.isArray(receipt.result.failures) ||
      receipt.result.failures.length !== 0
    )
      throw new Error('Focused shard has failed, cancelled or missing command results.');
  }
  if (seen.size !== FOCUSED_SHARDS || covered.size !== JSON.parse(commonPlan).length)
    throw new Error('Focused shard command union is incomplete.');
  return {
    shards: FOCUSED_SHARDS,
    commands: covered.size,
    sourceTree: commonTree,
    planSha256: sha256(commonPlan),
  };
}

async function readBoundedJSON(file) {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > SHARD_RECEIPT_LIMIT)
      throw new Error('Focused receipt exceeds its bound.');
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    if (length !== stat.size) throw new Error('Focused receipt changed during read.');
    return JSON.parse(bytes.subarray(0, length).toString('utf8'));
  } finally {
    await handle.close();
  }
}

async function shardIdentity({
  admissionFile,
  policyFile,
  manifestFile,
  paths = null,
  root = null,
}) {
  const admission = await readBoundedJSON(admissionFile);
  if (
    admission.format !== 'revealline-admission.v1' ||
    !sourceRevision(admission.headSha) ||
    admission.headSha !== process.env.EXPECTED_SOURCE ||
    !sourceRevision(admission.workflowRevision) ||
    admission.workflowRevision !== process.env.EXPECTED_AUTOMATION ||
    !digest(admission.policyDigest) ||
    !['maintenance', 'scheduled', 'release', 'release-evidence'].includes(
      admission.classification,
    ) ||
    !Array.isArray(admission.paths) ||
    !admission.paths.length ||
    admission.paths.some((x) => !safeChangedPath(x))
  )
    throw new Error('Invalid exact-head focused admission identity.');
  if (paths !== null && JSON.stringify(paths) !== JSON.stringify(admission.paths))
    throw new Error('Focused paths differ from the immutable admission.');
  const policyBytes = await fs.readFile(policyFile);
  parseTestPolicy(policyBytes.toString('utf8'));
  const identity = {
    sourceRevision: admission.headSha,
    workflowRevision: admission.workflowRevision,
    policyDigest: admission.policyDigest,
    testPolicySha256: sha256(policyBytes),
    manifestSha256: sha256(await fs.readFile(manifestFile)),
    changedPathsSha256: sha256(JSON.stringify(admission.paths)),
    fallbackHandled: ['release', 'release-evidence'].includes(admission.classification),
  };
  if (root !== null) {
    const git = (revision) => {
      const result = spawnSync('git', ['rev-parse', revision], { cwd: root, encoding: 'utf8' });
      if (result.error || result.status !== 0 || result.signal)
        throw new Error('Focused Git identity unavailable.');
      return result.stdout.trim();
    };
    if (git('HEAD') !== identity.sourceRevision)
      throw new Error('Focused checkout differs from admission.');
    identity.sourceTree = git('HEAD^{tree}');
    if (!sourceRevision(identity.sourceTree)) throw new Error('Invalid focused checkout tree.');
  }
  assertShardIdentity(identity);
  return identity;
}

async function writeShardReceipt(file, receipt) {
  const bytes = JSON.stringify(receipt) + '\n';
  if (Buffer.byteLength(bytes) > SHARD_RECEIPT_LIMIT)
    throw new Error('Focused receipt exceeds its bound.');
  await fs.writeFile(file, bytes);
}

async function verifyShardFiles(directory, prefix, identity) {
  if (!/^focused-shard-[0-9]+-[0-9]+-$/.test(prefix))
    throw new Error('Invalid focused artifact prefix.');
  const expected = Array.from({ length: FOCUSED_SHARDS }, (_, i) => prefix + (i + 1));
  const entries = (await fs.readdir(directory)).sort();
  if (JSON.stringify(entries) !== JSON.stringify(expected.slice().sort()))
    throw new Error('Missing, duplicate or unexpected focused shard artifacts.');
  const receipts = await Promise.all(
    expected.map((name) => readBoundedJSON(path.join(directory, name, 'receipt.json'))),
  );
  return assertFocusedShardCoverage(receipts, identity);
}

async function readManifest(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const newFlags = ['--verify-shards', '--artifact-prefix', '--shard', '--receipt', '--admission'];
  for (const flag of newFlags) {
    const positions = process.argv.flatMap((value, index) => (value === flag ? [index] : []));
    if (
      positions.length > 1 ||
      (positions.length &&
        (!process.argv[positions[0] + 1] || process.argv[positions[0] + 1].startsWith('--')))
    )
      throw new Error(`Invalid or repeated focused option: ${flag}`);
  }
  if (
    process.argv.includes('--verify-shards') &&
    ['--shard', '--receipt', '--paths', '--root', '--plan-only', '--fallback-handled'].some(
      (flag) => process.argv.includes(flag),
    )
  )
    throw new Error('Focused verification cannot execute or reselect commands.');
  if (!process.argv.includes('--verify-shards') && process.argv.includes('--artifact-prefix'))
    throw new Error('Artifact prefix requires shard verification.');
  if (process.argv.includes('--verify-shards')) {
    const identity = await shardIdentity({
      admissionFile: argument('--admission'),
      policyFile: argument('--test-policy'),
      manifestFile: argument('--manifest', path.join(here, 'focused-test-map.json')),
    });
    const proof = await verifyShardFiles(
      argument('--verify-shards'),
      argument('--artifact-prefix'),
      identity,
    );
    process.stdout.write(`All four focused shards passed: ${JSON.stringify(proof)}\n`);
    return;
  }
  const shard = process.argv.includes('--shard') ? parseFocusedShard(argument('--shard')) : null;
  if (shard && process.argv.includes('--plan-only'))
    throw new Error('A shard must execute its final plan.');
  if (shard && (!argument('--receipt') || !argument('--admission') || !argument('--test-policy')))
    throw new Error('Sharded execution requires receipt, admission and pinned test policy paths.');
  if (!shard && (process.argv.includes('--receipt') || process.argv.includes('--admission')))
    throw new Error('A receipt requires an explicit focused shard.');
  const root = path.resolve(argument('--root', '.'));
  const pathsFile = argument('--paths');
  if (!pathsFile) throw new Error('Usage: focused-tests.mjs --paths FILE [--root DIRECTORY].');
  const manifest = await readManifest(
    argument('--manifest', path.join(here, 'focused-test-map.json')),
  );
  const paths = (await fs.readFile(pathsFile, 'utf8'))
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const policyFile = argument('--test-policy');
  if (process.argv.includes('--test-policy') && (!policyFile || policyFile.startsWith('--')))
    throw new Error('An explicit test policy path is required; no waiver granted.');
  const testPolicy = policyFile ? await readTestPolicy(path.resolve(policyFile)) : null;
  const fallbackHandled = process.argv.includes('--fallback-handled');
  const plan = focusedTestPlan(paths, manifest, { fallbackHandled });
  const summary = [
    '### Focused release gate',
    '',
    `Categories: ${plan.categories.join(', ') || 'bounded non-runtime change'}`,
    `Commands: ${plan.commands.length}`,
  ];
  if (plan.unknownRuntime.length)
    summary.push(
      fallbackHandled
        ? `Fallback validation delegated to the required exact-head release build: ${plan.unknownRuntime.join(', ')}`
        : `Fallback validation: ${plan.unknownRuntime.join(', ')}`,
    );
  if (plan.deferredTests.length)
    summary.push(`Deferred long matrices: ${plan.deferredTests.join(', ')} (not passed)`);
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
  process.stdout.write(`${summary.join('\n')}\n`);
  if (process.argv.includes('--plan-only')) {
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(
        process.env.GITHUB_OUTPUT,
        `required=${plan.commands.length > 0}\ncommands=${plan.commands.length}\n`,
      );
    }
    return;
  }
  const inputs = await loadFocusedExecutionInputs(plan.commands, root, {
    shellSemantics: packageScriptShellSemantics(root),
  });
  const selected = applyFocusedTestPolicy(plan.commands, testPolicy, inputs);
  if (selected.waivedTests.length) {
    const statement =
      'Automated test commands are WAIVED_SKIPPED_NOT_PASSED by explicit user policy. ' +
      'Non-test validation and source-identity guards remain required.';
    const waiverSummary =
      [
        '',
        statement,
        'Deferred commands: ' + selected.waivedTests.map(({ id }) => id).join(', '),
      ].join('\n') + '\n';
    process.stdout.write('::warning::' + statement + '\n');
    process.stdout.write(waiverSummary);
    if (process.env.GITHUB_STEP_SUMMARY)
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, waiverSummary);
  }
  const execution = focusedCommandExecutionPlan(selected.commands, inputs);
  for (const diagnostic of execution.diagnostics)
    process.stderr.write(`[focused:coverage] ${JSON.stringify(diagnostic)}\n`);
  if (execution.deduplicated.length)
    process.stdout.write(
      `Focused executions: ${execution.commands.length} (${execution.deduplicated.length} exact duplicate tests covered by selected package scripts)\n`,
    );
  const partition = shard ? focusedCommandShard(execution.commands, shard) : null;
  let receipt = null;
  const receiptFile = argument('--receipt');
  if (shard) {
    const identity = await shardIdentity({
      admissionFile: argument('--admission'),
      policyFile,
      manifestFile: argument('--manifest', path.join(here, 'focused-test-map.json')),
      paths,
      root,
    });
    if (identity.fallbackHandled !== fallbackHandled)
      throw new Error('Focused fallback policy differs from admission.');
    receipt = {
      format: 'revealline-focused-shard.v1',
      state: 'planned',
      shard,
      identity,
      plan: { commands: execution.commands, sha256: sha256(JSON.stringify(execution.commands)) },
      indices: partition.indices,
      result: null,
    };
    await fs.mkdir(path.dirname(receiptFile), { recursive: true });
    await writeShardReceipt(receiptFile, receipt);
    process.stdout.write(
      `Focused shard ${shard.index}/${shard.total}: ${partition.commands.length}/${execution.commands.length} commands; plan ${receipt.plan.sha256}\n`,
    );
  }
  const result = await runFocusedCommandsParallel(partition?.commands ?? execution.commands, {
    root,
    concurrency: 2,
  });
  if (receipt) {
    receipt.state = 'complete';
    receipt.result = result;
    await writeShardReceipt(receiptFile, receipt);
  }
  if (result.exitCode !== 0) process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
