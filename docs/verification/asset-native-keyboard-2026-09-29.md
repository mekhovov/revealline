# Asset Studio native keyboard and localized preview receipt

Local managed-checkout source served at `http://127.0.0.1:8985` on 2026-09-29.
The parent used the keyboard-only `assetCurrent&keyboard=1` fixture in the Codex
in-app browser. After the fixture Run setup, the editing journey used native
keyboard presses and text entry only: no pointer reset, target-focus shortcut,
virtual gamepad or direct editor handler.

## Observed journey

- Sections reached the inspector and pixel editor. New blank, Line, Space and
  arrows began a stroke. Escape canceled its anchor without changing the canvas;
  Undo remained disabled. A fresh line committed; Undo restored blank and Redo
  restored the edit. Escape left the canvas.
- Prepare edited sprite reached provenance. Validate rejected missing fields,
  retained document revision 100/local save none and focused Creator after
  unlocking the panel. Native text supplied Creator `Keyboard QA`, Source
  `Original pixel drawing in Asset Studio`, License `Original test asset`.
- Validate staged the replacement; explicit Save produced document revision 101,
  local save 1. Sections reached Reload saved; the same revision returned.
- Native navigation reached Export, producing a real `.rltheme` download.
  Save left body focus after unlock; the keyboard Sections action remained usable.
  The selected specimen is a raster UI panel; its preview is the editor canvas,
  not a claim about an embedded full-game preview.

## Actual exported artifact

`/Users/oleksandr.mekhovov/Downloads/revealline-fpv-r101 (1).rltheme`

- 8,229,368 bytes; modified `2026-09-29T02:58:28.764Z`.
- SHA-256 `1c6561e0eb7f94de3dcb089834715dfd2232ecfb2e879b36b76a8cae1abdc7bb`.
- Production `importThemeBundle` accepted format `revealline-theme-bundle.v1`,
  133 assets, document revision 101. All 130 distinct images were fully decoded
  through the OS image decoder into BMPs, checking dimensions and complete pixel
  payloads. Scoped temporary decode files were removed after each image.
- Both original-source and derivative assets (`ui.panel.custom.source` and
  `ui.panel.custom`, asset revision 1) retain the exact entered provenance. An
  initial extra receipt assertion expected only one matching asset; correcting
  it to account for preserved source lineage produced the successful receipt.

The isolated test origin retained this newly created QA workspace. Existing
user workspaces on other origins were not modified. This artifact is distinct
from the earlier revision-101 virtual-controller export with a similar filename.

## Preview correction and final-source checks

The keyboard journey exposed a completion label displaying the JavaScript
callback source. `drawAssetPreview` now evaluates the label and uses the existing
localized completion template. It preserves stale-operation, failure and cancel
checks. The focused test now supplies a callback label, matching the real caller:
**7/7 passed**. Independent review found no concrete regression.

After the fix, a fresh browser load showed `Saved preview: Ready` and
`Draft preview: Ready`. Changing language through the visible selector updated
both terminal labels to `Збережений перегляд: Готово` and
`Перегляд чернетки: Готово`; English was restored. This separate localization
check used the selector and does not change the keyboard-only journey claim.

Physical controllers, native packages, OS file-picker imports and published
builds remain separate pending checks. The previous [virtual-controller
receipt](authoring-workflows-2026-09-29.md) retains its own source attribution.
