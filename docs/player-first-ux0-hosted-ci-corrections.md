# UX0 hosted-CI correction record

This record supplements `docs/player-first-ux0-verification.md` for the final
v0.98.0 candidate. It does not replace fresh exact-source CI, release
qualification, browser verification, or physical-device evidence.

The first complete hosted run for source
`26fe20f8c00aa2d09238595c8856fa5572ea0561` executed 12,803 tests: 12,788
passed and 15 TAP failures represented 13 underlying cases. Shard 2 passed all
2,976 tests. The raw logs and failure inventory remain immutable evidence; the
failed run is not a release qualification.

Four cases were corrected in checkpoint
`d48cd6bec8be57666430f09821dcd0bdd6db7127`. The remaining nine cases were
reproduced at their actual asynchronous boundaries and corrected in checkpoint
`f2bed8c44130794548569daaadf46876552aa836`:

- title Missions and equipment preparation now join their real owned operations;
- Solo and Versus continuation tests join the actual Next/catalogue work while
  preserving finished boards, pictures, cancellation and retry;
- backup tests wait for the real replacement-review handler, then still require
  explicit player confirmation before mutation;
- cancelled Versus gallery opening is joined so late completion cannot reclaim
  focus after blur, focus change or pointer input.

The only runtime delta after d48 returns Solo's already-existing boundary
`nextLibraryMission()` promise. It creates no operation, changes no simulation
timing, and does not weaken foreground, cancellation, focus or ownership guards.
All other corrections are host-test synchronization.

Focused qualification passed the complete affected files: modal navigation
54/54, equipment 7/7, Versus continuation 10/10, Solo continuation 4/4,
Countercurrent 4/4, Fracture 4/4, and Versus mission-library 20/20. Controlled
delays reproduce every original failure and the corrected cases pass. The backup
observer lifecycle passes 5/5. Syntax, scoped lint, repository formatting and
independent read-only reviews pass.

The candidate remains blocked until a new hosted full suite passes on the exact
final PR head. After that: merge, exact-source qualification, immutable freeze,
release publication, archive admission, Pages deployment and public input/play
verification. UX1-A starts only after v0.98.0 is publicly accepted.

## Exact-head run 35976493810

The first full run on `324af83a05cdbc6797a0f99e9e17bed7e2773e19`
passed preflight, the ordinary build and shards 1, 3 and 4. Shard 2 executed
2,976 tests with 2,975 passes and one failure; the full matrix therefore
executed 12,803 tests with 12,802 passes, one failure and no skips or
cancellations.

The remaining failure was the unchanged missing-storage Versus catalogue host
waiting ten seconds for a cold gallery open. The run took 10.66 seconds at that
boundary, while every behavior assertion after opening was still unexecuted.
An 11.5-second delay in the actual mission-library index request reproduces the
same expiry and late teardown rejection locally; the unchanged case passes under
normal timing.

The narrow correction observes the real All missions handler, asserts its
immediate Preparing missions status and joins the owned opening promise under a
finite bound. It retains the real focus/click, degraded-capability messages,
Base launch, installed-content unavailability, zero pack writes and exact
incoming-Journey cases. The complete file passes 6/6 and the corrected delayed
case passes; no runtime source changes. A fresh full hosted run on the corrected
head remains mandatory.
