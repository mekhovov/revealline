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
or transfer it in verified chunks; do not truncate DOM text. Source preparation
and fixture syntax checks pass, but the browser run remains pending because this
subagent had no browser surfaces available.

The existing final Stadium playtest on port 8834 is preserved in its separate
ignored output directory. This Hangar work has no PR or public deployment claim.
Actual WebGL/image inspection, package admission, prepared-player launch and
protected publication remain before readiness. No hardware frame-rate, physical
device, novice or artist acceptance is inferred. Additional unit coverage stays
deferred to D6 under the approved plan.
