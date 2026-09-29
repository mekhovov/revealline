# Poltava courtyard — separate revision 6 candidate

`poltava-revised.png` is a built-in image-generation **edit** of the project's
retained `community-art-cohort-v1/poltava-original.png`. The complete effective
prompt is in `poltava-revision-prompt.txt` and in `collection.json`. The output was
copied unchanged: no shell/Python image editing, resizing or cropping.

The requested 1152 × 576 size was not produced. The actual opaque RGB PNG is
**1774 × 887 (2:1), 2,825,101 bytes**, SHA-256
`6428a4d0f7d0e97c30cf565a68ae8bbc515c3de98343c34af2413cb200a5f07a`.
A native board image still needs a separate Asset Studio derivative. This source
fits the current 4 MiB per-file intake limit.

## Reference and observed correction

The [museum's Kuntseve house page](https://www.pyrohiv.com/exponat/khata-iz-sela-kuntseve),
inspected 2026-09-28, describes single-leaf shutters, four-pane windows, horse
motifs on projecting beam/upper-plate ends and unplastered logs at the entry front.
It is a **textual reference only**. No museum photograph was supplied, downloaded,
copied or traced; public access supplies no image reuse license.

The earlier candidate visibly had paired shutters and square rosette blocks.
The revised image shows one open full-width leaf beside each of its two visible
four-pane windows, small horse-head-profile beam ends in place of the rosettes,
and a timber doorway with exposed log walls in place of the open through-gateway.
The orchard, cart, baskets, quiet courtyard and overall framing remain.

These are observations of this generated candidate. The exact carving shapes,
floor plan and courtyard arrangement are original interpretations, not an exact
museum reconstruction or institution endorsement. Native pixel-grid cleanup,
cultural review, board-size actor contrast and production approval remain open.
The `pixel-art` medium is an author declaration, not proof of a consistent native
pixel grid. Nothing here supplies a mission binding or changes approved artwork.

## Import the new revision without replacing earlier files

This folder is the second source cohort; its collection revision is **6**, following
the earlier board-candidate packet's revision 5. `collection.json` retains all
seven previous artwork records and source declarations unchanged, then adds
`poltava-revised-r6` as a derivative of retained parent `poltava-original`.
Earlier board derivatives still contain the earlier architecture.

In Asset Studio → **Artwork collections · source candidates**, select these files
together in one import:

- This folder's `collection.json` and `poltava-revised.png`.
- The three original PNGs in `../community-art-cohort-v1/`.
- The four PNGs in `../community-art-cohort-v1/board-candidates-v1/`.

Select only the new collection JSON, not either earlier JSON. Payloads use stable
basenames, as required by the existing `.rlart` contract; they are deliberately
not duplicated here. Export `.rlart` in Studio to make a portable packet. The full
revision has eight artworks and 16,127,810 payload bytes, below the 16-file and
32 MiB packet limits. Reference URLs are not fetched by import.

`verification.json` records the individual byte/hash/header checks, unchanged
previous records, exact generated-output copy and strict model export/reimport.
Its Node dimension adapter reads PNG headers; that model check alone is not a
native browser decode or visual qualification.
