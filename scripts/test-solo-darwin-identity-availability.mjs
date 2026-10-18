import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  AVAILABILITY_LIMITS,
  parseIdentityAvailability,
  summarizeIdentityAvailability,
  assessIdentityAvailability,
} from './solo-darwin-identity-availability.mjs';
const row = (patch = {}) => ({
  pid: '42',
  em: '1',
  rm: '1',
  status: 'consistent',
  stage: '-1',
  result: '0',
  error: '0',
  ppid: '12',
  pgid: '42',
  euid: '501',
  ruid: '501',
  unique: '18446744073709551614',
  parent: '12',
  version: '1',
  ...patch,
});
const bytes = (rows = [row()], counts = [rows.length, 1, 1]) =>
  Buffer.from(
    `SoloDarwinIdentityAvailabilityV1\t501\t501\t${counts.join('\t')}\n${rows.map((r) => Object.values(r).join('\t') + '\n').join('')}`,
  );
const closed = { status: 0, error: null, signal: null };

test('UID-filter omission remains visible in global rows and never grants owner authority', () => {
  const observation = parseIdentityAvailability(
    bytes(
      [
        row(),
        row({ pid: '43', em: '0', euid: '0' }),
        row({ pid: '44', em: '0', rm: '0', euid: '0', ruid: '0' }),
      ],
      [3, 1, 2],
    ),
  );
  assert.equal(observation.rows[0].uniqueId, '18446744073709551614');
  const summary = summarizeIdentityAvailability(observation);
  assert.equal(summary.excludedFromEffective, 2);
  assert.equal(summary.excludedFromBoth, 1);
  assert.match(summary.scope, /No birth, descendant closure or signalling authority/);
  assert.equal(assessIdentityAvailability(observation, closed, false), true);
});

test('partial, unsupported, ambiguous and failed command observations never pass', () => {
  for (const patch of [
    { status: 'changed' },
    {
      status: 'unavailable',
      stage: '0',
      result: '0',
      error: '1',
      ppid: '0',
      pgid: '0',
      euid: '0',
      ruid: '0',
      unique: '0',
      parent: '0',
      version: '0',
    },
  ])
    assert.equal(
      assessIdentityAvailability(parseIdentityAvailability(bytes([row(patch)])), closed, false),
      false,
    );
  assert.equal(
    assessIdentityAvailability(parseIdentityAvailability(bytes([], [-1, 1, 1])), closed, false),
    false,
  );
  assert.equal(
    assessIdentityAvailability(parseIdentityAvailability(bytes([], [0, 0, 0])), closed, false),
    false,
  );
  const parsed = parseIdentityAvailability(bytes());
  for (const command of [
    { ...closed, status: 1 },
    { ...closed, error: { code: 'ETIMEDOUT' } },
    { ...closed, signal: 'SIGTERM' },
  ])
    assert.equal(assessIdentityAvailability(parsed, command, false), false);
  assert.equal(assessIdentityAvailability(parsed, closed, true), false);
});

test('parser requires every row, exact integers, finite native ABI fields and complete streams', () => {
  for (const input of [
    bytes().subarray(0, -1),
    bytes([row()], [2, 1, 1]),
    bytes([row(), row()]),
    bytes([row()], [-1, 1, 1]),
    bytes([row({ unique: '18446744073709551616' })]),
    bytes([row({ pid: '-1' })]),
    bytes([row({ status: 'consistent', stage: '0' })]),
    bytes([row({ status: 'gone', stage: '0', result: '1', error: '3' })]),
    Buffer.concat([bytes(), Buffer.from('\n')]),
    Buffer.alloc(AVAILABILITY_LIMITS.outputBytes),
  ])
    assert.throws(() => parseIdentityAvailability(input));
});

test('maximum native rows retain full raw evidence while JSON summary remains bounded', () => {
  const rows = Array.from({ length: AVAILABILITY_LIMITS.rows - 1 }, (_, i) =>
    row({ pid: String(i + 1), status: 'changed' }),
  );
  const raw = bytes(rows, [rows.length, rows.length, rows.length]);
  const parsed = parseIdentityAvailability(raw),
    summary = summarizeIdentityAvailability(parsed);
  assert.equal(parsed.rows.length, rows.length);
  assert.equal(summary.exceptions.length, 64);
  assert.equal(summary.exceptionsOmitted, rows.length - 64);
  assert(Buffer.byteLength(JSON.stringify(summary)) < AVAILABILITY_LIMITS.reportBytes);
  assert.equal(assessIdentityAvailability(parsed, closed, false), false);
});

test(
  'SDK mock controls preserve global omissions, errors, partial results and identity changes',
  { skip: process.platform !== 'darwin', timeout: 30000 },
  async (t) => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'darwin-availability-fixture-')));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const source = fileURLToPath(new URL('./solo-darwin-identity-availability.c', import.meta.url)),
      fixture = join(dir, 'fixture.c'),
      binary = join(dir, 'fixture');
    await writeFile(
      fixture,
      `
#define main availability_main
#define proc_pidinfo fixture_pidinfo
#define proc_listpids fixture_listpids
#define getuid fixture_getuid
#define geteuid fixture_geteuid
#include ${JSON.stringify(source)}
#undef main
static const char *mode;
static int calls[3];
uid_t fixture_getuid(void) { return 501; }
uid_t fixture_geteuid(void) { return 501; }
int fixture_listpids(uint32_t type, uint32_t info, void *buffer, int count) {
  (void)info; (void)count;
  pid_t all[]={0,42,43,44}, effective[]={42}, real[]={42,43};
  if (!strcmp(mode,"enumeration-denied") && type==PROC_ALL_PIDS) { errno=EPERM; return 0; }
  if (!strcmp(mode,"enumeration-partial") && type==PROC_ALL_PIDS) return 3;
  if (!strcmp(mode,"duplicate") && type==PROC_ALL_PIDS) all[3]=42;
  if (!strcmp(mode,"negative") && type==PROC_ALL_PIDS) all[3]=-2;
  const pid_t *p=type==PROC_ALL_PIDS?all:type==PROC_UID_ONLY?effective:real;
  int bytes=type==PROC_ALL_PIDS?sizeof(all):type==PROC_UID_ONLY?sizeof(effective):sizeof(real);
  memcpy(buffer,p,bytes); return bytes;
}
int fixture_pidinfo(int pid, int flavor, uint64_t arg, void *buffer, int count) {
  (void)arg; (void)count;
  int call=++calls[pid-42];
  if(pid==43 && call==1) {
    if(!strcmp(mode,"permission")) { errno=EPERM; return 0; }
    if(!strcmp(mode,"zero-no-errno")) return 0;
    if(!strcmp(mode,"gone")) { errno=ESRCH; return 0; }
    if(!strcmp(mode,"partial-esrch")) { errno=ESRCH; return sizeof(struct solo_unique_info)-1; }
  }
  if(flavor==SOLO_UNIQUE_SELECTOR) {
    struct solo_unique_info *v=buffer; memset(v,0,sizeof(*v)); v->unique_id=pid+1000; v->parent_unique_id=12; v->version=1;
    if(pid==43 && call==4 && !strcmp(mode,"recycled")) v->unique_id++;
    if(pid==43 && call==4 && !strcmp(mode,"parent-changed")) v->parent_unique_id++;
    return sizeof(*v);
  }
  struct proc_bsdshortinfo *v=buffer; memset(v,0,sizeof(*v)); v->pbsi_pid=pid; v->pbsi_ppid=12; v->pbsi_pgid=pid; v->pbsi_uid=pid==42?501:0; v->pbsi_ruid=pid==44?0:501; v->pbsi_svuid=v->pbsi_uid;
  if(pid==43 && call==3 && !strcmp(mode,"uid-changed")) v->pbsi_uid++;
  return sizeof(*v);
}
int main(int argc, char **argv) { if(argc!=2)return 2; mode=argv[1]; return availability_main(1,argv); }
`,
    );
    execFileSync(
      'xcrun',
      ['clang', '-std=c11', '-Wall', '-Wextra', '-Werror', fixture, '-o', binary],
      { timeout: 10000, maxBuffer: 65536 },
    );
    for (const mode of [
      'normal',
      'gone',
      'permission',
      'zero-no-errno',
      'partial-esrch',
      'recycled',
      'parent-changed',
      'uid-changed',
      'enumeration-denied',
      'enumeration-partial',
      'duplicate',
      'negative',
    ]) {
      const command = spawnSync(binary, [mode], { timeout: 1000, maxBuffer: 65536 });
      assert(!command.error);
      assert.equal(command.signal, null);
      const observation = parseIdentityAvailability(command.stdout);
      const expected = ['normal', 'gone'].includes(mode);
      assert.equal(command.status, expected ? 0 : 1, mode);
      assert.equal(assessIdentityAvailability(observation, command, false), expected, mode);
      if (mode === 'normal') {
        assert.equal(observation.rows.length, 3);
        assert.equal(observation.rows[1].effectiveMembership, false);
        assert.equal(observation.rows[1].realMembership, true);
        assert.equal(observation.rows[2].realMembership, false);
      }
      if (['permission', 'zero-no-errno', 'partial-esrch'].includes(mode))
        assert.equal(observation.rows[1].status, 'unavailable');
      if (mode === 'gone') assert.equal(observation.rows[1].status, 'gone');
    }
  },
);

test('one-shot hosted availability is read-only, bounded and separately retained', async () => {
  const workflow = await readFile(
    new URL(
      '../.github/workflows/solo-darwin-identity-availability-temporary.yml',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(
    workflow,
    /github\.event\.pull_request\.number == 1544.*github\.event\.pull_request\.head\.repo\.full_name == github\.repository.*github\.event\.action == 'synchronize'.*github\.event\.before == 'c41a02216c0811952232a387fd1743e09452c269'/,
  );
  assert.match(workflow, /runs-on: macos-15\n    timeout-minutes: 10/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /--test scripts\/test-solo-darwin-identity-availability\.mjs/);
  for (const path of [
    'scripts/solo-darwin-identity-availability.c',
    'scripts/solo-darwin-identity-availability.mjs',
    'scripts/test-solo-darwin-identity-availability.mjs',
    '.github/workflows/solo-darwin-identity-availability-temporary.yml',
  ])
    assert(workflow.includes('/' + path));
  assert.doesNotMatch(workflow, /npm ci|playwright|xvfb|sudo|filter:|run-solo-remote-correctness/);
  const c = await readFile(
    new URL('./solo-darwin-identity-availability.c', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(c, /\bkill\s*\(|PROC_PIDTBSDINFO|KERN_PROCARGS2|proc_pidpath/);
  assert.match(c, /SOLO_UNIQUE_SELECTOR 17/);
  assert.match(c, /sizeof\(struct solo_unique_info\) == 56/);
  const js = await readFile(
    new URL('./solo-darwin-identity-availability.mjs', import.meta.url),
    'utf8',
  );
  assert.match(js, /ownershipQualification: false/);
  assert.match(js, /mediaObservations: 0/);
  assert.match(js, /performanceQualification: false/);
});
