# Real-world Studio reference — revision 1

`synevyr-rafts.jpg` is an optional, locally bundled reference for the Content
Studio image workbench. Selecting it loads an authoring underlay. It does not
create collision geometry, apply queued rectangles, replace a gameplay picture,
or fetch from an external website at runtime.

## Provenance

- Title: **Rafts on Synevyr Lake** (`Synevyr Lake rafts.jpg`).
- Photographer: **Jan Pešula**, Wikimedia Commons user **Sapfan**.
- Date of photograph: **18 June 2018**.
- Subject: two wooden rafts on Synevyr Lake, Ukraine; calm water, reflected trees,
  diagonal oars and the near shoreline. This is a close view of the rafts, not a
  mountain panorama.
- Source: the photographer's own-work upload on
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Synevyr_Lake_rafts.jpg).
- [Source record revision checked 2026-09-28](https://commons.wikimedia.org/w/index.php?title=File:Synevyr_Lake_rafts.jpg&oldid=1197575995).
- [Original JPEG](https://upload.wikimedia.org/wikipedia/commons/0/01/Synevyr_Lake_rafts.jpg),
  5312 × 2988 pixels, listed as 4.38 MB on the record.
- [Exact 960 × 540 JPEG rendition acquired](https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/Synevyr_Lake_rafts.jpg/960px-Synevyr_Lake_rafts.jpg).
- Bundled length: **124,649 bytes**.
- Bundled SHA-256:
  `3ca8b4caf48a016e2e9c59afb8bcce45d5e93451a82496f099b644fe37837de8`.
- Bundled MIME type and dimensions: **image/jpeg, 960 × 540 pixels**.
- The bundled file preserves the acquired rendition bytes; the rendition is a
  resized version of the original photograph.

## License and credit

The file's own Licensing section records the photographer's
[CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/deed.en).
This is the photograph's license, not a conclusion drawn from the separate CC0
license for Wikimedia's structured metadata. CC0 permits copying, modification
and redistribution, including commercial use, without required attribution.

Voluntary credit: **Rafts on Synevyr Lake — Jan Pešula, 2018, CC0 1.0; resized
rendition from Wikimedia Commons.** No photographer or Wikimedia endorsement is
claimed.

## Admission boundary

`game/studio/real-world-reference.mjs` pins the local path, exact length, SHA-256,
MIME type and dimensions. It bounds the streamed response, rejects redirects and
wrong media types, and verifies the hash before returning a file. The existing
image-reference loader then validates JPEG headers and decoded dimensions before
the workbench accepts it. A failed or stale load cannot replace an accepted
reference or grant Apply permission.

The explicit Load and Download actions use `cache: no-store` for this local
tooling asset; they do not install an offline gameplay package or bypass any
package pin. Download uses the same verified bytes and a temporary blob URL,
without replacing the accepted reference. Closing the workbench aborts a pending
download, removes its listeners and releases its blob URL. No photo is fetched
eagerly.
