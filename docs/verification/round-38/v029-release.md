# v0.29.0 — device-aware Arcade correction

Implementation candidate for the September 13 control/entry feedback. Source and public delivery gates are in progress; this document does not yet assert a deployed release. The final receipt will be attached to the [v0.29 GitHub Release](https://github.com/mekhovov/revealline/releases/tag/v0.29.0).

The change replaces the failed legacy entry surface with a native boot/title, corrects all four D-pad positions, confines virtual controls to active touch/explicit mouse steering, moves utilities into the game menu, and features the versioned direction-only First Light R4 chapter. The same three original pictures are retained; no bulk artwork completion is claimed.

Focused evidence is retained under `.cache/round38/`: `boot/verification.json`, `arcade-r4/handoff.json`, capacity reports and browser captures. Final exact-source gates supersede mutable-workspace test counts. Earlier failed fixture expectations and missing test-copy dependencies remain in their original logs rather than being relabeled as passing runs.

## Browser observations

- HTTP startup reached Ready and focused the native featured chapter action after revealing the shell.
- Featured chapter → briefing → Start used real Enter and pointer actions; the R4 help no longer advertises manual abilities.
- At 320×640 with Large text, the 296×148 arena ended at y303.1; four 56×56 controls occupied y454–630 and stayed outside the board. Pause hid the controls and kept its actions reachable. Document height stayed640.
- At 844×390 with Large text, the corrected 370×185 arena and 46×44 control targets were disjoint. Explicit cardinal placement remained correct after rotation. Document height stayed390.
- Desktop Auto had no bottom controls; explicit Always enabled mouse steering. Small width alone did not enable Auto.
- The tool's security policy blocked direct `file://` navigation. No alternate surface or URL workaround was attempted; that path has finite boot tests only.

These observations do not constitute physical-device certification or prove enjoyment. Final frozen/public journeys and byte checks are recorded separately when completed.

## Remaining plan

The immediate correction closes before resuming the [roadmap](../../implementation-roadmap.md). Priorities for review are music backup/offline qualification (P3), meaningful Tactical scenarios (P4), image/video/frame/GIF authoring (P5), full campaign/art/music production (P6), real hardware/performance/public-product qualification (P7), then native distribution (P8) and optional online races (P9).
