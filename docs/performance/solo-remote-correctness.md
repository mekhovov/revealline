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
