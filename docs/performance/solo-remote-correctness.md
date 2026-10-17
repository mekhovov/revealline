# Solo remote correctness follow-up

This Linux cohort continues checks while the local browser and two evidence reads
have unresolved owners. The user confirmed the network share is connected; the
waiting processes remained present on 16 October 2026 at 22:17 UTC. No new local
browser run was admitted. Linux results do not qualify Safari on iPhone, installed
PWA behavior, Steam Deck Chrome, temperature, or the previous macOS timing matrix.

## Retained first attempt

[Run 38972430908](https://github.com/mekhovov/revealline/actions/runs/38972430908)
used tooling `1467394b3c8555a65560b127a7b2dc0bf4335eb5`, exact candidate
`2ec605eb76e38f9c9a3e21b7fa82dd80c580c457`, and original-main source
`b11745223861c3973ad4bf440cc536198b8e0371`. It **failed**. The candidate archive,
source/CSP verification, pinned browser installation and Linux wrapper checks
passed; these do not replace the browser results below.

| Planned observation                               | Result                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Candidate Chromium worker                         | Failed at launch: Chromium's Unix socket path was too long.                                          |
| Candidate WebKit worker                           | Failed: all three MP3 validation cases were correct, but play became paused. Cause was not captured. |
| Candidate Chromium paused rendering               | Failed at launch with the same socket-path error.                                                    |
| Candidate WebKit paused rendering                 | Passed.                                                                                              |
| Baseline/candidate first 30 seconds, both engines | Not run: normal baseline build reached its 600-second setup deadline.                                |

The failed baseline build had no stage output, peaked at 2,297,393,152 bytes of
owned RSS, and required termination. Its cause is unattributed. Every command
closed without surviving or ambiguous processes; forced termination still makes
that command fail. No retry, numerical pass or missing observation was inferred.

Actual environment: Ubuntu runner image `20261012.334.1`, four AMD EPYC 7763 CPUs,
16,766,414,848 bytes of memory, Node 22.13.1, Playwright 1.62.1, Chromium
151.0.7922.34 and WebKit 26.5. All eight rows are excluded from performance
qualification.

The 249,998-byte artifact `12077289287` has SHA-256
`78a094bf0858fb1b0e255ee0a895110c93fbc05895c264ee08d5903a4a7fced5`.
All 42 members were retained and read back. The acquisition receipt is
`5bfe1917d78c12c346dd4ee949e49a355ec87577bc662833d4d3a4b8eefafc71`.
Raw reports and logs remain under
`.cache/solo-followup/remote-linux-correctness-38972430908/`.

The preceding workflow attempt, `38972229017`, failed validation before creating
any job because `runner.temp` was used in job-level environment declarations.
The corrected workflow initializes those paths after runner assignment. That
failed attempt remains separate from the eight-row execution above.

## Second attempt and source-contract correction

[Run 38975072391](https://github.com/mekhovov/revealline/actions/runs/38975072391)
used tooling `41e925a6fbd7e1d3d68fbe092bf8cee368f7827a` with the same exact
candidate and baseline sources. All four worker/paused-render checks passed in
Chromium 151.0.7922.34 and WebKit 26.5. The earlier WebKit pause did not recur;
its cause remains unattributed, and its failed report is retained.

The normal baseline build completed in 384.863 seconds, with peak owned RSS
5,311,541,248 bytes. Its ZIP/member verification passed. Source verification
then failed four checks because it required the candidate's MP3 worker modules,
which do not exist in original-main source `b1174522`. The four first-30-second
rows did not run. All observed processes closed cleanly without forced cleanup.
This is a failed cohort with four passing browser rows, not an eight-row pass.

Artifact `12078379364` is 262,730 bytes, SHA-256
`11d96fa02196171f0bb167ed96790b750782c3b17b1d50360d47b2c178dfbfc1`.
All 49 members were retained and read back; receipt SHA-256 is
`f5f41a6c2e325b71cb1defe09b08f5548c15694fd4906d368af2835af889bb05`.
Raw evidence remains under `.cache/solo-followup/remote-linux-correctness-38975072391/`.

The next verifier binds worker requirements to the actual compared source:
all four files are explicitly read and compared even when omitted from the
package. Any source presence requires the complete package and both offline
core inventories; a partial source contract fails. A historical source with
none of the files permits none in the package or inventories. This preserves
candidate closure checks without imposing a later capability on the baseline.
Five focused negative/positive tests and five existing archive tests pass.
The earlier failed proof is not rewritten or admitted for reuse.

The short owned scratch paths, 1,200-second setup ceiling, bounded setup-only
file witnesses and unexpected-pause snapshot remain. Browser deadlines,
scenario assertions, build flags and resource budgets remain unchanged.
Sustained and offline follow-ups have separate plans and acceptance; neither
is credited by these correctness checks.

The version-three lane also retains a normal baseline artifact only after its
build, full ZIP/member verification and source/CSP proof pass. It binds the
exact producer, source and tree, command receipts and checksums, then performs
a full readback before upload. Future comparisons must pin the actual artifact
and independently verify it again; failed or missing proof cannot enable reuse.
The 75-minute helper and all row deadlines stay fixed. The job allows separate
setup and upload steps (139 minutes of declared step caps inside 145 minutes),
including the additional baseline upload; this does not extend gameplay windows.

## Third attempt: eight correctness checks passed

[Run 38978329593](https://github.com/mekhovov/revealline/actions/runs/38978329593)
used tooling `d569ce092db47d14f974da24063f82f4a280a19a`, the same exact
`2ec605eb` candidate and original `b1174522` baseline. All eight browser rows
passed their correctness requirements. All four first-30-second observations
passed strict replay in their observed engine; the separately retained Node
portability mismatch does not replace those checks. Every observed command
closed cleanly. The original-main normal build passed independent archive,
source, worker-contract, offline-resource and CSP verification.

This cohort is explicitly **excluded from timing qualification**. Raw combined
statuses remain baseline Chromium failed, candidate Chromium inconclusive,
baseline WebKit failed, and candidate WebKit failed. The candidate's internal
pre-play cadence collected only 15/30 and 12/30 eligible callbacks respectively.
Its default 60 Hz estimate is not a measured baseline. The independent blank
reference measured 16.7 ms and 16 ms; it is not silently substituted for the
missing internal calibration. The title-ready observation had long callback
gaps despite low Phaser work, and WebKit retains a 227 ms interval attributed
to the preceding playing phase. These signals require separate attribution.

Artifact `12080518438` contains 70 fully read-back members. Its 603,136-byte
archive SHA-256 is `f6e7d037e053c3075d7c80f5810806f24af995747ee4fa8015fc8eb231998d43`;
the summary SHA-256 is `e9127024581f3f8b7cc53265736c6569d034bb91081a7a4928253fa0a1beae06`.
The reports, clean closures and analysis remain under
`.cache/solo-followup/remote-d569-monitor-01/`.

The successful producer also published baseline artifact `12080662080`, exact
normal-build ZIP SHA-256 `1e9bb6ad49ced329fecd66f9976c024dad2949bdf4b008f376ee50d6bbf36290`.
Prospective consumers pin its actual run, source/tree, outer archive and positive
readiness proof, then verify every archive member and the source/CSP contract
again before use. Local admission retained the small publication proof and
GitHub metadata; the large baseline archive was not downloaded locally.
Missing or mismatched reuse evidence fails admission without a rebuild fallback.

The subsequent exact-source Appearance package for `d569ce092` succeeded in
[run 38978329616](https://github.com/mekhovov/revealline/actions/runs/38978329616),
including all 68 declared focused files. Its five-member compact metadata
artifact was independently read back and agrees with the original upload API.
Original artifact `12081585270` has outer SHA-256
`f7d71b126e6076622fdfa1d7eeccdff0e8dbf594fb45304773c470f66ae6e6ca`
and inner ZIP SHA-256
`1d5ce94afe14c0419f26d160986567d54a05c11b7edd6e055871f4de41b866b5`.
This is successful packaging plus verified small metadata, not full local
archive verification or native qualification of the newer Demo runtime.
The first eight passing rows still used `2ec605eb`.

## Current package: seven correctness checks passed, one failed

[Run 38985941469](https://github.com/mekhovov/revealline/actions/runs/38985941469)
used tooling `ddbb565a0640b61f83edde5828a2825942cf26ab`, exact candidate
`3adcd53792043ef02459e86168c6b33a66d6ef00` (runtime `0d9fef112`) and the
original-main `b1174522` package. Candidate and baseline admission passed full
archive, source, static-worker contract, offline closure and CSP verification.
The candidate archive has 3,502 verified members and SHA-256
`8f3a54fe973540f6bd0fbcf069d1a8f87702f69ef87d901da83b563ce564a3d8`;
its manifest SHA-256 is
`efc58d03a6d4abb45dca63fbf8f4ec85232a47b3f9259e14b26efc6cfc086718`.
The reused baseline was independently reverified without a rebuild fallback.

**Seven of eight correctness rows passed.** Chromium worker validation, both
paused-render checks and all four first-30-second scenarios passed. Each of
those four scenarios passed strict replay in its observed engine. WebKit worker
validation accepted the valid MP3 and rejected both malformed and truncated
inputs through the exact static worker, with no pending request or owned bytes.
Nevertheless, visible, focused gameplay had automatically paused for a long
frame interruption, so the unchanged running-state assertion failed. No page
error occurred. The current probe did not retain the precise frame/phase
interval; the cause remains unattributed. This is not an eight-row pass or a
proven harness failure. The similarly paused first attempt remains separate.

All commands closed without forced cleanup, surviving or ambiguous processes.
All eight rows remain excluded from timing qualification, including Chromium's
raw observed-window pass. Candidate WebKit retained incomplete internal cadence
calibration, missed callback deadlines and a long preceding-playing interval;
its raw combined timing result remains failed. No physical-device, installed-PWA,
GPU-completion or heat result is inferred.

The 796,542-byte evidence artifact `12083397932` has SHA-256
`f4ec29665182e28337d14bed46323e70e16981912be53170c75c97063419c3e1`.
All 79 members and the producer's internal inventory were independently read
back. The immutable analysis has SHA-256
`4b8427ce16ddf6754efaba7055336b86cbf1393b84e91e625f4d1397aad17500`.
Evidence remains under
`.cache/solo-followup/remote-current-correctness-38985941469/`.
The large package was verified on the isolated Linux runner; this follow-up
retained and verified its bounded proofs locally without downloading that
payload again. Later diagnostic lanes cannot mark the first-eight gate passed.

### Separate worker-pause attribution cohort

A prospective six-window diagnostic compares three worker inspections with three
public-Start idle controls in the fixed order worker/control, control/worker,
worker/control. Each fresh WebKit context observes twelve seconds. This adds
opt-in bounded application diagnostics and eight worker-stage timestamps; it
exports only after the window has stopped. A still-running game receives the
ordinary public Menu, which forces Pause rather than toggling Resume; an
automatically paused game receives no action.
There is no automatic Resume, retry-until-green or per-frame DOM logging.

The original ordinary worker probe keeps its validation, active-state checks,
static worker and deadlines. The new idle arm makes no worker-validation claim.
The independent diagnostic retains the failed first-eight prerequisite and cannot
qualify timing, physical devices or a successor performance stage. Full exact
`3adcd5379` package verification precedes execution. All six observations must
be retained, including failures; correlation with worker timestamps alone does
not establish causation. The focused wrapper/contract group passes 24 tests,
with three Linux-only cleanup tests explicitly skipped on this macOS host.
Execution results remain pending.

## Other CI evidence

The optional-practice integration job in
[run 38972430979](https://github.com/mekhovov/revealline/actions/runs/38972430979)
passed using merge revision `0fcd92cb25cd64977fc129da28c469270d52061a`
and PR head `1467394b3c8555a65560b127a7b2dc0bf4335eb5`. Its groups report
362/362, 10/10, and 168 passed plus one skipped out of 169. The skipped historical
snapshot case has no pass credit. This is merge-integration evidence, distinct
from the exact candidate package and the still-open whole-PR checks.

The exact-head Company job in that same run completed all **1,363/1,363**
Company tests, followed by complete groups of 16, 54, 51 and 157 tests, all
passing. Source-release checks also passed (72 JavaScript and 64 Python tests).
The subsequent packaging step was canceled, and package uploads were skipped.
The job is **canceled**, not passed; complete test steps do not establish a
successful package or whole-PR pass.

The next exact-head Company job, source
`41e925a6fbd7e1d3d68fbe092bf8cee368f7827a`, **passed** in
[run 38975072276](https://github.com/mekhovov/revealline/actions/runs/38975072276).
It completed the 1,363 Company tests, all 1,641 focused JavaScript tests,
72 source-release JavaScript tests and 64 Python tests, then successfully
compiled and inspected the original package members. The retained 676,571-byte
job log has SHA-256 `694d43d0983b36fba2f8feb5fbc701f63af8e5d8236d51acb7f4672ef8ac92cd`.
The earlier canceled job remains a separate result. Appearance production CI
also succeeded at exact `41e925a6` in run `38975072909`; that archive was not
independently acquired, and the latest verified local package remains `2ec605eb`.
These results do not qualify the subsequent Demo runtime change.
