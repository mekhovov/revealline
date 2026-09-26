# Media campaign delivery register

Approved 24 September 2026. Browser-first, local and account-free creation; images are reveal rewards; Solo first; portable files before a free self-hosted community store. This register implements the approved sequence and does not supersede another task's release ownership.

| Phase | Deliverable                                                                                   | Acceptance gate                                                                                                 | Status                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Beginner guide, framework reference, maintainer handoff, owned examples                       | Reproduce current preview/install/share distinction                                                             | Released and accepted                                                                                                                                       |
| 1     | Single image, six verified layout families, review/approval, `.rlpack`, installed Custom play | Actual download installs in clean profile; ordinary legal win, earned picture after reload, unfinished recovery | Released in `v0.141.0`; ordinary installed play and recovery accepted in the built-in browser                                                               |
| 2     | Batch images, ordering/pacing, groups, checkpoints and bulk approval                          | 1/12/50 items, duplicates, portraits, per-item failure, cancellation, bounded memory and capacity splitting     | Released in `v0.141.0`; the bounded batch, recovery, ordering and split cases are accepted                                                                  |
| 3     | Mixed media, pairing, three posters, frame capture, playback range and victory story          | Paired and video-only wins, audio, Skip/Replay, unsupported codecs, exact poster and portable recovery          | Released in `v0.141.0`; image, video and exact portable-recovery paths are accepted in the built-in browser                                                 |
| 4     | Self-hosted accounts, resumable uploads, validation jobs, automatic publication and catalog   | Ownership, corrupt upload rejection, restarts, listing and database/blob restore                                | Service source released in `v0.141.0`; live PostgreSQL/proxy/mail/blob infrastructure acceptance remains environment-dependent                              |
| 5     | Integrated store, discovery, publish/install/update/offline and removal                       | Two-user full journey, exact immutable saves/rewards across updates and offloading                              | Static client and exact-edition offload/reinstall released; a deployed two-user publication journey awaits the community service environment                |
| 6     | Versus qualification                                                                          | Both boards, equal conditions, results, Retry/Next and transfer                                                 | Released and accepted in the built-in browser with exact installed editions, progress, pictures, reload and results-screen Next                             |
| 7     | Purposeful Team templates                                                                     | Both players contribute; failure/retry and every advertised preset/path                                         | Released; exact attempts/rewards, picture/video packages, browser assembly/review/install and shared managed-media accounting are accepted                  |
| 8     | Optional physical trimming, resizing, compression and conversion                              | Inspect actual exported/decoded bytes, timing, orientation, sound sync and playback                             | Released for the bounded formats; Firefox, Safari, broader codecs, physical speakers and physical mobile remain environment-dependent acceptance follow-ups |

The implementation phases retain separate documentation and acceptance records. The complete local creator stack is published as one feature in `v0.141.0`; only the environment-dependent acceptance listed below remains open.

## Current status and remaining effort — 26 September 2026

PR #564 merged the complete creator hardening at source
`5d6c97c850a648c5ebe93d3cf57731aeb67d0bbb`. Release `v0.141.0` is published from that exact
source. Archive 94 preserves the replaced `v0.132.5` edition. PR #673 merged the `v0.141.0`
Pages selector at `44a6ce672632a2d30cbf94374b172e213b75063c`; production deployment `6679678040`
from run `36246645007` succeeded. Its public audit covered 1,877 files and 630,364,265 bytes
with zero failures. Built-in-browser checks passed ordinary gameplay plus the Creator and Team
routes without browser errors. Estimates below are focused engineering time after each required
environment becomes available, not calendar release dates.

| Workstream           | Completed/current result                                                                                                                                                                                                                                                                                                                                                             | Remaining work                                                                                                                                  | Focused ETA                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Phases 0–3           | The guide, threatened image and batch generation, mixed video campaigns, `.rlpack`, installed Solo Custom progression, exact source recovery and batch controls are published in `v0.141.0`. Built-in-browser image/video, victory-story, package, install, legal-win, saved-attempt, reload and exact-reward evidence passed.                                                       | Physical-speaker confirmation is grouped with the device matrix below. Missing-original recovery is accepted at deterministic byte-store scope. | Local implementation and built-in-browser acceptance complete |
| Phases 4–5           | Community account, upload, validation, publication, catalog and immutable install/update/offline source paths are released and covered by the combined runtime/service suites. Exact-edition offload/reinstall passed in the built-in browser.                                                                                                                                       | Deploy the service; pass live PostgreSQL/proxy/mail/blob restore and the two-user publish/install/offline journey.                              | 0.5–1 day after infrastructure is available                   |
| Phase 6 Versus       | All twelve generated variants have equal-board replay evidence. Exact installed editions, progress, pictures, reload and visible results-screen Next passed in the real two-board host and built-in browser.                                                                                                                                                                         | None in the released local/browser scope.                                                                                                       | Complete                                                      |
| Community hardening  | PostgreSQL-backed admission, tus locks and leases, isolated validation, exact blob checks, account mail flows, moderation, backup and restore are released. The service suite passes 43/43.                                                                                                                                                                                          | Run live multi-process PostgreSQL, proxy interruption, shared blob/S3, mail delivery, database/blob restore, and the two-user journey.          | 0.5–1 day after infrastructure is available                   |
| Phase 7 Team         | Purpose-built templates, replay-qualified launch, immutable editions, recovery, rewards, picture/video packages, browser assembly/review/install and shared managed-media accounting are published. The public Team route loads cleanly in the built-in browser.                                                                                                                     | None in the released local/browser scope.                                                                                                       | Complete                                                      |
| Phase 8 media editor | Bounded silent MP4/WebM and AVC+AAC MP4 trim/conversion, resize/compression, orientation, timing and decoded-audio verification are published.                                                                                                                                                                                                                                       | Qualify Firefox, Safari, broader codecs, physical mobile playback and physical speakers.                                                        | 1–2 days when the environments are available                  |
| Publication          | PR #564 is merged, `v0.141.0` is published from exact source `5d6c97c…`, Archive 94 preserves `v0.132.5`, and selector PR #673 is merged at `44a6ce…`. Pages deployment `6679678040` / run `36246645007` passed; the public byte audit reported 1,877 files, 630,364,265 bytes and zero failures. Ordinary gameplay, Creator and Team routes loaded cleanly in the built-in browser. | No creator release or Pages publication gate remains.                                                                                           | Complete                                                      |

## Remaining environment-dependent acceptance and concerns

- The released local creator, package, installed gameplay, Team, Versus and bounded media paths have
  no remaining PR, release or Pages gate.
- The community API still needs a selected deployment environment. Live multi-process PostgreSQL,
  proxy interruption, shared blob/S3 storage, mail delivery, database/blob restore, and the complete
  two-user publication journey require 0.5–1 day once that infrastructure is available.
- Firefox, Safari, physical mobile playback, physical-speaker confirmation and broader-codec
  qualification require 1–2 days once those environments and devices are available. Current broad
  media inputs continue to fail closed outside the released, verified format boundary.
- Deterministic tests cover quota rollback, missing originals, exact-package recovery and removal of
  phantom reservations. Genuine browser-wide quota exhaustion, deliberate IndexedDB corruption and
  measured peak-memory acceptance remain unclaimed because supported browser controls cannot force
  those conditions reliably.
- `v0.141.0` is now the highest published stable version. Any still-open `v0.133.0` through
  `v0.140.0` candidate must be renumbered above `v0.141.0` before future publication.

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
