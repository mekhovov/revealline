# Media campaign delivery register

Approved 24 September 2026. Browser-first, local and account-free creation; images are reveal rewards; Solo first; portable files before a free self-hosted community store. This register implements the approved sequence and does not supersede another task's release ownership.

| Phase | Deliverable                                                                                   | Acceptance gate                                                                                                 | Status                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Beginner guide, framework reference, maintainer handoff, owned examples                       | Reproduce current preview/install/share distinction                                                             | v0.105.0 released and accepted                                                                                                 |
| 1     | Single image, six verified layout families, review/approval, `.rlpack`, installed Custom play | Actual download installs in clean profile; ordinary legal win, earned picture after reload, unfinished recovery | Included in combined creator release candidate                                                                                 |
| 2     | Batch images, ordering/pacing, groups, checkpoints and bulk approval                          | 1/12/50 items, duplicates, portraits, per-item failure, cancellation, bounded memory and capacity splitting     | Included in combined creator release candidate                                                                                 |
| 3     | Mixed media, pairing, three posters, frame capture, playback range and victory story          | Paired and video-only wins, audio, Skip/Replay, unsupported codecs, exact poster and portable recovery          | Included in combined creator release candidate                                                                                 |
| 4     | Self-hosted accounts, resumable uploads, validation jobs, automatic publication and catalog   | Ownership, corrupt upload rejection, restarts, listing and database/blob restore                                | Included in combined candidate; hosted restore rehearsal pending                                                               |
| 5     | Integrated store, discovery, publish/install/update/offline and removal                       | Two-user full journey, exact immutable saves/rewards across updates and offloading                              | Included in combined candidate; deployed service journey pending                                                               |
| 6     | Versus qualification                                                                          | Both boards, equal conditions, results, Retry/Next and transfer                                                 | Included in combined creator release candidate                                                                                 |
| 7     | Purposeful Team templates                                                                     | Both players contribute; failure/retry and every advertised preset/path                                         | Installed editions, exact attempt recovery/rewards and playable picture/video media packages included                          |
| 8     | Optional physical trimming, resizing, compression and conversion                              | Inspect actual exported/decoded bytes, timing, orientation, sound sync and playback                             | Silent MP4/WebM-to-AVC trim/conversion, bounded resize/compression and rotated portrait output verified; audio remains pending |

The implementation phases retain separate documentation and acceptance records, while the completed stack is reconciled and released as one creator feature. Dependent behavior remains unaccepted until its recorded prerequisites pass.

## Current status and remaining effort — 25 September 2026

The estimates below are focused engineering time from the current combined checkout, not calendar
release dates. Publication timing depends on the sole publisher assigning an immutable release slot.

| Workstream                        | Current result                                                                                                                                                                                                                                                                                                                | Remaining work                                                                                                                                                                                                               | Focused ETA                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Phases 0–6                        | Phase 0 is released. Image, batch and video campaigns, portable install, community client/service, store and Versus source are consolidated in draft PR #465. The post-merge gate passes 516/516 creator/runtime and 43/43 service checks. A real video upload generated, installed and launched a threatened Custom mission. | Finish repository validation/build evidence, push the exact reviewed head and obtain hosted review.                                                                                                                          | 0.5–1.5 hours                                                                                     |
| Community upload integrity        | Shared admission, report moderation, exact blob re-authentication, recovery snapshots and PostgreSQL-backed tus locking/leased expiry cleanup are implemented. The current service gate passes 43/43, including account recovery.                                                                                             | Live multi-process PostgreSQL, shared datastore/S3, reverse-proxy interruption and database/blob restore rehearsal on the selected host.                                                                                     | 0.5–1 day after infrastructure is available                                                       |
| Phase 7 Team continuity and media | Immutable editions, replay-verified launch, exact attempt snapshots/restoration, stale-tab protection, legal-clear receipts and exact picture reward identities are complete. A strict binary package now installs and plays exact pictures plus optional post-win videos; its focused combined cohort passes 23/23.          | An end-user Team media assembly UI and shared-media aggregate quota accounting remain follow-ups; the package API, import, install and runtime path are complete for this release.                                           | Assembly UI: 1–2 days; aggregate accounting: 0.5–1 day                                            |
| Phase 8 media conversion          | Silent MP4/WebM to authenticated AVC MP4, no-upscale Balanced/Compact resize, bitrate evidence and rotated portrait Compact output are complete. Focused orientation checks pass 50/50 and the expanded media cohort passes 114/114.                                                                                          | Independent audio timestamp/synchronization verification, Firefox/Safari qualification, Balanced portrait evidence and physical mobile playback.                                                                             | Audio engineering: 1–2 days; browser/device acceptance: 0.5–1 day once environments are available |
| Account recovery                  | Better Auth email verification, verified-email publishing, password reset, session revocation, bounded HTTPS mail webhook delivery and creator UI are implemented. Service checks pass as part of 43/43.                                                                                                                      | Configure a production sender/gateway, verify real mailbox delivery and rehearse operator recovery.                                                                                                                          | 0.5 day after mail infrastructure is available                                                    |
| Consolidation and PR              | PR #465 remains the single combined creator source review. All planned local workstreams are implemented and locally qualified. The release owner stopped the candidate before push when player-first work reclaimed v0.112–v0.116.                                                                                           | Keep the terminal source parked without further feature expansion. When its post-player slot opens, merge only the accepted predecessor, apply the assigned version, rerun exact-head gates and push for independent review. | Reconciliation and gates: 2–4 hours after slot opening                                            |
| Immutable release                 | Public `v0.111.1` acceptance is complete. The authoritative queue now places this aggregate at provisional `v0.123.0`, or the next unused post-player version if preceding releases move. The local `0.112.0` identities and build are rehearsal evidence only and must not be pushed, tagged or published.                   | The sole publisher will assign the exact slot, freeze, tag, publish and verify online/offline bytes after the player-first programme reaches this candidate.                                                                 | Publisher work: 2–4 focused hours after slot assignment; queue date is external                   |

## Blockers and concerns

- The release owner corrected the queue after local v0.112 qualification: PR #482 and subsequent
  player-first work own v0.112–v0.116, while PR #465 moves to provisional v0.123 or the next unused
  post-player slot. The local version identities are intentionally unpushed and are not a release
  claim. Final reconciliation must merge, never rebase, the exact predecessor selected when that
  slot opens.
- Docker and PostgreSQL clients are unavailable on this host. Shared tus SQL, migrations and
  recovery logic have exact fake-client tests, but live multi-process locking and a database/blob
  restore still require the deployment environment.
- The community API is source-complete enough for local review but is not a live public service.
  Hosting, TLS/domain/secrets, proxy limits, shared object storage, mail gateway, monitoring,
  isolated media processing and off-host backup/restore remain operator work.
- The user selected the built-in browser when Safari computer control was unavailable. Firefox,
  Safari and physical mobile media behavior remain unqualified and must not be inferred from
  Chromium evidence.
- Audio-bearing physical conversion remains disabled until decoded output audio timestamps and
  synchronization can be independently verified. Rotated portrait Compact output now has exact
  built-in-browser evidence; Firefox, Safari, Balanced portrait and mobile variants remain open.
- Two unrelated Couch wording suites contain seven stale assertions that fail identically on the
  pre-Team baseline and combined source. They remain outside the creator-specific gate and are not
  counted as passing.
- The combined PR is broad. Immutable identities, replay verification and exact media/package
  hashes reduce integration risk, but reviewer load and moving-main conflicts are material release
  concerns.

See the [Phase 1 walkthrough](image-campaign-guide.md), [batch campaign walkthrough](batch-image-campaign-guide.md), [video campaign walkthrough](video-campaign-guide.md), [portable/source format reference](creator-bundle-reference.md), [Phase 1 acceptance record](phase1-acceptance.md), [Phase 2 candidate acceptance record](phase2-acceptance.md), [Phase 3 candidate acceptance record](phase3-acceptance.md), [Phase 4 service acceptance record](phase4-acceptance.md), and [Phase 5 client acceptance record](phase5-acceptance.md). The Phase 1 candidate supports one image and one mission selected from twelve verified variants across six families. Later phase behavior is not advertised as released until its separate release passes every recorded gate.

## Contracts to preserve

- Choose media → Generate → Review → Approve and install / Download pack. One image or video becomes a mission; unique normalized stem pairs become one mission. Ambiguity requires correction. Hashes, not names, identify assets. Natural ordering remains editable; failed items require explicit exclusion.
- Versioned bounded template variants and successful legal recordings. Replay the actual compiled identity, difficulty and runtime seed. Gameplay edits invalidate evidence; artwork-only edits retain unchanged simulation evidence but need review. Store explicit generated source, template version, variant, seed and policy.
- `prepareCreatorBundle`, `exportCreatorBundle`, `installPreparedCreatorBundle`; immutable reviewed preparation, cancellation and stale-state protection. Uncompressed bounded manifest plus binary `.rlpack`, format `revealline-content-bundle.v1`, SHA-256 inventory and exact dependency closure.
- Share editable gameplay and required runtime media only. Separate **Back up source project** for retained originals/editor data. No unrelated media or player data in either content workflow. A verified resolver serves strict logical PNG paths; reviewed derivatives preserve renderer/compiler contracts.
- Real installed Custom progression and immutable editions. Journal cross-domain installation; stage before indexing; preserve old attempts and earned art. Retain current budgets, show staging requirements and offer explicit split/remove choices.
- Native intake, sequential full-size image preparation, orientation and bounded decoding. Reuse IndexedDB and managed-media accounting. Video-only candidates at 10/50/90%, midpoint default, with requested and observed times distinct.
- Playback range retains complete video. Physical trim creates different bytes and requires verification. Win awards the poster first; optional Play/Skip/Replay never blocks Next or awards progress.
- Self-hosted Node ES modules, Fastify, Better Auth, PostgreSQL jobs, isolated validation worker, disk/S3 blobs and tus. Docker Compose release before a separately chosen production host. Same-origin deployment; explicit auth for static clients without third-party-cookie dependence.
- Creator-approved upload stays private until validation; idempotent hash-bound jobs; immutable public editions; quotas, report/unlist/audit. Automated feasibility is distinct from creator playtesting and official content.

## Research basis

These decisions reuse the existing framework and the approved review:

- [PCG textbook](https://www.pcgbook.com/): constructive generation and generate-and-test; a successful route establishes feasibility for its configuration, not universal balance.
- [MDN image decoding](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap): orientation-aware native decode with visual verification.
- [MDN playback capability](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType): likelihood hints are not actual decode evidence.
- [MDN storage estimates](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate): estimates are advisory; writes still need recovery.
- [Mediabunny conversion](https://mediabunny.dev/guide/converting-media-files#trimming): nondefault start trimming requires transcoding; optional lazy conversion comes later.
- [tus Node server](https://github.com/tus/tus-node-server): resumable transport with filesystem and S3 adapters.
- [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): bounded supported content, isolated processing and public-upload controls.

Cross-phase verification includes stale approvals, simultaneous tabs, interrupted commits, quota failure, malformed packages, missing dependencies, old formats, immutable updates, autoplay refusal, background pause and service outages. Browser and physical-device limitations must remain explicit.

## Browser scope update

On 24 September the user directed “use builtin browser instead” when Safari computer control was unavailable. Use the built-in browser for this delivery and explicitly record Firefox/Safari as untested. Independent-origin storage is not a claim of a separate clean browser profile; physical mobile qualification remains separate.
