#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

async function readManifest(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
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
  const result = runFocusedCommands(execution.commands, { root });
  if (result.exitCode !== 0) process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
