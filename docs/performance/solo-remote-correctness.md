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

## Prospective correction

The version-two plan retains the same eight scenarios, exact source identities,
240-second browser deadlines, build flags, budgets and pass assertions. It adds:

- A fresh, short, owned scratch directory, with byte-length and device/inode
  checks, to fit Chromium's Unix socket limit.
- A 1,200-second baseline build setup ceiling inside the unchanged 75-minute
  helper and 120-minute job. Historical main-pages build time was 591 seconds,
  but that different publication profile does not explain this normal build.
- Setup-only, 15-second scalar output-file witnesses to locate build progress
  without scanning its payload or profiling an observation.
- A bounded public warning/visibility/focus snapshot only after worker inspection
  has already ended unexpectedly paused. It cannot resume the game or turn that
  failure into a pass.

All original failures remain retained. Sustained and offline follow-ups have
separate plans and acceptance; neither is credited by these correctness checks.

## Other CI evidence

The optional-practice integration job in
[run 38972430979](https://github.com/mekhovov/revealline/actions/runs/38972430979)
passed using merge revision `0fcd92cb25cd64977fc129da28c469270d52061a`
and PR head `1467394b3c8555a65560b127a7b2dc0bf4335eb5`. Its groups report
362/362, 10/10, and 168 passed plus one skipped out of 169. The skipped historical
snapshot case has no pass credit. This is merge-integration evidence, distinct
from the exact candidate package and the still-open whole-PR checks.
