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
