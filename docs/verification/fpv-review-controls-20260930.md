# FPV review controls and frozen observation continuation — 2026-09-30

This batch continues the requested Phase 2 → 3 → 4 → 6 order, with Phase 7
qualification alongside it. It starts from main `5e23fa8a62accf7a719cca5dd45c0702b52d37a5`.
PR #853's qualifying offline-navigation input is left unchanged. This is another
bounded input to milestone **v0.150.0 — Unified native experience**, not a new
version or authority to publish. Runtime fixes and observation tooling are grouped
in one PR so independent work can continue while the release lane is occupied.

## Delivered

- **Phase 6 input:** P/Escape pause remains available while buttons, links, camera
  selectors and non-text controls have focus, regardless of keyboard/touch/radio
  ownership. It neutralizes local movement before notifying the app. Text entry,
  composition, modified browser shortcuts and native modal dismissal keep their keys.
- **Phase 6 review:** English/Ukrainian 0.5×/1× playback changes only the wall-time
  accumulator. Every recorded input still advances the same fixed-step model.
  Rate changes preserve pause/recovery and never earn or affect practice speed.
  Finishing playback preserves focus; resetting moves it before hiding controls.
  This closes the previously overstated “slow review” claim in the delivery ledger.
- **Phase 7 tools:** runtime and retention observation now use declared frozen
  plans and the existing optional-package admission authority, shared with completion
  observation. They verify original distribution/source artifacts and every served
  member, including the manifest, before observing. Instrumentation has separate
  hashes; originals stay unchanged. New output directories prevent overwrites;
  bounded procedures/cleanup retain failures. The tools do not grant publication.
- Regression cases cover focused-control pause, both replay modes/rates, exact
  intermediate outcomes, neutral recovery, non-earning, artifact bindings and
  failed observation retention. They are registered in the existing practice cohort.

## Validation and its limits

Automated suites are **WAIVED_SKIPPED_NOT_PASSED** under
[publishing/test-policy.json](../../publishing/test-policy.json) and the
[focused waiver](../focused-test-waiver-20260930.md). Authoring tests is not a pass.
Syntax, scoped ESLint, Prettier and whitespace checks are separate validation.
All 61 rendered copy references resolve in both English and Ukrainian. Full
repository localization validation remains blocked locally by the sparse checkout
(missing `site/`); no full localization pass is claimed.

After restoring the exact tracked FPV icon missing from this sparse checkout,
two development-only optional builds produced identical 2,865,229-byte ZIPs:
`269fe81b49e927bb926bad000fc1a2d030a7ed293297e598511d816c950dbfc1`.
The package has 45 emitted files within unchanged 8 MiB/64-file limits. Browser
observation in Chrome 154.0.8037.93 recorded neutral pause from the camera control
and the new speed selector, no page errors, and no canvas/viewport overflow at
1440×900, 390×844, 844×390 and 768×1024. This is a development build observation,
not frozen-source admission or physical-device qualification.
[Source pins and measurements](evidence/fpv-review-controls-20260930.json).

The new frozen observation path was exercised on the **prior** #853 candidate
`bf7a365fb2a4a0c1f4997c0c29d46ed8d1c751df` from
[CI run 36747207025](https://github.com/mekhovov/revealline/actions/runs/36747207025).
The downloaded artifact's SHA-256 matched GitHub's published digest, original
inner admission completed, and 52 selected runtime members matched served bytes.
This does not qualify the later replay/input changes.

- Runtime: 20 scene/reset cycles, four layouts and live WebGL loss completed;
  registered resources returned to baseline, disposal released owned resources
  and explicitly lost the context. The eight-second headless observation recorded
  p95 about 16.8 ms, maximum 116.7 ms and no reported long tasks. Concurrent work
  on this host makes it unsuitable as a controlled regression comparison.
- Retention: after warm-up, 20+20 cycles kept connected nodes at 326, one canvas,
  five dialogs and CDP nodes/listeners at 1,264/124. First-interval shallow heap
  delta was +526,494 bytes; second was −45,216. Detached-node deltas were zero.
  These counts require interpretation; they are not a leak-free pass. Three's
  remaining lookup-texture accounting entry is retained in the evidence.
- Both procedures completed and cleaned up. The public summary pins the exact
  observer sources used, before final deadline hardening; it is historical evidence
  for that invocation, not a claim that later tool bytes were executed. Raw heap
  payloads remain local; only hashes, bounded counts and metadata are published.

[Frozen artifact and diagnostic summary](evidence/fpv-frozen-diagnostics-20260930.json).

## Completed and remaining priorities

| Priority | Plan item | Status / next action |
| --- | --- | --- |
| Complete | Phases 2–4 shared journey, four showcases, six-win finales and control lab | Implemented in prior merged work; preserve 18 campaigns/108 arcade missions and existing reward promises. |
| Complete in this batch | Phase 6 focused-control pause and slow review | Implemented and scoped browser observation recorded; automated regressions authored but waived. |
| Complete in this batch | Phase 7 frozen runtime/retention observer integration | Shared admission and byte binding implemented; prior candidate procedure completed with honest limits. |
| P1 | Final integrated source/build qualification | After queue aggregation, build/admit the exact merged source, retain source exclusions and unchanged budgets, and verify installed/offline update/rollback on those bytes. #853 owns the offline navigation fix. |
| P1 | Controlled performance and retention evidence | Use these frozen-plan tools on a matched baseline/candidate and the final selected artifact. The 5% target and full retained-memory interpretation remain unproven. |
| P1 | Coordinated release/public-byte acceptance | Release owner selects one immutable candidate, performs complete artifact/source admission, promotion and rollback/public-byte verification. No selector, version or hosting-cap changes here. |
| Deferred by owner | Human learning/artwork, physical USB radios and devices | Keep deferred and unverified; do not replace them with statistics or headless observations. |

Other contributors' active branches and historical local conflicts remain owned
by their respective work. This batch does not sweep them into its runtime diff.
