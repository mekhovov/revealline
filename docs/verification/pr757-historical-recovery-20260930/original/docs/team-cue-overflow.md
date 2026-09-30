# Team field details when labels do not fit

Compact Team boards retain their full measured canvas cues and contact exclusions.
If the bounded group planner cannot place every cue, **Field details** appears
outside the board. Its short second line summarizes both seats; ellipsis affects
only this optional summary, never the complete details or the existing HUD.

One activation pauses the actual attempt and enters the existing Help reader at
the full field list. Keyboard, controller and touch use the same action. The
reader names both players, each active enemy's stable ordinal, its current phase
and locked player, active slowing/freezing, and every relay's shield/anchor state.
The list uses the validated run; it never changes targeting, clocks or geometry.
Enemy ordinals follow the existing stable runtime ordering, not distance from a
player. Existing on-board warning lines still identify locked destinations.

Back returns to the same Field details action in Pause. Resume remains explicit.
Once admitted, the strip and list remain available for that attempt even when
reflow or a changing phase makes the canvas labels fit again. This keeps focus
and board space stable. Resizing during reading retains the same focused reader,
frozen state and complete list. A new attempt has its own admission;
terminal results and returning to setup clear the old list. The full list is not
a live region. A separate polite notice announces overflow once per attempt and
does not replace life-loss, rescue or other existing messages.

The strip occupies a separate row in the board's center slot, outside both seats'
controls. Existing 2:1 canvas sizing and 44-pixel control floors remain in force.
This is a recovery presentation for dense content, not a claim that all custom
maps can fit every text plate simultaneously inside a small arena. The painter's
`unplaced` and `visible-fallback` diagnostics remain truthful.

Focused evidence includes a genuinely imported, schema-valid arena with the
supported maximum of 16 enemies and eight relays. The real host and painter
produce overflow at a modeled 212 CSS pixels; all 26 entity rows remain available.
Tests cover one-action paused reading, held controller Confirm, return focus,
retained state after resize, explicit Resume, no repeated announcement writes,
critical-message preservation, teardown and setup cleanup. Pure model checks
preserve exact source state and exercise warning targets, slowdown expiry and
locale changes. These modeled checks do not establish native glyph/layout,
physical-controller, touch hardware, performance, production or public-release
acceptance. Existing artwork approvals and publication state are unchanged.

## Functional cue language

Hunter target-lock and contact-rescue captions use compact EN/UK templates from
the same locale authority as Field details. Both retain their target number;
contact rescue adds only the validated floored percentage, while legacy role-only
presentation omits progress. The compact slowdown marker remains attached to the
same warning. Language repaint preserves the complete attempt and uses the existing
cue packer and readable minimum sizes. See [the scoped source and layout checks](verification/team-cue-localization-20260929/README.md).
