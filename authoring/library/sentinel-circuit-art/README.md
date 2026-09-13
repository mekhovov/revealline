# Sentinel Circuit original panoramas

Three new static reward-picture candidates accompany the separate
[Sentinel Circuit](../sentinel-circuit/README.md) content proposal. They are original
built-in `image_gen` outputs, preserved as received. This folder does not bind them
to a pack, replace a default picture or publish them in a catalog.

| Candidate        | Scene and palette                                      | Original PNG                               |     Bytes |
| ---------------- | ------------------------------------------------------ | ------------------------------------------ | --------: |
| Listening Court  | Misty communications courtyard, cyan and moss green    | [Original](originals/listening-court.png)  | 2,948,372 |
| Switchyard Gates | Rail-supply yard, amber and burgundy shadows           | [Original](originals/switchyard-gates.png) | 2,933,729 |
| Open the Circuit | Mountain radar station, violet and warm service lights | [Original](originals/open-the-circuit.png) | 2,701,967 |

All three are 1,774 × 887 RGB PNGs, exactly 2:1 landscape, totaling 8,584,068 bytes.
Each fits the existing 4 MiB original-image limit. Their scenery is independent of
the missions' actual collision geometry. The Sentinel chapter has three missions;
its final boss has two schedules. These pictures add no game rules or stories.

The images use layered environmental detail, clear structural silhouettes and a
small Ukrainian FPV with restrained blue/yellow markings. Every returned image was
visually inspected. Listening Court separates mist, brick sheds and open passages;
Switchyard Gates uses rails and gantries; Open the Circuit contrasts a large inert
dish with a small drone and fine cable. No Z marking was observed on the Ukrainian
equipment, and no graphic injury or active combat is depicted. Rotors are stylized
in motion; exact blade mechanics are not certified. Tiny decorative marks on the
Switchyard battery are not readable instructions or branding.

## Provenance and verification

[Full prompts](prompts.json), [generation results](generation-results.json) and
[provenance](provenance.json) retain three independent generation calls, no reference
images, no edit calls, original tool paths, prompt SHA-256 values and image hashes.
The tool originals remain at their original locations, and the workspace PNGs are
byte-identical copies. No crop, resize, palette conversion or image re-encoding was
performed.

The [verifier](verify.mjs) reuses the unchanged bounded
[original PNG decoder](../four-worlds-chapters/verify-images.mjs). It checks every
PNG chunk CRC, complete RGB8 scanline decompression and filter, exact bytes/SHA-256,
dimensions, limits, prompt/result correspondence and protected source-context
pins. The [recorded result](verification.json) also pins these documents and the
verifier. From the repository root:

```sh
node authoring/library/sentinel-circuit-art/verify.mjs
```

The one-time recording command is `node authoring/library/sentinel-circuit-art/verify.mjs --record`;
it refuses to replace an existing result. Verification is read-only and does not
require the original tool output directory on another machine.

## Qualification boundary

These are reviewed source-art candidates. Actual partial-reveal contrast, moving
actor readability, browser/device decoding, pack bindings, managed storage,
offline behavior and public delivery remain later integration checks. No animation,
movie, audio or three-story completion is claimed. Military scenery is fictional
illustration, not equipment instructions or a reconstruction of real operations.
