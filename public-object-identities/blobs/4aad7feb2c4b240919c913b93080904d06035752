# Tropical coast asset intake, revision 1

Eight low-polygon, textured assets from Ron Kapaun / 3TD Studios are converted to self-contained GLB for **authoring review**. They are not a playable world, a collision mesh, a Library download or a release admission. Runtime file and byte budgets do not change.

The [source release](https://opengameart.org/content/3td-tropical-environment-pack-v20) explicitly identifies the pack as CC0/public domain. `provenance.json` pins the original 135,821,309-byte archive, conversion tools and exclusions; `selection.json` records every selected source member hash. The archive's legacy installation instructions predate the public CC0 release. Credit remains in `LICENSE.txt`.

## Included models

| Asset         | Triangles | Draw calls | GLB bytes |
| ------------- | --------: | ---------: | --------: |
| Beach grass   |        16 |          1 |   144,932 |
| Young bamboo  |       528 |          2 |   515,144 |
| Crate         |       252 |          3 |   879,296 |
| Covered jetty |       492 |          3 |   957,204 |
| Open jetty    |       420 |          2 |   660,836 |
| Jungle hut    |       608 |          4 | 2,087,976 |
| Beach rock    |       768 |          1 | 1,294,984 |
| Palm          |       688 |          4 |   936,372 |

All source images remain unmodified PNG/JPEG bytes embedded in the GLB. Highest-detail authored visual nodes are selected explicitly, keeping their ancestor transforms; Torque collision helpers and other LOD siblings are not rendered. Metres/inches and Z-up conversion remain source-derived. Some authored origins extend below ground: placement must use the recorded bounds rather than assuming a base at zero.

Material alpha-cutout and two-sided properties come from a small declarative subset of the adjacent Torque material definitions, parsed as data, never executed. Missing alpha thresholds use glTF's explicit 0.5 default. Normal/specular maps, wind and Torque subsurface effects are **not** ported in this intake. The bounded base-colour appearance needs review before scenery admission.

The converter first produced invalid three-component UV accessors from legacy UVW mappings. The preparation preserves S/T and discards only W for ordinary 2D textures. No positions or triangle counts are simplified. Compatible primitive joins reduce avoidable draw calls (covered jetty 234 → 3; hut 228 → 4). Optional triangulation metadata `FB_ngon_encoding` is not carried into the final glTF; explicit triangle geometry remains intact.

## Reproduce outside the repository

Use Python 3.11+ and the pinned authoring dependencies already declared in `authoring/fpv-worlds/package.json`. The isolated `intake-tools` package adds only `assimpjs@0.0.10`; its locked installation is for authoring, never shipped in the simulator.

From this folder, with an existing external archive and a **new** external output directory:

```sh
npm --prefix intake-tools ci --ignore-scripts --no-audit --no-fund
python3 select.py /external/Tropical_Environment_Pack_v2.0.zip /external/tropical-rebuild
node convert.cjs /external/tropical-rebuild
node embed.cjs /external/tropical-rebuild
node optimize.mjs /external/tropical-rebuild
node verify.mjs
```

`select.py` verifies the pinned archive identity before reading members, rejects unsafe paths/symlinks/case collisions, refuses to overwrite an existing output directory and extracts only the chosen DAE files, their referenced PNG/JPEG textures and adjacent material declarations. Obsolete author-machine texture paths resolve to one exact filename in the same archive directory; no network texture fallback exists.

`verify.mjs` checks committed model hashes, glTF validation, self-contained resources, finite transformed bounds, normals/UV presence and unchanged triangle counts. Compare rebuilt `converted/*.glb` hashes with `final-report.json` to establish reproduction. `verified-models.json` records the committed verification output.

## Remaining before a playable tropical world

Design terrain, routes and obstacle placement; author collision shapes independently; validate alpha materials in the production scenery path; bound live texture/geometry ownership; create an immutable regional descriptor; verify actual flights and offline installation. These steps are not implied by asset conversion or a static preview.
