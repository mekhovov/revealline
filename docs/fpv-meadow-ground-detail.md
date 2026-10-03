# Meadow ground surface detail

3 October 2026. This bounded D2 increment starts from main
`b3167a8f89c09286a424996ba4f7e3dca4a351b2`, including the merged Yard
composition and Woodland tree/foliage work. It gives authored Meadow ground
subdued soil patches and scattered short dry-grass detail at close flight height.
It changes color, normal and roughness pixels on the existing ground material.
There is no new grass geometry, decal, obstacle, texture allocation or asset file.

## Scope and ownership

The recipe is selected only for `environment === 'field' && !pixel && !kit`.
Pixel and the 17 shared visual collections retain their existing material maps.
The `grass` material role, palette authority, 12-metre tile, UVs, ground plane,
normal scale, geometry, object hierarchy and all quality budgets remain unchanged.
The new recipe uses the existing three generated maps and their world owner;
roughness and ambient-occlusion bindings still share one data map.

Periodic broad/fine noise supplies calm soil patches. An independent seeded
24-by-24 tuft grid jitters short blades, fully contained within half-metre cells,
so feature masks do not create tile-edge cuts. Blade height and soil relief track
the visible color features. Normal derivative compensation applies only to this
recipe. The shared grass generator and its random-number sequence are unchanged.
Existing low/balanced/high map sizes, mipmaps and anisotropy caps stay intact.

The current field scope contains 43 courses: `flight-05`–`flight-12`,
`beginner-08`–`beginner-27`, `beginner-29`–`beginner-30`, `beginner-43`–`beginner-44`,
`beginner-46`–`beginner-51`, `beginner-53`–`beginner-56`, and `beginner-58`.
Their four arena widths are 44, 64, 88 and 150 metres. The separate controls
preview also uses field ground in a 160-metre arena. No lesson, target, large-school
reference bar/tower/platform ID, flight bound, collision/support surface, route,
recording or appearance pin changes. Existing groves and distant hills keep their
positions, geometry and shadow behavior. No draw call is added.

## Verification

The maintained manual CPU qualification binds all unchanged runtime sources to
the pinned main and compares real before/after procedural scenes. It is manual
functional evidence, not new unit coverage. Existing workshop, texture and
acceptance checks pass 30/30. Full `npm run validate`, changed-file lint, formatting and syntax checks pass.

`docs/evidence/fpv-meadow-ground-detail-cpu.json` records 1,777 passing assertions
across 324 cases: 228 catalogue scenes, 57 controls-preview scenes and 39
other-environment regressions. All 17 shared collections and their seven roles,
Pixel pixels, geometry, UVs, material parameters, sampling, AO/metal/alpha
channels, resource counts and exact-once cleanup remain preserved. Deterministic
rebuilds and live preset cycles pass. All 51 installed field recordings replay
over 61,383 ticks, including exact final identities for all 35 World recordings.
Seventy-one immutable files match the baseline. The CPU receipt records the
working-tree base and independently binds the actual candidate visual/script
bytes by SHA-256; its visual hash is the same as the frozen source fixture below.

The immutable source fixture is
`http://127.0.0.1:8834/dist/fpv-meadow-ground-detail-verification-source/index.html`.
It freezes 31 modules per side / 19,692,954 bytes. Candidate visual SHA-256:
`9e8cb61d40010cbc76a2f72358b47000c4d4b2d9d03174eccf0d26efcb371a80`.
The fixture uses actual flight renderers across four arena sizes, three presets,
authored/Pixel/Industrial Workshop, FPV at 1.5/3/6 metres, chase and overview.
It checks all 43 course scopes, lateral views, unchanged Hangar/Woodland pixels,
live preset restoration, resource plateaus and final disposal. Its compact
receipt retains every check and image hash/count without raw pixel buffers.
Actual source WebGL qualification passes 384 checks / 190 image pairs. The
coordinating agent visually reviewed and accepted the scoped near-ground change;
this is not a broader finished-world or realism claim. The complete 108,193-byte
receipt is `docs/evidence/fpv-meadow-ground-detail-source-browser.json`, SHA-256
`8a192916bc93b7160de8cec2c2298ce4dd5ac4e158aebc4965f392a289870f45`.
The inspected screenshot is
`docs/evidence/fpv-meadow-ground-detail-source-comparison.png`.
No physical-device FPS, novice readability, final artist or public deployment
acceptance is inferred. Additional unit coverage remains deferred under the
approved plan.

## Source-bound package candidate

Node 22.22.2 admitted all three optional packages from commit
`7dc2e5eca8226dbdab34889c82b80d1ef98d030b` / tree
`f2c76ef1c3e13e9b42051c3b7fc672022cf15930`. Two builds produced identical
artifacts; committed inputs and ZIP members were verified. Approved limits and
all review gates remain unchanged. The candidate is preserved under
`dist/fpv-meadow-ground-detail-candidate-7dc2e5eca` and remains
`publicEligible: false`. See
`docs/evidence/fpv-meadow-ground-detail-admission.json`.

| Package         | Files | Uncompressed bytes | Approved limits              |
| --------------- | ----: | -----------------: | ---------------------------- |
| civilian-flight |    48 |            679,266 | 64 files / 8,388,608 bytes   |
| civilian-fpv    |    69 |          4,364,818 | 72 files / 8,388,608 bytes   |
| fpv-worlds      |   102 |         15,559,020 | 104 files / 16,777,216 bytes |

All 15 artifact checksums were independently reread and verified. The admitted
FPV Worlds ZIP SHA-256 is
`932ecbd227a74e3250cd646d415a8433c0924b907aef231d7a75d2ef4eb088a6`.
The separate player at
`http://127.0.0.1:8834/dist/fpv-meadow-ground-detail-playtest/index.html`
contains 94 files / 15,401,249 bytes; ZIP SHA-256
`69440c3db5c88c93649f0efa56f24c2dd4bc9add79950b25c015e41c7daa9ed4`.
Its build receipt is `docs/evidence/fpv-meadow-ground-detail-playtest.json`.

The immutable packaged fixture is
`http://127.0.0.1:8834/dist/fpv-meadow-ground-detail-verification-package/index.html`
(31 modules per side / 18,502,426 bytes). All 31 candidate modules match both
the admitted ZIP and separate player; 30 match the source fixture exactly and
only the intentionally reduced generated `game/i18n/catalogs.mjs` differs.
The before inventory and harness are exact across source and packaged fixtures.
Both HTTP URLs return the expected local bytes. The packaged actual-WebGL run
passes all 384 checks / 190 image pairs. All 190 sample records exactly match the
source run: before/after hashes, changed-pixel counts, draw calls and triangles.
All reload cycles plateau, registered resources dispose to zero, and no unexpected
context loss occurs. The complete receipt is
`docs/evidence/fpv-meadow-ground-detail-package-browser.json`
(108,230 bytes; SHA-256
`40de931cb0d2fc38c5a0ac1541b26fe0962aba1e6edc4dc0417b14a4155155a2`). Its source inventory exactly matches the
frozen packaged fixture manifest. The ordinary player was launched into
“Turn and travel”: the scene rendered correctly and controls progressed from
Ready through Arm/resume to Paused, with the expected deliberate re-arm prompt.
The coordinating agent retained the screenshot at
`docs/evidence/fpv-meadow-ground-detail-player.png`. This scoped player check
does not replace the 51 deterministic recording replays above.
The preserved Hangar and Stadium players remain in their separate ignored paths.

## Integration with merged Hangar

Main `ea596d80ba26decc4e7691e4a5c34bd3461fcda6` merged cleanly at
`883b2d3460ff0cad8fe9decf3e3c10574dedd103`, preserving the reviewed Hangar
113-line addition. The original Meadow added/removed runtime lines remain exact
against the new main. The qualification scripts now pin that integration baseline;
commit `9e25a9674d54ff37a2e47dccf0fe121e44dbea1a` freezes these inputs.
Integrated visual SHA-256 is
`5202f048a9fc6bf7ea53ced7fdea52833ddf9af9e508010654763b0873fd78f4`.

The CPU rerun again passes 1,777 assertions / 324 cases / 51 recordings and the
30 existing checks pass. All 285 field/controls-preview scene records exactly
match the original candidate, including the ground map and protected/full-scene
hashes, counts and resource totals. All 321 non-Hangar cases, all 71 immutable
input hashes and all 51 recording results remain exact. Only the three incoming
Hangar scene records change, as expected for that separately qualified feature.
See `fpv-meadow-ground-detail-main-cpu.json` and
`fpv-meadow-ground-detail-integration.json` under `docs/evidence/`.

The original source and packaged 384-check / 190-pair browser matrices remain the
raster evidence for these unchanged Meadow maps/scenes. A second unconditional
full raster matrix is unnecessary for the isolated Hangar integration; the
final integrated player observation is recorded separately. No earlier frozen
candidate or receipt was overwritten.

The integrated Node 22.22.2 candidate is
`dist/fpv-meadow-ground-detail-candidate-9e25a9674`, tree
`7f64b0608668d256bf5ebfd9a00054bfc58a3ee6`. All three admissions again pass two
identical builds, committed-input and ZIP-member verification: 48 / 679,266 bytes,
69 / 4,369,226 bytes, and 102 / 15,563,428 bytes, within the same approved bounds.
All 15 artifact checksums pass independent rereading. Integrated FPV Worlds ZIP
SHA-256 is
`30345a2d03c91e5944f04e6614824d0169335c929a994a6b82842999f11121cc`.
See `docs/evidence/fpv-meadow-ground-detail-main-admission.json`.

The final player is
`http://127.0.0.1:8834/dist/fpv-meadow-ground-detail-playtest-main/index.html`:
94 files / 15,405,657 bytes, ZIP SHA-256
`12d759486bc1d2eacecd6698083002dd7ffd6aedb4cada26d22f22aa28200aae`.
See `docs/evidence/fpv-meadow-ground-detail-main-playtest.json`.
An immutable final fixture is prepared at
`http://127.0.0.1:8834/dist/fpv-meadow-ground-detail-verification-main-package/index.html`
(31 modules per side / 18,511,242 bytes). All 31 after modules match the admitted
ZIP and final player. Relative to the original packaged fixture, only the visual
module changes, containing the separately reviewed Hangar addition; the harness
and other 30 candidate modules are byte-identical.
