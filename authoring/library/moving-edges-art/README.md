# Moving Edges original reward artwork

Twelve distinct original panoramas accompany the three authored Moving Edges layout designs across FPV, Ukraine Atlas, 1994 Forever and Coupa themes. The untouched PNGs total 34,526,635 bytes; each is below the existing 4 MiB image limit. These are source artwork candidates. They add no runtime chapters, production approvals, layouts or release claims.

Open [the gallery](index.html) for the 384×192 review copies and original links. [The manifest](manifest.json) fixes each independently replaceable image; [provenance](provenance.json) records actual observations, prompt deviations and generation sources. [Prompts](prompts.json) retain every complete effective request and its hash. No input reference image or existing game asset was supplied to generation.

| Theme   | Layout cue        | Original                                                                    | Actual size |
| ------- | ----------------- | --------------------------------------------------------------------------- | ----------- |
| fpv     | terrace-stitch    | [The Hillside Flight Workshop](originals/terrace-stitch-fpv.png)            | 1774×887    |
| fpv     | survey-wheel      | [Signals around the Old Depot](originals/survey-wheel-fpv.png)              | 1774×887    |
| fpv     | breakwater-return | [The Coastal Watch Returns](originals/breakwater-return-fpv.png)            | 1774×887    |
| ukraine | terrace-stitch    | [Threads above the Mountain River](originals/terrace-stitch-ukraine.png)    | 1774×887    |
| ukraine | survey-wheel      | [The Potter's Spring Courtyard](originals/survey-wheel-ukraine.png)         | 1773×887    |
| ukraine | breakwater-return | [Boats beneath the Stone Lanterns](originals/breakwater-return-ukraine.png) | 1774×887    |
| retro   | terrace-stitch    | [Mixtapes on the Upper Walkways](originals/terrace-stitch-retro.png)        | 1774×887    |
| retro   | survey-wheel      | [The Last Saturday at the Rotunda](originals/survey-wheel-retro.png)        | 1774×887    |
| retro   | breakwater-return | [Summer's Last Lake Ferry](originals/breakwater-return-retro.png)           | 1774×887    |
| coupa   | terrace-stitch    | [The Shared Goods Terraces](originals/terrace-stitch-coupa.png)             | 1774×887    |
| coupa   | survey-wheel      | [The Repair Exchange Rotunda](originals/survey-wheel-coupa.png)             | 1774×887    |
| coupa   | breakwater-return | [The Harbor Maintenance Round](originals/breakwater-return-coupa.png)       | 1774×887    |

All requests specified 1774×887. Survey Wheel Ukraine actually returned **1773×887**; that original is preserved without adding a column or stretching it. The other eleven match the requested dimensions. The initial exact-size metadata refusal is retained in the authoring evidence. [The derivative recipe](derivatives.json) fits each full frame proportionally inside 384×192 on a dark matte, with no cropping or change to its original. The one-column difference leaves a subpixel margin in that review copy.

The [fixed layout cues](layout-briefs.json) are Terrace Stitch's unequal stepped terraces, Survey Wheel's off-center hub and separate spokes, and Breakwater Return's offset barriers and return cove. Perspective architecture and water suggest those decisions; they do not specify collision geometry, warning lanes or routes. The artwork creates zero additional layout families.

FPV uses Ukrainian drone crews, marked equipment and military/coastal watch settings without graphic violence. Ukraine Atlas draws on craft, textiles, pottery and boatbuilding; its invented architecture is not an exact historical reconstruction. Retro scenes use fictional CRTs, tapes, arcades and ferry culture. Coupa scenes show shared goods and repairs without depicting an actual product or asserting financial results. Several images contain larger foreground figures, incidental signs or more building volumes than requested; all deviations remain explicit in provenance. These scenic stills are not actor sprites or animation assets.

## Verify and replace an original

From the repository root, run:

```sh
node authoring/library/moving-edges-art/verify.mjs
```

The finite verifier reuses the unchanged RGB8 decoder: PNG chunk order and CRCs, bounded inflate, scanline reconstruction, decoded pixel hashes, exact dimensions and original hashes. It checks twelve distinct sources, complete prompt/output associations, the exact ordinary-file inventory, protected context, and JPEG header/hash identities. It does not execute the optional Canvas encoder during portable verification.

Initial receipt creation requires `--record --tool-originals`; it checks all twelve default tool copies and creates `verification.json` exclusively. Record mode cannot overwrite an existing receipt. The reusable [preview renderer](render-previews.mjs) accepts an absolute existing `@napi-rs/canvas` module and a new directory outside this source folder. It writes only declared review derivatives, decodes each produced JPEG, and records its RGBA hash. It never rewrites originals.

For a replacement, generate a new original under a new path and retain both source files. Update only the selected cell's prompt, tool result and provenance associations, then review its full frame and 384×192 copy. Rebuild the manifest pins and a fresh verification receipt as an explicit source revision. A later compiler must bind the exact chosen original to its own chapter owner with null stories; changing these art files alone does not change an installed, saved or first-earned picture. Keep historical manifests, original bytes and previous receipts available.

Visual inspection establishes source-art readability only. Partial reveal, runtime/native/device behavior, human enjoyment, animation and production approval remain separate work.
