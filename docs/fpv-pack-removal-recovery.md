# Pack removal and exact recovery

Removing an installed world now opens a review before changing the library.
It identifies every active and retained revision being removed, affected
recordings and pins, saved/open playlist references, the next bookmarked entry,
the interrupted flight and an open Creator draft. Cancel is the initial action.
Unavailable dependency storage is reported as unavailable rather than zero.

The review can export each exact revision without activating it and prepare
bounded recording backup parts. Exports are checked against the original full
pack hash. If a legacy or noncanonical archive cannot be reconstructed exactly,
the player is told to retain the original `.rlpack`; a different archive is not
offered as an exact recovery copy. Download preparation does not confirm that
the browser saved the file. Recording backups do not contain interrupted flights.

Confirmation removes the pack and all retained revisions atomically using the
generation shown in the review. A concurrent library change invalidates that
choice, refreshes the review and requires another deliberate confirmation.
Removing a dependency used by an open flight requires closing that flight first.
The independent recording/session store, playlist order/bookmarks and open draft
are preserved. A draft still needs an explicit export before leaving the editor.

Library records distinguish past verification from current dependency
availability. Missing playlist entries and interrupted flights identify their
required full revision and offer an exact-pack picker. A different revision is
rejected without installing it. Reinstallation preserves the inspected pack's
identity and the current draft; it never arms a flight or advances a playlist.
Editable project ZIP imports retain the existing Creator workflow.

## Verification and boundaries

Functional browser qualification uses isolated real IndexedDB, the production
host and actual rendering. It covers cancellation, stale review, exact exports,
bounded proof backups, retained evidence, wrong/exact restore and EN/UK layouts.
The final source browser run passes **90/90** checks, including EN/UK at
390×844 and 844×390, visible initial Cancel focus, controlled controller Back,
concurrent library changes, native transaction abort, unavailable impact reads,
post-commit refresh failure, exact restore and noncanonical export diagnostics.
The three completed recordings and three interrupted prefixes also replay
independently with identical final states. Thirteen preservation snapshots retain one
identical hash across the removal and restoration flow. See the
[source browser receipt](evidence/fpv-pack-removal-source-browser.json) and
[independent replay receipt](evidence/fpv-pack-removal-replay.json).

The fixture's first runs exposed two fixture-only issues: objects crossing frame
realms and ambiguous playlist navigation. The final run uses document-native
IndexedDB and visible, named controls; production validation was not weakened.
Packaged qualification is recorded separately after freezing the candidate.
No additional unit suite is introduced; coverage remains in H/R7. Physical
devices, user feedback and long-term browser retention are separate pending
acceptance items. Existing package and storage limits remain unchanged.

There is no new garbage collector, selective revision deletion, cloud backup or
portable interrupted-flight snapshot. Browser storage can still be evicted;
players should retain original packs and portable recording backups.
