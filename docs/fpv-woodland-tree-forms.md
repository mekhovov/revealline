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
  Pixel and shared appearance collections retain their existing models.

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
