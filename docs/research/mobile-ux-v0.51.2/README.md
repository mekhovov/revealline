# Mobile UX verification — v0.51.2

Rebased onto origin/main `6cbe1c8` (v0.51.1) before final testing. Previous v0.44.2-based measurements are superseded.

## Research and design choices

- [WebKit: designing for iPhone safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) supports using `viewport-fit=cover` with safe-area insets around interactive content. Insets supplement the small ordinary margin.
- [WebKit: dynamic viewport units](https://webkit.org/blog/12288/working-together-on-interop-2022/) explains `dvh`, which follows the available height as browser controls change. A `ResizeObserver` watches that CSS viewport instead of relying only on orientation events.
- [Apple: layout](https://developer.apple.com/design/human-interface-guidelines/layout) informs safe placement and adaptation to available space and text size.
- [Android: adapting layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout) informs using both width and height and changing the arrangement of list/detail content. A wide phone with a short browser viewport needs a different menu from a tablet.
- [Counterpoint: Q2 2026 best-selling smartphones](https://counterpointresearch.com/en/insights/iphone-17-global-best-selling-smartphone-in-q2-2026) informed the emphasis on iPhone 17 and Samsung phone families. The test matrix covers their size ranges alongside smaller phones, tablets and a handheld; it does not claim exact hardware emulation.

## Result

The landscape HUD uses a narrow rail in the spare space beside the board when that keeps the board largest. Shorter viewports use a reserved horizontal strip. Navigation, telemetry and training instructions no longer cover live cells. The complete board keeps its authored aspect ratio; it is never stretched or cropped. The rail mirrors when the player chooses left-handed steering.

At 956 × 330, the 2:1 mission occupies 644 × 322 pixels: the full available height, with its HUD beside it. Fullscreen portrait reserves separate space for the HUD and thumb controls. Dynamic viewport measurements follow browser chrome and orientation changes, with safe-area padding for notches and the home indicator.

Short landscape menus use smaller headings, compact mission thumbnails and a visible deploy footer. Settings, briefing, music, collection and other long menus scroll within the available height. Close/back controls remain reachable, and menu buttons keep a minimum 44-pixel target. The existing touch steering behavior is unchanged.

## Browser verification

**230 recorded observations on the rebased source**, using the Codex in-app Chromium browser and real UI navigation. The following 24 viewport configurations were checked for home, audio settings, mission selection and gameplay:

| Representative size range | Portrait | Landscape |
| --- | --- | --- |
| iPhone 17 Pro Max / large iPhone | 440 × 956 | 956 × 440 |
| Recent iPhone Pro | 402 × 874 | 874 × 402 |
| Recent standard iPhone | 393 × 852 | 852 × 393 |
| Large Android phone | 412 × 915 | 915 × 412 |
| Medium Android phone | 384 × 854 | 854 × 384 |
| Compact Android phone | 360 × 800 | 800 × 360 |
| Smaller iPhone | 375 × 667 | 667 × 375 |
| Minimum supported small phone check | 320 × 568 | 568 × 320 |
| Small tablet | 744 × 1133 | 1133 × 744 |
| Tablet | 820 × 1180 | 1180 × 820 |
| Handheld / small desktop | — | 1280 × 800 |
| Browser chrome reducing usable height | — | 956 × 330; 667 × 280; 568 × 256 |

The size names describe representative CSS viewport ranges, not exact hardware emulation. The iPhone 17 Pro Max range follows Apple's [1320 × 2868 display specification](https://support.apple.com/en-us/125091) at 3× scaling.

Music, workshop, help, field guide, collection, victory, pause, mission brief, restart confirmation, flight setup, records, save slots, expansions and challenges were each checked at eight configurations: 440 × 956, 956 × 330, 320 × 568, 568 × 256, 412 × 915, 915 × 412, 744 × 1133 and 1133 × 744. Pause, briefing and restart checks used Large text. Additional checks covered the other settings tabs, three training menu layouts plus six live Standard/Large training layouts, four left-handed/Large gameplay layouts, picture viewing, manual Scan/Boost controls, and narrow fullscreen portrait.

Observed results:

- All 24 gameplay views kept the complete 2:1 mission within the viewport, preserved its aspect ratio and had zero HUD/board intersection. A 4:3 base-game mission was also played and its controls checked.
- All recorded menu button/link/select/summary targets were at least 44 pixels high. Checkbox rows also have a 44-pixel label target; native checkbox glyphs are smaller.
- The chapter selector intentionally clips horizontally scrollable choices on portrait layouts. The `overflow` field records those offscreen children; it does not mean the dialog itself overflows. At 568 × 256, the mission dialog measured 568 pixels for both client and scroll width.
- At 568 × 256, a complete mission card and the Flight setup / Back to flight / Deploy footer were visible together. Longer lists and panels scroll rather than being permanently cropped. Training instructions also reserve their measured height; unusually long text scrolls while leaving a visible board.
- The music Back button remained topmost and actionable after deep scrolling (167.6 × 44 pixels).
- A real keyboard-controlled capture reached victory at 52.2%, 8,160 points and 3.67 seconds. View picture → Results → Main menu worked.
- Native fullscreen at 320 × 568 with Large text kept the score's text bounds within the viewport (right edge 312.95 pixels); see [measured text bounds](narrow-hud-text.json).
- Restart confirmation can be cancelled without resetting the active flight. Mission briefing returns without resuming it.

[Measurements](browser-measurements.jsonl) retain the final observations per screen/size and omit superseded failure captures. DOM rectangles can still be present for elements hidden underneath a modal; only the gameplay rows are used for live-board geometry claims. Viewport overrides and text-size/handedness changes were restored after checking.

**Limits:** these are Chromium viewport tests, not physical iPhone/Safari, Android or controller certification. Safari toolbar behavior and safe-area values are covered by dynamic CSS and model tests; a real-device Safari pass remains necessary. Browser chrome cannot be removed by page CSS. External authoring applications linked from Workshop were not included in the mobile menu sweep.

## Automated verification

The four Field Kit navigation tests also pass after updating stale expectations for the edition archive link on the rebased title screen.

The new layout suite passes **42 tests**, including 16 landscape dimensions with Standard/Large text, five board ratios, two safe-area configurations, portrait fullscreen reserves, training, handedness, resize coalescing, preference changes, native fullscreen, standalone mode and cleanup.

Source validation passes for v0.51.2 (569 release files; literal references valid). Changed JavaScript passes ESLint, and changed source passes Prettier. The complete repository test inventory contains **333 files**; see [inventory](test-inventory.txt) and [suite results](test-results.md) for the full run and baseline failures.

## Screenshots

| Gameplay and results | Menus |
| --- | --- |
| [Landscape board and side HUD](gameplay-landscape.png) | [Home](home-landscape.png) |
| [Manual actions](manual-actions-landscape.png) | [Mission picker](missions-landscape.png) |
| [Victory](victory-landscape.png) | [568 × 256 mission picker](missions-short-landscape.png) |
| [Pause](pause-landscape.png) | [Music](music-landscape.png) |
