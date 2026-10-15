# Desert Expedition immutable delivery preparation

This delivery is built only from the exact final terrain and explicit-empty scenery manifests of the source study in PR #1378, commit `85ed2d3823d81c91d0f104a22f98c668d7beadff`. It depends on the opt-in 512 m capability in PR #1372. It contains no Library row and is not a qualified player release.

The delivery's `FPVRegionalDelivery.v2` descriptor lists every local payload by byte count and SHA-256. Both source manifests and every canonical GLB/collision asset are unchanged. The descriptor and all payload bytes together must remain within the existing 64 MiB limit. The descriptor is pinned separately; no unchecked external textures or model URLs are loaded.

The content is original analytic project artwork and collision geometry. No third-party model, texture or height map is included. The [source README](./README.md) records primary NPS design references and explains that this is a fictional composition, not a geographic reconstruction. No new third-party license is asserted for original content.

## Pinned delivery

- Descriptor: 327,361 bytes, SHA-256 `6ecb919762a9d3fac6519ca80600489cab0cb6b3cb3e0804d01d5f7e8791029d`.
- Payload: 2,050 files, 47,556,515 bytes.
- Whole delivery including descriptor: **47,883,876 bytes**, below the unchanged 67,108,864-byte limit.
- Terrain manifest SHA-256: `21c5b63e51a33c22ebd7ff22e05d92d6b91b00173fcc5d3c911bc530bb166468`.
- Sparse companion SHA-256: `4a3209477eca0b4aed8c961f1f9c7a36d2074ac0529b368536764e772c8a411a`.

The committed [delivery pin](./delivery-pin.json) is separate from the immutable payload. No metadata is inserted into the source manifests to change their hashes.

## Reproduce and check

```sh
node authoring/fpv-worlds/regions/prepare-delivery.mjs SOURCE NEW_OUTPUT desert-expedition-study natural-r1
node authoring/fpv-worlds/regions/desert-expedition/verify-desert-delivery.mjs NEW_OUTPUT
```

The source is the output of `prepare-desert.mjs`, including its `terrain` and `scenery` folders. Existing output directories are rejected. The verifier uses the committed descriptor pin, loads the full closed inventory through the production downloader and drives all six starts in both flight modes through the shared flight authority. Its source-only request adapter does not constitute native browser storage or offline acceptance.

## Verified copied-payload scope

[delivery-verification.json](./delivery-verification.json) records all 2,051 descriptor/payload responses passing the production downloader's byte/hash/closed-inventory checks. All six starts prepare disarmed in both self-level and Acro, then explicitly arm and climb for 200 shared-flight ticks each (2,400 ticks total). There are no contacts or scenery asset requests; each loaded window has 456,408 geometry bytes and zero texture bytes. Pause ignores further control input, and disposal returns geometry and scene roots to zero.

These checks use a local response adapter over the exact copied files. They do not claim a remote network download, native browser storage, offline install or art acceptance.

## Idle authoring review

An optional local review host is prepared separately from the deliverable. It serves the exact source commit and unchanged generated pair; it is not a release package. Start with the existing regional flight preview, select the terrain/scenery profile, then explicitly load and arm. The six source IDs are `crescent-dunes`, `dry-wash`, `salt-basin`, `sunrise-escarpment`, `mesa-corridor`, and `rocky-plain`. Native browser execution has not been performed for this delivery checkpoint.

## Material review from source

The current generic `plain` terrain material is olive. It does not communicate the designed desert landforms. Existing Canyon sediment can tint relief for an authoring comparison, but it does not distinguish the salt basin from dunes; Tropical grass/beach treatment is also inappropriate. Neither substitution is part of this delivery or a claim of finished art.

A focused subsequent appearance profile should:

- Distinguish warm dune sand, a pale matte playa and darker rock shoulders using the exact authored district masks in global coordinates. Preserve broad transitions and avoid one material change at every cell boundary.
- Keep directional fine sand detail subtle and distance-filtered. It must not imply narrow ridges, cracks or obstacles absent from the 16 m collision lattice.
- Retain clear dune and escarpment silhouettes with local roughness/colour variation; avoid regular horizontal bands, repeated tile patterns or excessive contrast in the flight corridor.
- Follow the existing Performance/Balanced/Quality contract, preserve geometry and collision byte identity, and use bounded procedural work with no additional downloaded textures in the initial slice.
- Apply only through an explicit trusted appearance mapping for this exact delivery identity/hash. Unknown revisions must retain plain presentation.

Native FPV readability, all six authored views, material quality tiers, release/reload, packaged/offline delivery, normal Library installation and target-device performance remain separate acceptance gates. Source coverage of 16.384 km does not assert uninterrupted whole-map native flight or a finished entertainment experience.
