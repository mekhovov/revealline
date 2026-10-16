# v0.141.5 community campaigns public acceptance

Status recorded 26 September 2026. This post-release record updates the delivery status without
changing the immutable v0.141.5 game, package, or shipped authoring guide. The implementation plan
remains in [`authoring/community/delivery-plan.md`](../authoring/community/delivery-plan.md).

## Accepted release and publication

The cumulative media-to-campaign and community feature is released as
[`v0.141.5`](https://github.com/mekhovov/revealline/releases/tag/v0.141.5) from exact source
`edd5fa39ae3f0bdf7bc6fa156c461925df794577`. Its annotated tag peels to that source, and all nine
release assets retain their recorded SHA-256 digests. The hosted MinIO recovery, release
qualification, freeze, artifact inspection, and publication gates passed.

Archive98 preserves v0.141.4. Selector PR #698 merged as
`411bb4a7bcafa434ef4761bac21483be9f7a7d64`. Production Pages run
[`36266806914`](https://github.com/mekhovov/revealline/actions/runs/36266806914) deployed as
`6683375086` and matched all **1,729 files / 629,205,063 bytes** in 1,729 attempts with zero retries
or failures. v0.141.5 is now the accepted Pages edition. Milestone v0.141.5 is closed with no open
items.

## Built-in-browser journey

The public creator was exercised with a repository-owned JPEG through the ordinary file chooser.
Generation produced a verified 72 × 36 Solo level with **one moving enemy and two walls**, showing
that the released image path uses playable generated geometry rather than an empty arena. The
reviewed draft was approved and installed as immutable edition
`23b6812fe6474f6227f7770d2f7d4189c76e78ce3492c9d227a6dad47948bc10`.

The public Custom player opened that edition and started the generated mission. It displayed three
lives and an unfinished-attempt checkpoint saved on the device. Browser warning and error logs were
empty throughout this journey. Earlier scoped acceptance retains image/video reward playback,
legal-win persistence, reload, exact poster recovery, Versus results/Next, Team packages, and
exact-edition offload/reinstall coverage.

The user directed use of the built-in browser after Safari computer control was unavailable.
Firefox, Safari, physical mobile, and physical-speaker behavior are therefore untested rather than
inferred from this journey.

## Completed and remaining work

| Workstream        | Completed result                                                                                                                                                                                                                                                              | Remaining acceptance                                                                                                                                                        | Focused ETA                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Phases 0–3        | Guides, six template families and twelve variants, images, mixed video campaigns, `.rlpack`, installed Custom progression, source recovery, batch controls, and bounded media handling are released. Image and video browser journeys passed.                                 | Physical-speaker confirmation is included in the device matrix below.                                                                                                       | Local implementation and built-in-browser acceptance complete                  |
| Phases 4–5        | Accounts, resumable uploads, isolated validation, automatic publication, catalog, exact immutable install/update/offline behavior, moderation tooling, recovery rehearsal, deployed two-user runner, and disk/S3 storage selection are released and covered by scoped suites. | Run the supplied deployment checks against a selected live PostgreSQL/proxy/mail host, including administrator moderation and the two-user publish/install/offline journey. | 0.5–1 day after infrastructure and short-lived actor credentials are available |
| Phase 6           | All twelve generated variants have equal-board Versus replay evidence. Installed progress, pictures, reload, results, and Next passed in the real host and built-in browser.                                                                                                  | None in the released local/browser scope.                                                                                                                                   | Complete                                                                       |
| Phase 7           | Purpose-built Team templates, replay-qualified launch, immutable editions, attempts/rewards, picture/video packages, browser assembly/review/install, and shared media accounting are released.                                                                               | None in the released local/browser scope.                                                                                                                                   | Complete                                                                       |
| Phase 8           | Bounded silent MP4/WebM and AVC+AAC MP4 trim/conversion, resize/compression, orientation, timing, and decoded-audio verification are released.                                                                                                                                | Qualify Firefox, Safari, broader codecs, physical mobile playback, and physical speakers.                                                                                   | 1–2 days when those environments are available                                 |
| AWS expansion     | Immutable S3 package publication, the tus S3 datastore, bounded multipart work, readiness, cleanup, and portable backup/restore passed hosted MinIO acceptance.                                                                                                               | Run the credentialed AWS smoke gate with a private bucket and scoped IAM actors.                                                                                            | 0.5–1 day after AWS access is available                                        |
| Stress acceptance | Deterministic quota rollback, missing originals, exact-package recovery, and phantom-reservation removal pass.                                                                                                                                                                | Force genuine browser-wide quota exhaustion and deliberate IndexedDB corruption, and measure peak memory for the largest batch.                                             | 0.5–1 day with a controllable stress profile                                   |

There are no remaining PR, release, archive, selector, Pages, or built-in-browser gates for the
cumulative v0.141.5 scope. The remaining rows need external infrastructure, credentials, browser
engines, devices, or controllable failure injection. They do not change the accepted release bytes.

## Concerns retained

- Replay proves feasibility for the exact compiled identity, difficulty, and seed. It does not prove
  universal solvability or enjoyable balance.
- The v0.141.5 source receipt is `qualified-with-test-waiver`: five non-test release gates passed and
  the scoped community suite passed 103/103 locally; repository-wide suites were waived by the
  committed fast-release policy and are not represented as executed.
- Active GitHub workflows pin `actions/checkout` v5, `actions/setup-node` v5,
  `actions/upload-artifact` v6, `actions/download-artifact` v7, `actions/deploy-pages` v5, and
  `actions/github-script` v8 to exact reviewed commits. These releases use the Node 24 action
  runtime. Setup steps disable the new implicit package-manager cache while retaining every
  explicitly configured cache, so the maintenance does not broaden credential or dependency reuse.
  Historical evidence snapshots remain unchanged.
- The upstream MinIO repository is archived. The deterministic acceptance harness builds a pinned
  official source commit, which requires deliberate maintenance if the S3 test environment changes.
- Broad media inputs continue to fail closed outside the released and verified codec boundary.
