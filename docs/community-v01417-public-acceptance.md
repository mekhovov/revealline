# v0.141.7 community campaigns public acceptance

Status recorded 28 September 2026. This post-release record updates delivery status without
changing the immutable v0.141.7 game, package, or authoring guide. The canonical implementation
plan remains in [`authoring/community/delivery-plan.md`](../authoring/community/delivery-plan.md);
its pending aggregate status update is included in PR #745.

## Accepted release and publication

The cumulative media-to-campaign and community feature is released as
[`v0.141.7`](https://github.com/mekhovov/revealline/releases/tag/v0.141.7) from exact source
`efbb3882b4edd447c8e9f60ed60c536a956d78f3`. Release metadata binds the 740,167,060-byte
distribution to SHA-256 `ce653828fa11497567fcb39e370b744bd97d0c78ccb9d173fc7fc8edb7fcdacd`
and the 321,057-byte manifest to SHA-256
`76c13bd3027b0e0e3ee443c35a338914c03f7ae1b98fbdf487cfdf8a6206ee5f`.

Selector PR [#720](https://github.com/mekhovov/revealline/pull/720) published the edition through
production Pages run
[`36363707593`](https://github.com/mekhovov/revealline/actions/runs/36363707593). The post-deploy
auditor independently reread all **2,223 files / 757,762,788 bytes** from the public origin in
2,223 attempts with zero retries or failures. Its retained receipt binds controller commit
`6fe52474b5b395a5c416bd388555d488db33f287` to the exact release source above. Deployment
`6700161410`, status `18922458051`, completed successfully and serves
[`https://mekhovov.github.io/revealline/`](https://mekhovov.github.io/revealline/).

## Built-in-browser journey

The public root redirected to the immutable
`/revealline/releases/v0.141.7/site/game/index.html` route. Home loaded ordinary Solo with 91
Journey missions plus visible Versus and Team entries. The mission library loaded **253 Solo
missions**, retained Journey, Classic, and Custom filters, and retained the installed one-mission
generated campaign in this browser profile.

The public Creator loaded picture/video intake, Content Studio, Team creation, Community, and the
installed campaign. Opening that campaign restored its exact unfinished Standard/Immediate attempt,
then Resume entered live play. The observed generated board contained an enemy actor and two
interior obstacle columns; the player accepted a direction, returned to Pause, and reported that
the unfinished attempt was saved. Browser warning and error logs were empty for this scoped flow.

The built-in browser also opened the ordinary Journey mission briefing with its one-enemy Standard
configuration. That route requested the Solo Starter download before play. The approved 63.5 MiB
selection advanced through worker connection and verified storage to the terminal “Solo starter
ready offline” result with zero bytes remaining. After the only test tab closed and reopened the
public root, the ordinary First return mission prepared, entered live play, accepted a direction,
and paused at four seconds. The profile retained a truthful session-only warning from its earlier
save-owner lease, so this run adds no new persistent-Journey-save claim.

Earlier acceptance retains single and batch generation, enemy/obstacle variants, ordinary legal
Custom completion, earned picture reload, image/video victory stories, Skip/Replay, exact package
recovery, Versus results/Next, Team packages, and exact-edition offload/reinstall. The user directed
use of the built-in browser after Safari computer control was unavailable. Firefox, Safari,
physical mobile, physical controller, and physical-speaker behavior remain untested rather than
inferred.

## Completed and remaining work

| Workstream    | Completed result                                                                                                                                                                                                                                                                                                                                                      | Remaining acceptance                                                                                                                                   | Focused ETA                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Phases 0–3    | Guides, six template families and twelve variants, image and mixed-video campaigns, `.rlpack`, installed Custom progression, source recovery, batch controls, and bounded media are released. Exact v0.141.7 Custom resume/play/pause showed an enemy and obstacles; the public Solo Starter reached verified offline-ready state and launched ordinary Journey play. | Physical-speaker confirmation remains in the device matrix.                                                                                            | Complete locally and in the built-in browser                      |
| Phases 4–5    | Accounts, resumable uploads, isolated validation, publication, catalog, exact immutable install/update/offline behavior, moderation, recovery, deployment runners, and disk/S3 selection are implemented. PRs #723, #736, and #745 add verified production sessions, mail-backed account bootstrap, and browser moderation handoff.                                   | Release the stacked implementation as one aggregate, then run TLS/proxy/mail, browser moderation, and filesystem restore/cutover on the selected host. | 0.25–0.5 day after a release slot; 0.5–1 day after infrastructure |
| Phase 6       | All generated variants have equal-board Versus replay evidence. Installed progress, pictures, reload, results, and Next passed.                                                                                                                                                                                                                                       | None in the released local/browser scope.                                                                                                              | Complete                                                          |
| Phase 7       | Purpose-built Team templates, qualified launch, immutable editions, recovery, rewards, picture/video packages, review/install, and shared media accounting are released.                                                                                                                                                                                              | None in the released local/browser scope.                                                                                                              | Complete                                                          |
| Phase 8       | Bounded MP4/WebM and AVC+AAC trim/conversion, resize/compression, orientation, timing, and decoded-audio checks are released.                                                                                                                                                                                                                                         | Qualify Firefox, Safari, broader codecs, physical mobile playback, and physical speakers.                                                              | 1–2 days when those environments are available                    |
| AWS expansion | Immutable S3 publication, tus S3 storage, bounded multipart work, readiness, cleanup, and portable recovery passed hosted MinIO acceptance.                                                                                                                                                                                                                           | Run the credentialed AWS smoke gate with a private bucket and scoped IAM actors.                                                                       | 0.5–1 day after AWS access is available                           |

The software release queue is the immediate dependency. The fastest path is to promote PR #745 as
the aggregate root containing PRs #736 and #723, then qualify, freeze, publish, and accept one patch
release. Production-host and AWS checks remain independently gated by their environments.

## Concerns retained

- Replay proves feasibility for the exact compiled identity, difficulty, and seed. It does not
  prove universal solvability or enjoyable balance.
- The v0.141.7 release contains a large source tar. The local implementation host had about 1 GiB
  free during this acceptance, so the immutable CI receipts were used instead of downloading large
  assets locally. Their release digests and full public reread still bind the accepted bytes.
- The reopened Journey route truthfully reported session-only saving because the browser profile
  retained an earlier game-writer lease. The exact Custom save had already restored in the same
  profile, but no new Journey persistence claim is inferred from this session-only run.
- The upstream MinIO repository is archived. The deterministic acceptance harness builds a pinned
  official source commit, which requires deliberate maintenance if the S3 test environment changes.
- Broad media inputs continue to fail closed outside the released and verified codec boundary.
