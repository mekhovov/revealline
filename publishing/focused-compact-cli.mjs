#!/usr/bin/env node
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validationPolicyDigest } from './admission-binding.mjs';
import {
  buildCompactFocusedPacket,
  executeCompactFocusedShard,
  verifyCompactFocusedPacket,
  verifyCompactFocusedAggregate,
} from './focused-compact.mjs';

const LIMIT = 16 * 1024 * 1024;
async function readBytes(filename) {
  const file = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > LIMIT)
      throw new Error('Focused input is not a bounded regular file.');
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const r = await file.read(bytes, length, bytes.length - length, null);
      if (!r.bytesRead) break;
      length += r.bytesRead;
    }
    if (length !== stat.size) throw new Error('Focused input changed during read.');
    return bytes.subarray(0, length);
  } finally {
    await file.close();
  }
}
async function readJSON(filename) {
  const bytes = await readBytes(filename),
    text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes)) throw new Error('Invalid focused JSON encoding.');
  return JSON.parse(text);
}
async function writeJSON(filename, value) {
  const bytes = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(bytes) > LIMIT) throw new Error('Focused output exceeds its bound.');
  await fs.writeFile(filename, bytes, { flag: 'wx' });
}
function parseArguments(args) {
  const [mode, ...rest] = args;
  const common = ['--automation', '--admission', '--packet'];
  const required =
    mode === 'prepare'
      ? [...common, '--root']
      : mode === 'execute'
        ? [...common, '--root', '--plan-sha256', '--shard', '--receipt']
        : mode === 'verify'
          ? [...common, '--plan-sha256', '--receipts', '--prefix']
          : null;
  if (!required || rest.length !== required.length * 2)
    throw new Error('Invalid focused command/options.');
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i],
      value = rest[i + 1];
    if (!required.includes(key) || Object.hasOwn(options, key) || !value || value.startsWith('--'))
      throw new Error('Invalid or repeated focused option.');
    options[key] = value;
  }
  if (required.some((key) => !Object.hasOwn(options, key)))
    throw new Error('Missing focused option.');
  return { mode, options };
}
function actualRuntime() {
  const result = spawnSync('npm', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 30000,
    maxBuffer: 4096,
  });
  if (result.error || result.signal || result.status !== 0)
    throw new Error('Focused npm runtime identity unavailable.');
  return {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    npmVersion: result.stdout.trim(),
  };
}
async function receiptFiles(directory, prefix, count) {
  let entries;
  try {
    entries = await fs.readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT' && count === 0) return [];
    throw error;
  }
  const wanted = Array.from({ length: count }, (_, i) => prefix + (i + 1));
  if (JSON.stringify(entries.sort()) !== JSON.stringify([...wanted].sort()))
    throw new Error('Missing or unexpected focused worker artifact.');
  return Promise.all(
    wanted.map(async (name) => {
      const folder = path.join(directory, name);
      const stat = await fs.lstat(folder);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error('Invalid focused artifact directory.');
      const files = await fs.readdir(folder);
      if (
        !files.includes('receipt.json') ||
        files.some((f) => !['receipt.json', 'output.log'].includes(f))
      )
        throw new Error('Invalid focused artifact namespace.');
      return readJSON(path.join(folder, 'receipt.json'));
    }),
  );
}

// Test dependency injection is programmatic only. The executable entry point
// always uses the real runtime, source collector, policy digest and executor.
export async function runCompactFocusedCLI(args, env = process.env, dependencies = {}) {
  const { mode, options: flags } = parseArguments(args);
  if (env.GH_TOKEN || env.GITHUB_TOKEN)
    throw new Error('Focused planning/execution must not inherit API credentials.');
  if (env.GITHUB_EVENT_NAME !== 'pull_request')
    throw new Error('Unsupported focused event context.');
  const event = await readJSON(env.GITHUB_EVENT_PATH),
    admission = await readJSON(flags['--admission']);
  if (
    event.repository?.full_name !== env.GITHUB_REPOSITORY ||
    event.pull_request?.head?.sha !== env.EXPECTED_SOURCE ||
    event.pull_request?.base?.sha !== admission.baseSha
  )
    throw new Error('Focused event repository/source/base identity mismatch.');
  const automation = path.resolve(flags['--automation']);
  const context = {
    repository: env.GITHUB_REPOSITORY,
    pullRequest: event.pull_request.number,
    sourceRevision: env.EXPECTED_SOURCE,
    baseRef: event.pull_request.base.ref,
    workflowRevision: env.EXPECTED_AUTOMATION,
    runId: env.GITHUB_RUN_ID,
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    ...(dependencies.runtime ?? actualRuntime()),
  };
  const options = {
    admission,
    context,
    root: flags['--root'] ? path.resolve(flags['--root']) : null,
    manifestBytes: await readBytes(path.join(automation, 'publishing/focused-test-map.json')),
    testPolicyBytes: await readBytes(path.join(automation, 'publishing/test-policy.json')),
    policyDigest: await (dependencies.policyDigest ?? validationPolicyDigest)(automation),
  };
  if (mode === 'prepare') {
    const packet = await buildCompactFocusedPacket(options, dependencies);
    await writeJSON(flags['--packet'], packet);
    if (!env.GITHUB_OUTPUT) throw new Error('Trusted focused job output file is required.');
    await fs.appendFile(
      env.GITHUB_OUTPUT,
      `focusedPlanSha256=${packet.plan.sha256}\nfocusedMatrix=${JSON.stringify(packet.plan.matrix)}\nfocusedShards=${packet.plan.shardCount}\nfocusedContract=revealline-focused-plan.v2\nfocusedDisposition=${packet.plan.shardCount ? 'execute' : packet.plan.noWorkReason}\n`,
    );
    return {
      shards: packet.plan.shardCount,
      commands: packet.plan.commands.length,
      planSha256: packet.plan.sha256,
      noWorkReason: packet.plan.noWorkReason,
    };
  }
  const packet = await readJSON(flags['--packet']),
    expected = flags['--plan-sha256'];
  verifyCompactFocusedPacket(packet, expected, options);
  if (mode === 'execute') {
    if (!/^[1-4]$/u.test(flags['--shard'])) throw new Error('Invalid focused shard option.');
    const receipt = await executeCompactFocusedShard(
      packet,
      expected,
      Number(flags['--shard']),
      options,
      dependencies,
    );
    await writeJSON(flags['--receipt'], receipt);
    return {
      exitCode: receipt.result.exitCode,
      shard: receipt.shard,
      executedCommands: receipt.result.attempted,
    };
  }
  const prefix = `focused-shard-${context.runId}-${context.runAttempt}-`;
  if (flags['--prefix'] !== prefix)
    throw new Error('Focused artifact prefix differs from this run/attempt.');
  const receipts = await receiptFiles(flags['--receipts'], prefix, packet.plan.shardCount);
  return verifyCompactFocusedAggregate(receipts, packet, expected, options, env.WORKERS_RESULT);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  runCompactFocusedCLI(process.argv.slice(2))
    .then((result) => {
      console.log(JSON.stringify(result));
      if (result.exitCode) process.exitCode = result.exitCode;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
