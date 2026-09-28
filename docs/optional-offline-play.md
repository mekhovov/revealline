# Online play with optional offline preparation

Normal play must not ask players to install the app or download a chapter for
offline use. This supersedes the earlier package-consent-before-play policy.

- Solo, Versus, Team, company editions, navigation and saved-flight restoration
  use their existing loaders to request the content needed for online play.
- Opening a mission does not open Install & offline play, register an offline
  worker, prepare a full package, select the installed edition or download music.
- The service worker uses prepared official files when present, then tries the
  network for missing files. Ordinary online requests do not store a full official
  package or mark it ready offline. Unavailable browser storage cannot block a
  successful online response.
- Install & offline play remains a deliberate menu action with package sizes,
  confirmation, verified downloads, resume and optional soundtracks.
- Without a connection, only available local content can load. A missing file
  produces a normal loading failure rather than an automatic install dialog or
  redirect. Players may reconnect or choose prepared content.

## Cause and fix

The previous access helper checked the complete chapter's offline inventory
before preparing artwork or starting a mission. A missing file opened the
download dialog. Independently, the worker returned HTTP 409 or redirected a
bookmark to downloads instead of loading an uncached file from the network.
Company startup additionally required a verified controlling offline worker.
These requirements made an optional preparation feature block ordinary play.

Ordinary access now only attempts local retention for already prepared content.
This reads cached catalogue metadata, verifies the local files and uses the
existing ownership lock. It cannot fetch a catalogue or ask for package consent.
Missing or denied storage does not block gameplay; slow retention work is bounded
to one second and cancelled. User cancellation still cancels the pending start.
This best-effort bookkeeping is not proof of offline readiness or of retained
ownership when storage fails. The explicit downloader still owns preparation and
its verification; gameplay/content validators still own playable identities.

Company startup keeps navigation/background cancellation and the provider's
asset integrity checks, without requiring installation, core-cache verification
or worker control. The explicit offline access helper remains available for
callers that deliberately require a complete prepared package.

## Verification and delivery

Based on freshly fetched main `bb9b3640270dc26633d37cfdf4a306aecda277b6`.
The original checkout and the independent retention-recovery PR #755 are preserved.
This is a new product input; no competing version or publishing run is allocated.
Frozen published editions are unchanged. Players receive the behavior when the
fix is integrated and published in a new edition.

Focused checks cover online artwork/mode requests without automatic installation,
denied storage, company startup without a worker, Team starting without prepared
files, and explicit offline controls. Published-style Solo host tests cover an
unvisited chapter starting online, an unprepared saved flight restoring online,
direct Versus navigation, and a deliberately prepared/deselected chapter restoring
with its runtime and artwork requests blocked.

The final functional cohorts passed 91/91 and 6/6 respectively. These are source
and host-fixture tests, not a physical iPhone or public-release acceptance claim.
Logs: `/tmp/optional-offline-final.log` and `/tmp/optional-offline-solo-final.log`.
Repository validation, lint and formatting passed. Focused selector checks passed
27/27; the final cancellation check passed 4/4 and overlaps the functional cohort.
Logs: `/tmp/optional-offline-{validate,lint,format,map,cancel}.log`.
The earlier Solo fixture failure is retained in `/tmp/optional-offline-solo.log`:
the added online-restore case shared storage whose normal teardown migrated the
session envelope. Giving that independent case its own storage preserved the
existing exact-byte restoration assertions; no product save behavior changed.
No full local build was attempted with less than 1 GiB free. Integrated release
qualification and installed-device evidence remain required before publication.
