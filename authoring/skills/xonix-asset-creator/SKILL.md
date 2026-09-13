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

## Apply authored chapter pictures

Use [authored-art.md](../../../docs/authored-art.md) and the separate [Homeward](../../library/homeward-skies/README.md) or [Equipment Workshop](../../library/equipment-workshop/README.md) source pipeline. Workshop 1.1.0 adds three selected 1448×1086 originals to existing maps; combined with Homeward the working edition has six authored pictures, not 29 unique paintings. Its source/header checks do not certify the still-pending browser or frozen-release review.

Keep each original PNG and complete effective prompt/provenance, then run the chapter's builder in default check mode. Explicit `--write` changes only its designated generated pack after source review. Use the image tool for corrections and retain a separate parent-linked output; do not resize, crop, recolor or recompress accepted images in a build script or image CLI. Record actual hashes/dimensions/bytes and enforce existing raw/encoded/pixel/pack budgets. Never raise limits to hide an oversized generation.

For this Workshop picture-only edition, preserve the exact old pack, change only semver and `levelVisuals`, and keep campaign/map/roster/definition identities and old proof bytes unchanged. Verify source-to-embedded bytes, full browser decode, actual partial-cut contrast, full rewards, reduced effects and gallery Replay. Observe an already collected picture adopting the installed art without another clear, score or seal; preserve old exported editions for reproducibility. Static backgrounds do not animate painted objects: existing actors and theme finale overlays supply motion independently.

## Deliver the completed feature

For the isolated [still-picture identity foundation](../../../docs/media-presentation.md), use [these prose requests](../../prompts/media-presentation.md). Prepare original PNG/JPEG bytes with bounded headers, successful real decoding and SHA-256, then bind explicit map/theme tuples through the verified execution catalog. Keep immutable asset IDs and presentation revisions outside level/campaign/profile/replay data. A validated record is not installed artwork: host adoption, storage migration, complete bundles and production/browser checks are separate. Current presentations require `story:null`; preserve final-frame/full-story intent as a future contract, not invented fields. No generated source folder is automatically included in the runtime.

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. The current project request authorizes that sequence. Update the roadmap with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.

For registered enemy roles, optional travelling line impacts and theme-specific pickup/defeat feedback, read [enemy catalog](../../../docs/enemy-catalog.md) and [the R3 edition](../../library/fpv-arcade-r3/README.md). The [enemy workflow prompts](../../prompts/enemy-workflows.json) use actual interfaces. Preserve old identities, explicit authoring activation, local artwork provenance and measured input/visual evidence.

## Source still-picture workshop

Use the [source-only workshop](../../../docs/still-media-workshop.md) for original PNG/JPEG Preview then Save assignment to an exact installed dev map/world. Its explicit real same-origin v3 opening affects older audio-reader compatibility; never describe it as a sandbox. Keep external originals and existing limits. Its saved assignments and isolated canvas do not replace game/Collection art, create earned receipts or establish browser/device readiness.

## Preserve native launch and input access

For any playable theme, asset, rule, interface or pack change, follow the shared [native launch, entry and device contract](../../../docs/boot-launch.md#authoring-and-device-contract). Preserve dark first paint and safe failure guidance, the native player journey, authored action availability, independent keyboard/touch/controller navigation, historical run identities and truthful device evidence. Do not reintroduce legacy webpage controls or advertise unavailable actions. Source, browser, listening and physical-device checks remain separate. Public entry must use the complete immutable edition graph; follow the [entry and retirement contract](../../../docs/boot-launch.md#immutable-public-entry--p77). Verify fresh and previously cached browsers separately from public-byte hashes. Preserve old caches, profiles and live games during normal worker retirement; never clear site data or force takeover to make an upgrade pass. Keep actual storage limits distinct from planned media budgets. Verify an ordinary first capture and continued flight in the frozen browser online and with its server stopped; clean startup, restored saves and complete file inventories do not prove the gameplay journey. Preserve simulation exceptions as release blockers even when source tests pass.

The [opt-in still store](../../../docs/media-storage.md) retains exact historical owners and original bytes, but its presence does not mean a picture is adopted by the game or kept as an earned reward. Ordinary runtime adoption, live-session pins, Collection receipts and actual v3 migration require their own gates. Never enlarge budgets, erase history or upgrade the shared audio database implicitly from a preview.
