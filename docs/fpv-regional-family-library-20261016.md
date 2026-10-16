# Regional Library family cards — source increment

This implements the approved Library discovery increment from the current FPV
plan. It is a presentation change, independent of the metadata-listing work and
the unresolved public storage failures.

## Design

The 24 current exact regional offers appear in ten explicit family cards. A card
shows its selected edition and one direct Fly or Download action. Native Versions
disclosures retain every offered edition and every retained saved revision,
including saved IDs absent from the current catalogue.

The default prefers a saved active pointer, then another saved edition, then the
first reviewed compatible offer in catalogue order. Choosing a display default
does not call activation, installation, removal or flight preparation. Explicit
Fly retains existing byte verification and disarmed preparation in the host;
explicit Download retains the existing installation behavior. A saved version is
not presented as a newly verified load before that existing check runs.

Family grouping uses explicit IDs rather than parsing translated titles, revision
names or hashes. The current Tropical, Railway and Canyon families each include
more than one exact world ID. Their removal operations retain the existing exact
world-ID scope and reviewed confirmations; grouping never broadens a deletion.
Unknown saved IDs form their own visible family with the descriptor's own EN/UK
label. All immutable pins, descriptors, source assets, course identities, physics,
package budgets and storage handles remain unchanged.

Native details/summary controls reuse the SIM's existing keyboard, controller and
calibrated-radio navigation. Closed edition rows are excluded by that adapter.
Disclosure state and exact-row focus survive locale changes and action repainting.
An exact failed load reveals its existing Repair action. Finishing an operation
does not reopen a drawer that the player has deliberately closed or move focus
back after the player has navigated away.

## Software verification completed

Node 20.19.5: seventeen new family/UI/navigation groups and six existing title/identity
regressions pass (23 total). The coverage includes:

- All 24 exact offers in ten families, catalogue order and unchanged pin objects.
- Active older saved defaults, unoffered revisions, unfamiliar IDs, and full
  ID-plus-hash matching rather than aliases.
- EN/UK labels, no implicit render/refresh mutations, exact Fly/Download actions,
  repaired loads, reviewed single-revision and world-ID-scoped removal.
- Focus and disclosure continuity, including a download completing after closure.
- Deferred metadata refresh selecting a different saved edition while a primary
  Fly is intended: keep the exact world ID, full hash and action in Versions,
  including radio/controller focus styling. Body blur preserves only that refresh
  intent; an explicit move to another control cancels or updates it. A missing
  Fly never becomes a Download or another edition's Fly on confirmation. If the
  retained family is no longer listed, focus returns to Refresh with an honest
  status message. EN/UK notices identify changed presentation or actions.
- The real SIM menu adapter's controller join/release/D-pad/confirm sequence,
  calibrated-radio hold-and-centre gestures, and skipping closed edition controls.

These tests use a deterministic minimal DOM and isolated metadata/store callbacks.
They do not fetch scenery, seed player storage, fabricate accepted flight progress,
measure native layout, or establish physical controller/browser support. The
minimal DOM permits disabled-control focus; that one deferred-refresh case tests
presentation ownership rather than asserting native browser behavior. Separate
cases model pre-existing focus becoming body focus while controls are disabled.
The regression first failed on the prior source with a disconnected active node,
then passed after exact focus ownership and refresh-only restoration were added.
Explicit install/remove focus behavior retains its separate existing coverage.

## Gates still open

Independent source review, exact-head CI, combined package qualification and native
EN/UK responsive/controller/touch review remain open. Native review must include
current/older saved editions, disclosure focus and removal review at the existing
portrait/landscape/handheld sizes and supported themes. Actual public delivery,
installation, reopen/offline/restart and physical-device acceptance remain
separate gates.

This increment does not fix or explain the public closing-database error or the
later zero-visible-saved-state observation. Preserve those negatives, original
player stores and the distinction between source, packaged and public results.
No browser/rendering or player-storage operations were used for this increment.
