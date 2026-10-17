import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AVAILABILITY_LIMITS = Object.freeze({
  inventoryMs: 3000,
  outputBytes: 8 * 1024 ** 2,
  stderrBytes: 65536,
  rows: 16384,
  reportBytes: 1024 ** 2,
  summaryRows: 64,
});
const sha = (b) => createHash('sha256').update(b).digest('hex');
export function parseIdentityAvailability(bytes) {
  assert(
    Buffer.isBuffer(bytes) && bytes.length < AVAILABILITY_LIMITS.outputBytes && bytes.at(-1) === 10,
    'Complete bounded native output',
  );
  const text = bytes.toString('utf8');
  assert(/^[\x09\x0a\x20-\x7e]+$/.test(text), 'ASCII diagnostic protocol');
  const lines = text.slice(0, -1).split('\n'),
    head = lines.shift().split('\t');
  assert.equal(head.length, 6);
  assert.equal(head[0], 'SoloDarwinIdentityAvailabilityV1');
  const number = (s) => {
    assert(/^-?\d+$/.test(s));
    const n = Number(s);
    assert(Number.isSafeInteger(n));
    return n;
  };
  const [uid, euid, allCount, effectiveCount, realCount] = head.slice(1).map(number);
  assert(uid >= 0 && euid >= 0 && uid <= 0xffffffff && euid <= 0xffffffff);
  for (const n of [allCount, effectiveCount, realCount])
    assert(n >= -1 && n < AVAILABILITY_LIMITS.rows);
  const enumerationComplete = [allCount, effectiveCount, realCount].every((n) => n >= 0);
  assert.equal(
    lines.length,
    enumerationComplete ? allCount : 0,
    'Every enumerated positive PID has one retained row',
  );
  const seen = new Set();
  const rows = lines.map((line) => {
    const values = line.split('\t');
    assert.equal(values.length, 14);
    const [pid, em, rm] = values.slice(0, 3).map(number);
    assert(pid > 0 && pid <= 0x7fffffff && !seen.has(pid));
    seen.add(pid);
    assert([0, 1].includes(em) && [0, 1].includes(rm));
    const status = values[3];
    assert(['consistent', 'changed', 'gone', 'unavailable'].includes(status));
    const [stage, result, error, ppid, pgid, processEuid, processRuid] = values
      .slice(4, 11)
      .map(number);
    const [uniqueId, parentUniqueId] = values.slice(11, 13);
    for (const id of [uniqueId, parentUniqueId])
      assert(/^\d{1,20}$/.test(id) && BigInt(id) <= 0xffffffffffffffffn);
    const version = number(values[13]);
    assert(
      stage >= -1 &&
        stage <= 3 &&
        error >= 0 &&
        error <= 0x7fffffff &&
        result >= -0x80000000 &&
        result <= 0x7fffffff,
    );
    assert(version >= -0x80000000 && version <= 0x7fffffff);
    for (const n of [ppid, pgid, processEuid, processRuid]) assert(n >= 0 && n <= 0xffffffff);
    if (['consistent', 'changed'].includes(status)) {
      assert.equal(stage, -1);
      assert.equal(result, 0);
      assert.equal(error, 0);
      if (status === 'consistent') assert(BigInt(uniqueId) > 0n);
    } else {
      assert(stage >= 0);
      if (status === 'gone') assert(result <= 0 && [2, 3].includes(error));
      assert([ppid, pgid, processEuid, processRuid, version].every((n) => n === 0));
      assert.equal(uniqueId, '0');
      assert.equal(parentUniqueId, '0');
    }
    return {
      pid,
      effectiveMembership: Boolean(em),
      realMembership: Boolean(rm),
      status,
      stage,
      result,
      error,
      ppid,
      pgid,
      euid: processEuid,
      ruid: processRuid,
      uniqueId,
      parentUniqueId,
      version,
    };
  });
  return {
    uid,
    euid,
    allCount,
    effectiveCount,
    realCount,
    enumerationComplete,
    rows,
    scope:
      'Sequential non-atomic PID-list availability only. No birth, descendant closure or signalling authority.',
  };
}
export function summarizeIdentityAvailability(observation) {
  const { rows, ...header } = observation;
  const counts = { consistent: 0, changed: 0, gone: 0, unavailable: 0 },
    exceptions = [];
  let excludedFromEffective = 0,
    excludedFromBoth = 0;
  for (const row of rows) {
    counts[row.status]++;
    if (!row.effectiveMembership) excludedFromEffective++;
    if (!row.effectiveMembership && !row.realMembership) excludedFromBoth++;
    if (row.status !== 'consistent' && exceptions.length < AVAILABILITY_LIMITS.summaryRows)
      exceptions.push(row);
  }
  return {
    ...header,
    counts,
    excludedFromEffective,
    excludedFromBoth,
    exceptions,
    exceptionsOmitted: rows.length - counts.consistent - exceptions.length,
    completeRawRowsRetainedSeparately: true,
  };
}
export function assessIdentityAvailability(observation, command, capped) {
  return Boolean(
    observation &&
      observation.enumerationComplete &&
      observation.rows.some((r) => r.status === 'consistent') &&
      observation.rows.every((r) => ['consistent', 'gone'].includes(r.status)) &&
      command.status === 0 &&
      !command.error &&
      command.signal === null &&
      !capped,
  );
}
function run(out) {
  assert.equal(process.platform, 'darwin');
  const here = dirname(fileURLToPath(import.meta.url)),
    repository = resolve(here, '..');
  mkdirSync(out);
  assert.equal(realpathSync(out), out);
  const capture = (argv) => {
    const r = spawnSync(argv[0], argv.slice(1), {
      timeout: 10000,
      maxBuffer: 65536,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    assert(!r.error && r.signal === null);
    return r.stdout.trim();
  };
  const sourceRevision = capture(['git', '-C', repository, 'rev-parse', 'HEAD']);
  assert.equal(sourceRevision, process.env.SOLO_TOOLING_REVISION);
  const compiler = capture(['xcrun', '--find', 'clang']),
    sdk = capture(['xcrun', '--show-sdk-path']);
  const source = join(here, 'solo-darwin-identity-availability.c'),
    binary = join(out, 'availability');
  const args = ['-std=c11', '-Wall', '-Wextra', '-Werror', '-isysroot', sdk, source, '-o', binary];
  const build = spawnSync(compiler, args, { timeout: 10000, maxBuffer: 65536 });
  for (const [name, bytes] of [
    ['build-stdout', build.stdout],
    ['build-stderr', build.stderr],
  ])
    writeFileSync(join(out, name + '.txt'), bytes ?? Buffer.alloc(0), { flag: 'wx' });
  const identity = (path) => {
    const before = lstatSync(path);
    assert(before.isFile() && before.size > 0 && before.size <= 1024 ** 2);
    const b = readFileSync(path),
      after = lstatSync(path);
    for (const key of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'])
      assert.equal(after[key], before[key]);
    assert.equal(b.length, before.size);
    return { path, bytes: b.length, sha256: sha(b), device: before.dev, inode: before.ino };
  };
  const receipt = {
    format: 'SoloDarwinAvailabilityBuildV1',
    sourceRevision,
    platform: process.platform,
    architecture: process.arch,
    compiler: { path: compiler, version: capture([compiler, '--version']) },
    sdk: { path: sdk, version: capture(['xcrun', '--show-sdk-version']) },
    arguments: args,
    sources: [identity(source), identity(fileURLToPath(import.meta.url))],
    build: { exitCode: build.status, signal: build.signal, error: build.error?.code ?? null },
  };
  writeFileSync(join(out, 'build.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  assert(build.status === 0 && !build.error && build.signal === null, 'Availability build failed');
  receipt.binary = identity(binary);
  const observed = spawnSync(binary, [], {
    timeout: AVAILABILITY_LIMITS.inventoryMs,
    maxBuffer: AVAILABILITY_LIMITS.outputBytes,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const streams = [];
  for (const [name, value, cap] of [
    ['stdout', observed.stdout, AVAILABILITY_LIMITS.outputBytes],
    ['stderr', observed.stderr, AVAILABILITY_LIMITS.stderrBytes],
  ]) {
    const bytes = (value ?? Buffer.alloc(0)).subarray(0, cap);
    writeFileSync(join(out, name + '.txt'), bytes, { flag: 'wx' });
    streams.push({
      name,
      bytes: bytes.length,
      sha256: sha(bytes),
      capped: (value?.length ?? 0) >= cap,
    });
  }
  let observation = null,
    parseFailure = null,
    binaryFailure = null;
  try {
    observation = parseIdentityAvailability(observed.stdout ?? Buffer.alloc(0));
  } catch (error) {
    parseFailure = error.message.slice(0, 512);
  }
  try {
    assert.deepEqual(identity(binary), receipt.binary, 'Compiled helper changed');
  } catch (error) {
    binaryFailure = error.message.slice(0, 512);
  }
  const complete =
    assessIdentityAvailability(
      observation,
      observed,
      streams.some((s) => s.capped),
    ) && !binaryFailure;
  const report = {
    format: 'SoloDarwinIdentityAvailabilityDiagnosticV1',
    sourceRevision,
    status: complete ? 'availability-observed' : 'failed-or-unsupported-retained',
    exitCode: observed.status,
    signal: observed.signal,
    error: observed.error?.code ?? null,
    parseFailure,
    binaryFailure,
    limits: AVAILABILITY_LIMITS,
    streams,
    observation: observation ? summarizeIdentityAvailability(observation) : null,
    build: receipt,
    ownershipQualification: false,
    mediaObservations: 0,
    performanceQualification: false,
  };
  const encoded = JSON.stringify(report, null, 2) + '\n';
  assert(Buffer.byteLength(encoded) <= AVAILABILITY_LIMITS.reportBytes);
  writeFileSync(join(out, 'report.json'), encoded, { flag: 'wx' });
  if (!complete) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3);
  run(resolve(process.argv[2]));
}
