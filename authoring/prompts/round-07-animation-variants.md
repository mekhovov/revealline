# Round 07 — modular animation variants

This supplement adds **16 animation templates** while leaving the original 56-template catalog and the separate Round 06 supplement unchanged. It creates authoring instructions, not animation files or a game runtime.

Use [xonix-animation-director](../skills/xonix-animation-director/SKILL.md) with the actual asset references and state/event interface. Round 07 brought the catalog to 88 templates; Round 08 expanded it to 104. The shared `authoring/prompt.py` now includes [Round 09 abilities and world templates](round-09-abilities-and-world.md), for 124 total. It continues to load [round-07-animation-variants.json](round-07-animation-variants.json) alongside the other catalogs. Use `python3 authoring/prompt.py show animation-02-state-contract` to inspect inputs, or `render ID --set NAME=value` to resolve a template locally. Rendering does not generate animation or call a model.

## Templates

| ID | Purpose | Output mode |
|---|---|---|
| `animation-01-component-map` | Independently replaceable body, rotors, shadow, trail, effects, terrain, UI and sound. | Text plan |
| `animation-02-state-contract` | State priority, interruption, looping, timebase, reduced motion and cleanup. | Text plan |
| `animation-03-compact-fpv-body` | Smaller occupied FPV pixel silhouette with consistent attachments and collider reference. | Requested keyframe image edit |
| `animation-04-fpv-rotor-response` | Modular rotors/body reacting to supplied velocity, direction and phases. | Text plan |
| `animation-05-enemy-motion-signatures` | Distinct silhouettes for field, contour, exposed-ground and erosion roles. | Requested keyframe image edit |
| `animation-06-atlas-motion` | Specific Ukrainian material/cultural motion with three appearance modes. | Text plan |
| `animation-07-retro-motion` | Coherent 80s/90s motion economy, with neon and CRT effects optional. | Text plan |
| `animation-08-navi-motion` | Friendly business-world animation and correctly identified brand placeholders. | Text plan |
| `animation-09-terrain-appearance` | Microtile, detailed-object and hybrid materials on identical geometry. | Text plan |
| `animation-10-trail-capture` | Independent active trail, capture pulse and event-cue timing. | Text plan |
| `animation-11-hit-respawn` | Legible failure and recovery without inventing gameplay protection. | Text plan |
| `animation-12-victory-gallery` | Skippable full-artwork reward with the actual score/percentage retained. | Text plan |
| `animation-13-ui-states` | Focus, press, loading, error, pause, retry and gallery motion across inputs. | Text plan |
| `animation-14-audio-event-timing` | Continuous layers, one-shot event identity, overlap, fade and mute rules. | Text plan |
| `animation-15-responsive-budget` | Measured silhouette size and proposed effects/texture/audio budgets by device. | Text plan |
| `animation-16-playback-review` | Actual clip inspection and honest readiness stages. | Review |

Each template declares its variables, required references and an example user request. Substitute the real inputs, record the complete effective prompt and keep source/parent asset identities. The two image-edit templates produce **keyframe concepts** if executed; they do not create or verify a playable clip by themselves.

## Presentation reads simulation

Velocity, direction, state and events drive rendering. They do not receive gameplay changes back from the animation. A skin swap or a faster-looking rotor must not change movement speed, collider size, damage, input or fill behavior.

Components should be independently replaceable: body, rotor/wing parts, shadow, trail, local effects, terrain materials, UI transitions and audio-event cues. This does not require every detail to become a separate file; use actual renderer capabilities and justify the production boundary.

The state vocabulary covers idle, move, turn, slow, boost, hit, respawn, capture and victory. Select states supported by the actual interface and record missing signals as proposed dependencies. Per-component priorities allow a capture pulse to coexist with movement, while hit can cancel a cosmetic turn. Explicit cancellation and cleanup prevent old effects or sounds surviving a reset. Use elapsed world time for motion that should pause with gameplay and a separate intentional UI clock where appropriate.

A compact FPV study measures the **occupied body and rotor pixels at actual display scale**. A large transparent canvas around the same oversized drone is not a smaller avatar. Keep the collider reference fixed and report any misleading relationship between the visible silhouette and hit area. Current FPV art uses no Z markings anywhere and explicit Ukrainian, hostile-military or neutral identity.

Keep **microtile, detailed-object and hybrid** appearance variants available together on the same geometry and state trace. Their material detail may differ; wall, slow and lethal meanings and the live-trail hierarchy stay constant. Each of the four theme families retains its own palette, subjects and sound direction.

Use the [Round 07 motion and balance direction](../../docs/round-07-motion-and-balance.md) and [live viewport comparison](../../docs/concepts/round-07-device-preview.html) for the current comparison context. The latter is a browser viewport preview, not an iPhone emulator or evidence of native-device behavior. Keep its observations separate from real hardware/input testing and from playback review of production animation.

## Readiness requires playback

The useful stages are:

1. Planned component/state brief.
2. Generated or drawn keyframes.
3. Assembled animation with real frames/timing.
4. Played and manually reviewed animation.
5. Runtime-verified state behavior on the tested device/input scope.

A contact sheet helps inspect poses. It cannot prove looping, cancellation, timing or actual input response. A generated video that looks like gameplay is not evidence that the game implements its movement. Sound planning is likewise separate from actual production and listening.

The skill checks whether a local preview/editor is available and reads its real capabilities. Consult [the motion lab](../motion-lab/README.md) when present and use only the fixture features it supports; a portable installation of this skill does not require that tool to exist. A preview may verify presentation against a supplied state trace while still leaving collision, engine integration and device performance untested.

Use [the motion handoff](../skills/xonix-animation-director/references/motion-handoff.md) to record component IDs, clocks, triggers, cancellation, source provenance, measured output dimensions, frame/alpha/pivot checks, playback scenarios and proposed versus measured budgets. Do not insert unrecognized animation fields into existing raster-media or level schemas.

## Validation performed

All 16 records have unique IDs, declared modes, exact placeholder/variable agreement and successful local text substitution with no unresolved placeholders. Every prompt is at least 100 words. The new skill passes the Skill Creator package validator. See the [integration check record](../evaluations/round-07-authoring-checks.md) for all 88 CLI renders, negative cases and regression results. These checks validate the authoring package only; no image, animation, sound or runtime was generated or verified by this supplement creation.
