// Read-only ABI availability diagnostic. Never used for ownership or signalling.
#include <errno.h>
#include <inttypes.h>
#include <libproc.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#define MAX_PIDS 16384
// Apple proc_info_private.h selector 17, fixed 56-byte ABI. It is absent from
// public SDK headers. Any unsupported/short result remains a failed observation.
#define SOLO_UNIQUE_SELECTOR 17
struct solo_unique_info {
  uint8_t executable_uuid[16];
  uint64_t unique_id, parent_unique_id;
  int32_t version, original_parent_version;
  uint64_t reserved[2];
};
_Static_assert(sizeof(struct solo_unique_info) == 56, "Private diagnostic ABI size");
static int failed;
static int member(pid_t pid, const pid_t *pids, int count) {
  for (int i = 0; i < count; i++) if (pids[i] == pid) return 1;
  return 0;
}
static int inventory(uint32_t selector, uint32_t argument, pid_t *pids) {
  errno = 0;
  int bytes = proc_listpids(selector, argument, pids, MAX_PIDS * sizeof(pid_t));
  int error = errno;
  if (bytes <= 0 || bytes >= MAX_PIDS * (int)sizeof(pid_t) || bytes % sizeof(pid_t)) {
    fprintf(stderr,"inventory selector=%u result=%d errno=%d\n",selector,bytes,error);return -1;
  }
  int slots = bytes / sizeof(pid_t), count = 0;
  for (int i=0;i<slots;i++) {
    if(pids[i]<0) { fprintf(stderr,"negative PID\n"); return -1; }
    if(pids[i]==0) continue;
    pid_t pid=pids[i];
    for(int j=0;j<count;j++) if(pids[j]==pid) { fprintf(stderr,"duplicate PID\n");return -1; }
    pids[count++]=pid;
  }
  return count;
}
static void observe(pid_t pid,int effective_member,int real_member) {
  struct proc_bsdshortinfo a={0},b={0};
  struct solo_unique_info x={0},y={0};
  const int flavors[]={SOLO_UNIQUE_SELECTOR,PROC_PIDT_SHORTBSDINFO,PROC_PIDT_SHORTBSDINFO,SOLO_UNIQUE_SELECTOR};
  void *buffers[]={&x,&a,&b,&y};
  int sizes[]={sizeof(x),sizeof(a),sizeof(b),sizeof(y)};
  for(int i=0;i<4;i++) {
    errno=0;int result=proc_pidinfo(pid,flavors[i],0,buffers[i],sizes[i]);int error=errno;
    if(result!=sizes[i]) {
      int gone=result<=0 && (error==ESRCH || error==ENOENT);
      printf("%d\t%d\t%d\t%s\t%d\t%d\t%d\t0\t0\t0\t0\t0\t0\t0\n",pid,effective_member,real_member,gone?"gone":"unavailable",i,result,error);
      if(!gone) failed=1;
      return;
    }
  }
  int consistent=a.pbsi_pid==(uint32_t)pid && b.pbsi_pid==(uint32_t)pid &&
    x.unique_id!=0 && x.unique_id==y.unique_id && x.version==y.version &&
    x.parent_unique_id==y.parent_unique_id && a.pbsi_ppid==b.pbsi_ppid &&
    a.pbsi_pgid==b.pbsi_pgid && a.pbsi_uid==b.pbsi_uid &&
    a.pbsi_ruid==b.pbsi_ruid && a.pbsi_svuid==b.pbsi_svuid;
  printf("%d\t%d\t%d\t%s\t-1\t0\t0\t%u\t%u\t%u\t%u\t%" PRIu64 "\t%" PRIu64 "\t%d\n",pid,effective_member,real_member,consistent?"consistent":"changed",b.pbsi_ppid,b.pbsi_pgid,b.pbsi_uid,b.pbsi_ruid,y.unique_id,y.parent_unique_id,y.version);
  if(!consistent)failed=1;
}
int main(int argc,char **argv) {
  (void)argv;if(argc!=1)return 2;
  pid_t *all=calloc(MAX_PIDS,sizeof(pid_t)),*effective=calloc(MAX_PIDS,sizeof(pid_t)),*real=calloc(MAX_PIDS,sizeof(pid_t));
  if(!all||!effective||!real)return 2;
  int count=inventory(PROC_ALL_PIDS,0,all);
  int ec=inventory(PROC_UID_ONLY,geteuid(),effective),rc=inventory(PROC_RUID_ONLY,getuid(),real);
  printf("SoloDarwinIdentityAvailabilityV1\t%u\t%u\t%d\t%d\t%d\n",getuid(),geteuid(),count,ec,rc);
  if(count<0||ec<0||rc<0){free(all);free(effective);free(real);return 1;}
  // The three lists are sequential, non-atomic snapshots. Membership is a hint,
  // never proof that an omitted process is unrelated or has exited.
  for(int i=0;i<count;i++)if(all[i]>0)observe(all[i],member(all[i],effective,ec),member(all[i],real,rc));
  free(all);free(effective);free(real);
  if(fflush(stdout)||ferror(stdout))return 1;
  return failed?1:0;
}
