# v0.35 delivery

Frozen source `9747b3e86e43d4e66b1c7b4aea6e05b220bf3ad5`, merged as `b2aeadcfb4821e95599a7028850faba573bac589` through [PR #11](https://github.com/mekhovov/revealline/pull/11). [Main run 34772146072](https://github.com/mekhovov/revealline/actions/runs/34772146072) passed; Pages deployment `6424699407` succeeded at 18:05:27 UTC on 2026-09-13. Release `387976494` became public/latest at 18:23:55 UTC.

[Play](https://mekhovov.github.io/revealline/releases/v0.35.0/site/game/) · [Final delivery receipt](https://github.com/mekhovov/revealline/releases/download/v0.35.0/v035-delivery-receipt.json) · [Picture Workshop and Dawn Signal files](https://mekhovov.github.io/revealline/releases/v0.35.0/site/authoring/still-media/).

## Delivered behavior

- Optional owned video stories after a real win and from earned Collection, with Play, Pause, Replay, Skip and return to the exact poster.
- Explicit picture/story original backup files and the usable Dawn Signal example; saved attempts and first-earned pictures retain their original assignment.
- Compatible shared DB4 across the current game, course, practice, music and workshop; session audio ownership remains intact.
- Keyboard access to training Settings, contextual Back to lesson, focused chapter descriptions and larger story controls/captions.

## Acceptance evidence

All six exact-source gates and **3,008/3,008 tests** pass. Independent frozen source reconstruction, complete ZIP membership/CRC and retained historical release/tag checks pass. The complete public site matches **1,765 files / 780,633,089 bytes**, including six hidden files, with no failed requests or retries. The complete unauthenticated **161,587,494-byte ZIP** matched frozen SHA-256 `3558ded7a8235b9ac708c71ec7fea169bb5d71f324014b8e4ccdbfa9b3bd3adb` at 18:27:54 UTC.

A cold browser with the owned release server stopped restored a paused live cut, resumed to a real win, played the story and ending poster, retained Collection, played an uploaded MP3 and navigated training Settings/Back to lesson. The public browser independently restored the exact Dawn picture/story pair while retaining earlier artwork, won by ordinary input, exercised story playback controls and reopened the earned picture/story after reload. Its initial result was 52.2%, 8,160 points, three lives, 40.13s Silver. A later visibly extended cut saved at 0%/0/three lives/0:01 survived reload and explicit Resume without a new direction, then won at 52.2%/8,160/three lives/0:04. Ordinary later wins may improve scores; story playback does not grant a second reward.

Retained test observations distinguish a near-start save from the extended-cut check, a second attempt that won before the intended pause, and one incorrect test selector (`Pause story` instead of the visible `Pause`). Corrected native actions passed; no game state was forced. The old main-site v0.31 URL naturally forwards to the canonical archive with its query and fragment and still offers Continue. That check establishes routing and saved-flight discovery, not another archived save reconstruction or offline certification.

The root checkout fast-forward preserved all 54 untracked user reference files with identical paths, sizes, hashes and modes. Final receipt SHA-256: `96d87ca4be0a155844650dc1ae23368b132d700998671e8c8915da0b64b6ecce`. The release has 18 related assets, including public/native peer receipts and complete-download evidence.

## Remaining boundaries

A stale picture-ready notification can say the flight is running beneath the explicit Paused dock; the next source changes it to “Picture ready.” Frozen files stay unchanged. Native original-media download-to-disk, a complete paired game-data/media transfer, physical phone/controller/native-store testing, finished audio listening and full content production are separate gates. The example is an eight-second silent story, not completion of the twelve-story target. Original-media files, game-data JSON and custom soundtracks cover different inventories. Older incompatible media readers retain their existing limits.
