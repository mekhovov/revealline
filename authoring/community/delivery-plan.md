# Media campaign delivery register

Approved 24 September 2026. Browser-first, local and account-free creation; images are reveal rewards; Solo first; portable files before a free self-hosted community store. This register implements the approved sequence and does not supersede another task's release ownership.

| Phase | Deliverable                                                                                   | Acceptance gate                                                                                                 | Status                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Beginner guide, framework reference, maintainer handoff, owned examples                       | Reproduce current preview/install/share distinction                                                             | Released and accepted                                                                                                                                                                                     |
| 1     | Single image, six verified layout families, review/approval, `.rlpack`, installed Custom play | Actual download installs in clean profile; ordinary legal win, earned picture after reload, unfinished recovery | Released in `v0.141.0`; ordinary installed play and recovery accepted in the built-in browser                                                                                                             |
| 2     | Batch images, ordering/pacing, groups, checkpoints and bulk approval                          | 1/12/50 items, duplicates, portraits, per-item failure, cancellation, bounded memory and capacity splitting     | Released in `v0.141.0`; the bounded batch, recovery, ordering and split cases are accepted                                                                                                                |
| 3     | Mixed media, pairing, three posters, frame capture, playback range and victory story          | Paired and video-only wins, audio, Skip/Replay, unsupported codecs, exact poster and portable recovery          | Released in `v0.141.0`; image, video and exact portable-recovery paths are accepted in the built-in browser                                                                                               |
| 4     | Self-hosted accounts, resumable uploads, validation jobs, automatic publication and catalog   | Ownership, corrupt upload rejection, restarts, listing and database/blob restore                                | Service source released in `v0.141.0`; deployment preflight, exact tus fault recovery and source-to-target restore rehearsal tooling released in `v0.141.2`; live execution remains environment-dependent |
| 5     | Integrated store, discovery, publish/install/update/offline and removal                       | Two-user full journey, exact immutable saves/rewards across updates and offloading                              | Static client and exact-edition offload/reinstall released; the bounded two-user deployment runner and moderation console released in `v0.141.2`; their live run awaits the community environment         |
| 6     | Versus qualification                                                                          | Both boards, equal conditions, results, Retry/Next and transfer                                                 | Released and accepted in the built-in browser with exact installed editions, progress, pictures, reload and results-screen Next                                                                           |
| 7     | Purposeful Team templates                                                                     | Both players contribute; failure/retry and every advertised preset/path                                         | Released; exact attempts/rewards, picture/video packages, browser assembly/review/install and shared managed-media accounting are accepted                                                                |
| 8     | Optional physical trimming, resizing, compression and conversion                              | Inspect actual exported/decoded bytes, timing, orientation, sound sync and playback                             | Released for the bounded formats; Firefox, Safari, broader codecs, physical speakers and physical mobile remain environment-dependent acceptance follow-ups                                               |

The implementation phases retain separate documentation and acceptance records. The complete local creator stack is published as one feature in `v0.141.0`; only the environment-dependent acceptance listed below remains open.

## Current status and remaining effort — 27 September 2026

PR #564 merged the complete creator hardening at source
`5d6c97c850a648c5ebe93d3cf57731aeb67d0bbb`. Release `v0.141.0` is published from that exact
source. The community hardening then merged through PR #675 as exact source
`12978e5fd3fe0ce70bbee96aa543f569f64622d4`. The cumulative community S3 storage and recovery
release is [`v0.141.5`](https://github.com/mekhovov/revealline/releases/tag/v0.141.5), published from
exact source `edd5fa39ae3f0bdf7bc6fa156c461925df794577`. PRs #693, #694, #695, #696 and #697 are merged.
The hosted MinIO recovery run passed against the exact PR #695 head; release qualification, freeze,
asset inspection and publication then passed against the final source after the publisher snapshot
ownership correction in PR #697. Public Pages now serves accepted `v0.141.5`. The successor
[`v0.141.6`](https://github.com/mekhovov/revealline/releases/tag/v0.141.6) is published from exact
source `d3b48436318c9d056678089b219e47534b554897`; its format-v2 source-manifest canary replaced the
large source tar while preserving nine independently hashed release assets. Archive99 now preserves v0.141.5. Selector PR #703 merged as
`b7857fff816434f950a9c895ef4de00bd7a9895e`, and production run `36272082479` accepted v0.141.6
after matching all 1,730 public files and 629,207,913 bytes with zero retries or failures. The
built-in-browser Home, mission library, Creator, and exact video inspect/poster-capture journey
passed with empty browser warning/error logs.
Estimates below are focused engineering time after each required environment becomes available,
not calendar release dates.
PR #680 merged as `218e76281e3bfa26f57b7aa0f7b98058f4bd05ad`. It confines the validation
worker to read-only package and image filesystems, bounded temporary storage and process resources,
an internal database network, and local-only bounded ffprobe inspection. Source assertions cover
that contract. Preparation PR #709 adds a hosted Linux Compose acceptance. Run `36275412435`
passed against exact pre-ledger source `122f36c901b13ef47fd94c6688ebb99bb567aa02`: production-shaped
migrations and readiness, PostgreSQL, filesystem blob/tus storage, the hardened worker, a 17-byte
interrupted tus resume, retained-volume container recreation, exact publication/download, two-user
ownership, install/legal completion/reload, moderation and offline replay all passed. The run found
and fixed the previously unexercised migration command, image layout and PostgreSQL advisory-lock
boundaries. Its two redacted receipts are retained as the
`community-hosted-acceptance-receipts` artifact.

| Workstream           | Completed/current result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Remaining work                                                                                                                                                  | Focused ETA                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Phases 0–3           | The guide, single-image and batch generation, mixed video campaigns, `.rlpack`, installed Solo Custom progression, exact source recovery and batch controls are published in `v0.141.0` and retained by `v0.141.2`. Built-in-browser image/video, victory-story, package, install, legal-win, saved-attempt, reload and exact-reward evidence passed.                                                                                                                                                                                                                                                                                     | Physical-speaker confirmation is grouped with the device matrix below. Missing-original recovery is accepted at deterministic byte-store scope.                 | Local implementation and built-in-browser acceptance complete |
| Phases 4–5           | Community account, upload, validation, publication, catalog and immutable install/update/offline source paths are released and covered by the combined runtime/service suites. Exact-edition offload/reinstall passed in the built-in browser. `v0.141.2` includes the administrator report-triage page, deployment runner, recovery rehearsal and interrupted-tus fault proxy. `v0.141.5` adds bounded disk/S3 listing, exact target-bound recovery and hosted MinIO acceptance. PR #709's hosted run passes PostgreSQL, filesystem tus/blob storage, interrupted upload, restart persistence, two-user publication/play and moderation. | Deploy the selected target; pass real TLS/proxy addressing, mail-backed Better Auth sessions, administrator browser moderation, and filesystem restore/cutover. | 0.5–1 day after infrastructure is available                   |
| Phase 6 Versus       | All twelve generated variants have equal-board replay evidence. Exact installed editions, progress, pictures, reload and visible results-screen Next passed in the real two-board host and built-in browser.                                                                                                                                                                                                                                                                                                                                                                                                                              | None in the released local/browser scope.                                                                                                                       | Complete                                                      |
| Community hardening  | PostgreSQL-backed admission, tus locks and leases, isolated validation, exact blob checks, account mail flows, moderation APIs, backup and restore are released. `v0.141.2` adds a bounded administrator queue, explicit preview, resolve and unlist workflow, fail-closed deployment preflight, source-to-target restore rehearsal, and deployed two-user runner. PR #709 passes these service paths in a production-shaped hosted Linux Compose run with disposable API actors.                                                                                                                                                         | Run real TLS/proxy, mail delivery, Better Auth actor sessions and filesystem backup/restore on the selected host.                                               | 0.5–1 day after infrastructure is available                   |
| S3/AWS expansion     | The executable storage selector provides stream-verified immutable S3 package publication, the pinned maintained tus S3 datastore, bounded multipart work, deterministic completed-upload cleanup, fail-closed object/multipart readiness, portable package backup/restore and explicit disaster tus expiry. Hosted MinIO publication/recovery passed against exact PR #695 source. PostgreSQL coordinates tus locks, expiry leases and publication state independently of storage.                                                                                                                                                       | Run the credentialed AWS smoke gate with a private bucket and scoped IAM actors.                                                                                | 0.5–1 focused day after AWS access                            |
| Phase 7 Team         | Purpose-built templates, replay-qualified launch, immutable editions, recovery, rewards, picture/video packages, browser assembly/review/install and shared managed-media accounting are published. The public Team route loads cleanly in the built-in browser.                                                                                                                                                                                                                                                                                                                                                                          | None in the released local/browser scope.                                                                                                                       | Complete                                                      |
| Phase 8 media editor | Bounded silent MP4/WebM and AVC+AAC MP4 trim/conversion, resize/compression, orientation, timing and decoded-audio verification are published.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Qualify Firefox, Safari, broader codecs, physical mobile playback and physical speakers.                                                                        | 1–2 days when the environments are available                  |
| Publication          | Stable `v0.141.6` is published from exact source `d3b48436318c…`; its annotated tag peels to that source and all nine release assets carry SHA-256 digests. Archive99 preservation, the reviewed selector, production deployment, exact 1,730-file / 629,207,913-byte public audit, and built-in-browser flow passed.                                                                                                                                                                                                                                                                                                                     | None for the v0.141.6 release and public Pages scope.                                                                                                           | Complete                                                      |

The published `v0.141.2` community hardening release includes a production-safe Compose overlay,
executable deployment preflight, administrator moderation console, exact interrupted-tus fault
proxy, source-to-target database/blob recovery rehearsal, and a bounded deployed two-user journey.
The cumulative community suite passes 105/105 checks on PR #709. The deployment runner proves exact
publication/download, owner
isolation, install, legal completion persistence, installed picture-asset binding, report/unlist,
and offline replay without exposing credentials. These commands are ready; their live execution is
tracked in [deployment-acceptance.md](deployment-acceptance.md).

## Remaining environment-dependent acceptance and concerns

- The released local creator, package, installed gameplay, Team, Versus and bounded media paths have
  no remaining PR, release or Pages gate.
- The community API still needs a selected deployment environment. PR #709's hosted Linux run now
  proves the production-shaped PostgreSQL, migrations, preflight, filesystem package/tus volumes,
  hardened worker, interrupted upload, restart persistence and complete disposable-actor journey.
  The supported initial Phase 4/5 target remains one host. Real proxy/TLS addressing, mail delivery,
  Better Auth creator/administrator sessions, filesystem restore/cutover and browser UI acceptance
  require 0.5–1 day once that infrastructure and three short-lived actor credential sets are
  available.
- S3 is a separate post-deployment workstream for multi-host or AWS operation; it does not block the
  initial single-host launch. The runtime/configuration slice is implemented: package bytes are
  staged and verified before immutable publication, the maintained tus S3 datastore has bounded
  multipart work and deterministic completed-upload cleanup, readiness proves object plus
  multipart operations, and disaster recovery streams and re-verifies exact completed packages.
  Normal restarts preserve resumable uploads; portable disaster restore explicitly expires
  provider-bound multipart sessions and records their count. The path-filtered hosted MinIO job
  passed. The real AWS smoke run remains 0.5–1 day after a private bucket and scoped IAM credentials
  are available. The upstream official MinIO repository is archived, so the deterministic harness
  builds its pinned official source commit; that pin needs deliberate maintenance if the S3 test
  environment changes.
- Firefox, Safari, physical mobile playback, physical-speaker confirmation and broader-codec
  qualification require 1–2 days once those environments and devices are available. Current broad
  media inputs continue to fail closed outside the released, verified format boundary.
- Deterministic tests cover quota rollback, missing originals, exact-package recovery and removal of
  phantom reservations. Genuine browser-wide quota exhaustion, deliberate IndexedDB corruption and
  measured peak-memory acceptance remain unclaimed because supported browser controls cannot force
  those conditions reliably.
- `v0.141.6` is the highest published stable version and the accepted public Pages edition. Its
  exact acceptance record is [`docs/community-v01416-public-acceptance.md`](../../docs/community-v01416-public-acceptance.md).
  Earlier global working allocations are stale. Future work must be reallocated after checking the open
  `v0.142.0` through `v0.149.x` ranges rather than advancing an old queue mechanically.
- PR #700 moved the active workflow action runtime to Node 24. Historical runs retain their earlier
  Node 20 notices; no active release gate is blocked by them.
- The v0.141.5 source receipt records `qualified-with-test-waiver`: all five non-test release gates
  passed and the scoped community suite passed 103/103 locally, while the repository-wide suites
  remain explicitly waived by the committed fast-release policy rather than being claimed as run.

## Contracts to preserve

- Choose media → Generate → Review → Approve and install / Download pack. One image or video becomes a mission; unique normalized stem pairs become one mission. Ambiguity requires correction. Hashes, not names, identify assets. Natural ordering remains editable; failed items require explicit exclusion.
- Versioned bounded template variants and successful legal recordings. Replay the actual compiled identity, difficulty and runtime seed. Gameplay edits invalidate evidence; artwork-only edits retain unchanged simulation evidence but need review. Store explicit generated source, template version, variant, seed and policy.
- `prepareCreatorBundle`, `exportCreatorBundle`, `installPreparedCreatorBundle`; immutable reviewed preparation, cancellation and stale-state protection. Uncompressed bounded manifest plus binary `.rlpack`, format `revealline-content-bundle.v1`, SHA-256 inventory and exact dependency closure.
- Share editable gameplay and required runtime media only. Separate **Back up source project** for retained originals/editor data. No unrelated media or player data in either content workflow. A verified resolver serves strict logical PNG paths; reviewed derivatives preserve renderer/compiler contracts.
- Real installed Custom progression and immutable editions. Journal cross-domain installation; stage before indexing; preserve old attempts and earned art. Retain current budgets, show staging requirements and offer explicit split/remove choices.
- Native intake, sequential full-size image preparation, orientation and bounded decoding. Reuse IndexedDB and managed-media accounting. Video-only candidates at 10/50/90%, midpoint default, with requested and observed times distinct.
- Playback range retains complete video. Physical trim creates different bytes and requires verification. Win awards the poster first; optional Play/Skip/Replay never blocks Next or awards progress.
- Self-hosted Node ES modules, Fastify, Better Auth, PostgreSQL jobs, isolated validation worker,
  and filesystem-backed blobs and tus for the supported initial single-host deployment. S3 remains
  a separately gated multi-host/AWS expansion. Docker Compose release before a separately chosen
  production host. Same-origin deployment; explicit auth for static clients without
  third-party-cookie dependence.
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
