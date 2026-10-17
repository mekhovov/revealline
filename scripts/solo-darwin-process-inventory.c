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
static int tagged(pid_t pid, const char *token) {
  if (!*token) return 0;
  int mib[] = {CTL_KERN, KERN_PROCARGS2, pid};
  size_t size = MAX_ARGS;
  char *bytes = malloc(size);
  if (!bytes) fail("argument allocation");
  if (sysctl(mib, 3, bytes, &size, NULL, 0) != 0) {
    int error = errno;
    free(bytes);
    errno = error;
    if (gone()) return -2;
    if (errno == EACCES || errno == EPERM || errno == EINVAL) return -1;
    fail("argument inspection");
  }
  if (size < sizeof(int) || size >= MAX_ARGS) { free(bytes); return -1; }
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
static void row(pid_t pid, const char *token, int identity_only) {
  struct proc_bsdinfo first = {0}, last = {0};
  errno = 0;
  int size = proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &first, sizeof(first));
  if (size != sizeof(first)) {
    if (size <= 0 && gone()) return;
    fail("process identity inspection");
  }
  char path[PROC_PIDPATHINFO_MAXSIZE] = {0};
  uint64_t rss = 0;
  int incomplete = 0, owner = 0;
  if (!identity_only && first.pbi_status != SZOMB) {
    errno = 0;
    if (proc_pidpath(pid, path, sizeof(path)) <= 0) {
      if (gone()) return;
      incomplete = 1;
      snprintf(path, sizeof(path), "%.*s", (int)sizeof(first.pbi_name), first.pbi_name);
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
  errno = 0;
  size = proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &last, sizeof(last));
  if (size != sizeof(last)) {
    if (size <= 0 && gone()) return;
    fail("fresh identity inspection");
  }
  if (first.pbi_pid != last.pbi_pid || first.pbi_start_tvsec != last.pbi_start_tvsec ||
      first.pbi_start_tvusec != last.pbi_start_tvusec) return;
  // Birth remains an exact digit string for the shared Linux/Darwin owner checks.
  printf("%u\t%u\t%u\t%" PRIu64 "%06" PRIu64 "\t%c\t%" PRIu64 "\t%d\t%d\t",
         last.pbi_pid, last.pbi_ppid, last.pbi_pgid,
         last.pbi_start_tvsec, last.pbi_start_tvusec,
         last.pbi_status == SZOMB ? 'Z' : 'R', rss, owner, incomplete);
  for (size_t i = 0; path[i]; i++) printf("%02x", (unsigned char)path[i]);
  putchar('\n');
}
int main(int argc, char **argv) {
  if (argc != 3 || strlen(argv[2]) > 36) fail("usage: inventory all|PID owner-token");
  for (const char *p = argv[2]; *p; p++)
    if (!((*p >= '0' && *p <= '9') || (*p >= 'a' && *p <= 'f') || *p == '-'))
      fail("owner tag syntax");
  puts("SoloDarwinProcessInventoryV1");
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
    for (size_t i = 0; i < (size_t)bytes / sizeof(pid_t); i++)
      if (pids[i] > 0 && pids[i] != getpid()) row(pids[i], argv[2], 0);
    free(pids);
  }
  if (fflush(stdout) || ferror(stdout)) fail("inventory output");
  return 0;
}
