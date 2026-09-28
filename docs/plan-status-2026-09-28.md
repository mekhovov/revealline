# Player experience and character delivery — 28 September 2026

This checkpoint supersedes the **queue, version reservations and ETA** sections
of [27 September's register](plan-status-2026-09-27.md). Preserve that document as
historical acceptance evidence. The active character plan is
[C0–C7](character-game-feel-plan.md); the existing UX, content and community
programme remains in scope where it has not been accepted.

## Public, queued and implemented are different states

The ordinary [public game](https://mekhovov.github.io/revealline/) currently
selects **v0.142.0**, source
`813dee5feff5d42c54ef91292f6dd434d39d311a`. This checkpoint read the live
`release.json`, GitHub `main` and draft PR761 directly. Main is
`742e4b142db681e5a6c901b35bfb4d19f0b9c8c5`, the already merged Pages-selector
PR767. Its publishing revision is separate from the immutable game source.

The publisher has recorded a successful hosted audit of **2,229 files /
758,963,460 bytes** for v0.142.0. That is the publisher's byte evidence, not a
new exhaustive playthrough by this branch. Public player qualification must be
reported at its actual scope.

The canonical publisher is preparing a separate **17-input player-readiness
batch**. That integration is ahead of this character work; this branch does not
allocate its version, merge its PRs or start another publisher.

**Draft [PR761](https://github.com/mekhovov/revealline/pull/761)** contains the
character, reference and authoring work. Its last pushed checkpoint at the start
of this review is `9a86e8f50621473a7508c9e723f86bf48bcd38eb`. It is not merged
or publicly released and needs reconciliation against newer main. Compatible
implementation continues in the same draft while the release queue is occupied.

## Completed foundations to preserve

The previous accepted cumulative line already records compact Home/Pause and
Couch entry, direct Journey access, a grouped mission library, Collection
rewards, retained originals and continuation, plus localization, offline,
audio and creator foundations. See the earlier register for their individual
evidence and limitations. These foundations are not a claim that UX6, all
physical inputs, every asset or every original programme phase is finished.

The current source audit identifies **91 Solo / 91 Versus / 12 Team** ordinary
Journey entries. That is a source inventory on this feature input, not a newly
completed balance or public-play matrix. The historical 286-record Library
count includes multiple content sources and does not satisfy the separate
132-new-mission production target.

## Character batch: implemented, not yet accepted for release

| Work                     | Concrete result in PR761                                                                                                 | Remaining acceptance                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| C0 inventory             | Current-entry role/binding audit and reproducible Keep/Repair/Review queue                                               | Regenerate on the integrated source; complete performance and visual review                                  |
| C1 rotor correction      | Shared prepared-rotor path, direction/phase metadata, larger-propeller candidates and actual rendered-frame checks       | Review native bodies on real boards; adopt exact new body/rig revisions without changing historical records  |
| C2 comparison tools      | Game Feel Lab and three playable existing missions with the same simulation, exact originals and deliberate 600 ms Retry | Complete capture/loss/counterplay review, audio and consented player sessions                                |
| C3 Team clarity          | Prepared bodies remain visible under functional contact and numbered identity cues                                       | All richer body roles, states and mode combinations                                                          |
| C5 reference preparation | Referenced Ukrainian/community examples and explicitly opt-in CC0 Synevyr original                                       | New original compositions or separately approved photographic derivatives; no reference is silently promoted |
| C6 authoring             | Motion Lab hub position/radius/direction/phase editing with production geometry validation                               | Studio delivery review and remaining moving-part/state/collection workflows                                  |
| C7 coverage              | Exact binding/disposition queue, unknown scopes and focused evidence                                                     | Every distinct binding, asset family and retained-history path reviewed                                      |

The second implementation checkpoint has **149 passing focused tests**, rendered
body comparisons, keyboard and on-screen-control wins, and responsive browser
checks at 1280×800, 390×844 and 844×390 CSS pixels. Evidence is in
[actor batch 2](verification/actor-batch-2/README.md). These checks overlap earlier
cohorts; their counts must not be added as unique coverage.

The existing Team production-review guard reports **one pass and one failure**:
the source-stage presentation still needs explicit production adoption. Preserve
that blocker. A source-only preview and matching geometry are not production
approval.

## Current bounded implementation batch

Three independent changes are now implemented and checked together, ahead of
wider art production:

1. Put native v3 Scout bodies onto the three real benchmark boards, with an
   explicit approved-versus-candidate comparison, exact candidate validation,
   retained originals and atomic rollback.
2. Compare cosmetic capture pulses and extra event flashes independently.
   Essential threats, contact location, exposed trail, safe ground and recovery
   cues remain present. Presentation toggles do not alter simulation timing.
3. Add accessible per-hub controls to Asset Studio using its existing normalized
   geometry and production validation. Preserve advanced JSON, immutable
   revisions and stale-edit/failure protection.

The combined final cohort passes **105/105 focused tests**, with scoped independent
review and real-browser layout/play/edit checks. The preview-label and missing
packaged-candidate defects found during verification are corrected. See
[batch 3 evidence](verification/actor-batch-3/README.md) for exact scope and limits.

Each has its own focused evidence inside one compatible PR. No additional
release version is allocated while the canonical publisher is busy. A finished
subset can be frozen without waiting for unrelated art or human sessions.

## Remaining order and estimates

These are focused effort ranges **after work starts**, not publication promises.
Queue time, source reconciliation, review failures and device/player availability
are additional. Update them after the current benchmark is assessed.

| Priority            | Remaining item                                                                                   | Focused effort / external dependency                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Now                 | Deliver the checked three-change batch in PR761                                                  | Implementation and local checks complete; publication waits for publisher admission         |
| Next                | Reconcile/adopt the accepted C1/C2 subset and resolve the Team production guard                  | 1–2 days after publisher admission; release gate failures remain blocking                   |
| C0                  | Full frame-time, decoded-memory and download comparison on accepted source                       | ½–1 day                                                                                     |
| C2                  | Actual play/counterplay assessment, audio/haptics and six-player pilot                           | 2–3 days plus participants/listening/hardware                                               |
| C3                  | Remaining FPV/enemy bodies, Team states and native-flow gaps                                     | 3–5 days                                                                                    |
| C4                  | Optional pursuit/interception/patrol combinations and fairness                                   | 3–5 days; preserve original edition/score/replay identities                                 |
| C5                  | DroneAid/Ukrainian, cultural, Retro and Coupa cohorts                                            | 2–4 days per cohort after benchmark acceptance                                              |
| C6                  | Other moving parts, state playback, provenance and artwork-policy authoring                      | 2–3 days in parallel                                                                        |
| UX6 / C7            | Whole-player/content, performance, accessibility, offline and history qualification              | 4–7 days plus physical devices and human review                                             |
| Remaining programme | Campaign-specific art/audio production, community external environments and supporting workflows | Re-estimate from the accepted inventory; not complete and not included in the current batch |

## Blockers and concerns

- **Integration:** PR761 is a conflicting draft based on older source. The
  single publisher must preserve newer accepted UX, localization, production and
  Pages metadata when adopting it. In particular, newer `themeFamily` event
  feedback routing must survive renderer reconciliation.
- **Production adoption:** the Team fingerprint/review failure is real. New
  reviewed successors must retain old fingerprints and originals; do not weaken
  the gate or relabel source candidates.
- **Evidence:** long automated suites remain explicitly waived by the committed
  temporary policy. Focused/browser checks are not full-suite passes, physical
  controller/touch certification, comprehensive offline proof or human balance.
- **Resources:** disk space is limited and another batch is publishing. Avoid
  duplicate full builds, large artifact downloads and extra release worktrees.
- **Creative scope:** broader original artwork, meaningful encounter variety,
  audio listening and playtests still require production and review. A large
  reference list or clean inventory is not finished art.

## Advancement contract

Implement and independently review compatible work in parallel; record evidence
per feature; commit explicit related files to the same draft. The publisher then
reconciles one accepted subset, assigns the next unused version, runs the
required integrated gates, preserves/finalizes immutable assets, deploys Pages
and verifies public bytes and ordinary play. Only then mark that subset
publicly accepted. Failed gates, human/device limitations and unfinished phases
remain visible in the next checkpoint.
