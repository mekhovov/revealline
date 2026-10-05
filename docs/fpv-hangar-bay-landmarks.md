# Hangar wall bay landmarks

3 October 2026. This bounded D2 increment starts from main
`14291da8adf3674fdbb57bd41ea442371b534168`. It adds painted bay numerals 01–08
and small service-cover outlines to the two existing Hangar end walls. The north
wall carries 01–04 and the south wall 05–08, with the numerals facing into the
room. The service covers have painted vent and handle marks; they are closed
wall markings, not doors or openings. No objective state or route direction is
encoded in these static landmarks.

## Scope and preservation

Only the generated end walls inside the `environment === 'gym'` branch receive
landmarks. No obstacle-ID pattern, course content or imported scene changes.
The current catalogue contains 12 Hangar courses: `flight-01`–`flight-04`,
`beginner-01`–`beginner-07`, and `beginner-28`. They use 44, 64 and 88 metre
square arenas with heights of 10, 16 and 20 metres. The geometry helper refuses
unsupported faces, non-finite dimensions and walls too small for the markings.

`buildHangarBayGeometry()` creates local paint planes at the existing wall face;
the planes inherit the wall's transform. There are four role batches and 1,518
vertices (506 triangles) per Hangar. Every batch is opaque, uses polygon offset,
receives shadows and casts no shadow. The existing walls, floor, trusses,
windows, service bands and their material/UV bytes stay unchanged. The other
13 environment scenes remain exact in the manual comparison.

Rubber and enamel are the existing shared material roles. Shared collections
supply their own paints; authored Hangar reuses its rubber service-band source
and a matte pale enamel. Two paint variants are shared across both walls.
Original source paints and variants remain in world ownership, so shared maps
are disposed once when the world unloads. Pixel keeps its resolved nearest
sampling. Course bounds, colliders, supports, steps, fog, actor routes, recorded
inputs and theme pins are unchanged. No new texture, font, model or dependency
file is added to the runtime closure.

## Functional evidence

`docs/evidence/fpv-hangar-bay-landmarks-final-cpu.json` records 125 passing
manual assertions. It covers three arena sizes, three quality presets and
authored/Pixel/Industrial Workshop appearances: 27 scene cases. Existing
geometry, transforms, UVs and material pixels match the pinned baseline;
landmarks stay within the wall faces, wall ray distances match, and owned
resources dispose exactly once. All eight World-format and eight legacy
Hangar demonstrations replay successfully. World recordings retain their exact
final-state identities. The initial `fpv-hangar-bay-landmarks-cpu.json` receipt
predates the narrow-wall guard adjustment; the final receipt binds the current
visual module with SHA-256
`4273f3f9ec041d60ac10e3abbe85069ca6cc6a1d5b6fd698d2a8ec05833f4c63`.

Full `npm run validate`, changed-file ESLint, syntax and formatting checks pass.
The 30 existing workshop, texture and acceptance checks also pass. The manual
script adds no unit-test coverage. Reproduce with a fresh output:

```sh
node scripts/qualify-fpv-hangar-bay-landmarks.mjs --out /tmp/fpv-hangar-bays-cpu.json
node scripts/prepare-fpv-hangar-bay-landmarks-verification.mjs --verify-only
node scripts/prepare-fpv-hangar-bay-landmarks-verification.mjs --out dist/fpv-hangar-bay-landmarks-verification-NAME
```

## Browser handoff and remaining qualification

The maintained fixture freezes 31 modules per side (19,682,976 combined bytes)
under separate URLs and validates their hashes plus its own HTML. The prepared
source fixture is at
`http://127.0.0.1:8834/dist/fpv-hangar-bay-landmarks-verification-source/index.html`.
It uses actual flight renderers and covers both end walls in FPV/chase/overview,
all three sizes/presets/appearances, all 12 Hangar courses, unchanged Meadow
pixels, three reload cycles and final disposal. It records complete checks and
per-view hashes/counts without retaining raw pixel buffers. Download the receipt
or transfer it in verified chunks; do not truncate DOM text. The source browser run passed all 244 checks across 163 image pairs, with zero
context losses and successful final resource cleanup. Its complete 85,513-byte
receipt is `docs/evidence/fpv-hangar-bay-landmarks-source-browser.json`; the
receipt SHA-256 is
`678a61d64758b287d7e7012ea6b0f399bdeea186e36b496d78bafe1eaef21cd0`.
The north bay 01 view was visually inspected by the coordinating agent: numerals
were readable and flush, with existing window openings unchanged. This is a
static renderer comparison, not hardware or full-course learning acceptance.

The existing final Stadium playtest on port 8834 is preserved in its separate
ignored output directory. The focused Hangar change is published as
[PR #1008](https://github.com/mekhovov/revealline/pull/1008), assigned to milestone
57 with the reviewed `fastline-approved` signal. Protected exact-head checks and
merge rules apply. No public deployment is claimed.
Source and integrated packaged WebGL/image inspection and prepared-player launch
are qualified below. Protected publication remains separate from public release. No hardware frame-rate, physical
device, novice or artist acceptance is inferred. Additional unit coverage stays
deferred to D6 under the approved plan.

## Source-bound package candidate

Node 22.22.2 built all three optional packages from committed source
`55683baad4acc89a490eb0f39496adb2607444a5` / tree
`59b38d7794e17026a335ee6bebcd6ee11753e6d7`. Two builds produced identical
artifacts; committed input and ZIP-member checks passed with approved limits
unchanged. The candidate is preserved at
`dist/fpv-hangar-bay-landmarks-candidate-55683baad`. Its receipt is
`docs/evidence/fpv-hangar-bay-landmarks-admission.json`. Admission remains
`publicEligible: false`; review and publication gates are unchanged.

| Package         | Files | Uncompressed bytes | Approved limits              |
| --------------- | ----: | -----------------: | ---------------------------- |
| civilian-flight |    48 |            679,266 | 64 files / 8,388,608 bytes   |
| civilian-fpv    |    69 |          4,362,242 | 72 files / 8,388,608 bytes   |
| fpv-worlds      |   102 |         15,555,083 | 104 files / 16,777,216 bytes |

All 15 artifact checksums were independently reread and verified. The admitted
FPV Worlds ZIP SHA-256 is
`d823ea38d64fd21c84a594159f0439d0766e98280ffe02a80e9638062bc54ab5`.
The separate development player at
`http://127.0.0.1:8834/dist/fpv-hangar-bay-landmarks-playtest/index.html`
contains 94 files / 15,397,312 bytes; its ZIP SHA-256 is
`319c98fe0d30fca010e707982040c46b161713976289426ccf483ae008f36e40`.
See `docs/evidence/fpv-hangar-bay-landmarks-playtest.json`.

The packaged fixture is at
`http://127.0.0.1:8834/dist/fpv-hangar-bay-landmarks-verification-package/index.html`.
It freezes 31 modules per side / 18,492,448 combined bytes. All 31 candidate
modules match both the admitted ZIP and development player. Thirty match the
source fixture byte for byte; only the intentionally generated, reduced
`game/i18n/catalogs.mjs` differs. The renderer, visuals, assets, themes, physics
and course bytes match. The before inventory and harness are exact between
source and packaged fixtures. Both HTTP URLs returned the expected local bytes.
Preparing and serving the player is not a browser launch or visual pass.

## Current-main integration

Current main `a1cb86c85cd52db7256ad2ed16c30c8f40f90c32` (merged Woodland
replacement #1006) merged cleanly at `f164afa5602680f8344593810529031d4bf6eff1`.
The Hangar additions/removals match the original reviewed patch exactly;
Woodland foliage, tree helpers, imported asset runtime and its authoring template
remain intact. The only runtime diff from this main is the Hangar wall paint.

The maintained manual and fixture preparation scripts now pin this main as the
integration baseline. `docs/evidence/fpv-hangar-bay-landmarks-main-cpu.json`
repeats all 125 assertions / 27 scene cases / 16 recordings successfully, and
all 30 existing workshop, texture and acceptance checks pass. Integrated visual
module SHA-256 is
`e87379a77687b43265dd9fcd7bdb90e04695ca475259e995b60b6452faedc83e`.
The original source and packaged fixtures remain immutable historical inputs;
new integrated package and browser evidence must use distinct output paths.

The original packaged browser run also passes all 244 checks / 163 image pairs
with zero context losses and successful disposal. The complete receipt is
`docs/evidence/fpv-hangar-bay-landmarks-package-browser.json` (85,550 bytes,
SHA-256 `33c2fd5625342101fcf2d91663fdaae2ef3819f474b8808b7c1deccb3c65621b`).
All source and packaged sample records are exactly equal, including before/after
pixel hashes, changed-pixel counts, draw calls and submitted triangles. The
visually inspected north-wall comparison is retained at
`docs/evidence/fpv-hangar-bay-landmarks.png`.

The integrated Node 22.22.2 candidate at
`dist/fpv-hangar-bay-landmarks-candidate-99a9061d3` binds commit
`99a9061d372836764c2d70293a0ee2c79264c6bd` / tree
`3bc111859d2bd2ac2b21f49a4878c573fb08a863`. All three packages again pass two
identical builds, committed-source and ZIP-member checks under the same limits:
48 / 679,266 bytes (civilian-flight), 69 / 4,366,922 bytes (civilian-fpv), and
102 / 15,560,358 bytes (FPV Worlds). See
`docs/evidence/fpv-hangar-bay-landmarks-main-admission.json`.
All 15 candidate artifact checksums were independently verified. Integrated
FPV Worlds ZIP SHA-256:
`6d930c71334a818c9051f4d0fc68e9c23df5d01401f9c34262e18424598618ca`.

The integrated player is
`http://127.0.0.1:8834/dist/fpv-hangar-bay-landmarks-playtest-main/index.html`.
Its 94 files / 15,402,587 bytes have ZIP SHA-256
`775594f1b8cd3b373726bb27db40b6aabfcc0b3bb182f3ac729873546c429503`;
see `docs/evidence/fpv-hangar-bay-landmarks-main-playtest.json`.
The immutable integrated fixture is
`http://127.0.0.1:8834/dist/fpv-hangar-bay-landmarks-verification-main-package/index.html`
(31 modules per side / 18,502,998 bytes). All 31 candidate modules match the
admitted ZIP and player; the generated catalogue remains the only difference
from source. Full `npm run validate` passes again on this integrated source.

The integrated packaged actual-WebGL run passes all 244 checks / 163 image
pairs, all three reload cycles and final disposal, with zero unexpected context
losses. Its complete receipt is
`docs/evidence/fpv-hangar-bay-landmarks-main-package-browser.json`
(85,555 bytes; SHA-256
`273bc9582b28fca7279bf4a78b477306dd6bd7a31713671e32d3c2f509576314`). The receipt's source inventories exactly
match the immutable fixture manifest. All 163 sample records remain identical
to the original source and packaged runs, including both raster hashes, changed
pixels, draw calls and submitted triangles. This directly verifies that the
current-main integration retains the reviewed Hangar rendering.

The coordinating agent launched the integrated ordinary player, selected
“Lift and land”, observed the new bay markers, and operated Arm/resume then
Pause at 0.3 seconds without application errors. The actual-player screenshot
is `docs/evidence/fpv-hangar-bay-landmarks-main-player.png`. This is a scoped
launch/control observation; deterministic recording coverage is provided by the
16 CPU replays above. The preserved Stadium player on port 8834 was untouched.
All edits after source-bound candidate `99a9061d3` are documentation/evidence;
the qualified runtime bytes remain exact.
