# P03-D — story action focus

Status: implemented preparation, independently reviewed and scoped-tested. No version/tag/public deployment is claimed. The approved phase order and final integration gates remain in force.

Native browsers can clear active focus immediately when a button is hidden or disabled. Story rendering previously read focus after those changes, so natural completion could leave it on BODY. Capture the current action first, then select a visible enabled replacement only if focus remains owned or fell to BODY. Preserve deliberate focus on volume, Close, or a blur-handler destination.

## Verification

- The stronger test boundary reproduced the original defect (30/31); the final complete story UI file passes 33/33 on Node 20.19.5 and 22.22.2. No skipped or cancelled tests. ESLint and Prettier checks passed for both changed modules. Raw final TAP and exact source/test hashes are retained alongside this file.
- Actual keyboard navigation opened an earned First Signal story from Collection on the root-owned test origin. Play focused Pause; Pause focused Resume story; Resume focused Pause; natural 8-second completion focused Replay. Replaying with volume or Close selected preserved that focus. Escape returned to Play earned story, then the picture card, then Collection on the title menu.
- The picture remained First Signal, 8,160 points, GOLD, 12.18 seconds. These are retained prior awards, not newly earned by story playback. The silent owned clip stayed muted. This is not an audible soundtrack or physical-device claim.
- Actual browser viewport was 1393×1348 CSS pixels. Source bytes served at the changed module URL matched the inspected local bytes. The preview used exact base `6de5ea1160c519b39f0a98a1c9f054262191ea17` for remaining files, with no full production build or publication.

## Preserved diagnostics and remaining gates

The first additional preservation test skipped the modeled replay seek and therefore remained Preparing; it was corrected to use a fresh ready player for each target. An attempted native Tab sequence from the final volume control did not establish Close selection; a second observed keyboard Shift+Tab journey did. Final-volume tab wrapping remains part of the broader P03 navigation review. The initial Title BODY-focus defect is independently fixed by P03-B.

Integrate this correction with the accepted P01/P02/P03 source, retain existing audio and poster identity, run final source/production/build gates, then freeze and verify the new public release. Keep controller, touch and responsive acceptance separate.

The expected logical return follows [W3C modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/); whole-menu input consistency follows [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112). Sources reviewed 15 September 2026.
