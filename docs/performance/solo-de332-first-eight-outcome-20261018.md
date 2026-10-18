# de332 first-eight correctness outcome — 2026-10-18

[Run 39096176143](https://github.com/mekhovov/revealline/actions/runs/39096176143)
passed all eight declared correctness rows. This is one baseline/candidate
first-30-seconds observation per engine at CPU rate 1, plus candidate worker and
paused-Canvas checks. The retained summary explicitly excludes performance
qualification; no three-run comparison, physical-device or thermal result is
established.

## Exact source and retained authority

- Tooling: `3e640259d0b39b5d00c044f541208bd56260ab6c`, tree
  `0d8e6535ac6a2a458d7a1080ce1f8a81ba130da2`.
- Candidate: `de3324607c82787c1a1fec9c13d4f8b5cb74cee4`, tree
  `2954fef5b0f1293ff2e6a97ce978a673dddaa7db`. Exact successful Appearance
  producer `39091745654`, package artifact `12123463810`; full archive and
  source/CSP checks passed remotely. Outer archive: 1,094,606,342 bytes,
  SHA-256 `47a1b17e91edd11434e2b9ad08883f43b0b3374c33569aebe24a4731cc8cba27`.
  Inner archive: 1,075,789,325 bytes,
  SHA-256 `d4e051135af877e6bb473b71713be4cc8a0b1bca877f892fa04675059fbe94aa`.
  Manifest SHA-256:
  `74525fe396c239be2950585cb28d32455706b27628e02e8cc194f770f885f10d`.
- Baseline: `8b01991942dc764b8aa4726851699ce1985e53ae`, tree
  `9373b6a74aea8fa1ef47aa17ace140b4cf714609`; existing normal V2 package from
  run `38998342742`, artifact `12088541389`, freshly reverified without rebuilding.
- Result artifact `12125002138`: 811,734 bytes, SHA-256
  `d6b5ed1d46c6f89eab6d40361893f2dedb2d6698a50b6ba612cf6058c68c705d`.
  Independent readback verified all 80 ZIP members' CRCs and all 71 evidence
  inventory byte/hash entries. The retained summary is 115,877 bytes, SHA-256
  `c67a520f87683b2a43479919f27e798c7cb3adff9a0d0896d815d554d5918955`.

The exact executed plan is retained in the artifact alongside the command
receipts and reports. Source plan:
[solo-remote-de332-correctness-plan.json](solo-remote-de332-correctness-plan.json).
Observation ran on hosted Linux, Node 22.13.1 and Playwright 1.62.1; Chromium
151.0.7922.34 and WebKit 26.5, 1280 × 800 at DPR 1.

## Correctness and closed owners

| Declared rows                                      | Chromium | WebKit |
| -------------------------------------------------- | -------- | ------ |
| Candidate real static MP3 worker                   | Passed   | Passed |
| Candidate paused Canvas retention/draw suppression | Passed   | Passed |
| Baseline original first30/public input/replay      | Passed   | Passed |
| Candidate original first30/public input/replay     | Passed   | Passed |

All four same-source native replay verifications matched the full authoritative
checkpoint, each with 51 verified served modules. All four separate Node
portability reconstructions still report mismatches; those failures remain in
the raw reports and are not relabeled as native correctness failures or passes.
The MP3 worker accepted the valid recording and rejected malformed/truncated
inputs. Its raw reports also retain blocked external soundtrack-catalogue
requests under the unchanged self-only CSP; this is not external soundtrack
qualification. The paused checks retained exact pixels with zero redundant
paused/covered draws, one resize invalidation draw and subsequent resumed draws.

All 14 current setup/row command owners closed with no forced cleanup,
violation, ambiguous process or surviving owned process. The two baseline
first30 commands and candidate WebKit first30 command retain exit code 2 for
numerical failures; the correctness assessor did not erase those exits.

## Numerical observations remain separate

The table uses exact nearest-rank application callback work from the same
external PRE_STEP→POST_RENDER observer. These measurements include observer
cost and submission, not GPU completion. Missed-opportunity rates remain the
unaltered reported values; their gate is at most 1%.

| Source / engine  | Work samples | Work p95 | Maximum work | Missed opportunities | Raw numerical result   |
| ---------------- | -----------: | -------: | -----------: | -------------------: | ---------------------- |
| 8b / Chromium    |        1,723 |   8.7 ms |     311.8 ms |             26.4304% | Failed                 |
| de332 / Chromium |        1,812 |   2.7 ms |      15.6 ms |                   0% | Passed observed window |
| 8b / WebKit      |        1,747 |     7 ms |       197 ms |             76.9555% | Failed                 |
| de332 / WebKit   |        1,876 |     3 ms |        14 ms |              2.9488% | Failed                 |

Candidate Chromium passed all internal observed-window gates. Candidate WebKit
passed work, keyboard latency, interruption and failure checks, but failed the
missed-opportunity rate; cadence p95 and p99 remain inconclusive from their
retained histogram bounds. Both candidate input-latency checks have 30 samples
and p95 in `(16.67, 20]` ms. Baseline internal timing/input/resource observations
are unavailable; external observations do not fill those gaps.

Candidate Chromium retained **full** quality in both snapshots; candidate
WebKit retained **reduced** quality in both. They must not be pooled as the same
quality stratum or generalized to a full-quality WebKit result.

WebKit's retained 203 ms prior-playing interval ends at document time 43,687 ms
and begins at 43,484 ms. Accepted Pause occurred at 43,514 ms, inside that
interval. Its following measured update was 1 ms. Keep the raw hitch and failed
numerical verdict; the interval does not establish a 203 ms active application
stall. Baseline long callbacks and all other raw hitches remain retained too.

## Next admission scope

This closes the declared eight-row correctness prerequisite and its scoped
owners. It supports review of the separately excluded six-row geometric Next
consumer on the exact same candidate package; it does not authorize a new run
by itself. Next still requires its own exact tooling/package/source admission,
unchanged route/read deadlines, strict native replay, retained failures and
owner cleanup. Matched overhead, three independent timing pairs per scenario
and quality, representative heavy workloads, lifecycle/resource gates and
physical-device qualification remain separate. No previous failed outcome is
replaced by this cohort.
