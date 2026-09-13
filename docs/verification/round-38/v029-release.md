# v0.29.0 — device-aware Arcade correction

Frozen from **f40e1d9ecf262ba94915ddc3fc05eda074058b7a** for the September 13 control/entry feedback. All six exact-source gates pass, including **2,355/2,355 tests**, with zero failures/skips. Independent artifact verification also passes. Public delivery is a separate gate at this documentation handoff; this document does not infer deployment from a frozen tag. The final receipt will be attached to the [v0.29 GitHub Release](https://github.com/mekhovov/revealline/releases/tag/v0.29.0).

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

## Frozen artifact and delivery preparation

- Tag object: `fe04904513825e8b63a37ef14beaac2311ce0449`, pointing to the exact source above.
- Source TAR SHA-256: `20e79bd32ff0ab67ecb4b5daad33e379d0fe1021a609695c323b9d6a8f0d91df`.
- Distribution ZIP SHA-256: `ecaeafc2e9108449e6571a91763419c941f97eaf9632355ae68b7ecac873d62b`.
- Manifest SHA-256: `8d644009e69118ce4f89c77fa4d24aa2bd1baadd5dc746d07434ec026ffdacfc`.
- Archived-source rebuild:221 loose files,217 manifest assets and218 ZIP entries match, including CRC/payload validation.
- Offline inventory:211 files /44,864,621 bytes. Historical R1/R2/R3 are optional downloads; their exact recipes remain available.
- Preservation:33 earlier release trees and34 earlier tags are unchanged.
- Prepared main Pages artifact:1,207 files /297,561,239 bytes, below the unchanged950 MB budget. It advertises34 versions, preserving31 archive versions and228 old HTML forwarding entries.

The first candidate `b70b691` passed five gates but failed nine legacy test expectations. Its full result is retained. The corrected candidate changes only seven test files: the new Auto preference is asserted explicitly before checking unchanged historical profile fields/checksums, the featured-download test targets R4, and aggregate proof coverage includes the added chapter. No failed candidate was tagged or published.

A live refused-HTTP-module test also passed: only the modern recovery surface remained visible, Retry held focus, the old main stayed inert/hidden and no gameplay canvas existed. The normal single-tab1280×720 Large-text flight fit the viewport with a920×460 arena, no bottom toolbar and document height720.

The [GitHub Release receipt](https://github.com/mekhovov/revealline/releases/tag/v0.29.0) will record the merged PR, completed Pages run, frozen/offline/public browser journeys and full public-byte comparison. Its attached receipt is the final delivery status; these committed notes preserve the pre-deployment handoff rather than rewriting the frozen source.
