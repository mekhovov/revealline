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

## Continuation and rebase checks

The continuation was rebased onto `ee015163de1131313436b0550892f3739e3c7a1a`
(main, package version 0.132.4). Its four commits preserve the new default-release gates.
The only textual conflict was the focused-test routing test; both upstream checks and the
company checks were retained. A final clean rebase includes `55f83c2221c382ac5626e37a079e488eed79b920`: three additional changes to default release admission/retention, with no company runtime changes. Subsequent integration changes are recorded in the next
candidate run, rather than attributed to the older frozen candidate above.

Before this rebase, 132 focused company, packaging, review-observer and routing tests passed.
After it, restoring the exact committed review-tool files omitted by the sparse checkout
resolved one local module-not-found failure; that was a checkout omission, not a source fix.
The review-observer and updated routing selection then passed 20 tests. After the Home-cancellation
fix, the combined company, packaging, observer and routing selection passed **136 tests**; the
existing persistence compatibility suite separately passed **39 tests**. The broader historical
comparisons below remain bound to their stated earlier revisions.

## Bounded browser observations

On 26 September 2026, the local Codex in-app browser exercised the preview through visible
controls. These are engineering observations, not human learning or installed-PWA evidence:

- A 320 × 800 game viewport kept home and paused mission controls within the viewport; the
  mission overlay follows the canvas in normal flow at narrow widths.
- Keyboard Settings, reduced motion and Escape returned focus to the invoking control and
  left the mission paused. Static palette contrast is recorded separately in the accessibility review.
- An intentionally missing flower asset produced a visible startup failure with Start disabled.
  A healthy tab of the same edition could then obtain the writer lease. A second healthy tab
  showed the session-only warning instead of becoming another writer.
- Seven consecutive source-hub edition switches covered Coupa, DroneAid and the foundations
  audience. Each reached its matching title and mission count without a stale writer warning.
  Approximate shared heap varied from 35.7 to 91.9 MB in those observations; this is not a
  per-edition allocation measurement or a memory-leak conclusion.
- The alternate foundations task accepted six reusable cases by 4 November after both records
  were inspected. Reset returned a blank attempt. This checks mechanics, not a participant's understanding.

An exploratory same-device comparison used the retained frozen `0cc709c50` Coupa ZIP and
an intermediate compiled recovery candidate, both served without HTTP caching at 1280 × 800,
DPR 2. First Connection ran idle on safe ground for 20 seconds. Both observations contained
2,400 animation-callback intervals, median 8.3 ms, p95 9.1 ms, maximum 9.4 ms and none over
33 ms. Menu readiness was 1,360 ms / 1,319 ms; mission preparation was 147 ms / 143 ms.
This single intermediate comparison does not qualify the final rebased artifact or establish
a performance improvement. The displayed counts were buffered Resource Timing entries, not
complete network requests; the tool labels that limitation and never returns qualified=true.
A subsequent compiled runtime on the rebased main also completed 2,400 intervals in 20 seconds:
median 8.3 ms, p95 10.0 ms, maximum 10.4 ms, none over 33 ms; menu readiness 1,462 ms and
mission preparation 142 ms. These are single local samples, not a timing guarantee.
The observer's load, failure, hidden-page, reload, sample bounds and timing calculations have
separate deterministic tests. A final artifact/device performance review remains pending.

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

The new main fastline publisher also admits additive edition assets only after downloading
and checking their complete reviewed envelope, original bytes, ZIP members and exact commit/tree.
Unknown, incomplete or unreviewed extras are rejected; default-only releases retain the same
nine-asset contract. Home navigation cancels staged missions so a late asset response cannot
return a player to a mission they left.

The review measurement tool is now selected by the focused test map even though its files
live under `docs/verification/`; Journey profile changes also select company persistence
coverage. Candidate CI runs its model tests. These checks validate measurement calculations
and safe target selection, not the measurements or their approval.
