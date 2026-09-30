# RevealLine — consolidated soundtrack master plan

Updated 1 October 2026. This is the durable source of truth for all soundtrack
work. It replaces the separate conversational plans without removing completed,
blocked, rejected or deferred requirements. The user approved implementation of
this consolidated plan.

PR #643's detailed historical snapshot is preserved in
[the dated history file](history/core-soundtrack-expansion-pr643.md), including research leads
that remain available for later revalidation. Active work follows this master plan
and the current publisher's protected-main, automatic-Pages policy. Independently
ready batches can ship without waiting for unrelated content or historical releases.
Earlier aggregate-release holds below are historical, not active dependencies.

## Plan maintenance and status rules

Each M0–M11 item keeps its ID, status, dependency, next action, effort estimate,
PR/evidence and released version. Update this document after each meaningful
milestone; append decisions and history instead of replacing the plan with the
latest subplan. Archive publication, rights clearance, musical approval, game
admission and public game verification are separate states.

A track is delivered only after admission, a published game source and direct
public verification. Current releases use protected main merges and automatic Pages
deployment; immutable historical editions remain preserved. An MP3 preview or a
passing transport test is insufficient.
Keep historical immutable files and failed/partial evidence. Never manufacture
reviewer names, listening approval or device results.

## Current priority — licence separation, 1 October 2026

The user's latest direction supersedes main-archive availability of recordings
labelled unknown, including uploader-confirmed entries. It does not change the
licences themselves or turn a source link into licence evidence. Previous Synth/
Metal priorities remain queued behind this scoped separation.

### Phase 1 — remove unlicensed recordings from the main experience

**In progress; not yet deployed.** Audit of canonical source `9cc5274` finds
**73 unknown-licence recordings / 207,941,311 audio bytes**, all currently in the
normal public list. There are no additional missing-licence rows in this snapshot.
The resulting licensed catalogue will contain **188 recordings: 123 normal-public
and 65 existing review-only**. The trusted game catalogue's 77 records are unaffected.
The [pre-change preservation inventory](verification/soundtrack-unlicensed-exclusion-20261001.json)
binds every excluded ID to its exact audio hash, size, source and unchanged licence.

- Exclude unknown/missing licence records from the deployed catalogue, public
  search/playlists, direct track selection and review views, not only default shuffle.
- Exclude their MP3s from the main Pages payload. Project legacy metadata using
  canonical identities/hashes: seven older TRENCH ORDERLY entries still have
  superseded CC0 labels and must not bypass the corrected unknown status.
- Preserve licensed legacy installer endpoints, every licensed recording identity,
  local uploads and existing saved player data. The game filters excluded remote
  entries without rejecting the valid remainder of a mixed catalogue.
- Retain source/history and existing immutable GitHub Release assets for phase 2.
  This is removal from the main site and current game, not a purge of public Git
  history or immutable releases. A new unknown-licence intake must not silently
  publish audio back into the main archive.
- Create scoped archive and game PRs with regression coverage and independent
  review, then record actual deployment/public acceptance separately.

**Estimate:** one working day for implementation, regression checks and both PRs;
CI and the sole game publisher's queue are additional. The decisive checks are
no excluded rows in the deployed JSON, no excluded Pages objects or legacy alias
bypass, safe game filtering, and intact licensed playback/installer metadata.

### Phase 2 — separate FPV archive and explicitly added music sources

**Next, after phase-1 PRs are prepared.** The requested destination is
`mekhovov/revealline-soundtracks-fpv` with Pages at
`https://mekhovov.github.io/revealline-soundtracks-fpv/`. The repository did not
exist at this audit. Preserve all 73 original recording identities, bytes,
artist/title/source data, styles/collections and honest unknown licence labels;
do not relabel them as CC0 or infer additional permissions from relocation.

The game will allow the player to explicitly add a compatible catalogue URL,
choose that source alone or mix enabled sources, and derive style options from
the active catalogues. The main catalogue remains the default; adding a separate
source must not re-enable those recordings there. Source-scoped policy, bounded
HTTPS catalogue validation, duplicate identity/hash handling, saved source choices,
independent failure recovery and mixed-queue behavior need their own regressions.
User MP3 upload and existing library formats must remain intact.

Prepare the separate repository and migration through exact-hash inventories and
hosted byte-copy verification; local disk is about 3.7 GiB, with the existing 1 GiB
reserve still enforced. Switch current ownership/intake references only after the
new site serves verified files. Preserve historic references and immutable evidence.
**Estimate:** 1–2 working days for migration plus 1–2 days for configurable-source
integration/verification, excluding CI and publication queues; refine after phase-1
review. This is separation of the already-published collection, not a restart of
the skipped broader UA-FPV sourcing/clearance milestone.

The 30 September checkpoint below is retained as history. Its counts describe the
pre-exclusion public state and must not be presented as phase-1 delivery evidence.

## Previous execution checkpoint — 30 September 2026, evening

**M5/M6 are the active priority: Synth and Metal.** The first six-track batch is
now merged and publicly available. [Game PR #830](https://github.com/mekhovov/revealline/pull/830)
merged at `ef997643d1cd84cf93282feaf6f83815ae0ad8d7` on 30 September at 08:56 UTC.
The trusted game catalogue contains **77 recordings**, preserving all previous
71 identities and files. Players can choose **Synthwave & Electro — approved**
or **Metal — approved** in Music library & playlists, or include the tracks through
Audio's style controls.

At the 30 September evening audit, accepted main and the public release marker both
identify `09a43d83351af276f184293ed3c72261575ed8bc`
(`main-09a43d83351a`, package label 0.142.4). Automatic
[Pages 36759567741](https://github.com/mekhovov/revealline/actions/runs/36759567741)
passed. The public catalogue JSON/JavaScript match this accepted source exactly.
This is a metadata/deployment check, not a new browser or listening qualification.
The earlier 908bc6 and 5e23fa8 delivery/transport receipts remain historical evidence.
The plan-review branch starts on this accepted main without conflicts; merged PRs
are not rewritten. See the [dated audit receipt](verification/soundtrack-plan-review-20260930.json).

**Three counts describe different things:** the canonical archive preserves
**261 recordings**, of which **196 appear in its normal public lists** and
**65 are review-only**. The game has **77 trusted catalogue recordings** plus
dynamic access to eligible public archive recordings. The 77 are not 77 extra
files on top of the archive, nor are all 77 bundled into the game download.
Publishing an eligible archive entry makes it discoverable for streaming without
a per-song game release; standard game-album admission is a separate curation step.
Recording mode and user filters can further reduce the playable selection.
Review-only URLs are discoverability controls, not authentication or private storage.

### Completed platform work — no rebuild required

| Area                                       | Delivered behavior                                                                                                                                       | Qualification boundary                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M0 / M1: catalogue and delivery foundation | One canonical repository/site; preserved recording identities, rights and migration evidence; automatic archive discovery in the game.                   | Old numbered repositories remain for historical clients; deletion is not qualified.                                                 |
| M2: opening music                          | The approved Shchedryk metal arrangement is bundled, with title/artist/source and saved mute/selection intent preserved.                                 | Full/repeated listening and cultural/device acceptance remain separate; Content ID excludes it from Recording mode.                 |
| M3 / M8: player controls                   | Top-level Audio transport and styles, Previous/Play/Pause/Next, B/N shortcuts, mixed archive/bundled/uploaded queues and bounded media-failure recovery. | Desktop/software evidence exists; physical iPhone/controller and cold-offline acceptance is deferred.                               |
| Archive browsing                           | Search, style/artist/collection filters, clickable metadata, shareable URLs, shuffle/order/repeat and same-page playback.                                | Hidden/rejected recordings remain outside normal queues.                                                                            |
| Creator and storage tools                  | Local uploads, playlists, offline albums, rights-aware exact-byte backups, CLI file/folder intake, browser intake packages and PR publication.           | The whole-CLI interrupted-intake resume gap below remains. An unknown licence is not converted into an open licence.                |
| External-URL implementation                | CLI/web URL metadata, validation, delivery inventory and archive/game playback support are implemented.                                                  | No real external object has entered the published inventory yet; end-to-end external-host proof remains.                            |
| M5 / M6 first admissions                   | One Synth and five Metal recordings added through PR #830; public album/transport evidence retained.                                                     | Revenge's Waiting is a 48-second boss cue, not a full-length gameplay composition; broader listening/device checks remain explicit. |

These delivered features are preserved while completing the smaller remaining
steps below. A change in catalogue size is not evidence of new compositions or
completed human listening review.

### Completed and verified in this batch

- Admitted **Retroracing Nightlife**, **Agony Space-deep**, **God of Darkness**,
  **Suffocation**, **Pixel Damnation** and **Revenge's Waiting**. All reuse the
  existing immutable MP3s, exact hashes, credits and licence records.
- Public catalogue JSON and generated JavaScript match accepted main exactly.
  All six recording URLs return valid byte ranges with the expected file sizes
  and public CORS headers. The pinned seven-object admission inventory is intact.
- Desktop browser checks reached both approved albums, advancing playback clocks,
  switching between them, and Previous/Next while music remained intentionally
  paused. These observations are not a physical iPhone, full listening or
  cold-offline qualification. The detailed receipt records the separate audio
  preference anomaly observed during testing.
- The current root, canonical archive and task checkout were audited. The earlier
  unpushed combined audio tip remains preserved on GitHub. Historical dirty
  worktrees contain already-preserved material and were not reset or deleted.
  Spatial and Demo work has since merged through its owners' separate PRs.
- Local free space recovered to approximately **16 GiB**. The 1 GiB floor and
  bounded production rules still apply; no user files or historical evidence
  were deleted by this task.

PR #830's exact-source focused checks and release-ready gate passed. Broad
shards/build jobs skipped under the current release policy are **unverified**,
not successful tests. Its earlier blocked production review stays preserved as
historical evidence. The shared provenance gap remains tracked in
[issue #813](https://github.com/mekhovov/revealline/issues/813); public deployment
does not retrospectively approve old fingerprints or pending listening checks.
See [the public verification receipt](verification/soundtrack-public-20260930/README.md).

Archive [PR #65](https://github.com/mekhovov/revealline-soundtracks/pull/65)
merged as `4c3bda6a8f796373f4840aa84a84e78ae65c8882`; automatic Pages
[36745624857](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36745624857)
passed. The complete public runner2088 game mix matches its expected
3,887,378 bytes and `528e7ebe…c672ba` hash; the original remains byte-identical.
A browser started the review-only MP3 and advanced to 8.10 / 97.12 seconds without
a media error. An exact-derivative approval question is pending; it does not hold
the already shipped six-track batch or the evidence/plan PR.

### M6 next batch checkpoint — 30 September 2026

Prepared [`metal-next-20260930`](../authoring/library/soundtrack-batches/metal-next-20260930/EVIDENCE.md)
as a **pending metadata-only batch**: Solar Storm, Galactic Battle, Orbital Assault,
Mutilation's Melody, Bone Grinder's Ballad and City Limits Crash. These six public
recordings follow the accepted direction; their exact-file musical approval is
not present in the retained evidence. The Slicing Strain is review-only and excluded.
The trusted catalogue remains **77 recordings**; this checkpoint admits none.

Six unchanged creator/licence observations and three historical FFmpeg 6.1.1
receipts bind the exact native OGGs and published MP3s. All six retained final
measurements meet −16 ±1 LUFS and ≤−1 dBTP. Fresh complete public responses matched
all six hashes and **32,042,683 bytes** without saving or rendering audio. This is
identity/transport proof, not new listening or device acceptance.

[Archive PR #67](https://github.com/mekhovov/revealline-soundtracks/pull/67)
published the separate six-object admission inventory after 69 passing tests and
independent review. Merge `9cc5274ad0675d1411a12c16bb83ede3546889e3` passed
[Pages 36750444819](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36750444819).
At 17:23 UTC its canonical URL returned HTTP 200, 1,383 bytes and the expected
`9e92ce27…4c560` hash with public CORS. The earlier 404 is preserved as preparation
history; [the publication receipt](../authoring/library/soundtrack-batches/metal-next-20260930/inventory-publication.json)
records the completed delivery. No catalogue entry, recording bytes, approval or
default changed in that archive PR.

Next: obtain an explicit decision for these exact recordings or a selected subset,
then use the existing owner-approved contract while preserving all deferred
listening/device checks. Source-described energy/scene assignments, vocal/explicit
content review and Content ID uncertainty stay visible. This batch has no game
release version until admission and public game verification.

### Intake reliability checkpoint — 30 September 2026

[Archive PR #66](https://github.com/mekhovov/revealline-soundtracks/pull/66)
fixes the draft-audio failure retained from PR #65. Local intake now verifies
exact asset sets, sizes, upload states and SHA-256 digests, then makes the MP3
volume a public non-latest prerelease before opening its catalogue PR. Read-only
PR CI can inspect the complete files. Main promotes the same assets after merge;
it never replaces audio. The CLI, README and web guide explain this visibility.
Workflow permissions, all existing audio paths and catalogue decisions are unchanged.

All 67 archive tests passed, independent review found no blockers, and live
read-only checks matched all 42 existing volumes / 261 assets. PR #66 source
[36749361288](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36749361288)
passed complete hosted staging. Merge `d90ba83687200637fefa9e7e0802f5336889e5eb`
passed automatic Pages
[36749654475](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36749654475).
The public README, Markdown/web guides and unchanged catalogue match reviewed
bytes; [the verification receipt](verification/soundtrack-intake-20260930.json)
retains exact hashes and the current game-source observation.
The canonical local checkout was fast-forwarded to archive main `9cc5274` and its
updated CLI help executed successfully. The user-facing resume of a whole intake
after a post-commit interruption remains
a separate automation follow-up (about 2–4 hours); current volume-level retries
reuse matching files and safely reject conflicts.

### Remaining work, purpose and recommended order

M5/M6 remain the user's priority. Estimates below are hands-on effort, not promised
calendar dates: owner decisions, specialist review, CI and the publisher queue are
additional. Parallel preparation must not duplicate a pending musical decision.
The planning milestone v0.150.0 is not a release prerequisite.

| Order / stable item                       | Concrete next result                                                                                                                                                             | Why it matters; impact of postponing                                                                                                                                                                          | Effort and dependency                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — M5: runner2088 game mix**           | Admit the already-published peak-controlled derivative to the standard Synth album, retaining its original and exact identity.                                                   | Completes the approved Synth pair without using the original's over-target peak. Until then the original remains archive-streamable and the derivative stays review-only; neither is silently made a default. | **2–4 hours** after the exact-derivative decision or a reviewed derivation contract; CI/publication extra.                                                                      |
| **1 — M6: next Metal album**              | Admit an explicitly selected subset of the six prepared tracks listed below, with scene/energy and content classification.                                                       | Adds sustained heavy gameplay choices to the standard Metal album. These files already stream from the archive; delay affects curated/default selection, not their existence.                                 | **Half to one working day** after the recorded selection; later researched batches **1–2 days** each.                                                                           |
| **2 — M8.intake-resume**                  | Add whole-command recovery after intake commits files but push/PR creation is interrupted.                                                                                       | Makes repeated uploads predictable. Asset-level retries are safe now, but restarting the whole CLI can still stop at “Batch already exists” and need manual recovery.                                         | **2–4 hours**, independently implementable; no music reviewer or release version needed.                                                                                        |
| **2 — M8.external-proof**                 | Publish one supplied stable public MP3 URL through a normal archive PR and prove mixed-source playback and exact-byte installation.                                              | Establishes that a real external host works end to end, allowing future audio to avoid Pages payload growth. Without it the code exists but the deployed host workflow is unproven.                           | **1–2 hours** after a rights-cleared URL with suitable CORS/range behavior exists; no bucket provisioning in this phase.                                                        |
| **2 — M10.capacity**                      | Check deployed bytes before each new-audio batch; plan external delivery before the remaining space is exhausted.                                                                | Prevents a new album from failing deployment. Pagination does not reduce MP3 storage. No growth-related outage is established now.                                                                            | **1–2 hours** for a scoped capacity/preflight follow-up if current guards need better reporting; external proof above is the immediate prerequisite to exercising another host. |
| **3 — M4: Ukrainian admission**           | Culturally review and classify the three approved Commons recordings, then admit a cleared subset.                                                                               | Expands authentic Ukrainian choices beyond the bundled Shchedryk adaptation. Delay keeps this standard collection small, but does not hold ready Synth/Metal work.                                            | Several hours of qualified review, then **1–2 working days** integration; reviewer availability unknown.                                                                        |
| **Alongside each batch — M9**             | Review style, menu/gameplay role, energy and theme metadata, keyed to stable ID/hash.                                                                                            | Makes automatic selection and style filters useful without overwriting saved preferences or rights. Deferral leaves less suitable menu/level matching.                                                        | **1–3 hours per accepted batch**, folded into its admission rather than another broad retag release.                                                                            |
| **Deferred — M2/M3/M8.acceptance**        | Complete full/repeated listening, transitions, warning audibility, mono/small-speaker checks; physical iPhone/controller and cold-offline acceptance remain explicitly deferred. | Confirms that controls, music balance and restoration work on the actual devices. Software/desktop checks cannot rule out device-specific silence, focus or offline failures.                                 | About **half a day** for the focused device/offline pass once resumed; full/repeated listening scales with track duration and reviewer availability.                            |
| **Dependent — M8.legacy-retirement**      | Verify historical clients, publish retirement notices, freeze old intake, and archive numbered repositories read-only while retaining required Pages/assets.                     | Reduces maintenance and uploader confusion. Deleting them prematurely can break old immutable game releases and saved references.                                                                             | About **half a day after compatibility/device/offline acceptance**; deletion has not met its conditions.                                                                        |
| **Shared concern — M8.release-assurance** | Close the deferred verification/provenance work tracked in issue #813 with the responsible release/feature owners.                                                               | Replaces waived evidence with actual results and catches broader regressions. Public deployment alone cannot close this quality gap.                                                                          | Diagnosis/owner scoping first; **no defensible fixed ETA**. Not a new blanket blocker on independently ready batches under current policy.                                      |
| **Later — M10.variety/pagination**        | Add small accepted albums in other genres; add catalogue pagination before approximately 450 recordings.                                                                         | Broadens choice and keeps a growing list usable. Core Synth/Metal/Ukrainian value comes first; current 261-record list is below the 512-format bound.                                                         | Albums **1–2 days per cleared batch** plus review; pagination **1–2 days** when needed.                                                                                         |
| **Ongoing — M0/M1**                       | Keep this ledger, admission contracts and regression coverage current after every delivery.                                                                                      | Prevents lost decisions, duplicate work and confusing “published” with “approved.” No foundation rewrite remains.                                                                                             | Documentation **under an hour per milestone**; regressions scoped to actual changes.                                                                                            |

**M5 detail.** runner2088's original is musically approved and remains untouched;
it measures +0.45 dBTP. Its separate game mix uses a constant gain reduction and
MP3 re-encoding, measures **−16.94 LUFS / −1.14 dBTP**, and keeps the arrangement
and duration. The exact derivative's recorded decision is pending; preparation
and public transport verification are complete through archive #65 and game #855.
The [review link](https://mekhovov.github.io/revealline-soundtracks/?collection=runner2088+Game+mix+%E2%80%94+technical+derivative&track=wekont.runner2088-game-mix&review=base-game-holdback-20260927#recordings)
and [hash-bound dependency](../authoring/library/soundtrack-batches/runner2088-game-mix-20260930/review-dependency.json)
remain available. It is one composition in two recordings, not another original.

**M6 detail.** The next set is **Solar Storm, Galactic Battle, Orbital Assault,
Mutilation's Melody, Bone Grinder's Ballad and City Limits Crash**: about 16 minutes
41 seconds total. Public exact-byte verification, native-source/licence evidence,
retained complete decoding/measurements and the admission inventory are ready.
[Game PR #864](https://github.com/mekhovov/revealline/pull/864) merged as
`144cbdd8a7143c8b8ece1c878f01a1a0c56bec2d`; its metadata preparation and intake
receipt are now on public main. It **does not add six runtime recordings**.
Exact-source [36753197285](https://github.com/mekhovov/revealline/actions/runs/36753197285)
passed preflight/release-ready; focused/test/build jobs were skipped, not passed.
Local compiler/admission checks passed 75/75 and independent review was retained.
[Merged-source Pages](https://github.com/mekhovov/revealline/actions/runs/36753834198)
passed. The [pending batch evidence](../authoring/library/soundtrack-batches/metal-next-20260930/EVIDENCE.md)
separates owner selection, content/scene acceptance and deferred listening/device
checks. Content ID/gameplay-video permission remains unknown, so Recording mode
excludes these tracks. The larger **12–20 distinct Synth/Metal recordings** target
remains; prepared auditions and alternate encodings do not complete it.

**M4 detail.** The three approved recordings are **Oi u luzi chervona kalyna,
A v kryvoho tantsia and Oi khodyt son kolo vikon**. Their permissions and owner
musical decision are recorded; suitability of their cultural presentation,
performance context and menu/gameplay role still needs review. This is not a
request to approve them again. Additional sourcing should continue toward the
six-additional-composition target only in small, cleared batches. Another Shchedryk
arrangement provides variety but does not fill a distinct-composition slot.

**External proof and capacity are different from managed hosting.** The public
external-delivery inventory is currently empty. The first real-object pass must
exercise external ↔ GitHub-backed ↔ bundled ↔ uploaded switching, Next/shuffle/repeat,
a broken external file followed by successful local playback, dynamic catalogue
pickup and hash-checked offline installation. A stable public S3 URL is suitable;
expiring presigned URLs are not. Current hosting provisioning remains out of scope.

The manifest-listed Pages payload is **924,661,311 bytes (881.83 MiB)** against
the repository's **950 MiB** guard, leaving **71,485,889 bytes (68.17 MiB)**.
It includes 203 MP3 compatibility files plus UI/metadata. Release assets preserve
the wider archive; materializing compatible audio into Pages still consumes this
budget. The catalogue contains 261 recording identities under a separate 512-entry
bound. **The byte budget can be reached before the approximately-450 pagination
trigger.** Assess new audio by bytes rather than predicting how many songs fit.
Admitting the already-published runner/Metal batch does not add another audio copy.
Never solve capacity by deleting immutable recordings, dropping compatibility
files or silently lifting the guard.

### Blockers, concerns and deliberate exclusions

- **Owner-decision dependency:** the runner derivative and prepared Metal set lack
  their exact recorded decision. Existing approvals and expressly hidden songs are
  preserved; this status review creates no new musical approval.
- **External input:** no real stable public external MP3 has been supplied/admitted.
  The code is delivered; the real-host proof is incomplete, with no input date.
- **Review/device availability:** cultural review and the user-deferred physical/
  offline acceptance have no scheduled reviewer/device session. The shipped
  Shchedryk and first six admissions retain pending full/repeated listening,
  transition, warning, mono/small-speaker and relevant cultural evidence.
- **Shared verification:** [issue #813](https://github.com/mekhovov/revealline/issues/813)
  remains open for deferred focused/company/persistence/offline/artifact/i18n/edition
  checks and preserved overlap/provenance reconciliation. Skipped jobs are not passes.
- **Unresolved observation:** one desktop test saw master volume become zero.
  The writer was not captured; another tab's shared preferences is only a hypothesis.
  Isolate a profile and capture the writer if it recurs. No speculative fix or
  claim of complete playback qualification follows from that observation.
- **Local-work boundary:** the prior multi-worktree audit preserved remote source
  and unrelated dirty work. This plan review verifies the current task checkout
  and public metadata; it does not claim every other local worktree is now clean.
- **M7 UA-FPV is skipped by user direction.** Preserve its private files and
  earlier rights evidence. It is not an active permissions chase or a release hold.
- **M11 originals remain paused at 0/36 approved.** Preserve scores, rejected
  candidates and the complete brief. A better production method and accepted
  pilots are prerequisites; no restart or completion date is scheduled.
- **Hosting phases 2–4 are deferred design work:** managed S3/CloudFront/OIDC;
  mirrors/backfill/failover and historical compatibility; provider adapters/custom
  domain and game filter deep links. They could simplify uploads and increase
  capacity, but introduce infrastructure and migration responsibilities. No
  implementation ETA is assigned before design review. Archive filter links
  already work; restoring those filters inside the game is the later feature.

### Delivery batches from this review

1. Commit this status review and receipt through a scoped documentation PR.
2. Keep runner/Metal admission ready; release an accepted subset independently
   when its existing decision dependency resolves. Implement intake-resume in
   parallel rather than waiting on listening feedback.
3. Prove external delivery when a usable URL exists, and check byte capacity before
   further audio publication. Continue Ukrainian cultural/role preparation in parallel.
4. Fold M9 metadata into each admitted batch; broaden styles afterward. Resume
   device/offline acceptance and archive retirement only when their deferred work
   is restored. Coordinate shared verification separately with the release owner.

Each source batch is refreshed against accepted main, independently reviewed,
submitted to the active required PR gates and published by the responsible owner.
Automatic Pages completion and direct public verification distinguish a merged
PR from a delivered feature. Update the ledger with that evidence; do not reserve
or invent another immutable release version for this documentation update.

### Superseded morning checkpoint — 30 September 2026

The current public main deployment is source `451b82dc13dc8a8545ff964ffb724d3d756ac62a`
(build label 0.142.4), following [PR #816](https://github.com/mekhovov/revealline/pull/816).
The release owner verified automatic Pages run
[36670887347](https://github.com/mekhovov/revealline/actions/runs/36670887347).
Historical v0.142.3 remains immutable. The former #779/v0.142.4 release hold is
superseded: current source already includes the reconciled Audio controls and
style persistence. Closed recovery PRs are not pending release inputs.

The publisher now merges independent reviewed PRs through branch protection and
lets main deploy automatically. **Milestone v0.150.0 is planning, not a reason to
hold an independently ready change.** Deferred broad checks are recorded in
[issue #813](https://github.com/mekhovov/revealline/issues/813); waived or skipped
suites remain unverified. No second publisher or replacement historical tag is needed.

The six-track admission is preserved in draft
[game PR #830](https://github.com/mekhovov/revealline/pull/830), assigned to
milestone **v0.150.0 — Unified native experience**. Both soundtrack commits were
rebased byte-for-byte onto main `88f530402586da7937af1ff4cea09c96b9b40a23`;
the subsequent `7c11e68180909b07d73d9499bb5970186773af24` update changes separate
Steam Deck checks and is included by the final reconciliation. The focused
catalogue, compiler, archive, source and player suites pass **157/157**, with
no skipped tests. Scoped ESLint, pinned Prettier and diff checks also pass.
This is queued work, not a new public game release. The release owner has the
exact production-baseline hold described below.

### Completed and preserved

- Canonical archive: **260 recordings, 196 public and 64 review-only**. Search,
  styles, collections, shareable URLs, upload intake and automatic publication are
  already present. Expressly hidden/rejected songs stay out of normal queues.
- The current game already discovers the canonical catalogue dynamically and has
  top-level Audio playback/style controls, mixed remote/local queues, uploaded
  tracks, offline albums, recovery and the bundled Shchedryk opening track.
- Owner musical approval is recorded for the eleven active review recordings in
  [archive #63](https://github.com/mekhovov/revealline-soundtracks/pull/63).
- [Archive #64](https://github.com/mekhovov/revealline-soundtracks/pull/64) merged
  as `5a835e54cf333b35e37d3cbd956cfa1914c6da58`. It adds an immutable seven-object
  admission inventory without copying or changing audio. Exact-head verification
  passed **47/47** tests plus full staged payload verification. Pages run
  [36672000939](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36672000939)
  passed; the public admission inventory returns HTTP 200 with exactly 1,607 bytes
  and SHA-256 `64f0e2ac28718af710fc20702519dfa171fe4020a56037242795027c8f1d5caa`.
- The soundtrack branch was refreshed to latest accepted main without conflicts.
  A read-only audit covered **23 relevant worktrees and 78 local branches**.
  Historical unpushed tip `1c70bc3a92cc6e36247badb80d17e9371b40c46d` is now preserved
  on GitHub as `codex/preserved-combined-native-spatial-audio-20260930`.
  Old `team-after-music` working files are already represented in remote history;
  they remain untouched. Spatial-audio work belongs to [PR #817](https://github.com/mekhovov/revealline/pull/817).

### Next batches, estimates and exact limits

| ID                 | Status / next action                                                                                                                                                                                                                                                                                                                   | Remaining effort and dependency                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M5 + M6**        | **Priority: six-track game admission in progress.** Retroracing Nightlife; Agony Space-deep; God of Darkness; Suffocation; Pixel Damnation; Revenge's Waiting. Exact public hashes and full decoding verified; all six meet −17..−15 LUFS and ≤−1 dBTP. One Synth album and one five-track Metal album reuse existing immutable files. | About **half to one working day** for source/fingerprint review, protected PR gates and direct public verification; CI/publication time additional. Full human/device checks remain separately pending. |
| **M5 follow-up**   | runner2088 remains approved musically and publicly streamable, but its existing MP3 measures **+0.45 dBTP**. It is excluded from trusted admission until a permitted peak-controlled derivative is published and verified with a new hash.                                                                                             | **2–4 hours** of derivative work and verification, then archive/game PR delivery; storage guard applies. Existing bytes stay intact.                                                                    |
| **M4**             | Shchedryk is already bundled. Three approved Commons recordings still need Ukrainian cultural review and scene/energy assignments before trusted admission.                                                                                                                                                                            | Several hours of reviewer time, then **1–2 working days** for a cleared subset. A review date cannot be promised.                                                                                       |
| **M9**             | Curate metadata only for accepted batches; avoid restarting a full catalogue retag. Six-track scene/energy assignments are included with M5/M6.                                                                                                                                                                                        | **1–3 hours per further accepted batch**.                                                                                                                                                               |
| **M8**             | Physical iPhone/controller and cold-offline acceptance remains **deferred by the user**. Keep software regressions separate.                                                                                                                                                                                                           | About **half a day** when restored and devices are available.                                                                                                                                           |
| External URL proof | URL intake and external support exist; one real stable, rights-cleared public S3-style URL is still needed for end-to-end proof.                                                                                                                                                                                                       | **1–2 hours after a valid URL is supplied**; cloud provisioning remains deferred.                                                                                                                       |
| Legacy archives    | Keep numbered repositories and Pages compatibility payloads. Retirement notices/archival follow physical/offline acceptance; deletion is not authorized by a successful current-client test alone.                                                                                                                                     | About **half a day after M8**.                                                                                                                                                                          |
| Capacity / M10     | Add catalogue pagination before about 450 recordings; broader genres follow core-family delivery.                                                                                                                                                                                                                                      | Pagination **1–2 working days** when approaching the limit; currently 260. New albums **1–2 days per cleared batch**.                                                                                   |
| M7 / M11           | **UA-FPV skipped by user direction. AI originals paused, 0/36 approved.** Preserve files, rights holds, rejected recordings and brief.                                                                                                                                                                                                 | Unscheduled; neither blocks ready licensed batches.                                                                                                                                                     |

The admission compiler now distinguishes the owner's exact-hash musical decision
from full listening qualification. The six-track proposal explicitly leaves
full-track, repeated-session, transitions, warning audibility, mono, small-speaker
and physical-device checks pending; it does not fabricate those results.
Content ID and gameplay-video permission remain unknown, so these tracks stay
excluded from Recording mode. Revenge's Waiting is a **48-second boss cue**, not a
full-length gameplay composition. Public archive publication and these game
admissions do not count toward the paused 36-original-composition milestone.

A local dependency install failed with ENOSPC during this audit. Source files and
historical evidence were preserved. Use hosted full builds, bounded measurements
in memory, and check the **1 GiB free-space floor** before production writes.
Space has fluctuated as parallel tasks work; no other task's caches or user data
may be deleted to bypass the guard.

The six-track game proposal remains **draft, not release-ready**. Independent
review confirms 77 catalogue tracks and exact preservation of all previous 71
recordings, archive entries, collections and bundled opening assets. However,
`produce-field-kit-theme.mjs --check` reports a stale production ledger already
present on the accepted base. The base includes material Demo audio routing
changes absent from its earlier review fingerprint; an in-memory production
comparison also finds 59 pre-existing non-audio successors plus eight audio
successors. This cannot be described as a catalogue-only ledger refresh.
[The blocked review](verification/approved-synth-metal-20260930/review.json)
records the evidence and pending qualification. No old approval, ledger or
fingerprint was overwritten. Resolving that shared baseline and passing the
exact-source gates is a release dependency; its elapsed completion time is not
yet established.

## Superseded execution checkpoint — 29 September 2026 (v0.142.3 public)

The immutable game release **v0.142.3** is published from exact source
`b5ab06e12542f72e33c45b973ba693a5e1509c1c`. Pages selector PR
[#788](https://github.com/mekhovov/revealline/pull/788) merged as
`6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8`; direct HTTP checks confirm
that both the public root and the versioned game path serve v0.142.3. The
release includes canonical-archive discovery, mixed remote/bundled/uploaded
queues, Audio-settings style controls, top-level Previous/Play-Pause/Next and
Shchedryk as the bundled opening recording. Physical-device and cold-offline
acceptance remain separate from that public HTTP result.

Release-evidence correction PR
[#789](https://github.com/mekhovov/revealline/pull/789) merged as
`79e07b501ed085aa1103795689cbd5d15ab24b00`. Plan checkpoint PR
[#790](https://github.com/mekhovov/revealline/pull/790) then advanced accepted
`main` to `64c8b9d81604984363666abadae236d9f2f76f7f` without runtime changes. Both qualification
assemblers now retain the exact historical audio-source audit. The accepted
v0.142.3 tag and assets remain immutable; this correction applies to later
release packages.

The canonical archive remains at **260 exact recordings** in **119
collections**: **196 public** and **64 review-only**. Archive
[#58](https://github.com/mekhovov/revealline-soundtracks/pull/58) merged as
`cead7a9964d187ecf4e47ad906733f2b7dd4c442`; its Pages run
[36470369733](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36470369733)
passed. There are no open canonical-archive PRs. The 27 expressly rejected
recordings remain preserved and accessible only through review links; they do
not enter public queues or default playlists.

Two metadata-only archive batches now preserve the owner's accepted direction
without claiming complete-track approval. Synthwave archive
[#59](https://github.com/mekhovov/revealline-soundtracks/pull/59) merged as
`535a6318cce53e9df0e7d28da5e50f608285d898`; Pages
[run 36512479050](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36512479050)
passed and the live catalogue groups exact-hash **RetroRacing Nightlife** and
**runner2088** in `Synthwave & Electro — owner-approved directions`. Metal archive
[#60](https://github.com/mekhovov/revealline-soundtracks/pull/60) merged as
`80aa064ceda9869fb31bf45e3d69a4bfe1983fdb`; Pages
[run 36513132929](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36513132929)
passed and the live catalogue groups three retained Eternity recordings plus the
YannZ groove pair in `Metal — owner-approved directions`. Both batches retain
`listeningApproval: not-reviewed`, `gameCatalogueAdmission: false`, non-default
behavior and unchanged rights/audio hashes. The rejected **Desolation** recording
remains review-only and outside the Metal direction collection. These collections
are dynamically visible to current archive clients; they are curation, not new
audio publication or trusted built-in admission.

The owner subsequently approved all eleven recordings in the three active review
sets. Archive [#63](https://github.com/mekhovov/revealline-soundtracks/pull/63)
merged as `d011192720c91cb41e2d55a5f2bfdd30604197be`; exact-head run
[36515659086](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36515659086)
and Pages run
[36515853977](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36515853977)
passed. The live catalogue now marks two Synthwave/Electro recordings, five Metal
recordings, Shchedryk and three Ukrainian Commons recordings with
`listeningApproval: owner-approved-2026-09-29`. It groups them into
`Synthwave & Electro — approved`, `Metal — approved` and `Ukrainian — approved`.
Exact audio, rights, source metadata, public visibility and
`gameCatalogueAdmission: false` remain unchanged. Approval makes the recordings
eligible for admission review; it does not silently add them to a trusted game
default or claim physical-device/cultural acceptance.

### Active release batches

1. **P0 — saved style persistence (v0.150.0 cumulative train).** Runtime
   [PR #779](https://github.com/mekhovov/revealline/pull/779) restores saved
   top-level style choices after reload and retains a player's attempted choice
   after an atomic-save failure. Its exact pushed preparation head is
   `2c160ed7e8f291fcc80e35c8fa6192d72ce2dfa6`. Local focused validation passed
   **342/342** soundtrack, player, panel, storage, taxonomy, Couch-session and
   opening-theme tests, plus the separate **88/88** storage/opening boundary
   cohort. Hosted run
   [36515171739](https://github.com/mekhovov/revealline/actions/runs/36515171739)
   passed preflight and the 342-test soundtrack cohort but failed four unrelated
   Team composite-navigation cases because its unpublished predecessor lacked
   exact Team picture bindings. That failure is preserved and is not counted as a
   pass. PR #791 subsequently merged the v0.142.4 source at `321408a3c`, but
   v0.142.4 is not yet an immutable release or public Pages selection. The PR
   remains draft/held until that release boundary is accepted, then must be
   refreshed onto the actual accepted merge before final
   qualification. **Estimate: 0.5–1 working day after v0.142.4, plus CI and
   publication queues.**
2. **Deferred by user — physical and offline acceptance.** After #779 is public, verify an
   iPhone stream, remote-to-bundled switching, touch/controller focus, playlist
   restoration and a cold offline restart with the server unavailable. Browser
   simulations do not replace these checks. The user deferred this item on
   29 September 2026 so content curation can continue; it remains required before
   legacy archive retirement. **Estimate: about 0.5 day when restored and the
   devices are available.**
3. **P1 Synth admission.** The owner approved **Retroracing Nightlife** and
   **runner2088** through archive #63. Preserve the broader auditions as reference
   material:
   [six-track Synth approved directions](https://mekhovov.github.io/revealline-soundtracks/?collection=synth-approved-directions-audition-20260925&order=sequential&repeat=all#recordings),
   [runner2088](https://mekhovov.github.io/revealline-soundtracks/?collection=runner2088+retrowave+audition&order=sequential&repeat=all#recordings), and
   [three-track racing Synth finale](https://mekhovov.github.io/revealline-soundtracks/?collection=racing-synth-final-audition-20260926&order=sequential&repeat=all#recordings).
   The exact two-track approved subset remains non-default and not trusted for game
   admission. Admit it through a scoped catalogue/game PR with transition and
   public playback verification. **Estimate: 1–2 working days plus CI/release.**
4. **P1 Metal admission.** Archive #63 records owner approval for **Agony
   Space-deep**, **God of Darkness**, **Suffocation**, **Pixel Damnation** and
   **Revenge's Waiting**. Preserve the remaining groove-led auditions as references:
   [YannZ groove pair](https://mekhovov.github.io/revealline-soundtracks/?collection=metal-groove-yannz-audition-20260924&order=sequential&repeat=all#recordings),
   [Purgatory volume 3](https://mekhovov.github.io/revealline-soundtracks/?collection=metal-purgatory3-audition-20260925&order=sequential&repeat=all#recordings), and the Interstellar EDM-metal recordings
   [Space Odyssey](https://mekhovov.github.io/revealline-soundtracks/?collection=Space+Odyssey+EDM-metal+audition&order=sequential&repeat=all#recordings),
   [Red Dwarf](https://mekhovov.github.io/revealline-soundtracks/?collection=Red+Dwarf+EDM-metal+audition&order=sequential&repeat=all#recordings),
   [Stellar Confrontation](https://mekhovov.github.io/revealline-soundtracks/?collection=Stellar+Confrontation+EDM-metal+audition&order=sequential&repeat=all#recordings) and
   [Deep Space](https://mekhovov.github.io/revealline-soundtracks/?collection=Deep+Space+EDM-metal+audition&order=sequential&repeat=all#recordings).
   Then review the [four Reckless tracks](https://mekhovov.github.io/revealline-soundtracks/?collection=metal-reckless2-audition-20260925&order=sequential&repeat=all#recordings).
   Keep the other Eternity tracks as backup material. The exact five-track approved
   subset remains non-default and not trusted for game admission. Admit only that
   subset with transition, warning-audibility and public playback evidence.
   **Estimate: 1–2 working days plus CI/release.**
5. **P1 Ukrainian admission and cultural acceptance.** Shchedryk remains the
   bundled opening track. Archive #63 records owner approval for it and the three
   rights-cleared
   [Ukrainian Commons candidates](https://mekhovov.github.io/revealline-soundtracks/?collection=ukrainian-commons-audition-20260925&order=sequential&repeat=all#recordings)
   **Oi u luzi chervona kalyna**, **A v kryvoho tantsia** and **Oi khodyt son kolo
   vikon**. Musical approval does not replace the remaining Ukrainian cultural
   review or scene/energy assignment.
   **UA-FPV remains excluded from the active plan by user direction.** Additional
   recordings require exact rights and cultural review. **Estimate: several hours
   of cultural review plus 1–2 working days for admission/release.**
6. **P2 — metadata curation.** Apply style, scene, energy and collection
   corrections only to recordings accepted in the three batches above. Do not
   restart a disruptive full-library retagging effort. **Estimate: 1–3 hours per
   accepted batch.**
7. **P2 — legacy repository retirement.** After #779 physical/offline
   acceptance, freeze Archive 01 and Archive 02 intake, add canonical-site notices
   and archive the repositories while preserving their Pages payloads for old
   immutable game releases. Do not delete them. **Estimate: about 0.5 day.**

### Deferred and blocked work

A real external S3-style object proof starts only when a stable rights-cleared URL
with public GET/HEAD/Range CORS exists. Catalogue pagination is required before
approximately 450 recordings, leaving capacity at 260. Broader genres follow the
three core families. The rejected AI-original workflow remains paused at **0/36
approved compositions**.

Local free space is now about **1.4 GiB**, only narrowly above the 1 GiB guard, so
hosted builds remain preferred for release artifacts. The release manager moved
PR #779 from the separate v0.143.0 slot into the cumulative
**v0.150.0 — Unified native experience** train on 29 September 2026. Its release
hold remains in place while the cumulative predecessors merge and qualify.
Musical admission needs complete-track listening; Ukrainian admission additionally
needs cultural and rights review.

## Superseded execution checkpoint — 28 September 2026

The canonical archive is the single active catalogue and Pages player. Its current
main branch contains **260 exact recordings**: **202 public** entries discovered by
the game and **58 review-only** entries available only through the archive's
explicit review URL. Archive intake, metadata, immutable Release-backed objects,
automatic post-merge Pages publication, hosted-URL intake and shareable filters are
complete. The two numbered archives remain read-only compatibility origins for
older immutable game releases; archive them only after the canonical game adapter
is public, and retain their Pages payloads while those old editions remain
supported.

Canonical game integration from PR #716 is already present in accepted releases:
the game discovers the current public catalogue without a game-code change, supports
release-backed and verified external URLs, excludes review-only entries, and recovers
to remote, bundled or uploaded music after a failed remote deck. Canonical archive
[PR #56](https://github.com/mekhovov/revealline-soundtracks/pull/56) and
[PR #57](https://github.com/mekhovov/revealline-soundtracks/pull/57) are public at
`54690c6` and `01f55ec`; Pages run 36445928906 exposes the player-first order
**Synth, Metal, Chiptune & 8-bit, Rock, Electronic, Ambient, Fusion, Other,
Ukrainian · UA, ФПВ**. UA and Ukrainian share one family, while only exact Cyrillic
`ФПВ` enters the FPV family; the public catalogue contains no Latin `FPV` raw tag.

Accepted game `main` is now `7138e7b6187bf69991d50313c3f9ac1620427778`, the
merge of v0.142.1 source PR #768. The sole release publisher is qualifying that exact
merge in run 36447642608; the v0.142.1 tag/release/Pages selector do not yet exist,
so v0.142.1 must not be reported as public.

Game [PR #770](https://github.com/mekhovov/revealline/pull/770) is the next soundtrack
delivery batch. Its source has been rebased onto that accepted v0.142.1 merge. It
places Previous, Play/Pause and Next at the top of Audio settings, exposes the full
canonical style order directly in Audio settings, automatically mixes matching
public, bundled and uploaded recordings, and removes the recurring archive opt-in
step. The rebase appends Field Kit revision 98/audio revision 50 with an exact
28-input fingerprint, preserving v0.142.1 revision 97 and all predecessors. Local
focused tests pass 227/227; production/history tests pass 30/30; validation,
localization and production reproducibility pass. Fresh exact-head hosted gates and
public/device acceptance remain required.

Current item order and hands-on estimates:

1. **Finish v0.142.1 publication:** the release owner must complete the already
   running merged-source qualification, freeze/inspection, immutable release and
   Pages selector. **Publisher hands-on: about 0.5 day, plus hosted queues.** This is
   a sequencing dependency; soundtrack work must not duplicate or retag it.
2. **Release PR #770:** push the rebased exact head, pass required hosted source
   gates, merge after v0.142.1 is public, qualify/freeze the actual merge, publish a
   new immutable version and verify the top-level controls and style queues against
   the live 260-entry archive. **0.5–1 working day, plus CI/release queues.**
3. **Device/offline acceptance:** verify streamed playback and switching on physical
   iPhone, keyboard/controller focus, and a cold offline restart with bundled and
   installed music. **About 0.5 day when devices are available.**
4. **Content expansion:** continue listening-led synthwave/electro, heavier metal
   and Ukrainian admissions in independent archive batches. **1–2 days per accepted
   batch**, excluding user listening and rights review.
5. **Real external-object proof:** ingest one stable rights-cleared S3-style URL and
   verify automatic game discovery, Range/CORS streaming, failure recovery and exact
   offline installation. **1–2 hours after a valid URL exists; currently blocked on
   that URL and its recording-specific rights.**
6. **Legacy archive retirement notices:** freeze intake and point both numbered roots
   at the canonical site after the current game integration is public. **About 0.5
   day.** Preserve compatibility payloads for old immutable releases; deletion is
   not a safe completion condition.

The first real external-object acceptance remains blocked until a stable public
HTTPS MP3 URL with GET/HEAD/Range CORS and recording-specific rights is supplied.
Per the user's latest prioritization, **UA-FPV is removed from the active delivery
plan**; keep its historical/private evidence only and do not spend release capacity
on public admission. The rejected AI-original method remains paused at 0/36 approved
compositions.

## Historical external-URL checkpoint — 27 September 2026

**Superseded status snapshot:** the implementation below is now public. The real
external-object proof remains open in M8.external-proof above. Old PR #716 release
holds and immutable-release steps below are retained as history, not current work.

At this checkpoint this was the active soundtrack transport priority. The canonical soundtrack
repository remains the catalogue and rights control plane, while an uploader may
bind one recording to a stable public HTTPS MP3 URL such as a direct S3 object URL.
The first version does not provision buckets, upload objects, configure CloudFront,
mirror files or migrate the existing 194 recordings.

### Implemented source work

- Canonical archive [PR #10](https://github.com/mekhovov/revealline-soundtracks/pull/10)
  accepts either a
  local file/folder, `--audio-url`, `--url-manifest` or a metadata-only v2
  `.rlintake` package. External URLs are re-fetched twice and pinned by final URL,
  byte count, SHA-256, duration, CORS and byte-range evidence. HTTPS credentials,
  local/private destinations, expiring query parameters, excessive redirects,
  non-MP3 content, truncation and byte drift are rejected.
- `external-deliveries.json` is deterministic and separate from GitHub Release
  audio volumes. Pull-request and Pages verification re-check every external
  identity; a weekly read-only audit reports later drift without rewriting the
  catalogue.
- The archive player supports external and repository-hosted recordings in one
  queue, disposes failed media before advancing, and implements shareable `q`,
  `artist`, `collection`, `styles`, `order`, `repeat` and `track` URL state with
  browser Back/Forward restoration and a Share-this-list action.
- Game [PR #716](https://github.com/mekhovov/revealline/pull/716) accepts any
  archive-verified external domain without a per-domain code change, requests
  anonymous CORS for external playback, preserves the existing release-backed
  path, recovers from a broken remote track to other remote, bundled or uploaded
  music, and verifies exact bytes and SHA-256 before staging an offline copy.
- Archive verification currently passes 34/34 tests. The focused game catalogue,
  panel and transport cohort passes 185/185 tests; scoped Prettier and ESLint checks
  are clean. These are source checks and do not replace a real hosted-object or
  public release acceptance test.

### Remaining release work and estimates

| Step                     | State                                                                                                                                                             | Next action                                                                                                                                                                                   | Hands-on estimate                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Archive source PR        | Complete: PR #10 passed at exact head `ee94624` and merged as `4e3ecd7`                                                                                           | Preserve the exact merge and verification evidence                                                                                                                                            | Complete                              |
| Archive Pages acceptance | Complete for source/UI delivery: run 36340413372 passed; live root, hosted-URL intake, Share-this-list module and empty deterministic inventory returned HTTP 200 | Repeat mixed external/repository playback and broken-track continuation with the first rights-cleared hosted object                                                                           | 1–2 hours after a real URL exists     |
| Game PR #716             | Feature source implemented; release sequencing remains blocked by the shared game pipeline                                                                        | Push the cumulative PR update, pass required exact-head checks, then use the established immutable release and Pages selector flow                                                            | 0.5–1 day plus shared CI/release wait |
| Real S3-object proof     | Blocked by missing input                                                                                                                                          | Supply one stable public MP3 object URL with public HEAD/GET/Range CORS and recording rights; ingest through a normal archive PR, then prove automatic discovery in the already-released game | 1–2 hours after the URL exists        |

The real-object proof must switch among that S3 recording, a GitHub Release-backed
recording, bundled music and an uploaded MP3, including failure recovery and an
exact-byte offline installation. Until that proof and the immutable game release
are complete, this item remains **implemented in source, not publicly delivered**.

Archive PR #10 merged as `4e3ecd747ced49921be22ac361e40ddc26fb6fb6`.
Its exact post-merge [Pages run 36340413372](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36340413372)
passed publication, deterministic verification and deployment. Direct checks of
the deployed root, `filter-url.mjs` and `external-deliveries.json` returned HTTP
200; the root contains both **Use hosted MP3 URLs** and **Share this list**. The
external inventory is intentionally empty until the first stable, rights-cleared
hosted MP3 is supplied. This proves the archive delivery path without claiming the
still-pending real-object playback acceptance.

### Deferred hosting architecture

- Phase 2: private S3 plus CloudFront OAC, GitHub OIDC publishing, immutable object
  keys, cache/cost controls and monitoring.
- Phase 3: primary/mirror URLs, GitHub Release mirroring, backfill, failover and
  historical-release compatibility.
- Phase 4: R2, Bunny, Spaces, provider-neutral upload adapters, custom-domain
  migration and game deep links for archive filters.

These phases require a separate design review. The first release treats the
uploader-supplied public URL as authoritative.

## Historical baseline and delivery checkpoints

The dated entries below preserve what was known then. Current status and remaining
work are the 30 September evening checkpoint above; old “active”, “blocked” or
“draft” statements are not new release holds.

### Canonical library consolidation checkpoint — 27 September 2026

The two active soundtrack Pages repositories no longer scale as the public source:
Archive 01 contains 163 recordings / 887,503,800 audio bytes and Archive 02 contains
31 recordings / 145,375,900 audio bytes. Together they exceed the recommended
GitHub Pages published-site size. Canonical archive
[PR #1](https://github.com/mekhovov/revealline-soundtracks/pull/1) merged as
`b3978d1a9872fb9197b116593d13179088b2735c` and consolidates all **194 unique
recordings / 47 collections / 1,032,879,700 exact audio bytes** in
`mekhovov/revealline-soundtracks`.

The canonical repository keeps its 0.54 MiB Pages UI, catalogue, rights evidence,
tests and intake automation in Git. SHA-256-named MP3s live in versioned GitHub
Release volumes in the same repository. Repository immutable releases are enabled
for future volumes; the foundation volume predates that setting and remains bound
by its exact manifest and hashes rather than being described as immutable. On every accepted intake PR, Actions first
verifies and publishes all referenced draft volumes, then deploys the Pages player.
The one public site exposes search, same-page playback, style mixing, ordered or
shuffled playback, repeat controls and multi-collection membership. `ФПВ` and `UA`
are independent styles; the TRENCH ORDERLY recordings belong to both `TRENCH
ORDERLY` and `ФПВ`. `--license unknown` records uploader-confirmed public playback
and redistribution, shows no invented open licence and remains Recording-mode
ineligible.

Catalogue usability [PR #4](https://github.com/mekhovov/revealline-soundtracks/pull/4)
merged as `91b60190bfc7b7df4f9a2231bdfca99b3ce82956`; publication/Pages
[run 36331917412](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36331917412)
passed. Artist, collection and tag metadata is now exposed as accessible filter
controls across all 194 recordings. Clicking `UA` shows the seven current UA
recordings. Direct MP3 download links are retained in code but hidden from the
public player; creator source and rights evidence remain visible. Intake verification
now requires a non-empty title, artist, collection and searchable tags for every
recording. Both the browser-created `.rlintake` path and the direct file/folder CLI
path feed the same deterministic catalogue and automatic post-merge deployment.

Operator documentation [PR #8](https://github.com/mekhovov/revealline-soundtracks/pull/8)
expanded the repository README and Markdown guide with complete one-file, folder,
browser-package, multiple-collection and `unknown`-rights examples; Pages
[run 36335718722](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36335718722)
passed. Web-guide [PR #9](https://github.com/mekhovov/revealline-soundtracks/pull/9)
published an accessible, responsive
[upload guide](https://mekhovov.github.io/revealline-soundtracks/upload-guide/),
linked it from the main player and pinned it in the verified deployment manifest.
Exact-merge Pages [run 36335989981](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36335989981)
passed, followed by direct public-browser verification of every guide section and
navigation target.

This replaces further numbered archive shards. Archive 01 and Archive 02 remain
read-only migration evidence until the canonical game client is public; do not
rename them because GitHub states that project Pages URLs do not redirect after a
repository rename. GitHub Pages' published site is limited to 1 GiB and has a soft
100 GiB/month bandwidth limit, while GitHub Releases allow up to 1,000 assets per
release with each asset below 2 GiB. Sources:
[Pages limits](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/github-pages-limits),
[repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits),
[release limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), and
[rename behavior](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).

The first canonical format is bounded to 512 recordings, leaving capacity for 318
additional tracks. Before 450 recordings, add a paged catalogue index in the same
repository so the game can load bounded pages without creating another repository.
If direct Release delivery later needs fetch-based offline installation, stronger
cache controls or usage analytics, migrate only the audio object URLs to an
S3-compatible origin such as Cloudflare R2 or Amazon S3 behind a custom domain;
retain this repository and catalogue as the control plane. Git LFS and more Pages
shards are rejected because they do not improve the deployed-site or client
integration boundary.

Ranked storage options after the current Release-backed design are:

1. **Cloudflare R2 behind a project audio domain:** the preferred scale-up path.
   R2 documents free Internet egress, a 10 GB Standard-storage free tier and
   configurable browser CORS, which resolves the current Release-asset limitation
   for fetch-based offline installation. It adds an account, bucket credentials,
   DNS and billing ownership. Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
   and [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).
2. **Amazon S3 with CloudFront:** the most configurable established option when
   access logs, lifecycle policy and CDN controls justify its operational cost.
   CloudFront must forward the browser `Origin` and relevant preflight headers for
   S3 CORS: [AWS CloudFront CORS guidance](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/header-caching.html#header-caching-web-cors).
3. **Backblaze B2 with a CDN:** an S3-compatible storage alternative. B2 supports
   explicit CORS rules, but a simple bucket does not directly map to a custom domain,
   so CDN/domain setup is less direct than R2 for this public player. Sources:
   [B2 CORS](https://www.backblaze.com/docs/cloud-storage-cross-origin-resource-sharing-rules)
   and [B2 buckets](https://www.backblaze.com/docs/cloud-storage-buckets).

Keep the current GitHub Release design until actual bandwidth, catalogue paging or
offline-fetch requirements justify that migration. It already removes audio from
the Git/Pages size boundary while preserving one repository, one catalogue and one
public player.

Remaining work and current estimates:

1. **Completed:** canonical Pages, all 194 catalogue entries, representative exact
   Release bytes, range playback and same-page Next were verified publicly.
2. **Completed:** canonical archive
   [PR #5](https://github.com/mekhovov/revealline-soundtracks/pull/5) mirrors the
   original 70 exact MP3 objects and inventory, preserves both numbered archives'
   control-plane evidence, and pins the old prerelease's 19 assets (15 `.rlsound`
   packs). Its local verifier reports 194 catalogue records, 70 compatibility
   objects and 356,015,756 public bytes; 23/23 archive tests pass. It merged as
   `132ef40faae4617349a7e2870a0d6012f5f54c47`; exact-source verification and
   [Pages deployment](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36334003357)
   passed. Direct public verification fetched and hashed all 70 objects / 354,986,122
   bytes against inventory SHA-256
   `2706445dafe995f6c4dc044ad5e92031cae60627699f6a72985e67a972064ccd`
   and confirmed 194 canonical catalogue entries.
3. **Completed:** canonical archive
   [PR #6](https://github.com/mekhovov/revealline-soundtracks/pull/6) added a
   permanent exact-union verifier for both legacy catalogues. It proves all 194
   recording hashes / 1,032,879,700 audio bytes are retained, including the
   legitimate `peachtea.last-stand-lets-go` ID collision and seven intentional
   TRENCH ORDERLY rights corrections. Canonical archive
   [PR #7](https://github.com/mekhovov/revealline-soundtracks/pull/7) then added
   the **Foundation 70** collection without changing the 70 stable recording
   identities or bytes. Exact-head verification and Pages
   [run 36335291318](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36335291318)
   passed. Direct public browser acceptance selected the 70-song collection,
   started `Last Stand Lets Go`, advanced to `Now This Is A Waterpark!` and kept
   playback inside the same Foundation queue. The public catalogue reports 70
   exact collection members / 354,986,122 bytes with the same inventory hash set.
4. Release the game adapter that accepts canonical structured rights, multi-
   collections, `ФПВ`/`UA`, Release URLs and non-CORS media-element streaming while
   retaining remote-error recovery and built-in/uploaded fallback: about one day
   plus release coordination. Game [PR #716](https://github.com/mekhovov/revealline/pull/716)
   implements this adapter. A regression now proves that Refresh discovers and
   plays a newly published catalogue entry with its title, artist and source and
   without a game allowlist or per-song code change. Unknown licence text is not
   exposed in the game. The PR remains on the release-train hold until the sole
   publisher assigns it a version and runs independent exact-source qualification.
   A direct current-source acceptance probe loaded the canonical inventory through
   `createSoundtrackSource`, downloaded Holizna's `Drama`, decoded all 8,431,885
   bytes and matched SHA-256
   `bacdf4eae1d6031a357837389b86f5b114997629be60ca9cb3d2e14284fee34b`.
5. Add migration notices to the two legacy roots and freeze their intake: about
   half a day after canonical game acceptance.
6. **Completed:** the canonical
   [compatibility prerelease](https://github.com/mekhovov/revealline-soundtracks/releases/tag/legacy-playlists-2026-09-21)
   carries the 15 exact `.rlsound` packs and four evidence assets. All 19 names,
   sizes and GitHub-reported SHA-256 digests match the Archive 01 source release.
7. Implement paged catalogue metadata before the 450-track trigger: one to two
   working days; it does not block the current 194-track release.

Both numbered repositories can then be archived read-only. Deleting them is not a
regression-free operation: immutable older game editions contain their original
Pages URLs, and GitHub does not redirect project Pages after repository deletion.
Keep the archived repositories and Pages payloads available unless breaking those
historical editions and links is explicitly accepted.

The main technical concern is that GitHub Release assets support direct media
playback and range requests but do not expose the normal cross-origin response
needed for JavaScript byte fetching. The canonical game therefore uses a trusted
plain `HTMLAudioElement` source for online streaming and must not request anonymous
CORS on Release URLs. Offline installation of these Release-backed auditions is a
separate future feature. Physical Safari, iPhone and controller playback remain
acceptance work rather than inferred passes.

| Area                     | Completed                                                                                                                                                                                                                                         | Remaining                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Existing catalogue       | 70 hosted recordings / 15 albums; earlier 24-track collection is included                                                                                                                                                                         | Selective listening and trusted metadata curation                                                                            |
| Player framework         | Simplified chooser, mixed playlists, uploads, creator tools, optional offline albums, recovery and rights enforcement                                                                                                                             | Targeted released-source verification and demonstrated fixes                                                                 |
| Native archive streaming | PR #523 is released in immutable v0.130.0; the public desktop game loaded the current 140/140 archive recordings, played a new Reckless object, and retains earlier remote → included → remote recovery evidence                                  | Physical iPhone/controller and cold-offline acceptance remain separate                                                       |
| New archive previews     | At the verified 27 September checkpoint, 187 public archive recordings across 45 collections were present on two public archives; the immutable 104-recording baseline and its later additions retain separate publication evidence               | Full listening, taste approval and game admission remain; zero new game admissions                                           |
| Retro previews           | Seven earlier rejections and six rejected DOS-88/escp previews are retained; later synth/action auditions plus runner2088 are public and listening-unapproved                                                                                     | Review the public slate against the Electric Dreams/night-drive direction                                                    |
| Metal previews           | Six older backups, four Eternity recordings, four industrial/thrash previews, four nonduplicate YannZ-centered groove auditions, four Purgatory auditions, four Reckless vol. 2 auditions, five new energy auditions and Heavy Dungeon are public | Complete the prioritized full-length and Reckless reviews, then review the five new energy candidates; all remain unadmitted |
| Ukrainian previews       | Three exact CC BY 3.0 Commons derivatives are publicly playable through archive PR #36; Shchedryk remains the only game-admitted Ukrainian recording                                                                                              | Full listening, cultural/gameplay review and any later game admission remain pending                                         |
| Nakarada Shchedryk       | User approved the direction; exact MP3 admission is public in v0.130.0 and played from the bundled source during desktop transition verification                                                                                                  | Full-track/repeated-session, physical-device and Ukrainian cultural acceptance                                               |
| UA-FPV                   | Historical private packs preserve 80 filenames / 77 unique recordings                                                                                                                                                                             | Inactive: removed from the current delivery plan by user direction; preserve evidence only                                   |
| Quick controls           | Replacement PR #516 is included in public v0.130.0; historical PR #333 is closed                                                                                                                                                                  | B/N plus touch/controller physical-device acceptance                                                                         |
| AI originals             | Scores, candidates and rejection evidence retained                                                                                                                                                                                                | Paused; 0/36 approved                                                                                                        |
| Historical releases      | PRs #209, #250, #263 and #268 merged                                                                                                                                                                                                              | Preserve delivered behavior, do not redo historical release work                                                             |

### Completed

- The 140-recording archive is published. The native archive player and recovery
  repair are published in immutable v0.130.0.
  Archive75 preservation of v0.110.1 and Archive76's scoped desktop music
  verification are complete. Their exact evidence and limitations are below.
- Selector PR #476 is merged and the primary v0.111.1 deployment passed. Direct
  desktop-browser verification confirms 128-recording discovery and same-page
  Carol playback. The primary-selector blocker is complete; this does not claim
  physical-device/controller or cold-offline acceptance.
- The refreshed bundled-source adapter and quick controls are part of v0.130.0;
  their remaining physical-device checks are acceptance work, not source admission.
- Immutable [v0.130.0](https://github.com/mekhovov/revealline/releases/tag/v0.130.0)
  publishes the structured-rights and stream-recovery repair. Selector
  [PR #538](https://github.com/mekhovov/revealline/pull/538) and Pages
  [run 36184029594](https://github.com/mekhovov/revealline/actions/runs/36184029594)
  deployed it to the primary route. Direct public desktop acceptance loaded
  **136/136**, streamed Drama beyond the 12-second watchdog, switched to bundled
  Shchedryk, then returned to streamed Cyber Anxiety with no warning/error log.
- Test-only [PR #555](https://github.com/mekhovov/revealline/pull/555) merged as
  `8acf3f8c6f3d5ba63cefdcce0dafd687ba08a180` on the latest main. Focused Node
  20.20.0 verification passed the two changed scenarios, hosted preflight and
  release-ready passed, and independent review was clean. It adds no runtime or
  release change; it prevents regressions in catalogue outage/Refresh and the real
  player recovery sequence across remote and included sources.

### Active — release order and effort

**Current implementation checkpoint — 27 September 2026:** immutable v0.141.6 is
public and accepted. The coordinated v0.141.7 source merged through
[PR #705](https://github.com/mekhovov/revealline/pull/705) as
`5c16d2a9efef2b19c1b7cf1cd1387ea430b88e8b`. Authoritative `main` is now
`e1e31312d3e34842688eb9922bbda1203238c435`. The v0.141.7 publication attempt
[run 36286979786](https://github.com/mekhovov/revealline/actions/runs/36286979786)
failed on a stale production ledger; source/audio review repair remains pending and
the public game remains v0.141.6. Publication and public acceptance remain owned by
the sole release coordinator. At this dated checkpoint the archives exposed **187
exact recordings / 45 collections**: Archive 01 had 163 recordings / 24 collections /
887,503,800 audio bytes, and Archive 02 had 24 recordings / 21 collections /
125,911,338 audio bytes. Later archive changes require a fresh count; older counts and
branch heads retained below are historical evidence.

The command-line intake launcher is on `main`: [PR #701](https://github.com/mekhovov/revealline/pull/701)
routes operators to the correct archive checkout, and
[PR #702](https://github.com/mekhovov/revealline/pull/702) supports a fail-closed
`--license unknown` private builder without publishing those bytes. Browser-first
private intake merged through [PR #706](https://github.com/mekhovov/revealline/pull/706)
as `e3baddb3ed59bbb698c02a8f97af52c01c79249b`:
one file selection or recursive folder selection becomes a reviewed, transactional
shuffle/repeat-all playlist; exact duplicate audio is stored once; Save collection
and play commits it atomically and starts it through the existing transport. Unknown
rights remain personal and cannot enter the public/share path. Exact-head review was
clean; 108/108 focused tests, deterministic localization, ESLint, Prettier and diff
checks passed. Hosted run
[36274331884](https://github.com/mekhovov/revealline/actions/runs/36274331884)
passed preflight, focused and release-ready gates; its full test/build jobs were
skipped by the accepted fast-release policy and are not passes. The source is on
`main` and remains eligible for the next successfully qualified cumulative release.
Public browser acceptance remains release work, estimated at 0.5 day hands-on plus
CI; it is not a prerequisite for merging this documentation.

**Live reconciliation — 26 September 2026:** immutable v0.132.3 is published and
the primary Pages selector serves it. Maintenance
[PR #634](https://github.com/mekhovov/revealline/pull/634) and read-only shadow run
36228680013 verified that its public tag, release object, merged release root and
predecessor bind to exact source `366ed9202efd77d82be124669680d3351bf5074f`.
Authoritative game `main` is now `8c2b5ddbf1e145437fc3cddf6a7a9f225502f830`:
the narrow v0.132.4 Team repair merged as
`d878a879848cea271f1098774ef897dfbf6d806f`, followed only by the soundtrack
ledger correction in PR #640. Archive-directory client PR #604 is rebased cleanly onto its then-current accepted base
`83df9cfc9d26b9c7191f3507ea5a8d4d9d36b347` at exact head
`f901f73377bc5a8466933f260e2c0828bcd3226c`. Its refreshed catalogue, host and
panel cohort passes 135/135 locally; ESLint, Prettier and diff checks pass.
Independent exact-head review found three release blockers: optional-shard commits
are not atomic, partial failures are not shown in the panel, and the aggregate can
exceed the player's 256-track queue limit. The current public archives reproduce
the first issue because both contain `peachtea.last-stand-lets-go` with different
hashes. PR #604 is frozen pending a release-coordinator-assigned correction.
Opening-theme fallback PR #617 advanced from independently reviewed source
`20f86fc7372fd02a626e5b74b778ab85ab396558` to merge-preserving head
`aa0a9f4cd2aa481deeefb4cf036d9e369baf4f16` and merged into `main` as
`756eae6c` on 27 September at 00:19:40 UTC. The three reviewed blobs remained exact;
opening/player/recovery tests passed 78/78, and hosted
[run 36281755779](https://github.com/mekhovov/revealline/actions/runs/36281755779)
passed preflight, focused and release-ready. Build and full-test jobs were skipped
and are not passes. The source repair is merged; immutable release and public/device
acceptance remain. PR #604 alone remains draft and blocked by its review findings.

Archive PR #41 publishes three more CC0 racing-synth auditions by MintoDog: Pure
Raceway, Pure Raceway (Climax) and Darkness Road (Remake). Exact-head verification
and Pages deployment passed, public byte-range/CORS checks passed, and direct
same-page playback started Pure Raceway. The archive now contains **163 unique
recordings / 24 collections / 887,503,800 audio bytes**, leaving 12,496,200 bytes
below Archive 01's 900,000,000-byte guard. All three remain listening-unapproved,
game-unadmitted and excluded from defaults. Archive 01 is now closed to new
substantial batches. HexaPuppies remains a
rights-cleared source-page lead; VOiD1's pack is excluded because its published
terms prohibit redistribution. Existing archive entries were checked first to
avoid duplicates.

Archive 02 [PR #1](https://github.com/mekhovov/revealline-soundtracks-02/pull/1)
merged as `32f1d0b9f7e8df3ca78e1fb761c56ea83a47f8cf` and publishes the exact
3,884,999-byte **runner2088** MP3 as its first overflow audition. Pages
[run 36226671256](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36226671256)
passed. Direct reads verified CORS, HTTP 206 byte ranges and SHA-256
`9924c6163116b0db94cc0c1878542d2576aac02051dd25f6ebb3b9767869cef9`; browser
playback continued after startup. Archive 01 PR #23 is closed as superseded because
the same file there would leave only 7,385,930 bytes, below the retained 8 MiB
safety reserve. Archive 02 remains undiscoverable by released game clients until
PR #604 and a reviewed archive-directory update are public.

Archive 02 intake [PR #2](https://github.com/mekhovov/revealline-soundtracks-02/pull/2)
merged as `abf22850cca477a3c214be6d410041193e026813`; Pages
[run 36227471951](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36227471951)
passed and the public guide exposes the one-file/folder command. The tool requires
explicit rights confirmation and complete decode, preserves exact bytes and
licence-bound metadata, generates every archive artefact, rejects duplicates and
unsafe capacity, keeps the 1 GiB reserve, serializes writers and can open the PR.
Six focused tests and an end-to-end real-MP3 smoke intake pass. Generated tracks
remain listening-pending and game-unadmitted.

Archive 02 audition [PR #3](https://github.com/mekhovov/revealline-soundtracks-02/pull/3)
merged as `b466df7caeca8f7081d54ab00ff8870cbc436043`; exact-head verification
[run 36227931382](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36227931382)
and Pages [run 36227956411](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36227956411)
passed. It publishes three full-length 256 kbps MP3 derivatives: **Sky Trance,
Cyborg Destiny & Low Pridox** (CC BY 3.0), **Cyber Power Mix** (CC BY 4.0), and
**Blue Beat, Electronic Escape, Cyborg Destiny & Singularity** (CC BY-SA 4.0).
All source OGGs decoded completely; exact native and derivative hashes, credits,
change notices and loudness/peak measurements are retained. Direct public checks
verified four catalogue rows, CORS, HTTP 206 byte ranges and same-page Next from
Cyber Power Mix to Sky Trance. All remain listening-pending, Recording-mode
ineligible and game-unadmitted.

Archive 02 electro [PR #4](https://github.com/mekhovov/revealline-soundtracks-02/pull/4)
merged as `1715417f408eebf2d5b9b0a0698a86d9ed1db6c9`; exact-head verification
[run 36228465207](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36228465207)
and Pages [run 36228503805](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36228503805)
passed. It publishes the 3:01 **Hit the Womp! Mix** under CC BY-SA 4.0 with
exact native/derivative hashes, credits, derivative notice and measured loudness.
Public reads verified its 5,805,442-byte object with HTTP 206/CORS; browser playback
advanced to 0:04. It remains listening-pending, Recording-mode-ineligible and
outside game defaults. Archive 02 now holds six recordings / six collections /
34,930,366 audio bytes.

Archive 02 rhythm audition [PR #5](https://github.com/mekhovov/revealline-soundtracks-02/pull/5)
merged exact head `34876e072cdea2e5abae53baa0c4b95413964428` as
`9cf7227422286db1da7f9130fcd0fa6724c8dea4`; exact-head verification
[run 36229207548](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36229207548)
and Pages [run 36229239473](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36229239473)
passed. It publishes the 3:17, 174 BPM **Ripped Apart** by Tricks & Traps under
CC0. The exact 34,798,604-byte WAV source and 6,313,822-byte 256 kbps MP3
derivative hashes are retained. Direct reads verified the exact public hash, CORS
and HTTP 206 byte ranges; browser interaction started same-page playback. It
remains listening-pending, Recording-mode-ineligible and outside game defaults.

Archive 02 browser-first intake
[PR #22](https://github.com/mekhovov/revealline-soundtracks-02/pull/22)
merged exact reviewed head `8e04d18489714e06fdc8dc85b7366e20e60ea9b7`
as `0ad87992ab94b58090dd5e239fdf1d51ff9c75ee`. Hosted exact-head
[run 36275364318](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36275364318)
passed the complete archive verifier and Pages assembly; main Pages
[run 36275418645](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36275418645)
passed verification and deployment. The public page now prepares one rights-bound
`.rlintake` package from selected MP3s or a folder; a maintainer admits it with one
command through the existing reviewed PR boundary. It rejects unsupported or mixed
rights, unsafe bounds, changed inputs and packages that change while read. Public
reads verified the exact deployed JavaScript hashes, the guide and unchanged
20-recording catalogue. GitHub Pages remains a static client and deliberately stores
no repository token. Unknown-rights audio uses the game's private collection flow.

Archive 02 synth/house audition
[PR #23](https://github.com/mekhovov/revealline-soundtracks-02/pull/23)
merged exact reviewed head `854656619d2b103f1d26e6b8f8a56a0348facc61` as
`bd195f3865fe982b367186fb997aae6ba5a90b4a`. Exact-head hosted
[run 36276577886](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36276577886)
passed the full immutable verifier; main Pages
[run 36276643880](https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/36276643880)
passed verification and deployment. It publishes **Battle in the Stars**, **Rain of
Lasers**, **Space Heroes** and **Without Fear** by Oblidivm as CC BY 3.0 auditions.
The public archive and generated future batch pages show the exact required credit
and conversion/adaptation notice. Direct browser playback, exact catalogue hashes,
CORS and HTTP 206 byte ranges passed. The recordings remain listening-pending,
Recording-mode-ineligible, game-unadmitted and excluded from defaults.

Local free space is about **0.24 GiB**, below the required 1 GiB floor even after
removing the task-owned scratch for the published Oblidivm batch. Pause all new local
media acquisition, conversion and builds until coordinated cleanup restores the
floor. Continue rights research, review, small source/docs edits and hosted CI;
preserve user changes, frozen releases and evidence.

1. **v0.132 Pages completion:** complete. Selector
   [PR #592](https://github.com/mekhovov/revealline/pull/592) merged as
   `d38624a594751bd304779cd25f0225c96413ff02`; exact-merge Pages
   [run 36214429148](https://github.com/mekhovov/revealline/actions/runs/36214429148)
   passed assembly and deployment. Direct reads confirm `release.json` selects
   v0.132.0 and both `/app/` and `/releases/v0.132.0/site/game/` return HTTP 200.
2. **M8 stream recovery:** desktop delivery is complete in v0.130.0. Merged test-only
   [PR #555](https://github.com/mekhovov/revealline/pull/555) now protects the real
   remote-stall → included-fallback → remote-retry → included-switch sequence and
   catalogue 503 → Refresh recovery. A fresh public v0.132 profile exposed a separate
   opening-theme failure: Shchedryk remained in `Loading music…`, its bounded fetch
   ended with `Album download or verification timed out`, and Next could not escape
   the pending attempt. [PR #617](https://github.com/mekhovov/revealline/pull/617)
   superseded closed stale PR #597 and merged from exact head
   `aa0a9f4cd2aa481deeefb4cf036d9e369baf4f16` as `756eae6c`. The fallback is now owned by the
   transport, so a muted first visit can defer acquisition until Play and still
   recover to `builtin.all`; a newer user selection cancels the one-shot fallback.
   Opening/player/recovery tests passed 78/78; focused ESLint, Prettier and diff
   checks passed. Independent review was clean, including a stronger race where the
   newer selection itself reached error before the stale opening read settled.
   Hosted run 36281755779 passed preflight, focused and release-ready. Build and full
   tests were skipped and are not passes. Immutable release, direct public recovery,
   cold-offline and physical-device acceptance remain.
3. **M3 quick controls:** replacement PR #516 is public in v0.130.0. Physical B/N,
   touch and controller acceptance remains.
4. **M1/M2 soundtrack admission and opening theme:** aggregate #518 and theme #519
   are public in v0.130.0. Shchedryk full-track/repeated listening, cultural,
   cold-offline and physical-device acceptance remain. M4–M6 research continues in
   parallel.
5. **M6 full-length metal review:** review seven already-public, exact-source
   David KBD recordings from Interstellar and Purgatory before shorter pending
   Reckless auditions. Four exact Reckless vol. 2 auditions are now public through
   archive PR #27. They require no new media download, but remain unadmitted,
   Content-ID-unknown and Recording-mode-ineligible until full listening, transition,
   warning-audibility and gameplay review.
6. **M5/M6 new public auditions:** archive PR #33 publishes five metal-energy and
   three action-synth candidates. Archive
   [PR #35](https://github.com/mekhovov/revealline-soundtracks-01/pull/35)
   adds Heavy Battle 1, Cybershaman, Empacotatron and Hail the Arbiter as exact,
   rights-cleared listening auditions. Review those full tracks before any game
   admission. Publication does not place them in Automatic/default playlists.
   The next rights-researched metal slate is **Dragged Through Hellfire
   (Abomination)**, **The Wreck**, **The Recon Mission**, **Heavy Boss Battle 1**,
   **Fight Them Until We Can't** and, as a
   lower-fit vocal/no-Content-ID wildcard, **Burzum**. The first five match the
   requested rhythmic/heavy direction more closely but retain unknown Content ID
   status. Exact CC0/CC BY source routes are recorded; acquisition is paused while
   local free space remains below 1 GiB. Newer David KBD packs remain excluded from
   public standalone archives because their pack terms prohibit standalone audio
   redistribution despite the displayed Creative Commons labels. **German
   Industrial Metal** was excluded from this new slate because the exact recording
   is already present in the immutable core catalogue.
7. **M4 Ukrainian Commons auditions:** archive
   [PR #36](https://github.com/mekhovov/revealline-soundtracks-01/pull/36)
   publishes **Oi u luzi chervona kalyna**, **A v kryvoho tantsia** and
   **Oi khodyt son kolo vikon** as exact CC BY 3.0 derivatives. Exact hosted source
   run `36067125672`, native WebM hashes, source snapshots, derivative disclosures,
   complete decode and loudness evidence are retained. Listening, cultural and
   gameplay review remains pending; Content ID is unknown, Recording mode is off,
   and none is admitted to the game.
   The next recording-level Commons slate is now researched: Lysenko's
   [Zaporozky March](https://commons.wikimedia.org/w/index.php?curid=38972476),
   Karabyts' [Dysko-khorovod](https://commons.wikimedia.org/wiki/File:Karabitz-dysko-khorovod.ogg),
   Jason Shaw's instrumental
   [Shchedryk](<https://commons.wikimedia.org/wiki/File:Shchedryk_(Carol_of_the_Bells)_-_Instrumental.ogg>),
   Mykluho Maklay's
   [Cossack Nechai song](https://commons.wikimedia.org/w/index.php?curid=59396762)
   and [Oi Moroze Morozenku](https://commons.wikimedia.org/w/index.php?curid=59396314),
   the Transcarpathian choir recordings
   [Na vulytsi skrypka hraye](https://commons.wikimedia.org/w/index.php?curid=175269901)
   and [Letiv ptashok](https://commons.wikimedia.org/w/index.php?curid=175269770),
   and Lysenko's
   [Dumka-Shumka](https://commons.wikimedia.org/wiki/File:Lysenko-Rhapsody-No._2.flac).
   Zaporozky March is the strongest new instrumental gameplay lead; Shaw's
   Shchedryk is the closest clean alternate to the approved Nakarada direction.
   CC BY-SA recordings require an asset-specific ShareAlike/EULA/DRM delivery
   decision and retained VRT confirmation where applicable. Vocal recordings start
   as menu/lore candidates because they can mask warnings. All require Content ID
   preflight and Ukrainian cultural listening; acquisition is paused below the disk
   floor. Hellscore's folk-metal **Tsvite teren** remains held as all-rights-reserved.
8. **Archive scale-out:** archive
   [PR #34](https://github.com/mekhovov/revealline-soundtracks-01/pull/34)
   publishes a bounded directory for one to eight numbered immutable archives.
   Draft game [PR #604](https://github.com/mekhovov/revealline/pull/604)
   loads that directory, merges trusted shards and preserves the primary archive as
   a hardcoded fallback. It was last rebased on accepted main
   `83df9cfc9d26b9c7191f3507ea5a8d4d9d36b347` at exact head
   `f901f73377bc5a8466933f260e2c0828bcd3226c`. The refreshed catalogue, host and
   panel cohort passes 135/135 locally; ESLint, Prettier and diff checks pass.
   Independent exact-head review requires three corrections before fresh hosted
   gates: stage and validate each optional shard before committing it to the
   aggregate; visibly report optional directory/shard failures and preserve their
   reason; and bound/page playback so an aggregate above 256 tracks can still start
   one selected row or a bounded queue. Add a real Archive 01 + Archive 02 collision
   regression for `peachtea.last-stand-lets-go`, a degraded-panel regression, and a
   greater-than-256 aggregate regression. Full tests and build stay subject to the
   release owner's allocation; any skip is not a pass. Archive 02
   now publishes six recordings independently, but do not add it to the public
   directory until that client is released. Archive PR #41 raises Archive 01 to 887,503,800 audio bytes; its exact
   runner2088 rebase proved the retained 8 MiB reserve would be violated, so do not
   place another batch there.

The latest public/general GitHub release at this checkpoint is
[v0.132.3](https://github.com/mekhovov/revealline/releases/tag/v0.132.3). The latest
reviewed Pages selector is
[PR #633](https://github.com/mekhovov/revealline/pull/633). Direct public reads
confirm the primary selector serves v0.132.3.
Authoritative `main` is `d878a879848cea271f1098774ef897dfbf6d806f`;
v0.132.3 is public and does not contain a new soundtrack feature. Its exact source
binding is validated by merged maintenance PR #634 and read-only shadow run 36228680013. Preserve v0.132.3 immutably.
v0.132.0 and its
preceding selector-mismatch evidence remain immutable historical evidence.
The soundtrack's 140-row and mixed-stream desktop acceptance remains evidence from
v0.130.0; do not infer a second soundtrack qualification for v0.132.0.
The historical #333/#331/#439 stacks remain implementation history; their selected
successors are represented in the frozen aggregate. Skipped full shards under the
explicit fast-release policy remain exclusions, never passes.

### Blocked and held

- Release publication is temporarily serialized behind v0.132.4. Its narrow Team
  picture-preparation repair [PR #638](https://github.com/mekhovov/revealline/pull/638)
  merged as `d878a879848cea271f1098774ef897dfbf6d806f`, and the subsequent PR #640
  changed documentation only. The cumulative terminal source still requires fresh
  immutable qualification, publication, selector deployment and direct public Team
  verification by the sole publisher. Guard
  [PR #632](https://github.com/mekhovov/revealline/pull/632) remains merged and
  refuses mismatched release objects. Resume soundtrack allocation only after the
  publisher accepts the public repair.
- Physical-device/controller and cold-offline qualification remain open after
  scoped desktop acceptance. The initial selector's failed reread is retained as
  failure evidence; the successful successor closes that publication blocker.
- Cold-offline browser acceptance must reuse the now-public stable `/app/` launcher
  and official content store merged through
  [PR #536](https://github.com/mekhovov/revealline/pull/536) and released in
  v0.132.0. Its zero-MP3 required core keeps Shchedryk in the optional soundtrack
  group; verify the resulting first-run fallback and installed-theme behavior
  rather than assuming the earlier bundled opening-theme exception is present
  offline.
- Public v0.132 first-run evidence shows the optional Shchedryk acquisition can time
  out while the explicit opening playlist owns the queue. PR #617 merged the bounded
  fallback to available built-in music after 78/78 opening/player/recovery checks and
  clean independent review. Hosted preflight, focused and release-ready passed;
  build/full-test skips are not passes. Immutable release and direct public/device
  acceptance remain.
- Historical inputs #321, #331, #333 and #439 are closed and superseded by merged
  replacements #518, #516 and #519, which are public in v0.130.0. Their earlier
  failures and focused checks remain historical evidence; skipped jobs are not
  passes. Physical-device and cold-offline acceptance remains incomplete.
- Musical, transition, warning-audibility, cultural and physical-device evidence
  cannot be replaced by transport tests. UA-FPV public redistribution still needs
  recording-specific permission; the four private packs remain available.
- The four public PR #25 synth recordings, four public PR #26 Purgatory recordings,
  four public PR #27 Reckless recordings and eight public PR #33 energy/action-synth
  recordings, plus the four public PR #35 action-metal/electro recordings, are
  listening-unapproved and
  unadmitted. Their human listening and
  admission review gates have no committed ETA.
  Do not publicly redistribute Pixabay or UA-FPV recordings without exact-recording
  permission. Shchedryk remains excluded from Recording mode because of Content ID.
- Local free space was rechecked on 27 September and is **about 26 GiB**, above the
  1 GiB floor. Preserve reachable objects, branches, worktrees, user changes,
  frozen releases and evidence; continue enforcing the floor before media intake
  or local builds.

### Deferred

M9's full existing-catalogue curation and M10's broader expansion follow the core
styles. M11's rejected local AI-production method remains paused, with **0/36**
originals approved. No deadline is assigned to unresolved rights or paused music.

### Current execution snapshot

- Archive directory [PR #34](https://github.com/mekhovov/revealline-soundtracks-01/pull/34)
  merged as `63299ef6b9b963696c57f96f1dfdf47aa4ad1aa9`; Pages
  [run 36219306789](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36219306789)
  passed. Direct reads verified the exact v1 directory, primary-first/required
  binding and CORS. Game [PR #604](https://github.com/mekhovov/revealline/pull/604)
  is frozen at exact head `f901f73377bc5a8466933f260e2c0828bcd3226c` on its
  then-current accepted base `83df9cfc9d26b9c7191f3507ea5a8d4d9d36b347`.
  Its refreshed 135/135 local cohort and scoped static checks pass. Independent
  review requires atomic optional-shard commits, visible degraded-state reporting
  and bounded playback above 256 aggregated tracks before fresh hosted gates and
  public Archive 02 activation. Historical exact-head
  [run 36229527056](https://github.com/mekhovov/revealline/actions/runs/36229527056)
  passed preflight and the nine archive-directory tests, then failed the existing
  Solo host assertion `Actual binary preparation finishes` after 20/21 host tests
  passed. Preserve that dated failure evidence; skipped full test/build jobs are
  not passes.
- Archive [PR #35](https://github.com/mekhovov/revealline-soundtracks-01/pull/35)
  merged as `00ef4e64a158f2e73d9b431556034f1a04b28541`. PR verification
  [run 36219990636](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36219990636)
  and Pages [run 36220092708](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36220092708)
  passed. Direct reads verified 152 unique recordings, 841,132,228 audio bytes,
  all four new rows, a playable batch page, CORS and a 206 byte-range MP3 response.
  These recordings remain listening-unapproved and outside the game catalogue.

- Unified archive delivery is split into two reviewable changes. Archive
  [PR #14](https://github.com/mekhovov/revealline-soundtracks-01/pull/14) merged as
  `03a31a8b0f6e478b097b4468aaca92dfa275158c` and established the immutable
  104-recording `catalogue.json` baseline, one searchable/playable root
  player and the bounded `intake/add-music.mjs` workflow documented in
  `UPLOAD_GUIDE.md`. Archive PRs #18/#19 added 24 separately evidenced auditions;
  PR #25 added four listening-pending synth auditions and PR #26 added four
  listening-pending Purgatory auditions. Live archive main
  `cc7777bb62981ea9739a8efbc67f658f16f49a3f` now serves 140 unique recordings
  across 15 collections with 790,408,183 audio bytes. Hosted intake
  [PR #28](https://github.com/mekhovov/revealline-soundtracks-01/pull/28)
  prepared eight exact, nonduplicate metal/action-synth candidates using source-page
  snapshots, native hashes, complete decode, loudness evidence and listening-pending
  derivatives. Publication [PR #33](https://github.com/mekhovov/revealline-soundtracks-01/pull/33)
  merged as `29a3fb332c2b85638fa7d473971585a30d42e818` after the exact hosted artifact,
  all source bindings and the append-only 140-recording baseline were independently
  checked. Exact-head archive
  verification for the 104-recording baseline passed 32/32 checks. Direct
  public verification of that baseline covered text search, all eight
  then-current collections, single and
  combined style filters, shuffle/sequential order, repeat all/one/off, same-page
  playback, Media Session, CORS and an exact byte-range MP3 response. Game
  [PR #370](https://github.com/mekhovov/revealline/pull/370) adds the matching
  trust boundary and native Music Player browser, so a result streams through
  the existing transport without opening another page. Players can select one
  or several styles, start any result, choose shuffle or sequential order and
  choose repeat all, repeat one or a finite queue. Its combined catalogue,
  player, panel and host cohort passes 184/184 tests; production history and recipe
  source checks pass 14/14. Review found and the
  successor fixes close Recording-mode bypass, wrong-repository URL acceptance,
  unbounded response consumption, invalid-selection mutation and two follow-on
  policy-transition cases. The v0.110.1 reconciliation keeps current main's picture
  authority and version unchanged; Field Kit revisions 75–77 preserve main revision
  74 and bind the reviewed audio fingerprints. Local native-browser playback
  exposed the then-current 128 recordings and 12 collections, filtered the search to Cyber Anxiety,
  exposed all eight style selectors plus shuffle/sequential and repeat controls, and
  streamed Cyber Anxiety through the shared in-game transport while the game URL
  remained unchanged. Neither
  PR admits previews into trusted Automatic/built-in playlists or establishes
  musical approval. Fresh selective-port, live-count, production and focused-test
  evidence is recorded in
  `docs/verification/online-soundtrack-reconciliation-2026-09-25/review.json`.
  This pre-release source evidence is now followed by merged
  [PR #370](https://github.com/mekhovov/revealline/pull/370) at
  `3883259987913cb646eb44cf2580083dad673a70` and immutable
  [v0.111.0](https://github.com/mekhovov/revealline/releases/tag/v0.111.0), published
  25 September at 03:42:18 UTC. Merged-source qualification and freeze
  [36090144780](https://github.com/mekhovov/revealline/actions/runs/36090144780),
  original-artifact inspection
  [36090842226](https://github.com/mekhovov/revealline/actions/runs/36090842226),
  evidence assembly
  [36090978739](https://github.com/mekhovov/revealline/actions/runs/36090978739)
  and original-asset upload
  [36091145327](https://github.com/mekhovov/revealline/actions/runs/36091145327)
  passed. The annotated tag binds that exact merge; all nine release assets are
  published. Long test shards remain explicitly waived under the temporary
  fast-release policy, not passed. The controlled selector rollout and scoped
  primary desktop acceptance are complete below. Remaining verification covers
  mixed styles, order/repeat, fallback, cold-offline and physical-device/controller
  behavior; the Archive76 preservation check remains separately scoped.
- The first v0.111.0 selector [PR #473](https://github.com/mekhovov/revealline/pull/473)
  merged at `c7990977f49d40e79873782a219e4d4dc47c8890`. Production
  [run 36093864955](https://github.com/mekhovov/revealline/actions/runs/36093864955)
  failed only at **Independently reread every prepared artifact byte** because
  v0.111.1 had become the latest stable release while the reviewed selector still
  selected v0.111.0. Deployment was skipped; preserve that failure as a correct
  refusal, not a broken public deployment. The release coordinator exclusively
  owns Archive76 preservation of v0.111.0 and replacement selector
  [PR #476](https://github.com/mekhovov/revealline/pull/476). Its initial gate failed
  pending Archive76 evidence admission; refreshed head
  `9b452c97cda8c9f1a8c3c438474f72805c515f97` passed preflight/release-ready checks and
  merged at `16e111973943cdabdcccacf114228eaac3abfc98`. Main-only Pages
  [run 36095346816](https://github.com/mekhovov/revealline/actions/runs/36095346816)
  passed frozen-selector validation, the full **4,592-file / 628,700,337-byte**
  assembly, independent artifact reread and deployment. Deferred publisher tests
  and skipped test/build/release-gate jobs remain exclusions, not passes.
  Archive75's v0.110.1 preservation is complete: exact-main
  [run 36092159068](https://github.com/mekhovov/revealline-archive-75/actions/runs/36092159068)
  passed, all 1,145 public files / 595,478,020 bytes matched with zero failures,
  and scoped Solo/Versus/Team browser checks passed. Retain
  `publishing/pages-controller/evidence/archive-75-v01101/public-acceptance.json`;
  its browser evidence does not claim physical-device or comprehensive offline checks.
- Archive76 [PR #1](https://github.com/mekhovov/revealline-archive-76/pull/1) merged.
  Exact main `d1c19658d55dca7d3e1d13499673512923a623e0`, tree
  `7c407f2ac8662f7838c7126bbc704b73decc6a6d`, passed Pages
  [run 36094583007](https://github.com/mekhovov/revealline-archive-76/actions/runs/36094583007);
  deployment `6653723980` / status `18818234941` succeeded. The archive root and
  [preserved v0.111.0 game](https://mekhovov.github.io/revealline-archive-76/releases/v0.111.0/site/game/)
  returned HTTP 200. Direct Codex desktop-browser interaction loaded **128/128**
  public recordings in Music library, searched **Carol** to one result and played
  Nakarada's Carol of the Bells on the same game page. Playback advanced to
  **2.9 seconds / 4:30** with source, licence and filename visible. This is scoped
  public browser transport evidence, not full-track listening, a physical-device
  result, cold-offline verification or primary-selector acceptance.
- Primary-site acceptance after that successful deployment used the
  [v0.111.1 game](https://mekhovov.github.io/revealline/releases/v0.111.1/site/game/)
  in the Codex desktop browser. Music library loaded **128/128** public recordings;
  searching **Carol** showed **1/128**, and same-tab playback advanced to
  **0:02 / 4:30** with creator, licence and filename visible. Root, v0.111.1 and
  v0.111.0 routes returned HTTP 200; release and source download URLs returned
  range HTTP 206. The primary-selector publication blocker is complete. This
  scoped result does not approve musical quality or replace full-track listening,
  physical desktop/iPhone/controller checks or cold-offline qualification.

### 25 September checkpoint — structured rights and 136-track public archive

#### Game compatibility and stream-recovery repair

- Public v0.115.1 reproduced the exact fail-closed message
  `online soundtrack track.rights is not supported` after the archive began
  emitting structured rights for new recordings. The existing game adapter accepted
  only the legacy key set, so one valid newer row rejected the complete catalogue.
- Merged game [PR #523](https://github.com/mekhovov/revealline/pull/523), with final
  feature head `35d36fe5e4c2d5b6445f7541be49e87a1826e126` and merge commit
  `46d65e0ec7493c4fcaab88c4c00ce6dd3f0b210a`, strictly
  validates the optional structured rights object against the already trusted
  licence, source and credit. It preserves legacy compatibility and adds CC BY-SA
  delivery validation without granting admission, default-playlist or Recording-mode
  authority.
- The same repair keeps remote archive recordings on one persistent media element,
  because WebKit playback permission is element-specific. Included and uploaded
  MP3s retain their two-deck crossfade. A bounded progress watchdog skips or falls
  back from a stalled remote recording while preserving listening intent, and the
  archive player can combine trusted remote results with the current included and
  uploaded selection.
- Independent review found and the successor commit closes initial `play()`-promise
  stalls, missing ShareAlike delivery terms and Recording-mode loss of included
  tracks from a mixed queue. The live catalogue resolves **136/136** records,
  including all eight records with structured rights. Focused
  catalogue/player/panel/recovery tests pass **177/177**.
  In a real desktop browser, Holizna's Drama streamed for 13.5 seconds, Next moved
  to included Raspberry Jam, and selecting Cyber Anxiety returned to a remote
  stream in the same game tab. The public archive returned CORS-enabled immutable
  MP3 bytes with byte-range support.
- Release qualification/freeze [run 36178689258](https://github.com/mekhovov/revealline/actions/runs/36178689258)
  and strict frozen inspection [run 36179711241](https://github.com/mekhovov/revealline/actions/runs/36179711241)
  passed on the actual aggregate. The immutable v0.130.0 release contains the nine
  reviewed assets; selector PR #538 and Pages run 36184029594 deployed the same
  release. Direct public verification repeated 136/136 catalogue parsing, sustained
  Drama playback to 0:27, bundled Shchedryk playback to 0:09 and streamed Cyber
  Anxiety playback to 0:14 in one session with no warning/error log. Physical
  iPhone/controller and cold-offline checks stay separate.

- Archive [PR #24](https://github.com/mekhovov/revealline-soundtracks-01/pull/24)
  merged as `9eb606ce78d82a24b7771d596aa3488611730117`. It adds a
  fail-closed structured rights contract for new recordings, including exact
  licence identity/version, rights-evidence URL, attribution, truthful derivative
  notice and compatible ShareAlike delivery terms. Metadata-free compatibility is
  limited to twelve deployment-pinned historical identities; unknown and future
  recordings require the structured contract. Existing audio bytes and musical
  decisions were unchanged. Exact-merge Pages
  [run 36117606837](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36117606837)
  passed verification and deployment.
- Archive [PR #25](https://github.com/mekhovov/revealline-soundtracks-01/pull/25)
  merged as `007cbf6ddb52c0f754956d2eedabf3ffaa924022` and published
  **90s Racer Techno**, **Neon Pulse**, **Prismatic Light** and **Future Travel**.
  Exact-merge Pages
  [run 36147468099](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36147468099)
  passed verification and deployment. The public catalogue returned HTTP 200,
  165,191 bytes and `Access-Control-Allow-Origin: *`; it declares **132 unique
  recordings across 13 collections** and 761,327,907 audio bytes. A direct range
  request for 90s Racer Techno returned HTTP 206, `audio/mp3`, CORS `*`, exactly
  1,024 bytes and `Content-Range: bytes 0-1023/5535495`, proving the deployed
  object supports the byte-range transport used by the player.
- All four PR #25 recordings remain `listeningApproval: not-reviewed`,
  `gameCatalogueAdmission: false`, `default: false` and
  `recordingModeEligible: false`. Their public availability is an audition and
  transport milestone, not musical approval, game admission or a default-playlist
  change.
- Archive [PR #22](https://github.com/mekhovov/revealline-soundtracks-01/pull/22)
  (Reckless punk-metal source intake) merged as
  `4f9ac1c1179d768bb851b63dd8cee6a604897fc5` after independent review found and
  repaired omitted transitive pin-file bindings and mislabeled loop-end metadata.
  Local bounded verification passed binding 2/2, Reckless 9/9, complete intake
  146/146, manifest and diff checks. Exact-head verify, Reckless prepare and all four
  transitive source checks passed in runs 36193952164, 36193952191, 36193952156,
  36193952174, 36193952176 and 36193952177; event-inapplicable publication jobs
  were skipped and are not passes. Artifact 10889860079 is 20,781,317 bytes with
  ZIP SHA-256 `00211751f1701748948ca922c589120ad15db47b512b7bab15ca691a082bbc72`.
  Independent in-memory inspection matched all 17 members, exact native/delivery
  sizes and hashes; ffmpeg completely decoded all four OGG originals and four MP3
  derivatives, each at −16.00 LUFS and ≤−6.18 dBTP. No bytes were written locally.
  The merge adds reproducible intake only: no public audio, catalogue row, listening
  approval, game admission, default or Recording-mode eligibility changed. Its
  four exact derivatives were later published as auditions through PR #27, as
  recorded below. Archive 01
  [PR #23](https://github.com/mekhovov/revealline-soundtracks-01/pull/23)
  (runner2088 retrowave) is closed as superseded. Its exact MP3 is public through
  Archive 02 PR #1 because an Archive 01 rebase would violate the retained 8 MiB
  safety reserve. Reckless still needs listening and game-admission review;
  publication and listening time remain additional. Purgatory vol. 3 source preparation merged through
  [PR #21](https://github.com/mekhovov/revealline-soundtracks-01/pull/21) as
  `41ea4448cf9602960ada28cd2c7c9a4cd5cb6b38`; its four-track exact artifact is
  technically reviewed. Publication
  [PR #26](https://github.com/mekhovov/revealline-soundtracks-01/pull/26) merged as
  `824e34e4957ab29b7ef841115f631a579f741fc4`. Its draft exact-head verify/source checks
  [36149040244](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36149040244),
  [36149040063](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36149040063)
  and [36149039993](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36149039993)
  passed; event-inapplicable deploy/prepare/assemble jobs were skipped and are not
  passes. Exact-merge Pages
  [run 36160861165](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36160861165)
  passed verify and deploy at that merge. Direct public verification returned a
  174,470-byte CORS-enabled catalogue declaring **136 unique recordings across 14
  collections** and 777,523,163 audio bytes. A Visceral Vengeance byte-range request
  returned HTTP 206, `audio/mp3`, CORS `*`, exactly 1,024 bytes and
  `Content-Range: bytes 0-1023/3673069`. All four appended recordings remain
  `listeningApproval: not-reviewed`, `gameCatalogueAdmission: false`, `default: false`
  and `recordingModeEligible: false`. GitHub exposes no formal PR review entry, so
  this ledger records the exact merge, checks and public result without inventing an
  independent approval. Publication does not establish musical or game admission.
- Archive [PR #27](https://github.com/mekhovov/revealline-soundtracks-01/pull/27)
  merged as `cc7777bb62981ea9739a8efbc67f658f16f49a3f` and published
  **City Limits Crash**, **Edge of the City**, **Defiant Descent** and
  **Airborne Anarchy** from David KBD's Reckless vol. 2. The publication binds the
  exact PR #22 source artifact and preserves all four rows as
  `listeningApproval: not-reviewed`, `gameCatalogueAdmission: false`,
  `default: false` and `recordingModeEligible: false` while Content ID remains
  unknown. Final exact-head checks passed at `9adbeb6f7d8a3a81083338ee5e5cb6c5e9f28ab9`;
  independent review confirmed the unchanged 136-row prefix, exact object hashes,
  the 136→140 catalogue transition and a closed generated-source verification path.
  Preserve the cancelled/failed runs 36195988669, 36196391249, 36196839168 and
  36197360034 as evidence of the staging, generated-state and shallow-checkout
  defects that the final workflow repaired. Exact-merge Pages
  [run 36197838016](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36197838016)
  passed verification and deployment. Direct public checks returned catalogue SHA-256
  `c8f0b4192b9736a9dfdfefc7cf8ce37b9650cf84a2a64f03ee07097445d7decf`,
  **140 unique recordings / 15 collections / 790,408,183 audio bytes**, CORS `*`,
  and HTTP 206 with `Content-Range: bytes 0-1023/3330342` for City Limits Crash.
  Same-page browser playback advanced that recording beyond 76 seconds, then Next
  switched to another archive recording which continued beyond 4 seconds. This is
  transport evidence, not musical approval or game admission. The public v0.130.0
  game then loaded **140 of 140**, exposed all 15 collections and played City Limits
  Crash through the in-game transport beyond 11 seconds while the game URL remained
  unchanged.
- Authoritative game GitHub state has
  [PR #370](https://github.com/mekhovov/revealline/pull/370) merged as
  `3883259987913cb646eb44cf2580083dad673a70` and
  [v0.111.0](https://github.com/mekhovov/revealline/releases/tag/v0.111.0)
  published as the public soundtrack archive player. Published v0.131.0 source is
  `a63ad4cc32fb14c53fa126d69df42e2e53d1477d` and includes docs-only plan
  [PR #568](https://github.com/mekhovov/revealline/pull/568). Soundtrack regression
  PR #555 remains merged in its ancestry. Later source or game releases do not
  convert archive auditions into trusted built-ins or defaults.
- UA-FPV remains on its recording-specific public-redistribution rights hold; its
  four private import packs remain available. The rejected local AI-production
  method remains paused with **0/36 originals approved**.
- M0 was merged through docs-only PR [#330](https://github.com/mekhovov/revealline/pull/330)
  at commit [efacbf087](https://github.com/mekhovov/revealline/commit/efacbf087eb9e1d15019f0d6aecd5ae32ac313fa).
  Plan consolidation is complete; implementation and evidence updates continue here.
- M1/M2/M3 successors #518, #519 and #516 are merged and public in v0.130.0.
  v0.130.0 exact source `5022108ca458e9355e9567efddfee50fb49af5c1`
  passed qualification/freeze run 36178689258 and strict inspection run 36179711241.
  Public desktop acceptance covered 136/136 archive loading and remote → bundled
  Shchedryk → remote playback. Remaining acceptance is physical B/N/touch/controller,
  full-track/repeated Shchedryk listening, Ukrainian cultural review and cold-offline
  behavior. Historical draft heads remain evidence and must not be revived.
- Archive [PR #4](https://github.com/mekhovov/revealline-soundtracks-01/pull/4)
  merged at 62dfd72d561621218c63443b6ab621f6f67d46cc and acquired two Nakarada
  auditions through the existing hosted intake. Separate
  [PR #5](https://github.com/mekhovov/revealline-soundtracks-01/pull/5) merged at
  962b62f21df75ca81c84deceaf44c32b1d79ff28: its source-bound itch.io metadata
  resolver covers six synth and four metal candidates without acquiring their audio.
- Archive [PR #6](https://github.com/mekhovov/revealline-soundtracks-01/pull/6)
  merged at 40a283d9a2ed2f5a00837ae60273f3884a52e706. The Dobermann and Folklore
  preview retains exact native sources, licence snapshots and technical receipts.
  Independent artifact review and all 20 archive/preview member hash checks passed.
  Pages [run 35953352751](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35953352751)
  passed. Direct verification matched the live manifest and all nine servable member
  hashes, including both full MP3s. In-app browser playback advanced for both tracks;
  Next switched songs and Pause changed the action to Resume music. The .nojekyll
  control file returned HTTP 404 and remains an explicit partial-check exception.
  Full-track listening, game admission and physical device acceptance remain; neither
  recording is classified as Ukrainian.
- Archive [PR #7](https://github.com/mekhovov/revealline-soundtracks-01/pull/7)
  integrated bounded hosted acquisition and merged at ada6a708222de9e399a36751e9aecef4238c746a.
  [Run 35953731494](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35953731494)
  passed all 49 intake tests and acquired all ten recordings: six DOS-88/escp synth
  and four David KBD metal. Full decoding, exact source/native bindings and
  permitted-derivative loudness/true-peak checks passed. At acquisition all ten were listening-pending; the six synth
  recordings are now rejected as recorded under M5.
- Archive [PR #8](https://github.com/mekhovov/revealline-soundtracks-01/pull/8)
  merged at 3bf8e97c9f6d6303582a09fbe67fd93cc4d1fce5 with two separately sized
  audition collections. [Production evidence](https://github.com/mekhovov/revealline-soundtracks-01/tree/3bf8e97c9f6d6303582a09fbe67fd93cc4d1fce5/intake/archive/itch-core-audition-20260924)
  preserves ten native originals, normalized MP3s, source/licence receipts and
  pending reviews. Independent metadata/publication and artifact/byte reviews
  passed; unchanged player/style bytes and every older archive file are preserved.
  After PR #8, archive totals were **96 recordings / 519,645,620 audio bytes / 520,152,260 public
  bytes**, across the original catalogue and five added batches. These are historical archive
  counts, not new game admissions.
  Pages [run 35954930019](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35954930019)
  passed verification and deployment. [Direct public evidence](https://github.com/mekhovov/revealline-soundtracks-01/pull/8#issuecomment-5807596591)
  matches both deployment manifests and all 24 servable members, including ten
  complete MP3s, by exact bytes/hash. The two .nojekyll control files are explicit
  exclusions, not HTTP passes. In-app browser checks advanced Crash Landing →
  Race to Mars and The Desolation of a Civilization → Agony Space-deep with
  readyState 4 and no media error; Next changed title/source and Pause set paused
  with the Resume label in both collections. [Independent publication review](https://github.com/mekhovov/revealline-soundtracks-01/pull/8#issuecomment-5807551144)
  is retained. Full listening and physical-device checks remain for candidates
  still being considered; only musically accepted recordings may proceed to game
  admission. M5 records the subsequent rejection of the six synth auditions.
  That publication round provided **twelve public auditions: six synth, four David KBD
  metal and two Nakarada metal**, with **zero new game admissions**.
- PR [#321](https://github.com/mekhovov/revealline/pull/321) remains draft at
  `e6a766abce745e1993c53a2652d8e03e50e7a5e5` and is conflicting with current
  main. Its stale-base evidence is unqualified for release.
- Qualification [35945946346](https://github.com/mekhovov/revealline/actions/runs/35945946346)
  at `539418e41a198b02843c70baf488008716089a9a` finished with all four test shards
  failed. Qualify passed; freeze was skipped. Previous “still running” wording
  is superseded. Preserve the failed logs and diagnose against accepted main.
- Regular head run [35946894022](https://github.com/mekhovov/revealline/actions/runs/35946894022)
  passed preflight/build but skipped test/release_gate; these are not full qualification.
- M1 isolated two inherited failure classes against baseline `d0c73b472` and
  failed source `539418e`: chapter-download fixtures expect untuned speed 10 and
  actor velocities 5.4/3.6 while both commits produce tuned speed 8.84 and
  velocities 9.194155752433174/6.129437168288782; terrain fixtures advertise all
  prepared assets while supplying only the wall, correctly rejected by anchor guards.
  These were reproduced/read from committed modules in memory, without media copies.
- PR #320 owns the corresponding tuning, prepared-artwork and asynchronous Journey
  fixture fixes; its UX owner confirmed reuse after acceptance. The failed run has
  571 failures and one cancellation; 215 failure/cancellation records occur in files
  touched by that PR. This does not prove it fixes every failure. Preserve runtime
  guards, do not mass-change assertions, and rerun the resulting exact soundtrack head.
  Historical shared [PR #320](https://github.com/mekhovov/revealline/pull/320)
  checkpoint: c8ba85b had four full test shards in progress; known Team/default-Solo
  residuals were not accepted. The UX owner reported additional
  story/PNG/default-focus fixes at local 3aed6344c and gallery fixtures at e9d604a71;
  Team review c51554ffc still needs coherent production-63 successor/retained-62
  wiring. Those were in-progress corrections at that checkpoint, not accepted source
  qualification. The later 26fe20f8 checkpoint below supersedes these status notes;
  do not repeat their investigation or count unaccepted changes as released.
- v0.97.0 was published as a GitHub release at 03:30:28 UTC on 24 September.
  This supersedes the plan's earlier “draft” snapshot. Public Pages selector and
  feature acceptance remain separate verification owned by **🔥 Releases**.
  Preserve v0.96.0 and all earlier immutable releases.
- Archive51 PR #270 closed without merging. Preserve staging evidence and resolve
  its disposition in reconciliation; do not count that PR as delivered.
- Earlier tiny Git writes failed with ENOSPC; preserve that blocked-check evidence.
  Cleanup briefly restored the reserve, but the latest reported free space is
  **669,736 KiB (about 654 MiB)**, again below the 1 GiB production floor.
  Continue hosted/RAM-only work: no local media intake, builds, full checkouts or
  guard bypasses. Preserve user files, originals and evidence.
  A subsequent M5 source-comparison checkpoint reported **116 MiB free**.
  This docs-only update uses hosted Git operations; no local audio/build/checkout
  is created and the 1 GiB production guard remains in force.

### 24 September checkpoint — retained metal direction and exact source gates

- Docs-only [PR #336](https://github.com/mekhovov/revealline/pull/336) merged at
  a24354fc9bfa75d2aea0d9c3660e160bacd02a87. Exact head 67b1d8e9 had independent
  review, preflight and build passes. Runtime tests were skipped by the inherited
  global waiver; this is not full runtime qualification.
- PR #331 is independently reviewed at 80d6e2f2621e85e92ab5e77d00b3069e131f392f,
  isolated onto accepted main b639b253 with the same six reviewed file blobs.
  The original stacked source remains on
  codex/shchedryk-bundled-source-pre-rebase-4fd7eb0b; PR #321 was not merged.
  Fresh [run 35959304115](https://github.com/mekhovov/revealline/actions/runs/35959304115)
  failed **preflight / Verify Field Kit production ledger and compiled output**:
  “Stale production revision ledger. Run --write to append compatible revisions.”
  Validation, lint and both formatting checks passed; build/tests/release gate
  were skipped. [Failure evidence](https://github.com/mekhovov/revealline/pull/331#issuecomment-5808266278)
  is retained. Track the new bundled helper in the audio dependency list, append
  scoped functional continuation for eight procedural roles and regenerate
  through the producer after the accepted shared lineage is available.
  This repair cannot approve recordings, listening or devices.
- Shared PR #320 is at 26fe20f8c00aa2d09238595c8856fa5572ea0561.
  [Run 35956795771](https://github.com/mekhovov/revealline/actions/runs/35956795771)
  passed preflight/build; all four mandatory shards were still running at this
  checkpoint. Production 63 belongs to that source. Coordinate the next unused
  successor after its actual merge; never overwrite its ledger or assume a
  revision is reserved. PRs #321/#333 still need accepted-base qualification.
- Local free space is approximately **100 MiB**, below the unchanged 1 GiB floor.
  Source preparation uses memory and hosted Git operations; no local audio
  downloads, checkouts, builds or user-file cleanup occurred. This is a historical
  checkpoint; the current 25 September reading is 10,695,908 KiB (about 10.20 GiB),
  above the floor but still on a 98%-used volume.
- The latest metal decision below preserves the Shchedryk decision, Ukrainian
  research, synth reference history, older metal backups and paused originals.

### 24 September checkpoint — four more metal previews and dependency coverage

- Archive [PR #9](https://github.com/mekhovov/revealline-soundtracks-01/pull/9)
  merged at d3c675c7183f651089461d0e42c364b850a03ebf. Hosted
  [run 35961304793](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35961304793)
  passed all 58 intake tests and prepared Anemo, Trial of Thorns, Riffs Two and
  Apocalypse. [Independent original-artifact review](https://github.com/mekhovov/revealline-soundtracks-01/pull/9#issuecomment-5808496559)
  binds artifact 10792671587, its 16 retained members, source manifest and exact
  source/runner tree. Full decoding and permitted-derivative loudness/peak checks
  passed; no listening approval was inferred.
- Archive [PR #10](https://github.com/mekhovov/revealline-soundtracks-01/pull/10)
  merged at c1696d20c139acc98623b8c5a3eda9c17e6fbcee after
  [independent publication review](https://github.com/mekhovov/revealline-soundtracks-01/pull/10#pullrequestreview-5300401852).
  All native originals, source/licence snapshots and receipts are preserved;
  the player, styles and historical files are unchanged. The new
  [metal groove audition collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-groove-audition-20260924/)
  is 29,834,805 bytes including metadata, below 64 MiB.
- Exact-merge Pages [run 35962528262](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35962528262)
  passed verification and deployment. [Direct public byte evidence](https://github.com/mekhovov/revealline-soundtracks-01/pull/10#issuecomment-5808712722)
  matched the manifest and all 11 servable members, including all four complete
  MP3s, by exact lengths and hashes. The .nojekyll control-file HTTP 404 is an
  explicit exclusion, not an HTTP pass. [Public browser transport evidence](https://github.com/mekhovov/revealline-soundtracks-01/pull/10#issuecomment-5808727729)
  records advancing playback for all four tracks with readyState 4 and no media
  error, Pause/Resume continuity, and shuffled Next changing Anemo to Apocalypse.
  These are short observations, not full-track listening, natural-end/repeat,
  in-game mixing, offline or physical-device acceptance.
- Archive totals are now **100 recordings: 70 foundation plus 30 previews**,
  **549,440,433 audio bytes / 549,987,343 public bytes**, across the original
  catalogue and six added batches. All four new recordings retain Content ID
  true, Recording mode eligibility false and pending musical/gameplay review.
  They are not Ukrainian additions. **Zero newly admitted game recordings.**
- [PR #333 dependency audit](https://github.com/mekhovov/revealline/pull/333#issuecomment-5808657043)
  at da750277179b3e22f3962cdc3b5dd684b411005e found nine changed runtime files
  outside every declared Field Kit fingerprint. A read-only, stubbed-input probe
  changed and withheld each file: all fingerprints stayed unchanged and no
  missing-file rejection occurred. This is dependency-coverage evidence, not a
  full production or functional test. M3 below records the required closure.
- Shared PR #320 remains open at 26fe20f8c00aa2d09238595c8856fa5572ea0561.
  [Run 35956795771](https://github.com/mekhovov/revealline/actions/runs/35956795771)
  has passing preflight/build and all four test shards still running at this
  checkpoint; release_gate is skipped. Its production-63 lineage is not yet
  accepted. Older c8ba85b/local-revision notes above are historical snapshots.
- PR #331 remains blocked by the exact preflight ledger failure retained above.
  Coordinate both source closures after PR #320's production-63 source is
  accepted; preserve history, append justified successors and rerun exact-source
  gates. No successor revision is reserved by this plan.
- This checkpoint is based on game main ca3f3fd638e02e1907a0811d7759d24ba8f726b6.
  PR #341 changes publisher selector/evidence, not soundtrack runtime. Archive
  publication does not establish public game acceptance or allocate a music
  release version.

### 24 September checkpoint — YannZ groove intake and public comparison

- Archive [PR #11](https://github.com/mekhovov/revealline-soundtracks-01/pull/11)
  merged at 71c9b62aaaf0f485fe8c4fb3274f43b939effe3b. Its final hosted
  [run 36004806070](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36004806070)
  passed all 62 intake tests and prepared Pixel Damnation, Revenge's Waiting,
  Soul Ripper, German Industrial Metal and Achilles. The first failed run retained
  a stale four-track manifest assertion; the second retained the ordinary one-minute
  duration rejection for the 48-second boss cue. The final change preserves the
  ordinary 1–12 minute policy and adds a narrow 30-second minimum only for explicit
  `boss-cue` recordings. Technical decoding, source/licence snapshots and permitted
  derivative measurements passed. Listening and game admission did not.
- The exact hosted artifact `10810521176` is 57,879,598 bytes with SHA-256
  `4c3c0556359efc76c52322a4c6cde3b09116f572f9da929d58d9a827a382636e`.
  Its 16 original members and the exact source manifest are retained. Source head,
  runner revision and accepted merge share tree
  `2d0a398452979711e95d0df1d129b6a81aefeb3e`; independent artifact review is
  preserved on PR #11.
- Catalogue-wide comparison found German Industrial Metal already present in the
  immutable core batch with the same recording ID, title, native hash and delivery
  hash. Archive [PR #12](https://github.com/mekhovov/revealline-soundtracks-01/pull/12)
  therefore retained all five intake recordings as evidence while publishing only
  the four nonduplicates. Exact-head
  [run 36006489875](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36006489875)
  passed hosted verification and staging at 104 recordings. Independent review
  confirmed the exact head; merge commit is
  `a8dfc0c818c785b2da7c3ec2bbd5692a4959e746`.
- Exact-merge Pages
  [run 36006830854](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36006830854)
  passed verification and deployment. The live
  [groove-first comparison](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-groove-yannz-audition-20260924/)
  exposes four MP3s totaling 19,101,744 bytes. Direct public checks matched every
  committed length and SHA-256. Browser playback started Pixel Damnation, Next
  selected Revenge's Waiting, and Pause changed to Resume. These short transport
  checks are not complete-track, transition, warning-audibility, Content ID,
  Recording mode, offline, physical-device or game-admission approval.
- Archive totals are now **104 recordings: 70 foundation plus 34 previews**,
  **568,542,177 audio bytes / 569,127,879 public bytes**. Revenge's Waiting remains
  an explicit 48-second boss cue and does not count toward the full gameplay-track
  target. **Zero newly admitted game recordings.**
- Game PR #320 advanced to 16d1e8f722891f775e05cf799dbca3299c2b91a4.
  Exact [run 35991665122](https://github.com/mekhovov/revealline/actions/runs/35991665122)
  passed preflight, build and shards 1/2, then failed shard 3 at
  `touchscreen-controller-host.test.mjs:250` with an asynchronous host-action
  timeout. Shard 4 passed 3,516/3,518 and failed two
  `versus-continuous-next-host.test.mjs` cases with unsettled asynchronous actions;
  post-test activity reached `document` after teardown. PRs #331/#333 remain blocked
  until the shared owner fixes and fully qualifies that baseline. The owner then
  published a test-only synchronization correction at
  `b79a979cb0a1653499e8c4432c3e755374015230`. Fresh exact-head
  [run 36007570919](https://github.com/mekhovov/revealline/actions/runs/36007570919)
  has passing preflight while build and all four shards are in progress at this
  checkpoint. The new head remains unaccepted until every required gate passes.
- Accepted game main at this checkpoint is
  `bc9bd27fd7c62d9329c7fd38f1546de7ba91e49c`. Local free space is approximately
  1.4 GiB. Continue sparse/hosted work and preserve the 1 GiB floor.

### 24 September checkpoint — v0.106 published and independent music research

- Immutable [v0.106.0](https://github.com/mekhovov/revealline/releases/tag/v0.106.0)
  was published from main `77c1b7888adba766fc6998774244bb42feb0db60` and its
  reviewed frozen Pages selector was merged through PR [#398](https://github.com/mekhovov/revealline/pull/398)
  at `2705b61915b62cb8bb9497e2bfd9a73a05d76764`. This is release publication
  evidence only: public Pages selector and feature acceptance remain separate.
- The sole publisher assigned the pause-menu work to v0.107. Its replacement PR
  [#397](https://github.com/mekhovov/revealline/pull/397) merged as
  `c75c064e9a228349529e002d6492cc5fa339c70d`; its authorized fast-lane run
  passed preflight and build while test and release-gate jobs were skipped. Those
  skips are retained as skips, not passes. Main then advanced through the
  test-only PR #396 to `88d1726a268e6aaf3fd8f1373390f4be836f5e12`; merged-source
  qualification [run 36064106918](https://github.com/mekhovov/revealline/actions/runs/36064106918)
  passed, while the immutable v0.107 release was not yet published at this
  checkpoint. PR #370 remains draft at
  `c80cfe01cdd0379977dac2ea0ddfe236d53a7591` and is sequenced for a rebase
  after v0.107, before its own v0.108 release. It has 203/203 focused
  soundtrack tests and separately recorded browser transport evidence, but no
  immutable game release yet.
- Draft PR [#333](https://github.com/mekhovov/revealline/pull/333) remains
  stacked on PR #370 at `41cbf2be98969b462ced59382e1d2671eb07423a`; its 225/225
  focused quick-control tests are useful scoped evidence, not a source-gate
  substitute. Draft PR [#331](https://github.com/mekhovov/revealline/pull/331)
  remains source-adapter-only at `b24470a6b2b22fcaecfd642e70e4636d9e059643`.
  It neither registers nor bundles Shchedryk. Release each only after its
  actual accepted base; do not merge, retag or reserve a version out of order.
- M5 and M6 research proceeds without waiting for those releases. New
  source-page leads are deliberately unacquired: **Retroracing Nightlife** by
  Bogart VGM is a [CC BY 4.0 racing synthwave track](https://opengameart.org/content/retroracing-nightlife)
  with a creator-uploaded MP3; **runner2088** by wekont is an
  [instrumental CC BY 4.0 retrowave track](https://freemusicarchive.org/music/wekont/single/runner2088mp3/),
  but at 1:37 is only a short-cue comparison. Neither is accepted or downloaded.
  Scott Buckley's **Neon** remains a useful musical comparison, but the
  creator's [standalone redistribution restriction](https://www.scottbuckley.com.au/library/using-this-music/)
  and Smart Content ID treatment keep it out of the public-MP3 intake lane.
- The stronger M6 shortlist now includes David KBD's free, CC BY 4.0,
  non-generative [Interstellar EDM/Metal pack](https://davidkbd.itch.io/interstellar-edm-metal-music-pack),
  [Reckless vol. 2 punk-metal pack](https://davidkbd.itch.io/reckless-vol-2-punk-metal-music-pack)
  and [Purgatory vol. 3 extreme-metal pack](https://davidkbd.itch.io/purgatory-vol-3-extreme-metal-music-pack).
  They match the requested riff-plus-electronic-pulse or faster combat directions
  on their source descriptions, but descriptive tags are not listening approval.
  Resolve acquisition rights before downloading; complete exact-file review,
  full listening and the normal rights/Content-ID checks before publication or
  admission.
- New research leads are retained for the next shard rather than added blindly to
  Archive 01: [Last Stand Lets Go](https://opengameart.org/content/last-stand-lets-go)
  (CC0/CC BY synth-metal), [Megasong](https://opengameart.org/content/megasong)
  (CC0 energetic metal), [Silver Bullet](https://opengameart.org/content/silver-bullet)
  (CC0 metal), [Pink Bloom](https://davidkbd.itch.io/pink-bloom-synthwave-music-pack)
  (nine CC BY 4.0 synthwave tracks) and
  [Midnight Electric Circuit](https://mumusi-c21.itch.io/midnight-electric-circuit)
  (CC BY 4.0 driving loop). They require exact-file acquisition and complete
  listening before publication; descriptive tags and licences do not establish fit.

## Historical M0–M11 delivery ledger

Retained for traceability. Use the current remaining-work table above for priority,
status and dependencies; the original contracts in the later M2–M11 sections remain.

Estimates are hands-on effort, not promised dates. CI queues, listening reviewers,
rights and actual failure diagnosis can extend elapsed time. No soundtrack game
version is allocated without the release owner's confirmation.

| ID  | Current state                                                                                                                                                              | Remaining completion condition                                                                                                   | Priority / estimate                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| M0  | Durable plan maintenance is active; this checkpoint reconciles the 260-track archive, eleven owner-approved recordings and the pending v0.142.4 boundary.                  | Update after each meaningful archive, game, acceptance or release milestone.                                                     | P0 maintenance; less than 1 hour per milestone.             |
| M1  | Admission, rights, canonical-catalogue and dynamic game-discovery infrastructure is public.                                                                                | Preserve regression coverage and generated-ledger boundaries.                                                                    | Complete; maintenance only.                                 |
| M2  | Exact Shchedryk opening theme is public, bundled and desktop-verified.                                                                                                     | Finish repeated listening, cultural, cold-offline and physical-device evidence without changing its identity.                    | P0 acceptance; 0.5 day plus reviewers/devices.              |
| M3  | Keyboard and in-game quick controls are public; Audio settings now exposes transport and styles.                                                                           | Confirm touch and controller focus/activation on physical targets.                                                               | P0 acceptance; about 0.5 day with devices.                  |
| M4  | Archive #63 records owner approval for Shchedryk and three rights-cleared Ukrainian Commons recordings; UA-FPV remains excluded.                                           | Complete Ukrainian cultural/role review, then admit the reviewed subset without changing rights or recording identity.           | P1; several hours review plus 1–2 days integration/release. |
| M5  | Archive #63 records owner approval for exact-hash Retroracing Nightlife and runner2088; rejected/review-only recordings stay excluded.                                     | Admit the approved two-track Synth subset and verify transitions and public playback.                                            | P1; 1–2 days integration/release.                           |
| M6  | Archive #63 records owner approval for three retained Eternity tracks and the YannZ groove pair; Desolation and all user-hidden tracks stay excluded.                      | Admit the approved five-track Metal subset and verify transitions, warning audibility and public playback.                       | P1; 1–2 days integration/release.                           |
| M7  | Historical UA-FPV evidence and private packs are preserved.                                                                                                                | No action unless the user explicitly restores this item.                                                                         | Inactive / unscheduled.                                     |
| M8  | Mixed-source recovery and desktop acceptance are public; PR #779 exact pushed head `2c160ed7` passes its soundtrack cohort but retains four failed stale-base Team checks. | After v0.142.4 is public, reconcile #779 and run fresh exact-head/release qualification; deferred device checks remain recorded. | P0 release: 0.5–1 day; deferred device work: 0.5 day.       |
| M9  | Broad retagging is replaced by exact ID/hash curation; archive #63 adds approval metadata/collections without changing admission, rights or bytes.                         | Apply only reviewed scene/energy corrections needed for M4–M6 admission while preserving saved identities.                       | P2; 1–3 hours per reviewed batch.                           |
| M10 | Broader genre expansion remains available after the core families.                                                                                                         | Release small reviewed albums only after Synth, Metal and Ukrainian batches.                                                     | P3; 1–2 days per batch plus review.                         |
| M11 | Original production remains paused after synchronization and quality rejection.                                                                                            | Resume only with a demonstrably better method and accepted pilots; retain the 36-composition brief.                              | Deferred / unscheduled; 0/36 approved.                      |

M4–M6 research proceeds in parallel. M3 does not wait for music rights. A cleared
Ukrainian, synth or metal subset can ship without waiting for the other families.
Full listening review of the existing 70 is not a prerequisite for a new batch.

### 26 September Ukrainian Commons publication evidence

Archive [PR #36](https://github.com/mekhovov/revealline-soundtracks-01/pull/36)
merged as `a825103e4e8dbc8d6afbd4121235b141e5f38a61`. Exact-head PR
[run 36221251631](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36221251631)
and main Pages [run 36221339407](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36221339407)
passed. Direct public reads verified 155 unique rows / 19 collections, all three
new IDs, their pending review state, the batch player, CORS and a 206 byte-range
response against the exact 2,562,969-byte `A v kryvoho tantsia` MP3.

[Listen to the Ukrainian Commons audition](https://mekhovov.github.io/revealline-soundtracks-01/batches/ukrainian-commons-audition-20260925/).
Publication establishes redistribution evidence and technical availability only.

### 26 September synthwave / metal audition publication evidence

Archive [PR #37](https://github.com/mekhovov/revealline-soundtracks-01/pull/37)
merged exact head `013a2b9cb0b3e181a5d5285cb04e6f95c49bb46d` as
`876ae69699ac5dae73aa22b26cea7713cee886f9`. Exact-head PR
[run 36222059369](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36222059369)
and main Pages
[run 36222159730](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36222159730)
passed. Direct public reads verified 158 unique rows / 22 collections, all three
batch pages, their exact identities and review holds, CORS, and a 206 byte-range
response against the 8,421,948-byte Maximum Overdrive MP3. The same PR adds an
explicit attribution override to the upload automation and a regression for
creator-specific credit requirements.

- [Heavy Dungeon](https://mekhovov.github.io/revealline-soundtracks-01/?track=mintodog.heavy-dungeon#recordings) — MintoDog, CC0 metal audition.
- [synthwave_type](https://mekhovov.github.io/revealline-soundtracks-01/?track=g-p.synth-type#recordings) — G_P, CC0 synthwave audition.
- [Maximum Overdrive](https://mekhovov.github.io/revealline-soundtracks-01/?track=bogart-vgm.maximum-overdrive#recordings) — Bogart VGM, CC BY 3.0 synthwave audition with the creator-required credit preserved.

All three remain listening-unapproved, game-unadmitted, Content-ID-unknown and
excluded from Recording mode. Publication does not assert musical fit.

### 26 September racing-synth publication evidence

Archive [PR #41](https://github.com/mekhovov/revealline-soundtracks-01/pull/41)
merged exact head `9df68992524e6608aa4ba8f4281a19707fd8a60c` as
`6f6dead0c91d8db49985b36054fb1f6b1eee40af`. Exact-head
[run 36224730773](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36224730773)
and main Pages
[run 36224836752](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36224836752)
passed. The public root now exposes **163 unique recordings / 24 collections /
887,503,800 audio bytes**. Direct checks verified all three immutable MP3s with
HTTP 206, exact byte totals and permissive CORS; browser interaction started Pure
Raceway in the same-page player.

- [Pure Raceway](https://mekhovov.github.io/revealline-soundtracks-01/?track=mintodog.pure-raceway#recordings)
- [Pure Raceway (Climax)](https://mekhovov.github.io/revealline-soundtracks-01/?track=mintodog.pure-raceway-climax#recordings)
- [Darkness Road (Remake)](https://mekhovov.github.io/revealline-soundtracks-01/?track=mintodog.darkness-road-remake#recordings)

The three CC0 recordings have exact source hashes, derivative disclosures,
complete decode and loudness evidence. They remain listening-unapproved,
game-unadmitted, excluded from Recording mode and absent from default playlists.

### 26 September priority, ETA and blockers

1. **Metal listening and admission:** the next review set is already public, so the
   seven Interstellar/Purgatory recordings need several hours of human listening;
   the four Reckless recordings follow. Six additional public auditions—Calamity,
   Nox Venator, Rabidus, Fight for Better Future, The Destoroya and Heavy
   Dungeon—then form the next comparison slate. An accepted subset needs 1–2 working days for admission,
   regression, immutable game release and public verification.
2. **90s Synth:** review the four public third-direction recordings and resolve the
   conflicting runner2088 draft only if it remains useful. Action Synth Track,
   Darkness Road Climax (Remake), Technological Messup, synthwave_type and Maximum
   Overdrive are public as broader rhythmic action/racing comparisons. Pure
   Raceway, Pure Raceway (Climax) and Darkness Road (Remake) add a faster CC0
   racing-synth comparison. Allow 1–2 working days for comparison
   and source work and 1–2 more after approval for integration and release.
3. **Ukrainian expansion:** the first three Commons auditions are now public with
   exact CC BY 3.0 evidence after archive PR #36. Allow several hours for complete
   listening and Ukrainian cultural/gameplay classification; an accepted subset
   then needs 1–2 working days for game admission, immutable release and public
   verification. Further rights/source research continues in 1–2-day rounds.
   UA-FPV has no honest public ETA until recording-specific permissions exist.
4. **Playback/device closure:** public v0.130 accepted the then-current 140 archive rows and mixed
   streamed/included switching. v0.132 exposed the default-theme timeout. PR #617
   merged the isolated repair; it needs 0.5–1 working day once a successfully
   qualified cumulative release includes it, covering immutable release, Pages and
   direct recovery verification. Physical B/N/touch/controller and cold-offline checks require
   another 0.5–1 day plus device access.
5. **Original compositions:** no ETA. The rejected synchronization quality remains
   unacceptable and the 36-track production phase stays paused.

6. **Archive scale-out:** Archive 01 carries 887,503,800 audio bytes. Archive 02 is
   now public with six recordings, 34,930,366 audio bytes and a verified player. Release
   PR #604 first, then add Archive 02 to the reviewed directory and verify aggregate
   discovery in the public game. Intake automation is public; the next small
   Archive 02 batch is estimated at 1–2 working days, excluding listening and CI.

That 26 September plan checkpoint was reconciled through the then-authoritative game main
`d878a879848cea271f1098774ef897dfbf6d806f`. It records archive publication and
release sequencing; it does not change runtime code or admit a new recording.

### 26 September checkpoint — 148-track archive and next expansion boundary

- Hosted intake [PR #28](https://github.com/mekhovov/revealline-soundtracks-01/pull/28)
  and its exact artifact prepared five metal-energy recordings (**Calamity, Nox
  Venator, Rabidus, Fight for Better Future, The Destoroya**) plus three action-synth
  recordings (**Action Synth Track, Darkness Road Climax (Remake), Technological
  Messup**). Source snapshots, native files, permitted MP3 derivatives, exact hashes,
  full decode and technical measurements are retained. All eight remain
  `listeningApproval: not-reviewed`, `gameCatalogueAdmission: false`, `default: false`
  and `recordingModeEligible: false`.
- Archive infrastructure [PR #29](https://github.com/mekhovov/revealline-soundtracks-01/pull/29)
  and WAV artifact support [PR #30](https://github.com/mekhovov/revealline-soundtracks-01/pull/30)
  preserved deterministic hosted assembly. Capacity [PR #31](https://github.com/mekhovov/revealline-soundtracks-01/pull/31)
  raised the project guard from 800 MB to 900 MB after assembly correctly refused
  the old limit; append-only regression [PR #32](https://github.com/mekhovov/revealline-soundtracks-01/pull/32)
  repaired the historical 140-track fixture without weakening its exact prefix and
  uniqueness assertions. The guard remains intentionally below the documented
  [GitHub Pages 1 GB site limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- Publication [PR #33](https://github.com/mekhovov/revealline-soundtracks-01/pull/33)
  merged as `29a3fb332c2b85638fa7d473971585a30d42e818`. Hosted assembly
  [run 36218206984](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36218206984),
  exact-head verification
  [run 36218362650](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36218362650)
  and Pages [run 36218447533](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36218447533)
  passed. The public archive now reports **148 unique recordings / 17 collections /
  826,222,618 audio bytes**. The
  [metal-energy batch](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-energy-audition-20260926/)
  and [synth-action batch](https://mekhovov.github.io/revealline-soundtracks-01/batches/synth-action-audition-20260926/)
  are searchable and playable from the root player. A direct Calamity range request
  returned HTTP 206, `audio/mp3`, CORS `*`, exactly 1,024 bytes and the correct
  6,702,437-byte object length. Browser playback selected Calamity in the same page.
  This is transport evidence, not full listening or game admission.
- Further rights-cleared research leads, all still unacquired and listening-pending,
  include [Heavy Battle 1](https://opengameart.org/content/heavy-battle-1),
  [Cybershaman](https://opengameart.org/content/cybershaman),
  [Empacotatron](https://opengameart.org/content/empacotatron),
  [Hail the Arbiter](https://opengameart.org/content/hail-the-arbiter) and
  [Boss Battle 10](https://opengameart.org/content/boss-battle-10-metal).
  Achilles, Megasong, Silver Bullet and Untitled Metal Track were screened out of
  the new slate because their identities are already public in the archive. Before
  acquiring another substantial batch, implement a second immutable archive shard
  and teach the game/archive index to discover it without changing stable recording
  identities or saved playlists.

## M2 — Shchedryk opening theme

Implementation checkpoint: replacement PRs #518 and #519 are included in public
v0.130.0. Exact identity, bundled bytes, startup/storage policy and Recording-mode
exclusion survived aggregate qualification and frozen inspection. Public desktop
transition testing played the bundled recording between two remote streams. Full-track,
repeated-session, cultural, cold-offline and physical-device review remains open.

- Use **Carol of the Bells (Metal Version) — Alexander Nakarada**. Preserve its
  existing ID, exact 8,641,768-byte MP3 and SHA-256
  `d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58`.
- Bundle the approximately 8.24 MiB recording with the game as the explicit
  exception to optional-audio-only core delivery. Trusted code maps identity,
  hash and bundled path; imported metadata cannot create a bundled entitlement.
- Fresh profiles and users retaining the default selection open with this song
  on a new visit, followed by admitted Ukrainian music. Preserve saved explicit
  styles/playlists, mute, volume and intentional music pause. Never infer that an
  existing saved Synth choice may be overwritten. This supersedes fresh Synth default.
- Preload without blocking menu rendering. Start when browser policy permits;
  otherwise use the first eligible gesture and a compact Play music retry action.
- Ordinary menu returns, Settings, Pause, results, retries and background recovery
  preserve the current song. Reuse the existing transport owner and cancellation.
- Tag Ukrainian / Metal / Fusion without duplicate mixed-queue entries. Display
  title, artist, source link and accurate Shchedryk-adaptation provenance.
- Registered Content ID means Recording mode excludes this recording and uses an
  eligible fallback. User taste approval does not authorize a false video-safe label.
- Count bundled storage consistently; do not duplicate its installed bytes or
  delete the core theme when removing optional albums. Verify core/package limits.
- User musical approval is complete. Full-track, repeated-session, transition,
  warning, mono/small-speaker and cultural/device evidence remain separate gates.

## M3 — immediate music controls

Implementation checkpoint: replacement PR #516 is included in public v0.130.0.
Focused automated coverage includes B/N conflicts, shortcut opt-out, background
ownership, pause during load, Next while paused, focus and buttons. Public source
matches the reviewed quick-control module. Physical keyboard, touch and controller
acceptance remains open; historical #333 evidence is retained without reviving its
stale branch.

- **B** plays/pauses music; **N** selects the next song in gameplay and ordinary menus.
- Compact Now Playing, Play/Pause and Next appear in main and pause menus across
  Solo, Versus and Team. Touch uses these controls; controllers reuse menu focus
  and Confirm. Resume game remains initial pause focus, followed by music controls.
- Music pause leaves gameplay and effects running. Next while paused selects the
  next recording without resuming. State labels cover playing, paused, loading and
  browser refusal without focus stealing, dialogs or toast spam.
- Use the existing player/session APIs; Couch uses session play/pause so Resume
  respects intentional music pause. The active practice owner wins over its parent.
- Custom gameplay bindings win conflicts. Ignore typing/editables, composition,
  modifiers, key repeats, hidden/background pages and higher-priority handled input.
  Add a default-on advanced shortcut toggle without a library/IndexedDB migration.
- Exclude explicit transport clicks from remembered-menu autoplay handlers, so a
  Pause/Next click cannot start music first. Include controls in Versus navigation.
- Verify held keys, controller seats, checkpoints and gameplay state are unaffected.

## M4–M6 — music direction, auditions and decisions

### 25 September — next licensed auditions and acquisition routes

The source-research round is complete; acquisition, listening and admission are
separate next steps. It downloaded no music and granted no musical approval.
For these new candidates, Content ID remains **unknown** and
`recordingModeEligible` stays **false** until exact-recording video permission and
acceptable Content ID status are verified. Keep all earlier user feedback and
rejected/held source evidence below.

| Direction / exact recordings                                                                                                  | Authorized acquisition and licence                                                                                                                                                                                                                                                                                                                  | Selection limits                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Metal — David KBD: **Grave Rot Requiem**, **Bone Grinder's Ballad**, **The Slicing Strain**; reserve **Devoured by Darkness** | [Purgatory vol. 3 creator itch.io page](https://davidkbd.itch.io/purgatory-vol-3-extreme-metal-music-pack), CC BY 4.0. Use the legitimate free Download Now flow for `DavidKBD-01 - Grave Rot Requiem.ogg`, `DavidKBD-05 - Bone Grinder's Ballad.ogg`, `DavidKBD-06 - The Slicing Strain.ogg` and reserve `DavidKBD-04 - Devoured by Darkness.ogg`. | Whole recordings only; the separately listed mini-loops do not count as extra compositions. Paid WAV archives are not required.                                                                                                                                          |
| Metal — David KBD: **City Limits Crash**, **Defiant Descent**                                                                 | [Reckless vol. 2 creator itch.io page](https://davidkbd.itch.io/reckless-vol-2-punk-metal-music-pack), CC BY 4.0. Free individual files are `DavidKBD-01 - City Limits Crash.ogg` and `DavidKBD-03 - Defiant Descent.ogg`.                                                                                                                          | Loopable action cues; measure actual decoded duration and review repetition across gameplay sessions.                                                                                                                                                                    |
| Synth — David KBD: **Electric Pulse**, **Retrochrome Nights**, **Vapor Trails Pursuit**, **Synthetic Power Surge**            | [Electric Pulse creator itch.io page](https://davidkbd.itch.io/electric-pulse-synthwave-retro-futuristic-music-pack), CC BY 4.0. Use its free individual `-full.ogg` files numbered 01, 04, 09 and 10, preserving their exact listed titles.                                                                                                        | Exclude `-short` / `-sort` variants. The [Bandcamp edition](https://davidkbd.bandcamp.com/album/electric-pulse-synthwave-retro-futuristic-music-pack-original-game-soundtrack) is listening metadata with all rights reserved, not the acquisition or licence authority. |
| Synth — wekont: **runner2088**                                                                                                | [Exact FMA recording page](https://freemusicarchive.org/music/wekont/single/runner2088mp3/), CC BY 4.0; use its authorized recording download and retain the exact source grant.                                                                                                                                                                    | Listed 1:37: a short-cue audition, not a 3–5-minute composition. An access failure is not permission to substitute another upload.                                                                                                                                       |
| Synth reserve — Bogart VGM: **RetroRacing Nightlife**                                                                         | [Exact OpenGameArt recording page](https://opengameart.org/content/retroracing-nightlife), CC BY 4.0; use the listed `Retroracing Nightlife.mp3`, with creator credit and source/Facebook link.                                                                                                                                                     | Exact duration remains pending. Do not infer it from the listed 6.5 MB file size.                                                                                                                                                                                        |

Some full recordings are intentionally short, loopable cues. Source loop markers
are not complete-file duration measurements. Audition the whole selected native
file, preserve its hash and licence snapshot, then derive the permitted MP3; do
not pad by repetition to claim the 3–5-minute composition target. Catalogue
entries, duplicate encodings, short variants and mini-loops do not add compositions.
David KBD's [Interstellar pack](https://davidkbd.itch.io/interstellar-edm-metal-music-pack)
remains a CC BY 4.0 reserve with duration metadata pending, outside this first slate.

**Ukrainian leads remain a separate licence and cultural-review lane.** Ivan
Karabyts' [Dysko-khorovod](https://commons.wikimedia.org/wiki/File:Karabitz-dysko-khorovod.ogg)
is a 6:08 clarinet/piano performance by Andriy Diomin and Andriy Bondarenko, with
recording-specific CC BY-SA 3.0 and confirmed Wikimedia permission. Its authorized
route is that file page's original recording. Do not relabel ShareAlike as CC BY
4.0 or send it through the existing CC0/CC BY-only intake without a delivery decision.
Kirill Fandeev's [The Bravery](https://commons.wikimedia.org/wiki/File:Kirill_Fandeev_-_The_Bravery.wav)
(2:31) and [2022](https://commons.wikimedia.org/wiki/File:Kirill_Fandeev_-_%222022%22.wav)
(4:04) have exact Commons recording pages and original-file routes under CC BY-SA
4.0. They are Ukrainian-creator electronic leads; recognizable Ukrainian motifs
are unverified. Neither creator identity nor a geographic label establishes the
requested musical character. All three remain unacquired and unapproved here.

**Delivery holds:** Electric Dreams remains the user's closest musical reference,
but the creator's [no-isolated-redistribution conditions](https://www.scottbuckley.com.au/library/using-this-music/)
hold it out of the public MP3 archive. Any synchronized game-only route requires
its own delivery review. Above All the Chaos retains its tentative user preference,
but exact source/licence/file evidence remains incomplete; the earlier comparison
is not an acquisition approval. No held recording enters this audition intake.

### Ukrainian

Use accepted Nakarada as the quality benchmark; seek six **additional distinct**
compositions with recognizable Ukrainian repertoire, coordinated rhythm sections,
strong hooks and developed arrangements. Licensed vocals and instrumentals may
coexist. Keep broader Ukrainian folk, acoustic and electronic directions active.
A generic folk-metal label, nationality or minor scale is not cultural evidence.
Another Shchedryk arrangement is arrangement variety, not another composition.

Use published licence evidence and authorized sources. No purchases, creator
messages or social-account actions are implied by this work. Preserve these holds:

- Kyle Misko: Hutzulka z Kolomyii, Sahaidachny, Haiduk, Viter Vie, Arkan, Nese Halya
  Vodu. Individual CC statements do not resolve the album's sampled-recording provenance.
- CHUR: Spring the Wonderful / Весно красна and The Pussy-Willow Board /
  Вербовая дощечка are musical references with all-rights-reserved recordings.
- Meraki Caravan — Karchata: Ukrainian folk-fusion lead; paid acquisition and
  ShareAlike delivery review remain. Not established as a heavy-metal match.
- GERAINSAN — Oy Na Gori remix: vocal/master provenance and exact licence unresolved.
- Researched Commons vocal, folk and classical performances remain candidates;
  check repertoire/language, exact performance and arrangement rights. Retain
  Lysenko and ceremonial records in the historical register below; no quota padding.
- NC/ND recordings, conflicting custom licences and unverified sample provenance
  remain outside admission. Keep every researched lead and reason in the register.

### Additional Ukrainian research — 24 September

- The Doox — **Сонце**: the [artist's exact recording page](https://thedoox.bandcamp.com/track/--2)
  links CC BY-SA 4.0 and offers paid acquisition for USD 1. No purchase is
  authorized; acquisition and ShareAlike game-delivery review remain. A label
  SoundCloud CC-BY claim for LIRA conflicts with the
  [label's all-rights-reserved album page](https://zefra.bandcamp.com/album/the-doox-lira-2018).
  Do not extend either page's terms to other recordings or admit from conflicting metadata.
  A read-only scan of all 80 supplied filenames and their ID3 tags found no Doox
  match. No supplied file was changed or publicly cleared by that scan.
- Sascha Ende — **Світло повернеться**:
  [the exact source page](https://ende.app/en/song/13316-svitlo-povernetsia-the-light-will-return-ukraine)
  lists CC BY 4.0. This is an AI-assisted contemporary cinematic Ukrainian vocal
  candidate. Full listening, pronunciation and provenance review remain; it is
  not evidence of traditional repertoire and does not fill that quota.
- Bodg — **WW3**: [the recording page](https://www.soundclick.com/track/14723325/bodg/bodg-ww3)
  is a sourcing lead only. Verify its exact licence version and native recording
  before intake. The artist's Ukrainian identity does not establish Ukrainian
  musical motifs or cultural suitability.

No additional Ukrainian recording in this update is admitted or musically approved.

### 90s Synth — balanced synthwave / outrun and electro

**24 September user decision:** replace the previous synth audition direction
with a balanced mix of outrun/synthwave and rhythmic electro. Prioritize full
arrangements, moving/funky bass, punchy electronic drums, layered synth leads,
memorable early hooks and coordinated rhythms. The later user references below
add a clearer night-drive/dreamwave and cyberpunk focus. Chiptune is an occasional
accent; higher BPM alone does not establish fit. Licensed recordings come first; original
production remains paused at 0/36 approved.

Keep **90s Synth / synth90s** stable. The eventual accepted album is displayed as
**Synthwave & Electro**, with accurate substyle, menu/gameplay, energy and theme
metadata through existing catalogue/album interfaces. No schema migration or
saved-preference reset is planned. M2's Shchedryk opening-theme decision remains.

The official [XPOSED Reloaded listing](https://store.playstation.com/en-gb/product/EP2402-CUSA28098_00-XPOSEDRELOADED01)
does not identify its soundtrack genre or composer. The user's description is
the musical brief; commercial references are not reusable assets.

#### Historical synth decisions — preserved, not admitted

DOS-88 **Race to Mars, City Stomper, Automata v2, Crash Landing** and escp
**Synthasia, Twilight City** are now rejected for the requested musical direction
and excluded from game admission, defaults and the accepted standard shuffle.
Their [immutable preview collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/synth-audition-20260924/)
and archive PR #7/#8 native sources, hashes, licence evidence, decoding and loudness
checks remain preserved. This feedback supersedes their earlier taste-pending
state; technical publication evidence is still valid. The seven earlier retro
rejections and six older metal backups below remain unchanged.

#### M5.a — source-page comparisons and user decisions

**M5.a.1 — rejected on 24 September:** the user listened to the first comparison
and replied, "none of these are exactly what we need, keep searching".
**Just Release Me, DJ Synth Wave / Funk and Neon Night are not accepted for this
direction and must not enter the game/defaults on the strength of their licences.**
Preserve the research and source-player evidence below as historical evidence.
No source audio was acquired, normalized or admitted.

| Recording                                                                                          | Listen on the source page                                                                                                             | Published licence / evidence boundary                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Punch Deck — [Just Release Me](https://punchdeck.bandcamp.com/track/just-release-me)               | Bandcamp Play/pause; approximately 3:55. Browser preview advanced to 00:04 and was paused.                                            | Exact page links CC BY 4.0; name-your-price original. The browser stream is a preview, not an acquired master.                                                                                         |
| Alex McCulloch — [DJ Synth Wave / Funk](https://opengameart.org/content/dj-synth-wave-funk)        | Click the large Play triangle under Preview; it changed to Stop in the browser and was stopped. Source page does not expose duration. | CC0 1.0; uploader Pro Sensory requests Alex McCulloch credit. Preview dj_synth_wave.mp3 and attachment dj_synth_wave_0.mp3 have different paths; exact equality/completeness still needs verification. |
| Fatal Exit — [Neon Night](https://fatalexit.itch.io/neon-night-free-cca-synthwave-music-for-games) | Under Listen Here, activate the embed and press Play, or follow its SoundCloud link. Play/Pause control changes checked.              | CC BY 4.0 on itch; SoundCloud reports about 1:20 full duration. This is a complete short cue/style reference, not a 3–5-minute gameplay recording.                                                     |

The source checks above verify access/UI behavior, not full listening or musical
quality. All comparison players were stopped after checks. No login, payment or
download is needed for these source-page previews. No external player will be
embedded into the game transport.

The first comparison did not establish an accepted direction. An accepted short
cue may guide style but cannot be padded, looped or counted as a distinct
full-length gameplay composition.

**M5.a.2 — second comparison feedback received.** The user said
**Above All the Chaos "might be the closest"**, but the three videos below are
better and asked to keep searching. This is a tentative preference, not recording
approval. Time Trials 87 and Motion Blur remain unapproved; the user did not
explicitly reject them. Preserve the second-round source evidence.

The search focused on modulated
sub-bass, layered arpeggios, prominent electronic drums and developed arrangements.
A [creator description of Secret Arcade](https://forums.envato.com/t/best-music-for-science-fiction-tv-shows-film-movies/124940?page=10)
gives those concrete production references. Its association with XPOSED is only
an unofficial Switch-release lead, not verified PS4 soundtrack credits.
[Boomopera's Synthpop Supercar](https://boomopera.bandcamp.com/album/synthpop-supercar)
is an all-rights-reserved reference; it is not a free game asset.

| Second comparison                                                             | Concrete source basis                                                                                                                                                                              | Duration / acquisition boundary                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| botnit — [Time Trials 87](https://botnit.bandcamp.com/track/time-trials-87)   | Full retro-electronic recording on the artist's early-singles collection; exact current artist licence is CC BY 4.0. Musical fit remains unverified.                                               | 3:58 (238.290 seconds in artist metadata). The individual track costs $1; the artist's [Wild Days album](https://botnit.bandcamp.com/album/wild-days-the-early-singles) offers Free Download. Use that legitimate free route if selected; acquisition has not been tested. |
| Nihilore — [Motion Blur](https://nihilore.bandcamp.com/track/motion-blur)     | Creator classifies it as upbeat nu-disco and includes it in Synthwave/Frantic collections. Exact current artist licence is CC BY 4.0.                                                              | 3:57 (236.769 seconds). The [creator track page](https://www.nihilore.com/latest-tracks/2018/3/24/motion-blur) offers the MP3; no file acquired.                                                                                                                           |
| TeknoAXE — [Above All the Chaos](https://www.youtube.com/watch?v=4svHIJ3WQ3g) | Creator labels it Rock/Synthwave and describes an intended metal piece developed around sequenced synths. Exact [creator track page](https://teknoaxe.com/Link_Code_3.php?q=1388) links CC BY 4.0. | Official listening video 3:45; creator MP3 offered, not acquired or decoded.                                                                                                                                                                                               |

These source descriptions and durations narrow the next comparison; they do not
prove better musical fit or full-track listening. No new large batch is acquired
until an example is accepted. The second comparison question is answered; the
next search follows the stronger user references below.

Reserves, also unapproved: TeknoAXE's [Edge of Tomorrow](https://teknoaxe.com/Link_Code_3.php?q=1242),
4:48, with a creator-described lower-pitched compressed/gated snare; Nihilore's
[Terminant](https://nihilore.bandcamp.com/track/terminant), 6:31, creator-classified
future/dark synth and aggressive. Both current exact-source licence links are
CC BY 4.0; neither has recording acceptance.

Three Chain Links is a separate research hold: the artist's
[itch album](https://jhmakesgames.itch.io/happiest-days) offers CC BY/game use,
while the [current Bandcamp album](https://threechainlinks.bandcamp.com/album/the-happiest-days-of-our-lives)
links CC BY-SA 4.0. Bind any selected source/file to its actual licence and resolve
the route difference before admission. Do not silently call every version CC BY.
Alex-Productions' current [Hawkins Lab terms](https://soundcloud.com/alexproductionsmusic/80s-synthwave-by-alex-productions-no-copyright-music-background-music-for-video-hawkins-lab)
require a paid game licence despite free-video wording; it is not a cleared free
public-MP3 candidate.

**M5.a.3 — stronger user references, 24 September.** The user said the following
three videos are better references and asked to keep searching:

| User reference                                           | Identified source                                                            | What is established                                                                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [City Glow](https://youtu.be/IKPxMQaezpw)                | NightframeFM; 23:04; Synthwave Night Drive / Dreamwave / Chillwave           | Creator describes warm analogue textures, dreamy melodies, nostalgic pads, smooth grooves and polished transitions. No published tracklist or reuse grant found.                                                    |
| [1994 Hacked successfully](https://youtu.be/tyXeh8-U780) | VHS FM Memory; 60:40; Synthwave / Retrowave / Outrun / Cyberpunk / Chillwave | Fourteen chapter entries contain twelve distinct titles; two repeat. Creator expressly reserves rights and describes AI-assisted production under its own commercial licence, which does not grant us reuse rights. |
| [1983 Heavenly Glitch](https://youtu.be/1OdQcWnzkpQ)     | Synth Odyssey FM; 104:10; Synthwave / Chillwave / Cyberpunk / Retrowave      | Ten named chapters correspond to a roughly 34-minute artist album. Later sequence is unverified; long playback time is not evidence of additional compositions. No reuse grant found.                               |

These exact video/channel descriptions were inspected as public metadata; no
audio was acquired and no full listening is claimed. Keep these as style
references unless recording-specific permissions are established. The creator's
use of AI does not restart M11 or approve our rejected original candidates.

Working interpretation, grounded in the user's preference and creator
descriptions: layered night-drive/dreamwave melodies and pads, a steady moving
bass/drum groove, memorable synth leads and darker sequenced cyberpunk options.
Retain rhythmic energy and arrangement development; do not reduce the brief to
ambient music, BPM, genre tags or chiptune. This interpretation still needs
musical comparison, not another large speculative batch.

**M5.a.4 — third comparison, feedback received below.** Preserve these source-page
research leads; none is an accepted game recording or a cleared acquired master.

| Recording                                                                                                               | Source basis for comparison                                                                                                                  | Licence / acquisition boundary                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scott Buckley — [Electric Dreams](https://www.scottbuckley.com.au/library/electric-dreams/)                             | Creator describes smooth cruising synthwave with warm pads, arpeggios, leads and an electric-piano breakdown at 2:47.                        | Exact track page links CC BY 4.0 and offers a full-mix MP3. Preserve [creator licensing conditions](https://www.scottbuckley.com.au/library/licensing/) and Content ID guidance; final delivery/Recording-mode review and exact-file checks remain pending.                                                            |
| Nihilore — [Glimmer](https://nihilore.bandcamp.com/track/glimmer)                                                       | 4:05 (245.368 seconds); creator identifies chillwave, newretrowave and futuresynth. Full source streaming is enabled.                        | Exact current track links CC BY 4.0; creator's [terms](https://www.nihilore.com/license) allow credited redistribution/adaptation. Preserve authored title. No file acquired.                                                                                                                                          |
| AIRGLOW — [Memory Bank](https://freemusicarchive.org/music/Airglow/Memory_Bank/AIRGLOW_-_Memory_Bank_-_01_Memory_Bank/) | 4:58; original FMA edition, a new artist comparison for the warmer retro-electronic direction. Actual arrangement and fit remain unreviewed. | Exact original FMA page links CC BY 4.0. This is not the [2018 Remixed & Remastered release](https://airglow-stratford.bandcamp.com/album/airglow-memory-bank-remixed-remastered), which currently reserves all rights and has a different duration. Never substitute masters or transfer permission between editions. |

Next reserves if the direction fits: Nihilore's
[The Bright Lights of Summer](https://nihilore.bandcamp.com/track/the-bright-lights-of-summer)
(5:20, retrowave/trap-wave, exact CC BY 4.0);
AIRGLOW's [New Touch, original FMA edition](https://freemusicarchive.org/music/Airglow/Memory_Bank/AIRGLOW_-_Memory_Bank_-_07_New_Touch/)
(4:50, exact CC BY 4.0; FMA marks it non-instrumental, so vocals remain a listening
check); and Scott Buckley's [Neon](https://www.scottbuckley.com.au/library/neon/)
(creator-described moody arpeggios, pads and a lead solo, exact CC BY 4.0).
HOME's [Before The Night](https://midwestcollective.bandcamp.com/album/before-the-night)
remains reference-only: the current official release reserves all rights despite
offering a free download. EVA's Realizations remains held pending primary licence
evidence. No source audio was acquired, normalized, uploaded or admitted in this
research round. Content ID, gameplay-video permission, musical acceptance and
the existing release checks remain recording-specific.

**M5.a.5 — Electric Dreams is the closest reference; keep searching.** The user
answered the third comparison: "Electric Dreams — Scott Buckley is the closest,
keep searcing". Use it as the leading musical reference, not final recording
acceptance. Glimmer and Memory Bank remain unapproved, not explicitly rejected.
Above All the Chaos retains its earlier tentative preference; the three supplied
videos remain stronger user references.

The next focused source comparisons follow this feedback:

| Recording                                                                               | Concrete comparison basis                                                                                                                                                                               | Current boundary                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scott Buckley — [Twilight Echo](https://www.scottbuckley.com.au/library/twilight-echo/) | Approximately 4:47 (286.903 seconds on the creator's [SoundCloud full track](https://soundcloud.com/scottbuckley/twilight-echo-cc-by)); warm nostalgic synthwave with a synth solo in the final chorus. | Exact track page CC BY 4.0; full MP3 offered. The alternate no-lead mix is not another composition. Source acquisition, listening and game review remain pending.                                                                                                                                   |
| Scott Buckley — [Neon](https://www.scottbuckley.com.au/library/neon/)                   | Creator describes moody 1980s electronica with arpeggios, pads and a synth lead solo.                                                                                                                   | Exact track page CC BY 4.0; compare the full original mix. No acceptance or acquired master.                                                                                                                                                                                                        |
| Shane Ivers — [Neon Noir](https://www.silvermansound.com/free-music/neon-noir)          | 5:12; creator describes warm analogue bass, strings, electronic drums and DX7 character.                                                                                                                | Musical reference / delivery hold. The track page says CC BY 4.0, but the current [licensing page](https://www.silvermansound.com/licenses) also prohibits standalone audio redistribution. Resolve that conflict before public MP3 admission; do not silently treat it as a cleared archive asset. |

Scott Buckley's [Using This Music terms](https://www.scottbuckley.com.au/library/using-this-music/)
also require synchronisation with other media alongside restrictions on isolated
resale and music-platform uploads. Keep the separate standalone MP3 archive route
on hold until this wording is resolved against the exact CC BY grant. This does
not erase the published credited game-use route: assess game delivery and archive
redistribution separately, without substituting hidden download URLs for rights.

Scott Buckley's [Content ID guidance](https://www.scottbuckley.com.au/library/copyright-claims-release/)
describes a library claim system. If admitted, these recordings must be excluded
from the existing Recording mode while classified as registered; a CC licence
does not establish claim-free gameplay videos. This is compatible with normal
in-game playback after the existing admission checks. No creator was contacted,
no purchase made and no audio acquired in this comparison round.

#### M5.b — replacement pool after direction feedback

Status: **research leads only**, pending an accepted reference, acquisition,
exact-file verification and complete listening. Prepare 6–10 full auditions
following the accepted comparison. The earlier pool below is retained as research
history; its three rejected entries are excluded. Do not promote the remaining
unheard entries merely because they shared genre tags with a rejected comparison.

| Recording                                                                                          | Published licence / acquisition checkpoint                                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Punch Deck — [Just Release Me](https://punchdeck.bandcamp.com/track/just-release-me)               | **Rejected for musical fit**; retained as research history. CC BY 4.0; name your price                                                                   |
| Alex McCulloch — [DJ Synth Wave / Funk](https://opengameart.org/content/dj-synth-wave-funk)        | **Rejected for musical fit**; retained as research history. CC0; creator-uploaded file; preview/attachment identity unresolved                           |
| Fatal Exit — [Neon Night](https://fatalexit.itch.io/neon-night-free-cca-synthwave-music-for-games) | **Rejected for musical fit**; retained as research history. CC BY 4.0; free/name your price; short-cue reference, outside the full-length gameplay count |
| Punch Deck — [Fluorescent Color](https://punchdeck.bandcamp.com/track/fluorescent-color)           | Current Bandcamp CC BY 4.0; official SoundCloud download advertised, acquisition/account requirements untested                                           |
| Punch Deck — [VHS Heroes](https://punchdeck.bandcamp.com/track/vhs-heroes)                         | Current Bandcamp CC BY 4.0; official SoundCloud download advertised, acquisition/account requirements untested                                           |
| Punch Deck — [Chrome Funk](https://punchdeck.bandcamp.com/track/chrome-funk)                       | CC BY 4.0; name your price; actual style needs listening                                                                                                 |
| Punch Deck — [Neon Underworld](https://punchdeck.bandcamp.com/track/neon-underworld)               | Current Bandcamp CC BY 4.0; darker electronic lead; official SoundCloud acquisition untested                                                             |
| Alex McCulloch — [80's Synth Wave](https://opengameart.org/content/80s-synth-wave)                 | CC0; creator-uploaded file                                                                                                                               |

Reserve pool: [Nihilore's synthwave/chillwave/outrun catalogue](https://www.nihilore.com/synthwave)
under the creator's [CC BY 4.0 terms](https://www.nihilore.com/license). Preserve
authored titles. The category includes quieter music, so tags are not an energy
or suitability review.

Some older Punch Deck announcements state CC BY 3.0 while the current exact
Bandcamp links resolve to CC BY 4.0. Preserve evidence from the actual acquisition
route and bind it to the recording/hash; do not mix versions silently. Bandcamp
prices on Fluorescent Color, VHS Heroes and Neon Underworld are not free acquisition
routes merely because their licences allow sharing. Creator whitelisting guidance
does not establish claim-free or Recording-mode eligibility.

Karl Casey / White Bat remains outside the public MP3 pool: the
[official FAQ](https://whitebataudio.com/pages/faq) forbids soundtrack distribution
separately from the game. In-game-only use needs a separate delivery review.

#### M5.c — accepted subset admission and release

Status: pending M5.a feedback, M5.b recording acceptance and shared game gates.
Evaluate early hooks, bass/kick coordination, clear percussion, contrasting
sections and sustained gameplay energy. Reject sparse bleeps, excessive
introductions and repetitive arrangements that fail the requested feel. Give menu
recordings a rhythmic but less dense mix; classify every recording individually.

Preserve native sources, exact bytes and trusted rights. Fully decode each file;
measure permitted MP3 derivatives against -16 LUFS integrated +/-1 LU and no more
than -1 dBTP. Complete listening, repeat-session, transition, warning-audibility,
mono/small-speaker and actual-game checks remain required.

Each accepted subset follows archive PR -> verified public MP3 hashes -> separate
game admission PR -> independent review and all six required source gates ->
release-owner version coordination and actual merged-source qualification ->
immutable release and reviewed Pages deployment -> direct playback and cold
offline verification. Record physical-device evidence separately from simulation.
Preserve endless mixed playback, uploads, offline contracts and explicit choices.

Hands-on estimate: several hours for the source comparison; 1–2 working days for
an accepted-direction audition batch; 1–2 working days for integration and
verification. Listening feedback, rights, shared qualification failures, CI and
release waits are excluded. Update this section with decisions, PRs, evidence and
released versions after each milestone; M4/M6 and all other master items continue.

### Metal

Prioritize articulated low/palm-muted riffs, rhythmic rests, bass/kick coordination,
double kick, contrasting riffs and controlled distortion. Reference Valfaris,
Slain, Prodeus and DOOM for articulation and arrangement, not copied melodies.

#### M6 review queue — direct archive player links

Review these exact complete recordings in order. “Full-length” distinguishes the
complete source recordings from separately published loops or alternate encodings;
the four Purgatory recordings are intentionally shorter than the 3–5-minute target.

First review the prioritized Interstellar/Purgatory set:

1. [Solar Storm — 3:46](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.solar-storm#recordings)
2. [Galactic Battle — 3:46](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.galactic-battle#recordings)
3. [Orbital Assault — 3:06](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.orbital-assault#recordings)
4. [Mutilation's Melody — 2:13](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.mutilations-melody#recordings)
5. [Bone Grinder's Ballad — 2:05](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.bone-grinders-ballad#recordings)
6. [The Slicing Strain — 2:12](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.the-slicing-strain#recordings)
7. [Visceral Vengeance — 1:55](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.visceral-vengeance#recordings)

Then review the shorter Reckless set:

1. [City Limits Crash — 1:44](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.city-limits-crash#recordings)
2. [Edge of the City — 1:42](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.edge-of-the-city#recordings)
3. [Defiant Descent — 1:50](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.defiant-descent#recordings)
4. [Airborne Anarchy — 1:26](https://mekhovov.github.io/revealline-soundtracks-01/?track=davidkbd.airborne-anarchy#recordings)

Classify each recording as **approve**, **backup** or **reject**, with a short note
about riff identity, rhythmic drive, drum impact and sustained gameplay energy.
Archive publication and technical checks do not grant musical approval or game
admission. An approved subset needs 1–2 working days for integration and release,
excluding CI and shared publisher waits.

Ten newer auditions are public; full acceptance remains: David KBD **The Desolation of a
Civilization, Agony Space-deep, God of Darkness, Suffocation**; Alexander Nakarada
**The Dobermann, Folklore, Anemo, Trial of Thorns, Riffs Two, Apocalypse**.
The six older backups remain preserved. Generic folk-metal is not automatically Ukrainian.

The earlier Nakarada pair has a separate
[preview collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-nakarada-audition-20260924/),
merged through archive PR #6 and verified on Pages with exact live hashes and
both tracks playing, Next and Pause. This was a transport check, not complete-track
listening or game/device acceptance. Hosted
[intake run 35952608258](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35952608258)
fully decoded both and measured the permitted MP3 derivatives: The Dobermann
240.096 seconds, -16.00 LUFS / -3.13 dBTP; Folklore 300.539 seconds,
-16.08 LUFS / -1.22 dBTP. Native originals, creator/source/licence snapshots,
exact hashes and pending-review receipts remain in the immutable
[intake archive](https://github.com/mekhovov/revealline-soundtracks-01/tree/40a283d9a2ed2f5a00837ae60273f3884a52e706/intake/archive/metal-nakarada-audition-20260924).

Both recordings are CC BY 4.0 with registered Content ID; intake policy marks
both ineligible for Recording mode. These are candidate previews, not listening-approved tracks, Ukrainian
additions or game admissions. The four David KBD recordings are now acquired and
technically verified through PR #7 / run 35953731494, with a separate
[Eternity audition collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-eternity-audition-20260924/)
from PR #8. Exact originals and normalized MP3s are retained. Content ID remains
unknown for these four, Recording mode eligibility is false, and full listening/
heaviness, transition and gameplay review remain. This does not approve the six
replacement candidates or change the older six-track backup decision.

#### M6.a — groove and energy follow-up

**User decision, 24 September:** keep all four Eternity recordings. They are better
and moving in the right direction, but still not rhythmic or energetic enough.
Preserve this positive direction decision and all immutable preview/source bytes.
Full listening, transition, warning-audibility and gameplay acceptance remain.

**Later user direction, 24 September:** YannZ's **They're Going Down** pack and
**Revenge's Waiting** are closer to the required feel. Treat this as a direction
decision rather than game admission. The pack's sustained combat track **Pixel
Damnation** uses six-string distorted bass, guitar and punchy drums; **Revenge's
Waiting** is a 48-second 12/8 boss loop. Keep the latter available as a boss/climax
cue, but do not count it as a complete 3–5-minute gameplay composition or let
short loops inflate the 12–20-recording expansion target.

Prioritize a recognizable recurring riff, coordinated bass/kick accents, rhythmic
rests, clear drum attacks, contrasting riffs and developed returns. Distortion,
genre labels or higher tempo alone do not prove suitability. Verify these
properties by complete listening and repeated gameplay sessions.

| Reference                                                                                                              | Documented direction                                                                | RevealLine selection target (our interpretation)                                |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Valfaris](https://www.valfarisgame.com/) and [Slain](https://store.steampowered.com/app/369070/Slain_Back_from_Hell/) | Heavy metal; Curt Victor Bryant soundtrack                                          | Guitar-led thrash/groove with articulated riffs and coordinated drums           |
| [Prodeus — Andrew Hulshult](https://andrewhulshult.bandcamp.com/album/prodeus-original-game-soundtrack)                | Creator tags industrial metal, instrumental and synth                               | Low rhythmic guitars, electronic pulses and contrasting sections                |
| [DOOM — Mick Gordon](https://www.gdcvault.com/play/1024068/-DOOM-Behind-the)                                           | Aggressive composition, synthesis, mixing and interactive music supporting gameplay | Memorable pulse and controlled density that leave warnings audible              |
| [Broforce — Deon van Heerden](https://www.deonvanheerden.com/broforce.html)                                            | Live percussion, power-metal stings and hybrid boss scoring                         | Percussion impact and guitar hooks; separate short stings from sustained pieces |

Commercial soundtracks remain references, not reusable assets. These selection
targets are interpretations of documented production directions, not claims
that unheard candidate files already meet them. This content batch does not
require a new adaptive-music system.

Four additional Alexander Nakarada compositions have completed bounded hosted
intake and archive publication through PRs #9/#10. Exact creator downloads,
licence snapshots, native files and complete-file hashes are retained. The
[industrial/thrash preview](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-groove-audition-20260924/)
remains a listening audition. Published creator metadata describes the four:

| Candidate                                                           | Source-page direction                    | State                                |
| ------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| [Anemo](https://creatorchords.com/music/anemo/)                     | Industrial / Metal / Rock; 4:38, 131 BPM | Published preview; listening pending |
| [Trial of Thorns](https://creatorchords.com/music/trial-of-thorns/) | Death Metal / Industrial; 3:57, 133 BPM  | Published preview; listening pending |
| [Riffs Two](https://creatorchords.com/music/riffs-two/)             | Thrash / Progressive; 3:18, 159 BPM      | Published preview; listening pending |
| [Apocalypse](https://creatorchords.com/music/apocalypse/)           | Thrash; 3:37, 145 BPM                    | Published preview; listening pending |

All four source pages publish CC BY 4.0. Preserve attribution and exact-file
evidence. Creator Content ID registration makes them ineligible for Recording
mode. Technical processing and public previews are separate from musical
acceptance and game admission. These are not Ukrainian additions.

Diversify beyond one artist with four more source-verified leads:

| Candidate                                                                   | Exact source / acquisition evidence                                                              | Remaining                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [Frog — DEgITx](https://degitx.bandcamp.com/track/frog)                     | CC BY 4.0, 3:54; creator-linked Night archive has 10. Frog.mp3                                   | Exact-byte acquisition and listening                                |
| [Burn Out — DEgITx](https://degitx.bandcamp.com/track/burn-out)             | CC BY 4.0, 3:59; creator-linked Night archive has 09. Burn Out.mp3                               | Exact-byte acquisition and listening; preserve collaborator credits |
| [Rusted Shrapnel — TeknoAXE](https://teknoaxe.com/Link_Code_3.php?q=775)    | CC BY 4.0; official direct download; creator describes shredding/chugging with a softer contrast | Exact-file duration, decoding and listening                         |
| [Six String Shrapnel — TeknoAXE](https://teknoaxe.com/Link_Code_3.php?q=85) | CC BY 4.0; official Metal/Thrash video and direct download                                       | Exact-file duration, decoding and listening                         |

DEgITx's [official site](https://degitx.com/) links the
[lossy archive](https://drive.google.com/drive/folders/1oxIqYp09HyLnbp-WyL2NJ-wE1HcOxxVD).
Its [licence file](https://drive.google.com/file/d/1XDaSdWVPqagIEwx2-TRsVOrTOFP2yOTX/view)
independently declares CC BY 4.0 with a Covers-folder exception. Preserve creator
credit **Alexey Kasyanchuk (DEgITx)** and, for Burn Out, **Ilija Rogovoi (Belle Morte),
guitars; Roman Yanko (Cardinal Line), bass**, as credited on the
[Night album](https://degitx.bandcamp.com/album/night). Do not extend that permission
to covers or other derivatives.

No audio was acquired for these four leads. Content ID remains unknown, Recording
mode eligibility remains false, and none is classified as Ukrainian. Preserve
exact source/licence evidence with later acquisition. D.E.M.O.N retains its
conflicting-conditions hold.

#### M6.b — groove-first replacement slate

Use the YannZ pair as the next comparison anchor: syncopated low riffs, deliberate
rests, bass/kick accents, forceful drum transients and a recurring hook that stays
clear during play. A candidate still needs full listening; descriptive tags and
tempo are only screening evidence.

| Candidate                                                                                                                | Published source evidence                                                                                                               | Intended comparison role                                              | Remaining                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Pixel Damnation — YannZ](https://opengameart.org/content/they%E2%80%99re-going-down-%E2%80%93-game-ost-pack-by-yannz)   | Creator-uploaded MP3/OGG under CC BY 4.0; 2:19 loop plus separate intro tag; creator documents six-string bass, guitar and punchy drums | Sustained combat reference                                            | Acquire exact source bytes and licence snapshot; full listening, derivative and Content ID checks |
| [Revenge's Waiting — YannZ](https://opengameart.org/content/they%E2%80%99re-going-down-%E2%80%93-game-ost-pack-by-yannz) | Creator-uploaded MP3/OGG under CC BY 4.0; 0:48, 12/8 loop                                                                               | Boss/climax cue and groove reference; excluded from full-track target | Same checks; verify repeated-loop fatigue and transition behavior                                 |
| [Soul Ripper — Alexandr Zhelanov](https://opengameart.org/content/soul-ripper)                                           | Creator-uploaded OGG under CC BY 4.0; described as brutal industrial metal                                                              | Doom/Prodeus-style industrial comparison                              | Exact-byte acquisition, duration, Content ID and complete listening                               |
| [German Industrial Metal — Bogart VGM](https://opengameart.org/content/german-industrial-metal)                          | Creator-uploaded MP3 under CC BY 4.0 with required creator link; tagged riff, drums, synth and aggressive                               | Riff/synth coordination comparison                                    | Exact-byte acquisition, Content ID and complete listening                                         |
| [Achilles — Zane Little Music](https://opengameart.org/content/achilles)                                                 | Creator-uploaded WAV/MP3 under CC0; full and loopable versions; metal/chiptune fusion                                                   | Heavier electronic-metal comparison; chiptune remains an accent       | Exact-byte acquisition, duration and complete listening                                           |
| [Heavy Boss Battle 1 — MintoDog](https://opengameart.org/content/heavy-boss-battle-1)                                    | Creator-uploaded loopable MP3/OGG under CC0; 200 BPM                                                                                    | Faster boss-loop comparison                                           | Verify duration, arrangement depth, loop fatigue and complete listening                           |

Keep [Eternity vol. 2](https://davidkbd.itch.io/eternity-vol2-djentmetal-scfi-horror-music-pack)
as a reserve pool rather than assuming it corrects the first volume's rhythm
feedback. Hold the large Forgotten Dawn rock archive until a hosted, bounded
acquisition can inspect its two complete djent songs without consuming the local
disk reserve. D.E.M.O.N remains excluded from acquisition while its separate
mandatory-rating condition conflicts with the otherwise stated CC BY 4.0 terms.

Next delivery is a small audition archive, not a game admission: acquire the two
YannZ recordings plus the strongest two or three comparison candidates, preserve
exact source/licence evidence, decode and measure them, publish immutable previews,
then request musical feedback. Only a user-accepted full-track subset advances to
the catalogue admission PR. Short boss loops may ship in a clearly labelled cue
collection after loop-fatigue review, but do not satisfy the full gameplay-track
quota.

The four Nakarada previews now use a new immutable collection after independent
intake, original-artifact and publication review. Accepted subsets still require
a separate game PR, exact-source gates,
immutable release and public playback/offline acceptance. Until those pass, the
count of new game admissions remains zero.

Retain the expansion target of **12–20 distinct retro/metal recordings**, normally
6–10 per family, delivered as independently accepted batches.

### Rejected and backup decisions

The following seven retro recordings are rejected for game admission/defaults:

1. Street Punks Fighting to Save the Princess
2. Rock City Ransom
3. Nario Versus Zonik
4. Welcome to Warp Zone
5. Here a Captive Heart Busted
6. The Story So Far (Sega-style FM Synth Remix)
7. Savage Circuitboard

Preserve their public historical previews. Keep the six metal previews as backups,
outside admitted standard shuffle: Vitalezzz's Curse of Moon, Realm of Torment,
Shadows Awaken Within, Unholy Surge; Bogart VGM's German Industrial Metal; and
MintoDog's Heavy Boss Battle 1. Do not label them user-approved replacements.

### Reference library retained

User references: Xpose/Xposed Reloaded, Horizon Chase, Slain/Slain 2, Crimsonland,
Valfaris, Let Them Come, GROOD, Broforce, Prodeus, DOOM and Huntdown. Expanded
references: Streets of Rage 2, Turrican, Unreal/Unreal Tournament, Tyrian, Deus Ex,
DUSK, Amid Evil, Turbo Overkill, Furi, Katana ZERO, Hotline Miami, Time Recoil,
Slipstream and Distance. Ukrainian cultural references include Authentic Ukraine,
Polyphony Project, Go_A, DakhaBrakha and ONUKA. Preserve source links in research
records. These establish musical properties, not redistribution permission.

## M7 — complete UA-FPV collection and private route (inactive)

Status: **removed from the active plan by user direction on 28 September 2026.**
Preserve the inventory, aliases, private packs and rights findings below as historical
evidence. Do not schedule public admission, archive publication or game-release work
for this item unless the user explicitly restores it.

- Preserve all **80 source MP3 filenames / 77 unique recordings**, exact uploaded
  bytes and three duplicate aliases. Standard playlist lists each unique song once.
- Dedicated UA-FPV collection is selectable, mixable and repeat-all/shuffle capable,
  with title/original filename and verified source website in Now Playing/details.
- Public admission requires recording-specific redistribution, credits/source and
  applicable artwork permission. YouTube availability and possession are insufficient.
  Keep every unresolved file in the inventory with its blocker; do not silently drop it.
- Publish approved exact MP3s under a new immutable archive batch, preserve all
  alias links and existing archive inventories, then add trusted game catalogue entries.
- Keep streaming by default, optional offline album installation/removal and custom
  playlist references. Roughly 205 MiB unique audio shares the 256 MiB media budget;
  do not force the complete collection offline. Every package stays below 64 MiB.
- Preserve the existing four private volumes and upload guide. Verify the released
  route: Audio/Music library → Backups & album files → Add album file to draft for
  each volume → Save → UA-FPV or My Mix → Play/Unmute. Imports must be additive,
  not replacement. Unpublishable recordings remain usable through that private route.

## M8–M10 — existing contracts to preserve and verify

### M8.discovery — make every published recording easy to find and play

Status: **complete for the public archive.** Archive
[PR #14](https://github.com/mekhovov/revealline-soundtracks-01/pull/14) merged at
`03a31a8b0f6e478b097b4468aaca92dfa275158c`; Pages
[run 36029085098](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36029085098)
published the historical root inventory of 104 unique recordings. Archive PRs
#18/#19 later preserved that baseline and raised the live root inventory to 128;
PR #25 raised it to 132, PR #26 raised it to 136 and PR #27 raised it to
**140 unique recordings across 15 collections** at
`cc7777bb62981ea9739a8efbc67f658f16f49a3f`. The root player now searches,
filters style groups, supports
multi-style mixing and sequential/shuffle/repeat playback without leaving the
page. Historical inventories and batch pages remain addressable.

The upload fast path is also public: `intake/add-music.mjs` accepts one MP3 or a
folder, reads common ID3 title/artist fields, creates stable identities and immutable
hash paths, updates generated catalogue/player files, runs verification and can open
a scoped PR. The operator must still provide source, licence, style tags and the
explicit `--confirm-rights` assertion; automation cannot infer redistribution rights.
PR #24 adds the fail-closed structured rights contract for new CC BY and CC BY-SA
rows while retaining narrowly pinned historical compatibility.

The game-native streaming adapter merged through PR #370 and is included in the
published v0.111.0 artifact. Archive76 and primary v0.111.1 public desktop checks
proved discovery, search and one same-page playback path for the then-current
128-recording archive. The later 136-recording catalogue introduced structured
rights that the older adapter rejected. Merged PR #523 and public v0.130.0 now
accept the trusted structure, keep remote playback on a persistent media element,
recover from bounded stalls and support online-plus-included mixed queues. Public
desktop acceptance loaded 136/136 and completed streamed Drama → bundled Shchedryk
→ streamed Cyber Anxiety in one session. Focused failure-fallback tests are green.
Merged test-only PR #555 extends those checks through catalogue 503 → Refresh and
real-player remote stall → included fallback → remote retry → included switch.
Physical-device/controller and cold-offline checks remain pending; the latter
coordinates with draft offline-app PR #536 instead of duplicating its launcher/runtime.
Preserve the
archive as the canonical source; the game streams exact immutable objects through
the transport while included and uploaded audio retain local crossfades. Preserve
every historic root-inventory assertion and the user-visible distinction between published auditions and admitted
defaults. PR #27's direct public same-page playback evidence proves the new object
and queue transition at the archive surface. The public v0.130 game subsequently
loaded 140/140, exposed the new collection and played City Limits Crash past 11
seconds in the shared in-game transport without leaving the game URL.

### Playback and user interface

Automatic / 90s Synth / Metal / Ukrainian / Fusion / My Mix, genre combinations,
custom ordering and All Songs shuffle remain. Repeat-all avoids immediate repetition
when alternatives exist; retain ordered and repeat-one modes. Automatic matches
menu/gameplay scene, authored energy and existing level themes; explicit selection
wins and music never changes gameplay, rewards or earned artwork.

Menu/title/campaign browsing uses appropriate music; Pause, Settings, results and
quick retries preserve gameplay continuity. Honor sound intent, browser unlock,
intentional music-only pause, interruption/background recovery and nested practice.
One owner, at most two decks, default 1.5-second fade and sequential fallback;
prepare only current/next, cancel obsolete requests and release outgoing resources.

Keep simple style/playlist/shuffle controls prominent and advanced tools collapsed.
Display title, artist, source website and original filename. Explain restricted
unavailable actions briefly. Recording mode excludes known Content ID and unverified
video permissions without promising immunity from automated claims.

### Catalogue, creator tools, rights and recovery

- Catalogue v2; library/bundle v3; import v1/v2; shared IndexedDB v5.
- Preserve existing stores/blobs and historical IDs; 123 uploads, 26 custom playlists,
  256 catalogue recordings and 512 assets/references.
- Exact upload bytes, credits, tags, role/energy/themes, custom ordering, audition,
  album assembly, additive import/export and local share packs remain. Preserve
  transactional saves and existing replacement-backup behavior; no new server accounts.
- Atomic metadata conversion only after successful save; concurrent writer checks,
  rollback, frozen-reader messages and unsupported-version/downgrade refusal before
  writes or blob deletion.
- Trusted permissions bind identity AND hash and are enforced by delivery/install/
  export APIs. Renaming bytes or editing credits cannot grant permissions.
- Full backups contain every permitted referenced original exactly. Missing
  unrestricted bytes fail visibly; never silently become URL-only backups.
- Restricted references are explicitly listed before export and after import with
  “Requires online restoration for listed music.” Never label that self-contained.
  Imported references do not authorize network requests or redistribution.
- Retag old catalogue items only through a trusted ID/hash overlay preserving saved
  pins and rights. Full existing-70 curation follows new content, not a prerequisite.

### Distribution and storage

Approved redistributable MP3s belong in the project-owned soundtrack archive with
exact hashes, source/licence evidence, credits and admin download. Keep immutable
existing objects/inventories. In-game-only files remain private until licensed
delivery is approved; no standalone archive/admin download/share audio. Offline
use needs corresponding permission. Hiding URLs, preview hotlinks or external-player
embeds do not resolve licence restrictions.

Retain GameDev Market extraction/delivery holds, Pixabay standalone/context/Content
ID holds, D.E.M.O.N and other conflicting-terms holds; exclude Mixkit music. Do not
relabel ShareAlike/NC/ND material as CC0/BY to satisfy a compiler.

Optional packages <64 MiB; shared installed audio/picture/story budget 256 MiB.
Download for offline, Installed only and removal retain references and uploads.
Keep optional audio out of core precaching except the accepted single Shchedryk
opening theme. Production maximum 650 MiB, scratch 256 MiB and ≥1 GiB free reserve;
use hosted builds/small batches. Never bypass the guard or delete originals/evidence.

## Acceptance and item-by-item delivery

### Music and functional acceptance

Verify authorized exact sources and permissions; fully decode every admitted file.
Permitted derivatives target −16 LUFS integrated ±1 LU and encoded true peaks
≤−1 dBTP. Require honest complete-track and repeated-session listening, transitions,
warning audibility, mono/small speakers and Ukrainian musical/cultural review.
Technical measurements do not establish musical approval.

Reuse meaningful existing regressions: mixed queues, genre/assignment selection,
shuffle/repeat, scenes/retries, missing files, denied unlock, overlapping fades,
mute/background/practice; full-capacity legacy migration, rollback, concurrent
sound/story/picture writers, forged rights/renamed restricted hashes, exact backups,
reference recovery, additive packs, cancellation, budget refusal and removal.
Quick-control tests add keyboard conflicts, controller focus, touch and unchanged
checkpoints/gameplay/SFX. Verify online plus cold offline restart with server
stopped. Physical iPhone/desktop/controller results remain separate from simulation.
Record unavailable or skipped checks honestly.

Repair demonstrated host/parser failures, not speculative assertions. Preserve
pinned-Prettier async generator regression. Run validation, lint, both formatting
checks, production reproducibility and full required production-history tests.
Refresh Field Kit ledger for changed UI/screen/audio fingerprints with scoped review
evidence; preserve historical revisions and unapproved recording status.

### Release sequence for each item

1. Latest accepted main in isolated source; scoped commits/PR and unrelated edits preserved.
2. New audio: archive PR → verified public exact MP3s → game admission PR.
3. Independent review; required preflight + four test shards + build on exact source.
   Skipped/cancelled gates are not passes. Keep all failure and partial evidence.
4. Coordinate version/sequence with **🔥 Releases**. Refresh main before freezing,
   inspect source delta and freshly qualify the actual merged commit.
5. Freeze and independently inspect the original hosted artifact with established
   exact binding, evidence assets and immutable annotated-tag/release protocol.
   Never reuse stale qualification or retag/reupload an accepted immutable release.
6. Separate reviewed Pages selector/controller PR, checks, merge and deployment.
7. Direct public version/root/release/download markers AND actual delivered music/
   controls verification; maintain Journey/Continue, Solo/Versus/Team, Legacy and
   Playground regression behavior from accepted historical releases.
8. Cold offline/device qualification; retain exact reports, limitations and screenshots.
9. Record PR, release, evidence and next action against the stable M-item, then
   continue. Do not hold a ready item for unresolved music families or all 36 originals.

## M11 — deferred original composition brief

**Paused, 0/36 approved.** Preserve candidate scores, native renders, sketches and
rejected Idle Frequency/A/B synchronization feedback. Do not resume the rejected
method merely to satisfy a number. A better method must earn accepted retro,
metal, Ukrainian and fusion pilots before expanded production.

- 36 distinct compositions: 12 Synth +12 Metal +12 Ukrainian. Each family has
  two menu pieces, eight gameplay tracks and two finales.
- Six fusions WITHIN 36: two synth gameplay, two metal gameplay, both Ukrainian finales.
  Alternate arrangements/encodings are not additional compositions.
- Menu 2–3 minutes; gameplay/finales 3–5 minutes; early hook, contrasting section,
  breakdown and developed return with synchronized instruments and original riffs.
- Initial six pilots: Idle Frequency, Glass Highway, Embers at Rest, Furnace Heart,
  First Light, Spring Circuit; then Steel Kolomyika fusion.
- Ukrainian titles retained: First Light; Threads of the Dnipro; Spring Circuit;
  Highland Switchback; Night on the Ridge; Kobzar’s Horizon; Evening Dance;
  City of Light; Reed Current; Harvest Lines; Steel Kolomyika; Pulse over the Dnipro.
- Document regional traditions and modern adaptations. Synthesized bandura/sopilka-
  inspired timbres must be labelled honestly; instrument names alone do not prove authenticity.
- Initial originals remain instrumental-led; language/pronunciation/provenance must
  be verified for vocal textures. Licensed vocal songs are not prohibited by this rule.
- Retain reproducible GPT-authored scores, small procedural patches/DSP, seeds,
  versions, prompts where relevant and source/licence/review evidence. No hosted
  generator, downloaded model or large sample library is an active prerequisite.
  Earlier ACE-Step/BandLab route is superseded and not blocking licensed releases.
- Preserve native-resolution masters, verified lossless FLAC round-trip and 256 kbps
  MP3 derivatives. Never call a lossy-source transcode a native lossless master.
  Archive masters with verified hashes before removing redundant working copies.
- Six volumes of six compositions, each <64 MiB; selective installation under 256 MiB.
- Full completion remains 36 reviewed originals plus working framework/creator/
  licensing/recovery workflows. Licensed additions do not increment original count.

## Historical source and qualification register

The following earlier evidence and research register is retained, with clarified
immutable evidence locations. Its
candidate classifications are historical; the explicit current decisions above
(rejected retro, backup metal, approved Nakarada taste) take precedence. No held
licence or technical receipt becomes listening approval.

## Rights and musical holds preserved

- **Oleg Mazur — [Ой у лузі червона калина](https://soundcloud.com/fm_freemusic/oy-u-luz-chervona-kalina-the-red-viburnum-in-the-meadow-ukrainian-patriotic-march-by-oleg-mazur)
  and [Prayer for Ukraine](https://soundcloud.com/fm_freemusic/bozhe-velikiy-diniy-prayer-for-ukraine-spiritual-anthem-of-ukraine-by-oleg-mazur):**
  creator CC-BY leads remain held for an exact authorized original and licence
  version. Hypeddit currently asks for SoundCloud connection, comment, like,
  repost and follow; none are authorized or performed. Prayer is a solemn/menu
  possibility, not presumed action music.
- **[Mark Wilson X — Carol of the Bells](https://freemusicarchive.org/music/mark-wilson-x/single/carol-of-the-bells/):**
  [creator CC BY 4.0 statement](https://soundcloud.com/mark-wilson-x/carol-of-the-bells-royalty-free-cc-by) and approximately 1:21 instrumental metadata remain leads;
  exact acquisition/arrangement review is unresolved after the research reader's
  HTTP 403. Another Shchedryk arrangement does not add a distinct composition.
- **Pixabay [Hutsul Havoc](https://pixabay.com/music/main-title-hutsul-havoc-ethno-action-ukrainian-soundtrack-192015/), [Hutsul Fantasy](https://pixabay.com/music/folk-hutsul-fantasy-132797/) and bandura recordings:** standalone MP3 redistribution is not
  cleared. Hutsul Fantasy is credited to `_Music_for_Creators_`, not Rockot.
  Keep these outside the public archive unless recording-specific permission
  resolves delivery. Do not substitute preview hotlinks for permission.
- **Six Lysenko piano performances:** Couranta, Valse of Farewell, Barcarole,
  Dream op. 12, Song of Love and By a Cradle retain their documented Lviv
  Conservatory / Wikimedia Ukraine recording provenance and **CC BY-SA 3.0**
  status. They are held for a separate share-alike audiovisual delivery decision;
  do not relabel them as CC BY to pass the compiler. The exact file, pianist and duration table remains below. Their composition /
  edition clearance and classical context remain separate from recording rights.
- **UA-FPV:** possession and YouTube availability do not establish public MP3
  redistribution rights. Keep the existing private packs and upload guide; no
  outreach or new public admission is implied.
- **Generic geographic titles:** Holizna's _Ukraine_ and similar labels alone do
  not establish Ukrainian musical motifs. Do not use them to fill a numeric quota.

### Documented Ukrainian classical fallback — held

These six Mykola Lysenko piano recordings have recording-specific CC BY-SA 3.0
permission from the Lviv Conservatory / Wikimedia Ukraine collaboration. Yuriy
Bulka made the recordings. They are not CC0/CC BY and must not be relabelled to
pass the current admission compiler. Share-alike audiovisual adaptation terms
need a separate delivery decision. No media has been downloaded or auditioned.

| Recording                                                                                                                                                                               | Pianist               | Published duration |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------ |
| [Couranta, Ukrainian Suite](https://commons.wikimedia.org/wiki/File:Lysenko-Suite-02-Couranta.ogg)                                                                                      | Lesia Lemekh          | 3:34               |
| [Valse of Farewell](https://commons.wikimedia.org/wiki/File:Lysenko-Valse_of_farewell.ogg)                                                                                              | Zenovija-Anna Danchak | 3:55               |
| [Barcarole](https://commons.wikimedia.org/wiki/File:Lysenko-Barcarole.ogg)                                                                                                              | Olha Bilas            | 3:09               |
| [Dream, op. 12](https://commons.wikimedia.org/wiki/File:Lysenko-Dream_op._12.ogg)                                                                                                       | Iryna Posviatovs'ka   | 4:22               |
| [Song of Love](https://commons.wikimedia.org/wiki/File:Lysenko-Song_of_love.ogg)                                                                                                        | Olena Havjuk-Sheremet | 3:12               |
| [By a Cradle](<https://commons.wikimedia.org/wiki/File:Lysenko-Lullaby_(%C2%AB%D0%9F%D1%96%D1%81%D0%BD%D1%8F_%D0%BF%D1%80%D0%B8_%D0%BA%D0%BE%D0%BB%D0%B8%D1%81%D1%86%D1%96%C2%BB).ogg>) | Zenovija-Anna Danchak | 5:01               |

Dream's source identifies its folk-song basis, «На солодкім меду». The collection
is documented Ukrainian classical piano music, not an energetic folk-electronic
album. Its composition/edition clearance and gameplay context remain separate
from recording permission.

### New optional ceremonial lead — not an admission

[Luke Minovych Horenko — Ще не вмерла Україна](https://commons.wikimedia.org/wiki/File:%D0%9B._%D0%93%D0%BE%D1%80%D0%B5%D0%BD%D0%BA%D0%BE_-_%D0%A9%D0%B5_%D0%BD%D0%B5_%D0%B2%D0%BC%D0%B5%D1%80%D0%BB%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D0%B0.ogg)
is a creator-published synthesized instrumental recording under **CC0**, dated
27 March 2020, with a directly linked authorized original. Source metadata gives
93.214 seconds and 4,233,544 bytes; these have not been verified against acquired
audio. [Ukrainian government composition history](https://www.kmu.gov.ua/news/247989866)
identifies Verbytsky's music and Chubynsky's text.

Hold it for sound quality, composition/arrangement and cultural-context review.
It is an optional ceremonial/menu possibility, not a substitute for the requested
energetic Ukrainian repertoire. The US Navy rendition is the same composition and
must not be counted again. No audio was downloaded or auditioned during this lead's
research.

## Public verification records

[Reports retained on PR #321 at immutable source e6a766a](https://github.com/mekhovov/revealline/tree/e6a766abce745e1993c53a2652d8e03e50e7a5e5/docs/verification/core-soundtracks-2026-09-24) record
exact public bytes/hashes, deployed commit/run identities and limited desktop
browser observations. Those evidence files are not included in this docs-only PR
and are not yet on main; retain their immutable PR source links until admission merges. The first Ukrainian HTTP probe incorrectly required the
hidden `.nojekyll` Pages control marker to be publicly served and got HTTP 404.
That failed attempt is retained. The corrected probe excludes only that marker
and requires every runtime asset, MP3 and public metadata file to match. It does
not count the control marker as an HTTP pass.

## Historical qualification evidence — retain

- Archive failed intake runs **35943657893**, **35943774127** and **35943850666**:
  three source filenames differed from creator download links.
- Run **35944115394** passed 13 recordings and rejected _Angry Bullfrogs Riding
  Motorbikes_ below the 60-second floor. It was excluded; the gate was not waived.
- Run **35944483804** encountered source HTTP 502. Fresh run **35944843598** at
  `4e9e572848848a314cd48f31a290b83850ee6b65` passed all 13. Artifact **10786113658**
  has ZIP SHA-256
  `0b95238aa7bb27a89b12864f35ac1df850e7a69dae5b7fea3257a764ebf58f5c`.
- Source/derivative archival commit **`9e386c9c489bd193c830cd60ac6f26e7553dc335`**
  preserved all 13 MP3s, native originals and snapshots. Hosted verification
  **35945506601** checked the archive's then-total **83 recordings / 412,480,317
  audio bytes**. This is an archive count, not the game's built-in count.
- Game qualification **35944418013** at
  `913306a736443959b4b8ff913c0976093a2b06bb` failed before source validation because
  two inherited diagnostics fixtures exhausted mocked Git responses in
  `publishing/utility/test_upload_diagnostics.py`. Later gates were skipped, not
  passed. The independently reviewed fixture-only PR #322 was accepted at
  `d0c73b4723798f6490f2680a59fd8d8a59983ac1`; the soundtrack branch was refreshed
  onto that fix. Current exact-head progress is reported above.
- Four local archive-builder tests were blocked by the existing **1 GiB free-disk
  guard**. Do not bypass it or count blocked checks as passes. Use hosted audio
  acquisition, builds and actual-byte verification while local reserve is low.
- Ukrainian technical run **35945483057** passed the prepared Nakarada recording.
  It provides no full listening, instrumental-content or cultural approval.

Physical iPhone/desktop listening and cold offline checks remain distinct from
automated or simulated checks. No reviewer names, approval timestamps or musical
acceptance may be inferred from technical success.
