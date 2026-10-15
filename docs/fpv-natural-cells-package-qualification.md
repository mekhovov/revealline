# Optional 512 m cells: exact package qualification

The optional package from PR #1372 at `cf9d2b3a9170ad6e240b1d29a486b7ef4afcd965` passed archive, import-closure and packaged runtime checks for the opt-in 512 m lattice and retained 256 m behavior. This capability receipt does not admit a new 16 km world or claim native performance, artwork or elapsed endurance.

## Frozen candidate

- Source tree `2888bfcfa8f22027941329e59512780173d25c15`.
- Cloud run `38690835423`; artifact `11952546795`; version `v0.151.1`.
- Package revision `bbe59367860ad2fdae36e556d1bc61a1b48978386d9379299af112019bec361a`.
- Artifact: 23,079,589 bytes, SHA-256 `df1a8008a340d4ccfd54d566423756738b1770d0f35101a58fea9fb58df3ec02`.
- Worlds ZIP: 17,480,246 bytes, SHA-256 `a10175874df979b9a67fb73698e9d2905e856ab4f4a11477810a786354d74793`.

All 15 top-level checksums and every member length, SHA-256 and exact inventory in all six runtime/source archives passed. The cloud receipt records two reproducible builds with committed inputs verified; `publicEligible` remains false. All 160 extracted Worlds runtime members remained byte-identical after the scenarios.

| Package | Runtime files / bytes | Source files / bytes | Existing limit |
| --- | --- | --- | --- |
| Civilian Flight | 94 / 3,741,611 | 96 / 3,775,165 | 96 files, 8 MiB |
| Academy | 101 / 6,754,958 | 103 / 6,790,022 | 104 files, 8 MiB |
| Worlds | 160 / 17,454,236 | 162 / 17,497,579 | 162 files, 20 MiB |

Exact-head finished-archive dependency validators passed Civilian Flight 68 modules / 96 imports, Academy 81 / 152 and Worlds 132 / 334, without source fallbacks. This candidate does not contain the separate Railway ground module addition; combined-head qualification remains distinct.

## Functional evidence

Exact published scenarios stayed outside the extracted archive. Imports were redirected to packaged modules, or used the existing authoring-only runtime-root option. Original/adapted fixture hashes are preserved; production bytes were not edited.

- Both 256 m and 512 m lattice scenarios passed complete global grid endpoint validation, exact local-origin limits for terrain/populated/explicitly empty scenery, unchanged vertex/index counts and normals, mixed-size rejection, six negative-coordinate windows, support and obstacle queries, cross-cell sweeps, atomic failed replacement and disposal.
- Actual shared flight in both modes required deliberate arm and respected pause. Continuous commanded flight accepted 4,013 ticks and three recentres for 256 m, and 7,636 ticks and three recentres for 512 m, all with zero contacts. These are accelerated functional runs, not real elapsed flight time.
- The full nine-cell coarse-window scenario passed diagonal X/Z adoption, retained staging, cancellation and retry. It reported 456,408 resident geometry bytes and 912,816 retained-plus-staged geometry bytes, a peak of 18 colliders and no scenery requests. Insufficient geometry and source budgets rejected before additional fetching and retained the old frame.
- Camera/bounds checks executed the exact authoring preview bounds callback with the packaged shared renderer/Three implementation. Resident ground centre and corners stayed within depth bounds for 128/256/512 m cells at far planes 900/1800/3600 m. This verifies the callback and shared projection behavior; it is not a native production-host visual review.

The 512 m lattice retains 33 × 33 height samples, so its 16 m spacing is suitable for broad terrain. Detailed gaps still require explicit scenery. Existing byte, texture, source and geometry budgets were not raised. Old source identities and scored World.v1 behavior were not rewritten.

## Preserved evidence and remaining acceptance

Candidate and raw receipts: `/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/natural-cells-cf9d2b3a`. Functional outputs are `wide-256-receipt.txt`, `wide-512-receipt.txt`, `coarse-window-receipt.json`, `bounds-receipt.json`, `fixture-receipt.json` and `runtime-integrity.json` under `functional-check`.

Native review, a complete authored world, its pinned delivery/Library journey and any combined later head remain separate gates. No browser tabs were touched while the independent uninterrupted endurance run was active. Previous package candidates remain preserved.
