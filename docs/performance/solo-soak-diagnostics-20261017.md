# Sustained diagnostic comparison — 2026-10-17

Run `38992974807` completed with all six jobs failed. All twelve planned
observations ran; none completes the declared 30-minute lifecycle workload.
This provides failure evidence, not sustained performance qualification.
The historical first-eight prerequisite remains false.

The source pair remains candidate
`3adcd53792043ef02459e86168c6b33a66d6ef00` and baseline
`b11745223861c3973ad4bf440cc536198b8e0371`, with tooling
`bffcbd838a7bb925da8aaf030695773f893d8bda`. This run does not contain the later
preparation recovery fix. Chromium repetitions used separately admitted CPU
stress factors 2.31, 2.17 and 2.13; WebKit used native CPU rate 1. Browser identities
are Chromium 151.0.7922.34 and WebKit 26.5. Source/package evidence and exact
declared scenario bytes remain in each retained artifact.

The earlier declaration-only failure, run `38991754600`, remains separately
retained. This successor fixed declaration checkout scope; it did not change
the gameplay route, deadlines, storage caps or numerical gates.

## Every observed outcome

The “results” count is the number of successful public won-result observations
before failure, not a count of fully qualified gameplay sessions. Repeat elapsed
time includes play, results, snapshots and Retry preparation. It is not continuous
active-play duration. Cycle indexes in the raw action paths are zero-based.

| Engine / repetition | Source    | Successful results | Repeat elapsed | Failure                                                  |
| ------------------- | --------- | -----------------: | -------------: | -------------------------------------------------------- |
| Chromium 1          | Baseline  |                  1 |        47.99 s | Next cut remains running; expected result times out      |
| Chromium 1          | Candidate |                 58 |       597.91 s | Next cut remains running; expected result times out      |
| Chromium 2          | Candidate |                  3 |        55.43 s | Next cut remains running; expected result times out      |
| Chromium 2          | Baseline  |                  1 |        46.39 s | Next cut remains running; expected result times out      |
| Chromium 3          | Baseline  |                  1 |        44.25 s | Next cut remains running; expected result times out      |
| Chromium 3          | Candidate |                135 |      1345.34 s | Diagnostic row evidence cap enforced; process terminated |
| WebKit 1            | Baseline  |                  2 |        53.90 s | Next cut remains running; expected result times out      |
| WebKit 1            | Candidate |                 12 |       148.46 s | Next cut remains running; expected result times out      |
| WebKit 2            | Candidate |                  0 |    Not entered | Start never leaves briefing within 60 seconds            |
| WebKit 2            | Baseline  |                  2 |        53.63 s | Next cut remains running; expected result times out      |
| WebKit 3            | Baseline  |                  2 |        53.26 s | Next cut remains running; expected result times out      |
| WebKit 3            | Candidate |                 93 |       988.87 s | Next cut remains running; expected result times out      |

The ten result-timeout rows were still running before failure cleanup explicitly
paused them. Candidate application snapshots record zero interruption events.
Where partial native export succeeds, its strict checkpoint matches and the
unfinished cut has zero closures with a trail of 32–34 cells. These cases show
the timed route can stop before closure; they do not establish an overload pause.
The three WebKit baseline partial exports are unavailable, so native mechanics
for those unfinished attempts remain unobserved.

The WebKit 2 candidate is a distinct preparation failure on the old source.
It remains at briefing after Start, with zero results and no interruption event.
The raw evidence can inform the preparation investigation; it does not verify
the later fix.

Eleven row owners closed without forced cleanup, survivors or ambiguous
ownership. Chromium 3 candidate has a failed owner receipt with
`inspection:Row evidence cap`, SIGTERM and forced cleanup, followed by no
survivors or ambiguous processes. Peak owned RSS was 2,455,912,448 bytes, below
the declared 6 GiB RSS cap. The raw browser report says “Page crashed” after
termination and cannot read final state. This sequence does not prove an
independent game/browser crash; the owner-enforced evidence limit is established.

Numerical status is fail for the ten result-timeout rows, inconclusive for the
briefing row, and not-evaluated for the terminated row. No status was promoted,
threshold relaxed, partial replay counted as completed gameplay, or rerun issued.

## Bounded report-growth investigation

Chromium 3 candidate retained a 71,794,734-byte report with 136 snapshots. The
compact JSON bodies of those snapshots total 32,714,925 bytes. Late snapshots
are approximately 250 KB each: the application portion is about 146 KB and the
external probe about 104 KB. Large fields include recent frame samples (91 KB),
event witnesses (25 KB), and probe work samples (87 KB).

The qualifier saves only at snapshot/repeat boundaries, outside animation
callbacks. However, each save serializes all prior snapshots with indentation
and writes an atomic `.partial` replacement next to the old complete report.
Two roughly 70 MB versions can exceed the unchanged 128 MiB row cap during
replacement. The observed owner violation is consistent with this mechanism;
the exact transient `.partial` byte count was not retained after cleanup.
There are no screenshot artifacts in this lane. Removing screenshots cannot
address this failure.

A prospective storage correction should write each compact snapshot once to an
immutable chunk and atomically update only a small index. Each referenced chunk
needs bounded path, size, digest and full readback verification; missing, changed,
duplicate or partial chunks must fail closed. Hydrated report values must remain
identical for numerical gates, resource comparisons, failures, all recorded
hitches, native checks and manual inspection. This avoids repeated serialization
without dropping early snapshots or raising the row cap. It requires separate
review and tests before any qualifier/reader changes or new remote declaration.

The timed cut also needs a separately reviewed route correction with generous
legal holds and model perturbation checks. Neither correcting report storage nor
extending the cut retroactively repairs these observations. A new protocol must
retain the old recipe, failure, source identities and raw gates, with no automatic
retry or repeat-until-pass behavior.

## Retention

All six final artifacts have verified API size/digest and complete ZIP-member
readback under `.cache/solo-followup/remote-soak-successor-bffcbd838/` in separate
`*-terminal/retained` directories. The five earlier completed-job provisional
receipts are preserved separately. The owned metadata monitor ended naturally
after all jobs completed. No local browser or device run was performed.

|    Artifact | Engine / repetition | ZIP SHA-256                                                        |
| ----------: | ------------------- | ------------------------------------------------------------------ |
| 12085944375 | Chromium 1          | `8e3dcd0c62f429b8bc30d7181240d8f513548e897565149612f56d5e49cedd48` |
| 12086520824 | Chromium 2          | `3ccb3985c87475d4cbcb9060c732d5c8600558063b22c4ce4d12ed1c210f650d` |
| 12086627998 | Chromium 3          | `2c0d85f49610f51cbe7f014899ca7a78aa3e71b6be02ca4ffd3549369895637b` |
| 12086466377 | WebKit 1            | `8eca549be4e4a24cb9aaa8680f8e90b163b32a18dbb8b1ad7dbf181c48108cd5` |
| 12086211637 | WebKit 2            | `128484e38b95b97b028b1911015cf713f38430b55558dd70f617346df9236ad4` |
| 12086970481 | WebKit 3            | `dba8a3427dabaada5e74e21c95b15e8a83a3ea1adc9e151c8864f978ef8f9441` |

Derived analysis is in `soak-terminal-analysis.json`; retained raw artifacts and
owner receipts remain authoritative. No 30-minute thermal, physical-device,
memory stability or sustained timing gate has passed from this cohort.
