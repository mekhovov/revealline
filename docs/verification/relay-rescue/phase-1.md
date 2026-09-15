# Relay Rescue — Phase 1 evidence

Date: 2026-09-15. Target milestone: `0.44.3`. Starting source revision: `912a0f7` (`0.44.2`). Runtime: Node `v20.19.5`. Work was isolated in `.cache/relay-rescue-worktree`.

## Change and review

The durable [phased design](../../relay-rescue-plan.md) records the approved shared-world mechanics, exact capture/rescue ordering, six version milestones and both human playtest gates. The final review removed earlier brainstorm rules: no occupied relay pads, no exit requirement, no allied fill seeds, no early emitter defeat and no loss while a surviving player can still perform a free rescue. Phase 3 must pass the first real test with the user's pair before campaign expansion.

The couch test harness previously extracted body contents using `html.split('<body>')[1]`. Valid body attributes caused an incidental `TypeError` before the real input and navigation code could be tested. `mountCouch` now recognizes a complete body element with attributes, quoted `>` characters and case variation. A missing/incomplete body produces a specific assertion without partially mounting controls. This is a change to the existing minimal test DOM boundary, not a replacement browser parser or game behavior change.

## Checks

| Check                                                                                                                                                          | Result                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| New parser regressions against the old helper: `node --test game/test/couch-markup.test.mjs`                                                                   | Expected red: 1 passed, 3 failed. The bare body mounted; attributed/case variants and the controlled missing-body expectation exposed the defect. |
| Same parser regressions after the fix                                                                                                                          | Passed: 4 tests, 0 failures. A subsequent run after formatting also passed all 4.                                                                 |
| `../../node_modules/.bin/eslint game/test/helpers/couch-host.mjs game/test/couch-markup.test.mjs --max-warnings 0`                                             | Passed, exit 0.                                                                                                                                   |
| `git diff --check -- game/test/helpers/couch-host.mjs game/test/couch-markup.test.mjs docs/relay-rescue-plan.md`                                               | Passed, exit 0.                                                                                                                                   |
| After-fix parser/input/encounter subset: `node --test game/test/couch-markup.test.mjs game/test/couch-input.test.mjs game/test/multiplayer-encounter.test.mjs` | Passed: 37 tests, 0 failures, exit 0 (15.62 seconds).                                                                                             |
| Existing couch/multiplayer baseline below, started before the helper repair                                                                                    | In progress when this record was written: 37 reported passes and no reported failures. This is not a complete-suite pass.                         |

Baseline command:

```sh
node --test game/test/couch-input.test.mjs game/test/couch-shell.test.mjs game/test/couch-navigation.test.mjs game/test/multiplayer-encounter.test.mjs
```

The baseline includes real navigation, controller state, encounter routes and rematches; individual host cases took tens of seconds and one took 102.8 seconds. Keep the final process result, including any later failures, before closing the baseline gate. No completion-time estimate is inferred from the partial output.

The parent task owns the version metadata, phase commit and checks of the actual frozen commit. Its Phase 1 artifact must contain only the related documentation, harness/regression changes and version updates; concurrently developed shared-arena host/core changes belong to Phase 2. Frozen browser/build and version-file synchronization results are not claimed by this subtask.

## Limits

These checks validate markup extraction and existing program behavior. No two-human playtest, physical-controller qualification or claim that the new mode is fun has been established in Phase 1. Later phase gates remain pending until their recorded checks and actual paired playtests are completed.
