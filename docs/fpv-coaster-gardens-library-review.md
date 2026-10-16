# Coaster Gardens Library study: draft admission

15 October 2026. Adds **Coaster Gardens — 2 km study** to Regional free flight with EN/UK text and six localized authored starting points. This remains a draft until the source and immutable delivery in #1382 and #1386 pass native visual acceptance. No finished four-kilometre park or moving rides are claimed.

## Player-facing change

The card offers a 2.048 × 2.048 km static park study: arrival gardens, loop meadow, ridge station, service courts, woodland promenade and river gardens. It uses the existing explicit Download → Saved → Fly journey. Downloading scenery does not prepare the simulator itself offline; that existing distinction remains visible. Flight, starting-point restart and saved-place restoration retain their existing disarmed preparation and safety rules.

The exact immutable descriptor is bound to commit `3b6edef381a917e7ce0b6a37054fcfc3ee7188cd`, path `authoring/fpv-worlds/regions/coaster-park/delivery-review-r1/delivery.json`, **29,654 bytes** and SHA-256 `4800da2f8a06134333fad8def9615a96c94b2fb76f7fb3ef41bfa69b4a9872b5`. Total download is **33,908,597 bytes**. Known-empty scenery cells remain explicitly declared in the hashed source.

No new appearance profile, runtime module, package-file allowance or byte budget is introduced. The study uses plain terrain and its verified indexed scenery materials. This does not claim final terrain/art quality.

## Completed checks

- The real immutable HTTPS download passed all **183 responses** with exact descriptor and asset hashes/lengths. Observed download time was approximately **16.36 seconds** on this environment; this is not a player-speed promise.
- All six authored starts prepare disarmed in Selflevel and Acro at low, balanced and high detail: **36 production-session cases**, each followed by 100 accepted commanded ticks, safe pause retention and zero-resource disposal.
- Geometry hashes agree across modes and tiers. No GPU/FPS claim is made by these Node checks.
- Unknown starting-point selection is rejected; the installed entry retains its exact descriptor identity for saved-place isolation and has no scored course stages.
- Every prior main-branch Library row and authored-start label is byte-for-byte retained. The installation database, activation/rollback/removal policies and saved-revision enumeration are unchanged; this is not a new browser-storage test.
- Syntax, scoped lint and Git whitespace checks pass. The executable check and raw receipt are under `authoring/fpv-worlds/regions/coaster-park/verify-library.mjs` and `library-verification-r1.json`.

## Remaining gates

Native art review on frozen source origin 9087 remains required before this draft is eligible to merge. The exact Library candidate then needs cloud package hash/inventory/import-closure checks and normal prepared-player Download/Fly, reload and unavailable-origin review. Physical-device/controller and broader quality acceptance remain separate. No browser tab was opened by this lane.

This branch starts from main `7de653d8dee104a9cf04c88efab355a9301eebab`. Parallel draft additions such as Hillside #1388 must be retained when their changes reconcile; this PR does not replace the Library list wholesale.
