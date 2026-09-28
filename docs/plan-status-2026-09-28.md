# Player experience and character delivery — 28 September 2026

This checkpoint supersedes the **queue, version reservations and ETA** sections
of [27 September's register](plan-status-2026-09-27.md). Preserve that document as
historical acceptance evidence. The active character plan is
[C0–C7](character-game-feel-plan.md); the existing UX, content and community
programme remains in scope where it has not been accepted.

## Public, queued and implemented are different states

The ordinary [public game](https://mekhovov.github.io/revealline/) currently
selects **v0.142.1**, source
`7138e7b6187bf69991d50313c3f9ac1620427778`. This checkpoint read the live
`release.json`, GitHub `main` and draft PR761 directly. Main is now
`a10fcbf8ae982f31d684f8abdc265d7e0338b3db`, including merged player-readiness
PR768. Its publishing revision is separate from the immutable game source. The publisher has published v0.142.1 as GitHub Latest, and the ordinary Pages selector now matches. This is a selector/source check, not an additional whole-player qualification.

The publisher has recorded a successful hosted audit of **2,229 files /
758,963,460 bytes** for v0.142.0. That is the publisher's byte evidence, not a
new exhaustive playthrough by this branch. Public player qualification must be
reported at its actual scope.

The canonical publisher merged the **17-input player-readiness batch**,
[PR768](https://github.com/mekhovov/revealline/pull/768), at 15:58:02 UTC. Publication
and public verification are separate; the selector serves v0.142.1 at this
checkpoint. This actor branch does not allocate its version or start another publisher.

**Draft [PR761](https://github.com/mekhovov/revealline/pull/761)** contains the
character, reference and authoring work. Five earlier implementation batches and cancellation corrections were pushed through
`92fa98912eb5b5509f30f12a200e91afb48fe851`. The sixth checkpoint adds the foreground-contact study and useful loss/recovery feedback; the seventh corrects effective gameplay parity and combined threat guidance; the eighth advances the now-prioritized C3–C6 tracks in parallel, as described below. PR761 is not merged or publicly released and needs reconciliation against
newer main. Compatible
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

| Work                       | Concrete result in PR761                                                                                                 | Remaining acceptance                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| C0 inventory               | Current-entry role/binding audit and reproducible Keep/Repair/Review queue                                               | Regenerate on the integrated source; complete performance and visual review                                 |
| C1 rotor correction        | Shared prepared-rotor path, direction/phase metadata, larger-propeller candidates and actual rendered-frame checks       | Review native bodies on real boards; adopt exact new body/rig revisions without changing historical records |
| C2 comparison tools        | Game Feel Lab and three playable existing missions with the same simulation, exact originals and deliberate 600 ms Retry | Complete capture/loss/counterplay review, audio and consented player sessions                               |
| C3 roster and Team clarity | Seven native body classes and actual-renderer study; prepared bodies remain visible under contact/identity cues          | Production adoption, wider enemies, all states and mode combinations                                        |
| C5 source cohort           | Three original scenes with prompts/provenance plus explicitly opt-in CC0 comparison                                      | Board derivatives, cultural detail corrections and all-mode production review                               |
| C6 authoring               | Motion Lab/Studio rotor editing plus real source-packet import/export, explicit treatment and structured provenance      | Runtime policy adoption, other moving parts/state tooling and full delivery review                          |
| C7 coverage                | Exact binding/disposition queue, unknown scopes and focused evidence                                                     | Every distinct binding, asset family and retained-history path reviewed                                     |

The second implementation checkpoint has **149 passing focused tests**, rendered
body comparisons, keyboard and on-screen-control wins, and responsive browser
checks at 1280×800, 390×844 and 844×390 CSS pixels. Evidence is in
[actor batch 2](verification/actor-batch-2/README.md). These checks overlap earlier
cohorts; their counts must not be added as unique coverage.

The existing Team production-review guard reports **one pass and one failure**:
the source-stage presentation still needs explicit production adoption. Preserve
that blocker. A source-only preview and matching geometry are not production
approval.

## Third batch: playable candidates and Studio controls

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

The expanded final cohort passes **110/110 focused tests**, with scoped independent
review and real-browser layout/play/edit checks. The preview-label and missing
packaged-candidate defects found during verification are corrected. A further
review found and fixed Cancel returning to a hidden or unrelated Mission selector:
Mission, Load and Actors now restore their actual opener, with a reachable closed
setup-summary fallback and retained stale-operation protection. Initial loading
cancellation accurately reports that no prior attempt exists. See
[batch 3 evidence](verification/actor-batch-3/README.md) for exact scope and limits.

Each has its own focused evidence inside one compatible PR. No additional
release version is allocated while the canonical publisher is busy. A finished
subset can be frozen without waiting for unrelated art or human sessions.

## Fourth batch: Scout contrast and measured comparison

The fourth batch adds two native **reference-v4 Scout** images and an explicit
choice beside the retained approved/v3 views. The authored amber battery face
changes only central RGB clusters; silhouette, alpha, camera, motors, hubs,
propeller direction and geometry remain exact. PNG payload is **838 bytes**.
The loader verifies the fixed cohort and source/PNG hashes before swapping it;
no production slot, retained pin or mission original is changed.

The playable tool now optionally records the last **120 actual active frame
intervals** and each painter's JavaScript draw duration. Pauses, loading, the
ready cue and background gaps are segmented; measurements reset after appearance,
effects, size or run changes. It runs both painters even when one view is hidden,
so these numbers are not standalone game FPS or GPU time. The two decoded
candidate images account for a **20,480-byte RGBA lower bound**; shared assets,
canvas/GPU copies and decoder overhead remain explicitly unknown.

**129/129 focused tests pass.** Independent review caught a controller Pause
inside input polling being counted as an active measurement; the host now
checks segment ownership after polling, with a regression through the actual
Pause handler. The real browser completed First Return at tick 414 / 3.45 seconds,
34.3% of a 30% target, three lives and 8,160 points; Retry retained v4 and reduced
effects. Source, loader, reproduction and optional-build classification checks
are recorded in [batch 4 evidence](verification/actor-batch-4/README.md).

**Visual acceptance remains open:** the amber face is stronger than v3, but the
slim body still has weak prominence at small full-board sizes. Keep it a study;
measurement and correct propellers do not justify production adoption. Single-view
play fits board and 48px steering controls at 390×844 and 844×390; the optional
two-view authoring comparison can require scrolling at those sizes. This is not
whole-product or physical-device certification.

## Fifth batch: fix the small-scale body proportion

The full-board audit found no v4-specific renderer scaling/tint defect. The
whole body+propeller envelope is held constant: larger propellers reduce the
frame scale, while v4's battery was half as wide as the approved source. A
612px board therefore showed a roughly 3.58px candidate battery versus 8.94px in
the approved reference. The real contact ring additionally overlaps the centre;
its gameplay position/radius remain authoritative.

The new immutable **reference-v5 Scout** broadens the central equipment without
moving the camera, arms, motors or propellers. The two native PNGs total 868 bytes.
Outer occupied bounds and every rig value remain exact; all v2–v4 bytes remain
unchanged. The opt-in benchmark validates the new named cohort and preserves
accepted setup/picture on replacement, Retry, cancellation and failure.

The expanded cohort passes **137/137 focused checks**. Actual browser raster
checks pass **384 changed frames / 768 held poses**, covering both render paths,
20/24/32px, four headings, dark/light backgrounds and 4/30/60/120fps sampling.
First Return again completed at tick 414 / 3.45s with 34.3%, three lives and 8,160 points.
These are bounded browser/model observations, not production or hardware acceptance.
See [batch 5](verification/actor-batch-5/README.md).

A fresh main audit confirms unchanged default content/actor contracts. Compiled
presentation history advanced FPV93→97 through audio work. The old C0 fingerprint
must be regenerated after integration. The production review gap is now explicitly
mapped: 37 Team, 7 motion, 10 effects/trails and 5 equipment consumer reviews. See
[exact adoption requirements](verification/actor-batch-5/production-adoption.md).
Runtime motion over existing prepared assets can be admitted independently of
optional new body artwork and broader edition production.

## Sixth batch: real foreground contact and useful outcomes

The full native raster study found a concrete defect missed by earlier command
comparisons: Team painted a filled centre marker again after the prepared drone
and its outline. The correction draws one prepared contact outline in the final
foreground pass, keeping fallback markers, exact radius and player identities.
This is a deliberate Team visual correction, not a claim that all old Team pixels
remain unchanged. Solo's default drawing is retained.

The developer comparison adds **Fine outline** as an explicit second-view option.
It narrows only the dark backing, retains the bright circle and pauses safely on
change. Standard remains the default. Both actor sources, headings, edge/overlap
placements and bright/dark scenes are checked with actual decoded images and
real renderers. The 24px Solo diagnostic is explicitly calibrated because default
sizing skips that exact size; a natural 23px case is included separately.

The playable benchmark also replaces raw failure codes and stale recovery text
with event-driven cause/advice, recovery, capture and completion messages.
One terminal live region owns the announcement. Actual browser play verifies
life loss, recovery and victory with two lives retained, followed by focused
deliberate Retry. See [batch 6 evidence](verification/actor-batch-6/README.md).
These are source/browser results, not public acceptance or a six-player pilot.

Final source verification is **202/202 focused checks**, repository/scoped lint,
formatting/native formatting, validation and Motion Lab syntax. Both-pilot native
raster results and their exact scope are retained with the batch. The release
queue snapshot at 17:34 UTC had **16 open PRs / 12 drafts**; the publisher is completing v0.142.1 Pages admission while independent reconciliations continue.
Queue time is separate from the effort ranges below and is not a fixed ETA.

## Seventh batch: benchmark parity and combined threat guidance

The next review found that the comparison tool created a run from its authored
level without the ordinary fresh-attempt Standard tuning. It now applies the
shared pure tuning recipe once, retains the owned effective level for Retry,
and displays authored and effective runtime identities separately. Player
preferences, originals, actor pins and simulation rules remain unchanged.
Earlier batch 1–6 benchmark outcomes remain **untuned authored-level evidence**,
not public Standard balance proof; their visual checks keep their original scope.

Independent tests compare all three benchmark missions with the ordinary source
attempt preparer: initial state, 240 ticks each (720 total), and retained Retry.
Paired effective routes establish locked targets, 90-tick warning, bounded
commitment, capture cancellation and the consequence of extending a cut. Enemy
cooldown does not clear a travelling line impact. Human readability and fairness
still need player sessions.

Field details now compose pursuit/interception state with trail-impact capability
for explicitly combined actors. Current v1 benchmark missions do not set that
explicit carrier flag; their pressure text is preserved. This is a narrow
information correction for supported combined actors, not a new enemy behavior
or a claim that every role description is finished. Slow benchmark decoding
also keeps its loading message until preparation actually finishes.

**65/65 benchmark tests and 20/20 mounted Details/combined-threat tests pass**, along with local lint, formatting, validation and syntax checks. See [batch 7 evidence](verification/actor-batch-7/README.md) for exact checks,
retained failures and native-browser observations. This is another bounded
checkpoint in the same PR761, with no extra release or version allocation.

## Remaining order and estimates — reprioritized by the user

C3, C4, C5 and C6 now run in parallel, including only their actual dependencies.
**C2 moves to the very end and no longer gates wider implementation.** Release
qualification stays with one publisher and does not stall development. The
first seven checkpoints end at `efa336692`; this eighth compatible batch remains
in PR761 rather than opening several release queues.

| Priority            | Remaining item                                                                                                       | Focused effort / external dependency                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Parallel publisher  | Reconcile checked PR761 input and resolve relevant production review gates; immutable release and Pages verification | Depends on admission, exact integrated gates and public checks, not C2                          |
| C3 — active         | Seven-class richer native bodies, enemy roles, Team states and related native-flow gaps                              | 3–5 days; seven-class source cohort complete, production adoption open                          |
| C4 — active         | Optional pressure/combat authoring without downgrading sibling recipes; combinations and replay qualification        | 3–5 days; catalogue bug fixed, real preview presentation next                                   |
| C5 — active         | DroneAid/Ukrainian, cultural, Retro and Coupa cohorts                                                                | 2–4 days per cohort; three source scenes prepared, derivatives/review next                      |
| C6 — active         | Other moving parts, state playback, structured provenance and collection artwork-policy authoring                    | 2–3 days in parallel                                                                            |
| Supporting C0/C1    | Current affected binding coverage, exact body/rig pairing and required bounds/performance checks                     | Included per cohort; wider baseline ½–1 day later                                               |
| C7 / UX6            | Whole-player/content, performance, accessibility, offline and history qualification                                  | 4–7 days plus physical devices                                                                  |
| Remaining programme | Campaign-specific production and other supporting workflows                                                          | Re-estimate from accepted inventory; unrelated bulk production/admin polish does not gate C3–C6 |
| C2 — last           | Actual game-feel comparison, audio/haptics and six-player pilot                                                      | 2–3 days plus participants/listening/hardware after prioritized work                            |

These ranges begin when work starts and are not deployment promises. Independent
cohorts continue during release qualification. Defer additional Scout-only
comparison studies, cosmetic lab controls and unrelated admin refinements;
keep necessary render, import/export, compatibility, safety and source checks
inside each changed feature. No critical validation is postponed merely because
C2 moved.

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
- **Visual scope:** v5 improves native central-body prominence. Native review identified and corrected a duplicate Team foreground marker; the optional finer cue and remaining roster/state review still need production acceptance.
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

## Eighth batch: priority implementation checkpoint

C3, C4, C5 and C6 now advance together; **C2 stays last**. The [batch 8 evidence](verification/actor-batch-8/README.md) records the seven-class body candidate, v9 optional-combat compatibility fix, three original scene sources and the real Studio artwork-packet workflow. These are implemented source slices in the same draft PR761, not complete phases or a public actor release. C3 has56/56 focused checks, C4 has35/35, and the final C5/C6/Studio cohort has17/17; the ordinary local build and all1,796 manifest byte records verify. Counts retain their separate scopes.

The next compatible batch should prioritize C3 enemy/Team states and exact production adoption, C4 readable optional-encounter previews, C5 corrected/prepared board derivatives, and C6 remaining moving-part/state authoring. Wider performance/coverage work runs only where it supports those changes. Extra Scout-only comparisons, audio/haptic experiments and the consented C2 pilot remain deferred. Publication may accept a verified subset while independent development continues.
