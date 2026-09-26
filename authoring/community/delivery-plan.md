# Media campaign delivery register

Approved 24 September 2026. Browser-first, local and account-free creation; images are reveal rewards; Solo first; portable files before a free self-hosted community store. This register implements the approved sequence and does not supersede another task's release ownership.

| Phase | Deliverable                                                                                   | Acceptance gate                                                                                                 | Status                                                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Beginner guide, framework reference, maintainer handoff, owned examples                       | Reproduce current preview/install/share distinction                                                             | Released and accepted                                                                                                                                                                              |
| 1     | Single image, six verified layout families, review/approval, `.rlpack`, installed Custom play | Actual download installs in clean profile; ordinary legal win, earned picture after reload, unfinished recovery | Released in `v0.141.0`; ordinary installed play and recovery accepted in the built-in browser                                                                                                      |
| 2     | Batch images, ordering/pacing, groups, checkpoints and bulk approval                          | 1/12/50 items, duplicates, portraits, per-item failure, cancellation, bounded memory and capacity splitting     | Released in `v0.141.0`; the bounded batch, recovery, ordering and split cases are accepted                                                                                                         |
| 3     | Mixed media, pairing, three posters, frame capture, playback range and victory story          | Paired and video-only wins, audio, Skip/Replay, unsupported codecs, exact poster and portable recovery          | Released in `v0.141.0`; image, video and exact portable-recovery paths are accepted in the built-in browser                                                                                        |
| 4     | Self-hosted accounts, resumable uploads, validation jobs, automatic publication and catalog   | Ownership, corrupt upload rejection, restarts, listing and database/blob restore                                | Service source released in `v0.141.0`; deployment preflight, exact tus fault recovery and source-to-target restore rehearsal tooling released in `v0.141.2`; live execution remains environment-dependent |
| 5     | Integrated store, discovery, publish/install/update/offline and removal                       | Two-user full journey, exact immutable saves/rewards across updates and offloading                              | Static client and exact-edition offload/reinstall released; the bounded two-user deployment runner and moderation console released in `v0.141.2`; their live run awaits the community environment      |
| 6     | Versus qualification                                                                          | Both boards, equal conditions, results, Retry/Next and transfer                                                 | Released and accepted in the built-in browser with exact installed editions, progress, pictures, reload and results-screen Next                                                                    |
| 7     | Purposeful Team templates                                                                     | Both players contribute; failure/retry and every advertised preset/path                                         | Released; exact attempts/rewards, picture/video packages, browser assembly/review/install and shared managed-media accounting are accepted                                                         |
| 8     | Optional physical trimming, resizing, compression and conversion                              | Inspect actual exported/decoded bytes, timing, orientation, sound sync and playback                             | Released for the bounded formats; Firefox, Safari, broader codecs, physical speakers and physical mobile remain environment-dependent acceptance follow-ups                                        |

The implementation phases retain separate documentation and acceptance records. The complete local creator stack is published as one feature in `v0.141.0`; only the environment-dependent acceptance listed below remains open.

## Current status and remaining effort — 26 September 2026

PR #564 merged the complete creator hardening at source
`5d6c97c850a648c5ebe93d3cf57731aeb67d0bbb`. Release `v0.141.0` is published from that exact
source. The community hardening then merged through PR #675 as exact source
`12978e5fd3fe0ce70bbee96aa543f569f64622d4` and is the current stable and Pages release,
[`v0.141.2`](https://github.com/mekhovov/revealline/releases/tag/v0.141.2). Selector PR #677
merged as `34f45503c32479591dcdc36e7236aaa2eb348a2f`; Pages deployment `6680716352` from run
`36252239829` audited 1,888 files and 630,471,797 bytes in 1,888 attempts with zero retries or
failures. `v0.141.1` is an intermediate immutable GitHub release and was never the Pages selector.
Archive 95 preserves `v0.141.0`. See the bounded
[v0.141.2 publication evidence](v0.141.2-publication-evidence.md). Estimates below are focused
engineering time after each required environment becomes available, not calendar release dates.

| Workstream           | Completed/current result                                                                                                                                                                                                                                                                                                                                                                  | Remaining work                                                                                                                                    | Focused ETA                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Phases 0–3           | The guide, single-image and batch generation, mixed video campaigns, `.rlpack`, installed Solo Custom progression, exact source recovery and batch controls are published in `v0.141.0` and retained by `v0.141.2`. Built-in-browser image/video, victory-story, package, install, legal-win, saved-attempt, reload and exact-reward evidence passed.                                         | Physical-speaker confirmation is grouped with the device matrix below. Missing-original recovery is accepted at deterministic byte-store scope.   | Local implementation and built-in-browser acceptance complete |
| Phases 4–5           | Community account, upload, validation, publication, catalog and immutable install/update/offline source paths are released and covered by the combined runtime/service suites. Exact-edition offload/reinstall passed in the built-in browser. `v0.141.2` includes the administrator report-triage page, deployment runner, recovery rehearsal and interrupted-tus fault proxy.           | Deploy the service; pass live PostgreSQL/proxy/mail/blob restore, administrator moderation and the two-user publish/install/offline journey.      | 0.5–1 day after infrastructure is available                   |
| Phase 6 Versus       | All twelve generated variants have equal-board replay evidence. Exact installed editions, progress, pictures, reload and visible results-screen Next passed in the real two-board host and built-in browser.                                                                                                                                                                              | None in the released local/browser scope.                                                                                                         | Complete                                                      |
| Community hardening  | PostgreSQL-backed admission, tus locks and leases, isolated validation, exact blob checks, account mail flows, moderation APIs, backup and restore are released. `v0.141.2` adds a bounded administrator queue, explicit preview, resolve and unlist workflow, fail-closed deployment preflight, source-to-target restore rehearsal, and deployed two-user runner.                    | Run live multi-process PostgreSQL, proxy interruption, shared blob/S3, mail delivery, database/blob restore, moderation and the two-user journey. | 0.5–1 day after infrastructure is available                   |
| Phase 7 Team         | Purpose-built templates, replay-qualified launch, immutable editions, recovery, rewards, picture/video packages, browser assembly/review/install and shared managed-media accounting are published. The public Team route loads cleanly in the built-in browser.                                                                                                                          | None in the released local/browser scope.                                                                                                         | Complete                                                      |
| Phase 8 media editor | Bounded silent MP4/WebM and AVC+AAC MP4 trim/conversion, resize/compression, orientation, timing and decoded-audio verification are published.                                                                                                                                                                                                                                            | Qualify Firefox, Safari, broader codecs, physical mobile playback and physical speakers.                                                          | 1–2 days when the environments are available                  |
| Publication          | PR #675 is merged, stable `v0.141.2` is published from exact source `12978e5f…`, Archive 95 preserves `v0.141.0`, and selector PR #677 is merged at `34f45503…`. Pages deployment `6680716352` / run `36252239829` passed; the audit reported 1,888 files, 630,471,797 bytes, 1,888 attempts, zero retries and zero failures.                                              | No `v0.141.2` release or Pages publication gate remains.                                                                                          | Complete                                                      |

The published `v0.141.2` community hardening release includes a production-safe Compose overlay,
executable deployment preflight, administrator moderation console, exact interrupted-tus fault
proxy, source-to-target database/blob recovery rehearsal, and a bounded deployed two-user journey.
The source suite passes 63/63 checks. The deployment runner proves exact publication/download, owner
isolation, install, legal completion persistence, installed picture-asset binding, report/unlist,
and offline replay without exposing credentials. These commands are ready; their live execution is
tracked in [deployment-acceptance.md](deployment-acceptance.md).

## Remaining environment-dependent acceptance and concerns

- The released local creator, package, installed gameplay, Team, Versus and bounded media paths have
  no remaining PR, release or Pages gate.
- The community API still needs a selected deployment environment. The source now supplies bounded
  commands for preflight, interrupted tus recovery, database/blob restore rehearsal, and the full
  two-user journey. Live multi-process PostgreSQL, proxy/TLS, shared blob or S3 storage, mail
  delivery, real restore, administrator-session moderation and the two-user run require 0.5–1 day
  once that infrastructure and three short-lived actor credential sets are available.
- Firefox, Safari, physical mobile playback, physical-speaker confirmation and broader-codec
  qualification require 1–2 days once those environments and devices are available. Current broad
  media inputs continue to fail closed outside the released, verified format boundary.
- Deterministic tests cover quota rollback, missing originals, exact-package recovery and removal of
  phantom reservations. Genuine browser-wide quota exhaustion, deliberate IndexedDB corruption and
  measured peak-memory acceptance remain unclaimed because supported browser controls cannot force
  those conditions reliably.
- `v0.141.2` is the highest published stable version. Earlier global working allocations are
  stale. Future work must be reallocated after checking the open `v0.142.0` through `v0.149.x`
  ranges rather than advancing an old queue mechanically.

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
