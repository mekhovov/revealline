# Snake remaster — research and completion refresh, 14 October 2026

## Baseline and scope

Rebased the three pending acceptance commits onto main `595421060` (merged
PR #1193). Git's range comparison reports all three patches unchanged. During
independent work, PR #1194 merged as `f0ccfd37d`. The new input-parity fixes use
a separate branch/PR based on that merged main. Earlier build receipts still
identify their original source commits, not this updated tree.

The 240-mission remaster, 18 comparable playable presentations, six worlds,
four material treatments, bounded enemy decisions, continuous play, shared
controls and authored catalogue review are implemented. The
[requirements matrix](requirements-evidence-matrix.md) contains the individual
evidence boundaries. This refresh closes specific acceptance gaps rather than
reopening a completed catalogue or increasing the number of mechanics.

Physical-device qualification and waiting for player feedback remain deferred
by the user. Neither is silently relabelled as completed. Completion stars and
personal records remain the deliberate policy where higher grades lack evidence.

## Research reviewed and concrete decisions

These are developer accounts and examples, not experiments proving optimal
tuning for Snake. The implementation recommendations below are our inference.

| Reference                                                                                                                                                                           | Relevant example                                                                                                                             | Decision for this delivery                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Railbound — Apple developer interview](https://developer.apple.com/news/?id=0x08hncy)                                                                                              | Afterburn emphasizes simple input and introducing necessary concepts through early play; lengthy onboarding was skipped in its observations. | Preserve direct entry and short event-based cues. Keep required catches visible beside optional courier information. Do not add mandatory explanations or a new tutorial dialog.                |
| [Super Mario Bros. Wonder — Nintendo developer interview](https://www.nintendo.com/en-gb/News/2023/October/Ask-the-Developer-Vol-11-Super-Mario-Bros-Wonder-Chapter-2-2460633.html) | Animation communicates state, and facing must remain readable alongside expression.                                                          | Continue checking accepted heading, preparation and recovery before adding particles. Reduced effects must retain the same state information.                                                   |
| [A Monster's Expedition — its art director](https://www.chickadeegames.com/project_monstersexpedition.html)                                                                         | Clear hierarchy and limited fine detail support approachable artwork on small screens.                                                       | Retain quiet routes and recognizable connected structures. More texture density is not a remaining requirement; the focused audit checks footprints, cache bounds and concealed actors instead. |
| [Invisible, Inc. — Klei developer interview](https://www.gamedeveloper.com/design/road-to-the-igf-klei-entertainment-s-i-invisible-inc-i-)                                          | Klei describes narrowing the game around stealth and making animation-production compromises instead of fully animating everything.          | Keep the drone/cable/interception focus and the shared animation system. Do not introduce another combat subsystem or independent renderer to make the remaining list longer.                   |
| [Celeste — official changelog](https://www.celestegame.com/changelog.html)                                                                                                          | Its refinements include input/menu transition fixes, clearer button prompts and adjustable effects.                                          | Treat input parity as release quality work: all retry entry points must behave consistently, and controller navigation must cancel automatic continuation just as keyboard navigation does.     |

## Priorities and completion conditions

| Priority | Work                                                            | Why it matters / impact if omitted                                                                                                                                                                         | Completion condition                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Rebase and preserve pending work                                | Shared menu/provider fixes in main must be present without dropping any of the pending visual work.                                                                                                        | Rebase succeeds; all three existing patches compare unchanged; prior work is merged; new fixes are pushed in a separate PR.                                                                                             |
| P1       | Unify same-mission retry preparation                            | Automatic, celebration, keyboard and controller retries could re-resolve artwork while the pause Retry preserved it. The same action should not change the accepted environment depending on input method. | One retry path retains accepted appearance while creating a fresh attempt and jammer schedule. Next/Random/mission changes keep their own selection semantics. Regression coverage exercises the affected entry points. |
| P1       | Cancel continuation on controller navigation during celebration | Directional input before the results dialog was ignored by the completed simulation without cancelling auto-next. A player attempting to navigate could still be launched into another mission.            | Directional controller edges on a terminal match cancel progression before input routing; untouched celebrations still continue and deliberate Confirm remains immediate.                                               |
| P1       | Verify latest-main integration and visual invariants            | A clean rebase alone cannot establish that shared selectors, packages or rendering still work.                                                                                                             | Focused host, shared-shell/selector, visual/cache/interference and optional-package checks pass; record actual commands and counts. Fix concrete failures before delivery.                                              |
| P2       | Retain an accurate release report                               | Historical builds and deferred checks must not be mistaken for new validation or silently disappear from status.                                                                                           | Record the current source, tests, research decisions and pending/deferred evidence in the PR and this report.                                                                                                           |

The visual audit found no new actionable correctness defect. All 44 tests in
the world, cache, interference and remaster-art selection pass after the rebase.
They cover all-catalogue cache traversal, the 16 MiB retained-surface ceiling,
live reduced-effects reception, jamming concealment, exact solid footprints and
creator artwork. This is automated evidence, not another 240-board visual study.

## Remaining evidence outside implementation

- **Full archive-inclusive build — completed in the follow-up:** the full default
  distribution now passes on clean main `1a2e87d50`, with 3,277 files, archive CRCs
  and all ZIP/expanded manifest hashes verified. `full-archive-validation.json`
  records the exact source and command. This supersedes the earlier disk block;
  it does not claim deployment or hosted-publication admission.
- **Physical hardware:** deferred. Desktop responsive checks do not establish
  thumb reach, actual controller connection behavior, sustained phone frame
  times or battery/thermal behavior. This is the highest-value next external
  qualification when the user resumes it.
- **Player experience:** optional and deferred. The authored review and solvable
  journals do not establish enjoyment, world recognition or preferred style.
- **Additional silver/gold thresholds:** optional future work. The independent
  pilot assessment did not produce independent strategic evidence; do not
  manufacture new grades from those identical routes. Existing published
  compatible budgets remain unchanged.

## Safe disk preflight

The first rebase failed because the filesystem ran out of space. Removed only
116 npm download-cache blobs (41,531,571 bytes) whose content matched their
SHA-512 addressed filenames. Installed packages, source, working copies, Git
objects and application/profile data were untouched. The rebase then succeeded.
Disk availability fluctuates with other local work; further large builds require
a fresh check rather than relying on this cleanup amount.

## Completed in this follow-up

- All same-mission retry entry points now use `retryMission()`. Accepted artwork
  survives preparation and launch; the new attempt still receives a fresh hazard
  seed. Next, Random and mission/setup changes retain their normal semantics.
- Directional controller edges on a terminal match cancel automatic progression
  during celebration as well as results. Neutral return does not rearm it. Live
  steering and intentional Confirm/Next remain immediate.
- The full Snake host suite passes **106/106**, including eight new regressions
  for artwork/hazard identity, keyboard/controller/automatic/celebration retry,
  D-pad/stick cancellation and live steering.
- Shared shell/selector and offline/optional packages pass **104/104**; visual,
  interference and cache suites pass **44/44**. These selections are separate: a
  combined total is not a claim that the entire repository suite was run.
- Independent source review found no blockers in retry appearance ownership,
  fresh attempt generation, terminal-match guards or cancellation behavior.
- No gameplay recipes, quotas, grading budgets, asset files or simulation rules
  changed. Existing catalogue proof evidence remains applicable to those rules;
  it is not labelled as freshly regenerated.

Reproduction commands for the focused selections:

```sh
node --test game/test/classic-snake-ui.test.mjs
node --test --test-concurrency=2 game/test/classic-snake-worlds.test.mjs game/test/classic-snake-world-cache.test.mjs game/test/classic-snake-signal-rendering.test.mjs game/test/classic-snake-remaster-art.test.mjs
node --test --test-concurrency=2 game/test/mode-play-shell.test.mjs game/test/mission-library-browser.test.mjs game/test/mission-library-compact.test.mjs game/test/mission-library-classic-source.test.mjs game/test/sim-mission-library-projection.test.mjs scripts/test-offline-core-closure.mjs scripts/test-optional-practice.mjs scripts/test-optional-fpv-package.mjs
```

Final validation on implementation commit `4e27c7ca0` also passed English/Ukrainian
localization (13,029 messages, 9,026 references), all four canonical generated
runtime checks, presentation metadata, and game validation. Game validation
accepted 3,095 files and literal references; it retained seven navigation warnings
for deployment-owned app, diagnostics, releases, privacy and credits routes. No
new browser playthrough or distribution build is claimed for these host-only
fixes. [PR #1196](https://github.com/mekhovov/revealline/pull/1196) contains the
implementation and report.

## Merge and packaging closure

PR #1196 is merged into main through `b04487da4`; the preceding PR #1194 is also
merged. The later full archive verification runs on main
`1a2e87d50670f6c4e2c79faf6dd46d9a52479c93`, which contains both complete PRs.
No new Snake runtime changes appeared after the tested host fixes. The changed
optional worker passes its canonical check, and 14 focused offline-core tests
pass. The build, per-entry hash verification and safe generated-output cleanup
are recorded in `full-archive-validation.json`. Earlier “no fresh build” statements
describe the preceding host-fix delivery and are now superseded by this receipt.

All identified implementation and automated packaging work is complete. The
remaining physical-device/player checks are explicitly deferred; new higher-grade
calibration is optional. No new source change or broad test rerun was needed
solely to produce this documentation follow-up.
