# Canyon Expanse: immutable sparse delivery preparation

This preserves the original 8,192 × 8,192 m source from #1338 as a separately
versioned delivery bundle. It does not add a Library row or claim finished art,
native storage reliability, offline qualification or sustained device FPS.
The existing 384 m and 768 m Canyon revisions remain unchanged.

## Exact content

- Identity: `canyon-expanse-study`, revision `relief-r1`.
- Format: `FPVRegionalDelivery.v2`, using the explicit sparse companion contract
  from #1341. Every terrain cell remains mandatory.
- Descriptor: 329,372 bytes; SHA-256
  `d2c3dce6c39227e85a10256fb3d1082fec2a6c7a47f6347fd664e2840eb57003`.
- Payload: 2,050 files, 47,646,152 bytes. Including the descriptor: 47,975,524
  bytes, below the unchanged 64 MiB limit.
- Terrain manifest: SHA-256
  `74fbf90c62eafc79e2ba25a4375f5e1d5da5ec25b758da4b3c78cf64c95067d6`.
  Its 1,024 cells and 2,048 assets retain every accepted source byte.
- Scenery manifest: 49,672 bytes; SHA-256
  `688b6b655b584efb78438f4ab14f23b6b07971ef54c3f13cfed158afa1da4448`.
  All 1,024 matching cells explicitly declare empty scenery. There are no dummy
  triangles, hidden props, texture requests or external assets.

All relief is original analytic composition from `expanse-design.mjs`. No
third-party meshes or textures are redistributed in this revision. The source
proof and native review are in `fpv-canyon-expanse-source.md`; broad smooth slopes
and sparse rounded relief still need meaningful scenery and final art work.

## Verification

The published #1341 builder's eleven source-file hashes were checked against its
publication receipt before generating this new output directory. It validated
the complete dependency inventory before writing the immutable bundle.

The actual production downloader accepted all 2,051 responses, verified the
descriptor and dependency hashes, and retained the exact original terrain
manifest. Actual shared sessions then passed twelve authored-start, deliberate
climb, pause-invariance and disposal cases across both flight modes: 2,400 ticks,
zero contacts, 456,408 geometry bytes at each start, and zero scenery asset
requests. All sessions returned owned geometry to zero on disposal.

`verify-expanse-delivery.mjs` repeats these checks against the committed pin;
`expanse-delivery-verification.json` records the result. This uses the real
downloader and mixed geometry owner with controlled in-memory responses; it does
not substitute for browser IndexedDB or offline package tests. The source's
separate 24 terrain-route checks remain valid source evidence, not a claim that
every route was rerun through an installed sparse Library entry.

The complete verifier was repeated on coherent main
`293c2f256135bf5019c63628c80c83f11450a97f` with an identical receipt. Every
copied payload file was then checked against the descriptor: 2,050 matching
lengths and SHA-256 hashes, plus the exact descriptor length and hash.

## Remaining gates

The full native download/save/reload/first-flight path and exact packaged offline
qualification must pass before Library admission. The 2,050-file inventory also
needs measured request scheduling on the actual delivery host; source bytes alone
do not establish acceptable download time. Representative final art, meaningful
scenery composition and continuous whole-region flight remain open.
