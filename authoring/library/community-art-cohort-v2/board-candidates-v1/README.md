# Revised Poltava board derivative — revision 7 candidate

`poltava-revised-r6-wide-r7.png` was prepared through the actual Asset Studio
**Create board candidate** control in the in-app browser. It is a separate
1152 × 576 PNG derived from the retained 1774 × 887 revision 6 source with
**Fit whole picture** and nearest-pixel sampling. Both images are exactly 2:1:
the full source fills the full board image without cropping, stretching,
letterboxing or upscaling. No original file was edited.

The native PNG is **1,756,938 bytes**, SHA-256
`aaafaaca7ad1ee916ceeb04338690178a10314d6b735fcbe63fd565ec672ac30`.
The file here was extracted byte for byte from the actual browser download,
not recreated with a shell image tool. Native Canvas encoders can produce
different bytes in another browser; this hash identifies this exact output.

## Native export and independent byte verification

Studio exported `ukrainian-pixel-scenes-r7.rlart` to the user's Downloads folder.
The browser bridge's download event timed out, but the complete downloaded file
exists and passes strict packet import. Its **17,904,621 bytes** have SHA-256
`942580e3d25345f24ee83509d719a3f4033c77d878aabe82b28a127f4aec4967`.

Independent verification compared all eight earlier artwork records and PNG
payloads against revision 6 and its retained local originals. They are unchanged.
All previous collection and source declarations are unchanged except the
collection revision and appended ninth artwork. Strict export reproduces the
native packet byte for byte, and strict reimport retains all nine records and
payloads. `verification.json` records the checks and exact source hashes. The Node
dimension adapter reads PNG headers; native browser qualification is a separate
observation, not a claim made by that adapter.

The actual downloaded packet was then reimported through Studio in the in-app
browser. Selecting `poltava-revised-r6-wide-r7` showed **Verified file preview
ready**, the matching revision, hash, bytes and parent provenance, and a complete
1152 × 576 image. See the
[`native reimport screenshot`](../../../../docs/verification/actor-batch-12/poltava-native-r7-reimport.png).
Native intake, preparation, export and reimport are complete; the download bridge
timeout did not prevent the product export.

The earlier worker's Chrome bridge limitations are retained in
[`native-artwork-browser-attempt.json`](../../../../docs/verification/actor-batch-12/native-artwork-browser-attempt.json).
They occurred before import and did not establish a Studio defect. The successful
in-app-browser preparation is shown in
[`poltava-native-r7-offered.png`](../../../../docs/verification/actor-batch-12/poltava-native-r7-offered.png).

## Import without duplicating earlier images

`collection.json` is the complete revision 7 metadata. To import it through
Asset Studio → **Artwork collections · source candidates**, select together:

- This folder's `collection.json` and new PNG.
- `../poltava-revised.png` from revision 6.
- The three original PNGs in `../../community-art-cohort-v1/`.
- The four PNGs in `../../community-art-cohort-v1/board-candidates-v1/`.

Choose only this collection JSON. Earlier images keep their stable basenames and
are deliberately not duplicated here. The collection has nine images and
17,884,748 payload bytes, within the current 16-image, 4 MiB per-image and 32 MiB
payload limits. Export `.rlart` makes a portable packet including all images.

## Provenance and remaining review

The derivative records parent `poltava-revised-r6`, the exact source and
destination rectangles, nearest sampling and `native-canvas-png` encoding.
Its retained parent chain leads to the original generated scene and full revision
prompt. The Pyrohiv Kuntseve reference remains textual and reference-only; no
museum photograph pixels were incorporated and no museum endorsement is claimed.

At native board size the revised single-leaf shutters, four-pane windows,
timber entrance and small shaped beam ends remain visible. The detailed foliage,
thatch and ground still use uneven fine pixel clusters. Resizing does not provide
deliberate pixel-grid cleanup or validate the cultural interpretation. Carving
profiles, architecture and courtyard arrangement remain original interpretations,
not a museum reconstruction. Cultural review, native-size actor and overlay
contrast, and separate production approval remain open. This source candidate
has no published mission or runtime binding.
