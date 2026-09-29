# FPV Versus and Team artwork — 29 September 2026

This bounded Phase 5 batch adds actual mode compositions for the FPV base world. Solo's approved landscape/portrait files remain unchanged. Versus has opposing amber/cyan drones on separate launch stands; Team has matching, aligned drones connected to one preparation dock. Each has a separately composed portrait original. These arrangements are part of the painting, not tint/zoom changes or generic floating overlays.

## Source and runtime assets

All four originals were generated with the built-in OpenAI `image_gen` tool and visually inspected. The Solo art provided style references; the landscape mode images and Solo portrait then provided references for the new tall compositions. Original PNGs, full prompts, reference roles and exact source/reference hashes are retained in `authoring/library/menu-scenes/fpv-mode-prompts.json`. No original was cropped, resized or retouched by the encoding step.

| Composition      | Original PNG                                               | Lossless runtime WebP                              | Dimensions | Runtime bytes |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------- | ---------- | ------------- |
| Versus landscape | `authoring/library/menu-scenes/fpv-versus-v1.png`          | `game/ui/art/menu-scenes/fpv-versus.webp`          | 1536×1024  | 286,552       |
| Versus portrait  | `authoring/library/menu-scenes/fpv-versus-portrait-v1.png` | `game/ui/art/menu-scenes/fpv-versus-portrait.webp` | 941×1672   | 285,890       |
| Team landscape   | `authoring/library/menu-scenes/fpv-team-v1.png`            | `game/ui/art/menu-scenes/fpv-team.webp`            | 1536×1024  | 361,554       |
| Team portrait    | `authoring/library/menu-scenes/fpv-team-portrait-v1.png`   | `game/ui/art/menu-scenes/fpv-team-portrait.webp`   | 941×1672   | 293,974       |

The existing preparation pipeline now accepts repeated `--only` IDs so this batch encodes its new files without rewriting old artwork. All four passed decoded RGBA equality against the original. Provenance and the shared runtime asset ledger bind their exact bytes; their source group records the original generated project artwork and prompts. `node scripts/check-edition-source.mjs .` verified the source admission with 175 assets during this batch.

## Behavior and automated checks

The theme catalog remains at 18 identities. A nested FPV composition map selects Versus/Team without changing gameplay, saves or theme IDs. The host forwards its existing mode, keeps one image/renderer and stationary controls, resets receiver sampling only when image bytes change, and retains stable profile identity on repeated updates. Edition contexts force Solo; standalone compilation removes the composition map and excludes the four extra images. The other three base worlds retain their existing artwork pending their own authored mode batch.

Measured source-coordinate regions animate cloud wisps, existing lamps, orchard foliage and sunlight. Drone bodies and blades are not independently rigged or rotated. Reduced motion and animation-off retain the selected static composition. Existing hidden/gameplay/dialog pause, fallback, context loss and cleanup behavior are unchanged.

Focused scene/renderer/receiver/edition suite: **59/59 passed**. It includes six viewport crops for 17 animated base profiles plus two FPV mode profiles (**114 combinations**), source/prompt/reference hash verification, output byte limits, stable mode fallback, host mode inheritance, orientation/source changes without duplicate owners or focus changes, and all 14 Solo edition projections excluding mode resources. Actual public offline selection includes all four new images. Scoped ESLint, formatting and diff whitespace checks passed.

## In-app browser evidence

The parent thread visually reviewed all four generated rasters and ran `game/test/manual/portrait-motion-check.html?suite=fpv` against the source server on port 8983. The fixture rendered the production host/shader in one iframe at a time and returned **4/4 passed**, with pause and reduced-motion checks true for every composition. Landscape frames were 1280×800; portrait frames were 390×844.

The following are measurements transcribed from the fixture's observed DOM report, not a saved raw screenshot or framebuffer file. Pixel pairs were sampled about two seconds apart from the production WebGL output, limited to fully weighted source regions inside the final viewport crop. CSS entrance scaling, readability shade and receiver effects are absent from this buffer and cannot cause these differences.

| Composition      | Region   | Changed / sampled pixels | Mean absolute RGB difference (0–255) |
| ---------------- | -------- | ------------------------ | ------------------------------------ |
| Versus landscape | Lamp     | 1,798 / 1,798            | 9.153                                |
| Versus landscape | Clouds   | 22,608 / 23,940          | 4.457                                |
| Versus landscape | Foliage  | 14,418 / 14,688          | 20.758                               |
| Versus landscape | Sunlight | 8,533 / 8,533            | 4.741                                |
| Versus portrait  | Lamp     | 1,540 / 1,540            | 9.756                                |
| Versus portrait  | Clouds   | 7,787 / 8,342            | 4.601                                |
| Versus portrait  | Foliage  | 1,363 / 1,408            | 14.139                               |
| Versus portrait  | Sunlight | 7,750 / 7,888            | 5.113                                |
| Team landscape   | Lamp     | 1,449 / 1,449            | 7.305                                |
| Team landscape   | Clouds   | 18,429 / 19,224          | 4.381                                |
| Team landscape   | Foliage  | 14,255 / 14,580          | 22.832                               |
| Team landscape   | Sunlight | 6,268 / 6,313            | 4.592                                |
| Team portrait    | Lamp     | 348 / 348                | 8.824                                |
| Team portrait    | Clouds   | 3,083 / 3,201            | 4.680                                |
| Team portrait    | Foliage  | 6,648 / 7,020            | 13.762                               |
| Team portrait    | Sunlight | 4,107 / 4,118            | 3.425                                |

Actual landing-host checks also passed in the in-app browser. `/game/couch/` at 1280×800 displayed `fpv-versus.webp` through WebGL with the minimal Ukrainian menu. Keyboard Up/Right/Confirm selected Team and navigated to `/game/couch/relay-rescue.html`, which displayed `fpv-team.webp`. Resizing that actual Team host to 390×844 selected `fpv-team-portrait.webp`, retained WebGL and kept all controls within the viewport (`scrollWidth=390`, `scrollHeight=844`).

An independent read-only packaging review verified all four WebPs in the actual default `collectBuildFiles` result, checked their exact ledger sizes and SHA-256 hashes, and confirmed that `selectOfflineCore` retains all four. All 14 edition resource projections exclude them. This was a bounded closure check, not a full distribution build.

Verified source SHA-256 values:

- `game/ui/menu-scene-catalog.mjs`: `7bedf849365bd1fc211d3bd0f7de71eaf779278974faa2a0b459d087e769c639`
- `game/ui/menu-scenes.mjs`: `d288b3b0450848f89ce482cc7d94dbfc68038c7116d9e182d61184c9175956c1`
- `game/test/manual/portrait-motion-check.mjs`: `80f435ca2efadfbd59020eab91f8749da3c9b461874e9b9b3e3b546db5b3c35d`

These source checks do not constitute physical-controller, phone GPU/memory, long-session animation comfort or published-release acceptance. Ukraine, Retro and Coupa mode compositions remain explicitly outside this batch.
