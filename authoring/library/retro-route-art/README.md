# 1994 Forever — Route Choices art candidates

Three original reward illustrations extend the Route Choices theme catalogue. The built-in image-generation tool created each image separately from the complete prompts in [prompts.json](prompts.json). The original PNG bytes are preserved. These are reviewed static source candidates; they are not installed campaign maps or finished animations.

| Candidate                                            | Proposed visual role                                                   | Future story idea                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Midnight Workshop](originals/midnight-workshop.png) | Two routes around a central repair bench; old CRTs and arcade machines | CRT wakes, the small maintenance robot delivers its repaired board, then lamps settle on this frame  |
| [Crosswind Courier](originals/crosswind-courier.png) | Diagonal rooftop path to a record shop                                 | Courier arrives, a record turns, an elevated train crosses the distant city, then this frame returns |
| [Signal Thread](originals/signal-thread.png)         | A visible cable path connecting a sheltered signal room                | Radio lights answer, the rain passes across the window and the night train departs                   |

Use dark navy/indigo shapes, warm amber practical lights, restrained cyan/magenta accents, crisp pixel clusters and stepped edges for related assets. The scenes are fictional nostalgia, not reconstructions of real equipment or an existing commercial game's artwork. Some small signs contain decorative pseudo-lettering despite the no-text prompt; no readable text, logo or gameplay instruction depends on them. Future overlays must use real accessible text.

The parent agent inspected all three complete images. Full partial-reveal contrast, actor readability and physical display review remain before runtime adoption. The third scene's people are larger than the prompt requested, but the cable, desk and window still give a clear environmental composition. Keep these images separate from collision geometry and stored campaign identity.

Run the unchanged bounded PNG decoder and source-byte verifier:

```sh
node authoring/library/retro-route-art/verify.mjs
```

[provenance.json](provenance.json) records hashes, actual dimensions, roles and visual limitations. [generation-results.json](generation-results.json) retains original tool paths. [verification.json](verification.json) binds the source originals and helper. Regeneration uses a new sibling revision; never overwrite an earned or saved asset. Follow the [asset skill](../../skills/xonix-asset-creator/SKILL.md) and [feature delivery workflow](../../../docs/feature-delivery-workflow.md) when packaging.

Runtime integration follows exact-original external chapter installation. It must stay within the existing 48 MiB installed-pack and 256 MiB managed-media budgets, retain all original bytes and saved/earned pins, and remain an explicit optional download. Three static pictures do not count as three new layouts, three victory stories, or completion of the 116-picture target.
