# Media campaign delivery register

Approved 24 September 2026. Browser-first, local and account-free creation; images are reveal rewards; Solo first; portable files before a free self-hosted community store. This register implements the approved sequence and does not supersede another task's release ownership.

| Phase | Deliverable                                                                                   | Acceptance gate                                                                                                 | Status                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Beginner guide, framework reference, maintainer handoff, owned examples                       | Reproduce current preview/install/share distinction                                                             | v0.105.0 released and accepted                                                                                                             |
| 1     | Single image, six verified layout families, review/approval, `.rlpack`, installed Custom play | Actual download installs in clean profile; ordinary legal win, earned picture after reload, unfinished recovery | Merged through PR #465                                                                                                                     |
| 2     | Batch images, ordering/pacing, groups, checkpoints and bulk approval                          | 1/12/50 items, duplicates, portraits, per-item failure, cancellation, bounded memory and capacity splitting     | Merged through PR #465                                                                                                                     |
| 3     | Mixed media, pairing, three posters, frame capture, playback range and victory story          | Paired and video-only wins, audio, Skip/Replay, unsupported codecs, exact poster and portable recovery          | Merged through PR #465                                                                                                                     |
| 4     | Self-hosted accounts, resumable uploads, validation jobs, automatic publication and catalog   | Ownership, corrupt upload rejection, restarts, listing and database/blob restore                                | Source implementation merged through PR #465; live PostgreSQL/proxy/mail/blob restore rehearsal remains open                               |
| 5     | Integrated store, discovery, publish/install/update/offline and removal                       | Two-user full journey, exact immutable saves/rewards across updates and offloading                              | Exact-edition offload/reinstall is implemented and covered locally; deployed two-user publish/install/offline journey remains open         |
| 6     | Versus qualification                                                                          | Both boards, equal conditions, results, Retry/Next and transfer                                                 | Implemented and accepted in the built-in browser with exact installed editions, progress, pictures, reload and visible results-screen Next |
| 7     | Purposeful Team templates                                                                     | Both players contribute; failure/retry and every advertised preset/path                                         | Implemented: exact attempts/rewards, picture/video packages, browser assembly/review/install and shared managed-media accounting           |
| 8     | Optional physical trimming, resizing, compression and conversion                              | Inspect actual exported/decoded bytes, timing, orientation, sound sync and playback                             | Hardening verifies silent MP4/WebM and AVC+AAC MP4 conversion, bounded resize/compression, rotated portrait output and decoded audio sync  |

The implementation phases retain separate documentation and acceptance records, while the completed stack is reconciled and released as one creator feature. Dependent behavior remains unaccepted until its recorded prerequisites pass.

## Current status and remaining effort — 26 September 2026

The creator framework from PR #465 is merged. This follow-up branch is rebased onto protected
`main` at `8c2b5ddbf1e145437fc3cddf6a7a9f225502f830` after the accepted `v0.132.3`
selector, the Team artwork timeout adjustment and subsequent documentation updates. It carries
source version `0.141.0` for the assigned release in PR #564. Estimates are focused engineering
time, not calendar release dates.

| Workstream           | Completed/current result                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Remaining work                                                                                                                                                 | Focused ETA                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Phases 0–3           | The guide, image and batch generation, mixed video campaigns, `.rlpack`, and installed Solo Custom progression are merged through PR #465. Current generation uses twelve verified threatened variants with enemies and collision obstacles. Built-in-browser AVC+AAC upload/playback, active-playback reload, a 1–5 second range, exact full-video package retention, separate-origin import and explicit unsupported-codec refusal pass.                                                               | Complete the combined PR/release gates listed below. Physical-speaker audio remains follow-up acceptance; missing-original recovery is accepted at deterministic byte-store scope. | Local implementation complete                                                                  |
| Phases 4–5           | Community account, upload, validation, publication, catalog and immutable install/update/offline source paths are implemented and covered by the combined runtime/service suites. Exact-edition offload retains the immutable manifest, saves and rewards, deletes only unreferenced managed bytes, and reinstalls from a verified retained package without network access. The built-in-browser install → offload → reinstall → playable path passed.                                             | Deploy the service and pass the live PostgreSQL/proxy/mail/blob restore and two-user publish/install/offline gates.                                            | 0.5–1 day after infrastructure is available                                                    |
| Phase 6 Versus       | All twelve generated variants have equal-board replay evidence. Installed exact editions launch in the real two-board host, lock their verified difficulty, award edition-scoped progress/pictures, and support pointer Next. A separate-origin built-in-browser import retained the exact edition, clear and picture after reload; the visible results action advanced both boards to mission two. Async storage failure retains a durable clear receipt or exposes scoped Retry/Export recovery. | Complete combined PR and release gates.                                                                                                                        | Local implementation and built-in-browser acceptance complete                                  |
| Community hardening  | PostgreSQL-backed admission, tus locks and expiry leases, isolated validation, exact blob checks, account email verification/password reset, moderation, backup, and restore are implemented. The rebased service suite passes 43/43.                                                                                                                                                                                                                                                              | Run live multi-process PostgreSQL, proxy interruption, shared blob/S3, mail delivery, and database/blob restore rehearsals on the selected host.               | 0.5–1 day after infrastructure is available                                                    |
| Phase 7 Team         | Purpose-built templates, replay-qualified launch, immutable editions, exact unfinished-attempt recovery, stale-writer rejection, picture rewards, optional victory-video packages, browser assembly/review/install, and shared 256 MiB accounting are implemented. Built-in-browser trials passed with two real PNGs and the six-second MP4 fixture; current `fpv88` and retained `fpv58`–`fpv87` picture authority passes 102/102.                                                                | No local implementation remains. PR and release gates are tracked below.                                                                                       | Complete                                                                                       |
| Phase 8 media editor | Silent MP4/WebM input and single-track AVC+AAC MP4 can be physically trimmed or converted to AVC MP4 with bounded Balanced/Compact resize and compression. Exact duration, dimensions, orientation, codec, hash, bitrate, decoded audio windows, A/V endpoints and visual boundaries are verified. The owned AAC fixture passed a real built-in-browser 1–5 second conversion.                                                                                                                     | Qualify Firefox, Safari, Balanced portrait, broader formats and physical mobile playback.                                                                      | Browser/device acceptance: 1–2 days when environments are available; broader formats: 1–5 days |
| Follow-up review     | The implementation is rebased on current `main`; the exact source passes 530 top-level and 532/532 total creator/runtime tests, 43/43 service checks, validation, lint, formatting, both dependency audits and the 1,303-file build. Focused audio tests pass 34/34 with a real built-in-browser conversion; offload tests pass 15/15 plus 61/61 related checks and a real built-in-browser install/offload/reinstall/play path. The exact head is pushed to PR #564.                              | Complete hosted review and CI on that exact head.                                                                                                              | About 1 focused hour plus CI/reviewer time                                                     |
| Publication          | `v0.132.3` is published and selected. Its Pages deployment and exact public audit passed for 5,256/5,256 paths and 649,828,429 bytes. PR #564 retains the assigned `v0.141.0` target and is rebased after that selector.                                                                                                                                                                                                                                                                           | Complete exact-head review, merge #564, then freeze, publish, select and publicly verify v0.141.0.                                                             | 4–8 publisher hours plus hosted CI                                                             |

## Blockers and concerns

- The `v0.132.3` prerequisite is complete: the release has nine exact assets, selector PR #633
  merged, Pages deployed, and the public byte audit reported zero failures. The creator branch is
  rebased onto the later protected `main` head after that selector.
- PR #564 is allocated `v0.141.0`. Its exact head is pushed and must pass the hosted
  `release-ready` gate; checks from earlier heads are supporting evidence only.
- The rebased navigation failure is resolved locally: the exact four-file CI command passes
  **194/194**. The repair also closes a runtime handoff bug where controller Confirm could remain
  latched after starting play and suppress a later direct touch. Hosted CI still has to verify the
  pushed commit.
- Installed creator Versus now uses the real two-board host and passes launch, legal completion,
  reward, Cleared, difficulty-lock, pointer Next and fresh-host IndexedDB restoration. A built-in
  browser run imported the downloaded pack on a separate origin, restored its exact edition after
  reload, completed the first two-board mission and used the visible results-screen Next action to
  launch the exact second mission. Async picture persistence failure retains receipt or Retry/Export
  recovery. A distinct physical browser profile remains unclaimed.
- Docker and PostgreSQL clients are unavailable on this host. Exact fake-client and service tests
  cover the code paths, while live replica locking and database/blob restore still need deployment
  infrastructure.
- The community API is not deployed here. Hosting, TLS/domain/secrets, trusted-proxy limits, shared
  object storage, mail gateway, monitoring, isolated media processing, and off-host backups remain
  operator work.
- The user selected the built-in browser when Safari computer control was unavailable. Firefox,
  Safari, and physical mobile behavior remain unqualified.
- Audio conversion is intentionally narrow: exactly one AVC video track and one AAC audio track in
  MP4. Other audio/video layouts fail closed until they receive equivalent decoded timing evidence.
- Team storage spans the existing managed-media ledger and the dedicated immutable-edition
  database. Pending/committed claims and inventory reconciliation bound interrupted writes, but a
  real browser quota failure remains unclaimed because quota estimates are only advisory and cannot
  force the next write to fail.
- Missing creator originals and genuine storage exhaustion cannot be induced through supported
  browser controls. Deterministic tests prove per-item missing-original refusal, exact-package
  recovery, atomic rollback and removal of phantom quota reservations; deliberate IndexedDB
  corruption and a forced browser-wide quota failure remain unclaimed.
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
- [Mediabunny conversion](https://mediabunny.dev/guide/converting-media-files#trimming): nondefault start trimming requires transcoding; the converter loads lazily and the bounded AVC+AAC path verifies decoded audio windows and A/V endpoints after conversion.
- [tus Node server](https://github.com/tus/tus-node-server): resumable transport with filesystem and S3 adapters.
- [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): bounded supported content, isolated processing and public-upload controls.

Cross-phase verification includes stale approvals, simultaneous tabs, interrupted commits, quota failure, malformed packages, missing dependencies, old formats, immutable updates, autoplay refusal, background pause and service outages. Browser and physical-device limitations must remain explicit.

## Browser scope update

On 24 September the user directed “use builtin browser instead” when Safari computer control was unavailable. Use the built-in browser for this delivery and explicitly record Firefox/Safari as untested. Independent-origin storage is not a claim of a separate clean browser profile; physical mobile qualification remains separate.
