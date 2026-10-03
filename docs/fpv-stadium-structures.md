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
changed-file ESLint and Prettier checks pass. Browser visual acceptance, packaged
qualification and public
deployment remain pending at this implementation handoff. No named-device frame
rate, sustained memory, physical-controller, novice-player or artist acceptance
is inferred from source verification. Additional unit coverage remains deferred
to D6 under the approved plan.
