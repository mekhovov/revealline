# Immutable Hillside Town source — town-r2

This draft closes the corrected 384 × 384 m Hillside Town source into the existing strict `FPVRegionalDelivery.v1` format. It does not add a Library entry or a runtime module. The parent source and native appearance review are still pending; source publication makes the exact revision reviewable without changing any accepted world.

The source recipe is `3dc619363d246f8cdc0ea8789e0692eb241159c3`. Both manifests and all 36 scene/collision payloads are copied byte-for-byte from the corrected `town-r2`, preserving terrain-conforming 4 m lattice roads, original Kenney palette/models and all source geometry. The earlier `town-r1` road defect and its negative receipt remain preserved separately.

- Descriptor: `delivery-town-r2/delivery.json`, 6,558 bytes, SHA256 `de1dc4726724bf4851e5976191585e04205f81ba3b83f14442e0c94f18b907d9`.
- Identity: `hillside-town-study`, revision `town-r2`.
- Closed inventory: 38 files / 8,352,486 bytes; descriptor plus inventory 8,359,044 bytes, below the existing 64 MiB delivery limit.
- Terrain manifest SHA256: `84d2e15d9931e6b71d11303d940bd67be8b12dd1c79cc6ed839e460596a34037`.
- Scenery manifest SHA256: `0d2f74e20cae601bf79dbcc4a5fa4819aadf4ee14c08eac59d43454848ea358a`.
- Palette and geometry residency remain unchanged: conservative full retained plus candidate bound 7,558,648 / 8,388,608 bytes.

`verify-delivery.mjs` runs the production downloader against the closed inventory, checks exactly 39 unique responses and all hashes, and builds the production regional session only from those verified bytes. Four starts × Self-level/Acro produce eight paused tick-zero sessions with zero input. Each rejects Arm before preparation, permits an explicit arm after preparation, flies a 200-tick climb without contacts, pauses and ignores subsequent control input. All resources release on disposal; a separate mixed-owner check confirms actual terrain/scenery collider owners also return to zero. No browser database is used by this check.

```sh
node authoring/fpv-worlds/regions/hillside-town/verify-delivery.mjs
```

The original [Kenney Building Kit](https://kenney.nl/assets/building-kit) is CC0. Its unmodified `License.txt` and exact provenance are adjacent to the descriptor for review; they are not additional runtime fetches. Selected original model bytes, the archive/member provenance and the source layout are preserved in the parent study. No competitor map was copied.

Remaining: native pilot-height source/road/material review, separate trusted Library admission, then exact package/offline qualification. This is a bounded original source study, not a completed large-city or representative final-art claim. No moving subjects, physics changes, new byte budget or elapsed-time/device performance claim are introduced.

The immutable descriptor is published at [commit0cdeca13](https://raw.githubusercontent.com/mekhovov/revealline/0cdeca133c5f0f10a3a0d1c2b8c8a2361ce8b8a1/authoring/fpv-worlds/regions/hillside-town/delivery-town-r2/delivery.json). The production downloader retrieved and verified all39 actual HTTP responses from that exact commit; the receipt is `remote-delivery-verification.json`. This is download integrity evidence, not a browser installation or Library admission.
