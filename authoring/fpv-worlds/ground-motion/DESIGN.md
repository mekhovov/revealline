# Versioned ground movement

`groundMotion: "support-v1"` is optional on patrol, sentry and vehicle actors.
Absence keeps the existing motion branch and stays absent from normalized course
data. No WORLD_RULES default, actor snapshot field, model/backend change, player
physics, rendering, input or reward change is introduced. The authored field is
already inside courseIdentity; new recordings require the new exact course.
Older course validators reject the unknown actor key before installation.

The pinned Rapier controller retains its 10 mm offset, 0.2 m autostep,
0.22 m snap bound and 30-degree slope limit. The opt-in request supplies a minimum
1 mm downward component, instead of legacy 10 mm. Its support clearance is
12 mm along the support normal: controller offset + downward request + one
integer millimetre. The existing support query already compensates the spherical
foot on an incline. Normal clearance is converted to a vertical correction.

The original character controller sweeps the full ball/capsule. Positive vertical
correction has a separate full-shape sweep and is refused if obstructed. The
correction never pulls the actor down: native step/edge support remains valid
while a body straddles an edge. An actual nearby walkable center support is still
required within the existing 220 mm bound. After the body clears a step, the
manual cases measure settling independently. The final motion result is rounded
using the existing integer convention.

Opt-in displacement larger than the actor radius is divided before the same
controller/support queries. Radius minus two millimetres leaves room for vector
component rounding; the schema permits at most four pieces (15 m/s, 50 Hz,
minimum radius 100 mm). Unsupported pieces retain the last safe position.
This checks the tested 220 mm gap at 300 mm/tick; it does not claim that every
small gap is impassable. Bodies can bridge gaps smaller than their support span.

All geometry queries retain the existing static-collider filter. No obstacle ID,
Harbor coordinate or replacement platform is special-cased. The same unchanged
controller instance is used with unchanged settings; the per-actor collision
proxy owns the opt-in. No additional native controller or material is allocated.

## Why the original and intermediate candidates failed

Actual ordinary Harbor flights stopped indefinitely on finite boxes, and the
same envelope as a closed mesh also stopped. The half-space controls continued.
A native contact trace at an exactly 10 mm-separated vehicle returned only
0.0921 mm upward and 0.0111 mm forward movement. Integer rounding retained the
same state forever. A patrol showed the same fixed point. This is distinct from
an authored path blocked by a wall.

The first candidate only normalized to the existing 10 mm separation and failed.
An 11 mm candidate improved two decks but exposed narrow-capsule stalls and an
unswept ceiling lift. A 21 mm trial was retained but not selected. The final
1 mm downward/12 mm normal separation passed the targeted cases while retaining
the native controller offset.

An added endpoint intersection/contact veto was also rejected. On the 29.9-degree
mesh seam it reported −6.524 mm overlap with contact witnesses 4.389 m apart,
where independent plane geometry showed +12.586 mm clearance. The native
controller movement and upward sweep were safe. Removing that redundant veto
retains both swept-motion guards and avoids accepting an unreliable endpoint
classification. Tight and thin ceiling cases exercise the correction sweep.

The 159 mm center-ray gap observed while a sphere straddled a 150 mm step was not
silently snapped down. Once the complete body cleared the step, measured gap was
at most 13 mm in the bounded cases.

The original static authoring survey advanced toward ideal points and could
accumulate catch-up requests. It was diagnostic only. The decisive regression
and acceptance runs use actual createWorldFlight at its native 50 Hz with
ordinary neutral input; no actor pose is assigned after construction.

## Compatibility and publication

After integrating P1's FlightCourse.v3 pursuit runtime, the same optional actor
field remains inside the exact course identity. P1's conditional vehicleModel
schema, pursuit state, controllers, recording versions and definition data are
preserved. Native pursuit graph admission already shares checks for equal body
shapes; the integrated key additionally includes groundMotion only when present.
Real query observation showed mixed policies otherwise skipped the second
policy entirely. This changes admission coverage, not pursuit decisions or
movement. The absent-policy key and its deduplication remain exact.

The bounded integration includes both policy orders, native thin-ceiling refusal,
and eight synthetic mixed-policy V3 partial-practice recordings with independent
replay and rejection after removing the flag. It does not claim every authored
mixed-policy graph is traversable, or that these partial recordings complete a
pursuit course. See evidence/integration-p1 for unchanged retained V3 completions
and full Festival/Harbor recording comparisons.

Malformed groundMotion values and ineligible actor types remain invalid data.
A well-formed future value on an eligible type receives the narrowly typed
unsupported-ground-motion error and existing truthful EN/UK update guidance.
The guidance does not promise that the latest runtime supports arbitrary future
features. No data, recording or offline cache is cleared automatically.

Both existing Library cohort indexes stay unchanged. A future Harbor row using
this field needs a new fixed capability-cohort endpoint before registration;
older surface-coating-only players must not discover an unsupported pack there.
Direct import of a compatible new pack can be qualified independently. Eligible
older rows must be carried forward when that future cohort is introduced.

The manual qualifier is not new default unit coverage. Completed Harbor routes,
legacy proof corpus, native old/new importer and editor behavior, package
admission and held Draft publication remain separately recorded gates.

Reference: [Rapier0.21 character-controller documentation](https://rapier.rs/docs/user_guides/javascript/character_controller/),
read 5 October 2026. It documents numerical sensitivity of the offset, fixed
controller configuration, swept movement and bounded snap conditions.
The [Collider.contactShape reference](https://rapier.rs/javascript3d/classes/Collider.html#contactShape)
describes world-space contacts, while its ShapeContact distance uses a negative
value for penetration. The contradictory witness/plane result above is a
retained observation of this pinned build and geometry, not a general Rapier
defect claim.
