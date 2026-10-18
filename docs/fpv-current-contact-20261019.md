# Centered aircraft landings — 19 October 2026

## Correction and version boundary

R20 is implemented and independently reviewed on
`4ea49fe9cc3ec008234c7c5bf38419029f812647` (tree
`f212622f4c25898a6b08e02839f566c7a32776d7`), integrated as
`af7e3cb112b3fbeb1d819b6d91db0a6a592f2845`. Runtime, scripts, game and publishing
paths are identical between these commits. The 500 Hz default at this contact-only source is not numerically qualified by
the expanded contact gate below. The explicit timing follow-up is now committed
as `b965834dca2d31bdfd6da9d0642dabf6fd04b129`, followed by bench alignment
`965962775858f7d21aa4f62265fba6fc1a2ad182`. Their integrated equivalents are
`12b6655fa` and `5de3166e4`. Final numerical/sustained qualification and representative packaged acceptance now pass; normal publication and source-bound public acceptance remain. The [final qualification](fpv-current-contact-qualification.md) and [integrated acceptance](fpv-flight-integrated-acceptance-20261019.md) supersede pending statuses while preserving the historical measurements below.

The original Academy Lift and land lesson could stop at its second objective
after a centered Meteor75 landing. The drone rested at approximately −1 mm with
zero velocity, but reported no contact. The cached Rapier manifold distances
were about +4.49 mm, beyond the existing 3 mm observation tolerance, while a
query against the same registered collider and current aircraft shapes showed
9–14 µm of overlap. The [original failure](fpv-centered-landing-observation-20261018.json)
is retained. Authored objectives and their thresholds are unchanged.

New ordinary flights use `civilian-quad-aircraft.v3` or its Regional variant.
For each registered obstacle, v3 preserves an already-valid contact aggregate.
Only when tracked manifolds produce no accepted contact does it query the actual
body and rotor shapes at their current poses. Supplemental evidence must show
touch or overlap (distance at most zero); proximity alone is insufficient. The
normal comes from the actual registered obstacle toward the aircraft. Disabled
actors, untracked pairs, airborne gaps, walls and ceilings cannot become invented
floor support.

The existing v1/v2 paths and their controller behavior remain unchanged. Recorded
backends remain explicit through worker recovery, replay and archive verification;
a subsequent fresh attempt returns to v3. No aircraft gains, geometry, mass,
motor constants, rate profiles or controller policy were retuned.

## Rejected intermediate proposal

The first uncommitted proposal accepted supplemental positive distances within
3 mm. It completed the centered Academy cases but failed a broader World Air65
Acro touchdown check: actual body tilt reached about 37°, above the unchanged
25° gate. Same-input v2 peaked at 0.8031°. This was a physical response change,
not merely an incorrect displayed surface normal.

At the first extra supported observation, all five current-pose distances were
still positive (+27.8 to +121.2 µm) and the aircraft moved upward at 0.087 m/s.
That premature support cleared the existing controller integral one 2 ms step
earlier; the small output difference amplified during touchdown. The final
overlap-only supplement rejects that gap. All 400 recorded comparison rows now
match v2's quaternion, grounded state and input exactly, with the same 0.8031°
peak. The existing manifold tolerance and landing gate were not relaxed.

Rejected-proposal evidence is retained in
`/private/tmp/fpv-r20-rejected-per-part-proposal.patch`, its `.sha256` file,
`/private/tmp/fpv-r20-air65-substep-observation.json`, and
`/private/tmp/fpv-r20-air65-version-comparison.json`. The final comparison is
`/private/tmp/fpv-r20-air65-overlap-comparison.json`. These identify a rejected
development proposal; the 37° regression was not released.

## Automated acceptance

The final focused course suites pass **112/112**, zero failures or skips. The
log `/private/tmp/fpv-r20-final-focused-courses.log` has SHA-256
`6a4d98d456848ba74b98477dc304fe088eece3b39119b8c7dd6652d5d6c5cd44`.

This includes all fifteen aircraft in both modes completing the unchanged
centered Academy lesson, and all fifteen in both modes completing the World
ground/lift/landing lesson: **60 complete scripted flights across two courses**.
The scripts submit ordinary controls to the full physics simulation. They are
not manual flights or coverage of every course.

Additional tests cover pre-change v1/v2 identities and hashes, actual worker
continuation, v3 full-tail course verification, recovery followed by a fresh
attempt, and rejected Regional intervals/terrain rollback. Synthetic boundary
unit tests hold explicit poses and provide stale manifold evidence while querying
the real pinned shapes; they isolate positive gaps, slow rebound, overlap,
surface direction and disabled actors. They are separate from the 60 flights,
which retain the full native solver. Scoped lint, formatting and diff checks pass.

Independent review checked the pinned Rapier 0.21.0 declaration semantics and
archive provenance: contact results are world-space, with `normal1` pointing
outward from the first shape. Directional native-query tests independently check
this convention. No cached-normal substitution was added.

## New numerical finding and timing follow-up

The fresh all-fifteen comparison passed response error, repeated hashes and local
capacity at 500 Hz, but the Nazgul 1 m zero-throttle floor drop reached 4.085 mm
penetration, exceeding the unchanged 3 mm contact gate. Same-input v2/v3 drop
traces are identical: this is a newly measured existing limitation, not a contact
correction regression. The 2 kHz reference reached 0.419 mm.

The lowest candidate passing every gate is **1,000 Hz**. Across all fifteen at
that frequency, maximum response error is **0.4986%**, maximum floor penetration
**0.676 mm**, and minimum local capacity **5.14× real time**. These measurements
are specific to this available machine/runtime. They do not qualify other devices.
Evidence: `/private/tmp/fpv-r20-qualification-4ea49fe9c.json` and
`/private/tmp/fpv-r20-nazgul-drop-comparison.json`.

The explicit v3 default of 1,000 Hz is implemented and independently reviewed. Existing
v1/v2 defaults and all recorded frequencies stay unchanged; mission steps remain
50 Hz. Physics frequency is not fresh controller-input cadence. Rendering quality
will not change the physics frequency. The 500 Hz source above passed **19/19
package checks**, but that does not close its numerical failure or qualify the
upcoming timing source. No acceptance threshold was relaxed.

The timing follow-up passes 176 focused contact/course/history/Regional/runtime
checks, with zero failures. An initial sparse-checkout fixture-loading failure
was corrected by restoring the unchanged tracked fixture and rerunning that
file. The response bench passes 37 checks and now records the actual fixed
frequency, measures every physics step and allows at most one such step in its
time-regression gate. Explicit historical 500 Hz bench jobs remain supported;
comparisons reject different backends or frequencies. Input and displayed traces
remain 50 Hz. No heavy runtime dependency was added to the main-thread panel.

## Package capacity prerequisite

Main's translation inputs grew by 8,062 bytes after this branch's base. The
pre-integration margins therefore cannot qualify the next release. Separately
reviewed generator deduplication (`db42e5285`, integrated as `2eceaed37`) reuses
two already-admitted stateless presentation modules and saves 5,106 bytes. All
58 projection/menu checks pass. The [exact AST receipt](fpv-shell-source-dedup-20261019.json)
confirms every other generated node is unchanged. No package cap, admission,
physics identity or archive algorithm changes. Final integrated measurement now passes: Academy has 2,681 original-input and 36,463 emitted bundled bytes spare, with unchanged caps/admissions. See the [exact final receipt](fpv-flight-integrated-package-20261019.json).

## Final acceptance and remaining release gates

Final 1,000 Hz numerical/replay/sustained qualification is complete on the source bound in the [qualification report](fpv-current-contact-qualification.md). The latest-main integrated source `cfdf24d61` passes all 19 package checks and the 420-flight sample. The actual emitted Academy build completed the original Meteor75 lesson by keyboard in 8.58 seconds, verified course completion through the real worker, and restored paused at 10 seconds. The descent included a bounce before settling. World Nazgul Self-level/Acro checks also pass within their recorded short-flight scope. [Detailed packaged acceptance](fpv-flight-integrated-acceptance-20261019.md).

Normal final review/integration, hosted checks, deployment and source-bound public acceptance remain. After rebase, compare the qualified runtime and package inputs before carrying the receipts forward; rerun relevant checks for actual differences.

These gates establish software/numerical behavior. Physical radios, measured aircraft data and pilot comparisons remain separately deferred. R13 missing archives remains unresolved and is unaffected by this contact correction.
