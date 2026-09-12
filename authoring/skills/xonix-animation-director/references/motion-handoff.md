# Motion handoff and review record

This is a proposed authoring format. Before serializing it, check the actual preview/runtime schema. Existing raster-media metadata does not automatically accept animation states, audio cues or component graphs.

## Component boundaries

Record stable proposed IDs for body, each independently moving rotor/wing part, shadow, active trail, capture effect, hit/respawn effect, terrain material, UI transition and sound cue. For each record source/parent asset, local anchor, draw order, visible bounds, intended filtering, supported skins, trigger/state dependencies, timebase and fallback. Record collider/board geometry by reference only; do not recreate it from visible pixels.

Parts can be reused across appearance styles. For example, a compact drone body can replace a detailed body while the four rotor loops, trail renderer and hit effect retain their identities. A component plan should explain which parts actually need separate files and which can be parameters of a proven renderer; avoid promising a huge asset count without a production reason.

## Component recipes

Use actual renderer-supported fields; this record does not extend its format. A rotor recipe distinguishes **hub count** from **blades per hub**. Four hubs with three blades each is still a quadcopter. At one hub, three blade angles are spaced by one third of a revolution around its center. Keep phase offset, spin sign, visual angular rate, radius and blade silhouette explicit. Anchors use one documented local coordinate system and inherit the body transform exactly once; changing the source crop or fit requires anchor review, not an unmeasured copy of old coordinates.

Integrate phase using the intended elapsed time and retain it coherently across normal rate changes. Define whether a character switch resets or restores that character's cosmetic phase, and cancel old components before replacement. Paused/reduced-motion views need an intentional steady frame. A high angular rate can make discrete blades appear frozen or reversed at sampled frame rates; inspect slow/normal/boost playback at several render rates and actual sprite size. Use a lower-detail blur/ring or steady material fallback when appropriate, without claiming physically accurate rotor RPM or changing travel speed to fix visual aliasing.

Non-rotor recipes differ by material and identity. A bird wing may oscillate around an inspected hinge with bounded angle and a body/wing layering rule. A thruster changes length, opacity or texture through declared velocity/state while preserving its nozzle anchor. A pulse can vary a ring or accent around a stable center without covering the player head. Record independent idle/move/turn/slow/boost reactions, loop clocks, reduced-motion frames and cleanup on hit/respawn/victory/character exchange only for states actually available. Do not introduce wings or rotary parts to every theme merely because the FPV reference uses propellers.

## Suggested state coverage

Use the actual simulation phase as authority. The following table is a starting point, not a fixed ruleset or implemented state machine.

| State/event | Possible visible response | Timing and interruption decision |
|---|---|---|
| Idle | Stable body and restrained rotor/wing loop | World clock; preserve facing at zero velocity. Reduced motion can hold a quiet frame. |
| Move | Direction-facing pose, modest velocity-driven loop rate | Read actual velocity; continuous loop; stop or blend when authoritative velocity changes. |
| Turn | Short directional pose change | Cosmetic pose follows the documented movement state. Add no steering delay beyond the configured immediate or buffered turn policy. |
| Slow | Clear drag cue with an existing slow-state symbol | State-driven overlay; cancel when slow state clears. Do not slow simulation through art. |
| Boost | Short restrained wake or brighter attachment | State-driven; cancel on boost end or higher-priority hit/respawn. Avoid masking the live trail. |
| Hit | Local brief response at the authoritative event position | One-shot keyed to a unique event; interrupts cosmetic turn/boost effects. Does not apply damage itself. |
| Respawn | Stable arrival marker with optional short outline | Triggered by an actual respawn phase/event; replace hit visuals. Never invent invulnerability duration. |
| Capture | Local closure pulse and fill-region highlight | Separate component; can coexist with movement. Uses supplied captured-region geometry, not painted estimates. |
| Victory | Calm full-artwork presentation plus optional avatar gesture | Only after authoritative victory; ordinary movement inputs follow the actual game phase. Preserve recorded capture percentage. |

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
