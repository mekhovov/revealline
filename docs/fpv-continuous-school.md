# Continuous FPV lesson practice

## Player flow

The learning lab uses each lesson's complete, verified command recording. The
same isolated world simulation carries position, orientation, angular velocity,
linear velocity and objective progress between steps. Step descriptions advance
with the actual objective transitions. Only the end of the entire example loops
back to the ground start. Short instructions receive at least four seconds of
presentation time; slower playback changes the clock, never the commands.

Keyboard, touch or deliberate calibrated-radio movement takes over the same
flight state. Meeting the current real objective gives a brief success cue and
advances to the next task. A target outline and measured distance show where to
practise. Completing the final task leaves free practice available indefinitely.
Individual step selection reconstructs its starting state from the recorded
prefix. Watching or taking over an example does not award a complete scored
lesson, medal or portable proof. The ordinary Let's fly action still begins a
fresh scored attempt.

The isolated lab policy bypasses attempt expiry and continues after its final
objective. It retains world bounds, collision, integrator, response and normal
pause/disconnect safeguards. Unscored world sessions are identified in memory
and rejected by the proof recorder. Ordinary v2 recordings and identities are
unchanged. The Academy's existing guide remains usable without a World runtime
factory; no World physics dependencies are added to its package.

## Clearer drone proportions

The shared schematic uses a long slim central frame and four large three-blade
propellers. The prop diameter / diagonal wheelbase ratio is 254 / 420, based on
the manufacturer's [iFlight XL10 V6 specifications](https://shop.iflight.com/product-cat123/XL10-V6-6S-Pro1974).
The user's two photographs informed the silhouette; no photographs, lettering,
branding or third-party model assets are shipped. This is a generic 10-inch
visual reference, not a new physical handling profile or exact replica.

Prop radius grows from 0.205 to 0.496 schematic units while motor stance shrinks
to retain the overall readable footprint. Independent rotation and cyan demand
arcs remain. Motor percentages stay hidden by default, and gray prop surrounds
remain absent. The diagram still renders the actual full orientation quaternion
and measured movement. Motor animation illustrates normalized command demand,
not measured RPM or a simulated ESC.

## Curriculum and research

The next delivery increments are defined in
[the expanded school plan](fpv-mastery-school-plan.md): 32 additional authored
lessons across Experienced, Advanced, Pro and Master tiers, retaining all 26
existing lessons. The first 16 use supported navigation/precision objectives;
the later 16 require explicit replay-verifiable rotation and trajectory criteria.
A route that ends upright cannot by itself certify a full roll.

The plan uses the developer's [FPV SkyDive Flight School progression](https://store.steampowered.com/app/2511190/FPV_SkyDive__Flight_School/?l=english),
[VelociDrone's replay/input guidance](https://www.velocidrone.com/desktop_manual)
and [Rotor Riot's technique vocabulary](https://rotorriot.com/blogs/tutorials-guides/fpv-freestyle-tricktionary).
The authored routes and criteria are original to this project. No commercial
maps, lesson videos, soundtracks or model assets are copied.

## Verification boundary

Functional verification covers command replay, state continuity, actual objective
handoffs, indefinite unscored practice, pause/input ownership, target projection,
full-attitude geometry, localized browser layouts and package admission.
Additional unit coverage remains deferred to R7. Physical-radio latency,
unfamiliar-player teaching acceptance, fluent Ukrainian review and target-device
performance remain separate, unclaimed qualification work. Local playtest and
PR publication do not establish public deployment.
