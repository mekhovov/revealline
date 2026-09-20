# Team controls on compact screens

The active Team arena uses the available landscape height after measuring its
actual HUD, objective and status rows. Both touch pads sit beside the complete
2:1 board. The layout applies to handheld-sized landscape screens as well as
short phones; fixed estimates of header height must not push controls below the
viewport. Pause, Settings and results keep their own scrolling layouts.

At landscape heights up to 360 CSS pixels, the directions use a familiar
arrow-key arrangement: Up above Left / Down / Right. Each direction remains at
least 44 by 44 CSS pixels. Boost and Support retain visible text and accessible
names; their decorative icons and the repeated centre number give way to space.
The persistent HUD still identifies both players with a number and name.
Direction nodes, keyboard bindings, controller assignments, held-button behavior
and the existing directional navigation order do not change on rotation.

The compact pads span the objective and board rows; the objective stays in the
board column. A single visible pad leaves the opposite side available to the
board. Standard-height controls keep the full cross. Action columns reserve
space for their complete labels, including Plain/Large text.

## Portrait play and compact action icons

Portrait gives the complete status its own full-width row, with timer and Pause
beneath it. The HUD, objective and pads reserve their actual sizes; the remaining
slot contains the whole 2:1 board. Territory, percentage and reserves share one
row without removing the progress bar's accessible Team territory name.

At heights up to 740 CSS pixels, each pad is a two-row, six-button group. The
upper row is Boost / Up / Support; the lower row is Left / Down / Right. Boost
uses its registered chevrons and Support its registered pulse glyph. Both retain
their full accessible names and native hover titles. Settings explains the
compact icons. Taller portrait keeps the labelled action buttons and full cross.
No touch target, input node, held-action behavior or steering binding changes.

Initial instructions use fewer words with the same guidance: wait for Hunter
recovery, bank small loops and join cuts only when that policy is enabled.
Detailed threat, terrain, Support and rescue instructions remain in preparation
and Pause Help. Hit causes and live rescue/recovery messages remain unchanged.

Test actual rescue warnings as well as a short Resume message. The initial
320×568 failure produced a 1,084-pixel document and scrolled the board out of view.
An intermediate text-only pad made a rescue-state board too small; the final
compact glyph pad preserves room for the field without hiding the warning.
Physical two-player reach, icon recognition and game balance remain separate
qualification work; passing bounds alone does not establish those outcomes.

## Qualification and maintenance

The correction was prompted by native 568×320 Plain/Large observations: the
old pads overlapped the objective and status, and an attempted Pause click hit
Player 2 Support. A separate 1280×800 check found controls below the viewport.
The CSS candidate is source-only until the next release completes its gates.

Review both First Connection and Relay Yard at 320×568, 375×667, 568×320, 844×390, 390×844 and
1280×800. Use Standard/Theme and Large/Plain text, touch Auto/Show/Hide, and
one-player controller assignment where hardware is available. Measure every
visible target and test the hit location, rather than accepting a screenshot
or the absence of document overflow alone. Verify the full objective and live
status, readable action labels, an unstretched 2:1 board and an unobscured Pause.

Start, Pause, rotate, open/close Settings and Resume explicitly. Retry → Stay
must retain the clock, reserves, board and exact Retry opener. Confirmed Retry
must retain the arena and picture. Exercise downed/rescue/Support states and
long status messages. Preserve source-only, native browser, touch emulation,
physical device and controller evidence as distinct categories. A layout check
is not a victory, campaign, performance or full accessibility qualification.

AI maintenance prompt: “Change only Team layout and its documentation. Keep the
same input nodes, bindings, gameplay and artwork identity. Reproduce overlaps
before editing; then record viewport/document dimensions, target sizes, label
fit, board ratio and hit testing for both arenas. Prove Pause and explicit
Resume after rotation. Do not remove warning meaning, hide status or reduce global text size to
hide a layout failure. Qualify the exact committed source before publication.”
