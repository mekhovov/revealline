# Team Campaign Creator current input qualification

This receipt covers the bounded Phase 6 picture-only Team Creator workflow. The
final virtual-controller browser journey passed all four rows against the frozen
runtime committed as `dda49b3beabadce70253e6cbdc96680e686eb351`. Native keyboard,
actual OS downloads, physical controller input and video intake have separate
evidence boundaries below.

## Scope and changes

Before the fix, a standalone native-keyboard run used Tab eight times to reach
Generate, then Return. During generation the ordinary controls were disabled and
Cancel was visible, but accessibility focus fell to BODY. This is the direct
baseline browser observation. The other changes below came from source review
and focused host tests, not additional claimed pre-fix browser failures.

The Team Creator now uses the shared operation focus and review-reading helpers.
Async work owns a visible Cancel action; successful installation returns focus
to the real Open Team link only while the initiating foreground interaction
still owns it. The two review pictures have explicit bounded reading surfaces
whose Back action returns to their entry without approving the package.

Show installed packages opens an exact installed edition through its production
store validator. It restores the public gameplay fields, credits and verified
runtime pictures/videos. It does not claim recovery of private original images,
original picture descriptions or crop history. Reopened packages require another
explicit Prepare review and Approve before export or installation. Unchanged
re-review is expected to preserve the portable bytes exactly.

Open Team uses the existing Team landing. The fixture must explicitly open
Select Mission and focus the exact installed campaign's card without launching
it. There is no dedicated Team-to-Creator return route in this bounded change.

## Automated evidence

The final focused cohort passed **51/51** tests with no skipped or failed tests;
log `/private/tmp/team-creator-focused-20260929.log`:

```sh
node --test game/test/creator-team-host.test.mjs game/test/creator-team-studio.test.mjs game/test/creator-team-qualification.test.mjs game/test/creator-team-couch-import.test.mjs game/test/team-media-campaign.test.mjs game/test/team-installed-campaigns.test.mjs game/test/creator-operation.test.mjs
```

The new actual-host cases cover operation focus and cancellation, preserving
prior generated media after rejected/canceled regeneration, review/export during
storage denial, retryable installation, successful installation ownership,
installed runtime reopening with byte-identical export, explicit public edits,
retained raw metadata/custom names/video, and page lifecycle cancellation without
destroying a BFCache-returned editor. It also checks live EN/UK review/storage
text and truthful retained-video instructions. Existing tests cover deterministic routes,
media format/validation, installation/progress and Team intake. These finite DOM
and domain checks do not prove actual browser layout, native OS download delivery
or physical controller behavior.

The four manual JavaScript files passed ESLint. All six manual/evidence files
passed Prettier and `git diff --check`; Node 22 imported the current-case map and
confirmed the Team route/function registration. No materialized build or native
package was produced for this bounded fixture check.

The same strict media hydration correction was applied narrowly to the Picture
Creator fixture's before/after snapshots. Its existing retention assertions and
input journey are unchanged. That maintenance change does not re-date or replace
the previously recorded Picture browser receipts.

Independent review found no blocking issue. The default source collector admitted
**1,723 files**, and the Team Studio static graph resolved **122 modules / 408
relative import edges**, with zero manual fixtures or source drift. Receipt:
`/private/tmp/team-creator-default-closure-final-20260929.json`. This is dependency
closure evidence, not a materialized default build or computed-fetch audit.

All **14 editions** passed sequential in-memory compilation, normal size admission
and offline-manifest generation. The **835 captured inputs** and six compiler /
checker paths remained unchanged; input inventory SHA-256 was
`03b5de2c0dcd2fce0e75b97c68a320b83257a1f074adb8fe6ad3ed43be52ebf8`.
The largest output was DroneAid aggregate: **668 files / 66,782,345 bytes**, with
**326,519 bytes** headroom below 64 MiB. No manual fixtures entered these packages.
Receipt: `/private/tmp/edition-package-team-20260929.json`, with its full inventory
and compiler-capture siblings. These are working-tree captures while HEAD was
`fce0bb6ce8b8019b30d76e80cb53e05b51fed305`; the Team runtime changes were not yet
committed. No archive, installed offline run, native binary or publication is
claimed.

Subsequent attribution compared all **835 edition inputs**, **six compiler /
checker paths** and **122 Team Studio modules** against Git blobs at
`dda49b3beabadce70253e6cbdc96680e686eb351`: **852 unique captured paths matched**,
with no working-tree drift. All six files changed by that runtime commit also
matched separately. Receipt:
`/private/tmp/team-creator-commit-attribution-dda49b3be-20260929.json`. This makes
the earlier captured-source results attributable to the committed bytes without
claiming another compile or materialized package.

## Browser fixture contract

The case uses real standard-pad button pulses through production input owners.
It never focuses or clicks a tool target, calls a domain handler or sets location
to bypass navigation. Initial iframe focus establishes the test host. Actual
application links create the next document, where the runner reattaches its pad
and passive Blob observer without changing download behavior.

Four evidence rows require:

1. Canceled name, seed, picture-source and picture-fit drafts preserve their
   original values. Invalid campaign names, absent pictures and blank picture
   descriptions reject publication/approval while retaining assigned media.
2. Both review pictures decode at 1152 × 576; bounded reading reaches the bottom
   when necessary and Back does not approve. Separate approval exports a pack
   accepted by `importCreatorTeamMediaCampaign`, with two bindings, edited seed
   1, reversed template order and twelve verified difficulty/preset routes.
3. Install focuses Open Team. The exact installed row reopens through the UI,
   with empty private-source inputs. Separate re-review and approval produce
   a second real export with identical bytes, edition ID and SHA-256.
4. Idempotent reinstall and Open Team preserve the landing. Select Mission
   finds the exact installed card; selecting/focusing it does not launch. Back
   restores Select Mission. Existing editions, progress, media and browser
   storage values remain unchanged.

The new qualification package stays installed on port 8987. The fixture restores
only the pre-run Team mission-library session-filter value or its absence; this
is explicit test cleanup, not application input. It never clears a database or
removes user content.

## Final current virtual-controller browser receipt

On 2026-09-29 the in-app browser ran:

`http://127.0.0.1:8987/game/test/manual/authoring-controller.html?tool=teamCreatorCurrent`

All **four rows passed**, including the validation/cancellation, review/approval,
actual installed-package reopening, and real Team-library paths described above.
Both review pictures decoded at **1152 × 576**. Neither bounded review region
overflowed at this fixture viewport, so this run proves entry, reading ownership
and Back restoration but does not claim a positive scrolling distance.

The first actual export and the second export after UI reopening were identical:

- Campaign: `teamqacvhwwmns`
- File: `teamqacvhwwmns.rlteammedia`
- Size: **2,474,347 bytes**
- SHA-256 / installed edition:
  `bd3e3b3b74e83c9f3bd4ffac11432295865a044e541de4ffb6f795a82a95320a`

The browser production importer verified the two-picture bindings, edited seed,
reversed template order and all twelve completion routes. Install focused Open
Team. Reopening the exact installed row restored runtime content with empty
private-source inputs; explicit re-review and approval produced the same bytes.
Idempotent reinstall opened the real Team landing without starting a run.
Select Mission found the exact installed mission `teamqacvhwwmns-stronghold`;
Back closed the chooser, left gameplay stopped and focused
`coop-discovery-open`.

The final preservation checks retained **one pre-existing Team edition**, zero
shared legacy media references/still assets/assignments, and **one pre-existing
localStorage key**. There were no pre-existing sessionStorage keys. The Team
library session-filter key was restored to its pre-run absence by explicit
fixture cleanup. The new Team edition remains installed for inspection.

Both actual OS downloads were then validated independently:

- `/Users/oleksandr.mekhovov/Downloads/teamqacvhwwmns.rlteammedia`
- `/Users/oleksandr.mekhovov/Downloads/teamqacvhwwmns (1).rlteammedia`

They are byte-identical to each other and the browser receipt above. The production
`importCreatorTeamMediaCampaign` path passed both, including exact provenance,
two levels, seed 1, asset hashes and twelve legal two-contributor routes. Actual
`sips` PNG-to-BMP decoding scanned all **576 rows / 2,654,208 pixel bytes** of
each of the two **1152 × 576** pictures. Canonical production re-export also
reproduced the exact bytes. The downloaded files were retained unchanged.
Receipts: `/private/tmp/team-creator-virtual-download-first-20260929.json`,
`-second-20260929.json` and `-comparison-20260929.json`.

## Native keyboard and OS-download receipt

A separate final English journey ran with `&keyboard=1` in the passive fixture
frame. No virtual pad was installed. After URL setup, only actual unbound native
key presses and text typing were used: Tab to Run, Return, then Tab into the tool.
There was no pointer action, direct target focus, handler call or focus reset.

The complete supported journey passed:

- Blank-name Generate failed and restored Generate focus. The name was corrected
  to `Native Team September`, ID to `team-native-sep29`, and seed to 1.
- Escape canceled the first picture chooser with its input still empty. The two
  built-in Dawn Signal pictures were then assigned. Preparing review visibly
  focused Cancel during work and returned to the review.
- Each Read and scroll entry accepted native reading keys and Escape restored
  its entry without approval. The review did not overflow at this viewport, so
  no positive scroll distance is claimed. One mistaken Tab count reached a
  review Back control and then Sections; the journey recovered using only keys.
- Separate approval and native Return on Download produced an actual OS file.
  Install focused Open Team. Sections → Installed packages opened the exact
  edition `3676fa8f900d…`; public fields remained, and retained picture fit/alt
  controls were truthfully disabled. Fresh Prepare review, Approve and Download
  produced the second file.
- Idempotent reinstall focused Open Team. Native Enter followed the actual link;
  Tab reached Select Mission. Searching the visible campaign name returned its
  two missions. Tab selected the exact Relay pincer card without activating it.
  Escape closed the library and focused `coop-discovery-open`, with Start
  together unchanged and no gameplay started. Native search by the raw campaign
  ID returned no rows; the visible name was used. No extra controller join
  Confirm was sent in this keyboard journey.

Actual OS files, both retained unchanged:

- `/Users/oleksandr.mekhovov/Downloads/team-native-sep29.rlteammedia`
- `/Users/oleksandr.mekhovov/Downloads/team-native-sep29 (1).rlteammedia`
- Size: **1,181,281 bytes** each
- SHA-256 / installed edition:
  `3676fa8f900dfde88387bbfaf12b162f91f978774f47379a89f4d01fc86aec2b`

Both passed the production Team-media importer, two levels, seed 1, twelve legal
qualification routes and canonical byte-identical re-export. A full-buffer
comparison confirmed the two OS files were identical. Their two level bindings
share one PNG asset of **1,172,696 bytes**; actual `sips` decoding verified all
**576 rows / 2,654,208 pixel bytes** at **1152 × 576**. Receipts:
`/private/tmp/team-creator-native-download-first-20260929.json`,
`-second-20260929.json` and `-comparison-20260929.json`.

## Fixture correction and remaining boundaries

An initial real virtual-pad run passed the first three rows and completed exact
Team-card selection and Back, then failed its final fixture preservation check.
The fixture had incorrectly assumed a rich still-media storage shape on a fresh
Team-only origin. The production store correctly returned its generic managed
byte library. Both before/after snapshots now use the strict production
`hydrateStoredStillMedia` validator, and the fixture compares the complete
normalized document, including owners, assets, presentations, assignments and
retained references. Empty/generic, nonempty-reference and rich roundtrip checks
passed, followed by the successful fresh browser run above. This was a fixture
assertion failure, not lost installed content or a menu failure.

The final native journey was English. Final Ukrainian review text has automated
locale coverage but no separate final browser receipt here. Neither final review
viewport overflowed. Optional victory videos, timed in-flight cancellation,
gameplay, OS file-picker reimport and physical-controller/device input are outside
this picture-only receipt.
