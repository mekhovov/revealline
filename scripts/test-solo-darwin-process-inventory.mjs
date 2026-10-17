import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chmod, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createDarwinProcessInventory,
  admitDarwinBuildReceipt,
  DARWIN_INVENTORY_LIMITS,
  parseDarwinInventory,
} from './solo-darwin-process-inventory.mjs';
import {
  isOwnedProcess,
  ownedCommand,
  spawnedLeaderIdentity,
} from './run-solo-remote-correctness.mjs';

const header = 'SoloDarwinProcessInventoryV1\n';
const row = (change = {}) => ({
  pid: '42',
  ppid: '12',
  pgid: '42',
  birth: '1729160000123456',
  state: 'R',
  rss: '2048',
  tagged: '0',
  incomplete: '0',
  path: Buffer.from('/owned/Playwright.app/WebKitWebProcess').toString('hex'),
  ...change,
});
const bytes = (rows = [row()]) =>
  Buffer.from(header + rows.map((r) => Object.values(r).join('\t') + '\n').join(''));

test('Darwin inventory retains exact birth, executable identity and only an owner tag bit', () => {
  const parsed = parseDarwinInventory(
    bytes([row({ tagged: '1' }), row({ pid: '43', state: 'Z', path: '', rss: '0' })]),
  );
  const leader = parsed.get(42);
  assert.equal(leader.birth, '1729160000123456');
  assert.equal(leader.rss, 2048);
  assert.equal(leader.argv, '/owned/Playwright.app/WebKitWebProcess');
  assert.equal(leader.ownerTagged, true);
  assert.equal(parsed.get(43).state, 'Z');
  assert.equal(spawnedLeaderIdentity(leader, 42, 12, new Map()), true);
  assert.equal(spawnedLeaderIdentity(leader, 42, 12, parsed), false);
  const recycled = { ...leader, birth: '1729160000123457' };
  assert.equal(
    isOwnedProcess(
      { pid: 44, ppid: 42, pgid: 42 },
      new Map([[42, recycled]]),
      new Map([[42, leader]]),
      42,
      false,
    ),
    false,
  );
});

test('Darwin parsing rejects partial, duplicate, unsafe, malformed and saturated inventories', () => {
  for (const value of [
    Buffer.from(header.trimEnd()),
    bytes().subarray(0, -1),
    Buffer.from('wrong\n'),
    bytes([row(), row()]),
    ...[
      { pid: '0' },
      { rss: '-1' },
      { rss: '9007199254740992' },
      { birth: 'invalid' },
      { state: 'unknown' },
      { tagged: 'yes' },
      { incomplete: '2' },
      { path: 'ffz' },
      { path: '00' },
      { path: 'ab'.repeat(4097) },
    ].map((patch) => bytes([row(patch)])),
    bytes(Array.from({ length: 16384 }, (_, i) => row({ pid: String(i + 1) }))),
    Buffer.alloc(DARWIN_INVENTORY_LIMITS.maximumOutputBytes + 1),
  ])
    assert.throws(() => parseDarwinInventory(value));
  assert.equal(parseDarwinInventory(Buffer.from(header)).size, 0);
});

test('Darwin incomplete native inspection stays explicit, never fabricated as zero-cost healthy state', () => {
  const parsed = parseDarwinInventory(bytes([row({ incomplete: '1', rss: '0' })]));
  assert.equal(parsed.get(42).inspectionIncomplete, true);
});

async function helperFixture(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'darwin-inventory-test-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const binary = join(dir, 'inventory');
  const source = `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(bytes().toString())});\n`;
  await writeFile(binary, source, { mode: 0o700 });
  return {
    dir,
    binary,
    source,
    environment: {
      SOLO_DARWIN_PROCESS_HELPER: binary,
      SOLO_DARWIN_PROCESS_HELPER_SHA256: createHash('sha256').update(source).digest('hex'),
    },
  };
}

test('Darwin helper is pinned, bounded, canonical and rechecked before every snapshot', async (t) => {
  const fixture = await helperFixture(t);
  const inventory = createDarwinProcessInventory(fixture.environment);
  assert.equal(inventory.oneSync(42).pid, 42);
  assert.equal(inventory.all('01234567-89ab-cdef-0123-456789abcdef').get(42).rss, 2048);
  assert.throws(() => inventory.oneSync(43), /Unexpected/);
  assert.throws(() => inventory.all('untrusted-tag'), /token/);
  assert.throws(() =>
    createDarwinProcessInventory({
      ...fixture.environment,
      SOLO_DARWIN_PROCESS_HELPER_SHA256: '0'.repeat(64),
    }),
  );
  assert.throws(() =>
    createDarwinProcessInventory({
      ...fixture.environment,
      SOLO_DARWIN_PROCESS_HELPER: 'relative',
    }),
  );
  const alias = join(fixture.dir, 'alias');
  await symlink(fixture.binary, alias);
  assert.throws(() =>
    createDarwinProcessInventory({ ...fixture.environment, SOLO_DARWIN_PROCESS_HELPER: alias }),
  );
  await writeFile(fixture.binary, fixture.source + '// changed\n');
  assert.throws(() => inventory.all(), /identity changed/);
  await chmod(fixture.binary, 0o600);
  assert.throws(() => createDarwinProcessInventory(fixture.environment));
});

test('native Darwin SDK source contains bounded, double-checked identity and private tag-only output', async () => {
  const source = await readFile(
    new URL('./solo-darwin-process-inventory.c', import.meta.url),
    'utf8',
  );
  assert.match(source, /#define MAX_PIDS 16384/);
  assert.match(source, /#define MAX_ARGS \(2 \* 1024 \* 1024\)/);
  assert.match(source, /first\.pbi_start_tvusec != last\.pbi_start_tvusec/);
  assert.match(source, /KERN_PROCARGS2/);
  assert.doesNotMatch(source, /\bkill\(|\bprintf\([^\n]*expected|\bprintf\([^\n]*bytes/);
});

test(
  'hosted Darwin native owner closes a short leader and rejects forced deadline cleanup',
  {
    skip: process.platform !== 'darwin' || process.env.SOLO_RUN_DARWIN_OWNER_TESTS !== '1',
    timeout: 60000,
  },
  async (t) => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'darwin-owner-test-')));
    t.after(() => rm(dir, { recursive: true, force: true }));
    for (const [id, script, timeoutMs] of [
      ['normal', 'console.log("short owned leader")', 10000],
      ['deadline', 'setInterval(()=>{},1000)', 100],
    ]) {
      const result = await ownedCommand([process.execPath, '-e', script], {
        cwd: dir,
        env: process.env,
        log: join(dir, `${id}.log`),
        timeoutMs,
      });
      assert.equal(result.processInventory.platform, 'darwin');
      assert.equal(result.initialLeaderCapture, 'direct-child-birth');
      assert.deepEqual(result.survivors, []);
      assert.deepEqual(result.ambiguous, []);
      assert.equal(result.status, id === 'normal' ? 'closed' : 'failed');
      assert.equal(result.forcedCleanup, id !== 'normal');
      assert.equal(result.violation, id === 'normal' ? null : 'deadline');
    }
  },
);

test(
  'SDK fault controls distinguish explicit exit, partial reads, permission and unavailable owner tags',
  {
    skip: process.platform !== 'darwin',
    timeout: 30000,
  },
  async (t) => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'darwin-sdk-fault-test-')));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const source = fileURLToPath(new URL('./solo-darwin-process-inventory.c', import.meta.url));
    const fixture = join(dir, 'faults.c'),
      binary = join(dir, 'faults');
    // Compile the production functions with deterministic SDK return values. The
    // production helper gains no fault flags and these controls never signal.
    await writeFile(
      fixture,
      `
#define main inventory_main
#define proc_pidinfo fixture_pidinfo
#define proc_pidpath fixture_pidpath
#define proc_listpids fixture_listpids
#define sysctl fixture_sysctl
#include ${JSON.stringify(source)}
#undef main
static const char *mode;
static int identities;
int fixture_pidinfo(int pid, int flavor, uint64_t arg, void *buffer, int count) {
  (void)arg; (void)count;
  if (flavor == PROC_PIDTBSDINFO) {
    identities++;
    if (!strcmp(mode, "gone-first") || (!strcmp(mode, "gone-second") && identities == 2)) { errno = ESRCH; return 0; }
    if (!strcmp(mode, "permission")) { errno = EPERM; return 0; }
    if (!strcmp(mode, "zero-no-errno")) { errno = 0; return 0; }
    if (!strcmp(mode, "partial-esrch")) { errno = ESRCH; return sizeof(struct proc_bsdinfo) - 1; }
    struct proc_bsdinfo *value = buffer;
    memset(value, 0, sizeof(*value));
    value->pbi_pid = pid; value->pbi_ppid = 12; value->pbi_pgid = pid; value->pbi_status = SRUN;
    value->pbi_start_tvsec = 1729160000; value->pbi_start_tvusec = 123456;
    if (!strcmp(mode, "recycled-second") && identities == 2) value->pbi_start_tvusec++;
    return sizeof(*value);
  }
  if (!strcmp(mode, "partial-task")) { errno = ESRCH; return sizeof(struct proc_taskinfo) - 1; }
  struct proc_taskinfo *value = buffer; memset(value, 0, sizeof(*value)); value->pti_resident_size = 2048;
  return sizeof(*value);
}
int fixture_pidpath(int pid, void *buffer, uint32_t count) {
  (void)pid;
  return snprintf(buffer, count, "/owned/WebKitWebProcess");
}
int fixture_listpids(uint32_t type, uint32_t info, void *buffer, int count) {
  (void)type; (void)info; (void)buffer; (void)count; return 0;
}
int fixture_sysctl(int *name, u_int namelen, void *oldp, size_t *oldlenp, void *newp, size_t newlen) {
  (void)name; (void)namelen; (void)newp; (void)newlen;
  if (!strcmp(mode, "tag-denied")) { errno = EPERM; return -1; }
  int argc = !strcmp(mode, "tag-truncated") ? 0 : 1;
  memcpy(oldp, &argc, sizeof(argc));
  if (!strcmp(mode, "tag-truncated")) { *oldlenp = sizeof(argc); return 0; }
  const char present[] = "/bin/node\\0\\0node\\0SOLO_REMOTE_OWNER=01234567-89ab-cdef-0123-456789abcdef\\0";
  const char absent[] = "/bin/node\\0\\0node\\0UNRELATED=value\\0";
  const char *bytes = !strcmp(mode, "tag-absent") ? absent : present;
  size_t size = !strcmp(mode, "tag-absent") ? sizeof(absent) : sizeof(present);
  memcpy((char *)oldp + sizeof(argc), bytes, size); *oldlenp = sizeof(argc) + size; return 0;
}
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  mode = argv[1]; puts("SoloDarwinProcessInventoryV1");
  row(42, "01234567-89ab-cdef-0123-456789abcdef", 0); return 0;
}
`,
    );
    execFileSync('xcrun', ['clang', '-Wall', '-Wextra', '-Werror', fixture, '-o', binary], {
      timeout: 10000,
      maxBuffer: 65536,
    });
    const capture = (mode) =>
      parseDarwinInventory(execFileSync(binary, [mode], { timeout: 1000, maxBuffer: 65536 }));
    for (const mode of ['gone-first', 'gone-second', 'recycled-second'])
      assert.equal(capture(mode).size, 0);
    for (const mode of ['permission', 'zero-no-errno', 'partial-esrch'])
      assert.throws(
        () => capture(mode),
        (error) => {
          assert.equal(error.status, 1, 'Uncertain identity still aborts the inventory');
          const diagnostic = error.stderr.toString('utf8');
          assert.match(
            diagnostic,
            /process identity inspection \(\d+\) pid=42 selector=all result=\d+ expected=\d+/,
          );
          assert(!diagnostic.includes('SOLO_REMOTE_OWNER'));
          assert(!diagnostic.includes('01234567-89ab-cdef-0123-456789abcdef'));
          assert(diagnostic.length < 512);
          return true;
        },
      );
    for (const mode of ['tag-denied', 'tag-truncated', 'partial-task'])
      assert.equal(capture(mode).get(42).inspectionIncomplete, true);
    assert.equal(capture('tag-absent').get(42).ownerTagged, false);
    assert.equal(capture('tag-absent').get(42).inspectionIncomplete, false);
    assert.equal(capture('tag-present').get(42).ownerTagged, true);
    assert.equal(capture('tag-present').get(42).inspectionIncomplete, false);
  },
);

test('Cocoa helper build admission requires exact current sources, invocation and binary', async (t) => {
  const fixture = await helperFixture(t);
  const path = join(fixture.dir, 'build.json');
  const sourceRevision = 'a'.repeat(40);
  const sources = {};
  for (const file of ['solo-darwin-process-inventory.c', 'solo-darwin-process-inventory.mjs']) {
    const bytes = await readFile(new URL(file, import.meta.url));
    sources[file] = {
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  const receipt = {
    format: 'SoloDarwinInventoryBuildV1',
    sourceRevision,
    platform: 'darwin',
    sources,
    compiler: { path: '/sdk/clang', version: 'declared compiler' },
    sdk: { path: '/sdk/MacOSX.sdk', version: '15.0' },
    arguments: [
      '-Wall',
      '-Wextra',
      '-Werror',
      '-O2',
      '-isysroot',
      '/sdk/MacOSX.sdk',
      fileURLToPath(new URL('./solo-darwin-process-inventory.c', import.meta.url)),
      '-o',
      fixture.binary,
    ],
    binary: {
      path: fixture.binary,
      bytes: Buffer.byteLength(fixture.source),
      sha256: fixture.environment.SOLO_DARWIN_PROCESS_HELPER_SHA256,
    },
  };
  const environment = { ...fixture.environment, SOLO_DARWIN_PROCESS_BUILD: path };
  await writeFile(path, JSON.stringify(receipt));
  assert.deepEqual(admitDarwinBuildReceipt(environment, sourceRevision).receipt, receipt);
  for (const mutate of [
    (r) => (r.sourceRevision = 'b'.repeat(40)),
    (r) => (r.platform = 'linux'),
    (r) => r.sources['solo-darwin-process-inventory.c'].bytes++,
    (r) => (r.sources['solo-darwin-process-inventory.mjs'].sha256 = '0'.repeat(64)),
    (r) => (r.binary.sha256 = '0'.repeat(64)),
    (r) => r.arguments.push('-DUNDECLARED'),
    (r) => (r.sdk.path = '/another-sdk'),
    (r) => (r.compiler.version = 'x'.repeat(65537)),
  ]) {
    const changed = structuredClone(receipt);
    mutate(changed);
    await writeFile(path, JSON.stringify(changed));
    assert.throws(() => admitDarwinBuildReceipt(environment, sourceRevision));
  }
});
