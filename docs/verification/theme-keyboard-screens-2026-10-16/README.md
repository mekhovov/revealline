# R7 remaining-family screens and keyboard review — 16 October 2026

Reviewed source revision `2258be78a10b3181037da12c8d4ce0e114f5f132` through the local game at `http://127.0.0.1:8893/game/?journey=whole-spatial-v25`. This increment records acceptance evidence; no runtime styles or gameplay code changed. The in-app browser retained the normal unlocked session. No credentials are stored here.

## Additional family coverage

Each family below was selected in the actual game, then inspected on the Audio settings screen at 1280 × 720. These views cover category selection, panel/background materials, button faces, checkbox labels and slider tracks/thumbs. They supplement the seven-family settings review from [15 October](../theme-live-journeys-2026-10-15/README.md), completing an initial real-settings view for all 18 named families. This is not every-screen approval.

| Family | Capture | Review outcome |
| --- | --- | --- |
| Signal Blue | [Audio](signal-blue-audio.png) | Flat midnight/cyan identity retained; labels and selection readable. |
| Military Field | [Audio](military-field-audio.png) | Olive instrument surfaces and amber hardware remain coherent. |
| Dnipro Porcelain | [Audio](dnipro-porcelain-audio.png) | Ceramic panels, white controls and blue selection remain distinct. |
| Tryzub | [Audio](tryzub-audio.png) | Navy/gold palette carries through sliders and checked controls. |
| Neon Ruins | [Audio](neon-ruins-audio.png) | Jade selection remains legible on indigo surfaces. |
| Pocket LCD | [Audio](pocket-lcd-audio.png) | Sage grid texture and dark ink remain readable. |
| Copper Observatory | [Audio](copper-observatory-audio.png) | Copper controls and directional surface finish remain consistent. |
| Sakura Station | [Audio](sakura-station-audio.png) | Plum labels and cherry selection remain readable on porcelain. |
| Obsidian Reliquary | [Audio](obsidian-reliquary-audio.png) | Bone labels and aged gold remain distinct from dark stone. |
| Deep Space | [Audio](deep-space-audio.png) | Ice-blue controls and dark bridge surfaces remain consistent. |
| Moonlit Grove | [Audio](moonlit-grove-audio.png) | Silver/lilac controls remain readable over dark timber. |

No new material defect was found in these captured views. Review was visual, not a pixel-sampled contrast certification. One rapid scripted Enter sequence did not switch Copper to Audio; the selected-tab state exposed it, and ordinary pointer activation was used for the final Audio capture. No universal rapid-key-repeat claim is made.

## Keyboard and accessibility results

- Enter opened Settings from its menu button. Up/Down moved between vertical category tabs and selected the corresponding panel.
- Enter and Space applied theme cards. Tab moved directly from Dnipro to Tryzub, skipping the decorative controls inside the specimen. Focus stayed on the selected theme card after presentation changed.
- Escape closed desktop Settings and returned focus to the Settings opener.
- In the paused Moonlit flight, Mission info → Mission brief opened the [themed reading surface](moonlit-mission-brief.png). Escape returned to the paused flight with focus on Mission brief. It did not resume flight.
- [Moonlit with Decorative detail Off](moonlit-detail-off.png) removed the decorative grain and bevel finish from the inspected controls/panel. [Dnipro with High contrast](dnipro-high-contrast.png) used clear black/yellow/white surfaces instead of the light palette.
- Dnipro at 390 × 844 with Plain/Large text and reduced effects: [accessibility controls](dnipro-large-accessibility.png) fit the compact panel. Escape returned to the category list instead of closing Settings. The [Ukrainian selected theme card](dnipro-ukrainian-picker.png) measured 322px client/scroll width and 375px client/scroll height, with focus retained. [Measured observations](measurements.json).
- Restored English, Theme font, Standard text, reduced effects off, high contrast off, Theme default decorative detail and Flight Deck. Reset the temporary viewport. The flight remains paused.

## Automated checks

45 tests passed in the following focused suites:

```sh
node --test game/test/shared-settings-solo.test.mjs game/test/settings-panels.test.mjs game/test/menu-appearance.test.mjs game/test/unified-appearance.test.mjs
```

These supplement the earlier 155 distinct theme/SIM checks; the broad cohort was not rerun for this evidence-only increment.

## Remaining gates, in order

1. **R7 remaining surfaces/states:** results/rewards, loading/error/recovery, the other creator surfaces and family-specific dialog combinations. Existing settings coverage does not stand in for these. Reuse the same actual-game navigation and capture selected/focused/disabled/error states where they occur.
2. **R7 browser/device confirmation:** Safari access was not approved, so post-fix Safari dropdown verification remains open. Physical touch, supported controllers and screen readers were not available in this review. Browser viewport emulation is not physical-device evidence.
3. **R1 repeatable release baseline:** carry the accepted observations forward only after checking the target revision; rerun affected routes when host markup, materials or focus routing changes. Keep missing campaign artwork and unavailable external music catalogue separate from theme failures.
4. Continue the approved R2 → R3 → R4 → R5 → R6 → R8 order. SIM flight, proof/resource/performance gates and creator import/recovery remain separate from this UI review.

R7 remains open. These results reduce the remaining family/settings uncertainty without claiming full game or release qualification.
