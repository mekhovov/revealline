# FPV SIM combat overhaul — local preview

This build is available in the isolated development workspace. It has not been published to GitHub or deployed. Release qualification is tracked in [the delivery report](overhaul-delivery.md).

## Combat and replay

- Continuous combat, Target hunting and Elimination share the new weapon, damage and encounter systems. Strike adds payload objectives; Survival offers six-minute and Endless runs.
- Equip two different weapons from autocannon, scatter, precision and rockets, plus bombs, remote charges or a drone charge. Balanced, Arcade and Tactical ammunition rules change reloading and resupply.
- Military troops, shield units, UAVs, vehicles and ground robots have distinct appearances and behavior. Survival adds formations, elites, a reserved final enemy, guarded supplies and optional challenges.
- Health visibility and assistance are configurable. Repair pickups and service pads support longer attempts. Hunting replacements wait and choose another admitted route when possible.
- Retry preserves the attempt's seed and configuration. New run changes the seed. Recordings can be watched, exported and continued; durable archives preserve longer attempts while storage remains available.
- Large automatic recovery saves now retain the complete session in browser database storage when localStorage is too small. Legacy saves remain readable, and replay-speed controls remain visible during combat playback.

## Flight and presentation

- Chase starts closer to the drone, with adjustable distance and obstacle avoidance. Optional front arms and propellers are visible in FPV.
- Fragments fall, contact supported surfaces and settle into persistent poses. Settling continues after a result while the scene is active. Missing streamed surfaces remain pending.
- Blood, Brutal and Remains stay independent. Full gore enables all three. Camera shake and screen effects can be disabled separately.
- High-detail Realistic remains now retain complete authored regions within the effect budget. Whole clusters may be deferred when the visible budget is full; their records are retained.
- Current art has richer regional damage and material-specific wreckage. The optional revised Realistic pack adds connected damage regions and improved military clothing and equipment while retaining the same gameplay shapes.
- Shared stick displays, configurable widgets, compact close buttons and consistent flight menus carry across the relevant SIM screens.

## Compatibility and authoring

- Learning levels retain Original course by default. Other levels retain Continuous combat. Random grouping, flight activity and Self-level/Acro remain independent.
- Original lessons and historical recording formats retain their separate behavior. Radio calibration and saved presentation preferences carry forward.
- Radio setup includes distinct Fire, Weapon, Reload, Payload and Detonate assignments. Weapon actions require fresh activation after menus, pause or reconnect.
- Worlds and Studio use the same encounter definitions, weapons and effect recipes. Authoring includes validation, previews, timeline scrubbing and stable-ID reimport.

## Limits of this preview

- The new physical-radio command check was deferred by the user. Earlier successful flight and Fire checks do not qualify the added commands.
- Native Current-art stress runs completed at 20/64/96/128 requested actors. Average frame rates were 60.00/59.75/59.47/58.61 FPS; larger populations have not met the strict 60 FPS release gate. Other performance coverage and five-player satisfaction sessions remain pending. Population is an admitted maximum; a small or obstructed map can admit fewer actors.
- Revised Realistic art adapts the existing character assets; it is not a new photorealistic character production.
- Imported maps need a valid encounter. Unsupported imports explain the issue and offer Studio authoring.
- The full repository validator requires authoring data omitted by this sparse checkout. Available targeted checks and package measurements are documented separately.

See the [player guide](player-guide.md) for controls, camera settings, supplies and recording limits.
