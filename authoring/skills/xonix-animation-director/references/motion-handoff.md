# Motion handoff and review record

The generic handoff below is a proposed authoring format. The next section records the implemented game interfaces. Before serializing either, check the active preview/runtime schema: raster-media metadata does not automatically accept animation states, audio cues or component graphs.

## Implemented game presentation

Read [`render.mjs`](../../../../game/ui/render.mjs), [`actor-presentation.mjs`](../../../../game/ui/actor-presentation.mjs), [`classic-view.mjs`](../../../../game/ui/classic-view.mjs) and the role arrays in [`content.mjs`](../../../../game/content.mjs) when changing the playable presentation. The [presentation guide](../../../../docs/actor-presentation.md) explains the current visual intent; source and focused tests determine accepted behavior.

### Independent asset bindings

Standard `visualOverrides` keys are exactly `background`, `player`, `enemy`, `patrol`, `boss`, `objective`, `supply`, `wall`. Classic `xonix-playground.v5` additionally accepts exactly `contour`, `rover`, `eroder`, `slowTerrain`, `lethalTerrain`, `lifePickup`, `speedPickup`, `slowPickup`, `freezePickup`. Earlier scenario formats retain their narrower role list.

| Runtime type or purpose             | Existing image slot             |
| ----------------------------------- | ------------------------------- |
| `bouncer` and ordinary field actor  | `enemy`                         |
| `border-patrol`                     | `patrol`                        |
| `lane-boss` or staged sentinel core | `boss`                          |
| `contour-patrol`                    | `contour`                       |
| `claimed-rover`                     | `rover`                         |
| `eroder`                            | `eroder`                        |
| Slow / lethal material              | `slowTerrain` / `lethalTerrain` |
| Extra life / faster player          | `lifePickup` / `speedPickup`    |
| Slower / frozen enemies             | `slowPickup` / `freezePickup`   |

Replacing a slot does not rename its behavior, change its contact domain or remove warning/rejoining brackets, dormant outlines, powerup badges or collision-center cues. Enemy overrides are square body images facing upward at zero rotation. Player overrides instead retain their aspect ratio inside the selected rig's source rectangle. Rig recipes and normalized anchors remain independently authored in the motion-lab presets; an image upload does not define a new rig or animation schema. Do not serialize `trail`, `rotors`, `capture`, `actorScale` or `playerScale` as new visual-override roles. Trail/capture refinements use the existing presentation renderer; new configurable primitives require an explicit supported extension.

### Enemy workshop and event feedback (upcoming v0.27)

Read the [enemy catalog guide](../../../../docs/enemy-catalog.md) and `game/enemy-catalog.mjs` before creating another enemy skin. Each of the seven registered types has a distinct original silhouette, fixed role color and non-color badge; custom body images cannot hide that badge or contact core. A catalog `<type>.<theme>.v1` skin is a registered renderer choice, not an arbitrary actor field. Enable/disable choices affect new generator drafts only. They must never silently filter an existing campaign or scored run. The standalone `/authoring/enemy-catalog/` workshop previews choices and opens a separate validated practice study; its release inclusion is an explicit build allowlist gate.

Keep the four pickup glyphs readable on opaque dark plates: heart/life, double-chevron/speed, hourglass/slow and snowflake/freeze. The dark game palette can invert `ink` and `paper`; never assume `palette.ink` is a dark plate. Uploaded pickup artwork retains its colored type badge. Timed labels read world ticks; warnings read the Classic actor clock. Check both clocks while freeze is active.

`effectsFor(events, run)` captures a pickup by immutable ID and a failure/recovery point only from a matching event tick or explicit event x/y. Copy those values immediately, before another fixed substep. A later respawn must not drag the wreck to spawn, and a batched historical event cannot invent an earlier player position. Theme-specific short fragments, pickup labels and recovery cues are cosmetic, bounded to eight queued effects, and cannot award anything. Pause holds effect age; reduced effects keep the explanation without moving fragments. Recovery labels read `respawnAt - time`.

For optional traveling line impacts, draw only the core's current `classic.lineImpact.fronts` positions. `classicView` supplies at most 48 owned markers. Keep both directions distinct and the active cut readable; reduced effects may simplify a seed spark but cannot hide a damaging front. Never derive propagation from animation age, fake an impact by removing a life, or retain fronts after the core clears them.

Add `game/test/enemy-catalog.test.mjs` and `game/test/enemy-catalog-panel.test.mjs` to the affected presentation checks, then inspect actual browser playback. Current geometry/DOM tests establish contracts, not raster quality or physical-controller certification. Use the existing `presentation-02-four-theme-enemies` prompt with the exact catalog type, body slot, fixed badge and compact/detailed treatment in its target brief.

### Screen size and geometry

The board still paints 16 logical pixels per cell: legacy 48×36 uses 768×576, wide 72×36 uses 1152×576. CSS display size is separate from those logical dimensions and from source-image pixels. Preserve the entire wide arena on portrait displays.

| Presentation               | Current footprint policy                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary enemy             | 24–32 CSS-pixel body box when displayed canvas is at least 480 CSS pixels wide; at least 16 on ordinary phones; maximum 64 logical pixels |
| Boss                       | Same responsive approach, with maxima of 40 CSS and 80 logical pixels                                                                     |
| Player contained image box | 24–32 CSS pixels on desktop and at least 16 on ordinary phones; maximum 64 logical pixels                                                 |

The current FPV image margins make the visible player roughly 18/12 pixels at its desktop/phone minima. Measure replacement-art alpha bounds; a nominal box is not proof of occupied pixels. The neutral marker is scaled by its visible triangle extent. Logical caps take precedence on unusually tiny embedded canvases. `BoardPainter.draw(...,{actorScale,playerScale})` exposes separate bounded cosmetic adjustments; neither changes the collider nor becomes a persisted preference automatically. Maintain player `rules.playerRadius` and enemy radius markers outside the cosmetic body transform. Keep shield and queued-turn cues clear of the enlarged player.

`presentation.style` values remain `microtile`, `hybrid` and `props`. Preserve distinct four-theme shapes, not only palettes: FPV vehicles/rotors/radar, Ukrainian patterned creatures/botanical forms, retro robots/comets/glitches, and business invoices/parcels/linked blocks. The renderer maps theme families `fpv`, `atlas`, `retro`, `navi` to these existing treatments. Keep source crop, center and rotor anchors locked when making a cosmetic trim; an intentional crop requires a new measured anchor record.

### Motion and cut invariants

- Enemies retain a bounded previous-position cache (64 actors). Facing is measured on new simulation ticks; initial velocity is a fallback. Never write a cosmetic heading, speed or tail into a simulation entity. Stationary treads/walking stay still; rotors/radar may idle. Microtile simplification keeps locomotion rather than turning it off. Optional pressure AIM/CHASE/REST cues read owned core targets and actor-clock deadlines; this is an original extension, not reference-game AI evidence.
- Player body orientation follows resolved `player.direction`, while rate and banking read current motion. Keep configurable blade counts distinct from hub counts, alias-aware phase sampling and independent non-rotor recipes. Classic enemy freeze does not freeze the player's rotors.
- Gameplay Pause holds world presentation. Enemy stun, dormancy and classic freeze hold their relevant pose clocks. Reduced effects retain facing and necessary static cues while removing banking, moving accents and capture pulses. Terminal full-picture celebration has its own pause/lifecycle input.
- Enemy tails have at most three points within 1.15 cells of the actor. Do not scatter decorative particles across active lines, narrow routes or hazards.
- The active cut uses CSS-aware widths: roughly 5-pixel dark outline, 3-pixel accent and 1-pixel light center, plus a bright bounded head. Functional light ink is independent of inverted theme `ink`/`paper` tokens. Its one moving 3-pixel highlight stays on the last short section of the real cut. Reduced effects keep the complete static line/head and trail-cell occupancy cue.
- `cells.claimed` copies at most 2592 indices into a bounded effect queue (eight effects). The capture sweep and inner perimeter touch only those indices still SAFE, last less than 0.65 seconds and have opacity at most 0.2. Paint capture decoration beneath current actors, hazards and the live cut. Pause holds its age; reduced effects omit it. It grants no score, coverage, damage or awards.
- Opaque black conceals unrevealed art. Full-art victory is presentation after the real win and must preserve recorded coverage and one-time rewards. Do not bypass the core's authored capture-stop rule or use a victory clip to trigger a second award.

## Presentation prompt supplement

[`presentation-workflows.json`](../../../prompts/presentation-workflows.json) follows the existing `prompts` catalog format and contains three unexecuted templates registered in `authoring/prompt.py`. Its explicit `SUPPLEMENTS` tuple includes `CATALOG.parent / "presentation-workflows.json"` exactly once. For an older checkout without that entry, add it once; no main-catalog rewrite or new loader is needed.

Run from the repository root:

```sh
python3 authoring/prompt.py render presentation-01-fpv-rig --set BODY_ID=fpv-body --set SOURCE_ART=authoring/motion-lab/assets/fpv-body.png --set TARGET_PACK=game/content/packs/fpv-arcade-r2.json
python3 authoring/prompt.py render presentation-02-four-theme-enemies --set TARGET_PACK=game/content/packs/classic-lab.json --set DETAIL_TREATMENTS=microtile,hybrid,props
python3 authoring/prompt.py render presentation-03-cut-reveal --set TARGET_PACK=game/content/packs/fpv-arcade-r2.json --set EFFECT_DIRECTION='A brighter short trail head and a quiet diagonal sweep over newly secured cells'
```

`load_catalog()` checks unique IDs and matching declared/template variables; `render()` rejects missing, unknown or duplicate assignments and unresolved delimiters. Those checks validate prompt wiring, not produced assets. Keep source requirements and the rendered effective prompt with the actual generation/implementation record.

## Applied verification

For a renderer or rig change, use the existing focused checks:

```sh
node --test game/test/actor-presentation.test.mjs game/test/classic-presentation.test.mjs game/test/wide-presentation.test.mjs game/test/rewards.test.mjs game/test/gallery-reduced-effects.test.mjs
```

For an asset-only change, validate the actual scenario/pack through its current authoring tool, then inspect decoded images and actual playback. Check each changed slot independently, Immediate and Grid + buffer against their own unchanged input proof, 320/390/600/1152 CSS-pixel canvas fixtures, legacy/wide geometry as applicable, pause/reduced/freeze/respawn, and non-square player images. Keep exact checkpoint comparisons and visual evidence separate. Node Canvas-command fixtures are not screenshots, physical controllers, phone certification, animation-quality approval or a human playtest.

## Component boundaries

Record stable proposed IDs for body, each independently moving rotor/wing part, shadow, active trail, capture effect, hit/respawn effect, terrain material, UI transition and sound cue. For each record source/parent asset, local anchor, draw order, visible bounds, intended filtering, supported skins, trigger/state dependencies, timebase and fallback. Record collider/board geometry by reference only; do not recreate it from visible pixels.

Parts can be reused across appearance styles. For example, a compact drone body can replace a detailed body while the four rotor loops, trail renderer and hit effect retain their identities. A component plan should explain which parts actually need separate files and which can be parameters of a proven renderer; avoid promising a huge asset count without a production reason.

## Component recipes

Use actual renderer-supported fields; this record does not extend its format. A rotor recipe distinguishes **hub count** from **blades per hub**. Four hubs with three blades each is still a quadcopter. At one hub, three blade angles are spaced by one third of a revolution around its center. Keep phase offset, spin sign, visual angular rate, radius and blade silhouette explicit. Anchors use one documented local coordinate system and inherit the body transform exactly once; changing the source crop or fit requires anchor review, not an unmeasured copy of old coordinates.

Integrate phase using the intended elapsed time and retain it coherently across normal rate changes. Define whether a character switch resets or restores that character's cosmetic phase, and cancel old components before replacement. Paused/reduced-motion views need an intentional steady frame. A high angular rate can make discrete blades appear frozen or reversed at sampled frame rates; inspect slow/normal/boost playback at several render rates and actual sprite size. Use a lower-detail blur/ring or steady material fallback when appropriate, without claiming physically accurate rotor RPM or changing travel speed to fix visual aliasing.

Non-rotor recipes differ by material and identity. A bird wing may oscillate around an inspected hinge with bounded angle and a body/wing layering rule. A thruster changes length, opacity or texture through declared velocity/state while preserving its nozzle anchor. A pulse can vary a ring or accent around a stable center without covering the player head. Record independent idle/move/turn/slow/boost reactions, loop clocks, reduced-motion frames and cleanup on hit/respawn/victory/character exchange only for states actually available. Do not introduce wings or rotary parts to every theme merely because the FPV reference uses propellers.

## Suggested state coverage

Use the actual simulation phase as authority. The following table is a starting point, not a fixed ruleset or implemented state machine.

| State/event | Possible visible response                                   | Timing and interruption decision                                                                                                    |
| ----------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Idle        | Stable body and restrained rotor/wing loop                  | World clock; preserve facing at zero velocity. Reduced motion can hold a quiet frame.                                               |
| Move        | Direction-facing pose, modest velocity-driven loop rate     | Read actual velocity; continuous loop; stop or blend when authoritative velocity changes.                                           |
| Turn        | Short directional pose change                               | Cosmetic pose follows the documented movement state. Add no steering delay beyond the configured immediate or buffered turn policy. |
| Slow        | Clear drag cue with an existing slow-state symbol           | State-driven overlay; cancel when slow state clears. Do not slow simulation through art.                                            |
| Boost       | Short restrained wake or brighter attachment                | State-driven; cancel on boost end or higher-priority hit/respawn. Avoid masking the live trail.                                     |
| Hit         | Local brief response at the authoritative event position    | One-shot keyed to a unique event; interrupts cosmetic turn/boost effects. Does not apply damage itself.                             |
| Respawn     | Stable arrival marker with optional short outline           | Triggered by an actual respawn phase/event; replace hit visuals. Never invent invulnerability duration.                             |
| Capture     | Local closure pulse and fill-region highlight               | Separate component; can coexist with movement. Uses supplied captured-region geometry, not painted estimates.                       |
| Victory     | Calm full-artwork presentation plus optional avatar gesture | Only after authoritative victory; ordinary movement inputs follow the actual game phase. Preserve recorded capture percentage.      |

Resolve simultaneous states per component. Terminal game phase overrides ordinary motion; respawn presentation supersedes stale hit effects. An active trail and a local capture pulse can coexist. Slow and boost visuals follow the simulation's actual combined state rather than guessing which gameplay modifier wins.

Specify whether a clip loops, repeats a bounded count, holds its last frame or returns to a base state. Record the interruption rule: immediate replacement, safe blend, or completion only when that does not conceal an important gameplay change. Define cleanup for cancelled components so trails, audio and effects do not linger after a restart.

## Clocks and event cues

Use elapsed simulation time for world animation that should pause with gameplay; use a separate UI clock only for UI that intentionally continues while paused. Express durations/rates in explicit units, not renderer-frame counts. Record how resume, variable rendering frame rate and reduced motion affect presentation. A time-scale test must state whether the simulation itself is being slowed or only a clip preview is being scrubbed.

Continuous sound layers may read normalized visual velocity or active state if the actual audio system supports that route. One-shot sounds require named simulation events and a deduplication rule, such as an event ID; repeated renders of the same event must not replay the cue. Specify cue priority, maximum overlap, fade/cancel behavior, mute handling and absence-of-audio fallback. Cue planning is not sound production or listening verification.

## Appearance and responsive comparisons

Compare the same recorded state trace and fixed geometry across microtile, detailed-object and hybrid skins. Record occupied body/rotor pixels at the target display size, not merely the sprite canvas. Keep player and active-trail visibility above decorative motion. Detailed terrain may overhang visually only if corridors, hazards and logical collision remain legible. Effects should become simpler at smaller sizes; their simplification must not alter gameplay timing.

Record the configured turn mode beside every fixture. Preserve both immediate and grid-center buffered choices when the target supports them; take exact queue, release, reversal, alignment and mode-switch behavior from its current documentation and tests. Compare cosmetic variants against a baseline within each mode, using matched input/state conditions. Do not require the two movement modes to trace identical paths or silently reset buffering when changing a body, palette or animation recipe. Render actual travel/facing from documented signals; any queued-turn indicator needs a real queue signal, not an inferred pose.

Propose budgets appropriate to the actual device targets: texture dimensions/bytes, visible sprite envelope, active decorative components, particle count/area, overdraw, animation frame count, sound overlap and optional effect tiers. Label estimates; report measured frame time or memory only when obtained from the actual target/runtime. Reduced motion preserves state meaning through steady outlines, icons or material changes rather than removing necessary warnings.

## Evidence required at handoff

For each asset/clip record:

- Stage: planned brief, generated keyframes, assembled animation, played/reviewed animation, or runtime-verified behavior.
- Source and parent IDs, exact effective prompt and tool, output files and measured dimensions.
- Frame count/order, durations, loop rule, alpha/padding/pivot checks where applicable.
- Playback tool and exact scenarios inspected: idle-to-move, reversal/turn, slow/boost changes, hit during turn, respawn, rapid captures, victory, pause/resume and reduced motion, limited to events the system actually supports.
- Event/cue timeline and whether audio was rendered and listened to.
- Actual-size fixture dimensions, appearance variants compared, measured versus proposed budgets.
- Remaining defects, unsupported dependencies and any missing runtime/device evidence.

A contact sheet can help inspect silhouettes and frame consistency. It cannot prove a seamless loop, cancellation behavior, timing, responsive performance or input feel. Never describe a generated video of a mockup as evidence that the game itself implements those behaviors.

## Terminal defeat handoff

In the solo game, terminal loss freezes the authoritative run and world motion, then advances only the local `player.failed` feedback for 0.65 rendered seconds before showing Retry/Main menu. The renderer option `defeatEffectsRunning` is true only for this active, focused presentation; it must never advance actors, trails, recovery timers, score or replay input. Each render contributes at most 0.1 seconds. `Show defeat menu` is the explicit skip. Pause/dialog/focus loss holds the cue and fresh confirmation must not leak into Retry. Keep this behavior distinct from nonterminal recovery, which reads actual simulation time. Reduced effects retain the static loss explanation. Labels are `CRAFT LOST` (FPV), `LIFE LOST` (Ukraine/retro), and `LINK LOST` (business), with the consistent life-decrement annotation. Verify all four themes through `game/test/defeat-presentation-host.test.mjs` and retain a real-browser visual check; modeled Canvas commands alone cannot prove the cue is actually readable.
