import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
  symlink,
  lstat,
  readdir,
  rename,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'acorn';
import {
  admitDefaultBaselineReuse,
  digest,
  evidenceSize,
  liveEvidenceSize,
  functionalResult,
  isOwnedProcess,
  ownedCommand,
  parseProcStat,
  scratchRowPath,
  spawnedLeaderIdentity,
} from './run-solo-remote-correctness.mjs';

const archive = fileURLToPath(new URL('./solo-remote-archive.py', import.meta.url));
const revision = 'a'.repeat(40);
const temporary = async (t) => {
  const path = await mkdtemp(join(tmpdir(), 'solo-hosted-owner-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
};

test('owned short scratch admits Chromium sockets and rejects the observed long path', () => {
  const root = '/home/runner/work/_temp/sc-ABCDEF';
  const path = scratchRowPath(root, 0);
  assert.equal(path, `${root}/r00`);
  const socket = `${path}/org.chromium.Chromium.ABCDEF/SingletonSocket`;
  assert(Buffer.byteLength(socket) < 108, 'Linux Unix socket includes a terminating byte');
  assert.throws(() =>
    scratchRowPath(
      '/home/runner/work/_temp/solo-linux-correctness/work/candidate-worker-chromium',
      0,
    ),
  );
  assert.throws(() => scratchRowPath('/tmp/' + 'é'.repeat(24), 0));
  assert.throws(() => scratchRowPath(root, 100));
  assert.throws(() => scratchRowPath(root, -1));
});

test('independent extraction rejects traversal, symlinks and a mismatched manifest digest', async (t) => {
  const dir = await temporary(t);
  for (const kind of ['traversal', 'symlink', 'digest']) {
    const zip = join(dir, `${kind}.zip`),
      report = join(dir, `${kind}.json`);
    execFileSync('python3', [
      '-c',
      `
import sys, zipfile, json
with zipfile.ZipFile(sys.argv[1], 'w') as z:
 if sys.argv[2] == 'traversal': z.writestr('../escaped', b'bad')
 elif sys.argv[2] == 'symlink':
  i=zipfile.ZipInfo('link'); i.create_system=3; i.external_attr=0o120777<<16; z.writestr(i,b'/tmp/target')
 else:
  z.writestr('file.txt', b'wrong')
  z.writestr('manifest.json', json.dumps({'sourceRevision':sys.argv[3], 'files':[{'path':'file.txt','bytes':5,'sha256':'0'*64}],'totalBytes':5}))
`,
      zip,
      kind,
      revision,
    ]);
    assert.throws(() =>
      execFileSync(
        'python3',
        [archive, 'inner', zip, join(dir, `${kind}-payload`), revision, report],
        { stdio: 'pipe' },
      ),
    );
    const result = JSON.parse(await readFile(report, 'utf8'));
    assert.equal(result.status, 'failed');
  }
  await assert.rejects(readFile(join(dir, 'escaped')));
});

test('valid independent member proof describes exact read-back payload and reconstructed marker', async (t) => {
  const dir = await temporary(t),
    zip = join(dir, 'valid.zip'),
    report = join(dir, 'proof.json');
  execFileSync('python3', [
    '-c',
    `
import sys, zipfile, json, hashlib
b=b'exact payload'
with zipfile.ZipFile(sys.argv[1], 'w') as z:
 z.writestr('nested/file.txt',b)
 z.writestr('manifest.json', json.dumps({'sourceRevision':sys.argv[2], 'files':[{'path':'nested/file.txt','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}],'totalBytes':len(b)}))
`,
    zip,
    revision,
  ]);
  execFileSync('python3', [archive, 'inner', zip, join(dir, 'payload'), revision, report]);
  const result = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(result.status, 'passed');
  assert.equal(result.verifiedMembers, 2);
  assert.equal(result.markerReconstructed, true);
  assert.equal(await readFile(join(dir, 'payload/nested/file.txt'), 'utf8'), 'exact payload');
});

test('numerical failure is retained separately; replay and clean owner remain mandatory', () => {
  const row = { kind: 'first30', engine: 'chromium' };
  const raw = {
    scenarioStatus: 'pass',
    sourceRevision: revision,
    buildIdentity: { sourceRevision: revision },
    environment: { browserVersion: 'pinned', engine: 'chromium', contextMode: 'ephemeral' },
    pageErrors: [],
    performanceGateStatus: 'fail',
    replay: {
      nativeVerification: { status: 'pass', browserVersion: 'pinned', engine: 'chromium' },
    },
  };
  const command = { status: 'closed', exitCode: 2 };
  assert.equal(functionalResult(row, raw, command, revision), true);
  assert.equal(raw.performanceGateStatus, 'fail');
  assert.equal(functionalResult(row, { ...raw, replay: null }, command, revision), false);
  assert.equal(functionalResult(row, { ...raw, pageErrors: ['error'] }, command, revision), false);
  assert.equal(functionalResult(row, raw, { ...command, status: 'failed' }, revision), false);
});

test('Linux stat parsing preserves process birth even when command contains parentheses', () => {
  const fields = ['S', '4', '9', '9', ...Array(15).fill('0'), '123456', '0', '7'];
  assert.deepEqual(parseProcStat(`42 (odd (command)) ${fields.join(' ')}`), {
    pid: 42,
    state: 'S',
    ppid: 4,
    pgid: 9,
    birth: '123456',
    rss: 28672,
  });
});

test('a reused leader or parent PID does not grant process ownership', () => {
  const old = { pid: 42, birth: '100' },
    reused = { pid: 42, birth: '200' };
  const owned = new Map([[42, old]]),
    all = new Map([[42, reused]]);
  const child = { pid: 43, ppid: 42, pgid: 42 };
  assert.equal(isOwnedProcess(child, all, owned, 42, false), false);
  assert.equal(isOwnedProcess(child, all, owned, 42, true), true);
  all.set(42, old);
  assert.equal(isOwnedProcess(child, all, owned, 42, false), true);
});

test('a spawned leader needs direct-parent, detached-group and fresh birth evidence', () => {
  const leader = { pid: 42, ppid: 12, pgid: 42, birth: '200' };
  const before = new Map();
  assert.equal(spawnedLeaderIdentity(leader, 42, 12, before), true);
  for (const changed of [
    { pid: 43 },
    { ppid: 13 },
    { pgid: 41 },
    { birth: undefined },
    { birth: 'invalid' },
  ])
    assert.equal(spawnedLeaderIdentity({ ...leader, ...changed }, 42, 12, before), false);
  before.set(42, leader);
  assert.equal(spawnedLeaderIdentity(leader, 42, 12, before), false);
  // Once captured, a reused leader PID cannot transfer ownership of its group.
  const reused = { ...leader, birth: '201' };
  assert.equal(
    isOwnedProcess(reused, new Map([[42, reused]]), new Map([[42, leader]]), 42, false),
    false,
  );
});

test(
  'short Linux browser-named leaders retain their birth even after environment retirement',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const dir = await temporary(t);
    for (let i = 0; i < 3; i++) {
      const result = await ownedCommand(
        [
          process.execPath,
          '-e',
          'process.title="chromium-version-control"; console.log("version-control")',
        ],
        {
          cwd: dir,
          env: process.env,
          log: join(dir, `version-${i}.log`),
          timeoutMs: 10000,
        },
      );
      assert.equal(result.status, 'closed');
      assert.equal(result.initialLeaderCapture, 'direct-child-birth');
      assert(
        result.tracked.some(
          (row) => row.ppid === process.pid && row.pgid === row.pid && /^\d+$/.test(row.birth),
        ),
      );
      assert.deepEqual(result.ambiguous, []);
      assert.deepEqual(result.survivors, []);
      assert.equal(result.forcedCleanup, false);
    }
  },
);

test(
  'real Linux deadline drains owned child and cannot report a passing cleanup',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const dir = await temporary(t);
    const result = await ownedCommand([process.execPath, '-e', 'setInterval(()=>{},1000)'], {
      cwd: dir,
      env: process.env,
      log: join(dir, 'timeout.log'),
      timeoutMs: 100,
      receipt: join(dir, 'timeout.json'),
    });
    assert.equal(result.status, 'failed');
    assert.equal(result.violation, 'deadline');
    assert.equal(result.forcedCleanup, true);
    assert.deepEqual(result.survivors, []);
    assert.deepEqual(result.ambiguous, []);
  },
);

test(
  'real Linux detached descendant is owned after leader exit and blocks clean completion',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'solo-hosted-descendant-test-'));
    t.after(async () => {
      try {
        const original = parseProcStat(await readFile(join(dir, 'child.stat'), 'utf8'));
        try {
          const current = parseProcStat(await readFile(`/proc/${original.pid}/stat`, 'utf8'));
          if (current.birth === original.birth && !['Z', 'X'].includes(current.state))
            process.kill(current.pid, 'SIGKILL');
        } catch (error) {
          if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
    const result = await ownedCommand(
      [
        process.execPath,
        '-e',
        "const {spawn}=require('node:child_process'),fs=require('node:fs'); const p=spawn(process.execPath,['-e','setTimeout(()=>process.exit(0),20000);setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});fs.writeFileSync('child.stat',fs.readFileSync('/proc/'+p.pid+'/stat'));p.unref();",
      ],
      {
        cwd: dir,
        env: process.env,
        log: join(dir, 'descendant.log'),
        timeoutMs: 3000,
        receipt: join(dir, 'descendant.json'),
      },
    );
    assert.equal(result.status, 'failed');
    assert.equal(result.forcedCleanup, true);
    assert(result.tracked.length >= 1);
    assert.deepEqual(result.survivors, []);
    assert.deepEqual(result.ambiguous, []);
  },
);

test(
  'post-exit resource failure remains failed after otherwise clean command',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const dir = await temporary(t);
    const result = await ownedCommand([process.execPath, '-e', 'process.exit(0)'], {
      cwd: dir,
      env: process.env,
      log: join(dir, 'inspect.log'),
      timeoutMs: 3000,
      inspect: async () => {
        throw Error('retained-output-cap');
      },
    });
    assert.equal(result.status, 'failed');
    assert.match(result.violation, /retained-output-cap/);
    assert.deepEqual(result.survivors, []);
  },
);

test('default first-eight reuse admits exactly the pinned helper before shared reuse dispatch', async (t) => {
  const dir = await realpath(await temporary(t));
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'evidence'));
  const helper = join(dir, 'scripts/solo-remote-baseline.mjs');
  await writeFile(helper, 'throw new Error("admission must not execute this module");\n');
  const plan = {
    format: 'SoloHostedCorrectnessPlan.v1',
    baseline: { reusableArtifact: { producer: 'later validated by original reuse branch' } },
    adapterInputs: [{ path: 'scripts/solo-remote-baseline.mjs', ...(await digest(helper)) }],
  };
  assert.equal(await admitDefaultBaselineReuse(plan, dir, join(dir, 'evidence')), true);
  assert.deepEqual(
    await readFile(join(dir, 'evidence/solo-remote-baseline.mjs')),
    await readFile(helper),
  );
  await assert.rejects(admitDefaultBaselineReuse(plan, dir, join(dir, 'evidence')), {
    code: 'EEXIST',
  });
});

test('fresh first-eight plans do not import or require reuse authority', async () => {
  assert.equal(await admitDefaultBaselineReuse({ baseline: {} }, '/missing', '/missing'), false);
});

test('default reuse rejects missing/changed helper, publication conflict, aliases and extra inputs', async (t) => {
  const dir = await realpath(await temporary(t));
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'evidence'));
  const helper = join(dir, 'scripts/solo-remote-baseline.mjs');
  await writeFile(helper, 'exact helper bytes\n');
  const plan = {
    format: 'SoloHostedCorrectnessPlan.v1',
    baseline: { reusableArtifact: {} },
    adapterInputs: [{ path: 'scripts/solo-remote-baseline.mjs', ...(await digest(helper)) }],
  };
  for (const mutate of [
    (p) => delete p.adapterInputs,
    (p) => p.adapterInputs.push(p.adapterInputs[0]),
    (p) => (p.adapterInputs[0].sha256 = '0'.repeat(64)),
    (p) => p.adapterInputs[0].bytes++,
    (p) => (p.adapterInputs[0].path = 'scripts/other.mjs'),
    (p) => (p.baseline.publishVerifiedNormal = true),
    (p) => (p.baseline.publisher = {}),
    (p) => (p.format = 'SoloHostedOfflinePairPlan.v1'),
  ]) {
    const input = structuredClone(plan);
    mutate(input);
    await assert.rejects(admitDefaultBaselineReuse(input, dir, join(dir, 'evidence')));
  }
  await rm(helper);
  await assert.rejects(admitDefaultBaselineReuse(plan, dir, join(dir, 'evidence')));
  await writeFile(join(dir, 'actual.mjs'), 'exact helper bytes\n');
  await symlink(join(dir, 'actual.mjs'), helper);
  await assert.rejects(admitDefaultBaselineReuse(plan, dir, join(dir, 'evidence')), /alias/);
});

test('live evidence sizing preserves atomic partial-report rename without waiving settled readback', async (t) => {
  const dir = await temporary(t),
    partial = join(dir, 'report.json.partial'),
    final = join(dir, 'report.json');
  await writeFile(partial, 'retained report');
  let moved = false;
  const filesystem = {
    readdir,
    async lstat(path) {
      if (path === partial && !moved) {
        moved = true;
        await rename(partial, final);
      }
      return lstat(path);
    },
  };
  assert.equal(await liveEvidenceSize(dir, filesystem), 0);
  assert.equal(await evidenceSize(dir), Buffer.byteLength('retained report'));
  assert.equal(await readFile(final, 'utf8'), 'retained report');
  await rename(final, partial);
  moved = false;
  await assert.rejects(evidenceSize(dir, { filesystem }), { code: 'ENOENT' });
  await rm(final);
  assert.equal(await evidenceSize(dir, { transient: true }), 0);
  await assert.rejects(readFile(final), { code: 'ENOENT' });
});

test('live evidence sizing tolerates only disappearing enumerated descendants', async (t) => {
  const dir = await temporary(t),
    child = join(dir, 'temporary');
  await mkdir(child);
  await writeFile(join(child, 'file'), 'temporary');
  const filesystem = {
    lstat,
    async readdir(path) {
      if (path === child) await rm(child, { recursive: true });
      return readdir(path);
    },
  };
  assert.equal(await evidenceSize(dir, { transient: true, filesystem }), 0);
  await assert.rejects(evidenceSize(join(dir, 'missing'), { transient: true }), { code: 'ENOENT' });
  await writeFile(join(dir, 'file'), 'data');
  const denied = {
    readdir,
    lstat(path) {
      if (path !== dir) throw Object.assign(new Error('denied'), { code: 'EACCES' });
      return lstat(path);
    },
  };
  await assert.rejects(evidenceSize(dir, { transient: true, filesystem: denied }), {
    code: 'EACCES',
  });
  await symlink(join(dir, 'missing'), join(dir, 'link'));
  await assert.rejects(evidenceSize(dir, { transient: true }), /Evidence symlink/);
});

test('evidence root disappearance and replacement remain failures during live sizing', async (t) => {
  for (const replace of [false, true]) {
    const dir = await temporary(t);
    let enumerated = false;
    const filesystem = {
      lstat,
      async readdir(path) {
        const names = await readdir(path);
        if (!enumerated) {
          enumerated = true;
          await rename(dir, dir + '-old');
          t.after(() => rm(dir + '-old', { recursive: true, force: true }));
          if (replace) await mkdir(dir);
        }
        return names;
      },
    };
    await assert.rejects(
      evidenceSize(dir, { transient: true, filesystem }),
      replace ? /Evidence root identity changed/ : { code: 'ENOENT' },
    );
  }
});

test('disappearing evidence names still consume the existing file-count cap', async (t) => {
  const dir = await temporary(t);
  const filesystem = {
    lstat,
    readdir: async () => Array.from({ length: 2001 }, (_, i) => `gone-${i}`),
  };
  await assert.rejects(
    evidenceSize(dir, { transient: true, filesystem }),
    /Evidence file-count cap/,
  );
});

test('common live callbacks and adapter context use the rename-safe wrapper while settled checks stay strict', async () => {
  const source = await readFile(
    new URL('./run-solo-remote-correctness.mjs', import.meta.url),
    'utf8',
  );
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const calls = [],
    mappings = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      ['evidenceSize', 'liveEvidenceSize'].includes(node.callee.name)
    )
      calls.push(node);
    if (node.type === 'Property' && node.key.name === 'evidenceSize') mappings.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(tree);
  assert.deepEqual(
    mappings.map((node) => node.value.name),
    ['liveEvidenceSize'],
  );
  // Aggregate/profile admission and the default row's owned callback are live.
  assert.deepEqual(
    calls
      .filter((node) => node.callee.name === 'liveEvidenceSize')
      .map((node) => node.arguments[0].name),
    ['evidence', 'profileEvidence', 'dir'],
  );
  const strict = calls.filter((node) => node.callee.name === 'evidenceSize');
  assert.equal(strict.length, 4);
  assert.equal(strict[0].arguments[0].name, 'root');
  assert(
    strict[0].arguments[1].properties.some(
      (node) => node.key.name === 'transient' && node.value.value === true,
    ),
  );
  // The only other calls are settled row size, aggregate and profile finalization.
  assert.deepEqual(
    strict.slice(1).map((node) => [node.arguments.length, node.arguments[0].name]),
    [
      [1, 'dir'],
      [1, 'evidence'],
      [1, 'profileEvidence'],
    ],
  );
});
