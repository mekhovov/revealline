---
name: xonix-animation-director
description: "Plan, vary and inspect modular Xonix animation for avatars, enemies, trails, capture effects, terrain, UI and timed sound cues. Use for simulation-driven visual reactions, interchangeable appearance variants and playback review; distinguish animation briefs and sprite sheets from working, inspected animation."
---

# Xonix Animation Director

Direct movement and feedback as replaceable presentation. Preserve the user's source art, family identity and gameplay contract. Animation reads simulation state; it never changes colliders, movement, damage, capture rules or input. A generated contact sheet is an animation concept, not a working animation.

For animation applied to the playable `game/`, use [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md), the [core state/event contract](../../../game/core/README.md) and [asset/rig guide](../../../docs/assets-and-configuration.md). The game reuses `authoring/motion-lab/animation.mjs`, `render-character.mjs` and presentation presets, while `xonix-playground.v1` only exposes static image overrides and its documented presentation fields. This reuse does not register every lab animation state or component control in the game UI; inspect actual playback without changing either steering mode or its collider.

## Inputs and scope

Inspect the actual reference assets, current board fixture, intended display scale and available state/event interface. Read `authoring/CONTRACT.md` and relevant records in `authoring/prompts/round-07-animation-variants.json` when the kit is present; resolve an installed skill symlink to its physical kit if needed. The shared CLI includes this supplement: use `python3 authoring/prompt.py show animation-02-state-contract` to inspect inputs before rendering text. Consult [the motion handoff](references/motion-handoff.md) for states, timing and inspection records.

Find an existing local playback tool or editor and read its usage before claiming it can preview the proposed format. If `authoring/motion-lab/` exists, inspect its README and actual supported controls; its existence alone does not establish runtime integration. Without a playback route, provide the requested brief or assets and explicitly leave animation playback unverified. Do not invent accepted animation fields in a raster-media or level manifest.

## Direct the motion

- Separate body, rotor/wing parts, shadow, active trail, hit/respawn effects, capture effects, terrain materials, UI transitions and sound-event cues. Give each a stable proposed component ID, parent/anchor, palette/material variant, timing and fallback. Changing one component should not require regenerating unrelated art.
- Derive facing and visual rate from supplied velocity/direction and state transitions. At rest retain the last meaningful facing. Preserve the authored movement mode, including immediate or grid-center buffered turning; read the current preview's actual queue/turn semantics rather than assuming them. Visual interpolation must not add input delay beyond that mode or modify authoritative position. A cosmetic turn animation cannot select or normalize the movement mode.
- For component recipes, distinguish hub count from blades per hub. The current FPV request uses configurable three-blade propellers: preserve inspected hub anchors, define evenly spaced blades, spin signs and phase offsets, and inspect pause/low-rate aliasing at actual size. Wings, thrusters and pulses use their own bounded motion and cancellation; they are not disguised rotor loops. Read [the component recipe notes](references/motion-handoff.md#component-recipes) before authoring these details.
- Specify idle, move, turn, slow, boost, hit, respawn, capture and victory as appropriate. Use per-component priorities and explicit trigger, cancel, loop, duration and clock rules. An effect may coexist with locomotion; do not freeze movement simply because a capture animation begins. Treat nonexistent events as proposed dependencies.
- Measure the **occupied pixel silhouette at actual display scale**, not just the source canvas. For the smaller FPV direction, compare compact body and rotor envelopes against the fixed board/collider in real-size fixtures. Do not shrink the logical hitbox to make a cosmetic size reduction look correct. If the silhouette makes collisions misleading, report that conflict.
- Compare microtile, detailed-object and hybrid appearance variants on the same tile coordinates, collider geometry and recorded state trace. Microtile means compact material clusters; detailed means richer object skins; hybrid combines a quiet grid with selected objects. Preserve wall/slow/lethal distinctions and the live-trail hierarchy in every variant.
- Check cosmetic independence within each supported turning mode. Record the mode with its input/state fixture; compare each skin or body-response setting with that mode's own baseline. The two movement policies may produce different paths, so identical trajectories across modes are not the acceptance criterion. Requested direction and actual travel can differ when buffering is active; render from the documented state signals.
- Preserve four-family identity: FPV military, Ukrainian cultural, retro and Coupa business-world styles remain independent. For current FPV assets use no Z markings anywhere and record Ukrainian, hostile-military or neutral allegiance explicitly; leave unknown identity unconfirmed.

When a task involves selectable or earned character variants, use [Character Collection](../xonix-character-collection/SKILL.md) to preserve identity, eligibility and asset-binding semantics. The animation recipe does not own progress, stats or unlock rules. On selection changes, dispose of the previous character's active components and cues before applying the next recipe.

## Produce and verify

For requested image creation/editing use the available built-in image tool and its reference workflow; keep originals and separately record derived frames. Use an appropriate available animation editor or existing preview tool for assembly/playback. Do not silently invoke paid APIs, upload source assets to unrelated services or invent audio/video generation capabilities.

Play and inspect actual clips before calling animation finished. Check loop seams, frame order, pivots, alpha, direction changes, interruption, pause/resume, repeated events, reduced motion and real-size readability. For sound, record cue timing separately from an actual rendered/listened audio asset. Set responsive budgets for sprite footprint, particles, overdraw, active components and cue overlap; report measured values separately from proposed limits.

Deliver the component/state handoff, effective prompts, source/variant provenance, actual output dimensions and playback evidence with exact tested scenarios. Use accurate stages: planned brief, generated keyframes, assembled animation, played/reviewed animation, or runtime-verified behavior. Passing text or manifest validation does not advance an asset to the later stages.
