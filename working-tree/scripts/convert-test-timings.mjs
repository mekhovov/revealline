#!/usr/bin/env node
/**
 * Offline conversion, never execution or qualification of another source.
 * Usage: convert-test-timings.mjs --root FULL_CHECKOUT --receipt RECEIPT --out NEW_FILE
 *
 * Receipt schema1:
 * { repository, sourceRevision, sourceTree, inventorySha256, nodeVersion,
 *   run: { id, attempt, headSha, workflowSha, workflowPath, status, conclusion },
 *   environment: { platform, arch, runnerImage, runnerImageVersion,
 *                  availableParallelism, testConcurrency },
 *   tools: { runnerSha256, reporterSha256 },
 *   shards: [{ index, jobId, status, conclusion, exitCode, sourceRoot, runnerCwd,
 *     sourceChecks: { before: { revision, tree, clean }, after: { revision, tree, clean } },
 *     tools: { runnerSha256, reporterSha256 },
 *     artifact: { id, path, bytes, sha256 } }] }
 * IDs/attempts are positive decimal strings. artifact.path is relative to the
 * receipt directory; bytes/sha256 describe the raw JSONL file, NOT an outer ZIP.
 * inventorySha256 hashes sorted full test paths joined with LF and a final LF.
 *
 * The receipt is operator-provided evidence, not cryptographic authentication.
 * A trusted collector/reviewer must independently bind final GitHub job/run
 * verdicts, exact workflow/tool hashes and runner/concurrency provenance.
 * The converter validates agreement and bytes; it never contacts GitHub,
 * executes tests, infers a source verdict, or authorizes workflow activation.
 * Current local Node need not match measured Node: output preserves provenance.
 */
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const roots = [
  'scripts',
  'game',
  'authoring/motion-lab',
  'platforms/desktop/test',
  'platforms/ios/test',
];
const isTest = (file) => /(?:^|\/)(?:test-[^/]+|[^/]+\.test)\.mjs$/.test(file);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = (value, length) =>
  typeof value === 'string' && new RegExp('^[a-f0-9]{' + length + '}$').test(value);
const id = (value) => typeof value === 'string' && /^[1-9]\d*$/.test(value);
const text = (value) => typeof value === 'string' && value.length > 0 && value.length < 1024;
const relative = (value) =>
  text(value) &&
  !path.posix.isAbsolute(value) &&
  !value.includes('\\') &&
  !/^[A-Za-z]:/.test(value) &&
  value.split('/').every((part) => part && part !== '.' && part !== '..');
const testPath = (value) =>
  relative(value) && isTest(value) && roots.some((root) => value.startsWith(root + '/'));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function need(condition, message) {
  if (!condition) throw new Error(message);
}
function tools(value) {
  return object(value) && sha(value.runnerSha256, 64) && sha(value.reporterSha256, 64);
}
function sameTools(left, right) {
  return (
    tools(left) &&
    left.runnerSha256 === right.runnerSha256 &&
    left.reporterSha256 === right.reporterSha256
  );
}

async function ordinaryFile(filename, limit = 5 * 1024 * 1024) {
  need((await fs.lstat(filename)).isFile(), 'Input must be an ordinary non-symlink file');
  const handle = await fs.open(
    filename,
    constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat();
    need(
      stat.isFile() && stat.size <= limit,
      'Input size/type exceeds bounded ordinary-file contract',
    );
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    need(offset === stat.size, 'Input changed size while read');
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
async function artifactPath(directory, name) {
  need(relative(name), 'Unsafe artifact path');
  const segments = name.split('/');
  let current = directory;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    need(
      (await fs.lstat(current)).isDirectory(),
      'Artifact parent must be an ordinary non-symlink directory',
    );
  }
  return path.join(directory, ...segments);
}
function git(root, ...args) {
  return execFileSync('git', ['--no-optional-locks', '-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function inventory(root, receipt) {
  need(
    (await fs.realpath(git(root, 'rev-parse', '--show-toplevel').trim())) === root,
    'Root must be the full source checkout',
  );
  need(
    git(root, 'rev-parse', 'HEAD').trim() === receipt.sourceRevision,
    'Checkout HEAD differs from measured source',
  );
  need(
    git(root, 'rev-parse', 'HEAD^{tree}').trim() === receipt.sourceTree,
    'Checkout tree differs from measured source',
  );
  let sparse = '';
  try {
    sparse = git(root, 'config', '--get', 'core.sparseCheckout').trim();
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  need(sparse !== 'true', 'Sparse checkouts cannot establish full inventory');
  const tracked = new Map();
  for (const record of git(root, 'ls-tree', '-rz', 'HEAD', '--', ...roots)
    .split('\0')
    .filter(Boolean)) {
    const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(record);
    if (!match || !isTest(match[3])) continue;
    need(['100644', '100755'].includes(match[1]), 'Tracked test must be an ordinary file');
    tracked.set(match[3], match[2]);
  }
  const found = [];
  async function collect(directory) {
    let entries;
    try {
      entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const file = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) await collect(file);
      else if (entry.isFile() && isTest(file)) found.push(file);
    }
  }
  for (const directory of roots) {
    try {
      need(
        (await fs.lstat(path.join(root, directory))).isDirectory(),
        'Test root must be an ordinary directory',
      );
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    await collect(directory);
  }
  found.sort();
  need(
    found.length >= 4 && equal(found, [...tracked.keys()].sort()),
    'Materialized test inventory differs from tracked full source',
  );
  need(sha256(found.join('\n') + '\n') === receipt.inventorySha256, 'Inventory digest mismatch');
  for (const file of found) {
    const bytes = await ordinaryFile(path.join(root, file));
    const oid = createHash('sha1')
      .update('blob ' + bytes.length + '\0')
      .update(bytes)
      .digest('hex');
    need(oid === tracked.get(file), 'Test bytes differ from measured source: ' + file);
  }
  return found;
}

function validateReceipt(receipt) {
  need(object(receipt) && receipt.schemaVersion === 1, 'Unsupported receipt schema');
  need(
    text(receipt.repository) && /^[^/\s]+\/[^/\s]+$/.test(receipt.repository),
    'Invalid repository identity',
  );
  need(
    sha(receipt.sourceRevision, 40) &&
      sha(receipt.sourceTree, 40) &&
      sha(receipt.inventorySha256, 64),
    'Invalid source/inventory identity',
  );
  need(
    typeof receipt.nodeVersion === 'string' && /^v\d+\.\d+\.\d+$/.test(receipt.nodeVersion),
    'Invalid measured Node version',
  );
  const run = receipt.run;
  need(
    object(run) &&
      id(run.id) &&
      id(run.attempt) &&
      run.headSha === receipt.sourceRevision &&
      sha(run.workflowSha, 40) &&
      relative(run.workflowPath) &&
      run.workflowPath.startsWith('.github/workflows/') &&
      run.status === 'completed' &&
      run.conclusion === 'success',
    'Run is incomplete, unsuccessful or unbound',
  );
  const env = receipt.environment;
  need(
    object(env) &&
      ['platform', 'arch', 'runnerImage', 'runnerImageVersion', 'testConcurrency'].every((key) =>
        text(env[key]),
      ) &&
      Number.isSafeInteger(env.availableParallelism) &&
      env.availableParallelism > 0 &&
      tools(receipt.tools),
    'Invalid environment/tool provenance',
  );
  need(
    Array.isArray(receipt.shards) && receipt.shards.length === 4,
    'Exactly four shard receipts required',
  );
  const jobs = new Set(),
    artifacts = new Set(),
    paths = new Set();
  need(
    equal(receipt.shards.map((shard) => shard?.index).sort(), [1, 2, 3, 4]),
    'Invalid or duplicate shard index',
  );
  for (const shard of receipt.shards) {
    need(id(shard.jobId) && !jobs.has(shard.jobId), 'Invalid or duplicate job identity');
    jobs.add(shard.jobId);
    need(
      shard.status === 'completed' && shard.conclusion === 'success' && shard.exitCode === 0,
      'Shard has no complete successful exit',
    );
    need(
      text(shard.sourceRoot) &&
        path.posix.isAbsolute(shard.sourceRoot) &&
        text(shard.runnerCwd) &&
        path.posix.isAbsolute(shard.runnerCwd),
      'Missing remote source/cwd binding',
    );
    need(sameTools(shard.tools, receipt.tools), 'Shard tool identity mismatch');
    for (const phase of ['before', 'after']) {
      const check = shard.sourceChecks?.[phase];
      need(
        check?.revision === receipt.sourceRevision &&
          check?.tree === receipt.sourceTree &&
          check?.clean === true,
        'Missing exact clean before/after source evidence',
      );
    }
    const artifact = shard.artifact;
    need(
      object(artifact) &&
        id(artifact.id) &&
        !artifacts.has(artifact.id) &&
        relative(artifact.path) &&
        !paths.has(artifact.path) &&
        Number.isSafeInteger(artifact.bytes) &&
        artifact.bytes > 0 &&
        artifact.bytes <= 5 * 1024 * 1024 &&
        sha(artifact.sha256, 64),
      'Invalid or duplicate raw artifact identity',
    );
    artifacts.add(artifact.id);
    paths.add(artifact.path);
  }
}

function parseTelemetry(bytes, receipt, shard, allFiles) {
  // Invalid UTF-8 must not silently become replacement characters.
  const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  need(body.endsWith('\n'), 'Truncated JSONL without final newline');
  const lines = body.slice(0, -1).split('\n');
  need(
    lines.every((row) => row.trim()),
    'Empty JSONL record',
  );
  const records = lines.map((row) => JSON.parse(row));
  need(
    records.length >= 3 && records.every((row) => object(row) && row.schemaVersion === 1),
    'Invalid telemetry schema/records',
  );
  const meta = records[0],
    summary = records.at(-1),
    rows = records.slice(1, -1);
  need(
    meta.type === 'metadata' &&
      summary.type === 'summary' &&
      rows.every((row) => row.type === 'file'),
    'Telemetry must be one metadata, files, one final summary',
  );
  need(
    meta.sourceRevision === receipt.sourceRevision &&
      meta.nodeVersion === receipt.nodeVersion &&
      meta.runId === receipt.run.id &&
      meta.runAttempt === receipt.run.attempt &&
      meta.root === shard.sourceRoot &&
      meta.runnerCwd === shard.runnerCwd &&
      meta.measurement === 'node-file-container-duration-ms',
    'Telemetry run/source/runtime binding mismatch',
  );
  need(
    ['platform', 'arch', 'availableParallelism'].every(
      (key) => meta[key] === receipt.environment[key],
    ),
    'Telemetry runner environment mismatch',
  );
  const selected = meta.selectedFiles;
  need(
    Array.isArray(selected) &&
      selected.length > 0 &&
      selected.every(testPath) &&
      new Set(selected).size === selected.length &&
      selected.every((file) => allFiles.has(file)),
    'Invalid selected source inventory',
  );
  need(
    summary.supported === true &&
      summary.usable === true &&
      Array.isArray(summary.errors) &&
      summary.errors.length === 0 &&
      Array.isArray(summary.missingFiles) &&
      summary.missingFiles.length === 0 &&
      Array.isArray(summary.extraFiles) &&
      summary.extraFiles.length === 0 &&
      summary.expectedFileCount === selected.length &&
      summary.measuredFileCount === selected.length,
    'Telemetry has no complete usable successful summary',
  );
  const durations = new Map();
  for (const row of rows) {
    need(
      testPath(row.file) &&
        row.passed === true &&
        typeof row.durationMs === 'number' &&
        Number.isFinite(row.durationMs) &&
        row.durationMs > 0 &&
        !durations.has(row.file),
      'Invalid, failed or duplicate measured file',
    );
    durations.set(row.file, row.durationMs);
  }
  need(
    equal([...durations.keys()].sort(), [...selected].sort()),
    'Measurement/selected inventory mismatch',
  );
  return durations;
}

async function main(argv) {
  need(
    argv.length === 6,
    'Usage: convert-test-timings.mjs --root FULL_CHECKOUT --receipt RECEIPT --out NEW_FILE',
  );
  const options = new Map();
  for (let offset = 0; offset < argv.length; offset += 2) {
    need(
      ['--root', '--receipt', '--out'].includes(argv[offset]) &&
        argv[offset + 1] &&
        !options.has(argv[offset]),
      'Invalid or duplicate argument',
    );
    options.set(argv[offset], argv[offset + 1]);
  }
  need(options.size === 3, 'All three arguments are required');
  const root = await fs.realpath(options.get('--root'));
  const receiptPath = path.resolve(options.get('--receipt'));
  const output = path.resolve(options.get('--out'));
  const receiptBytes = await ordinaryFile(receiptPath);
  const receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(receiptBytes));
  validateReceipt(receipt);
  const files = await inventory(root, receipt);
  const allFiles = new Set(files);
  const durations = new Map();
  for (const shard of [...receipt.shards].sort((a, b) => a.index - b.index)) {
    const file = await artifactPath(path.dirname(receiptPath), shard.artifact.path);
    const bytes = await ordinaryFile(file);
    need(
      bytes.length === shard.artifact.bytes && sha256(bytes) === shard.artifact.sha256,
      'Raw artifact byte/digest mismatch',
    );
    for (const [name, duration] of parseTelemetry(bytes, receipt, shard, allFiles)) {
      need(!durations.has(name), 'Test assigned to multiple shard streams: ' + name);
      durations.set(name, duration);
    }
  }
  need(
    equal([...durations.keys()].sort(), files),
    'Four shards do not cover every source test exactly once',
  );
  const profile = Buffer.from(
    JSON.stringify(
      {
        schemaVersion: 1,
        sourceRevision: receipt.sourceRevision,
        nodeVersion: receipt.nodeVersion,
        durationsMs: Object.fromEntries(files.map((file) => [file, durations.get(file)])),
      },
      null,
      2,
    ) + '\n',
  );
  need(profile.length <= 5 * 1024 * 1024, 'Output exceeds runner profile limit');
  // No writes before all validation passes. O_EXCL refuses existing files and
  // symlinks. No overwrite, network operation, test execution or verdict reuse.
  const handle = await fs.open(
    output,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o644,
  );
  try {
    await handle.writeFile(profile);
  } finally {
    await handle.close();
  }
  console.log(
    JSON.stringify({
      output,
      sha256: sha256(profile),
      files: files.length,
      receiptSha256: sha256(receiptBytes),
      evidence:
        'operator-provided receipt; not cryptographic authentication or source qualification',
    }),
  );
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
