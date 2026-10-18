# Flight practice: Mac mini staging follow-up — 19 October 2026

## Current outcome

The owner-approved Mac mini folder is mounted and usable:
`/Volumes/alex/CodexMigrationStaging`. It is an **SMB network share**, not a
fast local disk or remote execution service. It had approximately **53.4 GiB
free**. Generated build output and diagnostic evidence were directed there;
the primary dirty checkout and user data were not changed or deleted.

The full production build is **still not passing**. Storage did not stop this
attempt: it reached the unchanged **600,000 ms** diagnostic deadline during
preparation, before creating its expanded-output staging directory. There is
no new production output, production browser journey or restarted-offline pass.
The original plan is not complete.

## Completed in this follow-up

- Committed build-tool change `8b98b7113b9d91c0a2c3cc5a4191e99755ab2522`, tree
  `33c9d61aa4d13b253450de4929d0ab0197e6e4c2`: expanded output writes are bounded
  to four, and parent-directory creation promises are shared. An error stops
  new scheduling and waits for already-owned writes before staging cleanup.
  Prepared bytes, ZIP ordering, clone verification and final output replacement
  remain unchanged. No simulator mechanics or training content changed.
- **47/47 targeted writer/build tests pass**, with zero failures, skips or
  cancellations; lint, formatting and whitespace checks pass. These are not a
  new run of the complete Practice suite or remote CI.
- A small, exact-byte-verified SMB diagnostic wrote 24 files in **5.080 s**
  sequentially versus **1.910 s** with four workers. Its owned temporary directory
  was removed. This demonstrates that bounded writes help this small workload;
  it does not prove full-build speed, browser performance or publication readiness.
- The failed normal CLI build recorded **4,429 committed input pins** unchanged
  before/after. Its owned process group was terminated and confirmed absent.
  The isolated worktree remained source-pinned throughout the attempt.
- The separate incomplete profiling process was also stopped and confirmed
  absent. No browser or installed app was opened during this follow-up.

The three reproducible/admitted simulator packages remain the unchanged
`6177d2cc83adb9cb76ff4088d502c21ddfd7d199` candidate from the
[18 October checkpoint](flight-practice-execution-2026-10-18.md). Its earlier
tests, ten beginner exercises, guides/backups and Gym continuity retain their
original source identities; they are not relabelled as tests of this build tool.

## Failed verification and concrete investigation target

The normal build used Node **22.22.2**, version `v0.151.1`, source `8b98b7113`,
and destination
`/Volumes/alex/CodexMigrationStaging/flight-practice-main-237-20261019-production`.
It timed out, received `SIGTERM`, and produced no output. Its log is empty.
Neither disk guard triggered: minimum measured output free space was
**57,344,000,000 bytes**, and local system free space **1,320,562,688 bytes**.
The unchanged 1.5 GiB output reserve was applied to the actual output volume;
an additional, separately recorded 1 GiB local-system floor protected this
external-output-only attempt. No browser profile was created. The input-based
`upperBoundBuildBytes` diagnostic field is not a guaranteed bound on generated
ZIP plus expanded output, and is not a hosting/capacity assessment.

A separate read-only preparation profiler requested a 45-second capture but
did not complete that procedure: it left a **zero-byte profile and no completion
receipt**. The owned process was explicitly terminated, exit 143. Do not call
this a successful 45-second profile, discard its failure, or use its timing as
a build/performance pass.

An exact-owned-process debugger stack caught preparation in:

`extractContent → visit → normalizedLevel → boundedJSON → copy`

The files are `scripts/localization-content.mjs`, `game/core/level.mjs`, and
`game/data-json.mjs`. This identifies main-game localization/content extraction
and level normalization as a concrete next diagnostic target. One stack does
**not** establish the whole ten-minute cost, explain the older remote CI timeout,
prove a simulator defect, or justify skipping validation. The earlier failed
SMB materialization attempt remains a separate source-bound result.

The owner selected **continued local diagnosis**. A mounted folder moves storage,
not computation; no remote shell access was inferred. The next diagnostic uses
an external supervisor so busy preparation cannot delay its own capture timer.
Further preparation fixes require concrete attribution first. Keep original
limits and validation intact; do not start another blind full-build retry.

## Updated remaining order and conditional effort

The [previous detailed rationale and impact table](flight-practice-execution-2026-10-18.md#remaining-order-impact-and-conditional-estimates)
still applies, with the following current status. Estimates exclude queue,
owner/reviewer waiting, setup and major newly discovered defects.

| Priority / ID           | Current remaining work                                                                                                | Conditional effort / concern                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 / R1                 | Fresh complete CI on the new committed head                                                                           | 1–2 h plus unknown queue time. The last inspected remote head was `00be8f590`; its jobs were pending/in progress. It cannot qualify newer writer bytes.                                                              |
| P0 / build prerequisite | Diagnose preparation with a genuinely external bound, or use explicitly approved remote execution                     | No reliable completion ETA yet. The share resolves output space, not this preparation timeout. No validation/deadline waiver.                                                                                        |
| P0 / R2                 | Refresh current Academy installed historical-session continuity                                                       | 1–2 h after a safely provisioned local test profile; not rerun here. Current Gym passes; historical Worlds remains D3.                                                                                               |
| P0 / R3                 | Actual all-app backup/loss/recovery and final offline flights                                                         | 1–2 focused days after safe test resources. Earlier one-proof Academy recovery is partial and bound to its older payload. Worlds projects/assets/records and other advertised libraries/archives remain unqualified. |
| P0 / R4                 | Native Cancel while genuine digest work is outstanding; verify late-write settlement and old/sibling preservation     | 4–8 h. No injected delays or synthetic overlap; absent overlap remains unverified.                                                                                                                                   |
| P1 / R5                 | Successful current normal full build, six EN/UK one-Play/guide/return journeys, and affected restarted-offline routes | 4–8 h after the build prerequisite. New plan/audit scripts are prepared only, not executed or passing evidence.                                                                                                      |
| P1 / R6                 | Agreed moving-flight/menu/load/recovery measurements and accepted budgets                                             | 4–8 h after workload/threshold decisions. Local Chrome is selected; no performance approval follows from that choice.                                                                                                |
| P1 / R7                 | Readable 200% layout, full focus and EN/UK screen-reader speech                                                       | 1–2 review days plus fixes; actual operator/screen-reader review still needed.                                                                                                                                       |
| P1 / R8                 | Real novice and maintainer walkthroughs                                                                               | 0.5–1 review day plus participant scheduling. Automated recipe checks are not human learnability evidence.                                                                                                           |
| Required / R9           | Final evidence assembly and 24 attributable package-gate decisions                                                    | 0.5–1 assembly day after checks; actual content/license/acceptance reviewer turnaround unknown. No invented approvals.                                                                                               |
| D1 / owner-deferred     | Physical controller/radio/touch checks                                                                                | No ETA; not passed.                                                                                                                                                                                                  |
| D2 / owner-deferred     | Hosting, allocation, upload, selection and public verification                                                        | No ETA; no publication or hosting changes authorized by the staging-path reply.                                                                                                                                      |
| D3 / owner-deferred     | Historical Worlds automated active-session check                                                                      | No ETA; explicitly left unverified. Current Worlds beginner passes do not fill it.                                                                                                                                   |

The previous 3–5 focused-day engineering estimate remains conditional, not a
calendar/full-release promise; this new preparation blocker has no diagnosed
fix or reliable elapsed ETA. The SIM owner's separate
[archive-retention incident](fpv-archive-retention-followup-20261018.md) remains
open. This follow-up did not touch that profile, diagnose its cause, approve
licenses/content, or access unmerged SIM work.

## Retained evidence

[Mac mini follow-up evidence](flight-practice-macmini-20261019-evidence.tgz)
contains the targeted TAP, exact source patch, small SMB diagnostic, original
failed normal-build receipt/input pins/log, native sample, incomplete profiling
source/log/zero-byte output, owned-process stack and audited cleanup. Prepared
directory-plan/audit sources are explicitly marked **not executed**. The initial
audit's incorrect absent-file assumption and its failure are preserved; the final
audit requires the actual zero-byte incomplete file and absent completion receipt.
Original execution receipts were not edited.

The archive contains **27 original files plus inventory**, 1,899,911 bytes before
compression; extracted files were independently rehashed. Archive SHA-256:
`bfd3ff3dfb826f55bc2ed1b7e7a8140ccd043fbdd4e75546c42f0e542820eb4b`.
