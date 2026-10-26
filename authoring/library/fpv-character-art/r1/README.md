# Optional character art, revision r1

This pack supplies all 36 family/cast combinations for the optional FPV character
appearance. The shared MakeHuman body has natural human proportions and textured
workwear. Field equipment, worn canvas equipment, and winter clothing distinguish
the three casts. The artwork is stylized; it is not photorealistic.

## Runtime files

- `manifest.json` identifies every family/cast, attachment, LOD, clip and body region.
- `characters.glb` contains the shared body, paired rigs, equipment library, embedded
  PBR images, and original in-place motion.
- `provenance.json` records the CC0 source assets, archive and source file hashes,
  authoring tools, modifications, builder hashes and exact release file hashes.
- `authoring/` contains the portable source builders. Blender intermediates and
  preview images are not runtime dependencies.

All 12 families are present in each of `tactical`, `rivals`, and `arcade`:
lookout, patroller, runner, sprinter, courier, guard, refuge-seeker, switchback,
rendezvous-pair, shield-bearer, brace-trooper and relay-warden. Equipment adds visual
identity only. It does not change encounter rules, collision or gameplay hitboxes.

## Source and license

MakeHuman core graphic assets and the selected workwear, shoes, hair, eyes and
skin are CC0. The original source archive SHA-256 is
`b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`.
The selected source files and the separately restored brown-eye texture are
individually pinned in `provenance.json`. Procedural gear geometry, gear material
atlases, body-region caps and motions were authored for this project. MPFB's GPL
license applies to its authoring software, separately from the CC0 graphic assets.

Primary records:

- <https://static.makehumancommunity.org/about/license.html>
- <https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html>
- <https://github.com/makehumancommunity/mpfb2/tree/v2.0.18>

## Asset contract

- glTF Y-up, metres, local forward +Z; visual height 1.8 m. The renderer performs
  its facing correction outside the skeleton.
- `worker_live_root` and `worker_lod1_root` contain complete, paired 53-joint rigs.
  Each uses opaque body/workwear and masked hair/brow draws.
- Four paired in-place clips: idle (3 s), walk (1.2 s), run (0.8 s), warning
  (1.4 s). Each merged clip has 108 channels. No root travel is authored.
- Six rigid anatomical regions are retained under `worker_damage_library`, with
  separate bounded cut caps for the explicit bloody display mode.
- Equipment is a shared library of 25 meshes. A character uses at most 8
  attachment rows, each with one material primitive. Winter sleeves follow the
  original source arm/workwear contours with rounded overlapping hems; coat and
  vest panels derive from the selected CC0 workwear. All attachments remain
  cosmetic. Brace offsets are bounded local translations specified in the manifest.
- Eight embedded PNG images: 2048-square body basecolor/normal/ORM, 1024-square
  masked hair/brows, 512-square cap tissue, and 1024-square gear basecolor/normal/ORM.
  Core glTF PBR only; no remote image dependencies.

## Rebuilding

Use the pinned Blender 4.5.14 LTS and MPFB 2.0.18. Install MPFB in an isolated
user extension directory as `bl_ext.user_default.mpfb`. Set
`BLENDER_USER_RESOURCES`, `BLENDER_USER_CONFIG`, `BLENDER_USER_SCRIPTS` and
`BLENDER_USER_EXTENSIONS` to task-owned directories. Launch with
`--background --factory-startup --disable-autoexec`.

Set `FPV_ASSET_DIR` to the output directory, `FPV_MAKEHUMAN_ASSETS` to the extracted
system asset root, and `FPV_REPO` to the application checkout. Keep every builder
alongside `animate-worker.py`. `authoring/rebuild.sh` runs the complete sequence
after those environment variables and `BLENDER` are set.

1. Run `authoring/create.py` from factory state → `worker-source.blend`.
2. Open `worker-source.blend`, run `authoring/bake.py` → `worker-atlas.blend`.
3. Open `worker-atlas.blend`, run `authoring/animate.py` → `worker-animated.blend`.
4. Open `worker-animated.blend`, run `authoring/assemble.py` → `worker-candidate.blend`.
5. Open `worker-candidate.blend`, run `authoring/wardrobe.py` → `worker-wardrobe-raw.glb`
   and `worker-wardrobe.blend`. This step bakes the source body's shape keys before
   fitting the sleeves and shares all gear materials and geometry.
6. Run Node on `authoring/finalize.mjs` → final GLB, 36-entry manifest and
   strict `appearance-admission.json` using the application's actual importer.
7. Open `worker-wardrobe.blend`, run `authoring/review-wardrobe.py` → two contact
   sheets. Set `FPV_FOCUSED_REVIEW=1` for the smaller fitting preview.

The generated geometry, baked images and export bytes can vary with tool versions.
A rebuild must be admitted and reviewed with its own fresh hashes. Existing
release pins must never be reused for changed bytes. Browser rendering, remains
behavior and performance are qualified separately from these Blender previews.

## Settled wardrobe pose

`authoring/settle-equipment.mjs` runs after finalization. It samples the authored idle animation at time zero, matching the rigid damage regions from `assemble.py`, and creates 25 rigid nodes sharing the original equipment mesh data. Each transform is bone-pose × inverse bone-rest × equipment-world. The manifest supplies these as `remainsRoot`; living equipment keeps its original attachment. No texture or geometry buffers are duplicated. Independent comparison against the actual browser loader agreed within 1.1e-7 per matrix component.
