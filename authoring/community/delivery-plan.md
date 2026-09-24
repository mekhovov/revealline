# Media campaign delivery register

Approved 24 September 2026. Browser-first, local and account-free creation; images are reveal rewards; Solo first; portable files before a free self-hosted community store. This register implements the approved sequence and does not supersede another task's release ownership.

| Phase | Deliverable                                                                                   | Acceptance gate                                                                                                 | Status       |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------ |
| 0     | Beginner guide, framework reference, maintainer handoff, owned examples                       | Reproduce current preview/install/share distinction                                                             | PR #384 merged; release pending |
| 1     | Single image, one proven template, review/approval, `.rlpack`, installed modern Custom source | Actual download installs in clean profile; ordinary legal win, earned picture after reload, unfinished recovery | Draft PR #388; built-in browser verified; hosted/release gates pending |
| 2     | Batch images, six template families, ordering/pacing, groups, checkpoints and bulk approval   | 1/12/50 items, duplicates, portraits, per-item failure, cancellation, bounded memory and capacity splitting     | Pending      |
| 3     | Mixed media, pairing, three posters, frame capture, playback range and victory story          | Paired and video-only wins, audio, Skip/Replay, unsupported codecs, exact poster and portable recovery          | Pending      |
| 4     | Self-hosted accounts, resumable uploads, validation jobs, automatic publication and catalog   | Ownership, corrupt upload rejection, restarts, listing and database/blob restore                                | Pending      |
| 5     | Integrated store, discovery, publish/install/update/offline and removal                       | Two-user full journey, exact immutable saves/rewards across updates and offloading                              | Pending      |
| 6     | Versus qualification                                                                          | Both boards, equal conditions, results, Retry/Next and transfer                                                 | Pending      |
| 7     | Purposeful Team templates                                                                     | Both players contribute; failure/retry and every advertised preset/path                                         | Pending      |
| 8     | Optional physical trimming, resizing, compression and conversion                              | Inspect actual exported/decoded bytes, timing, orientation, sound sync and playback                             | Pending      |

Each numbered phase gets a separate scoped PR, release, documentation and acceptance record. Dependent phases remain unaccepted until prerequisites pass. Independent preparation may continue during publication waits. Phase 8 may follow Phase 3 if real imports demonstrate a conversion obstacle.

See the [Phase 1 walkthrough](image-campaign-guide.md), [portable/source format reference](creator-bundle-reference.md), and [exact acceptance observations and open gates](phase1-acceptance.md). Phase 1 currently supports one verified template family and one mission; batches, video, hosted publication and multiplayer are not advertised by the candidate.

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
