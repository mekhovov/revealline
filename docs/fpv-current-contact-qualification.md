# R20 — versioned current-contact correction and 1,000 Hz qualification

This change fixes an aircraft resting on the authored floor without being reported as grounded. New aircraft sessions use the v3 backend at a fixed 1,000 Hz; mission rules remain at 50 Hz. Existing v1/v2 behavior, explicit saved frequencies, aircraft coefficients, controller gains, portable rates, and recording identities remain available unchanged. All Advanced results remain unscored.

The source revisions are `4ea49fe9cc3ec008234c7c5bf38419029f812647` (contact correction), `b965834dca2d31bdfd6da9d0642dabf6fd04b129` (qualified timing and recovery/proof handling), `965962775858f7d21aa4f62265fba6fc1a2ad182` (response bench timing), and `68f9a3936` (historical test fixture explicitly pinned to its original v2/500 configuration). The numerical receipt was measured on clean `965962775`; final proof and sustained checks used clean `68f9a3936`, whose runtime files are identical.

## Reproduced fault and contact boundary

In the original Academy `flight-01` **Lift and land**, a centered Meteor75 Self-level flight settled near its physical support height, but remained on the landing objective after 30 seconds. Its raw contact reported `touching:false`, `grounded:false`, no support, and a stationary mission height of −1 mm. A separate 15 cm offset route completed; that did not disprove the centered failure.

The native cached manifold reported approximately +4.490 mm separation while the native query between the same registered terrain collider and the current aircraft parts reported approximately −9 to −14 µm penetration. The body was awake. This establishes a disagreement between the two contact observations; it does not establish an upstream cause such as CCD.

V3 preserves the existing ≤3 mm manifold aggregation. Only when an obstacle has no accepted manifold contact, and a body part has a tracked stale pair, it can supplement the observation with the native current-pose query. The supplement requires actual touch or overlap (`distance <= 0`), a valid normal, and the actual registered body/rotor geometry. A positive gap never becomes supplemental support. Accepted manifold aggregates, disabled actors, named platforms, walls, ceilings, and velocity-based grounding retain their existing treatment. No ground contact is invented from height.

This is a new backend identity because supported contact feeds the existing controller integral-reset policy and recording hashes. No controller policy or gains were changed.

## Rejected proposal retained

The first uncommitted proposal admitted current-query gaps up to 3 mm. It caused an Air65 Acro touchdown to reach 37.03° versus 0.803° with the same commands on v2. All five queried parts still had positive gaps (+27.8 to +121.2 µm), with upward velocity 0.0871 m/s. That premature support cleared the controller integral one substep early. The normal was nearly vertical and unit length; the attitude change was real.

The final zero-or-negative-distance supplement restored exact equality of all 400 observed mission rows against the same-input v2 comparison at 500 Hz, including position, orientation, velocity, support and controls. This comparison isolates the contact correction; it does not assert final 1,000 Hz trajectories equal older 500 Hz trajectories. The rejected source hash, five distances and comparison results are retained in the [regression receipt](fpv-current-contact-regressions.json). That proposal was never shipped.

## Frequency selection and compatibility

The added landing gate drops each unchanged aircraft one metre onto the actual authored Academy floor and checks support penetration at every physics sample. It retains the existing ≤2% response error, thin-wall contact, repeatability, and ≥2× real-time capacity gates against a 2 kHz numerical reference.

The 500 Hz candidate failed: the Nazgul briefly penetrated 4.0846 mm, exceeding the unchanged 3 mm gate. Replaying the identical drop on v2 and v3 produced equal raw traces at each tested frequency, so this limit predates the new contact correction. At 1,000 Hz the Nazgul penetration was 0.4281 mm; the 2 kHz reference was 0.4185 mm. The failed 500 Hz candidate remains in the evidence.

The [complete numerical receipt](fpv-current-contact-numerical.json) qualifies 1,000 Hz as the lowest passing frequency across all fifteen aircraft on this local runtime. Maximum response error was 0.499%, worst floor penetration 0.677 mm, and minimum measured simulation capacity 8.69× real time. Thirty direct replay/recovery cases reproduced their recorded hashes. This was Node 20.19.5 on an Apple M4 Pro, not a browser/device performance matrix.

New v3 sessions default to 1,000 Hz. Explicit historical v1/v2 sessions still default to 500 Hz, and saved explicit frequencies are restored before identity validation in course and Regional sessions. Static course verification reconstructs the recorded 500 or 1,000 Hz schedule; its no-argument historical cursor remains 500 Hz. Unsupported 250 Hz course proof remains explicit. The response bench and tuning assistant run at the selected configuration's actual frequency and reject mixed backend/timing comparisons. One physics-step timing tolerance is therefore 1 ms at 1,000 Hz and 2 ms at 500 Hz. Browser input freshness and the 50 Hz mission clock are unchanged.

## Software verification

- **Core behavior:** 176 aggregate TAP passes (including grouped-test parents, not 176 separate flights): 112 companion-suite passes plus the final 64-pass contact file. The first mixed invocation also had a missing sparse historical-fixture loader failure; that infrastructure failure is retained, and the complete affected file passed after restoring its exact committed fixture. These focused checks ran against the final core source before its commit.
- **Ordinary mission progression:** every aircraft in Acro and Self-level completed both the unchanged centered Academy Lift and land and World Meet your drone routes: 60 cases. Academy completion ranged from 5.66–5.94 s; World completion ranged from 6.04–6.28 s. Per-case physical/configuration and landing observations are in the regression receipt. These are two authored courses, not every map/objective combination.
- **Contact boundaries:** synthetic stale-manifold tests hold solver stepping while retaining the native current-shape query. They cover positive gap, overlap, approach/separation, floor/platform/wall/ceiling/tilt, absent pairs, disabled actors and preservation of an existing accepted aggregate. Their scope is distinct from the untouched-solver flight cases.
- **Bench/assistant:** 37 passing tests cover versioned defaults, explicit 500 Hz configurations, actual separately stepped hash agreement, per-step metrics, candidate tolerances, mixed-timing rejection and EN/UK labels.
- **Static course proof:** 42 passing cases on clean committed source, including all fifteen aircraft in both modes, the immutable historical v2/500 fixture, canonical reconstruction, gate direction, tampering, incomplete clips, cancellation and bounded clocks. Proof remains diagnostic and unscored.
- **Sustained flight:** 35 unique cases pass across two recorded attempts on identical source. The first completed all thirty catalog runs plus the 735 s Meteor75 run; four Regional starts lacked a sparse authored fixture. Only those four cases were rerun after restoring the exact committed delivery. Original failures and successful retry are both preserved in the [sustained receipt](fpv-current-contact-sustained.json). The 735 s run was airborne for 730.08 s and resumed exactly from its checkpoint. Four Regional cases cover Meteor75/X650 in both modes, physical landing/relaunch and transactional terrain rejection at a 60 s recording boundary.

The sustained helper uses ordinary bounded feedback stick commands; it never changes body state, aircraft gains, gravity or collision geometry. It verifies active flight, configuration, pause, recovery and retained-segment bounds. It does not assert whole-process memory, IndexedDB retention, full archived-session quotas or a real-time performance gate. Course goals are independently covered by the mission and course-proof suites; a sustained World flight does not imply all its adventure objectives were completed.

## Release and evidence limits

Runtime source is frozen and independently reviewed. Integrated package qualification, centered keyboard acceptance in the emitted Academy build, and normal CI/public deployment are recorded separately against their own integrated revisions in the [current completion plan](fpv-current-completion-plan.md). The local receipts here do not replace those release checks. No scored promotion, device/radio qualification, cross-browser deterministic guarantee, measured aircraft fidelity or real-pilot validation is granted here.

Historical recordings use their frozen backend and timing. The unresolved local archive-disappearance observation remains separate; safe recovery-handle reopening and this contact correction do not prove storage retention under eviction or device pressure.

Receipt hashes identify selected source files and repository revisions, not a complete transitive loaded-module integrity proof. Logs and larger rejected-proposal observations are named with SHA-256 in the regression receipt; those local diagnostic files are not deployed assets. The checked-in receipts retain the meaningful numerical rows, failed proposal, test counts, source identities and sustained retry history.
