import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  functionalResult,
  isOwnedProcess,
  ownedCommand,
  parseProcStat,
  scratchRowPath,
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
