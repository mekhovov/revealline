# Actor batch 15 — playable roster review

Parent `eabfb0e7172b57cdd58f1e46b6e36f75e047d1a6`, draft PR761.
This is a bounded **A2 current-character adoption prerequisite** in the approved
A → B → C order. It extends the existing comparison route; it does not start
another tool, approve artwork, or move the deferred C2 human study forward.

## Delivered source

- All seven current FPV classes can use their real core recipe on the three
  existing review missions. Scout and approved imagery remain the defaults.
- Explicit V6 comparison authenticates the exact 78,267-byte manifest
  (`49c0ff40b5107eafe39b65a827339608b11b2a534d8a96767617c90b68651535`),
  all fourteen metadata records and five construction-source hashes; only the
  selected class's native 32/64 pair is fetched/decoded. The fourteen existing
  PNGs total 6,240 bytes. No source artwork or immutable manifest changed.
- Legacy Scout v3–v5 remain available and unchanged. Other classes cannot select
  those studies through the UI or API. Candidate images delegate every other
  actor to the independent approved lease and cannot change its pin.
- Craft changes prepare a fresh scene atomically. Cancel/failure retains the
  accepted run, picture, class and comparison; late work is disposed. Retry keeps
  the accepted setup and visuals through the existing 600 ms cue.
- The three current missions use `arcade-actions.v1`: Boost, ability and pickup
  inputs are deliberately disabled by their authored rules. The page now hides
  the previously misleading Boost button, omits its shortcut hint and explains
  this restriction in setup. No equipment-enabled mission or new action was added.
- The optional distribution names only the fifteen V6 cohort files. All candidate
  dependencies remain optional tooling; no Solo/Versus/Team core closure expands.

## Verification and corrections

Node22.22.2:

```text
node --test --test-reporter=spec game/test/playable-benchmark*.test.mjs game/test/playable-roster-*.test.mjs game/test/retry-view.test.mjs
127 tests, 127 pass, 0 fail, 0 cancelled, 0 skipped
```

Coverage includes all seven classes × three real missions, 240 movement ticks,
pause/Retry and exact ordinary-core checkpoints; a further 120 ticks per pair
prove held/fresh E/R/Boost cannot bypass Arcade policy. Selected-image tests
cover all seven × three treatments, immutable authentication, geometry, bad bytes,
failed decode, cancellation and late disposal. Actual host handlers verify rapid
class switching, restored selectors/focus, retained V6 on failed/cancelled
replacement, and default restoration. Existing real BoardPainter checks cover
thirteen comparison choices across two widths, effects and paused/running states
(104 modeled draws); these are not browser-pixel acceptance.

Two test corrections were required and are preserved here:

1. The first expanded packaging assertion compared an unordered roster list with
   the collector's sorted result. It now compares exact sorted membership, still
   rejecting extra/missing files.
2. The broad group first reported **115/116 pass**: an older outcome fixture
   treated `combat-projectile` as unknown after the prior optional-sentry change
   registered that cause. The unknown fixture now uses a genuinely unregistered
   cause; a new test explicitly requires the sentry reason/tip and ordinary
   recovery. Malicious/coercion cases remain. No runtime advice was weakened.

Scoped lint/format and diff checks are required for the final checkpoint.
No build/archive materialization ran: available disk fell from ~502 MB to ~110 MB,
below the publisher reserve. Two temporary-file write attempts failed without
damaging the sources; bounded atomic source edits subsequently succeeded.

## Native browser evidence

Local route: `http://127.0.0.1:8808/authoring/playable-benchmark/`.
All seven V6 selections loaded through the visible Craft/Actors controls and
displayed their selected class. Carrier's native provenance showed only its two
images and the exact manifest hash. Ordinary keyboard Down completed First Return:
**tick496, 34.3%, 8,160points, three lives**. Fresh Enter Retry showed the 600 ms
ready cue, retained V6 Carrier, and required fresh steering; explicit Pause worked.
The final source also visibly hid Boost and displayed the Arcade restriction.

[Carrier on the full board](carrier-board.png) records the prepared final-source
comparison at **1280×800 CSS px**. It proves real integration, not approved art.
The candidate is darker and its small central mass remains less prominent than
the approved body; broader silhouette/contrast and motion review is still open.

Single-view layout observations, 100% browser zoom:

- **844×390:** whole primary canvas328×165 at(172,216.49), down to381.49px;
  direction controls52×48; primary buttons at least44px high.
- **390×844:** whole primary canvas370×186 at(10,429.59);
  direction controls52×48, bottom834px; primary buttons at least44px high.
  The optional two-view comparison is not a two-board phone qualification.
  An intervening hidden-browser0×0 viewport made two clicks time out; the checks
  above use explicitly set nonzero dimensions. Viewport override was reset.

## Remaining acceptance

This is queued source work, not a public release. Main and immutable production
revisions remain untouched. Final producer-successor review/adoption, all-class
full-board visual/state acceptance, approved native bodies, ordinary build on
sufficient storage, integrated release gates and public bytes/play remain open.
No physical controller/touch, complete Team/Versus playthrough, offline, audio,
human fairness or performance acceptance is claimed.
