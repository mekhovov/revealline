import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseDarwinInventory } from './solo-darwin-process-inventory.mjs';
import { isOwnedProcess } from './run-solo-remote-correctness.mjs';
const source = fileURLToPath(new URL('./solo-darwin-process-inventory.c', import.meta.url));
let root, binary;
const nativeTest = (name, run) =>
  test(name, { skip: process.platform !== 'darwin', timeout: 30000 }, run);
const fixture = String.raw`
#define main inventory_main
#define proc_pidinfo fixture_pidinfo
#define proc_pidpath fixture_pidpath
#define proc_listpids fixture_listpids
#define sysctl fixture_sysctl
#include ${JSON.stringify(source)}
#undef main
static const char *mode; static int unique_calls[3],short_calls[3],argument_queries,argument_reads;
int fixture_pidinfo(int pid,int flavor,uint64_t arg,void *buffer,int count) {
 (void)arg;(void)count;int i=pid-42;
 if(flavor==PROC_PIDTBSDINFO){fprintf(stderr,"FULL_BSD_FORBIDDEN\n");exit(9);}
 if(flavor==SOLO_UNIQUE_SELECTOR){int call=++unique_calls[i];
  if(pid==43 && call==1){
   if(!strcmp(mode,"unique-denied")){errno=EPERM;return 0;}
   if(!strcmp(mode,"unique-zero"))return 0;
   if(!strcmp(mode,"unique-partial")){errno=ESRCH;return sizeof(struct solo_unique_info)-1;}
   if(!strcmp(mode,"gone")){errno=ESRCH;return 0;}
  }
  struct solo_unique_info *p=buffer;memset(p,0,sizeof(*p));p->unique_id=pid+1000;p->parent_unique_id=pid==43?1042:12;p->version=!strcmp(mode,"exec-next")?2:1;if(!strcmp(mode,"negative-version"))p->version=-1;if(!strcmp(mode,"zero-unique"))p->unique_id=0;
  if(pid==43 && !strcmp(mode,"reused-next"))p->unique_id++;
  if(pid==43 && call==2){if(!strcmp(mode,"unique-changed"))p->unique_id++;if(!strcmp(mode,"exec-inside"))p->version++;if(!strcmp(mode,"parent-identity-changed"))p->parent_unique_id++;}
  return sizeof(*p);
 }
 if(flavor==PROC_PIDT_SHORTBSDINFO){int call=++short_calls[i];
  if(pid==43&&call==1){if(!strcmp(mode,"short-denied")){errno=EPERM;return 0;}if(!strcmp(mode,"short-zero"))return 0;if(!strcmp(mode,"short-partial")){errno=ESRCH;return sizeof(struct proc_bsdshortinfo)-1;}}
  struct proc_bsdshortinfo *p=buffer;memset(p,0,sizeof(*p));p->pbsi_pid=pid;p->pbsi_ppid=pid==43?42:12;p->pbsi_pgid=pid==44?44:42;p->pbsi_status=!strcmp(mode,"zombie")?SZOMB:SRUN;
  if(!strcmp(mode,"unknown-state"))p->pbsi_status=99;
  if(!strcmp(mode,"zero-state"))p->pbsi_status=0;
  if(!strcmp(mode,"zombie-live"))p->pbsi_status=call==1?SZOMB:SRUN;
  if(!strcmp(mode,"live-zombie"))p->pbsi_status=call==1?SRUN:SZOMB;
  if(!strcmp(mode,"sleeping"))p->pbsi_status=SSLEEP;
  if(!strcmp(mode,"stopped"))p->pbsi_status=SSTOP;
  if(!strcmp(mode,"idle"))p->pbsi_status=SIDL;p->pbsi_uid=pid==44?0:501;p->pbsi_ruid=p->pbsi_svuid=p->pbsi_uid;memcpy(p->pbsi_comm,"controlled",10);
  if(pid==43&&!strcmp(mode,"foreign-child"))p->pbsi_uid=p->pbsi_ruid=p->pbsi_svuid=0;
  if(pid==43&&call==2){if(!strcmp(mode,"pid-changed"))p->pbsi_pid++;if(!strcmp(mode,"parent-changed"))p->pbsi_ppid++;if(!strcmp(mode,"group-changed"))p->pbsi_pgid++;if(!strcmp(mode,"uid-changed"))p->pbsi_uid++;}
  return sizeof(*p);
 }
 if(flavor==PROC_PIDTASKINFO){if(pid==44||!strcmp(mode,"rss-denied")){errno=EPERM;return 0;}if(!strcmp(mode,"rss-partial")){errno=ESRCH;return sizeof(struct proc_taskinfo)-1;}struct proc_taskinfo *p=buffer;memset(p,0,sizeof(*p));p->pti_resident_size=pid*1024;return sizeof(*p);}
 fprintf(stderr,"UNKNOWN_SELECTOR\n");exit(9);
}
int fixture_pidpath(int pid,void *buffer,uint32_t count){if(!strcmp(mode,"path-saturated")){memset(buffer,1,count);return count;}if((pid==44 && strcmp(mode,"foreign-ps"))||!strcmp(mode,"path-denied")){errno=EPERM;return 0;}return snprintf(buffer,count,"%s",pid==44?"/bin/ps":"/owned/NodeWebKit");}
int fixture_listpids(uint32_t type,uint32_t info,void *buffer,int count){(void)info;(void)count;if(type!=PROC_ALL_PIDS)exit(9);pid_t rows[]={0,42,43,44};if(!strcmp(mode,"list-denied")){errno=EPERM;return 0;}if(!strcmp(mode,"list-partial"))return 3;if(!strcmp(mode,"list-saturated"))return MAX_PIDS*sizeof(pid_t);if(!strcmp(mode,"list-negative"))rows[3]=-1;if(!strcmp(mode,"list-duplicate"))rows[3]=42;memcpy(buffer,rows,sizeof(rows));return sizeof(rows);}
int fixture_sysctl(int *name,u_int n,void *oldp,size_t *len,void *newp,size_t newlen){(void)newp;(void)newlen;
 int maximum=!strcmp(mode,"argmax-one-mib")?1048576:262144;
 if(n==2&&name[0]==CTL_KERN&&name[1]==KERN_ARGMAX){
  argument_queries++;if(!strcmp(mode,"argmax-denied")){errno=EPERM;return -1;}
  if(!strcmp(mode,"argmax-zero"))maximum=0;
  if(!strcmp(mode,"argmax-negative"))maximum=-1;
  if(!strcmp(mode,"argmax-tiny"))maximum=sizeof(int);
  if(!strcmp(mode,"argmax-over-cap"))maximum=MAX_ARGS+1;
  memcpy(oldp,&maximum,sizeof(maximum));*len=!strcmp(mode,"argmax-short")?sizeof(maximum)-1:sizeof(maximum);return 0;
 }
 if(n!=3||name[0]!=CTL_KERN||name[1]!=KERN_PROCARGS2){fprintf(stderr,"UNKNOWN_SYSCTL\n");exit(9);}
 argument_reads++;
 // Match Apple's request-size guard before process lookup, not just returned bytes.
 if(*len<=sizeof(int)||*len-sizeof(int)>(size_t)maximum){errno=EINVAL;return -1;}
 if(!strcmp(mode,"tag-saturated")){*len=(size_t)maximum;return 0;}
 int pid=name[2];if(pid==44||!strcmp(mode,"tag-denied")){errno=EPERM;return -1;}int argc=1;memcpy(oldp,&argc,sizeof(argc));if(!strcmp(mode,"tag-truncated")){*len=sizeof(argc);return 0;}const char yes[]="/node\0\0node\0SOLO_REMOTE_OWNER=01234567-89ab-cdef-0123-456789abcdef\0";const char no[]="/node\0\0node\0OTHER=value\0";const char *b=pid==42?yes:no;size_t size=pid==42?sizeof(yes):sizeof(no);memcpy((char*)oldp+sizeof(argc),b,size);*len=sizeof(argc)+size;return 0;}
int main(int argc,char **argv){if(argc!=2)return 2;mode=argv[1];char *args[]={"mock","all","01234567-89ab-cdef-0123-456789abcdef"};int result=inventory_main(3,args);if(!strcmp(mode,"argmax-one-mib")||!strcmp(mode,"argmax-repeat"))fprintf(stderr,"argument_queries=%d argument_reads=%d\n",argument_queries,argument_reads);return result;}
`;
test.before(async () => {
  if (process.platform !== 'darwin') return;
  root = await realpath(await mkdtemp(join(tmpdir(), 'darwin-v2-sdk-')));
  binary = join(root, 'mock-inventory');
  await writeFile(join(root, 'mock.c'), fixture);
  execFileSync(
    'xcrun',
    ['clang', '-std=c11', '-Wall', '-Wextra', '-Werror', join(root, 'mock.c'), '-o', binary],
    { timeout: 10000, maxBuffer: 65536 },
  );
});
const observed = [];
function capture(mode) {
  const r = spawnSync(binary, [mode], { timeout: 3000, maxBuffer: 65536 });
  observed.push({
    mode,
    status: r.status,
    error: r.error?.code ?? null,
    signal: r.signal,
    stdout: r.stdout.toString(),
    stderr: r.stderr.toString(),
  });
  assert(!r.error);
  assert.equal(r.signal, null);
  return { r, map: r.status === 0 ? parseDarwinInventory(r.stdout) : null };
}
const same = (a, b) => !!a && !!b && a.pid === b.pid && a.birth === b.birth;
nativeTest(
  'global short/unique inventory retains protected rows and never calls fullBSD or UID filters',
  () => {
    const { r, map } = capture('normal');
    assert.equal(r.status, 0);
    assert.equal(map.size, 3);
    assert.equal(map.get(44).inspectionIncomplete, true);
    assert.equal(map.get(44).ownerTagged, false);
    assert.equal(map.get(44).euid, 0);
    assert.equal(map.get(44).pathInspection, 'unavailable');
    assert.equal(map.get(44).rssInspection, 'unavailable');
    assert.equal(map.get(44).ownerTagInspection, 'unavailable');
    assert.equal(map.get(42).pathInspection, 'complete');
    assert.equal(map.get(42).rssInspection, 'complete');
    assert.equal(map.get(42).ownerTagInspection, 'present');
    assert.equal(map.get(42).rss, 42 * 1024);
    assert.equal(map.get(42).ownerTagged, true);
  },
);
nativeTest(
  'kernel argument capacity is queried once and invalid sizes never authorize owner tags',
  () => {
    for (const mode of ['argmax-repeat', 'argmax-one-mib']) {
      const { r, map } = capture(mode);
      assert.equal(r.status, 0, mode);
      assert.equal(map.get(42).ownerTagged, true, mode);
      assert.equal(map.get(42).inspectionIncomplete, false, mode);
      assert.equal(map.get(43).ownerTagged, false, mode);
      assert.equal(map.get(44).inspectionIncomplete, true, mode);
      assert.match(r.stderr.toString(), /argument_queries=1 argument_reads=3/);
    }
    for (const mode of [
      'argmax-denied',
      'argmax-short',
      'argmax-zero',
      'argmax-negative',
      'argmax-tiny',
      'argmax-over-cap',
    ]) {
      const { r } = capture(mode);
      assert.equal(r.status, 1, mode);
      assert.match(r.stderr.toString(), /argument limit/);
    }
    const saturated = capture('tag-saturated');
    assert.equal(saturated.r.status, 0);
    assert.equal(saturated.map.get(42).inspectionIncomplete, true);
    assert.equal(saturated.map.get(42).ownerTagged, false);
  },
);
nativeTest(
  'all uncertain identities and enumeration conditions fail instead of disappearing',
  () => {
    for (const mode of [
      'unique-denied',
      'unique-zero',
      'unique-partial',
      'short-denied',
      'short-zero',
      'short-partial',
      'unique-changed',
      'exec-inside',
      'parent-identity-changed',
      'pid-changed',
      'parent-changed',
      'group-changed',
      'uid-changed',
      'list-denied',
      'list-partial',
      'list-negative',
      'list-duplicate',
      'list-saturated',
      'unknown-state',
      'zero-state',
      'zombie-live',
      'negative-version',
      'zero-unique',
    ])
      assert.equal(capture(mode).r.status, 1, mode);
    const x = capture('gone');
    assert.equal(x.r.status, 0);
    assert.equal(x.map.size, 2);
  },
);
nativeTest(
  'task/path/tag unavailable and malformed token remain incomplete, never healthy zero resource use',
  () => {
    for (const mode of [
      'rss-denied',
      'rss-partial',
      'path-denied',
      'path-saturated',
      'tag-denied',
      'tag-truncated',
    ]) {
      const x = capture(mode);
      assert.equal(x.r.status, 0);
      assert.equal(x.map.get(42).inspectionIncomplete, true, mode);
    }
    const x = capture('zombie');
    assert.equal(x.map.get(42).state, 'Z');
    assert.equal(capture('live-zombie').map.get(42).state, 'Z');
    for (const mode of ['idle', 'sleeping', 'stopped'])
      assert.equal(capture(mode).map.get(42).state, 'R');
  },
);
nativeTest(
  'exec changes metadata version but not lifetime ownership; PID recycling changes lifetime',
  () => {
    const a = capture('normal').map,
      b = capture('exec-next').map,
      c = capture('reused-next').map;
    assert(same(a.get(43), b.get(43)));
    assert.notEqual(a.get(43).version, b.get(43).version);
    assert(!same(a.get(43), c.get(43)));
  },
);
nativeTest(
  'actual common owner adoption retains foreign UID descendants without granting unrelated rows',
  () => {
    const all = capture('foreign-child').map,
      owned = new Map([[42, all.get(42)]]);
    assert.equal(isOwnedProcess(all.get(43), all, owned, 42, false), true);
    assert.equal(isOwnedProcess(all.get(44), all, owned, 42, false), false);
    assert.equal(all.get(43).euid, 0);
    const recycled = new Map(all);
    recycled.set(42, { ...all.get(42), birth: '00000000000000009999' });
    assert.equal(isOwnedProcess(all.get(43), recycled, owned, 42, false), false);
  },
);
nativeTest(
  'current common ambiguity and owned-incomplete policies remain conservative',
  async () => {
    const source = await readFile(
      new URL('./run-solo-remote-correctness.mjs', import.meta.url),
      'utf8',
    );
    assert(source.includes('if (darwin && current.some((row) => row.inspectionIncomplete))'));
    assert(source.includes('(browserCommand(row) || row.inspectionIncomplete)'));
    assert(source.includes('!same(before.get(row.pid), row)'));
    const all = capture('normal').map;
    const before = new Map([[44, all.get(44)]]),
      owned = new Map([
        [42, all.get(42)],
        [43, all.get(43)],
      ]);
    const ambiguous = (row) =>
      row.state !== 'Z' &&
      row.inspectionIncomplete &&
      !same(before.get(row.pid), row) &&
      !same(owned.get(row.pid), row);
    assert.equal(ambiguous(all.get(44)), false);
    assert.equal(ambiguous({ ...all.get(44), birth: '00000000000000004444' }), true);
    const unreadable = capture('rss-denied').map;
    assert(
      [...owned.values()].some(
        (r) => same(r, unreadable.get(r.pid)) && unreadable.get(r.pid).inspectionIncomplete,
      ),
    );
  },
);
test.after(async () => {
  if (process.env.SOLO_DARWIN_FAULT_EVIDENCE) {
    const bytes = JSON.stringify(observed, null, 2) + '\n';
    assert(Buffer.byteLength(bytes) <= 128 * 1024);
    await writeFile(resolve(process.env.SOLO_DARWIN_FAULT_EVIDENCE), bytes, { flag: 'wx' });
  }
  if (root) await rm(root, { recursive: true, force: true });
});

nativeTest(
  'same-bracket exact ps path is distinguished from protected fallback and changed image',
  () => {
    const { r, map } = capture('foreign-ps');
    assert.equal(r.status, 0);
    const ps = map.get(44);
    assert.equal(ps.argv, '/bin/ps');
    assert.equal(ps.pathInspection, 'complete');
    assert.equal(ps.rssInspection, 'unavailable');
    assert.equal(ps.ownerTagInspection, 'unavailable');
    assert.equal(ps.inspectionIncomplete, true);
    assert.equal(ps.ownerTagged, false);
    assert.equal(capture('path-denied').map.get(44).pathInspection, 'unavailable');
    assert.equal(capture('path-saturated').map.get(44).pathInspection, 'unavailable');
    assert.equal(capture('exec-inside').r.status, 1);
  },
);
