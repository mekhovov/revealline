# Unified appearance: quality-first implementation follow-up

This continues the user-approved quality-first order from the
[plan review](../../unified-appearance-plan-review-2026-10-02.md). Industrial remains
the new-profile fallback; existing preferences and explicit personal choices are
preserved. The eight installed families remain available.

Parallel SIM work can use the [integration handoff](sim-integration-handoff.md)
for the current working-tree identity, stable APIs, shared-file ownership and caps.

## Completed in this pass

1. **Classified the retained wider-test failures.** Every one of the interrupted
   run's 116 failure records is classified: 30 repaired in this pass, 23 already
   repaired by the preceding appearance work, and 63 reproduced at the baseline
   commit. Parent and nested failures are separate records, not 116 independent
   defects. No unclassified record remains. This does not turn an interrupted run
   into a full-suite pass. [Baseline evidence](baseline/README.md).

2. **Polished shared reading and control surfaces.** Nested Music Library,
   optional-content, replay, multiplayer, recovery and creator surfaces now use
   the same panel/inset/toolbar recipes. Paired text colors fix dark wells inside
   light themes and unreadable mission-download badges. Links, transport controls,
   volume labels, checkboxes and error states now retain consistent spacing and
   semantic presentation. Custom themes inherit their declared material style
   while keeping their own identity. [Browser evidence](browser/README.md).

3. **Completed the curated custom-community path.** An edited Studio interface
   candidate can be staged in Company Studio, explicitly registered and assigned
   to a community or campaign, and included with its exact revision in compiled
   and retained exports. Two unrelated communities can use the same candidate.
   Selection does not silently mutate the draft. Personal appearance overrides
   still win. Contrast-invalid candidates can be previewed as drafts but cannot
   enter the curated assignment/publication path. The exact candidate reaches a
   new SIM tab through a bounded, expiring transfer that preserves `noopener`.
   Missing transfers use authored world visuals with a diagnostic. Support pages
   can reuse the successfully accepted candidate for 30 minutes in the current
   session; compiled defaults and personal choices retain precedence. Failed or
   cancelled loads do not replace that accepted context.

4. **Localized and named the new authoring controls.** Company appearance labels,
   descriptions, recovery messages and candidate state update in English and
   Ukrainian without losing staged edits or semantic focus. Theme selectors now
   have explicit accessible captions. Runtime missing-theme, stylesheet and
   preference-storage notices also update with the active locale, without
   reloading assets or writing preferences. [Localization evidence](localization/README.md).

The custom-candidate scope is deliberately precise: edited interface tokens and
material style, with exact compatible **installed** Arcade/SIM collections. Source
asset edits that this path cannot render are rejected with an explanation. This
does not claim arbitrary custom model/font/sprite publication or player theme-file
installation.

## Verification for the current pass

- Combined appearance/Studio/community gate: **142 passed**, no skips or failures
  (`appearance.tap`).
- Standard practice suite: **207 passed**, no skips or failures (`practice.tap`).
- Explicit World/appearance suite: **62 passed**, no skips or failures (`world.tap`).
- Independent custom workflow review: **45 passed**, covering seven corrected
  findings and actual production-host adoption/failure cases.
  [Review receipt](custom-theme-review/README.md).
- Runtime notice/host regression: **28 passed**, including six new EN/UK notice
  cases, exact custom host adoption and Sentinel download/backup/restart.
- Company/community/localization gate: **66 passed**, plus the actual Versus
  controller caption/focus journey. These focused gates overlap; their counts
  should not be added into a purported unique-test total.
- Sampled browser contrast checks pass for Industrial mission/music/pause/replay
  and Dnipro music/390px high-contrast controls. See the browser report for method
  and limits.
- Whole-repository ESLint, content validation, presentation metadata validation,
  localization validation, bootstrap generation check and byte-identical shared
  SIM projection checks pass. The interrupted wider test run remains separately
  classified, not advertised as green.

The current optional package builders pass the existing caps, including source
archives. Nothing is published by these synthetic-bound package checks.

| Package | Runtime files / bytes | Source files / bytes | Existing cap     |
| ------- | --------------------- | -------------------- | ---------------- |
| Academy | 62 / 4,073,954        | 64 / 4,091,461       | 64 files, 8 MiB  |
| World   | 93 / 14,516,910       | 95 / 14,539,132      | 96 files, 16 MiB |

See [package-bounds.json](package-bounds.json) and the
[curated contract](../../curated-community-themes.md). Auxiliary session
continuity is not permanent theme installation. Fresh offline-browser installation
and gated main-route visual acceptance remain unverified. Separate programmatic
Studio/SIM harness artifacts are labelled as such and do not substitute for the
root Cua screenshots.

The rebuilt local distribution is version **0.142.4**, **2,749 files**, SHA-256
`62f8638e1ea0587c791b45539b0a748839bbd1362d60a2f673134a8e83b4e6c1`.
Eleven runtime modules/styles match their source bytes exactly
([receipt](packaged-source.json)). A fresh Cua visit to the packaged multiplayer
settings and complete Music Library opened successfully with Industrial, no page
errors, and no failures among 108 sampled text/background pairs. The preview is
left open for review. No release or commit was created.

## Remaining priorities

| Priority | Work                                                                 | Why it remains                                                                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Complete the remaining visual and input matrix                       | This pass adds real Industrial and Dnipro dialog/mission/replay/pause/narrow evidence. Main home/results/rewards, every error/state combination, and physical touch/controller/screen-reader journeys are not all qualified. The main local game remains password-gated; it was not bypassed. |
| P1       | Target-device SIM readability and performance                        | Existing 192-case WebGL coverage and this pass's pin/handoff tests do not prove flight-distance markings, grazing-angle shimmer or the 10% p95 limit on other GPUs.                                                                                                                           |
| P2       | Representative production asset pipeline                             | Approve a small drone/gate/pad/vehicle/ground/wall set through export, standards validation, independent viewer and actual flight before bulk production. Existing procedural materials and shared meshes remain the truthful current art boundary.                                           |
| P2       | Industrial art depth, then Vyshyvanka/Dnipro                         | Improve the roles that benefit from bespoke art after the representative review; do not equate role coverage with premium art approval.                                                                                                                                                       |
| P2       | Qualify the other five families                                      | Keep them selectable while completing their individual art, language, input and device acceptance.                                                                                                                                                                                            |
| Release  | Resolve or accept documented baseline defects; integrate and publish | The broader suite is not green. This local task does not alter immutable published history or publish a release.                                                                                                                                                                              |

Detailed realism, new sound production, texture streaming and arbitrary player
theme installation remain deferred. No additional theme families were added in
this quality pass.
