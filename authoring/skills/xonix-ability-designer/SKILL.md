---
name: xonix-ability-designer
description: "Design, configure and review Xonix player classes, equipment, active abilities, resources, military-reference rosters and cross-theme challenge mappings. Use for gameplay differences such as scanning, pickup/drop, dash, capture nets or links; keep them separate from cosmetic collections and distinguish working lab primitives from future territory rules."
---

# Xonix Ability Designer

Turn a requested play style into a small, explicit set of registered mechanics. Airframe, class, equipment, appearance, allegiance and mission role are separate dimensions. A body replacement does not grant an ability. An explicitly selected class or equipment item may change declared gameplay state; document that change and test it.

## Inspect the actual capabilities

Locate `authoring/CONTRACT.md`, the current game plan, and the target runtime or preview README. If present, read `authoring/motion-lab/ability-presets.json` and its pure evaluator before emitting configuration. The lab has an independent format, fictional cell/time tuning and abstract targets. Do not insert its IDs into the existing content-pack contract or call it a territory game. Read the accepted registry and validator; unknown effects need a versioned implementation and meaningful tests.

Use [the ability handoff](references/ability-handoff.md), [Character Collection](../xonix-character-collection/SKILL.md), [Level Designer](../xonix-level-designer/SKILL.md) and [Animation Director](../xonix-animation-director/SKILL.md) where relevant. Shared prompts in `prompts/round-09-abilities-and-world.json` cover reference research, classes, equipment, visuals, actor roles and reviews. Resolve the installed skill's symlink to find its physical kit.

## Research without confusing categories

Collect primary public sources for names, maker/origin, public purpose, visible silhouette and announced/demonstrated status. Separate manufacturer assertions from independent evidence. A product page does not establish present deployment, effectiveness or which operator owns a particular pictured unit. Commercial camera drones and shared/captured vehicles must not receive automatic allegiance from their shape.

Use a curated, expandable reference catalog rather than claiming all known systems. Distinguish a named model, a family, a nickname and a prototype. Rotor count comes from the specific model; heavy lift does not always mean six rotors. Fiber is a link option, not a unique body shape. Record source URL, access date, narrow supporting claim and caveats. Do not transfer real weapon performance tables, targeting tactics, vulnerabilities, explosive details or operating instructions into game tuning.

## Specify the player decision

For each class state its primary action, contextual action, resource, cooldown, legal target domain, ready/blocked feedback and reset behavior. Use fictional values in cells and seconds. Define whether an action is edge-triggered or held, and what pause, focus loss, class/equipment change and repeated input do. Resource pickup requires an actual nearby supply marker; an animation cannot silently refill ammo or award progress.

Keep one simple default control profile while allowing explicit later loadout extensions. Share implemented primitives where meaningful: light/heavy carriers can use the same drop behavior with different capacity; scout/relay can share pulse infrastructure with distinct supported effects. Do not invent realism from a sprite: fixed-wing appearance does not silently force continuous travel, and fiber art does not create universal hazard immunity.

Movement policy remains separately configurable as immediate or grid-center buffered. An explicit dash must use authoritative direction, clear stale input and respect the selected policy's coordinates/bounds. Cosmetic body rotation is not an aim vector. Compare identical commands within the same class, equipment, policy and seed; changing a class intentionally changes the experiment.

## Bind art and themes explicitly

Keep body, motor count/anchors, blade count, cargo/spool/gimbal/net modules, projectile/effect, status icon, sound cue and portrait independently replaceable where supported. Use Asset Creator for generated imagery, inspect alpha and anchors, preserve originals and record effective prompts. An explicit Apply class appearance action may choose an eligible body; selecting an image alone must not change a class or equipment.

Map the same primitive to each family with appropriate nouns and effects. FPV drops can become heritage deliveries, retro data capsules or fictional business parcels. A scan can reveal a map fragment, disk clue or ledger anomaly. Do not place military people, firearms or nationality-coded threats into the business theme. Functional names, keyboard labels and feedback belong in localizable data, not baked image text.

## Review and integrate

Verify ammo/cooldown boundaries, repeated events, blocked attempts, pickup proximity, pause, switching cleanup, target-domain checks and movement-policy interactions. Do not let illustrative target removal award captured area, a real level win or collection progress. A production results adapter must supply real facts in its own namespace and versioned identities.

For future Xonix integration define event order relative to cut failure, closure, fill, terrain changes and terminal results. Start with a few clear teaching boards. A tank, jammer, radar or engineer is a visual reference until a registered actor role and tested level bind it. Mark reference-only, planned, lab-tested and game-integrated separately. End with actual paths, executed checks, visual evidence and the next unimplemented boundary.
