# Variant record and handoff

Use this authoring record when inspecting source images or producing derived versions. It is a design/handoff record, not a claim that the content-pack schema accepts every field. Serialize only fields actually supported by the current contract when updating a pack.

## Preserve the relationship

Record a stable source asset ID and its original path/reference, provenance description, actual width/height and known medium. Keep the original unchanged. A checksum is useful for confirming this when local tools are available; do not invent one. Record whether the input came from the user, a licensed collection or a prior generated asset. Unknown rights/provenance remain unknown rather than being copied from the source image's appearance.

For every derived asset record:

| Field                                   | Required meaning                                                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID and parent asset ID            | A unique variant linked to the actual source; do not overwrite the parent ID.                                                                                        |
| Family/chapter and role                 | Reveal background, avatar skin, enemy skin, terrain visual, UI image or concept comparison.                                                                          |
| Mode                                    | Keep-source, overlay-only plan or requested derived styling.                                                                                                         |
| Requested change / preserved properties | The specific variation axes and the features that must survive.                                                                                                      |
| Prompt                                  | Template ID, substitutions and the complete effective text; record any adaptation.                                                                                   |
| Tool and references                     | Actual built-in tool route and supplied reference paths; do not list unexecuted tools as used.                                                                       |
| Output                                  | Actual saved path, format and measured width/height. Requested dimensions are recorded separately.                                                                   |
| Crop/focal plan                         | Original retained; separate derived crop or fit policy, with focal anchor and visible tradeoff.                                                                      |
| Sampling                                | Intended filtering and whether this belongs in a pixel atlas or a separate smooth texture.                                                                           |
| Allegiance, when relevant               | Ukrainian, hostile-military, neutral, or unconfirmed. Mixed scenes identify entities individually. This is authoring metadata, not an inferred game mechanic.        |
| Geometry contract                       | Existing collider/anchor/semantic role remains unchanged. If a design needs different behavior, record it as a separate extension proposal.                          |
| Review                                  | What was visually inspected, source fidelity, markings, readability, unresolved defects and next correction.                                                         |
| Readiness                               | Planned; generated concept; manually reviewed concept; or production asset with explicit evidence. Use the pack's actual status vocabulary only when registering it. |

## Inspect what matters for the role

For backgrounds, inspect the original composition, a small reveal window, an intermediate reveal with an active trail, and the complete gallery view. A generated comparison is a visual hypothesis; exact board geometry and usable touch targets require a rendered fixture. Full artwork in a gallery never implies that the player captured 100%.

For avatars and terrain skins, record the existing logical anchor and collider separately from visible pixels. A large drone silhouette may need different artwork margins while the collision footprint remains fixed. `X` or `^` can be neutral placeholders for a game object, not literal visual requirements or implied faction identifiers.

For current FPV FRONT assets, check every visible marking and decorative glyph: no Z symbols anywhere, including tiny background vehicles. Ukrainian equipment must not acquire hostile insignia. If a mixed scene becomes ambiguous, revise the affected derived image; do not quietly change its allegiance metadata to excuse the result.

For sprites or tiles, inspect actual transparency (including edge halos), equal frame dimensions, padding, pivots, orientation, frame order, timing and seams as applicable. A painted checkerboard is not transparency. Record not-tested for missing alpha/frame/animation checks. An attractive sheet cannot certify runtime readiness.

## Typical outcomes

- User supplies a photo and asks to use it: retain it, record its dimensions/focal plan, and propose a separate quiet overlay. Do not generate a pixel version unless requested.
- User requests three versions: preserve the source and create three named derivatives, each linked to the same parent. Compare the requested axes rather than unrelated compositions.
- User requests a drone skin for an `X` placeholder: read the placeholder's role and anchor, create the skin, and preserve collision/behavior. Record allegiance explicitly.
- Tool unavailable: save a ready-to-run brief with status planned and report that no image was generated.

## Applied still assignments

For an admin-uploaded reveal image, preserve original bytes and add an immutable presentation revision instead of changing the gameplay recipe. Record the exact authored campaign/map/revision/theme tuple and the actual runtime fit/sampling. The live attempt and its v3 save retain their selected revision; first-earned Collection is pinned separately from current assignments. Use [the live-picture guide](../../../../docs/flight-pictures.md) and [paired-recovery prompts](../../../prompts/media-presentation.md). Missing original recovery must not repaint a saved or earned picture with a generated substitute.
