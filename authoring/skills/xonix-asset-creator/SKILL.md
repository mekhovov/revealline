---
name: xonix-asset-creator
description: "Create, edit, vary, and prepare Xonix game artwork: reveal backgrounds, characters, enemies, sprite concepts, UI, capture effects, icons, galleries, and promotional images. Use for pixel, painterly, photographic, or graphic styles, theme variations, image-pack authoring, and production handoff from AI concepts."
---

# Xonix Asset Creator

Create the requested art and a traceable handoff. Use the available image-generation/editing tool for imagery; follow its instructions. Do not silently replace image generation with programmatic drawing or invoke a paid API/CLI fallback without the user's authorization for that route.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

For supplied-image imports, optional styling and replaceable object skins, use [the Background Stylist workflow](../xonix-background-stylist/SKILL.md). Current FPV concepts use no Z markings; distinguish Ukrainian, hostile military and neutral subjects explicitly. The player direction is a practical FPV frame with propellers, battery and camera, with restrained blue/yellow accents.

For moving sprites, rotors, trails, capture effects or UI transitions, consult [Animation Director](../xonix-animation-director/SKILL.md). Separate replaceable components, define state timing and cancellation, and play the assembled result before claiming animation readiness. Measure occupied avatar pixels at play scale; shrinking the transparent canvas is not shrinking the silhouette. Art and motion never change colliders or movement rules.

For applying art to selectable or earned characters, use [Character Collection](../xonix-character-collection/SKILL.md) to preserve stable IDs, component bindings and eligibility. Inspect the actual switched visual after loading; a contact sheet or registered filename does not establish that the intended character paints correctly in the preview.

## Locate inputs

Find `authoring/CONTRACT.md` in the target workspace; if needed resolve this installed skill's physical directory to its parent kit. Read the target theme brief and relevant records in `prompts/catalog.json`. Use `python3 authoring/prompt.py list --family FAMILY` to choose a template, then `show ID` or `render ID --set key=value`. If the kit is absent, use [the handoff template](references/asset-handoff.md) without pretending to validate a pack.

## Execute

## Adapt templates to the request

Prompt-library wording is a starting point, not an instruction that overrides the user's chapter, medium, quantity, or approved design. Adapt those choices explicitly and record the effective prompt. Use the current schema's actual enum values: watercolor/gouache are `illustration` with their medium described in the art brief. Keep unimplemented medals, generators, and behaviors as proposals instead of inventing accepted fields.

## Required output

Show the resulting art when available. Link the effective prompt and asset manifest. Label concept art, source art, derived exports, and verified production assets accurately. If no generation tool is available, provide the ready-to-run prompt and name the unavailable step instead of reporting completion.
