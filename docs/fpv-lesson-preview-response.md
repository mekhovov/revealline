# FPV lesson examples and visualization response

## Player-facing changes

All 26 learning lessons (122 steps) were checked against their instructions,
control metadata and objective definitions. The old lab mapped every combined
control step to a generic pitch loop, ignoring direction and task. It now uses
step-specific command-driven examples for takeoff, climb, descent, landing,
hover, yaw, travel, coordinated turns, braking, retained Acro tilt and levelling.

The Acro course's **Coordinated left and right turns**, step 4, begins facing
east, banks and yaws left towards north, then counter-rolls to level. Gate
alignment has a separate lateral direction so correcting left never changes
forward pitch into backward pitch. Ground-check, descent, recovery and final
figure-eight hints were corrected in English and Ukrainian. Scored course
geometry, objectives, IDs, pack identities and proof bytes are unchanged.

Each example has a visible phase caption. Preparation reaches its opening
height/heading and any initial drift through real flight commands, bounded to
500 preparation ticks. It does not assign invented attitudes or velocities.
These are **control techniques, not complete route playbacks**. The existing
Watch demonstration action retains verified full-route playback. The explicit
four-axis explorer in the first lesson keeps full-range, both-direction
examples at 0.2× speed. Other step examples use small actual commands at 0.5×;
manual takeover always uses normal speed and remains indefinite.

The shared schematic has bare propellers and cyan demand arcs. Gray surrounding
rings and default motor percentages are removed. Explicit component detail mode
can still show percentages. Each propeller has independent visible speed,
limited to 1.5 revolutions/second at full illustrative demand to remain readable
at slower display cadences. This is normalized command-mix illustration, not
measured RPM, motor-level simulation or an ESC model. Pausing, reduced motion,
seeking and replay retain tick-based behavior.

## Responsiveness

The lab samples calibrated radio input in its own animation frame and displays
current keyboard/touch/radio commands before the next fixed physics tick when
necessary. Attitude always comes from the actual flight integrator. It does not
predict a pose or change the Gentle response profile to conceal latency.

The host no longer redraws the covered WebGL world and hidden flight HUD behind
the opaque guide. Lifecycle, controller discovery, disconnect and menu ownership
still run. Cached step snapshots remove repeated clones, the active guide has
one paint owner, and identical SVG frames perform no writes. Stationary geometry
is retained while propellers rotate; changed pose and position are immediate.

This follows [MDN's animation-frame guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame),
[web.dev's input-delay guidance](https://web.dev/articles/optimize-input-delay)
and its [layout-work guidance](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing).
Input/display work and the intentional flight response are measured separately;
component scripting measurements are not physical-radio or display latency.

## Qualification and delivery

Functional qualification includes all 122 technique profiles through the real
integrator, all 26 unchanged course/pack identities, replay of the 14 bundled
Acro demonstrations, browser checks of localized examples and Modes 1–4,
manual input takeover, propeller geometry, prolonged practice, fullscreen and
pause/disconnect behavior. Optional self-level lessons 01–12 do not yet have
bundled full-route proofs; this increment does not claim otherwise.

An alternating before/after browser benchmark uses the frozen parent
`f8e3f170cdba36676bb5656d48accae56f5bd3ad`, identical workloads, source hashes,
script timing and animation-frame intervals. It excludes full-world GPU cost,
physical controllers, display scanout, novice acceptance and target-device
qualification. Exact results and package admission receipts are linked from the
delivery log. No additional unit coverage is introduced; it remains in R7.

This player-feedback increment precedes the existing R4/R5 art and R6 content
work. Delivery is a focused native-stack child of continuous-practice PR #934,
with existing upstream holds and protected publication preserved. Public live
availability requires later deployment-marker and actual player-launch checks.
