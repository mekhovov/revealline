# Team responsive layout review prompt

Review the complete running Team screen at desktop, 1280×800 handheld, tablet landscape, portrait phone and short landscape. Use the actual game UI and real imported coverage and multi-stronghold maps. Exercise both touch pads with Regular/Large sizes, Standard/Large text and Plain/theme fonts. Measure the board, HUD, Pause, all direction targets, Boost and Support against the actual viewport; each action must remain at least 44 CSS pixels and outside playable cells. Fit the full 2:1 board without stretching or cropping. Account for wrapped status, objective and music credit rather than assuming fixed text height. Verify Settings preserves the attempt and returns to its actual opener; Resume remains explicit. Record actual measured dimensions and distinguish browser pointer, modeled input and physical touch/controller checks. Preserve originals, simulation and all existing imports. Do not report a requested but unapplied viewport as tested.

Review canvas cues at the actual resulting board width, including 212×106 CSS pixels with both pads. Count required captions before checking collisions; cover player identity shapes, contacts, locked targets, anchors/cores, one/both slowed Hunters, warning/charge/recovery, pause, reduced effects and active celebrations. Compact idle slowing replaces the generic Hunter title; active danger captions retain full wording plus the Help-labelled ↓ and the existing dashed slowdown ring. Wider boards keep both captions. Never shrink type, silently drop active warnings or accept missing required cues to pass geometry. Confirm cache invalidation after state, target, text or size changes and truthful overflow diagnostics. A saturated custom map still needs an explicit external readable fallback; do not equate a bounded packing search or synthetic glyph measurements with native-font or frame-time qualification. See docs/verification/team-cue-layout-20260929/README.md for this bounded regression and its open gates.

For admitted cue overflow, test the Field details action outside the board. It
must remain available for the attempt even when later cues fit, open the existing
paused reader in one action and retain all entity rows. Rotate while reading;
Back restores the action without resuming. Keep one-time overflow announcements
separate from loss/rescue status. Verify all entries on a schema-valid dense import,
then confirm ordinary clear boards add no extra action. See docs/team-cue-overflow.md.
Production/device review may be deferred explicitly; these source tests do not
turn visible-fallback canvas overlap into an approved layout.

When updating threat Help, select copy from the admitted Team edition. Explain
both travelling fronts only for impact editions; keep Legacy relay/hunter advice
exact. Verify active Start before Pause/reader assertions, both EN/UK and reversed
specialist assignments. No Help update may introduce fields into level recipes.
