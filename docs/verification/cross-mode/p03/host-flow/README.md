# P03 host navigation regression corrections

The v0.59.0 candidate remains unqualified. This correction updates tests to the implemented navigation contract; it does not alter gameplay, saved formats, artwork or input rules.

Source `124f58df87f6b0c24c18525aca7d3ccc4a08c9e5` failed both hosted families (manual `35072057604`, source PR `35071688323`). Each reported 5,292 cases: 5,251 passed and 41 failed, comprising 40 leaf failures in sixteen files and one parent failure summary. Preflight passed; the PR ordinary build passed. The manual freeze was skipped. These results never qualified a release.

## Corrected setup

- Title Start launches the selected mission. Tests that need Pressure Lines choose it in Missions and await its exact campaign and artwork. Setup selectors are reached through Prepare.
- Library campaign Play requires its visible Expansion packs panel. Tests await completed selection before asserting the authored core, level, controls or rewards.
- Changing an unfinished flight requires a checked save and explicit Replace/Prepare. Restart uses a real paused attempt and confirmation. Stay cancels an older request before a newer action can own the screen.
- Checked saving can refresh `savedAt`; every other saved field remains exact. Once checked saving finishes, download failure must preserve exact bytes and write counts.
- Generic Load prepares a paused flight; Title Continue intentionally resumes. The history regression uses generic Load, verifies its original checkpoint and picture pin, and then explicitly resumes without writer reacquisition or storage writes.
- Native focus cannot enter boot-inert or closed-dialog content. The boot fixture models that boundary locally while preserving the expected title focus. Resize disposal verifies all actual observer identities rather than requiring a fixed implementation count.

All original gameplay, checkpoint, replay, persistent-state and late-completion guarantees remain. Direct export-handler regression tests establish pending-request ownership, not a complete visible menu journey. Whole keyboard/controller, real foreground and physical-device acceptance remain in P03.

## Verification scope

The original local two-file run reproduced both history/restart failures (7/9 passed); a diagnostic identified the unfinished replacement dialog behind the forced Resume. The corrected complete files passed 9/9 on Node 22.22.2.

The first broader local run reported 78/100 passed. Missing exact legacy chapter/PNG/optional payloads in the finite checkout prevented several tests from reaching their assertions. It also exposed the checked-save timestamp premise and an added fixture assertion confusing flight `briefing` with picture `ready`. Both are corrected explicitly. These failures remain original evidence.

Exact tracked dependencies are admitted in separate legacy and optional cohorts within the existing 100 MiB worktree budget. Four clean nonruntime source bodies are temporarily dematerialized through sparse patterns; their committed blobs and all working changes remain unchanged. Missing local files do not describe the full hosted checkout. The final local results are:

| Whole-file command scope                                                                 | Runtime      | Result                                                   |
| ---------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| Fifteen legacy/navigation files                                                          | Node 20.19.5 | 103/103 passed                                           |
| Optional chapter file                                                                    | Node 20.19.5 | 9/9 passed                                               |
| Fifteen legacy/navigation files before exact Scout PNG hydration                         | Node 22.22.2 | 101/103 passed; two renderer readiness failures retained |
| Complete renderer-size and chapter-download files after hydration/final setup correction | Node 22.22.2 | 7/7 passed                                               |
| Optional chapter file                                                                    | Node 22.22.2 | 9/9 passed                                               |

The Node 22 file-boundary record verifies that the thirteen other files were unchanged between their passing results and the final correction. The failed 101/103 command and overlapping 7/7 retest remain separate; they are not presented as one successful final cohort invocation. None of these commands reported cancelled, skipped or TODO cases.

A first optional-input preparation attempt named the wrong tracked pack path. Git refused it; the subsequently started test was stopped without completed cases. Its original output and preparation failure are retained. The corrected admission and both completed optional runs use the exact tracked pack files.

The accompanying evidence archive preserves original hosted failures, local failures, final closed run receipts, dependency admissions and reviews. This is scoped correction evidence, not release qualification. The newly committed source must pass both complete hosted families before publication.

## Recommendation applied

Use the same visible menu order and predictable focus as the player, with explicit Back and confirmation. [Xbox UI navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports consistent keyboard/controller routes. [MDN dialog guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) explains native modal focus and inert surrounding content. These references guide the fixture boundaries; source behavior and retained tests establish this implementation's actual result.
