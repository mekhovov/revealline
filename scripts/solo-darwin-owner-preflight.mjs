import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  admitDarwinBuildReceipt,
  createDarwinProcessInventory,
  DARWIN_INVENTORY_LIMITS,
  DARWIN_INVENTORY_FORMAT,
  DARWIN_IDENTITY_KIND,
} from './solo-darwin-process-inventory.mjs';

export const DARWIN_OWNER_PREFLIGHT = Object.freeze({
  format: 'SoloDarwinNonBrowserOwnerPreflightV1',
  runner: 'macos-15-intel',
  maximumElapsedMs: 240000,
  maximumEvidenceBytes: 16 * 1024 ** 2,
  maximumReportBytes: 256 * 1024,
  maximumLogBytes: 1024 ** 2,
  rssBytes: 6 * 1024 ** 3,
  cases: [
    { id: 'leader', timeoutMs: 20000, roles: ['leader'] },
    { id: 'tree', timeoutMs: 20000, roles: ['tree', 'branch', 'leaf'] },
    { id: 'deadline', timeoutMs: 2000, roles: ['deadline'] },
  ],
});
const here = dirname(fileURLToPath(import.meta.url)),
  script = fileURLToPath(import.meta.url),
  root = resolve(here, '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encode = (value) => JSON.stringify(value, null, 2) + '\n';
export const DARWIN_EXEC_OBSERVATION = Object.freeze({
  format: 'SoloDarwinExecSuccessorObservationV1',
  maximumSnapshots: 3,
  maximumElapsedMs: 10000,
  maximumRecords: 4,
  maximumBytes: 16 * 1024,
  intervalMs: 250,
});
// Evidence after owned cleanup only. This never feeds owner classification,
// signalling, case assessment or admission of the remaining native cases.
export async function observeDarwinExecSuccessor(
  command,
  { inventory, preflightDeadline, now = () => performance.now(), wait = delay },
) {
  const limit = DARWIN_EXEC_OBSERVATION;
  const result = {
    format: limit.format,
    status: 'withheld',
    reason: 'ineligible-first-ambiguity',
    snapshots: 0,
    records: [],
    ownershipQualification: false,
    originalVerdictChanged: false,
  };
  const first = command?.firstAmbiguousInventory,
    initial = first?.row;
  if (
    command?.status !== 'failed' ||
    command.cleanupUnconfirmed ||
    !Array.isArray(command.survivors) ||
    command.survivors.length ||
    command.processInventory?.platform !== 'darwin' ||
    command.processInventory?.format !== DARWIN_INVENTORY_FORMAT ||
    command.processInventory?.identityKind !== DARWIN_IDENTITY_KIND ||
    first?.format !== 'SoloFirstAmbiguousInventoryV1' ||
    !Number.isSafeInteger(first.ambiguousCount) ||
    first.ambiguousCount < 1 ||
    first.retainedCount !== 1 ||
    first.additionalRowsOmitted !== first.ambiguousCount - 1 ||
    !initial ||
    initial.identityKind !== DARWIN_IDENTITY_KIND ||
    !Number.isSafeInteger(initial.pid) ||
    initial.pid <= 0 ||
    initial.pid > 0x7fffffff ||
    !/^\d{20}$/.test(initial.birth ?? '') ||
    BigInt(initial.birth) === 0n ||
    BigInt(initial.birth) > (1n << 64n) - 1n ||
    !Number.isSafeInteger(initial.version) ||
    initial.version < 0 ||
    initial.version > 0x7fffffff ||
    initial.state !== 'R' ||
    initial.euid !== 0 ||
    initial.ruid !== 0 ||
    initial.ppid !== 1 ||
    initial.pgid !== 1 ||
    initial.parentUniqueId !== '1' ||
    initial.pathInspection !== 'complete' ||
    initial.argv !== '/usr/libexec/xpcproxy' ||
    initial.argvTruncated !== false ||
    initial.argvCodeUnits !== initial.argv.length
  )
    return result;
  let start, previous, deadline;
  const clock = () => {
    const value = now();
    assert(
      Number.isFinite(value) && value >= 0 && (previous === undefined || value >= previous),
      'Invalid exec-observation clock',
    );
    previous = value;
    return value;
  };
  const boundedRow = (row) => {
    assert(row && Number.isSafeInteger(row.pid) && row.pid === initial.pid);
    assert(row.identityKind === DARWIN_IDENTITY_KIND && /^\d{20}$/.test(row.birth ?? ''));
    assert(BigInt(row.birth) > 0n && BigInt(row.birth) <= (1n << 64n) - 1n);
    assert(Number.isSafeInteger(row.version) && row.version >= 0 && row.version <= 0x7fffffff);
    assert(['R', 'Z'].includes(row.state));
    assert(typeof row.argv === 'string' && row.argv.length <= 1024 && !row.argv.includes('\0'));
    assert(['unobserved', 'complete', 'unavailable'].includes(row.pathInspection));
    assert(['unobserved', 'complete', 'unavailable'].includes(row.rssInspection));
    assert(['unobserved', 'absent', 'present', 'unavailable'].includes(row.ownerTagInspection));
    assert(typeof row.ownerTagged === 'boolean' && typeof row.inspectionIncomplete === 'boolean');
    for (const key of ['ppid', 'pgid', 'euid', 'ruid'])
      assert(Number.isSafeInteger(row[key]) && row[key] >= 0 && row[key] <= 0xffffffff);
    assert(
      /^\d{1,20}$/.test(row.parentUniqueId ?? '') && BigInt(row.parentUniqueId) <= (1n << 64n) - 1n,
    );
    assert(Number.isSafeInteger(row.rss) && row.rss >= 0);
    if (row.pathInspection === 'complete') assert(row.argv.startsWith('/'));
    return {
      pid: row.pid,
      birth: row.birth,
      version: row.version,
      state: row.state,
      executablePath: row.argv,
      pathInspection: row.pathInspection,
      ppid: row.ppid,
      pgid: row.pgid,
      parentUniqueId: row.parentUniqueId,
      euid: row.euid,
      ruid: row.ruid,
      rss: row.rssInspection === 'complete' ? row.rss : null,
      rssInspection: row.rssInspection,
      ownerTagged:
        row.ownerTagInspection === 'present'
          ? true
          : row.ownerTagInspection === 'absent'
            ? false
            : null,
      ownerTagInspection: row.ownerTagInspection,
      inspectionIncomplete: row.inspectionIncomplete,
    };
  };
  const append = (record) => {
    assert(result.records.length < limit.maximumRecords, 'Exec-observation record cap');
    assert(
      Buffer.byteLength(encode({ ...result, records: [...result.records, record] })) + 512 <=
        limit.maximumBytes,
      'Exec-observation byte cap',
    );
    result.records.push(record);
  };
  try {
    start = clock();
    assert(Number.isFinite(preflightDeadline) && preflightDeadline >= 0, 'Preflight deadline');
    append({ kind: 'original-latch', elapsedMs: 0, row: boundedRow(initial) });
    if (preflightDeadline - start < limit.maximumElapsedMs) {
      result.reason = 'insufficient-preflight-budget';
      return result;
    }
    deadline = start + limit.maximumElapsedMs;
    result.status = 'unresolved';
    result.reason = 'unchanged-launcher';
    for (let i = 0; i < limit.maximumSnapshots; i++) {
      if (i) {
        assert(
          clock() + limit.intervalMs + DARWIN_INVENTORY_LIMITS.timeoutMs <= deadline,
          'Exec-observation deadline',
        );
        await wait(limit.intervalMs);
      }
      assert(clock() + DARWIN_INVENTORY_LIMITS.timeoutMs <= deadline, 'Exec-observation deadline');
      result.snapshots++;
      const all = inventory(); // Existing provider is synchronous, pinned and capped at 3 seconds.
      if (typeof all?.then === 'function') {
        // Do not leave an injected asynchronous rejection unhandled. The actual
        // provider is synchronous; this cannot extend its deadline or gain credit.
        Promise.resolve(all).catch(() => {});
        assert.fail('Exec-observation inventory must be synchronous');
      }
      const at = clock();
      assert(at < deadline, 'Exec-observation late inventory return');
      assert(
        all instanceof Map && all.size < DARWIN_INVENTORY_LIMITS.maximumProcesses,
        'Invalid exec-observation inventory',
      );
      const row = all.get(initial.pid);
      if (!row) {
        append({ kind: 'absent', elapsedMs: at - start });
        result.reason = 'disappeared-before-identification';
        break;
      }
      assert(
        row.ownerTagInspection === 'unobserved' && row.ownerTagged === false,
        'Diagnostic inventory must not claim a private owner token',
      );
      const retained = boundedRow(row);
      append({ kind: 'snapshot', elapsedMs: at - start, row: retained });
      if (row.birth !== initial.birth) {
        result.reason = 'pid-reused';
        break;
      }
      if (row.state === 'Z') {
        result.reason = 'exited-before-identification';
        break;
      }
      if (
        row.version < initial.version ||
        (row.version === initial.version &&
          row.pathInspection === 'complete' &&
          row.argv !== initial.argv)
      ) {
        result.reason = 'inconsistent-exec-identity';
        break;
      }
      if (
        row.pathInspection === 'complete' &&
        row.version > initial.version &&
        row.argv !== initial.argv
      ) {
        result.status = 'exec-successor-observed';
        result.reason = 'same-lifetime-new-kernel-executable';
        break;
      }
      result.reason =
        row.pathInspection !== 'complete'
          ? 'path-unavailable'
          : row.version > initial.version
            ? 'same-path-exec-observed'
            : 'unchanged-launcher';
    }
  } catch (error) {
    result.status = 'unresolved';
    result.reason = 'observation-error';
    result.failure = String(error?.message ?? error).slice(0, 256);
  } finally {
    result.elapsedMs =
      Number.isFinite(start) && Number.isFinite(previous) ? previous - start : null;
  }
  return result;
}
async function save(path, value) {
  const text = encode(value);
  assert(Buffer.byteLength(text) <= DARWIN_OWNER_PREFLIGHT.maximumReportBytes);
  await writeFile(path, text, { flag: 'wx' });
}
function hosted() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Hosted-only native owner control');
  assert.equal(process.env.RUNNER_OS, 'macOS');
  assert.equal(process.platform, 'darwin');
  assert.equal(process.arch, 'x64');
  assert.equal(release().split('.')[0], '24');
}
export function assessDarwinOwnerCase(id, command, observations, source) {
  const spec = DARWIN_OWNER_PREFLIGHT.cases.find((row) => row.id === id);
  assert(spec, 'Unknown case');
  const failure = [];
  const check = (condition, reason) => {
    if (!condition) failure.push(reason);
  };
  check(
    command?.processInventory?.format === DARWIN_INVENTORY_FORMAT &&
      command.processInventory.identityKind === DARWIN_IDENTITY_KIND &&
      command.processInventory.platform === 'darwin',
    'V2-native-owner',
  );
  check(command?.initialLeaderCapture === 'direct-child-birth', 'direct-leader');
  check(
    Array.isArray(command?.argv) &&
      command.argv.length === 6 &&
      command.argv[1].endsWith('/scripts/solo-darwin-owner-preflight.mjs') &&
      command.argv[2] === 'child' &&
      command.argv[3] === id &&
      command.argv[5] === source,
    'declared-child-command',
  );
  check(
    command?.ambiguous?.length === 0 &&
      command?.survivors?.length === 0 &&
      !command?.cleanupUnconfirmed,
    'confirmed-closure',
  );
  check(
    Number.isFinite(command?.peakRSS) &&
      command.peakRSS > 0 &&
      command.peakRSS <= DARWIN_OWNER_PREFLIGHT.rssBytes,
    'measured-resident-memory',
  );
  check(
    command?.timeoutMs === spec.timeoutMs &&
      command?.rssBytes === DARWIN_OWNER_PREFLIGHT.rssBytes &&
      command?.outputBytes === DARWIN_OWNER_PREFLIGHT.maximumLogBytes,
    'declared-owner-limits',
  );
  if (id === 'deadline')
    check(
      command?.status === 'failed' &&
        command.violation === 'deadline' &&
        command.forcedCleanup === true &&
        command.signal === 'SIGTERM',
      'expected-deadline-negative',
    );
  else
    check(
      command?.status === 'closed' &&
        command.exitCode === 0 &&
        !command.violation &&
        !command.forcedCleanup,
      'clean-native-owner',
    );
  check(
    Array.isArray(observations) && observations.length === spec.roles.length,
    'all-child-records',
  );
  check(
    Array.isArray(command?.tracked) && command.tracked.length < 16384,
    'bounded-native-inventory',
  );
  const records = new Map(),
    pids = new Set();
  for (const o of Array.isArray(observations) ? observations.slice(0, 3) : []) {
    check(
      o?.format === 'SoloDarwinOwnerChildV1' &&
        o.sourceRevision === source &&
        o.case === id &&
        spec.roles.includes(o.role) &&
        !records.has(o.role),
      'child-provenance',
    );
    records.set(o?.role, o);
    check(!pids.has(o?.pid), 'distinct-processes');
    pids.add(o?.pid);
    check(
      o?.platform === 'darwin' &&
        o.architecture === 'x64' &&
        Number.isSafeInteger(o.pid) &&
        o.pid > 0 &&
        Number.isSafeInteger(o.ppid) &&
        o.ppid > 0 &&
        o.pid !== o.ppid,
      'child-native-identity',
    );
    const matches = command?.tracked?.filter((row) => row.pid === o?.pid) ?? [];
    check(matches.length === 1, 'observed-child-lifetime');
    const row = matches[0];
    check(
      row?.ppid === o?.ppid &&
        row?.identityKind === DARWIN_IDENTITY_KIND &&
        /^\d{20}$/.test(row.birth ?? '') &&
        BigInt(row.birth) > 0n &&
        BigInt(row.birth) <= (1n << 64n) - 1n &&
        !row.inspectionIncomplete,
      'native-family-and-detail',
    );
    if (id !== 'deadline') check(o?.completed === true && o?.exitCode === 0, 'finite-child-exit');
  }
  if (id === 'tree') {
    const parent = records.get('tree'),
      branch = records.get('branch'),
      leaf = records.get('leaf');
    check(
      parent?.childPid === branch?.pid &&
        branch?.ppid === parent?.pid &&
        branch?.childPid === leaf?.pid &&
        leaf?.ppid === branch?.pid,
      'complete-family-chain',
    );
    for (const [p, c] of [
      [parent, branch],
      [branch, leaf],
    ]) {
      const pr = command?.tracked?.find((row) => row.pid === p?.pid),
        cr = command?.tracked?.find((row) => row.pid === c?.pid);
      check(
        /^\d+$/.test(cr?.parentUniqueId ?? '') &&
          /^\d+$/.test(pr?.birth ?? '') &&
          BigInt(cr.parentUniqueId) === BigInt(pr.birth),
        'native-parent-lifetime',
      );
    }
  }
  return {
    status: failure.length ? 'failed' : id === 'deadline' ? 'expected-negative-observed' : 'passed',
    failures: failure,
    scope:
      'Declared non-browser process family only; no browser/media/game/performance qualification.',
  };
}
async function child(role, out, source) {
  hosted();
  assert(/^[a-f0-9]{40}$/.test(source));
  assert(['leader', 'tree', 'branch', 'leaf', 'deadline'].includes(role));
  assert.equal(await realpath(out), out);
  const id = ['branch', 'leaf'].includes(role) ? 'tree' : role;
  const record = {
    format: 'SoloDarwinOwnerChildV1',
    sourceRevision: source,
    case: id,
    role,
    platform: process.platform,
    architecture: process.arch,
    pid: process.pid,
    ppid: process.ppid,
  };
  if (role === 'deadline') {
    await save(join(out, role + '.json'), { ...record, completed: false });
    setInterval(() => {}, 1000);
    return;
  }
  if (role === 'tree' || role === 'branch') {
    const next = role === 'tree' ? 'branch' : 'leaf';
    const c = spawn(process.execPath, [script, 'child', next, out, source], {
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    record.childPid = c.pid;
    const code = await new Promise((resolve, reject) => {
      c.once('error', reject);
      c.once('exit', (code, signal) =>
        signal ? reject(new Error('Unexpected child signal ' + signal)) : resolve(code),
      );
    });
    assert.equal(code, 0);
  } else await delay(role === 'leader' ? 1000 : 3000);
  await save(join(out, role + '.json'), { ...record, completed: true, exitCode: 0 });
}
export async function runDarwinOwnerPreflight(out, { observeExecSuccessor = false } = {}) {
  assert.equal(typeof observeExecSuccessor, 'boolean');
  hosted();
  assert.equal(resolve(out), out);
  await mkdir(out);
  assert.equal(await realpath(out), out);
  const source = process.env.SOLO_TOOLING_REVISION;
  assert(/^[a-f0-9]{40}$/.test(source ?? ''));
  assert.equal(
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 4096,
    }).trim(),
    source,
  );
  const report = {
    format: DARWIN_OWNER_PREFLIGHT.format,
    sourceRevision: source,
    status: 'failed',
    startedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    cases: [],
    ownershipQualification: false,
    browserObservations: 0,
    mediaObservations: 0,
    performanceQualification: false,
  };
  const start = performance.now();
  try {
    const build = admitDarwinBuildReceipt(process.env, source);
    const diagnosticInventory = observeExecSuccessor
      ? createDarwinProcessInventory(process.env)
      : null;
    if (observeExecSuccessor) report.execSuccessorProtocol = DARWIN_EXEC_OBSERVATION.format;
    await writeFile(join(out, 'inventory-build.json'), build.bytes, { flag: 'wx' });
    report.sources = [];
    for (const name of [
      'solo-darwin-owner-preflight.mjs',
      'solo-darwin-process-inventory.mjs',
      'solo-darwin-process-inventory.c',
      'run-solo-remote-correctness.mjs',
    ]) {
      const bytes = await readFile(join(here, name));
      report.sources.push({ path: 'scripts/' + name, bytes: bytes.length, sha256: sha(bytes) });
    }
    execFileSync('git', ['diff', '--exit-code', '--', ...report.sources.map((row) => row.path)], {
      cwd: root,
      timeout: 3000,
      maxBuffer: 4096,
    });
    const { ownedCommand, evidenceSize } = await import('./run-solo-remote-correctness.mjs');
    const inspect = async () => {
      assert(
        performance.now() - start <= DARWIN_OWNER_PREFLIGHT.maximumElapsedMs,
        'Overall preflight observation deadline',
      );
      assert(
        (await evidenceSize(out)) <= DARWIN_OWNER_PREFLIGHT.maximumEvidenceBytes,
        'Preflight evidence cap',
      );
    };
    for (const spec of DARWIN_OWNER_PREFLIGHT.cases) {
      if (report.cases.some((row) => row.status === 'failed')) {
        report.cases.push({
          id: spec.id,
          status: 'withheld',
          reason: 'prior ownership uncertainty',
        });
        continue;
      }
      const row = { id: spec.id, status: 'failed', observations: [], observationRefs: [] };
      report.cases.push(row);
      try {
        await inspect();
        row.command = await ownedCommand(
          [process.execPath, script, 'child', spec.id, out, source],
          {
            cwd: root,
            env: process.env,
            log: join(out, spec.id + '.log'),
            receipt: join(out, spec.id + '-command.json'),
            timeoutMs: spec.timeoutMs,
            rssBytes: DARWIN_OWNER_PREFLIGHT.rssBytes,
            outputBytes: DARWIN_OWNER_PREFLIGHT.maximumLogBytes,
            inspect,
          },
        );
        for (const role of spec.roles) {
          const path = join(out, role + '.json'),
            info = await lstat(path);
          assert(
            info.isFile() &&
              !info.isSymbolicLink() &&
              info.size <= DARWIN_OWNER_PREFLIGHT.maximumReportBytes,
          );
          const bytes = await readFile(path);
          assert.equal(bytes.length, info.size);
          const after = await lstat(path);
          assert(
            after.dev === info.dev &&
              after.ino === info.ino &&
              after.size === info.size &&
              after.mtimeMs === info.mtimeMs &&
              bytes.length <= DARWIN_OWNER_PREFLIGHT.maximumReportBytes,
            'Child evidence changed during readback',
          );
          row.observationRefs.push({ role, bytes: bytes.length, sha256: sha(bytes) });
          row.observations.push(JSON.parse(bytes));
        }
        row.assessment = assessDarwinOwnerCase(spec.id, row.command, row.observations, source);
        row.status = row.assessment.status;
      } catch (error) {
        row.failure = String(error?.stack ?? error).slice(0, 4096);
      }
      if (observeExecSuccessor && row.status === 'failed')
        row.execSuccessorObservation = await observeDarwinExecSuccessor(row.command, {
          inventory: () => diagnosticInventory.all(),
          preflightDeadline: start + DARWIN_OWNER_PREFLIGHT.maximumElapsedMs,
        });
    }
    await inspect();
    report.status =
      report.cases.length === 3 &&
      report.cases.every((row) => ['passed', 'expected-negative-observed'].includes(row.status))
        ? 'passed'
        : 'failed';
  } catch (error) {
    report.failure = String(error?.stack ?? error).slice(0, 4096);
  } finally {
    for (const spec of DARWIN_OWNER_PREFLIGHT.cases)
      if (!report.cases.some((row) => row.id === spec.id))
        report.cases.push({ id: spec.id, status: 'withheld', reason: 'preflight setup failed' });
    report.elapsedMs = performance.now() - start;
    report.completedAt = new Date().toISOString();
    await save(join(out, 'report.json'), report);
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === script) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'run' || mode === 'run-exec-observation') {
    assert.equal(args.length, 1);
    const r = await runDarwinOwnerPreflight(resolve(args[0]), {
      observeExecSuccessor: mode === 'run-exec-observation',
    });
    if (r.status !== 'passed') process.exitCode = 1;
  } else {
    assert.equal(mode, 'child');
    assert.equal(args.length, 3);
    await child(...args);
  }
}
