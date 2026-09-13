# v0.28.0 — verified source and frozen release

v0.28.0 is frozen from **`f79f3c56b0a3cd88ca4e98b7f31689398523da74`**. All six exact-source gates pass, including **2,311/2,311 tests**. This completes the source and artifact verification boundary; public delivery is tracked separately below.

The release adds a compact pause dock, eight-topic Field Guide with isolated practice, Standard/Large text, actionable optional-chapter download failures and a direct Picture collection main-menu action. Scores & saves remains a separate entry. The [implementation evidence](v028-candidate.md) retains the focused checks and corrected findings; [development guidance](../../development.md) describes the runtime contracts.

## Artifact evidence

| Check                   | Verified result                               |
| ----------------------- | --------------------------------------------- |
| Exact committed source  | Six gates pass; 2,311 tests                   |
| Independent rebuild     | 209 files match                               |
| Manifest                | 205 entries verified                          |
| ZIP                     | 206 entries verified                          |
| Offline inventory       | 201 files / 56,469,824 bytes verified         |
| Historical preservation | 32 prior releases and 33 prior tags unchanged |

The immutable [release record](../../../releases/v0.28.0/release.json) records:

- Source TAR SHA-256: `fa7a153bb6d66365c3b24ee52da24afe1c4a29c78af41ce0a359748251459b5c`
- Distribution ZIP SHA-256: `3bcebe6865c4f3569405691c9d2e7a1c6d3465ebbbd4c5fe84d06093b7fe8464`
- Manifest SHA-256: `f2fdf62baae62647f550cb3c058ca7edbf99b487aef00d2e11ff98dc9b6c84d5`

The frozen local browser on isolated port 8883 passed R3 Start → Down → Escape and explicit Resume → Escape. Earlier source-browser journeys exercised Large text, guide Observe → actual loss → Return, and opening Picture collection from the title using Enter. These are recorded browser actions and viewport observations, not physical-device certification. The frozen v0.28 browser then prepared all 201 offline files, reloaded with its server stopped, and verified/restored its saved Orchard Window flight. This verifies offline game restoration, not a new soundtrack round trip.

## Archive and public delivery

The canonical archive public audit passes **3,888/3,888 exact files**, including the hidden metadata omitted by earlier upload attempts. Those failed attempts remain historical evidence. Local old-scope migration and an actual saved-profile journey at the public canonical URL also pass. Projected main Pages output is **205,661,769 bytes**, within the unchanged 950 MB main budget; archives retain an 800 MB budget. Frozen sources, original canonical workers, ZIPs and tags remain unchanged.

At this documentation handoff, [PR #3](https://github.com/mekhovov/revealline/pull/3) is under CI review and actual main-site routing cutover is pending. GitHub Release assets and verification attachments are uploaded with `latest=false`. Final merge, Pages deployment, main routing and public-byte checks belong in the [v0.28 GitHub Release delivery record](https://github.com/mekhovov/revealline/releases/tag/v0.28.0) after completion. This report does not claim that v0.28 is already deployed or marked latest.

## Remaining work

1. Close P3's real browser `.rlsound` download → fresh-origin reimport/save → offline playback and exact-byte round trip, including ordered/shuffled mixed playlists. Existing actual MP3 import/transition and v0.24 offline playback remain valid; backup preparation alone is insufficient.
2. Author P4 Tactical demonstrations, then qualify P5 shared-storage migration and image/video/poster/GIF authoring. The prepared manager remains explicit opt-in.
3. Complete P6 campaign/art/audio production and the ongoing human chapter quality checkpoint, then P7 physical input, performance, support-matrix and public-product qualification. P8 native distribution and P9 online races remain separate.

The planned 116 pictures, 12 stories and 24 finished tracks are not complete. Procedural guide previews, three reused FPV pictures and coded-silence transport fixtures are not substitutes. Fun, replay appeal and physical phone/controller behavior require their own observations.

Dependabot alert #1 concerns moderate `uuid` 7.0.3 in isolated iOS development tooling through Capacitor CLI → `xcode`. No affected browser/Pages path was found. Remediate and test that tooling before P8 native qualification; it does not expand this browser release's scope.
