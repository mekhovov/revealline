# Retained actor state, projectile recovery and compact scores — batch 24

Parent: `752df72d66c1a1bbbebb95e9db72fe8de0e1f332`, existing draft PR761.
This batch continues A current characters/reliable play and B optional encounters
in parallel. It does not change missions, art, collision rules, rewards or a
production approval. C artwork review and the C2 human study remain deferred.
An external preservation writer committed source subsets at
`547bb44cb052fb821b1250880cd57632cd64de65` and
`69dd53c88194d0cbf00c8c8c939004f90936ec26` during this batch. Their bytes match the
reviewed/tested sources; this handoff appends the remaining plan/prompt updates and
evidence without rewriting those commits. The manifest pins the complete source set.

## A2 — actual Solo Continue during enemy freeze

The new host regression installs the existing Classic Lab pack, selects Four
Pickups and collects its authored freeze through normal steering. Pause persists
the real suspended replay. A fresh page uses Home Continue to restore that
attempt; Continue remains a direct action. The regression explicitly pauses
after adoption to inspect the held prepared pose, then resumes to the exact
authoritative freeze boundary. The remaining slow effect and subsequent movement
are distinct from freeze. Core checkpoints are compared with the verified replay
and its subsequent fixed steps.

The real BoardPainter paints the prepared bouncer image and its surface marks.
Image identity is retained across pages; cosmetic clock phase is not a saved
simulation property and may reset. The test checks the newly prepared frozen
pose, not an invented requirement to restore the old page's animation phase.
Browser DOM, Canvas, Phaser and image decoding use the existing modeled boundary.
This is not native pixel, physical input or browser-background acceptance.

Initial fixture failures exposed assumptions in the test: an installed v4 pack
cannot be supplied as the built-in campaign, page departure may update `savedAt`,
Home Continue starts directly, and a fresh page must share the persisted asset
database to recover its installed pack. The corrected test preserves the original
authored level and runtime.
Retained logs identify fixture development separately from product regressions.
The final file passes **3/3 Node results** (one parent journey and its two
sequential host subtests), with no failures/skips/cancellations, in 20.58 seconds.

## A3 — short, localized score labels

Historical donor review found a still-present user-facing defect. A legal six-cell
capture with the supported `pointsPerCell: 0.1` produces the exact raw score
`0.6000000000000001`; the old HUD displayed that full floating-point representation.
The parent host regression fails on this actual label, while its integer case
passes.

The existing localized HUD callback now uses `formatNumber` without grouping and
with at most three fractional digits, matching normal result precision. Integer
scores retain five-place minimum padding. The raw score, save, replay, awards and
simulation remain untouched. The exact host checks cover fractional and integer
captures, paused live EN/UK changes, replay verification and no additional storage
writes. No new runtime module or legacy narrow-HUD CSS is introduced.
Both final host cases pass **2/2** in 4.54 seconds. The earlier parent result is
retained as **1 pass / 1 failure**, showing the full fractional-label mismatch;
the test was subsequently formatted without changing its assertions.

## B — actual Sentry projectile contact and recovery

The new practice-host check uses unchanged Sentry Detour, authored Standard,
grid-center steering and seed 1. A short legal route crosses a warned/fired shot
and loses one of the original three lives. It uses actual direction gestures;
holding against an authored wall supplies the waiting interval. It does not use
an injected projectile, changed life count, artificial contact or key-release
braking.

The check follows the projectile identity through warning, fire and impact, then
verifies cause, cleanup, paused recovery and fresh-input resumption. Exact partial
recordings verify the hit and continued flight; there is no terminal/Retry or
complete mission-win claim. Practice writes no progress. The final case passes
**1/1** in 20.47 seconds. It locks at tick 690, fires at 870, impacts at 1140,
respawns at 1218 and reaches a new active cut at 1350. Exact partial replay
checkpoints are `796497074ce1bc30` and `49f4f5629aae51ad`. The authored simulation
identity remains `f548ecb05ac84109`; null decoded artwork leases remain explicit.

All three focused files pass syntax, scoped lint and repository formatting.
Independent source reviews found no blocker. No combined full suite, new native
browser session, production adoption or hardware qualification is claimed.

## Historical donors and delivery boundary

The older story-focus candidate has a current successor, including its four
added focus cases and a newer foreground guard. Solo result-ticket preparation
and retained Retry pins also have current successors. Those older batches must
not overwrite later work. The fractional score correction above is adapted to
the selected game locale; the older OS-locale helper is not copied. The old 320px
HUD layouts conflict with newer handheld rules and require a current reproduction
before any reuse. No historical worktree is deleted or declared disposable.

Keep this bounded source input in PR761 under the existing v0.150.0 milestone.
The single publisher owns reconciliation, required source/provenance/build gates,
immutable publication, Pages bytes and public play. This batch does not qualify
its integrated source or claim a public release. Long suites remain explicitly
waived rather than passed. Production/native artwork review, physical devices,
whole-content/offline checks and human fairness remain open. Small source and
evidence work continues with roughly 600MiB local free space; no build, large
asset download, release extraction or cleanup is started here.
