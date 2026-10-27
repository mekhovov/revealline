# Flight practice: local diagnosis and browser follow-up — 19 October 2026

> **Latest planning review:** [current status, remaining work, ETAs and blockers](flight-practice-status-2026-10-19.md).
> It includes the accepted-main rebase, current local passes and remaining gaps. This
> execution report preserves original source-bound results and its execution-time
> observations; older queue/space readings below are not live state.

## Current local qualification — 19 October, after 06:00 Berlin

Candidate source remains `08fc3430c8f6670a76c1a749b3ad0b65bc9f9ded`, envelope
`61ae470760baa9f276a0d6c9c22a3f536e4e5de8048246e454c07ef0e56e7270`.
Observer, normal full-site build and regression source is
`bcc0b61a8cbc984f075fae1260b899fb1b78ff1d`, tree
`f4b42581df4ccc9ed5e97543810c4195f2cd26d7`. The later documentation/evidence
commit is not relabelled as this tested source. No application/SIM code changed
in this continuation. Local Chrome was 155.0.8059.85; Node was 22.22.2 on arm64.

### Production build and actual player journeys — passed

The normal build completed in **277.874 s** with four production writers, no
thread-pool override, original validators and the unchanged 600,000 ms ceiling.
All 4,431 original input pins remained unchanged. Output:
`/private/tmp/practice-main36-production-20261019`. Manifest: **3,560 files /
1,074,765,329 bytes**. ZIP: 1,075,900,881 bytes, SHA-256
`d2ab87ff383a16264c7c32841b522b84b37b8583e0781128dc523c31e618286b`.
Manifest SHA-256:
`a1755908cc8159ed0a0fa0bee5af3aad1f19900a5f015fd50cc738fba811e166`.

All six EN/UK original-production directory/one-Play/disarmed-Home/guide-return
journeys passed. Personal Tryzub preferences and language were retained.
All original manifest members were verified before/after, then independently
rehashed with 452 package-overlay members, stable launcher hashes and 24 actual
screenshots. The ZIP sidecar and native ZIP CRC check passed. This is not an
independent re-expansion/member-to-manifest ZIP comparison or public-site test.

The first independent audit incorrectly required no server request warnings.
The actual warning was `/favicon.ico`, rejected by the strictly project-rooted
local fixture before file lookup. The corrected audit classifies only that
specific warning and explicitly records `zeroRequestFailures: false`. Both
audits and the original warning are retained. No app request failure was waived;
public favicon behavior remains unqualified. Production receipt SHA-256:
`570989f7c225f4a9b97eeb2363b50c4ade6b1affab15c9dfaf0f5c6c35f4de9e`.

Earlier SMB timeouts remain failures. The local build pass resolves the immediate
build prerequisite, not the entire causal attribution or hosted capacity question.
No hosting action, deadline increase or content omission was performed.

### Current play, offline and update matrix — passed within scope

- **Ten real beginner exercises:** two Gym and eight Academy/World EN/UK
  Self-level/Acro cases. Public exports and independent exact-package replay
  passed. FPV receipt `223a1ee35162fef638459b9b7a12087fe791a0d9af52f0e894ce95fc8bc2b6f7`;
  Gym receipt `ba552223c9a8feb6a41f7a6d1298b1858d5f8f6c9fd1e2973336150738d5de33`.
  Vertical Acro is not rotational proficiency or human learning acceptance.
- **Six actual restarted-offline short-flight routes:** stable launcher and
  installed-window paths for each app, nine checkpoints, five imported CC0 World
  fingerprint witnesses. Receipt
  `70b84729f9f0850ab80659dac1f0210e18f1451a9a3179adab3ca5d5d6c5783d`.
  All three owned OS apps were removed. Context offline is not machine-wide loss.
- **Gym and Academy current installed-session update refresh:** genuine previous
  `v0.142.4` source `98ad85164737a647a00d5855cd56cc5f2e2ec610` to current candidate.
  Trusted blur paused Gym at 0.4 m and Academy at 0.3 m; returning focus did not
  resume; explicit resume reached 0.5 m / 0.4 m. Maintained assertions confirm
  unchanged document/time origin. Gym has ten migration checkpoints/seven World
  witnesses; Academy nine/five. The Gym lane installed/removed one owned OS app,
  Academy three. Failed initial audit assumptions about Gym's synthetic-fixture
  schema and OS-app count are preserved; corrected audits use its actual scope.
  Shared profile/proof seeds remain synthetic. Historical World active-session
  safety was not attempted or inferred from idle migration checks.

### Actual Academy data-loss recovery — passed, not all-data qualification

A current real EN `flight-01` proof was earned and externally exported. A fresh
owned profile with explicitly reduced **512 KiB** quota pool reached native
eviction after its ordinary five-minute cycle: one bucket/one round at 318.964 s.
The cache and Journey database disappeared; the local-storage installation
pointer survived. No filler, deletion or forced-eviction API was used. Numeric
baseline counters were unavailable, so no numeric delta is invented.

Cold offline launch failed honestly. Normal online preparation rehashed all
146 dependencies and the public Notebook import restored the exact original
proof. Independent replay passed. A restarted browser, offline before navigation,
exported that same proof and actually lifted to 0.2 m, then paused with four
stable samples over 637.14 ms. Uncached network requests failed before and after.
Owned browser/server/profile cleanup passed; elapsed time was 326.689 s.
Receipt SHA-256:
`2723036d6bc820e7dd7a283334e9e4e615906448ccf2b48b84f9b7179bcda6f6`.

This controlled native bucket eviction is not default browser policy, whole-origin
loss, every backup type or recovery of the separate affected SIM user profile.
Ambient available disk changed from 5.10 to 5.01 GB; physical disk pressure was
not induced. R3 remains open for the other applicable data.

### World recovery attempts — failed before eviction; paused

Three original attempts and their scripts are retained:

1. Offline preparation was incorrectly sought in Library; `#prepare-runtime`
   was hidden. Failed in 20.759 s.
2. Correct Settings navigation prepared the app, but the observer rejected its
   legitimate `Offline runtime preparation completed.` success wording. Failed
   in 5.786 s; no eviction occurred.
3. The corrected preparation succeeded. A real World lesson completed, exported
   and independently replayed. Editable-project setup then waited for a hidden
   Content & Offline tab. Failed in 27.918 s, before native eviction or restore.

All owned browsers, servers and disposable profiles were removed successfully;
all supervisor source checks remained unchanged. The independent failure audit
passes only as validation of these **failed observations**. It is not a recovery
pass or a diagnosis of a simulator defect. No fourth speculative retry was made;
the test approach is paused for user direction. The historical D3 check was never
run. Actual World project/asset/record recovery remains unverified.

### Native outstanding-digest cancellation — inconclusive

Chromium's [WebCrypto implementation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/webcrypto/webcrypto_impl.cc)
provided trace-event discovery; installed Chrome traces directly confirmed
`DoDigest`/`DoDigestReply` on service-worker threads. This source reference is not
asserted to be the exact installed build's source revision.

The baseline recorded 584 native events. A trusted Cancel run recorded 200, but
the visible click occurred during **Downloading 28%**, not outstanding hashing.
A second natural-window probe missed the brief Verifying state, made no click,
and completed preparation with 584 events. Raw traces and independent hashes
are retained. No digest interception, artificial delay or hidden mutation was
introduced. Instant events and incomplete URL/thread attribution limit overlap
analysis; absence of a witnessed overlap is not proof that overlap is impossible.
R4 remains open. These probes do not newly qualify previous/sibling retention.

### Full regression suites and source-setup correction

Practice: **1,278 passed**, zero failures/skips/cancellations, **488.397 s**.
The subsequent local-UX command initially failed before executing tests because
the isolated sparse worktree excluded committed `docs/evidence`. The exact
source checker was not relaxed. Disabling sparse checkout in this isolated
worktree restored 11,108 tracked files (~622 MiB), with no index/content change
or primary-checkout edit. The full raw-source check then verified **44,923 files /
3,507,915,396 bytes** and aggregate SHA-256
`934403998a92e99d62efc743dc14b38ebf0d0e910e583f484d535bfc13c691fc`.

The unchanged maintained local-UX runner then passed **757/757** in **203.549 s**,
zero skips/failures, unchanged 600-second ceiling, exact test hashes and stable
source before/after. Its original receipt SHA-256 is
`70c8195f070835e68cac5c1aec7aa1a4a3ee4ce9b4f0f7118f3c63ac245cb2a4`.
Both the initial setup failure and corrected result are retained. The independent
regression audit checked the original TAP, source receipt and test-file hashes.

The last remote snapshot still shows draft PR #1554 at `bcc0b61a8` with twelve
queued jobs. Local passes are not remote CI acceptance. No human, physical-device,
performance-threshold, screen-reader or public-release approval follows.

### Retained, independently audited evidence

[Evidence archive](flight-practice-main36-local-qualification-20261019-evidence.tgz):
**19,121,762 bytes**, SHA-256
`1cc4525f978ed2ca42bd2558d2d2e23c82846d132832cb91e12fe982a9ce81ff`.
It contains 221 inventoried files (69,584,736 expanded bytes) plus its inventory:
original receipts, logs, screenshots, actual test exports, native traces,
observer/audit source and failed attempts. Candidate packages and the large
production ZIP remain separately pinned, not duplicated in this packet.

The first extraction on the share hit its unchanged 120-second limit. That
partial output remains preserved. The **same immutable archive** was then
extracted locally in a fresh owned folder under the same limit and all 221
members were independently checked against their byte counts and SHA-256 hashes;
the complete local extraction/audit took 1.010 s. The share archive was rehashed
again unchanged. The [audit receipt and auditor source](flight-practice-main36-local-qualification-20261019-audit.json)
retain both outcomes. This is evidence verification, not another application
test or a reason to omit the first extraction failure.

## Integrated-candidate continuation — historical, 19 October, 03:59 Berlin

All 33 Practice commits were rebased onto accepted main
`36e8bc426589ab952c2fcc4fd62df39800edfeca`; the preserved old branch is
`codex/practice-before-main-36e8-20261019`. Range comparison marks all 33 patches
equal. No conflicts or edits to the shared primary checkout occurred.

Frozen checked source: `08fc3430c8f6670a76c1a749b3ad0b65bc9f9ded`, tree
`5481b630d5433ad5e23f0dbbea639faf99363bd4`, Node 22.22.2. A serial, bounded
selection of writer/CLI, coach, fullscreen, Capture First Flight, downloads and
preferences tests passed **127/127** in **42.850 s**, with no skips. This is not
the full required suite. Source identity remained unchanged before/after.

The three standalone apps were built twice with identical artifacts, committed
inputs verified and strict package admission passed. The child had a 512 MiB
heap cap and unchanged 600 s deadline. Small outputs were written only to the
approved SMB share, not the locally blocked full-site staging path:
`/Volumes/alex/CodexMigrationStaging/flight-practice-main36-20261019-candidate`.
Envelope SHA-256:
`61ae470760baa9f276a0d6c9c22a3f536e4e5de8048246e454c07ef0e56e7270`.

| App     | Admitted files / bytes | Package revision                                                   |
| ------- | ---------------------- | ------------------------------------------------------------------ |
| Gym     | 96 / 3,805,703         | `2fabcb0084773a5f9b36afac242bf9d0ecde85ef3bd7add73c0f6b427eb5504a` |
| Academy | 148 / 12,091,056       | `19a1a790df96769b409a8471f3e5f4a8bc0884caa8607be6591c5f74264ef202` |
| World   | 208 / 18,603,057       | `147ee81401ef4d78f4e22eab1b87b88125b0d5ed4c446735209b17d43d815cdb` |

Exact ZIP comparison with candidate `6177d2cc8` shows 91/144/202 unchanged
members and 5/4/6 changed members respectively, with no additions/removals.
The changed sets include generated worker/manifest identities. Actual changed
runtime includes shared fullscreen/settings in all apps and coach/mode-switch
behavior in World. Stable launcher members are unchanged. These comparisons
define affected rechecks; they do **not** transfer old browser acceptance to new
payloads. All 24 new package gate decisions remain pending; publicEligible=false.

### Bounded SMB hypotheses, not a production tuning change

The first diagnostic used 128 pinned committed files and application worker
counts 4/8/16/16/8/4. Write times were
9.292/9.458/9.175/9.161/8.982/9.904 seconds: no useful observed gain from higher
application concurrency alone. All 768 outputs were byte-verified.

A second independent ABBA diagnostic held in-memory application workers at 16
and started fresh children with I/O thread pools 4/16/16/4. Times were
9.359/5.789/6.763/9.081 seconds; all 512 outputs were byte-verified. Inherited
UV_THREADPOOL_SIZE was unset. Each child had a 25 s external deadline and all
exited normally. Test-only output was removed after exact readback; receipts
were retained. No user data, historical failed staging or unrelated files were
removed.

This tests an I/O scheduling hypothesis consistent with the
[Node CLI documentation](https://nodejs.org/api/cli.html#uv_threadpool_sizesize):
asynchronous filesystem work shares a bounded pool, and the setting must be
provided before process startup. The fetched documentation is current, whereas
the measured runtime was explicitly Node 22.22.2. The exact-version document
could not be fetched by the web tool. Measurements, not documentation alone,
support a contribution for this small workload. They do not attribute total
preparation cost, demonstrate a complete build within 600 s, establish optimal
concurrency or justify changing users' environments. Production remains at four
application workers with no new environment override.

### Resource and evidence boundary

Local free space was most recently 661 MiB; the share approximately 51 GiB.
No full build or new native-browser profile was started below existing guards.
The pending owner request is to free at least 4 GiB locally or supply a fast
local drive. Share capacity does not resolve local browser/profile pressure.
Hosting, physical hardware and the historical World check remain deferred.

Retained archive: `flight-practice-main36-20261019-evidence.tgz`, **30,536 bytes**,
SHA-256 `94f398bc057546e14f86b026731f5d11f33933c8cb056594b57e1ac2a8e60847`.
It contains 19 receipts/logs/observer scripts/metadata files plus a hash inventory;
all members were extracted on the share and rehashed successfully. Actual
candidate ZIPs remain in the immutable share directory; they are not duplicated
in this small archive. The last pre-push remote snapshot still concerns old
head `1b8dcb491` (eight successes, one running, five queued), not source `08fc3430`.

## Earlier outcome — original source-bound results

The owner-approved Mac mini folder is mounted and usable:
`/Volumes/alex/CodexMigrationStaging`. It is an **SMB network share**, not a
fast local disk or remote execution service. It had approximately **53.4 GiB
free**. Generated build output and diagnostic evidence were directed there;
the primary dirty checkout and user data were not changed or deleted.

The full production build is **still not passing**. The first attempt reached the
unchanged **600,000 ms** limit during preparation. After adding opt-in phase
reporting, a later attempt reached **expanded-file writing** before that same
limit. Neither storage guard triggered. Neither attempt produced an adopted
production output. There is no current production-directory journey pass.

Independent native-browser work did progress: **current Academy historical
installed-session continuity passes**, and **all six restarted-offline short-flight
routes pass** for the current three-package candidate. Both results were audited
against their original receipts and source identities. They do not depend on a
successful main-game production build. The original plan is not complete.

## Completed in this follow-up

- Committed build-tool change `8b98b7113b9d91c0a2c3cc5a4191e99755ab2522`, tree
  `33c9d61aa4d13b253450de4929d0ab0197e6e4c2`: expanded output writes are bounded
  to four, and parent-directory creation promises are shared. An error stops
  new scheduling and waits for already-owned writes before staging cleanup.
  Prepared bytes, ZIP ordering, clone verification and final output replacement
  remain unchanged. No simulator mechanics or training content changed.
- The initial writer change passed **47/47** targeted tests. Subsequent progress
  reporting and conservative cross-volume clone-veto changes pass **53/53**, with
  zero failures, skips or cancellations; lint, formatting and whitespace checks
  pass. These are not a new run of the complete Practice suite or remote CI.
- A small, exact-byte-verified SMB diagnostic wrote 24 files in **5.080 s**
  sequentially versus **1.910 s** with four workers. Its owned temporary directory
  was removed. This demonstrates that bounded writes help this small workload;
  it does not prove full-build speed, browser performance or publication readiness.
- The failed normal CLI build recorded **4,429 committed input pins** unchanged
  before/after. Its owned process group was terminated and confirmed absent.
  The isolated worktree remained source-pinned throughout the attempt.
- The separate incomplete profiling process was also stopped and confirmed
  absent. Later externally supervised profiling and independent browser runs
  are detailed below; the earlier incomplete profile remains a failure.

The three reproducible/admitted simulator packages remain the unchanged
`6177d2cc83adb9cb76ff4088d502c21ddfd7d199` candidate from the
[18 October checkpoint](flight-practice-execution-2026-10-18.md). Its earlier
tests, ten beginner exercises, guides/backups and Gym continuity retain their
original source identities; they are not relabelled as tests of this build tool.

## Local diagnosis after the owner's reply

The owner selected **continued local diagnosis**, not remote execution. The
following work used local CPU and the approved mounted folder for evidence/output.
No simulator mechanics, training content or primary-checkout files changed.

Three externally supervised 30-second CPU sampling windows completed within a
separate 120-second diagnostic ceiling. Preparation was intentionally stopped
after capture; **validation and the build were not completed by that profile**.
The samples identify level normalization, route checks and geometry/content
compilation as investigation targets, not a whole-run cost attribution. The
sampling overhead and observed machine load prevent performance-acceptance claims.

Separate non-debugger, original-helper diagnostics completed on source
`929348a2031f2f994bdc21e3550b34ca1ab4475a` without changing committed output:

| Diagnostic                  | Measured result                                                    | What it establishes / limitation                                                                                                    |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Localization operations     | 315.165 s total; content registry 282.532 s                        | Generated registry and catalogue match committed bytes. This is an isolated helper sequence, not the original full validator/build. |
| Core preparation validators | 64.181 s total; snapshots 42.014 s; packs 15.885 s                 | Original validators complete in isolation. No ZIP or expanded site is built.                                                        |
| Distribution preparation    | 87.780 s total; external chapters 37.519 s; mission index 43.621 s | Original compilers/admission and mission-index byte comparison complete. No final build is produced.                                |

Do not add these separate-process timings and call the sum exact full-build
attribution: caches, load and process startup differ. The registry's 356,931 bytes
match SHA-256 `d08fa07eb61dfcf2cc1c33e62ee099a9092681caa21192fab78c80d534f64715`.
No core normalization/geometry change was made from these observations.

### Bounded implementation changes and failed normal-build retest

Commit `56acb4240af76c5b351427cc9e87a422070a4463` adds the explicit CLI option
`build --progress stderr` and an async phase callback. Markers report **phase
starts**, not percentages or completed work. Default CLI output is unchanged.
Reporter errors before adoption preserve the previous output. Exact-byte tests
compare builds with and without reporting.

The normal full CLI build on that commit passed preparation, manifest and ZIP
generation, then timed out in **expanded-files** at the unchanged 600,000 ms.
All **4,429 input pins** matched before/after; its owned process group was stopped
and confirmed absent. The destination was absent, and neither disk guard fired.
This narrows that attempt's last phase but does not diagnose the earlier remote
CI timeout or prove a fixed build. Staging directories without exclusive ownership
evidence were left untouched.

Commit `623918462685c27f30bb03141f76e02ab863d255` checks source/staging devices
once per batch to **veto** impossible or unknown cross-volume clones. Same-device
files retain the original per-file eligibility, source-byte and target-byte
checks. All owned metadata probes settle even when one fails. Prepared bytes,
four-worker bound, validation and replacement semantics remain unchanged.

An exact-byte-verified, 24-file ABBA comparison at the same four-worker bound
measured old/new runs of **1.589 / 1.636 / 1.439 / 1.679 s**. The ranges overlap;
this is **not strong evidence of a full-build speed improvement**. There has been
no full normal-build retest of `623918462`. Do not report the timeout fixed or
increase the deadline on the strength of this microdiagnostic.

## Newly audited native browser results

Both runs used Chrome **155.0.8059.85** on local macOS arm64 and the unchanged
admitted development candidate `6177d2cc83adb9cb76ff4088d502c21ddfd7d199`, tree
`ba3902515d73e97ae18dda8ffc57ee698eba9825`, envelope SHA-256
`b64909c3127ea428be8d188444bf2ae0873e299b71bfd991a737ba0c658ce2a5`.
It remains **not public-eligible**. The observer checkout was `623918462`; actual
harness/helper hashes were checked, not treated as newly built simulator bytes.

### R2: current Academy installed historical-session continuity — passed

The previous package is the genuine admitted `v0.142.4` source
`98ad85164737a647a00d5855cd56cc5f2e2ec610`, not a renamed current fixture.
Distinct installed standalone windows caused a trusted native focus loss during
visible flight. The old document/time origin remained unchanged, paused height
held at **0.30 m**, returning focus did not resume flight, and explicit resume
reached **0.40 m**. The last paused witness was at 9,513 ms; that is not total
procedure duration. Nine update/rollback checkpoints and five saved-World
fingerprints pass. Receipt SHA-256:
`639c1c37d3d43ecb4bb176744a468d1fdb6f79f6ca79f2952a7be67b4adf8f0a`.

This closes the current Academy rerun alongside the prior current Gym pass.
It does **not** close owner-deferred historical Worlds, actual data-loss recovery
or all-app active-flight coverage. The shared seeded proof/profile is explicitly
synthetic and is not physical-radio or completed-lesson evidence.

### R5: six current restarted-offline short-flight routes — passed

All three apps launched and visibly lifted/paused through both stable launchers
and installed app windows **after closing and restarting Chrome**. The browser
context was offline before app navigation; this is not a machine-wide airplane
mode claim. The imported CC0 Roadworks project passed five exact retained-state
witnesses and both World flight routes. Original package members/dependencies,
seven screenshot hashes, native receipts and cleanup predicates were audited.
Receipt SHA-256:
`c4f01b2b1e2911bb09604362d04f5988f711b14ac3b10e17faa02468d575334d`.

These are English short-flight routes, not whole lessons, rotational Acro,
200% zoom or screen-reader acceptance. EN/UK beginner/guide results remain their
separate earlier receipts. The alternate synthetic version in this run is not
genuine historical-update evidence. Both new runs removed all three owned test
apps and their disposable profiles, with no reported cleanup errors. No real
user profile was used or removed.

## Earlier failed verification — retained, not superseded as a pass

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

The later external supervision and isolated-helper results above address this
investigation target without rewriting these original failed receipts. Keep
original limits and validation intact; do not start another blind full-build retry.

## Updated remaining order and conditional effort

The [previous detailed rationale and impact table](flight-practice-execution-2026-10-18.md#remaining-order-impact-and-conditional-estimates)
still applies, with the following current status. Estimates exclude queue,
owner/reviewer waiting, setup and major newly discovered defects.

| Priority / ID           | Current remaining work                                                                                            | Conditional effort / concern                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 / R1                 | Fresh complete CI on the new committed head                                                                       | 1–2 h plus unknown queue time. Earlier inspected jobs cannot qualify the newer progress/veto changes; complete current-head CI is not established here.                                                              |
| P0 / build prerequisite | Finish diagnosis of current normal-build preparation/materialization and verify a successful full build           | No reliable completion ETA. Isolated validators complete, but the normal instrumented run fails in expanded-files at 600 s. The latest conservative writer change has no full retest; no deadline/validation waiver. |
| Complete / R2 refresh   | Current Academy historical installed-session continuity rerun                                                     | Passed and audited here. Current Gym passed previously. Historical Worlds remains explicitly D3, not an all-app active-flight approval.                                                                              |
| P0 / R3                 | Actual all-app backup/loss/recovery and final offline flights                                                     | 1–2 focused days after safe test resources. Earlier one-proof Academy recovery is partial and bound to its older payload. Worlds projects/assets/records and other advertised libraries/archives remain unqualified. |
| P0 / R4                 | Native Cancel while genuine digest work is outstanding; verify late-write settlement and old/sibling preservation | 4–8 h. No injected delays or synthetic overlap; absent overlap remains unverified.                                                                                                                                   |
| P1 / R5                 | Successful current normal full build and six EN/UK production one-Play/guide/return journeys                      | 4–8 h after the build prerequisite. Six current restarted-offline short flights now pass and are audited; current production plan/audit sources remain unexecuted, not passing evidence.                             |
| P1 / R6                 | Agreed moving-flight/menu/load/recovery measurements and accepted budgets                                         | 4–8 h after workload/threshold decisions. Local Chrome is selected; no performance approval follows from that choice.                                                                                                |
| P1 / R7                 | Readable 200% layout, full focus and EN/UK screen-reader speech                                                   | 1–2 review days plus fixes; actual operator/screen-reader review still needed.                                                                                                                                       |
| P1 / R8                 | Real novice and maintainer walkthroughs                                                                           | 0.5–1 review day plus participant scheduling. Automated recipe checks are not human learnability evidence.                                                                                                           |
| Required / R9           | Final evidence assembly and 24 attributable package-gate decisions                                                | 0.5–1 assembly day after checks; actual content/license/acceptance reviewer turnaround unknown. No invented approvals.                                                                                               |
| D1 / owner-deferred     | Physical controller/radio/touch checks                                                                            | No ETA; not passed.                                                                                                                                                                                                  |
| D2 / owner-deferred     | Hosting, allocation, upload, selection and public verification                                                    | No ETA; no publication or hosting changes authorized by the staging-path reply.                                                                                                                                      |
| D3 / owner-deferred     | Historical Worlds automated active-session check                                                                  | No ETA; explicitly left unverified. Current Worlds beginner passes do not fill it.                                                                                                                                   |

The previous 3–5 focused-day engineering estimate remains conditional, not a
calendar/full-release promise; the normal-build blocker has no verified
fix or reliable elapsed ETA. Independent R3/R4 work need not wait for a blind
production rebuild or a queued PR. The SIM owner's separate
[archive-retention incident](fpv-archive-retention-followup-20261018.md) remains
open. This follow-up did not touch that profile, diagnose its cause, approve
licenses/content, or access unmerged SIM work.

The last inspected remote PR head was `929348a20`: creator checks passed,
optional-practice was running, and the other reported checks were queued. That
snapshot does not qualify later commits. The PR remains draft; no complete
current-head CI pass or queue completion time is asserted.

## Retained evidence

[Mac mini follow-up evidence](flight-practice-macmini-20261019-evidence.tgz)
contains the targeted TAP, exact source patch, small SMB diagnostic, original
failed normal-build receipt/input pins/log, native sample, incomplete profiling
source/log/zero-byte output, owned-process stack and audited cleanup. Prepared
directory-plan/audit sources are explicitly marked **not executed**. The initial
audit's incorrect absent-file assumption and its failure are preserved; the final
audit requires the actual zero-byte incomplete file and absent completion receipt.
Original execution receipts were not edited. This first archive does not contain
the later diagnostics or native passes; those are retained separately below.

The archive contains **27 original files plus inventory**, 1,899,911 bytes before
compression; extracted files were independently rehashed. Archive SHA-256:
`bfd3ff3dfb826f55bc2ed1b7e7a8140ccd043fbdd4e75546c42f0e542820eb4b`.

[Local diagnosis and native-browser evidence](flight-practice-local-diagnosis-20261019-evidence.tgz)
retains the three CPU sampling windows, original-helper phase receipts/logs,
instrumented failed normal build, original source snapshots at `929348a20`,
`56acb4240` and `623918462`, red/green targeted TAP, small ABBA diagnostic,
both native browser receipts/audits and their eight screenshots. It contains
**79 files plus inventory**, 10,810,290 bytes before compression. Every extracted
file was independently rehashed; source/runtime identities remain distinct.
Archive SHA-256:
`beea4c2255250a3fdbe08f12528f41d4a7a7448fcb4f435a8ec8030eb8a5abed`.

The evidence archive is not a publication bundle. Original failures were retained,
not edited into passes; no performance, hardware, human or public-release approval
is implied by an inventory or successful audit.
