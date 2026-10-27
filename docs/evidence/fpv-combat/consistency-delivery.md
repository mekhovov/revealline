# FPV consistency and presentation delivery

> Current consolidated status, remaining gates and estimates: [FPV SIM current plan](../../fpv-sim-current-plan.md). Historical figures below retain their recorded source scope.

20 October 2026. Local implementation in `go_test_radio_fix`, branch `codex/fpv-flight-widgets-world-picker`. Nothing published. Unrelated working changes and original saves are retained.

## Delivered behavior

- New live Worlds and learning sessions use versioned destructible-subject rules. Movement roles no longer imply immunity. Authored characters take priority over generated encounter slots, with the actual minimum population shown. Explicit imported actor IDs own their visible scene subtrees; unknown geometry requires actor metadata.
- Required lesson subjects receive a new generation after 250 accepted ticks, only at a supported authored position with player clearance. Blocked replacements wait visibly. Damage precedes contact catches; fixed logical credit prevents repeated qualifying rewards. Contact Hunt retains its accepted momentum behavior.
- Historical Watch keeps historical rules. Continue preserves the original evidence and opens an independent unscored continuation. Native and Advanced recovery preserve their original checkpoints before migration. Recording exhaustion retains the last verifiable boundary while flight continues; the retained interval and recovery limit are explicit. Failed storage and obsolete launch handoffs release detached physics worlds.
- Shared objective presentation distinguishes crossings, holds, landings, manoeuvres and subjects. Decorations extend outside the scoring aperture. Current/next cues, offscreen bearings, wrong-entry-side instructions and occlusion states share the same settings and renderer.
- Black three-blade peripheral props, a modest aircraft-specific nose and an independent cosmetic knife replace the obstructive foreground. The central flight view stays clear in renderer tests. Foreground changes do not alter physical dimensions, aiming or collisions.
- Compass, horizontal speed and map-relative height have their own visibility owner. Health, magazine, reserve, reload and payload displays remain available in all combat activities, including Survival. Optional telemetry uses actual available values. Settings remain reachable through the existing six-switch radio menus.
- Optional full route guides default Off. Studio supports validated waypoints, preview, undo/redo and stable-ID import/export. Multiple stale routes can be repaired individually; full route admission remains required for play/export. Missing routes receive an explanation rather than a fabricated trail.

## Current verification

[Regression receipt](consistency-regressions.json) records source hashes at the time of two disjoint test runs (before the later compact-HUD update): **233 host/actor/route/archive checks and 374 renderer/presentation/radio/recovery checks; 607 passed, zero failures or skips**. TAP logs are retained alongside the receipt. Scoped lint, formatting and generated-bundle checks passed.

[Catalogue ownership audit](catalogue-damage-ownership.md) inventories 204 shipped course sources and 357 authored actor occurrences. It verifies ownership projection, not complete visual or reachability qualification of arbitrary downloaded scenery.

[Package measurement](consistency-package-measurement.json) includes complete runtime and source candidates under unchanged policies:

| Package | Runtime files / bytes | Source files / bytes | Original-input headroom |
| --- | ---: | ---: | ---: |
| Academy | 145 / 11,968,672 | 147 / 12,010,728 | 120,408 bytes |
| Worlds | 208 / 19,231,097 | 210 / 19,281,431 | 548,125 bytes |

Worlds remains at its 210-file source ceiling. Shared modules and losslessly deduplicated industrial data provided room without raising package policies. Zero Git identities in these working-tree measurements are placeholders, not authenticated release evidence.

[Fresh catalogue matrix](consistency-catalogue-matrix.json) passes **7,420/7,420 cases** across 371 entries: 245 native editions and 126 regional starts. Every case admits a nonempty roster and passes recovery and replay verification. These short model runs do not establish full activity victory, long-route reachability, resource economy or browser performance.

The local server serves both freshly built packages at `http://127.0.0.1:8768/`. Final browser inspection covered active Survival at desktop, portrait, compact landscape and ultrawide sizes, plus the learning objective display. Captures confirm visible health/ammunition, separated compass/toolbar and readable current/next cues. A rapid activity/loadout setting race discovered in the browser was fixed and checked: changing a following setting no longer restores the previous activity. Current objective labels have an 18-pixel backed style; the preview uses its actual next-objective number.

Representative captures:

- [Desktop Survival](consistency-survival-desktop.png)
- [Active portrait Survival](consistency-survival-portrait-active.png)
- [Compact Survival](consistency-survival-compact.png)
- [Ultrawide Survival](consistency-survival-ultrawide.png)
- [Learning objectives](consistency-learning-objectives.png)

Temporary inspection settings and viewport overrides were restored. Radio calibration was not changed.

## Acceptance still pending

- Broad visual inspection across all families, FOVs and downloaded scenes beyond the representative browser captures.
- Physical-radio and human readability checks. Prior radio confirmations do not qualify the new full matrix.
- Full activity victory/resource-economy qualification and full lesson completion after required-subject replacement in the actual browser. The current-source short catalogue admission/recovery/replay matrix has passed.
- Current-source sustained effects comparisons, cleanup/memory checks and 20/64/96/128-actor full-application performance runs, including regional terrain and Advanced physics. Historical performance reports have different source hashes and are not promoted to passes for this revision. Their strict 60 FPS gate was already open above 20 actors.
- Human satisfaction and threat-clarity sessions, plus broader device coverage.

These remaining gates prevent calling whole-SIM release qualification complete. The implemented features are available for local review.
