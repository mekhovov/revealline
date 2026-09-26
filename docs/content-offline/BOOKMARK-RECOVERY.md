# Direct bookmark recovery

Package editions keep optional mode documents out of the Solo core. When a direct
bookmark or new tab requests a missing Versus or Team document, the edition worker
redirects to its cached `game/downloads.html` confirmation page. Asset requests
retain the consent-required response; source checkouts and frozen v1 releases keep
their existing behavior.

A small generated route bootstrap map also covers archived Solo bookmarks whose
HTML shell is already in core, and Versus routes whose document was downloaded
earlier. Before serving those documents, the worker verifies the known route's
snapshot in local storage. Missing or corrupt snapshots reach the same consent
page without a speculative fetch. Current Solo boot remains in core; unknown or
malformed route requests retain the host's existing error handling.

The confirmation validates the same-origin, same-edition, allowlisted mode URL
against exactly one generated destination record. It preserves opaque mission
identities and return tokens without decoding them. Unknown, duplicate or ambiguous
owners fail without choosing a substitute chapter. The original query is never
stored in the download checkpoint.

Opening the confirmation fetches no optional game files. It displays the exact
package's dependencies and remaining size. The player must choose **Download and
open**, or **Open requested mode** if already verified. Download completion checks
both the core runtime and the requested package before following the original URL.
Cancellation during verification cannot navigate. Back and Cancel return to the
cached Solo menu. After verification, packages are added to the matching active
edition's update selection under its existing lock, preserving broader choices and
the all-gameplay preference. Another active edition remains untouched. This flow
does not activate or migrate the installed launcher.

Bookmark downloads use a separate durable checkpoint derived from the selected
package IDs. They do not overwrite the player's broader gameplay selection or its
download ownership. Reopening the same bookmark reuses verified files and requires
fresh confirmation for any missing bytes.

## Current retention limitation

The main chapter removal UI does not yet remove independent bookmark checkpoints.
Those files therefore remain owned even when a bookmarked mode has not been played.
Complete played dependencies are also retained to protect saves, replays and earned
pictures. A dedicated bookmark-removal action and save-aware garbage collection are
still required before claiming exact reclaimed space for those downloads.

## Verification

`node --test game/test/offline-navigation-recovery.test.mjs game/test/offline.test.mjs`
passes 53 tests. The recovery regression follows a worker redirect to the cached
confirmation with outbound requests blocked, checks that there is no pre-consent
mode transfer, downloads through the real verified store after explicit approval,
preserves an existing broader gameplay checkpoint, then reopens the requested mode
while blocking outbound requests again. Separate tests cover external and sibling
edition URLs, ambiguous identities, opaque token preservation, cancellation during
verification, and immutable v1 behavior.

Physical installed-device and complete browser navigation testing remain separate
release gates; these focused tests do not replace them.
