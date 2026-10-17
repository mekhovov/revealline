import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DARWIN_INVENTORY_LIMITS = Object.freeze({
  maximumProcesses: 16384,
  maximumOutputBytes: 8 * 1024 ** 2,
  maximumBinaryBytes: 1024 ** 2,
  timeoutMs: 3000,
});
export const DARWIN_INVENTORY_FORMAT = 'SoloDarwinProcessInventoryV3';
export const DARWIN_IDENTITY_KIND = 'private-unique-id-uint64';
const MAX_UINT64 = (1n << 64n) - 1n;
export function parseDarwinInventory(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length <= DARWIN_INVENTORY_LIMITS.maximumOutputBytes);
  const lines = bytes.toString('utf8').split('\n');
  const format = lines.shift(),
    v3 = format === DARWIN_INVENTORY_FORMAT,
    v2 = v3 || format === 'SoloDarwinProcessInventoryV2';
  assert(v2 || format === 'SoloDarwinProcessInventoryV1', 'Darwin inventory format');
  assert.equal(lines.pop(), '', 'Incomplete Darwin inventory output');
  assert(lines.length < DARWIN_INVENTORY_LIMITS.maximumProcesses, 'Darwin process cap');
  const result = new Map();
  for (const line of lines) {
    const fields = line.split('\t');
    assert.equal(fields.length, v3 ? 16 : v2 ? 13 : 9, 'Darwin inventory row fields');
    const [
      pid,
      ppid,
      pgid,
      birth,
      state,
      rss,
      tagged,
      incomplete,
      path,
      euid,
      ruid,
      parentUniqueId,
      version,
      pathStatus,
      rssStatus,
      tagStatus,
    ] = fields;
    for (const number of [pid, ppid, pgid, rss])
      assert(/^\d+$/.test(number) && Number.isSafeInteger(Number(number)), 'Darwin numeric field');
    assert(Number(pid) > 0 && !result.has(Number(pid)), 'Darwin PID identity');
    if (v2) {
      for (const id of [pid, ppid, pgid]) assert(Number(id) <= 0x7fffffff, 'Darwin PID metadata');
      assert(
        /^\d{20}$/.test(birth) && BigInt(birth) > 0n && BigInt(birth) <= MAX_UINT64,
        'Darwin uint64 lifetime identity',
      );
      for (const uid of [euid, ruid])
        assert(
          /^(?:0|[1-9]\d{0,9})$/.test(uid) && Number(uid) <= 0xffffffff,
          'Darwin UID metadata',
        );
      assert(
        /^(?:0|[1-9]\d{0,19})$/.test(parentUniqueId) && BigInt(parentUniqueId) <= MAX_UINT64,
        'Darwin parent lifetime identity',
      );
      assert(
        /^(?:0|[1-9]\d{0,9})$/.test(version) && Number(version) <= 0x7fffffff,
        'Darwin exec version metadata',
      );
    } else assert(/^\d{7,24}$/.test(birth), 'Darwin birth identity');
    assert(['R', 'Z'].includes(state), 'Darwin live state');
    assert(['0', '1'].includes(tagged) && ['0', '1'].includes(incomplete));
    assert(/^(?:[0-9a-f]{2}){0,4096}$/.test(path), 'Darwin executable path bound');
    const argv = Buffer.from(path, 'hex').toString('utf8');
    assert(!argv.includes('\0'), 'Darwin executable path');
    if (v3) {
      assert(['0', '1', '2'].includes(pathStatus) && ['0', '1', '2'].includes(rssStatus));
      assert(['0', '1', '2', '3'].includes(tagStatus));
      const unobserved = pathStatus === '0' && rssStatus === '0' && tagStatus === '0';
      assert(unobserved || (pathStatus !== '0' && rssStatus !== '0'), 'Partial detail observation');
      assert.equal(
        incomplete === '1',
        pathStatus === '2' || rssStatus === '2' || tagStatus === '3',
      );
      assert.equal(tagged === '1', tagStatus === '2', 'Owner tag provenance');
      if (unobserved) assert(argv === '' && rss === '0', 'Unobserved details cannot carry values');
      if (rssStatus !== '1') assert.equal(rss, '0', 'Unknown resident memory is not measured');
      if (pathStatus === '1')
        assert(argv.startsWith('/'), 'Observed executable path must be absolute');
    }
    result.set(Number(pid), {
      pid: Number(pid),
      ppid: Number(ppid),
      pgid: Number(pgid),
      birth,
      state,
      rss: Number(rss),
      argv,
      ownerTagged: tagged === '1',
      inspectionIncomplete: incomplete === '1',
      ...(v3
        ? {
            pathInspection: ['unobserved', 'complete', 'unavailable'][Number(pathStatus)],
            rssInspection: ['unobserved', 'complete', 'unavailable'][Number(rssStatus)],
            ownerTagInspection: ['unobserved', 'absent', 'present', 'unavailable'][
              Number(tagStatus)
            ],
          }
        : {}),
      ...(v2
        ? {
            identityKind: DARWIN_IDENTITY_KIND,
            euid: Number(euid),
            ruid: Number(ruid),
            parentUniqueId,
            version: Number(version),
          }
        : {}),
    });
  }
  return result;
}
// Only the explicit hosted macOS mode supplies this separately built, pinned
// read-only helper. The common process owner retains all admission/signalling.
export function createDarwinProcessInventory(environment = process.env) {
  const binary = environment.SOLO_DARWIN_PROCESS_HELPER;
  const expected = environment.SOLO_DARWIN_PROCESS_HELPER_SHA256;
  assert(binary && resolve(binary) === binary && realpathSync(binary) === binary);
  assert(/^[a-f0-9]{64}$/.test(expected ?? ''), 'Darwin helper hash required');
  const initial = lstatSync(binary);
  assert(initial.isFile() && !initial.isSymbolicLink() && initial.mode & 0o111);
  assert(initial.size <= DARWIN_INVENTORY_LIMITS.maximumBinaryBytes, 'Darwin helper binary cap');
  assert.equal(createHash('sha256').update(readFileSync(binary)).digest('hex'), expected);
  let previous = new Map();
  const snapshot = (selector, token = '') => {
    assert(token === '' || /^[a-f0-9-]{36}$/.test(token), 'Darwin owner token');
    const current = lstatSync(binary);
    assert(
      current.isFile() &&
        current.dev === initial.dev &&
        current.ino === initial.ino &&
        current.size === initial.size &&
        current.mtimeMs === initial.mtimeMs &&
        current.ctimeMs === initial.ctimeMs,
      'Darwin helper identity changed',
    );
    const output = execFileSync(binary, [selector, token], {
      timeout: DARWIN_INVENTORY_LIMITS.timeoutMs,
      maxBuffer: DARWIN_INVENTORY_LIMITS.maximumOutputBytes,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert(
      output.subarray(0, output.indexOf(10)).toString() === DARWIN_INVENTORY_FORMAT,
      'Fresh Darwin helper requires V3 identity and detail provenance',
    );
    const rows = parseDarwinInventory(output);
    for (const row of rows.values()) {
      if (selector === 'all' && row.state !== 'Z') {
        assert(
          row.pathInspection !== 'unobserved' && row.rssInspection !== 'unobserved',
          'Live full inventory omitted detail inspection',
        );
        if (token)
          assert(
            row.ownerTagInspection !== 'unobserved',
            'Live full inventory omitted owner tag inspection',
          );
      }
      const prior = previous.get(row.pid);
      assert(
        !(prior?.birth === row.birth && prior.state === 'Z' && row.state !== 'Z'),
        'Darwin zombie identity returned live',
      );
    }
    if (selector === 'all') previous = new Map(rows);
    else for (const row of rows.values()) previous.set(row.pid, row);
    assert(previous.size < DARWIN_INVENTORY_LIMITS.maximumProcesses, 'Darwin identity history cap');
    return rows;
  };
  return {
    identity: {
      path: binary,
      bytes: initial.size,
      sha256: expected,
      format: DARWIN_INVENTORY_FORMAT,
      identityKind: DARWIN_IDENTITY_KIND,
    },
    all: (token) => snapshot('all', token),
    oneSync: (pid) => {
      assert(Number.isSafeInteger(pid) && pid > 0);
      const rows = snapshot(String(pid));
      assert(rows.size <= 1 && (!rows.size || rows.has(pid)), 'Unexpected Darwin leader identity');
      return rows.get(pid);
    },
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceIdentity = (file) => {
  const bytes = readFileSync(join(here, file));
  return { bytes: bytes.length, sha256: sha256(bytes) };
};
export function admitDarwinBuildReceipt(environment = process.env, sourceRevision) {
  const path = environment.SOLO_DARWIN_PROCESS_BUILD;
  assert(path && realpathSync(path) === path, 'Canonical Darwin build receipt required');
  const info = lstatSync(path);
  assert(
    info.isFile() && !info.isSymbolicLink() && info.size <= 128 * 1024,
    'Darwin build receipt cap',
  );
  const bytes = readFileSync(path);
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.format, 'SoloDarwinInventoryBuildV2');
  assert.equal(receipt.sourceRevision, sourceRevision);
  assert.equal(receipt.platform, 'darwin');
  assert.equal(receipt.inventoryFormat, DARWIN_INVENTORY_FORMAT);
  assert.equal(receipt.identityKind, DARWIN_IDENTITY_KIND);
  for (const file of ['solo-darwin-process-inventory.c', 'solo-darwin-process-inventory.mjs'])
    assert.deepEqual(receipt.sources[file], sourceIdentity(file), 'Darwin source build identity');
  const inventory = createDarwinProcessInventory(environment);
  assert.deepEqual(receipt.binary, inventory.identity, 'Darwin compiled binary identity');
  assert(typeof receipt.compiler.path === 'string' && receipt.compiler.path.startsWith('/'));
  assert(typeof receipt.compiler.version === 'string' && receipt.compiler.version.length <= 65536);
  assert(typeof receipt.sdk.path === 'string' && receipt.sdk.path.startsWith('/'));
  assert(typeof receipt.sdk.version === 'string' && /^\d+(?:\.\d+)*$/.test(receipt.sdk.version));
  assert.deepEqual(receipt.arguments, [
    '-Wall',
    '-Wextra',
    '-Werror',
    '-O2',
    '-isysroot',
    receipt.sdk.path,
    join(here, 'solo-darwin-process-inventory.c'),
    '-o',
    inventory.identity.path,
  ]);
  return { bytes, receipt };
}
export const DARWIN_TOOLCHAIN_DISCOVERY_TIMEOUT_MS = 30000;
// Tool discovery is setup work, independent of the 3-second native inventory bound.
export function discoverDarwinToolchain(execute = execFileSync, now = () => performance.now()) {
  let previous = now();
  assert(Number.isFinite(previous) && previous >= 0, 'Toolchain discovery clock');
  const deadline = previous + DARWIN_TOOLCHAIN_DISCOVERY_TIMEOUT_MS;
  const remaining = () => {
    const current = now();
    assert(Number.isFinite(current) && current >= previous, 'Toolchain discovery clock');
    previous = current;
    assert(current < deadline, 'Toolchain discovery deadline');
    return Math.max(1, Math.floor(deadline - current));
  };
  const capture = (command, args) => {
    const value = execute(command, args, {
      encoding: 'utf8',
      timeout: remaining(),
      maxBuffer: 65536,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    remaining();
    return value.trim();
  };
  const compiler = { path: capture('xcrun', ['--find', 'clang']) };
  compiler.version = capture(compiler.path, ['--version']);
  const sdk = {
    path: capture('xcrun', ['--show-sdk-path']),
    version: capture('xcrun', ['--show-sdk-version']),
  };
  return { compiler, sdk };
}
function build(directory, receiptPath) {
  assert.equal(process.platform, 'darwin');
  assert.equal(realpathSync(directory), directory);
  assert.equal(lstatSync(directory).isDirectory(), true);
  const binary = join(directory, 'inventory');
  assert(!existsSync(binary) && !existsSync(receiptPath), 'Fresh owned build paths required');
  const capture = (command, args) =>
    execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 65536,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const sourceRevision = capture('git', ['-C', resolve(here, '..'), 'rev-parse', 'HEAD']);
  assert.equal(sourceRevision, process.env.SOLO_TOOLING_REVISION);
  const { compiler, sdk } = discoverDarwinToolchain();
  const args = [
    '-Wall',
    '-Wextra',
    '-Werror',
    '-O2',
    '-isysroot',
    sdk.path,
    join(here, 'solo-darwin-process-inventory.c'),
    '-o',
    binary,
  ];
  const sources = Object.fromEntries(
    ['solo-darwin-process-inventory.c', 'solo-darwin-process-inventory.mjs'].map((file) => [
      file,
      sourceIdentity(file),
    ]),
  );
  execFileSync(compiler.path, args, {
    timeout: 30000,
    maxBuffer: 65536,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  chmodSync(binary, 0o500);
  const bytes = readFileSync(binary);
  assert(bytes.length <= DARWIN_INVENTORY_LIMITS.maximumBinaryBytes);
  const receipt = {
    format: 'SoloDarwinInventoryBuildV2',
    sourceRevision,
    platform: process.platform,
    inventoryFormat: DARWIN_INVENTORY_FORMAT,
    identityKind: DARWIN_IDENTITY_KIND,
    compiler,
    sdk,
    arguments: args,
    sources,
    binary: {
      path: binary,
      bytes: bytes.length,
      sha256: sha256(bytes),
      format: DARWIN_INVENTORY_FORMAT,
      identityKind: DARWIN_IDENTITY_KIND,
    },
  };
  const encoded = JSON.stringify(receipt, null, 2) + '\n';
  assert(Buffer.byteLength(encoded) <= 128 * 1024);
  writeFileSync(receiptPath, encoded, { flag: 'wx' });
  assert(process.env.GITHUB_ENV, 'Hosted environment output required');
  appendFileSync(
    process.env.GITHUB_ENV,
    `SOLO_DARWIN_PROCESS_HELPER=${binary}\nSOLO_DARWIN_PROCESS_HELPER_SHA256=${receipt.binary.sha256}\nSOLO_DARWIN_PROCESS_BUILD=${receiptPath}\n`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2], 'build');
  assert.equal(process.argv.length, 5);
  build(...process.argv.slice(3).map((path) => resolve(path)));
}
