---
name: xonix-asset-creator
description: 'Create, edit, vary, and prepare Xonix game artwork: reveal backgrounds, characters, enemies, sprite concepts, UI, capture effects, icons, galleries, and promotional images. Use for pixel, painterly, photographic, or graphic styles, theme variations, image-pack authoring, and production handoff from AI concepts.'
---

# Xonix Asset Creator

Create the requested art and a traceable handoff. Use the available image-generation/editing tool for imagery; follow its instructions. Do not silently replace image generation with programmatic drawing or invoke a paid API/CLI fallback without the user's authorization for that route.

For artwork applied to the playable `game/`, pair this workflow with [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md) and the [eight-role import guide](../../../docs/assets-and-configuration.md). The runtime's versioned playground image overrides accept bounded static PNG/JPEG/WebP, preserve source bytes and require successful browser decoding; custom player art keeps existing rig anchors. Draft asset metadata, texture-filtering wishes and generated sheets do not automatically configure that renderer.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

For supplied-image imports, optional styling and replaceable object skins, use [the Background Stylist workflow](../xonix-background-stylist/SKILL.md). Current FPV concepts use no Z markings; distinguish Ukrainian, hostile military and neutral subjects explicitly. The player direction is a practical FPV frame with propellers, battery and camera, with restrained blue/yellow accents.

For moving sprites, rotors, trails, capture effects or UI transitions, consult [Animation Director](../xonix-animation-director/SKILL.md). Separate replaceable components, define state timing and cancellation, and play the assembled result before claiming animation readiness. Measure occupied avatar pixels at play scale; shrinking the transparent canvas is not shrinking the silhouette. Art and motion never change colliders or movement rules.

For applying art to selectable or earned characters, use [Character Collection](../xonix-character-collection/SKILL.md) to preserve stable IDs, component bindings and eligibility. Inspect the actual switched visual after loading; a contact sheet or registered filename does not establish that the intended character paints correctly in the preview.

## Locate inputs

Find `authoring/CONTRACT.md` in the target workspace; if needed resolve this installed skill's physical directory to its parent kit. Read the target theme brief and relevant records in `prompts/catalog.json`. Use `python3 authoring/prompt.py list --family FAMILY` to choose a template, then `show ID` or `render ID --set key=value`. If the kit is absent, use [the handoff template](references/asset-handoff.md) without pretending to validate a pack.

## Execute

## Adapt templates to the request

Prompt-library wording is a starting point, not an instruction that overrides the user's chapter, medium, quantity, or approved design. Adapt those choices explicitly and record the effective prompt. Use the current schema's actual enum values: watercolor/gouache are `illustration` with their medium described in the art brief. Within the legacy draft-pack contract, keep unsupported medals, generation behavior and other primitives as proposals instead of inventing accepted fields; use the actual runtime contract for applied game work.

## Required output

Show the resulting art when available. Link the effective prompt and asset manifest. Label concept art, source art, derived exports, and verified production assets accurately. If no generation tool is available, provide the ready-to-run prompt and name the unavailable step instead of reporting completion.

## Apply authored chapter pictures

Use [authored-art.md](../../../docs/authored-art.md) and the separate [Homeward](../../library/homeward-skies/README.md) or [Equipment Workshop](../../library/equipment-workshop/README.md) source pipeline. Workshop 1.1.0 adds three selected 1448×1086 originals to existing maps; combined with Homeward the working edition has six authored pictures, not 29 unique paintings. Its source/header checks do not certify the still-pending browser or frozen-release review.

Keep each original PNG and complete effective prompt/provenance, then run the chapter's builder in default check mode. Explicit `--write` changes only its designated generated pack after source review. Use the image tool for corrections and retain a separate parent-linked output; do not resize, crop, recolor or recompress accepted images in a build script or image CLI. Record actual hashes/dimensions/bytes and enforce existing raw/encoded/pixel/pack budgets. Never raise limits to hide an oversized generation.

For this Workshop picture-only edition, preserve the exact old pack, change only semver and `levelVisuals`, and keep campaign/map/roster/definition identities and old proof bytes unchanged. Verify source-to-embedded bytes, full browser decode, actual partial-cut contrast, full rewards, reduced effects and gallery Replay. Observe an already collected picture adopting the installed art without another clear, score or seal; preserve old exported editions for reproducibility. Static backgrounds do not animate painted objects: existing actors and theme finale overlays supply motion independently.

## Deliver the completed feature

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. The current project request authorizes that sequence. Update the roadmap with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.

For registered enemy roles, optional travelling line impacts and theme-specific pickup/defeat feedback, read [enemy catalog](../../../docs/enemy-catalog.md) and [the R3 edition](../../library/fpv-arcade-r3/README.md). The [enemy workflow prompts](../../prompts/enemy-workflows.json) use actual interfaces. Preserve old identities, explicit authoring activation, local artwork provenance and measured input/visual evidence.
