# LongRail supplemental route review — 2026-10-17

Status: reviewed route proposal with a pending native preflight declaration. No browser run,
performance qualification, or historical prerequisite promotion is established here.
The original timing recipe, first supplemental recipe, retained failures and
mission definition remain unchanged.

## What the native preflight established

Run `38992974770`, tooling `bffcbd838a7bb925da8aaf030695773f893d8bda`, used the
original baseline `b11745223861c3973ad4bf440cc536198b8e0371` and candidate
`3adcd53792043ef02459e86168c6b33a66d6ef00` packages. Both complete retained
artifacts are under `.cache/solo-followup/remote-supplemental-38992974770/`.

| Arm                | Observed route outcome                       | Native mechanics                                                                                                                   | Application input samples                                  |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Chromium baseline  | Result; lost/self-contact at tick 3584       | Partial strict native checkpoint matches; 1 closure, 35 trail cells, 4 moving direction changes                                    | Unobserved baseline diagnostics                            |
| Chromium candidate | Result; lost/self-contact at tick 5610       | Partial strict native checkpoint matches; 2 closures, 34 trail cells, 17 moving direction changes                                  | 23 keyboard-to-render samples; route still failed          |
| WebKit baseline    | Result; action 38 cannot observe running     | Partial export timed out in Help & Extras; loss cause and checkpoint unobserved                                                    | Unobserved baseline diagnostics                            |
| WebKit candidate   | Explicitly paused after completing the route | Completed strict native replay matches; 2 closures, 34 trail cells, 25 moving direction changes; all three required mechanics pass | 27 keyboard-to-render samples; native preflight row passed |

The WebKit candidate raw numerical status is **fail** and performance remains
**excluded**. Its job/cohort failed because the baseline failed. The candidate
row itself passed the native preflight. Both candidate application summaries
record zero interruptions. Chromium candidate's terminal route failure must not
be described as an overload pause. Partial recordings have no declared completed
scenario mechanic checks, even where their strict native checkpoint matches.

The prior model perturbed only the added steering holds, while fixing the
original approach and inter-action gaps. A separate sensitivity reconstruction
combining the observed Chromium approach with 120-tick downward / 122-tick upward
holds encounters the outer patrol near the upper edge, then loses further lives
through reversals after respawn. The unchanged native recording establishes the
terminal loss. All three retained recordings have a strict Node portability
mismatch, so the Node event reconstruction is a hypothesis about the collision
sequence, not a substitute for native verification.

## Proposed separate route

The new fixture is
`fixtures/solo-latency-supplement/long-rail-anchored.qualification.fixture`.
It uses the same public import/preview/Start controls, immutable LongRail mission,
Scout class, immediate turn policy, and 240-second scenario deadline.

| Public action                          | Hold              | Purpose                                                                        |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| Neutral admission                      | 1 s               | Declare a bounded initial delay                                                |
| Up                                     | 1 s               | Anchor at the top edge                                                         |
| Right                                  | 5 s               | Anchor at the right edge; the authored speed pickup may activate               |
| Left                                   | 0.2 s             | Move into a small but nonzero inset; exact subframe positioning is unnecessary |
| Down                                   | 6 s               | Complete a full-height cut                                                     |
| Down, after releasing the previous key | 1 s               | Reanchor at the bottom edge                                                    |
| Up                                     | 2 s               | Move inside the captured strip                                                 |
| Down / Up, alternating 22 commands     | 0.5 s each        | Exercise meaningful reversals inside secured cells                             |
| Public Pause, snapshot, export         | Existing controls | End the observed workload and retain replay                                    |

The 29 timed actions total 27.2 seconds. The route has 28 cardinal key holds,
including 22 dedicated steering commands. Nominal model output has one closure,
34 trail cells and 68 claimed cells. It is intentionally a different workload
from the earlier two-cut route and cannot replace its results. The full-height
cut and original mechanic gates remain: closures ≥1, maximum trail cells ≥20,
moving direction changes ≥20. Candidate admission must still require at least
20 observed keyboard-to-render samples; planned commands are not sample proof.

## Finite model evidence and required release review

`scripts/test-solo-latency-anchored.mjs` checks all 313 declared schedules:

- Nominal schedule.
- Every timed action individually shifted by −12/−6/−3/+3/+6/+12 simulation
  ticks, and uniform/alternating shifts across all timed actions. Twelve ticks
  equal 100 ms at 120 Hz.
- Neutral gaps after every action of 1/3/6/12/24 ticks (up to 200 ms).
- Initial neutral admission from 0 to 2 seconds in 100 ms increments.
- One hundred seeded combinations of independently varied ±12-tick holds and
  0–12-tick inter-action gaps.

Every schedule remains running with three lives, reaches each declared board
edge, steers without creating a new trail, passes the original mechanic minima,
and passes strict replay of that model-generated recording. The two test cases
passed on Node 22.22.2 in approximately 16 seconds. Core/replay source bytes are
unchanged from the candidate source. The result is model evidence only; finite
perturbation coverage does not prove browser scheduling or native arithmetic.

The prospective supplemental manifest selects only the new
`latency-long-rail-anchored` phase. It binds the failed predecessor and both retained
artifact/summary hashes. The one-shot workflow requires the next PR synchronize
event to have prior head `bffcbd838a7bb925da8aaf030695773f893d8bda`; every other
phase remains held. Root review of this concrete declaration is still required
before the coordinated push. The two engine jobs contain serial baseline/candidate
pairs, with the existing package/source/archive/owner/replay guards, 240-second
scenario and 480-second row bounds. This creates four diagnostic observations,
not a three-repeat timing cohort.
Keep the original first-eight result false, numerical failures visible,
performance excluded and automatic retry/continuation disabled. No source
revision, gate, input minimum, original route or deadline changes are authorized
by this note.

Model scratch results and the failed exploratory route attempts are retained
alongside the original artifact directories. They must not be presented as
native-browser runs or discarded in favor of only the successful model route.

## Native preflight retained 17 October 2026

[Run 38995660502](https://github.com/mekhovov/revealline/actions/runs/38995660502)
ran the reviewed four observations on tooling
`1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f`. The actual packages remained candidate
`3adcd53792043ef02459e86168c6b33a66d6ef00` and baseline
`b11745223861c3973ad4bf440cc536198b8e0371`; newer runtime changes are not measured
by these results. Full source/archive setup passed for both engine jobs.

| Observation        | Preflight            | Native strict replay | Keyboard render samples | External work p95 / max | External missed opportunities |
| ------------------ | -------------------- | -------------------- | ----------------------: | ----------------------: | ----------------------------: |
| Chromium baseline  | Pass                 | Pass                 |              Unobserved |         15.0 / 390.9 ms |                        4.932% |
| Chromium candidate | Pass                 | Pass                 |                      28 |          10.3 / 30.8 ms |                        0.303% |
| WebKit baseline    | **Fail: page error** | Pass                 |              Unobserved |             15 / 159 ms |                       54.075% |
| WebKit candidate   | Pass                 | Pass                 |                      28 |              10 / 28 ms |                       52.292% |

Every native reconstruction verified the exact mission/options and checkpoint,
one closure, 34 trail cells, 68 claimed cells and 25 direction changes with
movement. Chromium was 151.0.7922.34; WebKit was 26.5. These are the declared
hosted Linux desktop/mobile context strata, not physical-device observations.
The separate Node reconstructions mismatch floating-point player/enemy state in
all four recordings and remain retained as portability evidence; they do not
replace the successful same-engine verifications.

WebKit baseline retained one empty page-error message during action 4 (`follow`)
at `2026-10-17T02:44:17.560Z`, with the observed top-level URL still the playground.
Its final assertion correctly failed even though all controls and native replay
completed. The available witness cannot attribute that empty error to a specific
script or browser operation. It is not ignored, retried, or labeled a route
failure. All four command owners closed normally without forced cleanup,
violations, ambiguity or survivors; no page errors occurred in the other rows.

All four raw numerical statuses are **fail**. Both candidates record zero internal
interruptions, but internal pre-play cadence admission is unavailable, leaving
their input-latency gates unobserved despite 28 samples. The independent external
cadence B remains 16.7 ms for Chromium and 16 ms for WebKit; it is not substituted
for internal calibration. Candidate keyboard-to-render p95 upper bounds are
24.8 ms and 50 ms respectively. The WebKit candidate's largest prior-running
interval is 110 ms at the explicit transition to paused; that boundary observation
must not be silently dropped or asserted to be an active-play stall. No numerical
or prerequisite gate is promoted by the three passing preflight rows.

Both archives passed exact API size/digest, bounded ZIP extraction and every-member
readback checks. Local evidence is
`.cache/solo-followup/remote-supplemental-38995660502/{chromium,webkit}/retained`.

| Engine   |    Artifact | ZIP SHA-256                                                        | Summary SHA-256                                                    |
| -------- | ----------: | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Chromium | 12086798338 | `fe95b56d5dc19374341c73895e2f795b8ae6a1a78cec4489f4b77c67fc535226` | `38bd192eb0f169bd256f99857b7c9bcefe071f0387fe9842cd329af9e0fcf0c8` |
| WebKit   | 12087695323 | `0eee46546743a9b93812de15409692b2a7c672b5a692b13dd5058ba4a5cc6eeb` | `48176474e445f656fee158a9d0d12f92cfd5250074c6eeadbc9f127df33b7e77` |

The independently recomputed assessment agrees with all four stored outcomes.
Its compact `independent-analysis.json` is 23,598 bytes with SHA-256
`99ecc2748dcf7ef64a97d5b8e6be648de5c8bffaa173aca52ebc337fb7695c1a`.
