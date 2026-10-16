# Continuous Operations — Release A implementation, 13 October 2026

This continuation builds on the eight mechanics prototypes in #1158 and #1160. It adds the first **48 of the approved 96 missions** to the production campaign. The catalogue contains **192 missions in 29 chapters**. The original 144 recipes and their recordings are unchanged in this slice.

## Completed

| Chapter            | Eight-mission progression                                                                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Switchyard Pursuit | Learn next-junction dispatch; compare asymmetric loops; cut across platforms; handle a runner alongside a patrol; dispatch two independent routes; wrap to a distant lever; use shutter windows; change the return dispatch in a second stage.              |
| Cable Foundry      | Learn body occupancy; use near/far pads; turn through an elbow; manage independent gates; carry temporary length across pressure doors; intercept changing prey; compare wrapping with a shortcut; combine shared Team delivery and gates.                  |
| Loaded Routes      | Learn temporary cargo length; match two docks; unload before a tight return; activate a second harvest; pursue changing refuges while carrying; use irrigation plates; deliver across an edge; finish a three-stage rendezvous.                             |
| Split Horizons     | Alternate extractions; deliver across a seam; change vertical approach; intercept beyond offset quays; compare gates with wrapping; dispatch through an edge; unload between trips; alternate three rendezvous edges.                                       |
| Crossfire Works    | Cross warned lanes; deliver coolant; read a guard's aim; flank through a pressure gate; change horizontal/vertical approaches; deliver on both sides of a guard; redirect patrols beside fire; combine delivery, clearance and extraction.                  |
| Extraction Circuit | Combine delivery/catches; activate successive landings; unload beyond a pump gate; dispatch before loading; use a wrapping alternative to shutters; solve a relay before delivery; handle outbound/inbound loads; finish shared pressure-gate cargo stages. |

Every mission has EN/UK titles and a concrete tactical description, explicit geometry/object positions, finite stages and an authored world/chapter composition. Stationary specialist posts do not repeat within a mission's accepted encounter sequence. Moving prey, safe-contact patrols and existing warned specialists reuse the established engine rules.

Production integration includes:

- Shared selector, true board previews, campaign order, direct launch and existing pause/results/continuation ownership.
- Compact localized objective status with stage, current catches/delivery, routing activation and ready-extraction cue. Duplicate catch counters are hidden for operations; the objective takes its own wrapping HUD line.
- Operation admission selects visible authored Campaign/Mission Race settings. Engine/import validation rejects incompatible remix/Score/Endless requests instead of stripping stages. Standalone Score remains available on its supported arena recipes.
- Studio copy/export/import preserves stages, parcels, docks, junctions and cable plates. Advanced JSON remains the operation editor; changed recipes still require validation and play qualification.
- One objective text projection in production and the review lab. No additional player menu or transition controller.
- Completion stars and exact personal records, without importing silver/gold thresholds from unrelated recipes.

## Verification

- **288** accepted-input winning journals: every new mission × Solo/Team × slow/normal/fast. Current recipes are checked against every checkpoint. The qualification tool can resume its matrix and requalifies any changed draft.
- Full Snake regression run: **283/284 initially passed**. The only failure was a historical-version test grouping every non-v4 recipe as v1–v3; its filter now explicitly selects v1–v3, and its targeted suite passes. No historical recipe or proof was changed to satisfy it.
- **96** normal-pace winning Solo/Team records persist and reload; all earn one uncalibrated completion star. Serialized proof profile: **369,237 bytes**, under the existing 24 MiB logical budget.
- 38 optional/offline/package tests pass; canonical shared play shell remains byte-identical. Targeted lint/format checks pass. See the current PR for localization and any later verification results.
- Real browser: new campaign direct entry, automatic failure replay/retry, direct Retry, shared pause and selector. At 320px, Heavy Crossing has a 304px board, a visible stage/delivery/plate line, and document width remains 320px. Shared mission search shows its real board preview. Review lab played staged cargo in Toybox.
- A previously visited development origin served an older cached catalogue. A fresh preview origin at port 50365 loads the correct 192-mission build; no player saves or browser caches were erased.
- Disk fell to approximately 252 MiB during work. Removed only a byte-identical duplicate Notion updater download (125,021,734 bytes); its identical pending installer was retained. No source, worktree, commits, user documents or in-use development artifacts were removed. No full distribution build has been claimed.

Automated wins establish solvability, not player-rated fun. Physical phones/controllers, GPU frame-time comparisons, complete release packaging and human visual acceptance remain outstanding.

## Remaining approved work

1. **P1: 144-mission keep/revise audit and improvements.** Early catalogue review still finds long single-policy quotas in v1–v3. Evaluate each route; preserve old recipes before changing gameplay, then regenerate compatible evidence. New content does not replace this requirement.
2. **P1: Per-mission visual composition and state animation.** The shared six-world/four-look foundation and chapter compositions exist. Complete distinct landmarks/material detail and meaningful cargo/dock/switch/gate/erosion/victory reactions, including reduced effects and exact collision footprints. A unique descriptor name alone is not visual acceptance.
3. **P2: Release B, 48 missions.** Signal Smugglers, Breaking Ground, Refuge Labyrinths, Supply Gambits, Twin Operations and Living Citadels remain to be authored and qualified. This provides the six remaining chapters, further enemy combinations and all six worlds in the expansion.
4. **Per release: Compatibility and final acceptance.** Finish the total 576 new proof combinations; multiple jammer seeds; revised historical proofs; combined storage/capacity/concurrency/import checks; all appearance/mode/locale/viewport combinations; bounded cache/frame-time measurements; optional/offline/full packaging; physical-device and player observation.

The expansion goal remains active. This report records the delivered slice and does not declare the complete plan finished.
