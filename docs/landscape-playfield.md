# Short-landscape playfield layout

Status: development candidate, not released or ready for release.

The complete arena must remain visible while chosen text sizes and steering controls
remain usable. On short landscape screens, keyboard/controller layouts place the
four counters beside the arena. Direction-only touch layouts instead reserve a
left- or right-hand steering rail, put three counters above the field and place
score in a short second row. Menu, fullscreen and Pause remain available.
Layouts with authored manual abilities retain their existing arrangement pending
separate verification; this is not complete Tactical or physical-touch acceptance.

Microsoft's [text-display guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101)
recommends configurable readable text throughout the HUD and menus. This design
reflows the chosen text size rather than reducing it to make space. Guidance was
reviewed on 2026-09-21; this is not a claim of full XAG compliance.

## Evidence and unresolved work

[Keyboard layout evidence](verification/landscape-playfield/result.json) separates
Large/Plain and Standard/Theme checks. The touch iteration retained a real failure:
at 521×300 the document fit but the clock text was clipped. Its
[correction](verification/landscape-playfield/touch-r2.json) checks painted text
bounds, not just document width. The full board and 192px steering pad have a 12px
horizontal gap. Screenshots were inspected inline; no screenshot file is claimed.

Finish first-flight and warning layouts, high-counter examples, pointer steering,
final source formatting and integration checks before releasing this candidate.
Physical touch comfort and controller use remain separate qualification gates.

The [third touch check](verification/landscape-playfield/touch-r3.json) removed an
unused selector and completed a pointer-directed cut at 521×300 (50%, 11,900
points, three lives). Rotation to 320×568 exposed an overlapping capture caption
and Up button with Large/Plain text and the large D-pad. The landscape candidate
does not change portrait rules; this observed portrait issue still needs correction
and verification before broad responsive acceptance. The viewport was reset, the
temporary tab closed and the preview server stopped.

## Portrait controls follow-up

The [portrait lane prototype](verification/landscape-playfield/portrait-r1.json)
fixes the observed caption/Up overlap for compact Arcade with visible steering.
Its grid reserves separate HUD, complete arena and two-line caption rows above
the touch pad. A size container fits the canvas into the available arena row while
maintaining its authored aspect ratio. First Flight and authored Tactical controls
retain their existing paths pending dedicated work. This is an incremental
implementation, not complete responsive support.

The actual 320×568 Large/Plain test now has an 8px gap between caption and the
192px D-pad. At 390×844, a pointer-directed loss, fresh input after recovery and a
50% capture were observed. A separate explicitly labelled
[counter fixture](verification/landscape-playfield/counter-stress.html) checks
99 lives, a 99:59 clock and a nine-digit score. It exposed target-text wrapping;
reserving counter space and preventing the target from wrapping corrected it.
These fixture values are not a real campaign result. The legacy small life-count
text remains a readability follow-up.

Container sizing follows [MDN's container-relative length guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#container_query_length_units),
reviewed on 2026-09-21. Unsupported engines retain the previous layout through
`@supports`; they are not claimed as passing this correction. Finish the remaining
rows in the evidence record and qualify the final integrated source before release.

The [final CSS continued-flight check](verification/landscape-playfield/portrait-r2.json)
uses the final counter reservations at 320×568. The complete 2:1 arena remains
188.03125×94.015625, all four directions and counters are visible, pointer steering
and explicit Pause work, and the tab reports no warnings/errors. This continued an
earlier earned cut; it is not another win or physical-phone certification.

## Next responsive review

Apple’s [handheld game interface session](https://developer.apple.com/videos/play/meet-with-apple/243/)
recommends separately anchored interface components, safe-area-aware controls,
readable type and comfortable touch targets, with real-device testing. The next
check must include 320×480 and large-text/large-pad combinations: fitting the
canvas without clipping is insufficient if the remaining arena becomes too small
to read threats. Do not silently shrink the player’s chosen text or controls to
claim a pass. This lower-height concern is an inspection finding, not yet a native
measurement. The 320×568 evidence does not certify all portrait sizes.

## Short portrait directional row

The [320×480 regression](verification/landscape-playfield/short-portrait-row-r1.json)
confirmed an unreadable 12×6 arena with Large text and a large cross-shaped pad.
Through 620 CSS pixels in portrait, compact Arcade D-pad controls now use a row
while retaining each selected button size (64px Large, 52px Regular). The actual
320×480 board is now 268×134; at 320×568 it uses the full available 296×148.
Taller screens retain the cross. No character, collision or timing scale changes.

The row also required input adaptation: its buttons are labelled directions rather
than radial sectors. Sliding through a gap retains the previous command; release
still does not stop flight. The new tests fail four cases against old radial input.
The complete touch-steering and row cohort passes 19/19 on Node 20 and Node 22.
Actual pointer play opened a 1.4% cut for 340 points; this is not a level win.

Breakpoint verification records actual CSS dimensions because the browser was at
90% scale during the 620/621 checks. Requested sizes alone are not acceptance.
The final support-guarded stylesheet also passes the explicit high-counter native
fixture at actual 320×480 (99 lives, 99:59, nine-digit score). Other control
preferences and remaining authoring modes still require qualification.
