# Woodland tree forms and imported-scene variation — D1

World Studio normally loads the licensed Kenney GLB scenery and hides the
procedural backdrop. This increment addresses both paths explicitly:

- Primary GLB scene: deterministic individual tree orientations replace repeated
  edge-aligned poses. Recalculate rotated footprints before placement, retaining
  each tree's height, count and outside-arena clearance. Benches and all five other
  imported environments remain byte-identical. The authoring template matches the
  generated runtime; no asset-library bytes or license records change.
- Procedural fallback: five overlapping lobes replace each round crown, with
  different orientations per tree and three branch forks. Crowns remain in 24
  existing batches; forks use eight spatial batches and one shared geometry.
  Procedural Pixel and shared appearance collections retain their existing models.
  Imported Woodland tree orientations change across authored themes; the Pixel
  preservation claim here applies to procedural geometry and materials.

Course geometry, collision, actors, scoring, seeds and recordings are unchanged.
All new procedural vertices stay within the prior crown sphere envelopes and
outside the arena. No new runtime module, decoder or network asset is added.
The separate surface PR #992 improves only the procedural fallback, not the
normally loaded Kenney trees. These two increments are independently buildable.

## Functional evidence

Baseline main: `a8c808a26447dcea17c82852cb07b24d3059d2cb`.
Run `node scripts/prepare-fpv-woodland-tree-forms-verification.mjs`, serve this
checkout and open `docs/evidence/fpv-woodland-tree-forms-harness.html`. It snapshots
the two changed visual modules; unchanged dependencies use the current checkout.

- 15 procedural cases / 90 rendered views: two Woodland arena sizes, three quality
  presets, shadows, Pixel/Industrial Workshop and Meadow regression.
- Unchanged non-canopy vertices match exactly; Pixel, Industrial and Meadow images
  are unchanged. Every new crown/fork vertex passes its envelope check.
- Actual GLTFLoader scenes: 16,080 vertices per scene remain outside each of the two
  Woodland arenas. 52 placements remain. Sampled primary-scene draw calls and
  triangles are unchanged (152 / 6,642 and 150 / 6,390, including shadows).
- Five other environment GLBs are byte-identical to baseline.
- Procedural fallback adds one geometry (79→80), eight visible batches and shadow
  counterparts. Balanced overview: 192→208 calls, 16,458→66,618 triangles. This
  quality cost applies only while the fallback is visible; no FPS claim is made.
- Fifteen procedural unload cycles return to zero GPU geometry and a stable
  one-texture residual. This is bounded fixture evidence, not full GPU leak proof.
- 30 existing appearance/texture/acceptance checks pass. No additional unit coverage.
- Template/runtime equality passes; World Studio prepares at 94files/14,411,732bytes.
  Changed JavaScript passes lint, formatting and whitespace checks.

Browser evidence and screenshots are in `docs/evidence/fpv-woodland-tree-forms-*`
and `docs/evidence/fpv-woodland-imported-trees.png`. Chrome154/macOS WebGL was used;
physical/mobile sustained performance and public deployment remain unverified.

## Publication refresh — 3 October 2026

Merged main `822188e9bebdcf3d46119b48bfd0558e708eb051`, which includes #992,
into the existing #993 history. The canopy conflict retains the shared foliage
maps, vertex colors and bark surfaces alongside all five crown lobes and branch
forks. Both delivery-log histories are retained. The template and generated
runtime still match exactly; imported rotations and rotated footprint checks
remain intact. No other pending art branch or native stack was incorporated.

The refreshed source passes manual Node checks for both Woodland bounds and
authored, Pixel and Industrial Workshop procedural presentations: six cases,
all new crown/fork vertices within the previous envelopes, correct shared maps
and vertex colors, 512-pixel high-quality maps, and disposal events for every
inspected resource. Independent decoding of each generated GLB verifies 16,080
transformed vertices outside its arena, with at least 1.2 metres of clearance.
Receipt: `evidence/fpv-woodland-tree-forms-main822-cpu.json`.

Scoped existing checks are **29/30**, not a passing suite. The unchanged shared
enamel motif check finds 16 patterns for 17 collections; its fix is independently
tracked in #999 and has not been copied into this branch. Keep #993 draft until
that fix is on main, refresh again, and rerun the affected qualification. Existing
browser receipts above remain historical, not a new browser result for this merge.

Changed JavaScript passes ESLint, Prettier and whitespace checks. Development
World Studio preparation passes with 94 files / 15,388,669 bytes and ZIP SHA-256
`cca7ace51fa8fe6d77ae85b1ffb7cb653e4f0519312105b58f149847e96f391f`.
The earlier failed GitHub preview/edition jobs used obsolete 64 MiB limits;
this merge incorporates current main's reviewed capacity implementation without
changing any admission guard. Current-head CI and public deployment remain pending.
