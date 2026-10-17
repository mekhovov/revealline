// Hosted diagnostic process inventory, built against the runner's macOS SDK.
// No signalling and no environment/argument output: only an exact owner-tag bit.
#include <errno.h>
#include <inttypes.h>
#include <libproc.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/proc.h>
#include <sys/sysctl.h>
#include <unistd.h>

#define MAX_PIDS 16384
#define MAX_ARGS (2 * 1024 * 1024)

static int gone(void) { return errno == ESRCH || errno == ENOENT; }
static void fail(const char *message) {
  fprintf(stderr, "Darwin inventory: %s (%d)\n", message, errno);
  exit(1);
}
static void fail_identity(const char *message, pid_t pid, int result, size_t expected,
                          int identity_only) {
  int error = errno;
  fprintf(stderr, "Darwin inventory: %s (%d) pid=%d selector=%s result=%d expected=%zu\n",
          message, error, pid, identity_only ? "one" : "all", result, expected);
  exit(1);
}
static size_t argument_capacity(void) {
  static size_t capacity = 0;
  if (capacity) return capacity;
  int mib[] = {CTL_KERN, KERN_ARGMAX}, maximum = 0;
  size_t size = sizeof(maximum);
  if (sysctl(mib, 2, &maximum, &size, NULL, 0) != 0 ||
      size != sizeof(maximum) || maximum <= (int)sizeof(int) || maximum > MAX_ARGS)
    fail("argument limit");
  capacity = (size_t)maximum;
  return capacity;
}
static int tagged(pid_t pid, const char *token) {
  if (!*token) return 0;
  int mib[] = {CTL_KERN, KERN_PROCARGS2, pid};
  const size_t capacity = argument_capacity();
  size_t size = capacity;
  char *bytes = malloc(capacity);
  if (!bytes) fail("argument allocation");
  if (sysctl(mib, 3, bytes, &size, NULL, 0) != 0) {
    int error = errno;
    free(bytes);
    errno = error;
    if (gone()) return -2;
    if (errno == EACCES || errno == EPERM || errno == EINVAL) return -1;
    fail("argument inspection");
  }
  if (size < sizeof(int) || size >= capacity) { free(bytes); return -1; }
  int argc;
  memcpy(&argc, bytes, sizeof(argc));
  if (argc < 0 || argc > 65536) { free(bytes); return -1; }
  char *p = bytes + sizeof(int), *end = bytes + size;
  // KERN_PROCARGS2: argc, executable path, NUL padding, argv, environment.
  while (p < end && *p) p++;
  if (p >= end) { free(bytes); return -1; }
  while (p < end && !*p) p++;
  for (int i = 0; i < argc; i++) {
    while (p < end && *p) p++;
    if (p >= end) { free(bytes); return -1; }
    p++;
  }
  char expected[128];
  int length = snprintf(expected, sizeof(expected), "SOLO_REMOTE_OWNER=%s", token);
  if (length < 0 || (size_t)length >= sizeof(expected)) fail("owner tag bound");
  int found = 0;
  while (p < end && *p) {
    char *start = p;
    while (p < end && *p) p++;
    if (p >= end) { free(bytes); return -1; }
    if ((size_t)(p - start) == (size_t)length && !memcmp(start, expected, length)) found = 1;
    p++;
  }
  free(bytes);
  return found;
}
// Selector 17 is Apple's private 56-byte proc_uniqidentifierinfo ABI. A short,
// unsupported or unstable result fails the whole inventory. The unique ID is
// the lifetime key; version only brackets this read because normal exec changes it.
#define SOLO_UNIQUE_SELECTOR 17
struct solo_unique_info {
  uint8_t executable_uuid[16];
  uint64_t unique_id, parent_unique_id;
  int32_t version, original_parent_version;
  uint64_t reserved[2];
};
_Static_assert(sizeof(struct solo_unique_info) == 56, "Private ABI size");
static int identity(pid_t pid, int flavor, void *data, size_t size, int identity_only) {
  errno = 0;
  int result = proc_pidinfo(pid, flavor, 0, data, (int)size);
  if (result == (int)size) return 1;
  if (result <= 0 && gone()) return 0;
  fail_identity("short/unique identity inspection", pid, result, size, identity_only);
  return 0;
}
static int valid_status(uint32_t status) {
  return status == SIDL || status == SRUN || status == SSLEEP ||
         status == SSTOP || status == SZOMB;
}
static void row(pid_t pid, const char *token, int identity_only) {
  struct proc_bsdshortinfo first = {0}, last = {0};
  struct solo_unique_info a = {0}, b = {0};
  if (!identity(pid, SOLO_UNIQUE_SELECTOR, &a, sizeof(a), identity_only) ||
      !identity(pid, PROC_PIDT_SHORTBSDINFO, &first, sizeof(first), identity_only)) return;
  char path[PROC_PIDPATHINFO_MAXSIZE] = {0};
  uint64_t rss = 0;
  int incomplete = 0, owner = 0;
  if (!identity_only && first.pbsi_status != SZOMB) {
    errno = 0;
    int path_size = proc_pidpath(pid, path, sizeof(path));
    if (path_size <= 0 || path_size >= (int)sizeof(path) || !memchr(path, 0, sizeof(path))) {
      if (path_size <= 0 && gone()) return;
      incomplete = 1;
      snprintf(path, sizeof(path), "%.*s", (int)sizeof(first.pbsi_comm), first.pbsi_comm);
    }
    struct proc_taskinfo task = {0};
    errno = 0;
    int task_size = proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &task, sizeof(task));
    if (task_size != sizeof(task)) {
      if (task_size <= 0 && gone()) return;
      incomplete = 1;
    } else rss = task.pti_resident_size;
    owner = tagged(pid, token);
    if (owner == -2) return;
    if (owner == -1) { incomplete = 1; owner = 0; }
  }
  if (!identity(pid, PROC_PIDT_SHORTBSDINFO, &last, sizeof(last), identity_only) ||
      !identity(pid, SOLO_UNIQUE_SELECTOR, &b, sizeof(b), identity_only)) return;
  if (first.pbsi_pid != (uint32_t)pid || last.pbsi_pid != (uint32_t)pid ||
      first.pbsi_ppid > INT32_MAX || last.pbsi_ppid > INT32_MAX ||
      first.pbsi_pgid > INT32_MAX || last.pbsi_pgid > INT32_MAX ||
      !a.unique_id || a.unique_id != b.unique_id || a.version != b.version ||
      a.parent_unique_id != b.parent_unique_id || first.pbsi_ppid != last.pbsi_ppid ||
      first.pbsi_pgid != last.pbsi_pgid || first.pbsi_uid != last.pbsi_uid ||
      first.pbsi_ruid != last.pbsi_ruid || first.pbsi_svuid != last.pbsi_svuid ||
      !valid_status(first.pbsi_status) || !valid_status(last.pbsi_status) ||
      (first.pbsi_status == SZOMB && last.pbsi_status != SZOMB) ||
      a.version < 0 || b.version < 0) {
    errno = EAGAIN; fail_identity("changed/invalid identity bracket", pid, 0, 0, identity_only);
  }
  // Zero-padded exact uint64 unique ID; never a fabricated start timestamp.
  printf("%u\t%u\t%u\t%020" PRIu64 "\t%c\t%" PRIu64 "\t%d\t%d\t",
         last.pbsi_pid,last.pbsi_ppid,last.pbsi_pgid,b.unique_id,
         last.pbsi_status == SZOMB ? 'Z' : 'R',rss,owner,incomplete);
  for (size_t i=0;path[i];i++) printf("%02x",(unsigned char)path[i]);
  printf("\t%u\t%u\t%" PRIu64 "\t%d\n",last.pbsi_uid,last.pbsi_ruid,b.parent_unique_id,b.version);
}
int main(int argc, char **argv) {
  if (argc != 3 || strlen(argv[2]) > 36) fail("usage: inventory all|PID owner-token");
  for (const char *p = argv[2]; *p; p++)
    if (!((*p >= '0' && *p <= '9') || (*p >= 'a' && *p <= 'f') || *p == '-'))
      fail("owner tag syntax");
  puts("SoloDarwinProcessInventoryV2");
  if (strcmp(argv[1], "all")) {
    char *end;
    long pid = strtol(argv[1], &end, 10);
    if (*end || pid <= 0 || pid > INT32_MAX) fail("PID bound");
    row((pid_t)pid, argv[2], 1);
  } else {
    pid_t *pids = calloc(MAX_PIDS, sizeof(pid_t));
    if (!pids) fail("PID allocation");
    int bytes = proc_listpids(PROC_ALL_PIDS, 0, pids, MAX_PIDS * sizeof(pid_t));
    if (bytes <= 0 || bytes >= MAX_PIDS * (int)sizeof(pid_t) || bytes % sizeof(pid_t))
      fail("PID inventory bound");
    for (size_t i = 0; i < (size_t)bytes / sizeof(pid_t); i++) {
      if (pids[i] < 0) fail("negative PID");
      if (!pids[i]) continue;
      for (size_t j=0;j<i;j++) if (pids[j] == pids[i]) fail("duplicate PID");
      if (pids[i] != getpid()) row(pids[i], argv[2], 0);
    }
    free(pids);
  }
  if (fflush(stdout) || ferror(stdout)) fail("inventory output");
  return 0;
}
