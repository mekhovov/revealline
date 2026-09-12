# Round 18 independent runtime review

Reviewed on 2026-09-12. This is a bounded, independent review of the equipment-goal increment and the final reading-region adjustment. It is separate from the release owner's full source gates and browser checks.

The review covered the v2 equipment observer, v1 dispatch, optional replay observation, restored observers, live app setup/fact capture, award and picture-label boundaries, and the related checklist presentation. The final pass covered overlay button sizing, keyboard reading focus, and the separate hangar shortcut. No production files were edited by this reviewer.

## Findings and fixes

1. **A completed finish step appeared pending when another equipment condition was missing.** In `equipmentLines`, both the Safe Return clean finish and the Supply Line mission finish were initially marked using whole-goal `preview.qualified`. An ordinary clean win could therefore display “Finish without losing a life” as pending, while a Supply win could still ask the player to finish the mission. The owner changed the clean row to use its own predicate's `satisfied` value and the Supply finish row to use `preview.status === 'won'`. The owner also retained the detailed missing-equipment rows after an unqualified v2 verification. The focused regression covers an ordinary win with incomplete equipment conditions. The reviewer confirmed the fix in [mastery-view.mjs](../../../game/ui/mastery-view.mjs) and the unchanged v1 branch.

2. **The separate hangar shortcut bypassed the new mission-reading focus guard.** The input module correctly left native scrolling keys alone inside `[data-game-reading]`, but the document-level hangar listener still handled its key there. Default G could open Hangar while reading; a valid custom mapping of an arrow key to Hangar could prevent scrolling. The owner added `[data-game-reading]` and active contenteditable regions to that listener's excluded targets. The reviewer read-confirmed the final guard in [app.mjs](../../../game/app.mjs). Actual G/End scrolling checks belong to the owner's browser report; the earlier input-module regression alone does not exercise this separate app listener.

No remaining concrete observer, replay-authority, restored-progress, or v1 compatibility defect was identified within this review's scope. The late overlay rule also wins over the earlier landscape minimum height, and the reading region inherits the existing visible focus outline. The controller navigation selector remains unchanged; this adjustment does not implement controller-driven text scrolling.

## Actual core stream sweep

An independent, deterministic Node probe drove the unchanged public `createRun` / `stepRun` API and passed each consecutive tick through `captureMasteryFacts` and the equipment observer. It covered:

- Supply Line and Safe Return, both Immediate and Grid + buffer, all seven registered classes, and run seeds 1–3: **84 attempts**.
- **117,232 actual core ticks**, with no observer rejection of a valid captured stream.
- A maximum of 2,200 ticks per attempt, stopping at a terminal result; direction changes every 37 ticks, varied boost, and probabilistic ability, pickup, and class-switch requests.
- A deterministic unsigned LCG initialized at 893, using multiplier 1,664,525 and increment 1,013,904,223. Direction/boost changes and action/pickup/switch probabilities were generated from this sequence.

The elapsed local Node time was about 9.85 seconds. This is a correctness sweep, not a device performance benchmark or proof that every legal route was explored. The inline probe's completion output is retained in the tool transcript; it was not saved as a standalone test or durable log.

The read review also checked that pending region cells are committed only by a closure in the original event order, failed/redeployed open cuts discard their pending credit, earlier completed Supply actions survive later life loss, and Safe Return uses the pre-impact live cut and actor position before crediting the associated later respawn. Caller-supplied facts remain preview data; only the existing full replay verification path can produce a new local award record.

## Frozen v0.7 evidence

The reviewer independently matched all **23 provenance files** in [mastery-v070.json](../../../game/test/fixtures/mastery-v070.json) against the v0.7.0 source archive, checking each recorded byte count and SHA-256. The archive is tied to source commit `1d4a8d9636428122cca857533dff68c7ee65ac88` and source archive SHA-256 `d22895233c1754dd1a69dd736bf4609252211e89b92c5a86ecf60d04351b9317`.

Those checked files were extracted into a separate temporary directory. Their archived modules, rather than current modules, independently reproduced:

- All **four** golden Steady Signal previews, full verification results, and award records.
- Both golden **restored previews**.

Every comparison was exact. The existing current-source compatibility suites additionally compare restored continuation, resave, summaries, checkpoints, and older core identities. This review did not regenerate any old expectation or modify a frozen release.

## Scoped test evidence

These are **overlapping subsets**, not a whole-project test total. Runs occurred at the stated stages while the owner completed the increment; the final release gate report remains authoritative for the complete frozen candidate.

| Run                                                                                                   | Scope                                                                                                                                                                                                                  | Result         |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Broad independent subset, before the observer's final additions                                       | `mastery.test`, `mastery-equipment.test`, `mastery-equipment-replay.test`, `sessions-equipment-mastery.test`, `mastery-v070-compatibility.test`, `mastery-view.test`, `mastery-replay.test`, `compatibility-v060.test` | 163/163 passed |
| Final observer/view/Steady compatibility subset, after the checklist fix and final observer additions | `mastery-equipment.test` (38), `mastery-view.test` (17), `mastery-v070-compatibility.test` (13)                                                                                                                        | 68/68 passed   |
| Final reading-region input and controller subset                                                      | `ui-input.test`, `controller-router.test`, `controller-navigation.test`                                                                                                                                                | 84/84 passed   |

All test names above are `.mjs` files under [game/test](../../../game/test). Each was invoked with `node --test` and the listed explicit paths. The third count corrects an initial review message that said 68; the retained TAP output reports 84.

Temporary evidence identities at review completion:

| Local artifact                                |  Bytes | SHA-256                                                            |
| --------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `/tmp/round18-independent-mastery-tests.log`  | 39,202 | `dd4126d0d67145643b92a752a745f9ca11fff38db070215e162e991e039489ee` |
| `/tmp/round18-final-view-observer-review.log` | 15,982 | `04cc6e48796a61b31f93dd519e3db655f3376e5a2b6582ce1927c236b2eb87f5` |
| `/tmp/round18-reading-region-review.log`      | 18,770 | `d0b21af27945380bc503e5d8d7909f951907377a65f1d3d1d675d09a0dffdbcc` |
| `/tmp/round18-v070-review-03nfdocx/check.mjs` |  1,282 | `74980220e8bbea34b630f5439af70a50de8eecdabfe47ce41a7429899ded02f5` |

These `/tmp` artifacts are local and may expire. The frozen-module runner printed `{ "oldRuntimeCases": 4, "oldRuntimeRestores": 2, "status": "exact golden matches" }` and exited successfully.

## Limits

This reviewer performed code inspection, Node tests, deterministic core execution, and archived-module comparisons. No physical controller, phone, native wrapper, audio audition, or additional browser session was exercised by this reviewer. The owner's actual viewport and gameplay observations are separate evidence. Passing these checks establishes the reviewed behaviors and representative compatibility cases; it does not establish exhaustive state-space coverage, device certification, or resistance to locally forged imported metadata.
