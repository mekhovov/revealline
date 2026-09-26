# Company edition qualification record

This record distinguishes candidate automation from release qualification. No company
edition has been promoted or published by this work. Human observations, physical-device
installation and downloaded/deployed release evidence cannot be inferred from unit tests.

## Frozen candidate automation

The [candidate workflow run 36222367358](https://github.com/mekhovov/revealline/actions/runs/36222367358)
completed successfully for commit `3118d40aa37e84500c41bf8ce8d6abbb0260f4e1`
and source tree `e0d7a32c46f0ec9bc1e64199a3c40c28b02ab7fd`, based on
`f913c64027615632610de673b87926a841f016b9`.

- All 53 generated company source files matched the generator.
- Public-source eligibility inspected 18,986 files and 17 approved media assets.
- The company suite passed 87 tests; the separate persistence compatibility suite passed 39.
- All seven selected editions compiled twice with byte-identical artifacts. Admission
  independently checked the runtime and selected-source ZIP members against their inventories.
- Actions stored artifact `company-candidate-3118d40aa37e84500c41bf8ce8d6abbb0260f4e1`
  (artifact ID `10899636420`, 89,702,979 bytes). Its configured retention is 14 days.
  The workflow receipt explicitly says `publicEligible: false`.

These results apply to that frozen commit. Subsequent storage, offline, accessibility,
learning and review-tool changes require their own committed candidate run. The existing
default release pipeline and its qualification requirements remain in force.

## Historical compatibility investigation

The historical suite is **not qualified by the local broad run**. The initial sparse
checkout run reported 1,446 tests: 1,321 passed and 125 failed. Missing tracked fixtures
accounted for 118 failures; seven assertion failures were investigated separately. A later
focused compatibility selection completed with 145 passing tests.

After bounded fixture restoration, a new 177-file run terminated with exit code 7 before
the TAP completion summary. Its log contains 960 passing and 33 failing observations.
Those are partial observations, not a completed test count or success rate. Three observed
file failures involved sparse fixture/module omissions. The other 30 were Team and Journey
assertions. Disk exhaustion occurred during adjacent fixture restoration, but the runner
did not provide enough evidence to attribute its exit code conclusively to that condition.

Baseline comparisons use exact Git source and changed-data overlays for baseline
`f913c64027615632610de673b87926a841f016b9` and frozen candidate `3118d40aa`.
They override module loading and file reads for changed source/data while sharing unchanged
tracked fixtures. This is a controlled comparison, not an independent full checkout.
Local comparisons use Node 20.19.5; the successful candidate workflow uses Node 22.13.1.

The original seven assertions reproduce identically on both frozen revisions:

| Test file                                      | Failing checks | Comparison                                                                    |
| ---------------------------------------------- | -------------: | ----------------------------------------------------------------------------- |
| `mission-library-remote-installed.test.mjs`    |              2 | Installed Classic counts: 285 versus 201; 288 versus 204                      |
| `presentation-renderer.test.mjs`               |              1 | Compiled enemy body still reports the bouncer fallback                        |
| `profile-recovery-settings-host.test.mjs`      |              3 | Unfinished-flight recovery: ordinary, quota-failure and occupied-writer cases |
| `profile-recovery-startup-navigation.test.mjs` |              1 | Controller Back cancellation read count: 1 versus 0                           |

Each frozen revision enumerated 48 checks in that selection, with seven failures and
41 intentionally skipped checks. These failures predate the company implementation;
they have not been repaired or waived by this work.

The additional targeted comparison runs each cohort against the same baseline and the
working tree, with a 90-second process-group limit and no further fixture hydration:

| Test file                                         | Failing checks | Comparison                                                                                                    |
| ------------------------------------------------- | -------------: | ------------------------------------------------------------------------------------------------------------- |
| `actor-appearance-team-host.test.mjs`             |              1 | Same-ID imported Team actor ownership fails on both                                                           |
| `content-team-host.test.mjs`                      |              4 | Terrain import and gentle/standard/expert foundation imports fail on both                                     |
| `content-team-recovery-host.test.mjs`             |              8 | Retry, authority-loss and painter-failure reserve assertions fail on both                                     |
| `journey-menu-return-host.test.mjs`               |             10 | Three title variants with button/cancel/controller and paused-home return labels fail on both                 |
| `journey-reactions-host.test.mjs`                 |              1 | Released Sentinel host action times out on both                                                               |
| `journey-capture-stop-differential-host.test.mjs` |              6 | Pressure Lines immediate/grid-center with keyboard/touch/controller stopped-attempt persistence fails on both |

All 30 additional failure names and assertion details match between baseline and the
working tree. The four bounded cohorts each completed without their outer timeout: 65
enumerated checks per revision, comprising 30 failures and 35 intentional skips. No
company-induced regression was identified in this comparison. It does not turn those
historical assertions into passing checks.

The working-tree comparison specifically includes the new optional Journey write guard;
the baseline overlay substitutes its original implementation. A matching pre-existing
failure is not a passing test, and this comparison does not qualify unrelated historical
behaviour.

The working Journey profile-edition, picture-receipt and company-storage tests separately
completed with 19 passing checks and no failures. Focused-map routing and review measurement
model tests completed with 12 passing checks. These are bounded compatibility checks, not a
replacement for the unfinished historical suite.

Local diagnostic logs remain in ignored `.cache/company-validation/`; they are not release
artifacts. Relevant records are `rebased-broad.tap`, `{base-f913,candidate-3118}-seven.tap`,
and `{base-f913,working}-{team,journey-menu-reaction,pressure-immediate,pressure-grid}-bounded.tap`.
The bounded restoration inventory records 27 original PNG fixtures (73,155,932 bytes), plus
nine source modules (88,003 bytes). They were restored from existing Git objects; no fixture
content was edited and no further broad hydration was performed.

## Release-plan status

Phase 4 candidate admission is implemented and demonstrated for the frozen commit above:
deterministic archives, selected-source eligibility, exact member verification, dependency
closure and candidate-only CI storage. Newly changed runtime bytes still need a fresh freeze.

Phase 7 promotion remains pending. The reviewed selector is empty. Public promotion requires
hash-bound evidence for content and asset approval, human comprehension and pacing,
accessibility, two actual installed PWAs, update/rollback, storage and backup recovery,
same-device performance, and downloaded/deployed artifact bytes. Browser cache reloads and
simulated worker tests provide useful bounded evidence but do not establish OS installation,
physical-device behaviour, quota exhaustion or human learning outcomes.

The review measurement tool is now selected by the focused test map even though its files
live under `docs/verification/`; Journey profile changes also select company persistence
coverage. Candidate CI runs its model tests. These checks validate measurement calculations
and safe target selection, not the measurements or their approval.
