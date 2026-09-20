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

## Authoring prompt

“Adjust the Team lobby while retaining all authored arena choices and warning text.
Keep the selected arena and Start together. Put detailed guidance in the existing
reading region, available before Start and during Pause. Preserve shared text size,
menu palette, source-art identity, imports, explicit Resume and controller routing.
Verify current focus after rotation without activating it or stealing newer focus.”
