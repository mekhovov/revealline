# Compact Team lobby

Status: isolated follow-up prepared for integration. Not publicly released.

The Team lobby keeps the mode row, title, three setup choices, picture preview,
objective and Start close together. The preview and launch actions share a row on
wide screens and stack on narrow screens. The full arena-specific tutorial and
Support/stronghold guidance move into the existing How to play reading region,
which is also available while paused. Existing IDs, inputs and authored rules remain.

Large text is never shrunk to force a fixed-height design. Narrow/short screens
allow vertical scrolling, preserve the whole preview, and do not overflow horizontally.
The keyboard order follows the DOM; no CSS visual reordering changes interaction order.

A resize now reveals the currently focused lobby action as well as a paused action.
It does not refocus, activate, start or resume anything. The current run, generation,
settings visit, dialog state, foreground and focus are checked before and after
layout reads. A newer action or background state vetoes the reveal. Reading regions
retain their own scroll/navigation adapter.

## Evidence

The [scoped verification record](verification/team-compact-lobby/result.json) pins
all three runtime overrides over source6c51b7e9. Four test files pass44 checks and the
existing paused-resize file passes8 additional checks on both Node20.19.5 and22.22.2.
The new lobby resize tests fail against the previous runtime; negative output is retained.
Native keyboard checks cover the desktop lobby, relocated briefing, Plain/Large text,
portrait/short landscape, corrected focus after rotation, explicit Start/Pause and
reading Help without advancing the paused clock. No console warnings/errors occurred.

This does not certify physical controllers, touch hardware, narration, 200% zoom,
all Team actors/content, the complete navigation phase or public deployment. Run
final integration/source gates and repeat affected public journeys before acceptance.

## Integrated preview-test correction

The full v0.76.1 qualification of `1cb0b3c67a39188d748ab3dd37557b5065fa504a`
found six failures in `coop-lobby-preview.test.mjs`. Its shared assertion still
required Preview and Start to have the same immediate parent. The compact layout
intentionally groups Start with the objective and launch actions beside Preview.
The corrected assertion verifies their common launch group, lobby ownership and
preview-before-actions reading order. Existing exact-image reuse, mystery masking,
retry, Pause, imported-pack and earned-victory assertions remain unchanged.

The prior scoped cohort omitted this related file. Include it whenever changing
Team lobby markup, then run the full integrated qualification before publishing.
The failed run is retained as evidence; it is not a passing release gate. The
[corrected preview and resize cohort](verification/team-compact-lobby/integrated-preview/result.json)
passes 23/23 on Node 20.19.5 and 22.22.2. Final-source/public qualification remains
required.

## Authoring prompt

“Adjust the Team lobby while retaining all authored arena choices and warning text.
Keep the selected arena and Start together. Put detailed guidance in the existing
reading region, available before Start and during Pause. Preserve shared text size,
menu palette, source-art identity, imports, explicit Resume and controller routing.
Verify current focus after rotation without activating it or stealing newer focus.”
