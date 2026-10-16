# Coaster Gardens supported composition: immutable review-r2 delivery

This new immutable source bundle packages the grounded loop frames, station courts and continuous paths from #1398 (`defcdc979165f4626eedbaec12404c03e1f00076`). It does not replace the prior review-r1 bundle or the current Draft Library pin. Native review of composition-r1 remains negative; this new composition-r2 delivery is still gated on its own visual/player review.

## Exact source

- Identity: `coaster-gardens-study`, descriptor revision `review-r2`.
- Format: `FPVRegionalDelivery.v2`, complete terrain plus explicitly sparse scenery.
- Descriptor: 32,824 bytes; SHA-256 `935a4a4034c206d5bbce77e333f72530812a50c60135117616887a6dac70b53a`.
- 202 payload files: 34,181,566 bytes; complete download including descriptor: 34,214,390 bytes.
- Terrain manifest SHA-256: `6dd2014a1f9ad96d81b2fb5fb76074b90b28c892660b6990c38805293ee1bb4a`.
- Scenery manifest SHA-256: `6267731197ea142b0cf4a99380953108aca11ae01db69aabda866388029b037d`.
- Authored grid: 8×8 cells at 256 m, 2.048×2.048 km; six unchanged starting-point IDs. 36 scenery cells and 28 explicitly empty cells.

The existing closed-delivery builder validates all source hashes before creating a new directory. The source output, old bundle and old verifier are retained. The exact copied bundle is under `authoring/fpv-worlds/regions/coaster-park/delivery-review-r2/`. Its accepted licensed model inputs/provenance remain in the original source intake; the new supporting architecture is original.

## Verification

`verify-supported-delivery.mjs` uses the production downloader and production regional session. All 203 responses—descriptor plus every declared payload—were independently hashed and validated. This uses filesystem-backed HTTP responses, not a network throughput measurement. Cached flight configuration has no undeclared or network fallback.

All 12 production start cases passed across six starts and Self-level/Acro. Each refuses arming before preparation, prepares paused at the exact authored pose, performs 100 deliberate simulation ticks without contacts, pauses without further advancement, and disposes source/geometry/texture reservations to zero. The full command and source/hash receipt is `supported-delivery-verification-r1.json`.

The committed copy is byte-identical to the verified external bundle. JavaScript syntax, formatting, lint and whitespace checks pass. No runtime module, package budget, scoring, physics, old recording or Library row changes are included.

## Remaining gates

Native visual acceptance of the corrected source, revised normal Library flow, exact combined player-package and cached-storage qualification remain separate. This is an early 2 km static park study, not finished 4 km park art, an operating amusement ride or a claim of public admission. Existing immutable review-r1 URLs stay valid; no stored revision is replaced or deleted.
