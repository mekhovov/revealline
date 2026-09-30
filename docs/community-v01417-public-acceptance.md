# v0.141.7 community campaigns scoped public acceptance

Status recorded 28 September 2026. This scoped post-release record updates delivery status without
changing the immutable v0.141.7 game, package, or authoring guide. The canonical implementation
plan remains in [`authoring/community/delivery-plan.md`](../authoring/community/delivery-plan.md).
Its pending status update is in PR #745, which the release coordinator has queued behind the
aggregate PR #746.

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

The retained browser receipt
[`browser-checkpoint.json`](verification/public-v01417/browser-checkpoint.json) records the
observation at `2026-09-28T01:08:36Z` in Codex in-app browser `2`, tab `4`. The public root reached
the immutable v0.141.7 route and showed Solo with 91 Journey missions plus visible Versus and Team
entries. The mission library independently rendered 91 Solo, 91 Versus, and 12 Team cards for the
current Journey collection. Enemy Workshop loaded its tracked-tank preview, all seven role options,
and all four presentation options. Release History showed v0.141.7 as current and retained the
expected older release links.

The same receipt records the exact boundary of this browser session. Solo, Versus, Team, and
Company each reached their package-selection or preparation UI, then returned without downloading a
package or entering gameplay. The Solo selection displayed up to 63.5 MiB and remained explicitly
unapproved at the checkpoint. No persistent save, offline-ready state, disconnected reload,
movement, completion, physical input, or audio claim is derived from that session. Later UI
activity without an immutable tool receipt is excluded from this acceptance record.

Separate repository acceptance records retain single and batch generation, enemy/obstacle
variants, ordinary legal Custom completion, earned picture reload, image/video victory stories,
Skip/Replay, exact package recovery, Versus results/Next, Team packages, and exact-edition
offload/reinstall. Those broader owner records are not reclassified as observations from this
scoped browser session. The user directed use of the built-in browser after Safari computer
control was unavailable. Firefox, Safari, physical mobile, physical controller, and
physical-speaker behavior remain untested rather than inferred.

## Completed and remaining work

| Workstream    | Completed result                                                                                                                                                                                                                                                                                                                                                                  | Remaining acceptance                                                                                                                                                                            | Focused ETA                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Phases 0–3    | Guides, six template families and twelve variants, image and mixed-video campaigns, `.rlpack`, installed Custom progression, source recovery, batch controls, and bounded media are released under their existing acceptance records. The retained v0.141.7 browser receipt confirms the public entry, mission counts, package selectors, and Enemy Workshop surface.             | A separately authorized package download, gameplay run, disconnected reload, and physical-speaker confirmation remain outside this scoped receipt.                                              | Released; 0.25–0.5 day for the bounded browser follow-up          |
| Phases 4–5    | Accounts, resumable uploads, isolated validation, publication, catalog, exact immutable install/update/offline behavior, moderation, recovery, deployment runners, and disk/S3 selection are implemented. PR #723 is already included in aggregate PR #746; PRs #736 and #745 add mail-backed account bootstrap and browser moderation handoff and are queued coordinator inputs. | Promote the coordinator-owned aggregate once its queued inputs and final checks are complete, then run TLS/proxy/mail, browser moderation, and filesystem restore/cutover on the selected host. | 0.25–0.5 day after a release slot; 0.5–1 day after infrastructure |
| Phase 6       | All generated variants have equal-board Versus replay evidence. Installed progress, pictures, reload, results, and Next passed.                                                                                                                                                                                                                                                   | None in the released local/browser scope.                                                                                                                                                       | Complete                                                          |
| Phase 7       | Purpose-built Team templates, qualified launch, immutable editions, recovery, rewards, picture/video packages, review/install, and shared media accounting are released.                                                                                                                                                                                                          | None in the released local/browser scope.                                                                                                                                                       | Complete                                                          |
| Phase 8       | Bounded MP4/WebM and AVC+AAC trim/conversion, resize/compression, orientation, timing, and decoded-audio checks are released.                                                                                                                                                                                                                                                     | Qualify Firefox, Safari, broader codecs, physical mobile playback, and physical speakers.                                                                                                       | 1–2 days when those environments are available                    |
| AWS expansion | Immutable S3 publication, tus S3 storage, bounded multipart work, readiness, cleanup, and portable recovery passed hosted MinIO acceptance.                                                                                                                                                                                                                                       | Run the credentialed AWS smoke gate with a private bucket and scoped IAM actors.                                                                                                                | 0.5–1 day after AWS access is available                           |

The software release queue is the immediate dependency. The coordinator owns aggregate PR #746,
which already includes PR #723 and has PRs #736 and #745 queued as follow-up inputs. Completing
that single candidate, then qualifying, freezing, publishing, and accepting one patch release is
the shortest safe release path. Production-host and AWS checks remain independently gated by their
environments.

## Concerns retained

- Replay proves feasibility for the exact compiled identity, difficulty, and seed. It does not
  prove universal solvability or enjoyable balance.
- The v0.141.7 release contains a large source tar. The local implementation host had about 1 GiB
  free during this acceptance, so the immutable CI receipts were used instead of downloading large
  assets locally. Their release digests and full public reread still bind the accepted bytes.
- The retained browser receipt used an existing browser profile. It does not establish a clean
  profile, a package download, gameplay, persistence, or disconnected-network behavior.
- The upstream MinIO repository is archived. The deterministic acceptance harness builds a pinned
  official source commit, which requires deliberate maintenance if the S3 test environment changes.
- Broad media inputs continue to fail closed outside the released and verified codec boundary.
