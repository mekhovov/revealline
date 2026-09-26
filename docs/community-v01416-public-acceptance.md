# v0.141.6 community campaigns public acceptance

Status recorded 26 September 2026. This post-release record updates delivery status without
changing the immutable v0.141.6 game, package, or authoring guide. The implementation plan remains
in [`authoring/community/delivery-plan.md`](../authoring/community/delivery-plan.md).

## Accepted release and publication

The cumulative media-to-campaign and community feature is released as
[`v0.141.6`](https://github.com/mekhovov/revealline/releases/tag/v0.141.6) from exact source
`d3b48436318c9d056678089b219e47534b554897`. Its annotated tag peels to that source. The nine
release assets retain their recorded SHA-256 digests, and the format-v2 source manifest replaces
the large source tar while preserving deterministic source recovery.

Archive99 preserves v0.141.5 at
[`revealline-archive-99`](https://mekhovov.github.io/revealline-archive-99/). Its public audit matched
all **1,317 files / 612,092,320 bytes** with zero failures. Selector PR
[#703](https://github.com/mekhovov/revealline/pull/703) merged as
`b7857fff816434f950a9c895ef4de00bd7a9895e`. Production Pages run
[`36272082479`](https://github.com/mekhovov/revealline/actions/runs/36272082479) assembled, deployed,
and independently reread the public site. The audit matched all **1,730 files / 629,207,913 bytes**
in 1,730 attempts with zero retries or failures. Deployment `6684302546`, status `18887199704`,
serves v0.141.6 as the accepted Pages edition.

## Built-in-browser journey

The public root selected v0.141.6 and opened ordinary Solo with 91 Journey missions and visible
Versus and Team entries. The mission library loaded **286 Solo missions**, kept Journey, Classic,
and Custom filters, displayed downloadable campaigns, and retained the previously installed Custom
campaign in this browser profile. The public creator loaded picture/video intake, immutable installed
creations, Team creation, Community, and Content Studio links.

The public video-poster workshop accepted the repository-owned AVC+AAC MP4 fixture through the
ordinary file chooser. It decoded the exact 640 × 360, six-second, 173,394-byte source with SHA-256
`d592415621ae68175f7b1c182e3024ae09f21e2a4b71fc5e92b08ccaa9c8dcc5`. Capturing at the requested
three-second time produced a reviewed 640 × 360 PNG of 32,092 bytes with SHA-256
`3e4c3ef245931f107c8f9b28ec676f9562e1a581bc429eff1028dc5798128c76`; the observed frame and
playhead were both three seconds and decoded-frame stepping became available. The page continued
to state that playback range retains the complete original. Browser warning and error logs were
empty for Home, Missions, Creator, and video inspection/capture.

Earlier scoped acceptance retains generated enemy/obstacle geometry, ordinary Custom completion,
unfinished-attempt recovery, earned picture reload, paired/video-only victory stories, Skip/Replay,
exact package recovery, Versus results/Next, Team packages, and exact-edition offload/reinstall.
The user directed use of the built-in browser after Safari computer control was unavailable.
Firefox, Safari, physical mobile, physical controller, and physical-speaker behavior remain
untested rather than inferred.

## Completed and remaining work

| Workstream        | Completed result                                                                                                                                                                                                                                                              | Remaining acceptance                                                                                                                                                        | Focused ETA                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Phases 0–3        | Guides, six template families and twelve variants, images, mixed video campaigns, `.rlpack`, installed Custom progression, source recovery, batch controls, bounded media, and the public video inspect/capture journey are accepted.                                         | Physical-speaker confirmation is included in the device matrix below.                                                                                                       | Complete for local and built-in-browser scope                                  |
| Phases 4–5        | Accounts, resumable uploads, isolated validation, automatic publication, catalog, exact immutable install/update/offline behavior, moderation tooling, recovery rehearsal, deployed two-user runner, and disk/S3 storage selection are released and covered by scoped suites. | Run the supplied deployment checks against a selected live PostgreSQL/proxy/mail host, including administrator moderation and the two-user publish/install/offline journey. | 0.5–1 day after infrastructure and short-lived actor credentials are available |
| Phase 6           | All twelve generated variants have equal-board Versus replay evidence. Installed progress, pictures, reload, results, and Next passed in the real host and built-in browser.                                                                                                  | None in the released local/browser scope.                                                                                                                                   | Complete                                                                       |
| Phase 7           | Purpose-built Team templates, replay-qualified launch, immutable editions, attempts/rewards, picture/video packages, browser assembly/review/install, and shared media accounting are released.                                                                               | None in the released local/browser scope.                                                                                                                                   | Complete                                                                       |
| Phase 8           | Bounded silent MP4/WebM and AVC+AAC MP4 trim/conversion, resize/compression, orientation, timing, and decoded-audio verification are released. Public AVC+AAC inspection and poster capture passed.                                                                           | Qualify Firefox, Safari, broader codecs, physical mobile playback, and physical speakers.                                                                                   | 1–2 days when those environments are available                                 |
| AWS expansion     | Immutable S3 package publication, tus S3 storage, bounded multipart work, readiness, cleanup, and portable backup/restore passed hosted MinIO acceptance.                                                                                                                     | Run the credentialed AWS smoke gate with a private bucket and scoped IAM actors.                                                                                            | 0.5–1 day after AWS access is available                                        |
| Stress acceptance | Deterministic quota rollback, missing originals, exact-package recovery, and phantom-reservation removal pass.                                                                                                                                                                | Force genuine browser-wide quota exhaustion and deliberate IndexedDB corruption, and measure peak memory for the largest batch.                                             | 0.5–1 day with a controllable stress profile                                   |

There are no remaining PR, release, archive, selector, Pages, or built-in-browser gates for the
cumulative v0.141.6 scope. The remaining rows need external infrastructure, credentials, browser
engines, devices, or controllable failure injection. They do not change the accepted release bytes.

## Concerns retained

- Replay proves feasibility for the exact compiled identity, difficulty, and seed. It does not prove
  universal solvability or enjoyable balance.
- The v0.141.6 source receipt is `qualified-with-test-waiver`. The non-test release gates and scoped
  suites passed; repository-wide suites waived by the committed fast-release policy are not
  represented as executed.
- Active GitHub workflows pin reviewed action revisions. The cache actions still emit an upstream
  Node 20 deprecation notice while GitHub forces them onto Node 24; this is a maintenance warning,
  not a failed release or public-byte gate.
- The upstream MinIO repository is archived. The deterministic acceptance harness builds a pinned
  official source commit, which requires deliberate maintenance if the S3 test environment changes.
- Broad media inputs continue to fail closed outside the released and verified codec boundary.
