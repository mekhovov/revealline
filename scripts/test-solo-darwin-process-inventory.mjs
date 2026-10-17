import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'acorn';
import {
  createDarwinProcessInventory,
  admitDarwinBuildReceipt,
  DARWIN_INVENTORY_LIMITS,
  DARWIN_TOOLCHAIN_DISCOVERY_TIMEOUT_MS,
  discoverDarwinToolchain,
  DARWIN_INVENTORY_FORMAT,
  DARWIN_IDENTITY_KIND,
  parseDarwinInventory,
} from './solo-darwin-process-inventory.mjs';
import {
  isOwnedProcess,
  darwinForeignSystemProcessWitness,
  darwinKnownNonBrowserProcessWitness,
  collectUnattributedProcesses,
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
    'SoloDarwinProcessInventoryV2\n' + rows.map((r) => Object.values(r).join('\t') + '\n').join(''),
  );

const v3row = (change = {}) => ({
  ...v2row(),
  pathStatus: '1',
  rssStatus: '1',
  tagStatus: '1',
  ...change,
});
const v3bytes = (rows = [v3row()]) =>
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

async function helperFixture(t, outputs = [v3bytes().toString()]) {
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
      if (process.env.SOLO_DARWIN_OWNER_EVIDENCE) {
        const bytes = JSON.stringify({ case: id, result }, null, 2) + '\n';
        assert(Buffer.byteLength(bytes) <= 1048576);
        await mkdir(process.env.SOLO_DARWIN_OWNER_EVIDENCE, { recursive: true });
        await writeFile(join(process.env.SOLO_DARWIN_OWNER_EVIDENCE, `${id}.json`), bytes, {
          flag: 'wx',
        });
      }
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
  assert.throws(() => createDarwinProcessInventory(old.environment).all(), /requires V3/);
  const oldV2 = await helperFixture(t, [v2bytes().toString()]);
  assert.throws(() => createDarwinProcessInventory(oldV2.environment).all(), /requires V3/);
  const fixture = await helperFixture(t, [
    v3bytes([v3row({ state: 'Z' })]).toString(),
    v3bytes().toString(),
  ]);
  const inventory = createDarwinProcessInventory(fixture.environment);
  assert.equal(inventory.all().get(42).state, 'Z');
  assert.throws(() => inventory.oneSync(42), /zombie identity returned live/);
  const recycled = await helperFixture(t, [
    v3bytes([v3row({ state: 'Z' })]).toString(),
    v3bytes([v3row({ birth: '00000000000000001043' })]).toString(),
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

test('V3 detail provenance rejects contradictions and preserves legacy absence of evidence', () => {
  const ordinary = parseDarwinInventory(v3bytes()).get(42);
  assert.equal(ordinary.pathInspection, 'complete');
  assert.equal(ordinary.rssInspection, 'complete');
  assert.equal(ordinary.ownerTagInspection, 'absent');
  const unknown = parseDarwinInventory(
    v3bytes([v3row({ rss: '0', incomplete: '1', rssStatus: '2', tagStatus: '3' })]),
  ).get(42);
  assert.equal(unknown.pathInspection, 'complete');
  assert.equal(unknown.inspectionIncomplete, true);
  const identityOnly = parseDarwinInventory(
    v3bytes([v3row({ path: '', rss: '0', pathStatus: '0', rssStatus: '0', tagStatus: '0' })]),
  ).get(42);
  assert.equal(identityOnly.pathInspection, 'unobserved');
  for (const change of [
    { pathStatus: '3' },
    { rssStatus: '-1' },
    { tagStatus: '4' },
    { pathStatus: '0' },
    { rssStatus: '0' },
    { incomplete: '1' },
    { tagged: '1' },
    { tagStatus: '2' },
    { tagStatus: '3' },
    { rssStatus: '2', incomplete: '1' },
    { path: Buffer.from('comm').toString('hex') },
    { pathStatus: '0', rssStatus: '0', tagStatus: '0' },
    { pathStatus: '0', rssStatus: '0', tagStatus: '0', path: '', rss: '0', incomplete: '1' },
  ])
    assert.throws(() => parseDarwinInventory(v3bytes([v3row(change)])), JSON.stringify(change));
  assert.throws(() => parseDarwinInventory(v3bytes().subarray(0, -1)));
  assert.throws(() =>
    parseDarwinInventory(
      Buffer.from(DARWIN_INVENTORY_FORMAT + '\n' + Object.values(v2row()).join('\t') + '\n'),
    ),
  );
  for (const old of [bytes(), v2bytes()])
    assert.equal(parseDarwinInventory(old).get(42).pathInspection, undefined);
});
function foreignModel() {
  const root = (pid, ppid, pgid, birth, parentUniqueId, version) =>
    v3row({
      pid: String(pid),
      ppid: String(ppid),
      pgid: String(pgid),
      birth: String(birth).padStart(20, '0'),
      parentUniqueId: String(parentUniqueId),
      version: String(version),
      euid: '0',
      ruid: '0',
      path: Buffer.from('/system/parent').toString('hex'),
      rss: '0',
      rssStatus: '2',
      tagStatus: '0',
      incomplete: '1',
    });
  const all = parseDarwinInventory(
    v3bytes([
      root(1025, 1, 1017, 1025, 1, 100),
      root(1017, 1, 1017, 1017, 1, 90),
      v3row({
        pid: '5297',
        ppid: '5208',
        pgid: '5297',
        birth: '00000000000000005297',
        parentUniqueId: '5208',
        version: '11092',
      }),
      {
        ...root(5348, 1025, 1017, 5348, 1025, 11196),
        path: Buffer.from('/bin/ps').toString('hex'),
        tagStatus: '3',
      },
    ]),
  );
  return {
    row: all.get(5348),
    all,
    before: new Map([
      [1025, { ...all.get(1025) }],
      [1017, { ...all.get(1017) }],
    ]),
    owned: new Map([[5297, all.get(5297)]]),
    leader: 5297,
    record: { foreignSystemProcesses: [] },
  };
}
const witnessFor = (m) =>
  darwinForeignSystemProcessWitness(m.row, m.before, m.all, m.owned, m.leader);

function observedPsModel(change = {}) {
  // Exact firstAmbiguousInventory row from 39049194885 / artifact12106841810.
  // Parse the actual V3 field values; no fabricated parent/group snapshots.
  const all = parseDarwinInventory(
    v3bytes([
      v3row({
        pid: '3296',
        ppid: '964',
        pgid: '956',
        birth: '00000000000000003296',
        state: 'R',
        rss: '0',
        tagged: '0',
        incomplete: '1',
        path: Buffer.from('/bin/ps').toString('hex'),
        euid: '0',
        ruid: '0',
        parentUniqueId: '964',
        version: '6960',
        pathStatus: '1',
        rssStatus: '2',
        tagStatus: '3',
        ...change,
      }),
      v3row({
        pid: '3266',
        ppid: '3186',
        pgid: '3266',
        birth: '00000000000000003266',
        parentUniqueId: '3186',
        version: '6900',
        tagged: '1',
        tagStatus: '2',
      }),
    ]),
  );
  return {
    row: all.get(3296),
    all,
    before: new Map(),
    owned: new Map([[3266, all.get(3266)]]),
    leader: 3266,
    record: { foreignSystemProcesses: [] },
  };
}
const collectModel = (m, darwin = true) =>
  collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, m.record, darwin);

function observedThermaldModel() {
  // The actual Cocoa prerequisite failure in run39054542040 retained this row.
  // Leader identity below is a modeled non-root owner, not a native observation.
  const m = observedPsModel();
  m.all.delete(m.row.pid);
  m.row = {
    ...m.row,
    pid: 17275,
    ppid: 1,
    pgid: 17275,
    birth: '00000000000000017275',
    argv: '/usr/libexec/thermald',
    parentUniqueId: '1',
    version: 35176,
  };
  m.all.set(m.row.pid, m.row);
  return m;
}

test('retained kernel thermald row has narrow launchd classification, never ownership or readable resource claims', () => {
  const m = observedThermaldModel();
  assert.deepEqual(collectModel(m), []);
  const w = m.record.foreignSystemProcesses[0];
  assert.equal(w.format, 'SoloKnownNonBrowserProcessWitnessV1');
  assert.equal(w.process.executable, '/usr/libexec/thermald');
  assert.equal(w.process.parentUniqueId, '1');
  assert.equal(w.process.version, 35176);
  assert.equal(w.process.rss, null);
  assert.equal(w.process.ownerTagged, null);
  assert.equal(m.row.inspectionIncomplete, true);
  assert.deepEqual([...m.owned.keys()], [3266]);
  assert.deepEqual(collectModel(m, false), [m.row]);
});

test('thermald classification rejects altered executable, lineage, privilege, ownership and kernel provenance', () => {
  for (const mutate of [
    (m) => (m.row.argv = '/usr/libexec/thermald-helper'),
    (m) => (m.row.argv = '/usr/libexec/WebKit'),
    (m) => (m.row.argv = '/usr/libexec/thermald -- browser'),
    (m) => (m.row.ppid = 2),
    (m) => (m.row.parentUniqueId = '2'),
    (m) => (m.row.pgid = 2),
    (m) => (m.row.pgid = m.leader),
    (m) => (m.row.euid = 501),
    (m) => (m.row.ruid = 501),
    (m) => (m.row.pathInspection = 'unavailable'),
    (m) => (m.row.ownerTagged = true),
    (m) => (m.row.ownerTagInspection = 'present'),
    (m) => (m.row.identityKind = 'timestamp'),
    (m) => (m.row.version = -1),
  ]) {
    const m = observedThermaldModel();
    mutate(m);
    assert.deepEqual(collectModel(m), [m.row], String(mutate));
    assert.equal(m.record.foreignSystemProcesses.length, 0);
  }
  const m = observedThermaldModel();
  const unknown = { ...m.row, pid: 17276, birth: '00000000000000017276', argv: '' };
  m.all.set(unknown.pid, unknown);
  assert.deepEqual(collectModel(m), [unknown]);
});

test('exact retained root kernel ps row is non-browser while resource and tag values stay unknown', () => {
  const m = observedPsModel();
  assert.equal(witnessFor(m), null, 'retained row cannot prove the old foreign lineage');
  assert.deepEqual(collectModel(m), []);
  assert.equal(m.record.firstAmbiguousInventory, undefined);
  assert.equal(m.record.foreignSystemProcesses.length, 1);
  const w = m.record.foreignSystemProcesses[0];
  assert.equal(w.format, 'SoloKnownNonBrowserProcessWitnessV1');
  assert.equal(w.process.executable, '/bin/ps');
  assert.equal(w.process.birth, '00000000000000003296');
  assert.equal(w.process.version, 6960);
  assert.equal(w.process.rss, null);
  assert.equal(w.process.ownerTagged, null);
  assert.equal(w.parent, undefined, 'no missing lineage is invented');
  assert.equal(m.row.inspectionIncomplete, true);
  assert.deepEqual([...m.owned.keys()], [3266]);
  assert.deepEqual(collectModel(m), []);
  assert.equal(m.record.foreignSystemProcesses.length, 1);
  assert.deepEqual(collectModel(m, false), [m.row], 'Linux argv never receives kernel-path credit');
});

test('kernel ps classification rejects unknown paths, argv spoofing and incomplete or changed identity', () => {
  for (const mutate of [
    (m) => (m.row.pathInspection = 'unavailable'),
    (m) => (m.row.pathInspection = 'unobserved'),
    (m) => delete m.row.pathInspection,
    (m) => (m.row.argv = 'ps'),
    (m) => (m.row.argv = '/usr/bin/ps'),
    (m) => (m.row.argv = '/bin/ps -- Chromium'),
    (m) => (m.row.argv = '/owned/Chromium'),
    (m) => (m.row.argv = '/owned/WebKitWebProcess'),
    (m) => (m.row.identityKind = 'timestamp'),
    (m) => (m.row.birth = '0'),
    (m) => (m.row.parentUniqueId = undefined),
    (m) => (m.row.parentUniqueId = '18446744073709551616'),
    (m) => (m.row.version = undefined),
    (m) => (m.row.version = -1),
    (m) => (m.row.euid = 501),
    (m) => (m.row.ruid = 501),
    (m) => (m.row.ownerTagged = true),
    (m) => (m.row.ownerTagInspection = 'present'),
    (m) => (m.row.ownerTagInspection = 'unobserved'),
    (m) => (m.row.rssInspection = 'unobserved'),
    (m) => (m.row.rss = 123),
    (m) => (m.row.ppid = 1),
    (m) => (m.row.pgid = 1),
    (m) => delete m.owned.get(m.leader).euid,
    (m) => (m.owned.get(m.leader).ruid = 0),
  ]) {
    const m = observedPsModel();
    mutate(m);
    assert.deepEqual(collectModel(m), [m.row], String(mutate));
    assert.equal(m.record.foreignSystemProcesses.length, 0);
    assert.equal(m.record.firstAmbiguousInventory.ambiguousCount, 1);
  }
  for (const mutate of [(m) => (m.row.ppid = m.leader), (m) => (m.row.pgid = m.leader)]) {
    const m = observedPsModel();
    mutate(m);
    assert.equal(isOwnedProcess(m.row, m.all, m.owned, m.leader, false), true);
    assert.deepEqual(collectModel(m), [m.row]);
  }
});

test('known ps never suppresses simultaneous browser or unknown executable and bounded witness overflow', () => {
  const m = observedPsModel();
  const browser = { ...m.row, pid: 4000, birth: '00000000000000004000', argv: '/app/WebKit' };
  const unknown = {
    ...m.row,
    pid: 4001,
    birth: '00000000000000004001',
    argv: '/bin/ps',
    pathInspection: 'unavailable',
  };
  m.all.set(browser.pid, browser);
  m.all.set(unknown.pid, unknown);
  assert.deepEqual(collectModel(m), [browser, unknown]);
  assert.equal(m.record.firstAmbiguousInventory.row.pid, browser.pid);
  assert.equal(m.record.foreignSystemProcesses.length, 1);
  const cap = observedPsModel();
  for (let i = 0; i < 64; i++)
    cap.all.set(5000 + i, { ...cap.row, pid: 5000 + i, birth: String(5000 + i).padStart(20, '0') });
  assert.equal(collectModel(cap).length, 1);
  assert.equal(cap.record.foreignSystemProcesses.length, 64);
  assert.equal(cap.record.foreignSystemProcessOverflow, true);
  assert.deepEqual([...cap.owned.keys()], [3266]);
});

test('actual owner collection and cancellation keep incomplete owned rows failed and signal only fresh owned lifetimes', async () => {
  const source = await readFile(
    new URL('./run-solo-remote-correctness.mjs', import.meta.url),
    'utf8',
  );
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const owner = ast.body.find(
    (n) => n.type === 'ExportNamedDeclaration' && n.declaration?.id?.name === 'ownedCommand',
  ).declaration;
  const declarations = owner.body.body.filter(
    (n) =>
      n.type === 'VariableDeclaration' &&
      ['collect', 'signalOwned'].includes(n.declarations[0]?.id?.name),
  );
  assert.equal(declarations.length, 2);
  const compiled = new Function(
    'processes',
    'isOwnedProcess',
    'collectUnattributedProcesses',
    'model',
    'signal',
    `
    const {all,before,owned,leader,record}=model;
    const child={pid:leader},darwin=true,ownerToken='modeled';let violation=null;
    const same=(a,b)=>a&&b&&a.pid===b.pid&&a.birth===b.birth;
    const live=row=>row&&!['Z','X'].includes(row.state);
    const process={kill:signal};
    ${declarations.map((n) => source.slice(n.start, n.end)).join('\n')}
    return {collect,signalOwned,violation:()=>violation};
  `,
  );
  for (const recycled of [false, true]) {
    const m = observedPsModel();
    const owned = {
      ...m.row,
      pid: 3300,
      ppid: m.leader,
      pgid: m.leader,
      birth: '00000000000000003300',
      parentUniqueId: String(m.leader),
    };
    m.all.set(owned.pid, owned);
    const kills = [];
    let calls = 0;
    const api = compiled(
      async () => {
        calls++;
        if (recycled && calls >= 3) {
          const changed = new Map(m.all);
          changed.set(owned.pid, { ...owned, birth: '00000000000000999999' });
          return changed;
        }
        return m.all;
      },
      isOwnedProcess,
      collectUnattributedProcesses,
      m,
      (pid, sig) => kills.push({ pid, sig }),
    );
    await api.collect();
    assert.equal(api.violation(), 'owned-process-inspection-incomplete');
    assert.equal(m.owned.has(owned.pid), true);
    assert.equal(m.owned.has(3296), false);
    await api.signalOwned('SIGTERM');
    assert.equal(
      kills.some((k) => k.pid === 3296),
      false,
      'known foreign ps is never signalled',
    );
    assert.equal(
      kills.some((k) => k.pid === owned.pid),
      !recycled,
    );
    assert(kills.every((k) => k.sig === 'SIGTERM' && m.owned.has(k.pid)));
  }
});
test('actual collector retains exact foreign provenance without ownership or Linux exemption', () => {
  const m = foreignModel();
  assert.equal(isOwnedProcess(m.row, m.all, m.owned, m.leader, false), false);
  assert.deepEqual(
    collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, m.record, true),
    [],
  );
  assert.equal(m.record.foreignSystemProcesses.length, 1);
  const w = m.record.foreignSystemProcesses[0];
  assert.equal(w.format, 'SoloForeignSystemProcessWitnessV1');
  assert.equal(w.process.executable, '/bin/ps');
  assert.equal(w.process.pathInspection, 'complete');
  assert.deepEqual(w.parentBefore, w.parent);
  assert.deepEqual(w.groupBefore, w.group);
  assert.equal(w.leader.euid, 501);
  assert(Buffer.byteLength(JSON.stringify(w)) < 2048);
  assert.deepEqual(
    collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, m.record, true),
    [],
  );
  assert.equal(m.record.foreignSystemProcesses.length, 1);
  assert.equal(m.owned.has(m.row.pid), false);
  assert.deepEqual(collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, {}, false), [
    m.row,
  ]);
});
test('foreign rule rejects old ps metadata, unknown descendants, missing leader IDs and lifetime changes', () => {
  for (const change of [
    (m) => delete m.row.pathInspection,
    (m) => (m.row.pathInspection = 'unavailable'),
    (m) => (m.row.pathInspection = 'unobserved'),
    (m) => (m.row.argv = '/usr/bin/ps'),
    (m) => (m.row.argv = '/bin/sh'),
    (m) => (m.row.argv = '/Applications/WebKit.app/WebProcess'),
    (m) => (m.row.ownerTagged = true),
    (m) => (m.row.ownerTagInspection = 'present'),
    (m) => delete m.row.ownerTagInspection,
    (m) => delete m.row.rssInspection,
    (m) => (m.row.euid = 501),
    (m) => (m.row.ruid = 501),
    (m) => (m.row.state = undefined),
    (m) => (m.row.identityKind = 'timestamp'),
    (m) => (m.row.parentUniqueId = '999'),
    (m) => (m.row.ppid = 1),
    (m) => m.before.delete(m.row.ppid),
    (m) => m.before.delete(m.row.pgid),
    (m) => m.all.delete(m.row.ppid),
    (m) => m.all.delete(m.row.pgid),
    (m) => (m.all.get(m.row.ppid).birth = '00000000000000009999'),
    (m) => (m.all.get(m.row.pgid).birth = '00000000000000009999'),
    (m) => m.all.get(m.row.ppid).version++,
    (m) => delete m.all.get(m.row.ppid).version,
    (m) => delete m.before.get(m.row.ppid).version,
    (m) => m.all.get(m.row.pgid).version++,
    (m) => (m.all.get(m.row.ppid).ruid = 501),
    (m) => (m.all.get(m.row.pgid).euid = 501),
    (m) => (m.all.get(m.row.ppid).pgid = 999),
    (m) => (m.all.get(m.row.pgid).pgid = 999),
    (m) => (m.all.get(m.row.ppid).ownerTagged = true),
    (m) => (m.row.pgid = m.leader),
    (m) => (m.row.ppid = m.leader),
    (m) => m.owned.set(m.row.pid, m.row),
    (m) => m.owned.set(m.row.ppid, m.all.get(m.row.ppid)),
    (m) => m.owned.set(m.row.pgid, m.all.get(m.row.pgid)),
    ...[undefined, NaN, -1, 0, 4294967296].flatMap((value) => [
      (m) => (m.owned.get(m.leader).euid = value),
      (m) => (m.owned.get(m.leader).ruid = value),
    ]),
  ]) {
    const m = foreignModel();
    change(m);
    assert.equal(witnessFor(m), null, String(change));
  }
  const m = foreignModel();
  delete m.row.pathInspection;
  delete m.row.rssInspection;
  delete m.row.ownerTagInspection;
  assert.deepEqual(
    collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, m.record, true),
    [m.row],
  );
});
test('foreign witness cap fails closed while leaving owned cleanup collection available', () => {
  const m = foreignModel();
  m.all.delete(m.row.pid);
  for (let i = 0; i < 65; i++) {
    const row = { ...m.row, pid: 6000 + i, birth: String(6000 + i).padStart(20, '0') };
    m.all.set(row.pid, row);
  }
  const ambiguous = collectUnattributedProcesses(
    m.all,
    m.before,
    m.owned,
    m.leader,
    m.record,
    true,
  );
  assert.equal(m.record.foreignSystemProcesses.length, 64);
  assert.equal(m.record.foreignSystemProcessOverflow, true);
  assert.equal(ambiguous.length, 1);
  assert.equal(ambiguous[0].pid, 6064);
  assert.equal(
    collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, m.record, true).length,
    1,
  );
  assert.equal(m.record.foreignSystemProcesses.length, 64);
  assert.equal(m.owned.get(m.leader).pid, 5297);
});
test('actual live owner wires classifier after unchanged resource guard and keeps fresh signal identity', async () => {
  const source = await readFile(
    new URL('./run-solo-remote-correctness.mjs', import.meta.url),
    'utf8',
  );
  assert(
    source.indexOf('record.ambiguous = collectUnattributedProcesses(') >
      source.indexOf('current.some((row) => row.inspectionIncomplete)'),
  );
  assert(source.includes("violation ??= 'owned-process-inspection-incomplete'"));
  assert(source.includes('if (same(row, fresh) && live(fresh))'));
});

test('fresh full-inventory provider rejects identity-only and unobserved-token live output', async (t) => {
  const identityOnly = v3bytes([
    v3row({ path: '', rss: '0', pathStatus: '0', rssStatus: '0', tagStatus: '0' }),
  ]).toString();
  const one = await helperFixture(t, [identityOnly]);
  assert.equal(createDarwinProcessInventory(one.environment).oneSync(42).pid, 42);
  const all = await helperFixture(t, [identityOnly]);
  assert.throws(() => createDarwinProcessInventory(all.environment).all(), /omitted detail/);
  const missingTag = await helperFixture(t, [v3bytes([v3row({ tagStatus: '0' })]).toString()]);
  assert.equal(createDarwinProcessInventory(missingTag.environment).all().size, 1);
  assert.throws(
    () =>
      createDarwinProcessInventory(missingTag.environment).all(
        '01234567-89ab-cdef-0123-456789abcdef',
      ),
    /omitted owner tag/,
  );
});

const commands = [
  ['xcrun', ['--find', 'clang']],
  ['/selected/clang', ['--version']],
  ['xcrun', ['--show-sdk-path']],
  ['xcrun', ['--show-sdk-version']],
];
const values = ['/selected/clang\n', 'selected clang version\n', '/selected/sdk\n', '15.5\n'];
function modeledQueries(durations, failAt = -1, error = new Error('query failed')) {
  let clock = 100;
  const calls = [];
  return {
    calls,
    now: () => clock,
    execute(command, args, options) {
      const index = calls.length;
      calls.push({ command, args, options });
      if (index === failAt) throw error;
      const elapsed = durations[index];
      if (elapsed > options.timeout)
        throw Object.assign(new Error('modeled timeout'), { code: 'ETIMEDOUT' });
      clock += elapsed;
      return values[index];
    },
  };
}

test('discovery admits a slow first query within one shrinking setup budget', () => {
  const model = modeledQueries([7000, 1000, 1000, 1000]);
  assert.deepEqual(discoverDarwinToolchain(model.execute, model.now), {
    compiler: { path: '/selected/clang', version: 'selected clang version' },
    sdk: { path: '/selected/sdk', version: '15.5' },
  });
  assert.deepEqual(
    model.calls.map(({ command, args }) => [command, args]),
    commands,
  );
  assert.deepEqual(
    model.calls.map(({ options }) => options.timeout),
    [30000, 23000, 22000, 21000],
  );
  for (const { options } of model.calls) {
    assert.equal(options.encoding, 'utf8');
    assert.equal(options.maxBuffer, 65536);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
  }
  // This is the observed old setup boundary, modeled without running xcrun.
  const old = modeledQueries([7000]);
  assert.throws(() => old.execute(...commands[0], { timeout: 5000 }), { code: 'ETIMEDOUT' });
});

test('discovery never renews its budget for later metadata queries', () => {
  const model = modeledQueries([25000, 3000, 3000, 1]);
  assert.throws(() => discoverDarwinToolchain(model.execute, model.now), { code: 'ETIMEDOUT' });
  assert.equal(model.calls.length, 3);
  assert.deepEqual(
    model.calls.map(({ options }) => options.timeout),
    [30000, 5000, 2000],
  );
});

test('a returned result at the aggregate deadline fails before the next stage', () => {
  const model = modeledQueries([30000]);
  assert.throws(() => discoverDarwinToolchain(model.execute, model.now), /discovery deadline/);
  assert.equal(model.calls.length, 1);
});

test('query failures keep their original identity and do not retry or discover later fields', () => {
  for (let failAt = 0; failAt < 4; failAt++) {
    const error = Object.assign(new Error('original failure'), {
      code: failAt ? 'ENOENT' : 'ETIMEDOUT',
    });
    const model = modeledQueries([1, 1, 1, 1], failAt, error);
    assert.throws(
      () => discoverDarwinToolchain(model.execute, model.now),
      (actual) => actual === error,
    );
    assert.equal(model.calls.length, failAt + 1);
  }
});

test('invalid, backwards and late clocks cannot create a larger query allowance', () => {
  for (const sequence of [[NaN], [Infinity], [-1], [10, 9], [10, Infinity], [10, 30010]]) {
    let i = 0;
    let calls = 0;
    assert.throws(
      () =>
        discoverDarwinToolchain(
          () => {
            calls++;
          },
          () => sequence[i++],
        ),
      /discovery (?:clock|deadline)/,
    );
    assert.equal(calls, 0);
  }
});

test('setup discovery leaves inventory and compilation bounds separate', async () => {
  assert.equal(DARWIN_INVENTORY_LIMITS.timeoutMs, 3000);
  assert.equal(DARWIN_TOOLCHAIN_DISCOVERY_TIMEOUT_MS, 30000);
  const source = await readFile(
    new URL('./solo-darwin-process-inventory.mjs', import.meta.url),
    'utf8',
  );
  const build = source.slice(source.indexOf('function build('));
  assert.match(build, /const \{ compiler, sdk \} = discoverDarwinToolchain\(\);/);
  assert.match(build, /const sourceRevision = capture\('git'/);
  assert.match(build, /timeout: 5000/);
  assert.match(build, /execFileSync\(compiler.path, args, \{\s+timeout: 30000,/);
  assert.equal(5000 + DARWIN_TOOLCHAIN_DISCOVERY_TIMEOUT_MS + 30000, 65000);
});

test('first ambiguous inventory survives cleanup clearing and later PID reuse without gaining ownership', () => {
  const m = foreignModel();
  m.row.argv = '/Applications/WebKit.app/WebProcess';
  const first = { ...m.row };
  m.record.ambiguous = collectUnattributedProcesses(
    m.all,
    m.before,
    m.owned,
    m.leader,
    m.record,
    true,
  );
  assert.deepEqual(m.record.ambiguous, [m.row]);
  const retained = structuredClone(m.record.firstAmbiguousInventory);
  assert.equal(retained.format, 'SoloFirstAmbiguousInventoryV1');
  assert.equal(retained.row.pid, first.pid);
  assert.equal(retained.row.birth, first.birth);
  assert.equal(retained.row.argv, first.argv);
  assert.equal(retained.row.pathInspection, 'complete');
  assert.equal(retained.row.ownerTagInspection, 'unavailable');
  assert.equal(retained.ambiguousCount, 1);
  assert.equal(retained.additionalRowsOmitted, 0);
  assert.equal(m.owned.has(first.pid), false);
  m.all.delete(first.pid);
  m.record.ambiguous = collectUnattributedProcesses(
    m.all,
    m.before,
    m.owned,
    m.leader,
    m.record,
    true,
  );
  assert.deepEqual(m.record.ambiguous, []);
  assert.deepEqual(m.record.firstAmbiguousInventory, retained);
  m.all.set(first.pid, { ...first, birth: '00000000000000009999', argv: '/other/WebKit' });
  assert.equal(
    collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, m.record, true).length,
    1,
  );
  assert.deepEqual(m.record.firstAmbiguousInventory, retained);
  assert.equal(m.owned.has(first.pid), false);
});

test('first ambiguous evidence is bounded and does not change foreign exemption or empty inventories', () => {
  const m = foreignModel();
  assert.deepEqual(
    collectUnattributedProcesses(m.all, m.before, m.owned, m.leader, m.record, true),
    [],
  );
  assert.equal(m.record.firstAmbiguousInventory, undefined);
  m.row.argv = '/WebKit/' + '\u0000'.repeat(20000);
  for (let i = 0; i < 100; i++) m.all.set(6000 + i, { ...m.row, pid: 6000 + i });
  const ambiguous = collectUnattributedProcesses(
    m.all,
    m.before,
    m.owned,
    m.leader,
    m.record,
    true,
  );
  assert.equal(ambiguous.length, 101);
  const retained = m.record.firstAmbiguousInventory;
  assert.equal(retained.ambiguousCount, 101);
  assert.equal(retained.retainedCount, 1);
  assert.equal(retained.additionalRowsOmitted, 100);
  assert.equal(retained.row.argvCodeUnits, m.row.argv.length);
  assert.equal(retained.row.argv.length, 1024);
  assert.equal(retained.row.argvTruncated, true);
  assert(Buffer.byteLength(JSON.stringify(retained)) < 8192);
  m.row.argv = '/changed';
  assert.notEqual(retained.row.argv, m.row.argv);
});

function observedMetalCompilerModel() {
  // Exact scalar row retained by run39073210308/artifact12116355923. Its full
  // before/all inventory was NOT retained. The surrounding map and non-root
  // leader are controlled models; this test cannot promote that failed run.
  const m = observedPsModel();
  m.all.delete(m.row.pid);
  m.row = {
    ...m.row,
    pid: 15107,
    ppid: 1,
    pgid: 15107,
    birth: '00000000000000015107',
    argv: '/System/Library/Frameworks/Metal.framework/Versions/A/XPCServices/MTLCompilerService.xpc/Contents/MacOS/MTLCompilerService',
    parentUniqueId: '1',
    version: 30818,
  };
  m.all.set(m.row.pid, m.row);
  return m;
}
const metalWitness = (m) =>
  darwinKnownNonBrowserProcessWitness(m.row, m.before, m.all, m.owned, m.leader);

test('retained kernel MetalCompilerService row is classification only with unavailable resources', () => {
  const m = observedMetalCompilerModel();
  assert.equal(m.row.argv.length, 122);
  assert.deepEqual(collectModel(m), []);
  const w = m.record.foreignSystemProcesses[0];
  assert.equal(w.format, 'SoloKnownNonBrowserProcessWitnessV1');
  assert.equal(w.process.executable, m.row.argv);
  assert.equal(w.process.birth, '00000000000000015107');
  assert.equal(w.process.version, 30818);
  assert.equal(w.process.rss, null);
  assert.equal(w.process.ownerTagged, null);
  assert.equal(m.row.inspectionIncomplete, true);
  assert.deepEqual([...m.owned.keys()], [3266]);
  assert.deepEqual(collectModel(m, false), [m.row]);
});

test('Metal classification rejects changed executable, lineage, privilege and unavailable path provenance', () => {
  for (const mutate of [
    (m) => (m.row.argv += '-helper'),
    (m) => (m.row.argv += ' -- WebKit'),
    (m) => (m.row.argv = '/tmp/MTLCompilerService'),
    (m) =>
      (m.row.argv =
        '/System/Library/Frameworks/Metal.framework/Versions/A/XPCServices/MTLCompilerService.xpc/Contents/MacOS/WebKit'),
    (m) => (m.row.ppid = 2),
    (m) => (m.row.parentUniqueId = '2'),
    (m) => (m.row.pgid = 2),
    (m) => (m.row.euid = 501),
    (m) => (m.row.ruid = 501),
    (m) => (m.row.pathInspection = 'unavailable'),
    (m) => (m.row.pathInspection = 'unobserved'),
    (m) => (m.row.ownerTagged = true),
    (m) => (m.row.ownerTagInspection = 'present'),
    (m) => (m.row.ownerTagInspection = 'unobserved'),
    (m) => (m.row.rssInspection = 'unobserved'),
    (m) => (m.row.rss = 1),
    (m) => (m.row.identityKind = 'timestamp'),
    (m) => (m.row.birth = '0'),
    (m) => (m.row.version = -1),
    (m) => delete m.owned.get(m.leader).euid,
    (m) => (m.owned.get(m.leader).ruid = 0),
  ]) {
    const m = observedMetalCompilerModel();
    mutate(m);
    assert.equal(metalWitness(m), null, String(mutate));
    assert.deepEqual(collectModel(m), [m.row], String(mutate));
    assert.equal(m.record.foreignSystemProcesses.length, 0);
  }
  const contradictory = observedMetalCompilerModel();
  contradictory.row.inspectionIncomplete = false;
  assert.equal(metalWitness(contradictory), null);
  // Existing collection considers browser commands or incomplete inspections.
  // This invalid complete/non-browser row gets no new exception or authority;
  // parser consistency remains the boundary before inventory collection.
  assert.deepEqual(collectModel(contradictory), []);
  assert.equal(contradictory.record.foreignSystemProcesses.length, 0);
});

test('Metal classification rejects reused or owned lifetime and mismatched current exec image', () => {
  for (const mutate of [
    (m) => m.before.set(m.row.pid, { ...m.row }),
    (m) => m.owned.set(m.row.pid, { ...m.row }),
    (m) => (m.row.pgid = m.leader),
    (m) => (m.row.ppid = m.leader),
    (m) => m.all.set(m.row.pid, { ...m.row, birth: '00000000000000915107' }),
    (m) => m.all.set(m.row.pid, { ...m.row, version: m.row.version + 1 }),
    (m) => m.all.set(m.row.pid, { ...m.row, argv: '/owned/WebKitWebProcess' }),
    (m) => m.all.set(m.row.pid, { ...m.row, pathInspection: 'unavailable' }),
  ]) {
    const m = observedMetalCompilerModel();
    mutate(m);
    assert.equal(metalWitness(m), null, String(mutate));
    assert.equal(m.record.foreignSystemProcesses.length, 0);
  }
});

test('Metal exception preserves simultaneous unknowns, bounded witness overflow and first failure latch', () => {
  const m = observedMetalCompilerModel();
  const unknown = { ...m.row, pid: 15108, pgid: 15108, birth: '00000000000000015108', argv: '' };
  m.all.set(unknown.pid, unknown);
  assert.deepEqual(collectModel(m), [unknown]);
  assert.equal(m.record.foreignSystemProcesses.length, 1);
  assert.equal(m.record.firstAmbiguousInventory.row.pid, unknown.pid);
  m.all.delete(unknown.pid);
  assert.deepEqual(collectModel(m), []);
  assert.equal(m.record.firstAmbiguousInventory.row.pid, unknown.pid);
  const cap = observedMetalCompilerModel();
  for (let i = 0; i < 64; i++) {
    const pid = 16000 + i;
    cap.all.set(pid, { ...cap.row, pid, pgid: pid, birth: String(pid).padStart(20, '0') });
  }
  assert.equal(collectModel(cap).length, 1);
  assert.equal(cap.record.foreignSystemProcesses.length, 64);
  assert.equal(cap.record.foreignSystemProcessOverflow, true);
  assert.deepEqual([...cap.owned.keys()], [3266]);
});
