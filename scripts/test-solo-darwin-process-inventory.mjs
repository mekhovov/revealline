import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chmod, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createDarwinProcessInventory,
  admitDarwinBuildReceipt,
  DARWIN_INVENTORY_LIMITS,
  DARWIN_INVENTORY_FORMAT,
  DARWIN_IDENTITY_KIND,
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

const v2row = (change = {}) => ({
  ...row({ birth: '00000000000000001042' }),
  euid: '501',
  ruid: '501',
  parentUniqueId: '12',
  version: '1',
  ...change,
});
const v2bytes = (rows = [v2row()]) =>
  Buffer.from(
    DARWIN_INVENTORY_FORMAT + '\n' + rows.map((r) => Object.values(r).join('\t') + '\n').join(''),
  );

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

async function helperFixture(t, outputs = [v2bytes().toString()]) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'darwin-inventory-test-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const binary = join(dir, 'inventory');
  const source = `#!${process.execPath}\nconst fs = require('node:fs'); const path = ${JSON.stringify(join(dir, 'calls'))}; const n = fs.existsSync(path) ? Number(fs.readFileSync(path)) : 0; fs.writeFileSync(path, String(n+1)); const outputs = ${JSON.stringify(outputs)}; process.stdout.write(outputs[Math.min(n, outputs.length-1)]);\n`;
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
  assert.match(source, /a\.unique_id != b\.unique_id/);
  assert.match(source, /a\.version != b\.version/);
  assert.doesNotMatch(source, /PROC_PIDTBSDINFO|PROC_UID_ONLY/);
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
    format: 'SoloDarwinInventoryBuildV2',
    sourceRevision,
    platform: 'darwin',
    inventoryFormat: DARWIN_INVENTORY_FORMAT,
    identityKind: DARWIN_IDENTITY_KIND,
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
      format: DARWIN_INVENTORY_FORMAT,
      identityKind: DARWIN_IDENTITY_KIND,
    },
  };
  const environment = { ...fixture.environment, SOLO_DARWIN_PROCESS_BUILD: path };
  await writeFile(path, JSON.stringify(receipt));
  assert.deepEqual(admitDarwinBuildReceipt(environment, sourceRevision).receipt, receipt);
  for (const mutate of [
    (r) => (r.format = 'SoloDarwinInventoryBuildV1'),
    (r) => (r.inventoryFormat = 'SoloDarwinProcessInventoryV1'),
    (r) => (r.identityKind = 'timestamp'),
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

test('V2 retains exact uint64 lifetime and exec metadata without numeric rounding', () => {
  const parsed = parseDarwinInventory(
    v2bytes([
      v2row({
        birth: '18446744073709551615',
        parentUniqueId: '18446744073709551615',
        euid: '4294967295',
        version: '2147483647',
      }),
    ]),
  ).get(42);
  assert.equal(parsed.birth, '18446744073709551615');
  assert.equal(parsed.parentUniqueId, '18446744073709551615');
  assert.equal(parsed.euid, 4294967295);
  assert.equal(parsed.version, 2147483647);
  assert.equal(parsed.identityKind, DARWIN_IDENTITY_KIND);
  for (const patch of [
    { pid: '2147483648' },
    { ppid: '4294967295' },
    { pgid: '4294967295' },
    { birth: '00000000000000000000' },
    { birth: '18446744073709551616' },
    { birth: '1042' },
    { birth: '0000000000000000104x' },
    { euid: '4294967296' },
    { ruid: '-1' },
    { euid: '0501' },
    { euid: '9007199254740993' },
    { parentUniqueId: '18446744073709551616' },
    { parentUniqueId: '-1' },
    { parentUniqueId: '01' },
    { version: '2147483648' },
    { version: '-1' },
    { version: '01' },
    { version: '1.0' },
  ])
    assert.throws(() => parseDarwinInventory(v2bytes([v2row(patch)])));
  assert.throws(() =>
    parseDarwinInventory(
      v2bytes(Array.from({ length: 16384 }, (_, i) => v2row({ pid: String(i + 1) }))),
    ),
  );
  assert.throws(() =>
    parseDarwinInventory(
      Buffer.from(DARWIN_INVENTORY_FORMAT + '\n' + Object.values(row()).join('\t') + '\n'),
    ),
  );
});

test('fresh helpers cannot admit legacy identities and reject same-lifetime zombie resurrection', async (t) => {
  const old = await helperFixture(t, [bytes().toString()]);
  assert.throws(() => createDarwinProcessInventory(old.environment).all(), /requires V2/);
  const fixture = await helperFixture(t, [
    v2bytes([v2row({ state: 'Z' })]).toString(),
    v2bytes().toString(),
  ]);
  const inventory = createDarwinProcessInventory(fixture.environment);
  assert.equal(inventory.all().get(42).state, 'Z');
  assert.throws(() => inventory.oneSync(42), /zombie identity returned live/);
  const recycled = await helperFixture(t, [
    v2bytes([v2row({ state: 'Z' })]).toString(),
    v2bytes([v2row({ birth: '00000000000000001043' })]).toString(),
  ]);
  const next = createDarwinProcessInventory(recycled.environment);
  next.all();
  assert.equal(next.all().get(42).state, 'R');
});

test('executed V1 sources and declarations remain an immutable independent Git witness', async () => {
  const witnessPath = new URL(
    '../docs/performance/fixtures/solo-darwin-inventory/696-v1-source.json',
    import.meta.url,
  );
  const bytes = await readFile(witnessPath);
  const verify = (bytes) => {
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      'aba62dc9507712104cc766522b21a75fe5110afcad0713be63cc0c8c85ed8d5c',
    );
    const witness = JSON.parse(bytes);
    assert.equal(witness.sourceRevision, '69639b30d985ffa723a4d0c11756b632fc2da5c1');
    assert.equal(witness.tree, 'd022c57efa75dbe7b7aeeca00a1950f61426595b');
    assert.equal(witness.files.length, 5);
    for (const ref of witness.files) {
      assert.match(ref.gitBlob, /^[0-9a-f]{40}$/);
      assert.match(ref.sha256, /^[0-9a-f]{64}$/);
      assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0);
    }
    return witness;
  };
  const witness = verify(bytes);
  for (const ref of witness.files.filter((ref) => ref.path.startsWith('.github/'))) {
    const current = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(current.length, ref.bytes);
    assert.equal(createHash('sha256').update(current).digest('hex'), ref.sha256);
  }
  const changed = JSON.parse(bytes);
  changed.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => verify(Buffer.from(JSON.stringify(changed, null, 2) + '\n')));
});
