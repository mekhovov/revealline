# Media campaign delivery register

Approved 24 September 2026. Browser-first, local and account-free creation; images are reveal rewards; Solo first; portable files before a free self-hosted community store. This register implements the approved sequence and does not supersede another task's release ownership.

| Phase | Deliverable                                                                                   | Acceptance gate                                                                                                 | Status                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Beginner guide, framework reference, maintainer handoff, owned examples                       | Reproduce current preview/install/share distinction                                                             | v0.105.0 released and accepted                                                                                                                |
| 1     | Single image, six verified layout families, review/approval, `.rlpack`, installed Custom play | Actual download installs in clean profile; ordinary legal win, earned picture after reload, unfinished recovery | Merged through PR #465                                                                                                                        |
| 2     | Batch images, ordering/pacing, groups, checkpoints and bulk approval                          | 1/12/50 items, duplicates, portraits, per-item failure, cancellation, bounded memory and capacity splitting     | Merged through PR #465                                                                                                                        |
| 3     | Mixed media, pairing, three posters, frame capture, playback range and victory story          | Paired and video-only wins, audio, Skip/Replay, unsupported codecs, exact poster and portable recovery          | Merged through PR #465                                                                                                                        |
| 4     | Self-hosted accounts, resumable uploads, validation jobs, automatic publication and catalog   | Ownership, corrupt upload rejection, restarts, listing and database/blob restore                                | Merged through PR #465; hosted restore rehearsal pending                                                                                      |
| 5     | Integrated store, discovery, publish/install/update/offline and removal                       | Two-user full journey, exact immutable saves/rewards across updates and offloading                              | Merged through PR #465; deployed service journey pending                                                                                      |
| 6     | Versus qualification                                                                          | Both boards, equal conditions, results, Retry/Next and transfer                                                 | Merged through PR #465                                                                                                                        |
| 7     | Purposeful Team templates                                                                     | Both players contribute; failure/retry and every advertised preset/path                                         | Hardening follow-up implements exact attempt recovery/rewards and playable picture/video packages; assembly UI remains                        |
| 8     | Optional physical trimming, resizing, compression and conversion                              | Inspect actual exported/decoded bytes, timing, orientation, sound sync and playback                             | Hardening follow-up verifies silent MP4/WebM-to-AVC conversion, bounded resize/compression and rotated portrait output; audio remains pending |

The implementation phases retain separate documentation and acceptance records, while the completed stack is reconciled and released as one creator feature. Dependent behavior remains unaccepted until its recorded prerequisites pass.

## Current status and remaining effort — 26 September 2026

The creator framework from PR #465 is merged. This follow-up branch is rebased onto protected
`main` at `e11bf150fa7b6201a17ca6e4e51a0623b4eb88b4` (`0.131.0`) and contains ten later hardening
commits plus this exact-head compatibility update. Estimates are focused engineering time, not calendar release dates.

| Workstream           | Completed/current result                                                                                                                                                                                                                                                                   | Remaining work                                                                                                                                        | Focused ETA                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Phases 0–6           | The guide, image and batch generation, mixed video campaigns, `.rlpack`, installed Custom progression, community client/service, store, and Versus framework are merged through PR #465. Current generation uses twelve verified threatened variants with enemies and collision obstacles. | Publish the rebased localization/build-fixture compatibility fixes through a focused follow-up review.                                                | 0.5–1 hour                                                                            |
| Community hardening  | PostgreSQL-backed admission, tus locks and expiry leases, isolated validation, exact blob checks, account email verification/password reset, moderation, backup, and restore are implemented. The rebased service suite passes 43/43.                                                      | Run live multi-process PostgreSQL, proxy interruption, shared blob/S3, mail delivery, and database/blob restore rehearsals on the selected host.      | 0.5–1 day after infrastructure is available                                           |
| Phase 7 Team         | Purpose-built templates, replay-qualified launch, immutable editions, exact unfinished-attempt recovery, stale-writer rejection, picture rewards, and optional victory-video packages are implemented in this follow-up.                                                                   | Add the end-user Team media assembly/review UI and aggregate its installed bytes with the shared managed-media budget.                                | UI: 1–2 days; aggregate accounting: 0.5–1 day                                         |
| Phase 8 media editor | Silent MP4/WebM input can be trimmed or converted to AVC MP4 with bounded Balanced/Compact resize and compression. Exact duration, dimensions, orientation, codec, hash, bitrate observation, zero-audio inventory, and visual boundaries are verified.                                    | Add independently verified audio timing/synchronization, then qualify Firefox, Safari, Balanced portrait, and physical mobile playback.               | Audio: 1–2 days; browser/device acceptance: 0.5–1 day when environments are available |
| Follow-up review     | Ten hardening commits and this exact-head compatibility update are rebased on current `main`; the complete creator gate passes 516/516 runtime checks and 43/43 service checks. Root validation, localization, lint, and format checks pass.                                               | Push a new review branch and open the focused follow-up PR after the final exact-head gate rerun.                                                     | 0.5–1 hour if the exact-head rerun stays green                                        |
| Publication          | PR #465 is merged. Current source identity remains `0.131.0`; this follow-up does not assign or downgrade a version.                                                                                                                                                                       | The release owner assigns the next version only after the follow-up PR is reviewed, then freezes and verifies the immutable public/offline artifacts. | 2–4 publisher hours after review                                                      |

## Blockers and concerns

- PR #564 is intentionally draft with the `release-train-hold` label. The repository gate rejected
  promotion because v0.132.0–v0.138.0 are already reserved and this product change has no immutable
  slot. Rebase onto the last accepted predecessor and repeat the gates when the queue assigns one.
- Docker and PostgreSQL clients are unavailable on this host. Exact fake-client and service tests
  cover the code paths, while live replica locking and database/blob restore still need deployment
  infrastructure.
- The community API is not deployed here. Hosting, TLS/domain/secrets, trusted-proxy limits, shared
  object storage, mail gateway, monitoring, isolated media processing, and off-host backups remain
  operator work.
- The user selected the built-in browser when Safari computer control was unavailable. Firefox,
  Safari, and physical mobile behavior remain unqualified.
- Audio-bearing physical conversion remains disabled until decoded output audio timestamps and
  synchronization can be independently verified.
- The remaining Team assembly UI should use the existing strict package API. It must normalize each
  selected picture to 1152 × 576, show exact per-level image/video bindings before approval, and
  export only the reviewed dependency closure.
- The combined feature is broad. Immutable edition identities, replay verification, bounded inputs,
  and exact media hashes limit data-integrity risk, but review load remains material.

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
