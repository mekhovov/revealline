# Twenty-world native render review — 14 October 2026

All twenty exact catalogue packs rendered recognizable, nonblank geometry and materials in the native Codex in-app browser. Each first course was explicitly loaded at Balanced quality in Overview, with motors off and simulation at tick zero. No missing-scene visual failures or console errors were observed. Coaster was additionally inspected in FPV and showed a visible valid spawn.

**This is static rendering acceptance, not finished-world quality acceptance.** Sixteen CC0 discovery layouts remain mostly sparse props on flat square floors. They need separate environment and gameplay work before meeting the richer world standard.

## Identity and method

The review used the unchanged production compiler, runtime and renderer from cloud source `25d086cbd580de5dc5b745ce088af283434df5ae` ([exact package receipt](fpv-home-art-package-20261014.md)). A separate read-only harness on http://127.0.0.1:9020 exposed manual world/course loading, camera and graphics controls. It never armed, advanced simulation, installed a world, saved progress, or registered a worker. Player project stores were not accessed.

All twenty packs were rechecked against their original exact SHA-256 and length: 15,605,575 bytes in total. The complete catalogue index SHA-256 is `1e32c1fc5476d83bf67355efdfdd55959c56170c79420b4ec03d60ada57c31ea`. The DOM reported exact identity, disarmed tick zero, shader preparation and renderer draw outcomes. Those mechanical outcomes did not automatically award visual acceptance; the actual canvas of every world was inspected separately.

The initial harness imported a standalone catalogue UI module absent from the packaged closure. That HTTP 404 was corrected by locally parsing only the SHA-pinned index; no production module changed. It was a harness setup failure, not a world failure.

## Reviewed worlds

| Order | World                 | Revision | Pack SHA-256 prefix |
| ----- | --------------------- | -------- | ------------------- |
| 1     | mountain-reservoir    | r16      | 50ffbb0e5da7        |
| 2     | festival-grounds      | r5       | 87baca276e17        |
| 3     | harbor-docks          | r4       | d5bf4b9bb682        |
| 4     | cc0-castle-court      | r1       | ee6d8ee8ea5d        |
| 5     | cc0-city-plaza        | r1       | 08dd572b3812        |
| 6     | cc0-construction-site | r1       | 8d6f217d626c        |
| 7     | cc0-frontier-camp     | r1       | 4c9b122ccfb6        |
| 8     | cc0-industrial-yard   | r1       | 74fc5afb38af        |
| 9     | cc0-orbital-workshop  | r1       | 916d8da5a1b2        |
| 10    | cc0-pine-clearing     | r1       | 59c448a1226a        |
| 11    | cc0-platform-garden   | r1       | 019d00195bcb        |
| 12    | cc0-race-paddock      | r1       | 33443ec2cb18        |
| 13    | cc0-road-lab          | r1       | 97fe29db8316        |
| 14    | cc0-rock-grotto       | r1       | 8f4809f5f07d        |
| 15    | cc0-ruined-halls      | r1       | 01eb7bd2874b        |
| 16    | cc0-shipyard          | r1       | 5b3f2251ff0f        |
| 17    | cc0-skate-plaza       | r1       | 388c68e57c43        |
| 18    | cc0-village-green     | r1       | 3ca6c466023b        |
| 19    | cc0-woodland-camp     | r1       | a7b0f6d52411        |
| 20    | cc0-coaster-park      | r1       | a0483ee22fab        |

The [machine-readable receipt](fpv-catalogue-render-20261014.json) preserves full pack identities, harness hashes and the byte length/SHA-256 of each native screenshot. Screenshots remain external at `/Volumes/alex/CodexMigrationStaging/fpv-temp/world-review-01.png` through `world-review-20.png`; they are not bundled into the game or this PR.

## Remaining acceptance

This review does not demonstrate flight, collision behavior, mission completion, every authored course, all camera/preset combinations, sustained FPS, physical devices/controllers, quota or eviction recovery, browser process restart, or network-wide offline. It also does not qualify the shipping HUD's responsive layout because the review controls belong to a separate harness. The [earlier storage qualification](fpv-catalogue-storage-20261014.md) remains modeled transaction evidence, and the packaged update/recovery receipts retain their exact candidate scope.

A useful next bounded functional pass is to validate each pack's authored mission launch/reset and mode/view changes against the production runtime, followed by representative native flight through collision geometry. Neither should require modifying the player's saved worlds or destructive quota pressure.
