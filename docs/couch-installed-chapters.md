# Installed original pictures in Couch

Couch starts with the shipped **Pressure Lines · Arcade** chapter and its wide,
contained originals. **First Signal · Tactical** remains an explicit choice. A
race uses the selected chapter's authored controls, dimensions, class and world;
Couch does not convert Tactical missions into Arcade missions.

In **Race setup**, the map selector also lists installed maps from this exact
profile channel. Use **Chapters** in Versus to download and play entries from the embedded
chapter catalogue directly. External chapters still need installation or recovery
through Solo; their authenticated installed maps appear after **Refresh installed
chapters** here. Refresh preserves the selected owner. It
never chooses a different chapter, starts a race, or resumes the solo flight.
An unavailable selected chapter stays unavailable until it is repaired or the
player explicitly chooses another map.

Selecting an installed map checks its pack and, for external chapters, its descriptor
and authenticated originals. Both installed formats use the same exact-owner picture
policy as shipped maps: an existing saved choice first, then an eligible approved
release image, otherwise the validated authored original. Start
stays disabled until the picture is ready. Both boards borrow that one image;
they still have independent core states, directions, lives and results. An
explicit Start rechecks the prepared ownership snapshot before the first tick.
Pausing retains the accepted image and each player's continuation. Rematch and
Next round prepare and confirm a new race while retaining Results. The original
activation starts it only while it still owns the foreground and focus; otherwise
the prepared race waits for an explicit Start.

Back cancels pending picture work. **Retry chapter picture** retries the same
selection without starting it. Retry and Refresh return focus only while the
initiating control still owns that interaction. A newer selection, Back or user
focus movement prevents an older completion from moving focus. Terminal page
exit disposes images and object URLs; a persisted pagehide pauses the race and
retains its owned pictures for the browser's back/forward cache.

## Read-only authority

`game/couch/couch-installed-chapters.mjs` uses the existing chapter host's checked
snapshot, authored-picture and current-snapshot operations. It uses read-only DB4 readers
and owns one accepted image binding. It does not acquire a profile writer
lease or expose installation, recovery, replacement, progress, saved-attempt,
Collection, story, backup or media-edit operations. A first database read may initialize the existing schema; this is not a promise
of zero IndexedDB schema writes. No profile or content mutation is requested.
The external host, pointer
store, media store, descriptor registry, identity readers and core are unchanged.

The same raw development or release version channel used by solo selects the
pack/index keys. A URL path is not a new namespace. Channels such as
`release-v0.37.0` and `release-0.37.0` remain distinct. The DB4 database is shared,
but a chapter's full descriptor and exact original owner determine its picture;
matching a level name or world alone does not permit borrowing another picture.

The adapter serializes and joins cancelled authority operations. It checks the
pointer/index/journals and media generation after decoding, and repeats the
snapshot check before Start. Closed, stale, missing or corrupt originals produce
a visible failure and a disabled Start; compact pack JSON is not a replacement
for original bytes. A decoded image already held by a paused race is retained
until that race is replaced or disposed, even if another page changes storage.
Existing saved attempts and first-earned identities are not rewritten.

Embedded packs retain their original bytes and fitting metadata. For a fresh
attempt with no explicit saved assignment, an exact approved baseline may select
the current release derivative, as Solo and shipped Versus do. Changed custom
artwork does not qualify merely because its level ID matches. An unavailable
optional presentation snapshot retains the authored original; once a release
image is selected, missing/corrupt bytes or decode failure blocks Start and cannot
silently switch the image. When neither a saved choice nor an eligible release
picture is selected, an authored map without a background keeps an explicitly
empty authored binding.

External chapters authenticate every descriptor original before choosing the
picture displayed by both boards. That readiness proof and the accepted picture
are separate: an explicit current assignment wins, including a historical
presentation revision. An unassigned compatible owner may use the approved
release picture; otherwise its authenticated descriptor original remains visible.
A valid alternate picture never excuses a missing descriptor original.

An external race captures its immutable picture decision after chapter readiness
and before selected-image acquisition. A failed or cancelled decode and an explicit
Retry keep that decision. Retry obtains a new authenticated metadata snapshot so
it can reopen the exact retained revision even after a later assignment changes;
it never substitutes that newer assignment. Missing retained revisions or bytes
fail visibly. Conversely, Start on an already prepared race rejects intervening
media-generation changes and retains its displayed image for recovery. Optional
release loading can fall back to the descriptor original with a notice; failure
of a selected required release picture cannot fall back. Prepared release
snapshots must still match the current presentation page at confirmation.

Each in-memory race owns its captured picture decision. Retry reuses that decision
and checks current metadata rather than silently reading a newer assignment.
Preparing Next holds the accepted Results image through verification and failure.
Confirmation alone cannot adopt the candidate. Commit publishes it, then the host
explicitly retires the prior image. Cancellation/disposal release only their owned
images and object URLs; neither board owns a separate decoder or assignment.

If a successor is cancelled, retrying the still-accepted race restores that race's
request before releasing its image. Embedded readers retain their existing strict
metadata fence: a changed media generation requires setup again. External readers
reopen the captured revision against a new chapter-readiness proof. The cancelled
Next/accepted-Retry regression establishes the reader API contract; it does not
claim that this sequence is currently reachable through a native Results button.

The shared resolver is provided through the host's prepared presentation page.
It remains a consumer: do not materialize release assignments, modify originals,
or acquire a Solo writer in Couch. Storage schema initialization is distinct from
player/media mutation.

## Focused validation

The focused tests exercise the real original payloads, chapter host, shared media
metadata, native-transaction model and Couch host/core/input adapters. They check
owner rejection, post-decode metadata drift, pointer drift before Start, missing
index/originals, joined cancellation, shared board images and independent motion,
no solo writes, and asynchronous Retry/Refresh focus. The IndexedDB and image
boundaries are finite test models; browser storage durability, actual image
rendering and physical controller behavior need separate native observations.

Run with the project's supported Node runtime:

```sh
node --test game/test/couch-external-picture-parity.test.mjs game/test/couch-installed-release-parity.test.mjs game/test/couch-installed-chapters.test.mjs game/test/couch-static-pictures.test.mjs game/test/couch-static-picture-host.test.mjs
```

No site build, publication, runtime adoption or qualification of every installed
mission follows from these focused checks.

The exact R5 Orchard Crossing regression compares selected bytes through Solo's
flight/default/materialization modules, shipped Versus and the installed reader.
It covers the available/unavailable presentation snapshot separately from the
existing missing shipped-pack URL recovery journey. It also checks saved-choice
precedence, altered authored art, stale metadata, failed/cancelled Next, same-race
Retry, explicit retirement and no Couch writes. Exact pack/PNG bytes are real;
image decoding, IndexedDB scheduling, locks and host DOM remain modeled. Qualify
actual decoding, both-board rendering, native input/focus, offline and immutable
public behavior before accepting the release or the broader P08-A phase.

The external regression installs the real authenticated pilot, applies Solo's
actual fresh-install picture defaults, and compares selected SHA, geometry, fit
and sampling with installed Versus. Its alternate release fixture deliberately
reuses different authenticated pilot originals; it does not certify production
artwork quality. The actual Couch host must pass the same selected binding to
both boards through ordinary selection and explicit Start. Descriptor readiness,
historical revisions, failed/cancelled Retry, stale Start and staged Next are
qualified independently. These focused source checks leave native decoding,
all-edition coverage, offline and public release acceptance outstanding.
No-mutation checks observe attempted puts and all completed readwrite transactions,
including delete-only mutations; deliberate fixture edits precede each consumer
baseline. Schema initialization remains a separate storage responsibility.

## Complete source artwork inventory

`game/test/cross-mode-art-inventory.test.mjs` enumerates all 51 built-in map/theme owners through the actual current release snapshot and immutable production ledger, comparing Solo selection with the static Versus reader. It requires reviewed production status for selected release images and explicitly distinguishes 15 FPV release pictures from 36 intentional First Signal procedural scenes. Procedural records must retain the complete authored theme and level plus the exact source and contract hashes. The same test inventories all five optional embedded packs (15 missions) and all 16 registered external chapters (48 missions), checking exact owner/revision, original bytes, image headers and release categories. External source PNG readiness is not an installed database proof; the existing external-host parity tests separately require authenticated descriptor originals even when an alternate release picture is selected. These source checks do not establish native image decoding, all-map playability, physical devices, offline durability or public-release acceptance.
