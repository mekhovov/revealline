# Fracture Lines original reveal pictures

Three static source-art candidates for the separate Fracture Lines chapter. Each
PNG is an unchanged built-in `image_gen` output; full prompts, tool paths, output
hints, hashes and the author's observations remain in the individual metadata.
This batch does not install pictures or count the campaign as complete.

| Candidate                                            | Scene                                                    | Original bytes | Metadata                                          |
| ---------------------------------------------------- | -------------------------------------------------------- | -------------: | ------------------------------------------------- |
| [Split Ring](originals/split-ring-fpv.png)           | Broken grain-depot wall, gold dawn and a blue-roof house |      2,922,125 | [Prompt and provenance](split-ring-fpv.json)      |
| [Fault Fan](originals/fault-fan-fpv.png)             | Angular maintenance bays, blue-hour rain and amber lamps |      2,796,382 | [Prompt and provenance](fault-fan-fpv.json)       |
| [Frayed Causeway](originals/frayed-causeway-fpv.png) | Industrial islands, broken roadway and quiet teal water  |      2,938,361 | [Prompt and provenance](frayed-causeway-fpv.json) |

All three images are **1,774 × 887**, exactly 2:1, totaling **8,656,868 bytes**.
Each original remains below the existing **4 MiB** asset limit and within the
1,920 × 1,080 poster bounds. No crop, resize, palette change or re-encoding was made.

Independent visual inspection found distinct structural silhouettes and palettes,
small blue/yellow markings on the foreground FPV equipment, and static military
aftermath scenery. No Z marking, graphic injury, HUD or readable operational text
was observed. The foreground drones are prominent, especially in Split Ring and
Frayed Causeway, despite the prompts requesting small secondary subjects. Tiny
decorative equipment marks and stylized propeller shapes are not certified text,
branding or a mechanically accurate animation rig. Painted walls, islands and
vehicles do not define collision geometry or live actors.

## Verification

The [verifier](verify.mjs) uses the unchanged
[bounded original PNG decoder](../four-worlds-chapters/verify-images.mjs) to check
every chunk CRC, complete non-interlaced RGB8 decompression and scanline filter,
exact bytes and SHA-256, dimensions, full prompts, finite metadata/path inventory
and current image limits. The [recorded result](verification.json) pins all source
files and decoded pixel hashes. From the repository root:

```sh
node authoring/library/fracture-lines-art/verify.mjs
```

Portable verification does not require another machine's original tool directory.
Add `--tool-originals` to recheck all three local default outputs byte for byte.
The initial recording command requires both `--record --tool-originals` and refuses
to overwrite an existing result. The original tool files remain untouched.

Runtime ownership, partial-reveal contrast, moving-actor readability, native
browser decoding, gameplay fit, storage, offline delivery and device checks remain
separate. These fictional scenes are not real operational locations or historical
reconstructions. They add no video, audio, rotor animation or completed campaign.
