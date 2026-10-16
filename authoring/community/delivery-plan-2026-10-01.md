# Media campaign delivery register

> **Historical snapshot:** this is the proposed delivery-register state reviewed on 1 October 2026. It is preserved without replacing the current live register. Queue, deployment, release, capacity and recommendation statements below are dated evidence, not current instructions.

Approved feature direction: browser-first, local and account-free creation; images are reveal
rewards; portable campaign files before a free self-hosted community store. This register covers
media → generated levels → campaigns → sharing. Whole-game art, music, native-app and FPV projects
have their own plans.

## Review checkpoint — 1 October 2026

Reviewed source: `4b2bdff335a61104bcdfcf2bde4c9a427e21e928`. GitHub still lists
[v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3) as the latest published
non-draft release. Newer merged main code and continuous Pages deployments are separate delivery
states; this review did not exercise today's deployed creator or certify its bytes.

[PR #873](https://github.com/mekhovov/revealline/pull/873) (previous plan refresh) and
[PR #869](https://github.com/mekhovov/revealline/pull/869) (offline verification repair) merged
on 30 September. Neither remains an unimplemented task. The v0.150.0 milestone is a release target,
not a statement that every assigned change is published. Historical test counts in linked records
apply only to their recorded sources. No gameplay tests or browser acceptance were rerun for this
planning change; the repository's automated-suite waiver remains explicit.

The local workflow has released implementation and recorded browser acceptance. Public community
availability is still unaccepted. Calling all phases simply "complete" hides that distinction, and
calling production hosting an unconditional P0 assumes a product priority the user is now reviewing.

## Completed capabilities and remaining phase gates

| Phase                  | What a user gets                                                                                            | Established status                                                                | What remains                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0 — Guides             | Beginner instructions, format reference, examples and maintainer instructions.                              | Released documentation, with ongoing maintenance.                                 | Keep instructions aligned with the current screens.                                                    |
| 1 — One image          | Generate a level, review, approve, install, play, save and export `.rlpack`.                                | Released baseline with ordinary Custom play/recovery evidence.                    | Refresh current-build acceptance in R1; a separate origin is not a clean physical browser profile.     |
| 2 — Batch images       | Order and group missions, change pacing, regenerate, exclude failures, autosave and split large packs.      | Recorded 1/12/50-item and recovery/capacity coverage.                             | Human review of usefulness/variety in R1; measured peak memory in R5.                                  |
| 3 — Videos             | Pair a picture and video, capture a poster, select a playback range and watch Play/Skip/Replay after a win. | Released paired/video-only paths and actual portable-file recovery evidence.      | Broader browser/device/audio acceptance in R4. A playback range still includes the whole source video. |
| 4 — Submission service | Accounts, resumable uploads, validation and automatic publication.                                          | Service source and hosted container rehearsal exist.                              | Selected-host deployment, email and real account acceptance in R2. Public launch is not complete.      |
| 5 — Community store    | Discover, install, update, report and remove downloads while retaining saves/rewards.                       | Client/service implementation and local exact-edition offload/reinstall accepted. | Public two-user journey plus moderation/restore on the chosen host in R2–R3.                           |
| 6 — Versus             | Generated campaign play on equal boards, exact rewards and continuation.                                    | Recorded browser/host qualification for supported variants.                       | Include a representative case in current-release R1; broader devices in R4.                            |
| 7 — Team               | Purposeful cooperative templates, picture/video packages and saved attempts.                                | Released creator/package/runtime scope with recorded browser evidence.            | Current-release R1; separate historical Team import repair is not completed by this baseline.          |
| 8 — Optional editor    | Physical trimming, bounded conversion, resizing/compression and output verification.                        | Supported-format implementation and recorded built-in-browser acceptance.         | Additional codecs and browsers are unqualified; prioritize them through R4.                            |

Generation currently selects among six families and twelve bounded variants with obstacles and a
moving enemy. Replaying a successful route proves feasibility for an exact configuration. It does
not establish that a 50-level campaign feels varied or well balanced, or that arbitrary Studio edits
remain solvable. The empty-board report is addressed in the released generation baseline; no new
regression reproduction is claimed by this review.

## Proposed priorities for user review

These are recommendations, not newly approved deployment, spending or support commitments. The
[detailed review](plan-review-2026-10-01.md) explains each item, its benefit, deferral impact and
completion condition. Estimates are initial hands-on effort, exclude waiting/provisioning/release
queues, and expand if a defect is found.

| ID  | Recommendation                                                              | Next result                                                                                                                                             | Initial effort and dependency                                                                              |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R1  | Do next                                                                     | Recheck today's create → review → share → install → play/reload journey and editor Back/Forward behavior; review a small sample for fun and repetition. | 0.5–1 day for a bounded review on a fixed candidate; fixes estimated separately.                           |
| R2  | Next only if public publishing is the chosen goal                           | A small deployed community pilot with real signup, verification email, resumed upload and a second account installing the result.                       | 0.5–1 day acceptance after host/domain/mail/access exist; setup and operating costs are not yet estimated. |
| R3  | Required before opening that pilot to public submissions                    | Administrator report/unlist workflow and restore rehearsal on an isolated recovery target.                                                              | 0.5–1 day after R2; combine with launch acceptance rather than double-counting the same journey.           |
| R4  | After R1; move ahead of hosting if target players use phones/Safari/Firefox | A truthful support matrix for target browsers, playback, touch, audio and a fresh profile.                                                              | 1–2 days for an agreed small matrix once environments exist; codec implementation fixes separate.          |
| R5  | Targeted early check for heavy imports; full destructive cases later        | Measured memory/storage behavior for large video packs, low-space cancellation and recovery.                                                            | 0.5–1 day investigation on a disposable profile; difficult corruption cases may need more instrumentation. |
| R6  | Defer unless the deployment actually uses S3                                | Real AWS bucket/IAM, interrupted-upload and recovery acceptance for the existing adapter.                                                               | 0.5–1 day after scoped AWS access; not required for a filesystem-backed single-host pilot.                 |
| R7  | Keep in the existing release lane                                           | Qualify and publish the selected integrated batch, maintaining clear main/Pages/tag evidence.                                                           | Coordinator/CI dependent; no defensible calendar ETA at this review.                                       |

Recommended sequence: **R1 → user chooses local-sharing or community focus → R2 + R3 if community
wins**, with R4 scheduled around the intended audience. Run a representative R5 large-video check
alongside R1 if large imports are common. Keep R6 deferred unless the selected host requires it.
A local-sharing-first choice leaves accounts and infrastructure deferred without taking away portable
campaign sharing.

## Dependencies and boundaries

- R2 needs a chosen host/domain, mail delivery and access to configure the service. R3 needs a
  designated operator and an isolated database/blob restore target. Test credentials should be
  supplied through the deployment's secret mechanism, never committed or pasted into plan records.
- Capturing an email in a test harness proves the software flow, not delivery to a real mailbox.
  Both are relevant before claiming production signup and account recovery work.
- R4 follows the user's earlier instruction to use the built-in browser for current work. Safari,
  Firefox, physical phone and speaker acceptance remains pending, not silently waived as supported.
- R1 includes [#826](https://github.com/mekhovov/revealline/issues/826) reconciliation: current source
  now has Discovery/lesson suspension and persisted-page handling. The old issue's "missing suspend"
  description is stale; inspect and exercise the remaining actual Back/Forward journey before
  implementing more code or closing the issue.
- [#868](https://github.com/mekhovov/revealline/pull/868) is a separate held repair for two historical
  Team imports and projectile feedback. Its reported size/fingerprint failures belong to its dated
  candidate; remeasure the integrated candidate rather than treating those numbers as today's main.
- [#865](https://github.com/mekhovov/revealline/issues/865) concerns native app staging capacity. It
  does not by itself block browser campaign creation. If native distribution becomes a priority,
  select a reviewed package scope and verify it without silently dropping assets or raising limits.
- Whole-game deferred verification/preserved overlaps in
  [#813](https://github.com/mekhovov/revealline/issues/813) and
  [#824](https://github.com/mekhovov/revealline/issues/824) are not closed by this creator plan.
- Optional media outside the starter offline cache can still consume full distribution space.
  Keep the 64 MiB core-cache budget, managed-media budget, total Pages payload and native staging
  budgets distinct. A pass for one does not prove the others fit.

## Evidence and execution references

- [Creator guide](creator-guide.md): supported file workflow and generator limits.
- [Combined acceptance](combined-release-acceptance.md): exact release identities and historical
  creator, video, Team, Versus and recovery results. Its evidence is not a fresh current-main run.
- [Deployment acceptance](deployment-acceptance.md): executable account, interrupted upload,
  two-user, browser moderation and isolated restore procedures.
- [Maintainer guide](maintainer-guide.md): service and framework delivery boundaries.
- [Feature delivery policy](../../docs/feature-delivery-workflow.md): coordinator, qualification,
  immutable release and public verification. Subsequent user campaigns require no game release.

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
