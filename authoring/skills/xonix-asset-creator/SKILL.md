---
name: xonix-asset-creator
description: "Create, edit, vary, and prepare Xonix game artwork: reveal backgrounds, characters, enemies, sprite concepts, UI, capture effects, icons, galleries, and promotional images. Use for pixel, painterly, photographic, or graphic styles, theme variations, image-pack authoring, and production handoff from AI concepts."
---

# Xonix Asset Creator

Create the requested art and a traceable handoff. Use the available image-generation/editing tool for imagery; follow its instructions. Do not silently replace image generation with programmatic drawing or invoke a paid API/CLI fallback without the user's authorization for that route.

For artwork applied to the playable `game/`, pair this workflow with [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md) and the [eight-role import guide](../../../docs/assets-and-configuration.md). Its `xonix-playground.v1` image overrides accept bounded static PNG/JPEG/WebP, preserve source bytes and require successful browser decoding; custom player art keeps existing rig anchors. Draft asset metadata, texture-filtering wishes and generated sheets do not automatically configure that renderer.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

For supplied-image imports, optional styling and replaceable object skins, use [the Background Stylist workflow](../xonix-background-stylist/SKILL.md). Current FPV concepts use no Z markings; distinguish Ukrainian, hostile military and neutral subjects explicitly. The player direction is a practical FPV frame with propellers, battery and camera, with restrained blue/yellow accents.

For moving sprites, rotors, trails, capture effects or UI transitions, consult [Animation Director](../xonix-animation-director/SKILL.md). Separate replaceable components, define state timing and cancellation, and play the assembled result before claiming animation readiness. Measure occupied avatar pixels at play scale; shrinking the transparent canvas is not shrinking the silhouette. Art and motion never change colliders or movement rules.

For applying art to selectable or earned characters, use [Character Collection](../xonix-character-collection/SKILL.md) to preserve stable IDs, component bindings and eligibility. Inspect the actual switched visual after loading; a contact sheet or registered filename does not establish that the intended character paints correctly in the preview.

## Locate inputs

Find `authoring/CONTRACT.md` in the target workspace; if needed resolve this installed skill's physical directory to its parent kit. Read the target theme brief and relevant records in `prompts/catalog.json`. Use `python3 authoring/prompt.py list --family FAMILY` to choose a template, then `show ID` or `render ID --set key=value`. If the kit is absent, use [the handoff template](references/asset-handoff.md) without pretending to validate a pack.

## Execute

1. Identify the role: reveal artwork, player, enemy, UI, effect, or marketing. Read intended dimensions, camera/view, frame scale, palette, and references. Preserve the difference between source-art size, runtime texture size, and gameplay cell coordinates.
2. Inspect every supplied/local image being edited before the edit. Preserve reference provenance. Use the image tool's supported reference mechanism; ask for reattachment only when a required reference is inaccessible. Without a verified character sheet, call a new mascot a concept, not an exact Navi reproduction.
3. Select and fill a prompt; record its ID, substitutions, full effective text, references, tool route, and output paths. Generate meaningful variations along one or two named axes such as daylight, regional motif, medium, or silhouette. Keep the rest consistent so the user can compare them.
4. Generate or edit the art directly within scope. Keep military reveal subjects consistent with the requested FPV theme; keep illustrated subjects distinct from active threat indicators. For Ukrainian traditions and branded work, verify unfamiliar specifics with primary references before claiming authenticity.
5. Preserve source images. Propose separate derived exports for each target; never destructively pixelate all media. Pixel sprite atlases need nearest filtering; smooth paintings/photographs belong in separate textures using their intended filtering. An atlas cannot assign a different filter to each frame.
6. Inspect the resulting image. Assess focal subjects under partial reveal, quiet regions behind HUD, active-trail contrast, silhouette size, and whether the requested medium survived. Correct a substantive mismatch through the image tool. Do not certify exact arena geometry or touch usability from generated concept art.
7. For sprites, distinguish an attractive sprite-sheet illustration from an inspected production sheet. Check equal frame cells, alpha, padding, consistent pivot, frame ordering, animation tags and timing. Use Aseprite's documented export pipeline when available and useful. Do not claim animation works until the frames were inspected and played or rendered.
8. Save the asset handoff. Register media with planned/ready status according to the contract's actual checks, not the generator's confidence. Run pack validation if a pack changed; report visual review separately from file/schema checks.

## Adapt templates to the request

Prompt-library wording is a starting point, not an instruction that overrides the user's chapter, medium, quantity, or approved design. Adapt those choices explicitly and record the effective prompt. Use the current schema's actual enum values: watercolor/gouache are `illustration` with their medium described in the art brief. Within the legacy draft-pack contract, keep unsupported medals, generation behavior and other primitives as proposals instead of inventing accepted fields; use the actual runtime contract for applied game work.

## Required output

Show the resulting art when available. Link the effective prompt and asset manifest. Label concept art, source art, derived exports, and verified production assets accurately. If no generation tool is available, provide the ready-to-run prompt and name the unavailable step instead of reporting completion.
