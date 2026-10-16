# Industrial Workshop verification — 2026-10-02

These are local software and browser checks of the working implementation. They
do not publish a theme, qualify a production release, or substitute for human
art/readability review and physical-device acceptance.

| Check                                                       | Result                                                                                | Evidence                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| Full practice command                                       | 206 passed, zero failed/skipped                                                       | [TAP](practice-tests.tap)                |
| Explicit World/appearance/visual suites                     | 55 passed, zero failed/skipped                                                        | [TAP](world-tests.tap)                   |
| Resolver, Canvas, arcade and candidate host checks          | 53 passed                                                                             | [TAP](contracts-canvas-tests.tap)        |
| Actual theme host/controller fixtures                       | 23 passed                                                                             | [TAP](theme-host-controller-tests.tap)   |
| Runtime v2, old containers, workspace and candidate handoff | 18 passed                                                                             | [TAP](studio-cross-domain-tests.tap)     |
| Project ESLint                                              | Passed                                                                                | [Log](lint.log)                          |
| Project validation, localization and presentation metadata  | Passed; existing navigation warnings recorded                                         | [Log](validate.log)                      |
| Shared embedded fonts/CSS                                   | Byte-identical to sources                                                             | [Receipt](embedded-source-assets.json)   |
| Optional runtime and source budgets                         | Academy 62/64 files; World 93/95 files, below unchanged byte caps                     | [Receipt](package-bounds.json)           |
| Studio edit → save → reload → export → current arcade → SIM | Same workspace revision and edited token; zero browser errors; preferences unchanged  | [Log](studio-complete-browser.log)       |
| World appearance fallback and focus                         | Exact missing revision fallback retained through playback; focused selector preserved | [Log](sim-recording-revision.log)        |
| World thumbnail/editor appearance                           | Previews follow choice while active flight and creator data remain unchanged          | [Log](sim-world-preview.log)             |
| Repeated GPU resource ownership and frame cadence           | Stable baselines; local p95 16.7–16.8 ms for both collections                         | [Report](sim-lifecycle-and-cadence.json) |

Test groups overlap; their counts should not be added as a unique test total.
Package receipts use synthetic source bindings only to exercise archive closure;
no release candidate or publication is created. Source and runtime files are
counted separately. Academy's byte cap is 8 MiB; World's is 16 MiB.

The final `npm run build` passes with 2,733 files. The calibration navigation
entry and complete import graph are included and covered by the
[build-graph test](preview-build-graph.tap). All 36 changed modules distributed by
the build match the working source bytes. The mandatory cache contains no
`optional-practice/` assets and remains below 64 MiB; see the
[packaged-output receipt](packaged-output.json) and [build log](build.log).

The full Studio journey was repeated against the served `dist` output, including
the navigation to the SIM renderer: [packaged browser log](packaged-studio-browser.log)
and [screenshot](packaged-studio-to-sim.png). Edited tokens and workspace revision
survived save/reload/export and reached the candidate renderer with zero browser
errors. The build is a local working-tree artifact, not a published release.

The Studio [evidence manifest](studio-arcade-evidence.json) records exact code input
hashes, the earlier 90-test focused run, final runtime changes and browser journeys.
The [SIM source kit](../../../authoring/fpv-worlds/industrial-workshop.md) describes
the measurements, semantic bindings, normal-map specimen and imported GLB tests.

## Known broader baseline

An exploratory presentation run during integration reported 695 passes and 24
failures out of 719. It is not represented as a passing final regression suite.
Menu/controller fixture assumptions discovered in that run were corrected and
their final host tests pass. The industrial adapter and candidate painter suites
also pass independently in the final focused run.

Seven remaining host assertions were reproduced against unmodified HEAD source:
five bootstrap/retry cases, the defeat/controller ready-versus-lost assertion,
and the 600-pixel missing-width handoff assertion. Their logs are
[retry/defeat](head-baseline-retry-tests.tap) and
[size](head-baseline-size-tests.tap).

Production history/source-closure tests also have existing compiled-release-104
mismatches. All six compiled recipe source closures differed from HEAD before
this implementation. Their comparison is retained in the Studio evidence
manifest. The immutable compiled output and production ledger were not refreshed
to fold unrelated changes into this work or to claim release admission.

The final performance samples use Chrome on one Apple M4 Pro at a 60 Hz cadence.
They establish local stability, not GPU headroom on other hardware. Physical
controller/touch checks, broad accessibility/localization review, all-distance
flight readability, temporal shimmer and human artwork acceptance remain release
qualification work.

## Visual evidence

- [Game interface](game-interface.png)
- [Component specimen](studio-specimen.png)
- [Selected workspace arcade comparison](studio-candidate-arcade.png)
- [Selected workspace in the SIM renderer](studio-to-sim.png)
- [Final quiet nine-slice calibration surfaces](calibration-quiet-surface.png),
  with the [repeated complete Studio journey](calibration-quiet-surface.log)
- [SIM course thumbnails](sim-course-thumbnails.png)
- [SIM Creator viewport](sim-creator-preview.png)
- [Missing-revision fallback](sim-missing-revision.png)
- [Material/normal-map calibration](sim-calibration.png)
