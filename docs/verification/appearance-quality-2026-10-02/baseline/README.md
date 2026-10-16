# Appearance quality: regression baseline

This audit classifies **every failure record retained from the interrupted exploratory run**. It does not claim that the complete repository suite has passed, or that tests after the interruption were exercised.

## Result

| Disposition | Retained failure records | Meaning |
| --- | ---: | --- |
| Repaired in this quality pass | 30 | Seven stale harness/contract groups, one bounded production route fix, and the paused presentation preference assertion now pass. |
| Repaired before this audit | 23 | Existing appearance integration repairs pass when rerun: boot, independent workspace storage, community startup, teardown and replacement theme-control focus. |
| Reproduced before appearance; unresolved | 63 | Each original failure also reproduces against pre-appearance HEAD. These remain explicit open items; they are not suppressed or claimed fixed. |
| Unclassified retained records | 0 | The detailed inventory records the evidence for every disposition. |

There are **116 records**, including two nested subtest records and their parent failure; this is not a count of 116 separate defects. The original run stopped around top-level test 4652. Its 28 implicated files were reproduced against current sources and HEAD `f4545d68a9be0ada4b7a8ad1327c9c02e25214a1` with Node `v20.19.5` and the same installed dependencies.

The eight repaired suites pass **122 tests**, zero failures/skips. The separately selected paused menu/display preference case passes (18 unrelated cases intentionally skipped). Source formatting and ESLint pass for the repaired test files. The existing bootstrap route suite checks every canonical authored route, so it covers the production correction without a redundant new test.

## What changed

- `mode-entry.js`: include authored routes v34–v38 in the finite early-navigation allowlist. Before this change, native Back selected Legacy for those valid routes until the main module attached. This was an actual preexisting production defect, not a weakened test expectation.
- Inspector fixture: provide the already-existing discovery editor collaborator so inspection reaches the intended preview boundary.
- Font/audio status assertions: recognize the existing localized `Ready` status, while retaining actual face ownership, loaded-font state, playback and metadata assertions.
- Authored mode navigation: check the `Team` label and the exact navigation destination; remove dependence on obsolete marketing copy.
- Optional historical candidate: verify constructing the candidate does not mutate application entry routes, instead of requiring the global default to stay at v11 forever.
- Preview cancellation: retain aborted-signal, hidden-frame and timer assertions; verify a superseded completion does not change visible messages. Superseded errors are intentionally consumed by the unchanged host.
- Pause navigation: account for the existing Skip mission control before Choose mission; keep the exact chosen-focus and paused-run invariants.
- Paused presentation preferences: retain an explicit whitelist of shared preference reads, including the new appearance key and its legacy migration input. Measure writes from the start of the settings action so earlier flight teaching progress is not attributed to cosmetic edits. The allowed write set remains display/menu preferences only.

## Remaining reproduced groups

These are release follow-ups, not appearance regressions inferred from a red aggregate command. A HEAD reproduction establishes their age; it does **not** decide whether each requires production changes, a finite-DOM correction, or an updated assertion.

| Test file | Records | Observed failure / next investigation |
| --- | ---: | --- |
| `coop-picture-recovery-focus` | 16 | Recovery focus, visibility and cancellation expectations fail. Reproduce native Retry/Cancel in the browser before changing focus contracts or mocks. |
| `coop-picture-host` | 7 | Retry focus, cancelled reads, resource-release timing and mode departure fail. The separate obsolete preference-read assertion is repaired. |
| `coop-presentation-bootstrap-retry` | 5 | Enter on Retry leaves error state instead of immediately preparing. Determine whether native landing placement or fixture visibility prevents activation. |
| `coop-recovery-copy` | 2 | Recovery copy is produced, but Retry does not receive expected focus. Likely overlaps the recovery group above. |
| `coop-custom-artwork-host` | 1 | A completed import's older continuation moves focus after Reset. |
| `coop-import-artwork-host` | 1 | Hiding the page during imported image loading leaves the retained/chosen arena unplayable. |
| `coop-import-next` | 1 | Hiding during imported Next never satisfies the expected restored Results condition. |
| `couch-catalogue-host` | 6 | All six fail at the same prerequisite: the requested indexed chapter mission never appears in All missions. Investigate fixture/index/source identity before transport-cancellation assertions. |
| `coop-entry-memory` | 9 | Global storage-write assertions count legitimate contextual-teaching writes as arena bookmarks. Scope assertions to the owned preference while retaining protection of other progression stores. |
| `coop-shared-settings` | 1 | Exact state comparison sees initialization of empty radio setup. Decide the intended initialization boundary; do not silently ignore all writes. |
| `coop-lobby-preview` | 9 | Five records expect obsolete teaser copy; others expose unavailable preview, incomplete preparation and Settings-focus differences. They must not all be classified as copy-only. |
| `coop-startup-selection` | 4 | Two nested exact-image-list comparisons, their parent failure, and one unavailable startup picture. Separate legitimate additional actor textures from missing presentation preparation. |
| `coop-terrain-trail` | 1 | Missing-reader snapshot is admitted where the test expects fail-closed rejection. Resolve the current presentation contract before changing the assertion. |

Recommended order: native Team recovery and import lifecycle first; shared catalogue prerequisite next; persistence/preview fixture assumptions next. The full repository test run and immutable source-history/catalogue checks still need a separate clean run after these are resolved or explicitly admitted as an existing baseline.

## Evidence and reproducibility

- `failure-inventory.json`: all 116 original records, disposition, exact file/name and HEAD/current evidence links.
- `original-failures.json`: extracted inventory from the retained interrupted log.
- `reproduction-inventory.json`: 56 bounded file runs, commands, duration, result and failure detail.
- `*.head.log.gz` / `*.current.log.gz`: complete retained output for each paired run.
- `catalogue-remaining-head.json` and `catalogue-case-*.head.log.gz`: the other five individually selected catalogue failures, each reproduced on HEAD.
- `repaired-harnesses.log`: final 122-test green run.
- `paused-presentation-preferences.log`: the separately repaired preference contract.
- `custom-import-focused.log`: focused completion of the one case whose full current file exceeded the audit's 130-second ceiling.
- `repair-source-hashes.json`: exact current and HEAD source hashes for this pass's repairs.

The initial catalogue current/HEAD pair selected the first failing case because each catalogue setup waits 45 seconds. The remaining five have their original current failure and individual fresh HEAD reproductions; they were not each rerun against final current sources. The full current custom-import file timed out after recording its failure; a focused rerun completed and retained the same failure. Both limitations are recorded rather than represented as complete green runs.

To reproduce the green repair gate:

```sh
node --test --test-concurrency=1 game/test/acceptance-inspector.test.mjs game/test/asset-studio-audio-master.test.mjs game/test/asset-studio-font-cache.test.mjs game/test/authored-mode-bootstrap.test.mjs game/test/authored-mode-entry-host.test.mjs game/test/controller-practice-pause-host.test.mjs game/test/company-studio-ui.test.mjs game/test/border-timed-detour-pair.test.mjs
node --test --test-concurrency=1 --test-name-pattern='paused menu/display edits retain HUD continuity' game/test/coop-picture-host.test.mjs
```

For a remaining group, run its named test file directly with `node --test --test-concurrency=1`. Exact selected commands are retained in the JSON receipts. The HEAD comparison used an APFS clone, restored all changed tracked files from the pinned commit, removed untracked implementation files, and reused only installed dependencies. It made no edits to immutable publication artifacts. The temporary clone was removed after verification to restore disk space.

No commit, publication, physical-device result or full-suite certification is implied by this packet.
