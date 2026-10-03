# Stadium stand and scoreboard surfaces

3 October 2026. A bounded D2 preparation increment improves the three canonical
Stadium solids: `stand-west`, `stand-east` and `scoreboard`. It does not complete
the wider Stadium/Garage environment pass or establish production-art acceptance.

The stands now read as closed precast structures with six-metre facade bays,
restrained tier bands and numbered section plates. The scoreboard has painted
steel cladding, a framed dark face, a static FPV sign and an idle `--:--` display.
The display does not report live scores, time or objective state. Rear ventilation
markings give the board a distinct reverse face. All added markings are coplanar
with the original opaque boxes; they introduce no opening or new obstacle.

Only the exact three IDs in the Stadium environment receive this treatment.
Thirteen courses contain them: `stadium-01`–`stadium-08`, `beginner-32`,
`beginner-35`, `beginner-42`, `beginner-45` and `beginner-57`. The fourteen Snake
Stadium layouts retain their existing solids. The `school-finish-platform` in
`beginner-42` keeps its plain material and UVs. There are 27 Stadium courses in
the current catalogue; the older 13-course count predates Snake content.

## Presentation and ownership

`renderer.mjs` changes only UVs and material selection on the existing boxes and
attaches role-batched painted planes. Body positions, indices, transforms, contact
surfaces and replay inputs remain exact. Seven detail batches add 2,664 vertices
(888 triangles) per canonical scene. They are opaque and visible in every quality
preset, receive shadows and do not cast shadows. No new asset file or decoder is
required; original procedural facade textures use the existing quality bounds.

The resolved authored theme controls Pixel filtering. Shared Themes continue to
own concrete, steel, rubber and enamel textures and finishes through the existing
material factory. The new surface selection does not change the global appearance
session, theme storage or imported material-binding policy. Material variants are
world-owned and reused across both stands and the board.

The primary player still imports the existing Kenney pavilion GLB. Stadium's
procedural outer bleachers remain visible alongside it; the added work is on the
near-flight canonical solids, so it survives both the normal imported path and
fallback rendering. The generator template and generated `world-assets.mjs` are
unchanged. Existing licenses, provenance and imported-scene disposal are retained.

## Reproduce functional qualification

Use the repository-supported Node version. The manual geometry/recording check
replays all 21 bundled Stadium demonstrations through the actual runtime and
compares their final identities. It also checks source identity boundaries and
the detail-plane bounds. It is functional evidence, not new unit-test coverage.

```sh
node scripts/qualify-fpv-stadium-structures.mjs --out /tmp/fpv-stadium-structures-cpu.json
node scripts/prepare-fpv-stadium-structures-verification.mjs --verify-only
node scripts/prepare-fpv-stadium-structures-verification.mjs --out dist/fpv-stadium-structures-verification-source
node scripts/game-cli.mjs serve --port 8834
```

Open `http://127.0.0.1:8834/dist/fpv-stadium-structures-verification-source/`.
Choose **Run structure qualification**. The fixture exposes its receipt as
`window.fpvStadiumStructuresReceipt` and offers a receipt download. It freezes
baseline `b3b23a76b4a4f41cd97e228ae1400fce96abcde8` and the actual candidate
dependency closure into different module URLs. Existing fixture directories and
receipt files are never overwritten; use a fresh suffix/path for another run.

The source fixture contains 31 modules per side, 19,668,541 combined bytes. It
uses the real WebGL renderer and loader. Qualification covers the 13 canonical
courses and their three arena sizes, all qualities, FPV/chase/overview views,
reverse-board views, authored Pixel and the shared Industrial Workshop theme,
the beginner landing platform, all 14 Snake Stadium layouts, imported/fallback
scenery, exact body/ray checks, shader preparation and resource disposal cycles.
The old generic scoreboard stripe and new painted planes are treated separately
from base collision solids; real rendered sightline checks include both versions.

For an already prepared World Studio package, supply its repository-local root:

```sh
node scripts/prepare-fpv-stadium-structures-verification.mjs --candidate-base dist/PREPARED-WORLD-ROOT --out dist/fpv-stadium-structures-verification-package
```

The package must contain the same module paths. The preparation script bounds
individual files, dependency count and total input bytes and rejects unsupported
paths. Optional-package admission, source/ZIP identity and actual packaged player
launch remain separate checks.

## Recorded status

`docs/evidence/fpv-stadium-structures-cpu.json` records 32 passing functional
checks, all 21 complete demonstration replays, exact immutable source hashes and
the qualified renderer/visual-module hashes. Full `npm run validate`, syntax,
changed-file ESLint and Prettier checks pass. The final source browser fixture passed 484 checks and 228 image-pair
comparisons with no context loss. It covers three repeat load/disposal rounds;
registered resources are all released and loaded resource counts remain stable.
The actual before/after stand and scoreboard views were inspected by the agent;
this is not human artist acceptance. Source receipt and screenshots are in
`docs/evidence/fpv-stadium-structures-source-browser.json`,
`fpv-stadium-stand.png` and `fpv-stadium-scoreboard.png`.

All three optional package admissions pass against committed candidate
`698b6aa3092b2ca235d32e10e994134658f33db6`, including source input identity, ZIP
member equality and two byte-identical builds. The source-bound World Studio
closure is 102 files / 15,550,157 bytes under unchanged 104-file / 16 MiB limits.
The development player closure is 93 files / 15,375,227 bytes. Its manifest hash
is `4acb11618a94717b71b05f0af85adf3b6fbef02531fc38103bb2e925500d48b7`.
The admission receipt remains explicitly `publicEligible: false` until normal
publication qualification. See `docs/evidence/fpv-stadium-structures-admission.json`.

The packaged browser fixture also passed all 484 checks and 228 image-pair
comparisons, with three stable load/disposal rounds and no context loss. Its
receipt is `docs/evidence/fpv-stadium-structures-package-browser.json`.
The packaged player launched through Select Mission → Starting grid, rendered
the new stands/scoreboard, armed deliberately and paused successfully. The
inspection used Codex in-app browser on this macOS workstation; no physical
controller or device performance is inferred. See `docs/evidence/fpv-stadium-player.png`.
Public deployment remains unverified. No named-device frame
rate, sustained memory, physical-controller, novice-player or artist acceptance
is inferred from source verification. Additional unit coverage remains deferred
to D6 under the approved plan.


## Current-main publication integration

PR #1004 merged main ce6af3e65 after the original browser qualification. The
resulting runtime candidate70679d3ab retains byte-identical Stadium renderer and
structure helpers; the sole visual-module delta is #999's Military Field material
recipe. All30 existing visual/acceptance checks and32 functional checks pass,
including all21 demonstrations. All three optional admissions, committed-input
verification, ZIP checks and two byte-identical builds pass again; see
`fpv-stadium-structures-main-admission.json` and `fpv-stadium-structures-main-cpu.json`.
The refreshed development build is94files/15,392,904bytes including its manifest;
ZIP SHA c5f90ddd8f582667294a72c09ec953278ff9fea71a1cdede5ccee0c94c803be6.
Original browser receipts stay bound to their recorded candidate rather than
being relabelled as new measurements. Current-head CI and public deployment
remain pending. Separate #993 repairs a Woodland foliage regression in main;
this Stadium increment does not claim to complete that integration.

## Browser receipt capture repair

After PR #1004 merged as `53907d8dbe489890eb0e346de40762284eedac9a`, inspection
found that both stored browser receipts ended mid-string: the original DOM
transfer had truncated the bulk per-frame samples after 200,000 characters.
The source and package receipt files are now valid bounded summaries with format
`FPVStadiumStructuresBrowserEvidenceSummary.v1`. Each preserves all 484 complete
passing checks, both original 31-file source digest inventories, the timestamp,
baseline and candidate from its original capture. The original receipt format is
retained in `sourceFormat`.

The final success status and 228 image pairs were independently observed in the
browser DOM during the original qualification. Raw per-frame samples are not
retained; the summaries do not reconstruct those samples, report a new browser
run, or establish hardware performance. The capture limitation is explicit in
each file's `captureNote`. This documentation repair changes no runtime source,
package, admission rule or original qualification identity.

Repair verification parses both summaries and compares every retained check and
source digest inventory with the complete fields recoverable from the original
truncated files. All 484 checks per file remain identical and passed.
