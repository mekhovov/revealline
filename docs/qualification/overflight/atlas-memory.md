# Static Overflight image memory inventory

[The source-bound inventory](atlas-memory.json) records the default
`field-kit@104` manifest and verifies all 33 admitted compressed image files.
It was produced without decoding images, allocating a renderer, inspecting the
live browser, or interrupting the ongoing trial. Its source bindings were refreshed
after input and enemy-role cue changes; all 33 original PNG identities and
dimensions were rechecked. Role cues reuse the existing atlas frames and textures.

| Owner/category | Nominal bytes | Interpretation |
| --- | ---: | --- |
| Two Overflight textures | 5,533,504 | Base RGBA8 texels; no mipmaps requested. Not total GPU allocation. |
| Two retained atlas/ground canvases | 5,533,504 | Kept for context restoration; dimensions zeroed on destruction. Actual CPU/GPU placement is browser-dependent. |
| Shared board originals | 260,096 | 33 distinct images after SHA-256 deduplication: 24 actor slots plus 9 terrain/pickup slots. No cropped views in this manifest. |
| Conditional appearance-derived Scout | 16,384 | One 64×64 canvas under untouched industrial-workshop defaults. Actual session selection/cache was not measured. |
| Preparation scratch canvas | 16,384 | 64×64; dimensions zeroed before atlas preparation returns. Decoder/ImageData/backend transients remain separate. |
| Compressed board image input | 11,425 | Verified loading payload. Steady-state compressed retention is unknown. |
| One 960×540 RGBA8 color surface | 2,073,600 | Per-surface arithmetic only; surface count, depth/stencil, compositor copies and driver allocation are unknown. |

The board host retains the full admitted source inventory even though the atlas
uses the Scout image and paints native enemy poses procedurally. The manifest's
1,264,907-byte UTF-8 file size is recorded separately; it does not measure the
retained parsed metadata heap. Historical manifests are not loaded by this
un-pinned default host.

Native actor descriptors, catalogue maps and paint-metric caches have no measured
heap total. HUD/card canvases, selected appearance variants, Phaser internal
textures/buffers, behavior-cue pool objects, review recording buffers, audio,
browser caches and driver allocations are also outside
this static inventory. Do not add these nominal ownership categories and call
the result resident system or GPU memory. Actual heap/GPU qualification remains
open.
