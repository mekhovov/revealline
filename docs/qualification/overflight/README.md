# Overflight candidate qualification

Recorded 5 October 2026 against implementation base main
`2d447bc790bdf3951251c99041c8a918363ece0a`. This is working-tree candidate
qualification. No target-device, human-play or release gate is accepted by these automated receipts.
Current upgrade visuals and balance evidence is in the
[upgrade follow-up](upgrades-20261005/README.md). Older browser and distribution
receipts identify their own earlier source and do not qualify the changed balance.

[Automated routes](automated-routes.json) retain six complete front-set runs with
five-second samples: three build directions × one/three airframes, seed 17031991. [Encounter sets](encounter-sets.json) retain nine compact three-airframe
runs across Breakthrough, Crosswinds and Convergence at that seed.
[Additional seeds](additional-seeds.json) retain 18 compact three-airframe runs
across all three sets for seeds 42 and 20261005. The default-front three-airframe
rows occur in both overview and set receipts: 33 records describe 30 unique
sorties. Each receipt records the project
identity, canonical project SHA-256, source-file hashes, implementation-base and Git HEAD SHA,
UTC timestamps, Node environment and explicit scope limits. They use the same
[review pilot](../../../game/overflight/review-pilot.mjs), ordinary movement/boost
inputs, and legal earned upgrades/rerolls. No fixture, HP, damage or XP injection
is used in route qualification.

| Encounter set, default seed | Fan: win time / frames left | Echo: win time / frames left | Systems: win time / frames left | Peak-visible range |
| --------------------------- | --------------------------- | ---------------------------- | ------------------------------- | ------------------ |
| Breakthrough (`front`)      | 339.08s / 2                 | 342.82s / 3                  | 353.18s / 2                     | 459–634            |
| Crosswinds (`crossing`)     | 333.37s / 3                 | 342.37s / 3                  | 330.57s / 3                     | 571–778            |
| Convergence (`mixed`)       | 340.13s / 3                 | 344.77s / 3                  | 337.70s / 1                     | 469–561            |

All 27 unique three-airframe routes won. With one airframe on default-seed
Breakthrough, Fan lost at 303.68s, Echo won at 342.82s, and Systems lost at 320.25s.
First drafts across the full matrix occurred at 14.02–22.50s. Default-seed
specializations evolved at 70.80–94.17s across the three sets. Across all seeds,
evolution varied from 52.13s to 114.13s: this wider spread remains a balance review
item against the approximate 90s target, especially Crosswinds seed 20261005.
Crowd peaks across all three-airframe runs ranged from 459 to 1,048 visible actors.
These are observations of one deterministic
pilot, not promises about human difficulty, exact upgrade timing, or a universal
minimum crowd size. The primary remains unevolved in the stacked-systems route.
Regular spawning ends at 360s; final-tank defeat ends a run immediately, so a win
can precede 360s and a surviving final tank can extend play beyond it.

## Phase matrix

| Phase                                                    | Evidence here                                                                                                                                                                                                                                                                                      | Remaining acceptance gaps                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A0 — Native foundation and content contract              | Native mode and versioned project/compiler exist; route receipts bind the compiled project and simulation source.                                                                                                                                                                                  | Complete current-source native/content review is broader than these route checks.                                                                                                                                                                                                                                   |
| A1 — Dense engine proof                                  | Exact 1500/700 and 2500/1200 alive/visible fixtures; all actors move; exact area damage; two priority-attack cap. Both fixtures preserve at least 45/60 occupied screen regions through 901 simulated seconds, with bounded region density and distinct positions.                                 | Iris Xe target-hardware gate remains open. The [preliminary M4 Pro browser record](browser-reference-preliminary.json) used three consecutive 120s windows, not fresh independent trials, and predates the final fixture/source. Its internal acceptance flag does not qualify the current source or target device. |
| A2 — Flight and upgrade proof                            | Legal slots/drafts/evolutions, fixed-step movement, paused selections and branch/system effects have focused tests. Automated routes use genuinely earned builds.                                                                                                                                  | Native card and mid-sortie captures are retained in [browser review](browser-review.md). Two exported contrasting real-time build clips and human control/readability assessment remain open.                                                                                                                       |
| A3 — Complete six-minute A sortie                        | All three encounter sets complete with three build directions and three seeds using three airframes; default-front single-airframe successes/failures retained. Burst/rest, optional rewards, rally and non-stacking support roles have focused checks. No timeout victory or damage/XP shortcuts. | Complete human runs, role-cue readability and seed-dependent evolution timing need review. Automated routes do not establish human difficulty or enjoyment.                                                                                                                                                         |
| A4 — Creator and reusable-content delivery               | Versioned local project/package and shared-content implementation exists.                                                                                                                                                                                                                          | Local browser author → preview → export → fresh-origin import → native play is recorded in [browser review](browser-review.md). Global Community admission and browser demonstration of another mode reusing the new content remain open.                                                                           |
| A5 — Performance, usability and release-candidate review | Full local distribution build; source-bound automated checks, two native automated completions, ten UI retries, real graphics recovery and a paged export check.                                                                                                                                   | Offline browser installation/play, physical gamepad, five human reviewers, target hardware, clean current-source performance/heap/soak trials and full release-candidate review remain open. Functional current-source context/retry checks passed.                                                                 |
| C1 — Riy follow-on prototype                             | No C acceptance claim.                                                                                                                                                                                                                                                                             | Begin after A acceptance; swarm prototype and its qualification remain future work.                                                                                                                                                                                                                                 |

## Focused checks and fixture limits

[Focused checks](focused-checks.json) record 42 passing tests: 30 core and 12
renderer tests. Renderer tests use a finite Phaser/DOM adapter. The paired
reduced-effects check calls the actual `createOverflightRenderer().present(run)`
API on two real core simulations for 600 ticks. Cosmetics differ; visible actors,
danger warnings, complete simulation state and run summaries remain equal. This
is meaningful API-boundary evidence, not actual GPU or browser acceptance.

The long fixture tests preserve population, movement, all-target damage and
spatial distribution through more than fifteen simulated minutes. Only fixtures
recycle enemy hull, reposition defeated actors on the next movement pass, wrap
partition bounds, cap actor lifetime at 24s and keep the player immune/stationary.
These mechanisms are explicitly labelled in `fixtureWorkload`; ordinary sorties
never use them. A fixture is neither a legitimate win nor population-pacing proof.
Both fixtures exercise ordinary family behaviors, six support specialists and
two brace troopers that can commit aimed attacks, within the eight-specialist cap.

Sprinters telegraph for one second, burst straight for half a second and return
to pursuit for 2.5s; their unobstructed four-second average travel is unchanged.
Couriers give three salvage and refuge seekers two. Relay wardens briefly bias
nearby ordinary pursuit toward a flank after a one-second cue; radar trucks give
a non-stacking 8% movement bonus within 140 units. Source death removes support.
Relay and radar do not create aimed attacks. Steering checks at most eight
sources at the existing 10Hz decision cadence; movement and damage remain 60Hz.

## Full distribution build

The earlier candidate’s [source-bound build receipt](full-distribution-build.json) records a successful
complete local distribution build on `cbd9d23d1a2eff81e7059013024974e2d6e1ca41`:
3,092 manifest files, 1,003,106,207 payload bytes excluding the manifest, and a
1,004,092,578-byte ZIP. Independent verification checked 38 emitted files against
the manifest, including both Overflight entrypoints, Motion Lab integration and
all thirteen shared library PNGs, and verified the final ZIP checksum.
The built site is `.cache/overflight/full-distribution`. It predates the upgrade
visuals/balance follow-up and must be rebuilt before qualifying that follow-up for release.

This passes local build preparation and output verification. Offline browser
installation, service-worker behavior and actual offline play remain unverified.
It is not a hosted publication, native installer qualification or release promotion.

## Reproduce

Run from the repository root with the repository-supported Node version:

```sh
node --test game/test/overflight-core.test.mjs game/test/overflight-renderer.test.mjs
node scripts/qualify-overflight.mjs --verify-evidence
node scripts/qualify-overflight.mjs --replay-evidence
node scripts/game-cli.mjs build --out .cache/overflight/full-distribution --revision cbd9d23d1a2eff81e7059013024974e2d6e1ca41
```

The build command records the candidate revision; use it only with that revision's
build inputs. A changed candidate needs its own source-revision label.

`--verify-evidence` checks all three route receipts against current source hashes,
project identities and result hashes. `--replay-evidence` additionally reruns all
33 recorded ordinary sorties and requires identical deterministic result hashes.
Timestamps and observed Node wall times naturally vary; only the wall-time field
is omitted from deterministic result hashes. No Node timing is presented as FPS.

After an intentional source change, regenerate the three route receipts explicitly:

```sh
node scripts/qualify-overflight.mjs --write-evidence
```

For an individual exploratory batch without overwriting retained evidence:

```sh
node scripts/qualify-overflight.mjs --seed=17031991 --route=tight
node scripts/qualify-overflight.mjs --seed=17031991 --encounter-set=crossing
```

The native review pilot must be entered explicitly as a review/demo mode. It is
not an ordinary game-start action. Browser trials should run without concurrent
Node soak/replay jobs, and must record their own current-source/device evidence.

The final integration cohort passed [128/128 checks](final-tests.tap), with [6/6 CI-registration checks](industrial-tests.tap). ESLint, formatting and the generated-asset consistency check passed. Node durations are test execution costs, not rendered FPS.

The exact [Creator CI cohort](creator-tests.tap) passed **208/208** on `cbd9d23d1`
after extending the Motion Lab canvas test adapter with real-sized pixel buffers
and an exact pixel/reduced-effects/lifecycle regression. Production behavior was
unchanged by that correction. The focused, integration and Creator cohorts overlap;
their counts are reported separately and must not be added into a single total.
