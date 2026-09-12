---
name: xonix-background-stylist
description: "Inspect supplied images for a Xonix game, preserve source artwork, and create optional derived style or object-skin variants. Use when adapting photographs, paintings, pixel scenes, avatars, or terrain art to the game without changing geometry or behavior."
---

# Xonix Background Stylist

Make an existing image usable in the requested game context while preserving the user's source and chosen medium. **Default to keep-source with a separate gameplay overlay.** A photograph need not become pixel art. Style conversion is an optional derived copy when requested, not an automatic import step.

For a source applied to the playable game, use [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md) and the [actual eight-role format and limits](../../../docs/assets-and-configuration.md). An exported `xonix-playground.v1` scenario preserves embedded original bytes; await `prepareScenario` before adopting it, compare background contain/cover, and inspect inherited player rig anchors. The media-library and draft-pack records below remain separate provenance/design formats, not automatic runtime imports.

## Establish the reference and mode

- Inspect the supplied image before describing or editing it. Read its actual dimensions and identify focal subjects, markings, existing style, crop sensitivity and its intended role. If a required reference cannot be accessed, name that missing input; never substitute a remembered or invented image.
- Find `authoring/CONTRACT.md` in the target workspace. An installed symlink can be resolved to this skill's physical directory and parent kit. Read relevant records in `authoring/prompts/round-06-asset-variations.json`; these supplement the main catalog and are supported by its shared `prompt.py` CLI. If the kit is absent, use the [variant record](references/variant-record.md) as a standalone authoring handoff.
- Choose keep-source, overlay-only planning, or requested derived styling. Keep-source and overlay-only do not require image generation. Follow an explicit request for a medium or multiple variants without asking for approval again. Preserve composition unless the user requested a crop or rearrangement; describe any necessary derived framing choice.

## Create optional variants

Use the built-in image-generation/editing tool for requested visual creation and follow its reference-image instructions. Inspect every local reference before editing. Preserve the original file; save each generated result under a separate asset ID/path linked to its parent. Do not upload source images to public hosting or third-party styling services as an import step, and do not fall back to a paid API or CLI without authorization for that route. If the built-in tool is unavailable, deliver the prepared prompt and clearly identify that generation did not run.

Change one or two explicit axes at a time—medium, lighting, silhouette, material or chapter palette—so comparisons remain meaningful. Preserve the rest of the source. Keep pixel sprites separate from smoothly filtered pictures; runtime texture size, source dimensions and logical cell coordinates are different facts.

For object variants, `X`, `^` and similar placeholders may stand for replaceable game objects. Confirm the level's semantic role from data or the brief, then skin that role. A changed avatar, vehicle, terrain tile or symbol **never changes collider size, movement domain, fill-blocking status or objective behavior**. Unsupported new behavior stays an extension proposal outside a valid pack.

When a variant includes movement, animated terrain or attached effects, use [Animation Director](../xonix-animation-director/SKILL.md) for component anchors, state timing and playback review. Retain compact/microtile, detailed-object and hybrid appearances on the same geometry; a static image comparison cannot establish their behavior in motion.

When an image belongs to a selectable roster, consult [Character Collection](../xonix-character-collection/SKILL.md) before exchanging its binding. Preserve its character and progress identity; record the derived visual separately and verify the selected character actually displays the replacement.

## Identity and review

For the current FPV FRONT direction, use **no Z markings anywhere in concepts or variants**. Ukrainian assets never receive hostile markings. Record Ukrainian, hostile-military or neutral allegiance explicitly in the authoring record, based on the supplied brief rather than guessing from visual style; mixed scenes need separate entity annotations. Unknown allegiance remains unconfirmed until resolved. This is a project-specific art direction, not a rule for unrelated games. Preserve invading military presence where the FPV reveal brief requests it. Coupa, cultural and retro packs retain their own themes.

Inspect each output manually: source fidelity, identity/markings, intended medium, focal preservation, actual-size marker readability and partial-reveal composition. Read actual output dimensions from the file rather than trusting prompt dimensions. Record the full effective prompt, reference inputs, parent asset, tool route, output path and review findings using the [variant record](references/variant-record.md). Do not assert alpha, seamless tiles, equal sprite frames, pivot consistency or animation readiness without the corresponding checks.

Show completed visuals when produced and link the variant records. Distinguish reviewed concept art from inspected production assets. Run current pack validation only if pack data changed, and keep those results separate from visual, collision and device evidence.

## Register in the local media library

When this kit is available, use [the media CLI](../../media/README.md): `import` preserves original bytes, `derive` registers an already-created styled result and its parent, and `bind` changes a role/variant reference. None invokes an AI model or modifies image pixels. Supply allegiance from the brief, preserve the source, and record an unavailable model version honestly rather than inventing it. The media manifest version is separate from the content-pack schema and has no runtime compiler yet. Its `--ready` gate checks explicit review records and file metadata; it does not prove sprite, animation or game readiness.
