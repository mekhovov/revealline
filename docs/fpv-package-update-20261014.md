# Native packaged update and rollback — 14 October 2026

The native Codex browser prepared the old simulator, installed Reservoir, updated
to the newer packaged simulator, and retained the same installed world when the
old version was reopened. The launcher temporarily lost its **Open previous
practice** action during this journey; that UI issue prevents calling the entire
rollback experience qualified. Read-only checks subsequently verified both exact
workers and their retained installation pointers. No cache or project loss was
observed.

## Frozen inputs

| Candidate | Source                                     | Cloud run / artifact      | Verified Worlds members |
| --------- | ------------------------------------------ | ------------------------- | ----------------------- |
| v0.142.4  | `b309f8232ab38b27fe4081466d550f22c63673d3` | 37455244806 / 11409047096 | 112 / 15,822,040 bytes  |
| v0.151.1  | `347aee8a0e70945c1fdb742dd41fc4317b5e2908` | 38588241770 / 11906860991 | 126 / 17,040,477 bytes  |

[The receipt](fpv-package-update-20261014.json) records the archive/manifest SHA-256,
source-tree identities, exact world package revisions and native observations.
All 15 envelope checksums and every extracted Worlds member were verified for each
candidate. Both cloud receipts report committed inputs verified and two identical
builds; both remain **publicEligible false**. No admission flag was changed.

Both versions were served on `http://127.0.0.1:9016` under the same stable
`/revealline/practice/fpv-worlds/` installation root. Only the canonical mutable
launcher and `current.json` pointer were switched; each immutable release directory
remained byte-identical. The existing 9012 offline installation was untouched.
Its older candidate also calls itself v0.151.1, so replacing it with different
same-version bytes would not have proved a supported version update.

## Observed journey

1. Old v0.142.4 reported **Ready offline**. Its visible catalogue offered Reservoir,
   Festival and Harbor. Reservoir r16 installed with all eight challenges and
   visible digest `50ffbb0e5da7`. Shoreline check-in rendered at 0.0 seconds with
   motors off and an explicit Arm instruction.
2. After the canonical pointer switched to v0.151.1, the launcher prepared the new
   version and showed **Ready offline** plus **Open previous practice**. The new
   Library retained all eight Reservoir missions.
3. Directly choosing the custom Shoreline mission started flight; 38.7 seconds
   were observed before pausing. This matches intentional direct Play behavior
   introduced in `91d0a94d2`, not a disarmed-launch pass. Current start guards still
   exclude recovery, previews, paused options and superseded/hidden launches, and
   retain lesson/radio/controller gates. This work does not change that behavior.
4. Returning to the launcher and checking again hid the previous-version link.
   Reopening the known immutable old URL retained Reservoir r16 and all eight
   challenges. This proves old-version data compatibility, not successful use of
   the missing user-facing rollback action.
5. A separate read-only diagnostic asked the exact existing workers to hash-check
   their own pinned files. Both replied ready with the expected revision and
   scope; active/previous installation pointers remained intact. The diagnostic
   did not register, remove, repair or write any browser storage.

## Upgraded cached reopen

The dedicated 9016 HTTP server was then stopped and its origin refused connections.
The unchanged new v0.151.1 URL reopened its cached home page; reloading the old
v0.142.4 URL did the same. In both versions Continue restored the same Reservoir
flight at 57.2 seconds and the retained pose, with the canvas rendered, flight
paused and explicit Arm required. The server was restored afterward. The receipt
names both coordinator screenshots. This is an origin-unavailable cache/recovery
check, not network-wide offline, browser restart or storage-eviction acceptance.

## Focused correction and verification

The launcher previously hid both prepared-version links before each potentially
lengthy hash verification while continuing to display the old Ready status. Check
could also start overlapping restore operations. The correction retains the last
verified actions during checking, shows localized checking feedback, serializes
startup/manual Check and publishes one complete latest-owned result. An actual
failed verification still removes the unready action and reports repair.

The existing installation regression now exercises delayed verification in EN/UK:
the prior rollback link remains visible, repeated Check cannot overlap it, and
readiness updates after completion. All 15 existing installation/access/navigation
checks and scoped ESLint/Prettier pass. No new unit-coverage sweep or heavy package
build ran. A subsequent mixed-source launcher observation used source `4c7813e8e` at a
separate unpinned review page on the same installation root. Both prepared and
previous links stayed visible during checking, Check was disabled, localized
checking feedback appeared, and Ready offline returned with both links intact.
Selecting Open previous practice opened the actual v0.142.4 player. Both frozen
player trees were rechecked byte-for-byte unchanged. The receipt binds the review
script/HTML/source hashes and names the coordinator's screenshot. This qualifies
the corrected launcher interaction in a mixed harness; fresh corrected-package
admission and native qualification remain pending.

## Still open

- Verify the corrected rollback action using a freshly admitted package.
- Native interrupted preparation while a previous version remains usable.
- Actual quota/eviction, full browser restart and network-wide offline behavior.
- All-world rendered flight acceptance and named-device/controller performance.

The separate 20-world modeled transaction qualification and historical stopped-
origin reopen remain valid only for their recorded scope and source identities.
