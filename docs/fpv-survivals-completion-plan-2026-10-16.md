# FPV Survivals — remaining delivery plan, 16 October

This is the current continuation of the [maps/movement plan](fpv-survivals-maps-movement-plan-2026-10-14.md), not a new game expansion. Preserve six worlds / eighteen layouts, all five operations, early evolutions, shared Studios/audio/input/offline, and historical content identities. No additional home tiles, permanent stat grind or blanket difficulty increase.

## Baseline and completed work

Runtime `cf16eea20`, evidence head `c8f4831a5`. PR1533 (experimental local spacing performance) and PR1534 (late-choice pacing) are open with passing checks at this review. Fetched main `2169552a0` contains no additional changes in Overflight runtime/tests relative to the published stack; queued parents are not assumed merged. Work continues in a child branch, preserving every pushed commit.

- Native Echo wins at 404.1667 seconds; every statistic and upgrade tick matches the simulated run. Ten choices, two airframes lost. Three soundtrack/Classic/Reactions clips are ready.
- Six paired pacing configurations: active completions 3/6 → 4/6, twelve earned no-input defeats. Two one-airframe Systems losses remain recorded. They use a generic salvage-seeking route, so they are not sufficient evidence that the intended priority-target technique is broken.
- Experimental local spacing has three native reference passes, one stress pass, graphics recovery and 154 regression checks. New movement remains explicitly experimental.
- Marathon already has five contracts, bank/continue, an eight-rank cap, equal-rank replacements, useful field rewards, fresh terrain and separate records. Medals remain provisional.

## Research refinements

| Primary reference | Finding | Decision for this batch |
| --- | --- | --- |
| [Nova Drift: dynamic waves](https://blog.novadrift.io/nova-drift-dev-deep-dive-dynamic-waves/) | Formations, staggered actions and curated encounters combine with bounded variation; paired waves reduce quantity. | Retain the existing authored combinations and threat budgets. Verify positioning and route decisions before increasing enemy speed or numbers. |
| [Nova Drift: design retrospective](https://blog.novadrift.io/nova-drift-manifesto/) | A large upgrade catalog still converged when enemies had too few roles; player visibility and coordinated threats needed priority. | Do not add upgrades to compensate for a generic test route. Separate actual weapon weakness from route/profile difficulty. |
| [Army of Ruin: update 15](https://www.milkstonestudios.com/2023/02/army-of-ruin-early-access-update-15/) | Its balance pass considered weak, dominant and unpopular options separately and used modest changes. | Retain failed runs; compare one variable at a time. Its reported completion rate is not a target transferable to our bots or players. |
| [Army of Ruin: update 14](https://www.milkstonestudios.com/2023/02/army-of-ruin-early-access-update-14/) | Larger catalogs needed choice controls and useful decisions after equipment caps; crowded multi-hit effects needed optimization. | Qualify existing bounded refits and exact-query performance before adding another progression layer. Do not copy uncapped stat growth. |
| [Vampire Survivors: Adventures FAQ](https://poncle.games/adventures-faq) | Remixing existing environments, equipment and winning conditions creates distinct self-contained challenges. | Use the existing operation/layout/contract variety and describe the actual rules accurately. No additional mode is required. |
| [Crimsonland: official overview](https://www.crimsonland.com/) | Weapons and perks support concentrated top-down combat. | Keep immediate attacks, compact silhouettes and satisfying clears. The overview provides no evidence for a particular enemy AI or numerical balance formula. |

These are design adaptations, not proof of enjoyment, ordinary-player balance or our implementation's performance.

## Ordered remaining work and finite gates

| Priority | Item | Why / player benefit | If omitted | Completion gate |
| --- | --- | --- | --- | --- |
| P0 | Truthful Marathon contract previews | Players can choose bank/continue based on the actual upcoming layout and pressure. V4 preserves authored terrain/escort offsets, while old preview copy promises reflections and shifted escorts. | Misleading previews turn planning into guesswork. | Version-aware EN/UK copy matches real V4 transformations; legacy V3 descriptions remain correct; targeted variant tests and native preview review. No combat change. |
| P1 | Systems technique/profile comparison | Distinguish a one-airframe challenge loss from a broadly weak upgrade direction. | Blind buffs could restore stationary wins or erase build tradeoffs. | Repeat both recorded layouts with an existing alternate route and separately labeled default three-airframe controls; retain every outcome, damage cause and draft. Add a diagnostic route only if the existing policies cannot exercise the intended technique. |
| P1 | Experimental movement lifecycle | Complete the bounded native ten-retry / fifteen-minute soak checks after the local-grid optimization. | Performance may look good in short runs but preparation/recovery leaks remain unknown. | Ten native same-seed retries retain appearance/project/population/atlas ownership; fresh 30-second warm-up + 900-second measured soak retains all stalls and reports frame gates/resource high-water marks. No video or heavy headless load during timing. A failure is evidence to fix, not a sample to discard. |
| P1 | Marathon retain/refit comparison | Show that later choices actually trade one capability for another while preserving eight invested ranks. | Formal legality alone can hide repetitive or useless choices. | Compare retained and explicit equal-rank replacement branches from the same earned contract checkpoint; report removed/gained ranks, damage, route and outcome. No granted equipment or repair. |
| P1 | Consolidated native review package | Make existing maps, three build techniques, warning layers, reduced effects and sounds easy to assess together. | Correct systems remain difficult to review and aesthetic claims remain vague. | Link attributable native scenes, terminal receipts, normal/reduced comparisons and Classic/Reactions/boss clips. Listening quality and enjoyment stay review judgments, not waveform assertions. |
| P1 | Publish source/evidence and reconcile latest main | Preserve all work and give reviewers concrete completed/open boundaries. | Changes stay local or old evidence is mistaken for current qualification. | Focused changed-flow/integration checks, clean worktree, pushed child PR and updated completion report; review the exact main delta without rewriting queued work. |

## Boundaries that do not require speculative new implementation

- Time Attack medals remain explicitly provisional; human calibration was waived. Automated reachability cannot close that judgment.
- The isolated imported-library observation remains monitored with its existing receipts. Escalate only if reproducible loss returns; no speculative storage migration.
- Broad whole-game presentation adapters are delivered. Further mode-specific redesign is deferred, not silently added to this batch.
- Iris Xe Windows, M1 Safari, physical controller/phone and five-player tests remain **skipped at the user's direction, not passed**.
- A finite local implementation/check gate may finish while visual appeal, audible-mix acceptance and ordinary-player enjoyment remain ready for review. Do not label those judgments passed without evidence.

## Delivery checkpoint after execution

- **Implemented:** version-aware Marathon previews, followed by a native-discovered
  full-width result-panel correction at `3a6631bd9`; numeric stats unchanged.
- **Measured:** both exact-map default Systems controls win, both alternate-route
  one-airframe controls lose; all ten upgrades earned. No numerical buff added.
- **Qualified locally:** ten native short restart entries and a fresh15-minute
  local-spacing soak at `79354e383` pass their explicit available-Mac gates;
  p95=11.1ms, p99=13.4ms, no dropped time. Experimental movement stays opt-in.
- **Compared:** two branches from one naturally earned capped Marathon checkpoint
  both finish five contracts at eight ranks; the offered refit trades more score
  for more time/damage. No seed search or equipment/healing grants.
- **Checked:**60/60 integration checks before layout correction;61/61 afterward.
- **Review-ready:** linked native maps, builds, reduced effects and soundtrack /
  Classic/Reactions/boss samples retain source attribution. Subjective acceptance
  and provisional medals remain explicitly unmeasured.

Native panel screenshots and desktop/narrow wrapping checks are complete; native
before/after full summaries match exactly. Publication and pushed-head reconciliation
are recorded in the linked evidence report rather than assumed from this checklist.
No additional exhaustive matrix, new mode or unavailable-device gate is introduced.

Source and completed local evidence are pushed in [PR1549](https://github.com/mekhovov/revealline/pull/1549), stacked on PR1534. All locally executable gates above are complete within their recorded scope; native visual/audio/gameplay acceptance and provisional medal calibration remain for review, with external trials skipped. PR checks/merge remain separate delivery states.
