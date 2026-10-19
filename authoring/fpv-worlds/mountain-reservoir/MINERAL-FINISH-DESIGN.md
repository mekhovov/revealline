# Reservoir mineral finish — source study, not an admitted edition

Published r16 already includes measured grass/gravel, depth-safe retaining faces, rooted tree feet and closed maintenance identity. Its eight courses and sixteen demonstrations remain frozen. The preserved r12 rejection identified rounded repeating mineral/crack patterns; r13–16 accepted bounded interference, contact and facade fixes. Those receipts do not establish a finished representative world.

Saved r16 roof-approach and r15 overview captures still show broadly mottled mineral faces and ridges. This opt-in study tests quieter directional grain and sparse, softly shaded angular seams at the **existing UV scales**. The texture is original deterministic CC0 artwork. Marks are albedo only, with no dark holes, fake openings, relief, physical edges or new flyable area. Pixel measurements cannot establish whether this looks better in flight; matched native views must decide.

`--mineral-finish` builds the complete r16 foundation, then replaces only the existing 256×256 mineral image and explicit revision/generator provenance. Source/prepared positions, normals, UVs, accessors, material/sampler state, nodes and required coating capabilities remain exact. The other two image payloads remain exact. Counts stay at 12,260 imported triangles, 13 material owners, three maps (98,304 total image pixels), 60 nodes, 48 colliders and 108 collision triangles. No renderer, physics, course ID, spawn, route, requirement, binding or default Library change is included.

Candidate source is **1,217,048 bytes**, SHA256 `02e09aaf6dceacf4628f5ad918c7a964c9bc9b0b089fb0fc8455312bde38a758`, 17,600 below r16 and inside the unchanged 1.2 MiB target. Prepared GLB is **1,215,540 bytes**, SHA256 `845db7a0d0d92b3be0ff7a180af947d6827eea94616970f569aece7ef32f51de`. Validation has zero errors/warnings; the existing custom coating extension produces the established unsupported-extension informational notice and is separately preserved/validated by the importer contract. Static counts are not measured draw cost or FPS.

Candidate pack `52b5dcbc2be428bc5f7daabb280a03771c526696fb92fe80bbad82265cd4630a`, source/prepared GLBs, editable ZIP and project reproduce byte-for-byte on a second build. Baseline generation reproduces original r4 pack `4c4a0aba…` and complete r16 source/prepared/pack `2ab983dd…` / `6d7d829e…` / `50ffbb0e…` exactly. Earlier distributions, rejections, acceptances and proof files are unchanged.

The existing ordinary-controls qualifier passes **575 checks /16 fresh software completions** with independent complete and archive replays. Separate comparison to published r16 recordings/results finds every input, response/backend identity, physical result and sampled path exact. Only explicit course revision identity and resulting proof checksum change. Private candidate proofs stay external and unpublished; original r16 records are neither overwritten nor silently rebound.

## Reproduce externally

Use Node 22 and the existing pinned authoring dependencies. Output directories must be new; use an external build volume while the internal 3 GiB floor fails.

```sh
node authoring/fpv-worlds/mountain-reservoir/build-checkpoint.mjs NEW_R4_BASELINE
node authoring/fpv-worlds/mountain-reservoir/build-world.mjs NEW_R4_BASELINE/prepared NEW_R16_BASELINE --maintenance-inlays
node authoring/fpv-worlds/mountain-reservoir/build-world.mjs NEW_R4_BASELINE/prepared NEW_R17_CANDIDATE --mineral-finish
node authoring/fpv-worlds/mountain-reservoir/qualify-mineral-finish.mjs NEW_R16_BASELINE/mountain-reservoir-source.glb NEW_R17_CANDIDATE/mountain-reservoir-source.glb NEW_SOURCE_RECEIPT.json NEW_R16_BASELINE/prepared/project.json NEW_R17_CANDIDATE/prepared/project.json
node authoring/fpv-worlds/mountain-reservoir/qualify-mineral-finish.mjs NEW_R16_BASELINE/prepared/models/mountain-reservoir.glb NEW_R17_CANDIDATE/prepared/models/mountain-reservoir.glb NEW_PREPARED_RECEIPT.json NEW_R16_BASELINE/prepared/project.json NEW_R17_CANDIDATE/prepared/project.json --prepared
node authoring/fpv-worlds/mountain-reservoir/qualify-world.mjs NEW_R17_CANDIDATE/prepared/mountain-reservoir.r17.rlpack NEW_FUNCTIONAL_OUTPUT
node authoring/fpv-worlds/mountain-reservoir/qualify-mineral-finish-proof-parity.mjs authoring/fpv-worlds/mountain-reservoir/distribution/r16/mountain-reservoir.r16.proofs.json NEW_FUNCTIONAL_OUTPUT/mountain-reservoir-r17-proof-part-1-of-1.json authoring/fpv-worlds/mountain-reservoir/evidence/r16-qualification.json NEW_FUNCTIONAL_OUTPUT/qualification.json NEW_PROOF_PARITY_RECEIPT.json
```

Build, ownership/course parity, repeat, validator and functional/proof receipts are under `evidence/r17-mineral-*`. Before/after PNGs illustrate only the changed source image. The early unrendered brightness prototype and isolated sparse-dependency preparation failures are retained externally; no production gate was relaxed.

## Open gates

1. Root matched **low-pilot, terrace/ridge grazing, approach, chase and overview** before/after views in Low/Balanced/High and shared appearances. Inspect scale, angular marks versus false clearance cues, tiling/aliasing, terrain/terrace coherence and readable flight lines. No renderer has been opened for this candidate.
2. Exact qualified, unoverlaid player fixture and source/model identity, then observed rendering/resource disposal. Current evidence proves serialized tier ownership, not actual rendered tier quality or performance.
3. Protected source review and native appearance acceptance before promotion. A later immutable optional release, exact-player import/Watch, reload/offline/persistence and public verification are distinct. This Draft adds no distribution files, automatic download, catalogue entry or Library edition.
4. Broader Reservoir composition/shore/vegetation quality, representative-world acceptance, hardware and real-time endurance stay open. Reject the source study if it does not improve the matched flight views.
