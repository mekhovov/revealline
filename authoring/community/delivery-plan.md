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

The implementation phases retain separate documentation and acceptance records. The complete local
creator stack was published as one feature in `v0.141.0`; the community hardening and deployment
runners are included in later releases. Only the environment-dependent activation and compatibility
acceptance below remains open.

## Plan review — 30 September 2026

The latest immutable GitHub release is
[`v0.142.3`](https://github.com/mekhovov/revealline/releases/tag/v0.142.3), source
`b5ab06e12542f72e33c45b973ba693a5e1509c1c`. Git ancestry confirms that it contains the creator
hardening from PR #564, the community hardening from PR #675, and the verified production-session
automation from merged PR #723. This advances the release identity recorded by the earlier plan; it
does not replace the exact v0.141.6 creator/public acceptance record.

No additional software phase is required to satisfy the original local workflow: a user can select
images or videos, generate levels with enemies and collision obstacles, review or edit them, approve
and install an immutable campaign, export/import `.rlpack`, resume unfinished play, earn exact
pictures, and use optional victory video. Solo, Versus, Team, batch creation and the bounded media
editor are implemented and accepted in the built-in-browser scope.

The remaining work is activation and compatibility qualification. Estimates are focused work after
the named external dependency is available; they are not calendar promises.

| Priority    | Workstream                              | What is complete                                                                                                                                                                                                                        | Remaining gate and why it is needed                                                                                                                                                                                                                                                                                                                                | Impact if deferred                                                                                                                                | Focused ETA                                                                      |
| ----------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P0          | Production community activation         | Fastify, Better Auth, PostgreSQL jobs, tus, filesystem storage, isolated validation, catalog, moderation, backup/restore tooling and bounded production-session runners are released. Hosted Linux Compose and MinIO rehearsals passed. | Select a host/domain and mail provider; deploy the same-origin stack; configure TLS and trusted proxy settings; create verified creator/admin accounts; run the two-user publish/install/play/report/unlist journey; rehearse filesystem backup and restore on the selected volumes. This is the gate that turns the shipped service into a real public community. | Local creation, files and installed campaigns keep working, but public accounts, upload, automatic publication and moderation remain unavailable. | 0.5–1 day after the host, DNS/TLS, mail and short-lived actor credentials exist. |
| P1          | Operator cutover evidence               | The runner can stop after publishing a disposable edition and emit a release/origin-bound seed receipt; the browser moderation UI and bounded verifier are implemented.                                                                 | Have an administrator inspect the exact preview, unlist/resolve the report, verify public removal, then record the production backup/restore result. This proves the real operator path rather than only service APIs.                                                                                                                                             | The service may run, but production moderation and recovery cannot be claimed as accepted.                                                        | About 0.5 day after P0.                                                          |
| P2          | AWS/S3 qualification                    | The S3 adapter, multipart limits, readiness checks, immutable publication, cleanup and portable recovery are implemented; the MinIO path passed.                                                                                        | Run the credentialed smoke/recovery gate against a private bucket with scoped IAM actors. This qualifies the optional multi-host/AWS storage path.                                                                                                                                                                                                                 | Initial single-host filesystem deployment remains supported; AWS scaling and disaster-recovery claims remain unqualified.                         | 0.5–1 day after a bucket and IAM credentials exist.                              |
| P2          | Browser/device media matrix             | Built-in-browser image/video creation, AVC+AAC playback, poster selection, victory controls and bounded conversion passed. Unsupported formats fail closed.                                                                             | Run Firefox, Safari, physical mobile, physical speakers and the broader codec matrix. These checks determine the honest support statement for each environment.                                                                                                                                                                                                    | The verified browser/codec boundary remains narrower; affected users may receive an unsupported-media error rather than broad compatibility.      | 1–2 days when those browsers and devices are available.                          |
| P3          | Destructive storage and memory evidence | Deterministic tests cover quota rollback, missing originals, exact-package recovery, reservations and interrupted commits.                                                                                                              | Measure genuine browser-wide quota exhaustion, deliberate IndexedDB corruption and peak memory for large batches where the browser permits controlled reproduction.                                                                                                                                                                                                | Recovery logic remains tested, but worst-case device capacity and corruption claims stay unmeasured.                                              | 0.5–1 day in a controllable test environment.                                    |
| Maintenance | Current release train                   | The media workflow is already released. PR #869 updates edition/offline verification after optional-media projection and is scheduled with the v0.150.0 aggregate.                                                                      | Merge qualified maintenance through the existing release coordinator. Treat it as compatibility upkeep rather than a new creator phase.                                                                                                                                                                                                                            | Future edition checks can drift from current optional-media policy even though existing creator releases remain usable.                           | Release-queue dependent.                                                         |

### Recommended execution order

1. **Choose the production target.** Record host, domain, mail delivery, administrator identity,
   filesystem volume layout and backup destination. This is the only missing decision that blocks
   the core community launch.
2. **Run production activation and operator cutover together.** Reuse the released runners and
   publish one acceptance record. Create a corrective patch release only if the real environment
   exposes a source defect.
3. **Decide whether AWS is actually needed.** Keep filesystem storage for the initial one-host
   launch. Qualify S3 when multi-host operation or AWS deployment is an approved requirement.
4. **Run the browser/device matrix in parallel with live-service observation.** Publish support only
   for environments that actually pass.
5. **Collect destructive storage/memory evidence last.** It improves confidence but does not block
   ordinary creation, portable sharing or the initial community deployment.

### Inputs required before P0 can start

- A reachable deployment host and domain with permission to configure DNS and TLS.
- A mail provider or captured-delivery environment for verification and password reset.
- Short-lived creator and administrator test identities.
- The production filesystem volume and backup destination, plus authority to perform one restore
  rehearsal.

Until those inputs exist, more local feature work would add scope without advancing the launch gate.
The recommended action is to keep released creator behavior stable and direct engineering effort to
the production activation above.

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
- `v0.142.3` is the highest published immutable GitHub release at this review. It contains the
  creator and community implementation by Git ancestry. The latest completed creator-specific
  exact public acceptance record remains the v0.141.6
  [`docs/community-v01416-public-acceptance.md`](../../docs/community-v01416-public-acceptance.md)
  record; later release acceptance must not be inferred from ancestry alone. The active v0.150.0
  aggregate is a separate maintenance/release train, not a new media-campaign phase.
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
