# Media campaigns: decisions for the next batch

> **Historical snapshot:** this document records the 1 October 2026 review. Queue, deployment, pull-request status, release, capacity and recommendation statements below are dated evidence, not current instructions or current repository status.

Review date: 1 October 2026. Scope: creating playable campaigns from personal images/videos and
sharing them. Proposed priorities await the user's review. The [delivery register](delivery-plan.md)
contains the source checkpoint, phase status and evidence links.

## What is already usable

The documented local journey is: **choose images/videos → generate → review/edit → approve →
install or download → share the file → play and resume**. It is account-free. The creator can
handle batches, pair an image with a video, choose a poster and offer the video after a legal win.
A downloaded `.rlpack` contains gameplay and required media; `.rlsource` is the separate private
source backup. Player saves are separate again.

The empty generated board was addressed: the recorded baseline has six layout families, twelve
variants, interior obstacles and a moving enemy. Selection is seeded and bounded. This delivers
repeatable, checked configurations; it does not promise unlimited unique layouts or enjoyment at
every campaign length. Solo, equal-board Versus and purpose-built Team creation have documented
acceptance. The optional editor already trims and converts supported video formats.

The public store's software also exists, including accounts, uploads, validation, search, download,
reporting and moderation. Hosted container rehearsals passed. A chosen production host, real email,
operator acceptance and live public availability are not established by those rehearsals. Phases 4–5
are therefore implementation-complete within their recorded scope but not public-launch-complete.

## R1 — Make sure the current creation journey earns the "simple" claim

**Meaning.** Use the latest selected build as a normal creator: import one image, a mixed batch and
one video; review the map; regenerate; approve; download the actual file; install it in separate
storage; start, interrupt, resume and finish; confirm the same picture and optional movie remain.
Also leave the advanced editor and return with browser Back/Forward.

**Why / benefit.** This checks the user's original requirement: ordinary people should not need
JSON or a terminal. It catches confusing buttons, lost drafts and mismatches between saved files
and visible results. A small human play sample also identifies repetitive maps or unhelpful pacing
that successful automated routes cannot judge.

**What is already done.** Historical creator acceptance covers these major functions. PR #869's
offline-verification repair is merged. Current Discovery/lesson code has suspension support that the
open #826 description originally reported absent. That narrows the next step to verifying actual
behavior and reconciling evidence before writing replacement code.

**If deferred.** Earlier accepted builds remain useful, but recent shared menu/editor changes lack
fresh creator journey evidence. We may mistake "implemented" for "still easy and reliable today."
This is a risk to verify, not a newly reproduced failure.

**Finish when.** A named build has recorded real file transfer, legal play/reload, exact reward,
video controls and Back/Forward results; any observed defect has a scoped fix or explicit issue;
the guide matches the screens. An independent origin is labelled honestly, not called a new browser
profile. Keep observations about fun separate from solvability proof.

**Recommendation / effort.** Do next. Allow 0.5–1 focused day for a bounded review; estimate any
fixes afterward. New layout families should follow demonstrated repetition, not automatically become
a large new generation project.

## R2 — Turn the community code into a small usable service

**Meaning.** Put the server and database on a chosen host, give them a domain and HTTPS, connect
verification/password-reset email, then prove that Creator A can publish a pack and Player B can
find and install it. Interrupt an upload and resume it without starting over.

**Terms.** TLS is the encryption behind HTTPS. A reverse proxy is the public web entry point that
forwards requests to the application; correct addressing matters for account and upload limits.
`tus` is the existing resumable-upload mechanism. PostgreSQL stores users, submissions and catalog
records; uploaded package files live in the configured file/object storage.

**Why / benefit.** Creators stop sending files manually. Players can discover campaigns in the
store and download an exact published edition. This is the largest remaining change to what other
people can do with the feature.

**What is already done.** Account, validation, catalog and upload code plus deployment scripts and
container rehearsals exist. The work is selecting/configuring a real environment and running the
existing acceptance procedures there. A selected host could still reveal defects requiring fixes.

**If deferred.** Creation, `.rlpack` sharing and installed play continue. Public discovery, account
registration and server publication stay unavailable or unclaimed. There is no need to buy hosting
merely to keep local creation working.

**Finish when.** Real email arrives, verified sign-in and recovery work, a resumed upload publishes
only after validation, a second account installs/plays the exact edition, and a service restart
retains it. Captured test email alone does not prove real mailbox delivery. Open public submissions
only after R3 also passes.

**Recommendation / effort.** Next if public publishing is the chosen goal. Initial acceptance is
0.5–1 day once host, domain, mail and access are ready. Provisioning, provider decisions, operating
costs and discovered fixes are outside that estimate. No provider or spending decision is made here.

## R3 — Be able to remove bad submissions and recover the service

**Meaning.** An administrator opens a reported campaign, reviews its preview, removes it from the
public catalog and resolves the report. Separately, restore a backup of the database and package
files into an isolated target and verify the restored downloads.

**Why / benefit.** Public uploads need a working human response path. Backups need a proven restore
path: saving files alone does not prove users' published campaigns can be recovered. The term
"operator cutover" in the previous plan meant this readiness to operate the real service.

**What is already done.** The moderation page, report/unlist APIs, audit trail, backup commands,
restore rehearsal and verification runner are implemented. Real administration and restore on the
chosen storage are still pending.

**If deferred.** Local users are unaffected. Public submission handling could be unreliable, and a
server failure could leave campaigns unavailable with no verified recovery route. For that reason,
this is a condition of public launch, not an optional task after opening the store.

**Finish when.** The actual browser action removes the intended disposable listing, the verifier
confirms removal, and a backup restores exact campaigns on a separate target without damaging the
source. Name the operator and record the backup destination and recovery instructions.

**Recommendation / effort.** Bundle with R2 before public launch. Initial effort is 0.5–1 day after
deployment, with overlap in the two-user journey; do not sum duplicate test steps. This plan update
does not authorize overwriting any existing production database.

## R4 — Know which browsers, phones and videos really work

**Meaning.** Repeat representative imports, export/install, video playback and resume on the agreed
target browsers/devices. Check actual audible sound, touch controls, orientation, autoplay refusal
and a fresh browser profile. Record file encoding as well as extension: two `.mp4` files may use
different video/audio codecs.

**Why / benefit.** A supported browser does more than open the page: it must decode the media,
complete downloads, keep state and play the result correctly. This turns a narrow tested workflow
into a defensible support promise for the intended audience.

**What is already done.** Built-in-browser evidence includes images, inspected video, AVC/H.264 with
AAC audio, poster retention and bounded physical conversion. That does not establish Safari,
Firefox, physical mobile or sound from physical speakers. Broader codec support is not automatically
implemented by running a matrix; failures may justify a separately scoped conversion feature.

**If deferred.** The tested boundary remains narrower. Some unsupported media is rejected clearly;
unqualified browsers could also expose unknown behavior. We should not advertise universal phone
or browser support.

**Finish when.** A small published matrix states browser/device version, codec, successful journeys
and limitations. The previously requested built-in-browser scope remains the current scope until
new environments are actually exercised.

**Recommendation / effort.** After R1, or before hosting if most intended users are on phones or
Safari. Allow 1–2 days for an agreed small matrix once devices are accessible; fixes are additional.

## R5 — Understand large-import and low-storage behavior

**Meaning.** Measure memory while preparing a large mixed campaign; attempt a controlled low-space
write; cancel it; reopen the app and recover the draft/package. Use disposable data for any deliberate
database-corruption experiment. Start with representative cases instead of filling the user's disk.

**Why / benefit.** Large videos and batches stress temporary memory and staging space. This gives
realistic capacity guidance and verifies that a failed install leaves work recoverable.

**What is already done.** Sequential full-size image processing, package splitting, storage budgets
and deterministic rollback/missing-original/interruption tests exist. Genuine browser-wide quota
exhaustion, arbitrary database corruption and measured peak memory are separate, unclaimed evidence.

**If deferred.** Normal cases keep their recorded evidence, but we cannot give measured worst-case
capacity guarantees. Heavy creators are more likely to encounter slowdowns or recovery surprises.

**Finish when.** Record batch size, media bytes, environment, peak memory where measurable, the
failure/cancellation point and successful recovery. Distinguish injected storage errors from real
browser quota failure. Restore experiments must not use valued player data.

**Recommendation / effort.** Move a representative large-video check into R1 if large imports are
common. Keep exhaustive corruption cases later. Budget 0.5–1 day of initial investigation; tooling
limitations can increase it.

## R6 — Qualify AWS storage only when we need AWS storage

**Meaning.** Run the existing S3 storage adapter against a real private bucket, using narrowly scoped
IAM permissions; interrupt multipart uploads; restart; clean up incomplete transfers; restore and
verify exact package bytes. S3 is object storage, and IAM defines what the service can access.

**Why / benefit.** It supports an AWS deployment and shared file storage for multiple server
instances. A local S3-compatible rehearsal cannot prove the chosen AWS permissions and configuration.

**What is already done.** Adapter, upload/recovery logic and MinIO rehearsal exist. Real credentialed
AWS acceptance remains open. S3 alone does not qualify the complete application for multi-host scale.

**If deferred.** A one-host deployment can use the supported filesystem storage. Local campaign
creation and file sharing are unaffected. AWS operation remains unqualified.

**Finish when.** The chosen bucket and IAM setup pass exact publication/download, interrupted upload,
cleanup and recovery checks, with secrets excluded from evidence.

**Recommendation / effort.** Defer until an AWS-backed deployment is chosen. If it is chosen now,
make this a dependency of R2. Allow 0.5–1 day after access exists, excluding provisioning/cost review.

## R7 — Finish the selected release without treating every PR as a new phase

**Meaning.** Qualify the reviewed integrated source, pass applicable repository gates, publish an
immutable artifact, and record actual public behavior. A milestone schedules work; merging puts
code on main; a continuous Pages deploy and a frozen GitHub Release are separate results.

**Why / benefit.** Users get one identifiable, recoverable version and reviewers know which build
was actually exercised. Campaigns created afterward can publish independently without a game release.

**What is already done.** Previous plan PR #873 and offline verifier PR #869 are merged. Latest
observed non-draft GitHub release remains v0.142.3. They must not be listed as unimplemented work.

**If deferred.** New source improvements may be accessible on continuous Pages while downloadable
frozen releases lag. Do not describe the whole v0.150.0 milestone as released.

**Finish when.** The coordinator records the selected source, required gates, artifact identities,
public checks and explicit remaining limitations. Skipped automated suites stay labelled skipped.

**Recommendation / effort.** Continue the existing release lane. Timing depends on its selected
scope, capacity and CI; no calendar ETA is defensible here. #868 (historical Team import repair) and
#865 (native staging size) have separate scope/holds and do not establish missing basic image/video
creation. The [register](delivery-plan.md) links those issues and their limits.

## Choose the product direction

| Option for review                                      | Next batch                                                                                          | What waits                                                | Best fit                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Local creation and sharing first — recommended default | R1, plus a representative R5 check if imports are large. Fix observed friction; maintain the guide. | R2/R3 hosting and R6 AWS.                                 | Make personal campaigns easy and reliable with no account or service operation. |
| Public community next                                  | R1 smoke, then R2 and R3 as one launch gate; R6 only if required by the chosen host.                | Broad device coverage and exhaustive storage experiments. | Other people need in-game discovery and publishing soon.                        |
| Phone/browser reach first                              | R1 followed by a targeted R4 matrix.                                                                | Public store operation and optional AWS.                  | Most intended creators/players use currently unqualified devices.               |

Recommendation: choose the first option unless there is a near-term audience waiting to publish
publicly. A change of priority does not discard the existing server work. It decides which remaining
benefit is worth the next engineering and operational effort. No hosting choice, spend, support
expansion or large new generation project is approved by this document.
