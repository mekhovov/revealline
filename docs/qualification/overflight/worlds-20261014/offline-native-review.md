# Packaged native offline review

Runtime source: `a539ccde4`; built source: `dece9da68` (test-only follow-up). Numeric edition `0.151.1`. [Build receipt](distribution-dece9da68.json). The framework prepared 3,295 files / 1,037,366,168 content bytes; the archive is 1,038,414,338 bytes. Independent SHA-256 readback matches `406d56bcdcbc69906c7f67b08e4296f168b08269d0f9526c26ed5290450bd3dc`.

The ordinary framework preparation and ZIP encoder were used. A review-only localhost server reads exclusively from the sealed archive, with the framework security headers and no source-tree fallback. This avoids local disk exhaustion and slow individual-file writes on mounted storage. The ZIP remains at `/Volumes/alex/CodexReviewArtifacts/fpv-worlds-20261014/distribution-dece9da68.zip`; it is not committed into the source repository.

The first archive used an unsupported prerelease version suffix. The existing installer rejected it before installation. This was a review-producer configuration error. Its rejection and receipt are retained; no product validation was loosened.

## Fresh installation

A new origin (`http://127.0.0.1:8907`) started without an installed edition. Through the native Downloads UI, the reviewer selected all Overflight operations and Snake, plus the required Solo Starter. The UI estimated 111.0 MiB including shared dependencies, launcher and original artwork. Optional recorded music was not selected; procedural score and game sounds are included.

The UI reported **Selected chapters ready offline**, both gameplay packages **Ready offline**, **0.0 MiB remaining**, and **Offline setup complete**. [Ready screen](offline-packages-ready.jpg).

The archive server was then stopped. An independent direct HTTP request failed with connection-refused/exit7. All following navigations and gameplay therefore used the downloaded files, with no source fallback:

| Operation | Observed gameplay while server stopped | Evidence |
|---|---|---|
| Single Drone | 9 seconds, three cleared, native Pause | [Screenshot](offline-single-drone.jpg) |
| Riy | 22 seconds, 26 cleared, first upgrade and visual card comparisons | [Screenshot](offline-riy-upgrade.jpg) |
| Single Raid | 8 seconds, six cleared, native Pause | [Screenshot](offline-single-raid.jpg) |
| Time Attack | 11 seconds, six cleared, damage-adjusted medal timer | [Screenshot](offline-time-attack.jpg) |
| Contract Marathon | 7 seconds, six cleared, contract1/5 and1600 at risk | [Screenshot](offline-marathon.jpg) |
| Snake | Simulation advanced, wall contact produced the normal result and final-eight-moves replay | [Screenshot](offline-snake.jpg) |

[Structured receipt](offline-native-receipt.json). These are launch/gameplay smoke checks, not full offline completions. Sound was off; this does not establish audible offline mix quality. A fresh origin is not a fresh browser profile or installed OS application.

## Limits

Native upgrade from an older usable cache and interrupted-update recovery remain separate uncompleted evidence. The 66 offline destination/worker checks include automated lifecycle coverage; they do not substitute for that native update exercise. External devices remain skipped at the user’s direction.
