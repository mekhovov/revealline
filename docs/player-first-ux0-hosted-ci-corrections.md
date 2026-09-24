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
