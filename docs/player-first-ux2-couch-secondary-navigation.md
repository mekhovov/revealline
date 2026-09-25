# UX2 Couch secondary-navigation parity — draft

## Scope

This unversioned draft completes the smallest remaining Couch navigation slice on
top of current `origin/main`. It does not own a release, tag, archive-selector
change, or publication.

- Versus exposes **More** beside the primary lobby utilities. Home, About &
  credits, and Releases no longer require opening How to play first.
- Versus Back closes More and restores the More opener. Live-match departures
  continue through the existing discard guard and restore the exact selected
  destination when the player stays.
- Team Pause exposes quick Sound in the direct Resume, Retry, Missions, Help,
  Settings, Sound, Home hierarchy. Changing Sound while paused does not resume
  or advance the arena.
- Start retains initial focus and optional setup remains collapsed. The More
  disclosure keeps a minimum 44 CSS-pixel touch target.
- Controller Confirm for these controls uses the existing Steam/native-confirm
  guard. This is the same runtime correction owned by the current UX0 release
  lane and should collapse during reconciliation after that lane lands.

## Focused automated evidence

The focused Couch navigation run passes 4/4:

- Versus More is reachable by keyboard Enter/Escape, Tab, modeled D-pad/Confirm,
  and DOM-modeled touch.
- Back restores the More opener.
- Home, About, and Releases preserve a paused match until the player makes a
  separate discard decision; Stay restores the exact destination opener.
- Team Pause exposes Sound directly; toggling it preserves the paused clock.

This evidence models controller and touch input in the host harness. It is not a
physical controller, Steam Deck, or touch-device qualification.

The complete shared Pause contract passes 2/2. The complete Versus shell file
passes 24/25 on the untouched base plus this draft. Its remaining case expects a
native Confirm immediately after a modeled controller lifecycle; the current
base leaves the match paused. That boundary belongs to the active player-input
release lane, whose activation hook this draft temporarily shares. No production
or test assertion was relaxed to hide the dependency.

## Known integration blockers

Current main compiles the FPV presentation at revision 82, while the Team
starter-picture registry accepts current revision 79 and retained revisions
58–78. The ordinary Team route therefore reports that no exact picture binding
exists. The focused Pause test deliberately loads the last accepted exact
revision 79 binding; it does not relax or bypass the production resolver.
Revision-82 picture registration is a separate release blocker.

The controller activation hook overlaps the current player-input release lane.
This draft must be rebased after that lane lands, then its exact remaining diff
and focused evidence must be rerun before versioning.
