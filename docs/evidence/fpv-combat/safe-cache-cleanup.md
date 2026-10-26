# Safe temporary-file cleanup

Performed on 2026-10-20 at the user's request, after low disk space interrupted verification.

| Disposable cache | Bytes removed |
| --- | ---: |
| Old browser HTTP resource cache entries | 371,905,710 |
| Compiled browser JavaScript cache | 50,131,471 |
| Generated compiler module cache | 95,289,248 |
| Generated Node compile cache | 8,723,996 |
| **Total** | **526,050,425** |

Only recognized generated cache entries older than six hours were selected. Symlinks, open files, cache indexes, recently modified entries and files whose identity changed during inspection were excluded. No cache directories were removed wholesale.

Project folders, Git repositories and history, uncommitted/untracked working files, installed dependencies, browser profiles/storage, SIM saves, downloaded worlds and radio profiles were outside the deletion paths. Source art and unfinished development artifacts were retained.

The filesystem reported approximately **662 MiB available** after cleanup. This is a point-in-time measurement; other applications can change it.

[Per-file removal record](safe-cache-cleanup.json)

Earlier task cleanup separately removed a 27,179,430-byte duplicate art rebuild directory and a 13,557,808-byte temporary GLB verified byte-for-byte against the retained r1 asset. Those are excluded from the cache total above.

## Independent read-only audit

On 2026-10-20, a second agent parsed every removal record and checked normalized path containment, uniqueness, cache-entry naming, and count/size reconciliation. The audit performed no deletions or cache mutations.

| Recorded root | Unique files | Recorded logical file bytes |
| --- | ---: | ---: |
| `/Users/oleksandr.mekhovov/Library/Caches/Codex/Default/Partitions/codex-browser-app/Cache/Cache_Data` | 8,949 | 371,905,710 |
| `/Users/oleksandr.mekhovov/Library/Caches/Codex/Default/Partitions/codex-browser-app/Code Cache/js` | 1,959 | 50,131,471 |
| `/private/var/folders/8t/rtn_g41j7h1bmmssfmwc6kwr0000gp/C/clang/ModuleCache` | 110 | 95,289,248 |
| `/private/tmp/node-compile-cache` | 1,855 | 8,723,996 |
| **Total** | **12,873** | **526,050,425** |

Every logged path is a normalized descendant of its declared root. There are no duplicate paths, traversal components, cache index names, project/Git/dependency paths, or persistent browser storage paths in the removal list. The entries comprise hashed browser HTTP/JavaScript cache files, 20 `.swiftmodule` and 90 `.pcm` compiler files, and hashed entries inside versioned Node compile-cache directories. The four roots currently resolve to themselves without symlink ancestors.

The **526,050,425-byte total is the sum of recorded logical file sizes**, matching the original table. It is not a measured increase in available disk space or an independently measured count of reclaimed filesystem blocks. The earlier approximately **662 MiB available** reading is a separate point-in-time filesystem observation; subsequent writes can change it.

Limits: each removal record contains only `path`, `bytes` and `kind`. It cannot independently establish the historical modification time, open-file exclusion, inode/identity recheck, symlink state at deletion, or successful physical block reclamation. The earlier duplicate-art removals are outside this per-file cache audit.

A bounded read-only check of additional obvious caches found 3,955,106 logical bytes in `/Users/oleksandr.mekhovov/.npm/_cacache`; 17 entries totaling 3,953,536 bytes were older than six hours. Open handles were not checked, and nothing was removed. Both standard pip cache locations were absent and the Homebrew downloads cache was empty. No broader filesystem scan was performed.

A subsequent read-only check of task-related browser temporary directories found `/tmp/fpv-combat-delivery-profile` (19.5 MiB). Although no process referenced it and no open files were found, it contains 13.3 MiB of IndexedDB and 400 KiB of localStorage. The entire profile was preserved. Its six disposable cache subdirectories total only 3.58 MiB and were also left alone. Other matching directories contain test harnesses or evidence, not disposable profiles. This inspection removed nothing.

Final observation after the later rendering checks and test-browser shutdown: **249 MiB available** at 2026-10-20 06:25 UTC. This does not change the recorded logical deletion total. No additional cache or profile deletion was performed during the follow-up audit.
