# Optional Worlds owner — 17 October 2026

## Finding and change

Ordinary Solo constructed the optional Worlds panel before Direct Start even when the player never opened it. An actual-host observation at `9335822bc0ce55ede2217d840c01cfc79bcef183` found **654 elements**, including the closed dialog, and five owned document/window listeners: resize, blur, pagehide, visibilitychange and focusin. The panel made no optional-catalog request before opening. These are modeled allocation/ownership observations, not native memory or timing measurements.

The host now creates the panel synchronously on the first explicit **Settings → Content → More Worlds** action, after the shell has paused play. Later openings reuse the same owner. The module remains statically imported; there is no dynamic import, asynchronous construction gap, new content-validation rule or automatic opening during gameplay. The original constructor options and callbacks are unchanged.

Existing hidden-page and persisted-pagehide paths still close an existing panel. Permanent pagehide marks the owner disposed and disposes it when present. A retained opener cannot create a first panel after permanent teardown or resurrect a disposed panel. This preserves the eager owner's existing refusal to reopen after disposal.

A parser comparison of the constructor's complete argument syntax trees is identical after removing only source positions: 47,990 canonical JSON bytes, SHA-256 `65fa438dd2dcc5b18ad0e4b1ec22369cdf32ba55262a6ebb25ac904cae70371b`. The application source before this change is 589,707 bytes, SHA-256 `1fc1f42609190c943344496647ceb66a0aaf8cd776b487a04e3f13179e67ad10`.

## Controls and verification

The unchanged-source proof runs ordinary Direct Start, opens and reopens More Worlds through the public Settings controls, closes it, then verifies both persisted and permanent pagehide. It preserves the same authoritative run/checkpoint, reuses exactly one dialog and observes zero owned document/window listeners after disposal. It passed 1/1 with exit 0 in 10.239 seconds. `proof-v2.tap` is 1,150 bytes, SHA-256 `84b817776110303f02ee5636afb9864e87b044db4f28ab39be569b53bafb9e63`.

The first cache proof failed because its request-observation callback accidentally returned the array length as fixture content. That rejected harness result remains in `proof.tap`; the corrected callback only records the request and lets the existing source loader run. No application failure is inferred from that prototype.

Two public host regressions now verify that:

- Initial readiness and ordinary Direct Start create no optional Worlds dialog and request no optional catalog.
- The first explicit opening creates and opens synchronously; Back and repeated opening reuse the owner and retain focus behavior.
- Hidden-page and persisted-pagehide handling close without destroying the retained owner.
- Permanent teardown removes the panel; retained openers cannot resurrect an existing owner or create an owner that had never opened.
- The authoritative run/checkpoint remains unchanged throughout paused navigation and cleanup.

The complete `solo-performance-host`, `optional-chapters-host-copy`, `optional-world-choice-lifetime`, `optional-world-play-lifetime` and `optional-world-play-installed-host` files pass: **62/62, exit 0**, no failures, cancellations or skips, in 89.335 seconds on Node 22.22.2 with test concurrency 2. This includes the complete nine-test Solo performance host file and the existing optional-panel cancellation, activation and installation contracts. `affected-complete.tap` is 14,751 bytes, SHA-256 `471f5f0254fba853f59abb21af5dba0e5e799abaae93d7d789bfdc510d521f70`.

Scoped lint, formatting and constructor-option equivalence pass. An independent source review also verified the same complete constructor argument and nested callback trees; its receipt is `.cache/solo-followup/optional-worlds-root-review/options-ast.json`. Raw source identities, cache prototypes and TAP receipts remain under `.cache/solo-followup/optional-worlds-owner/`.

## Scope limits

This removes hidden DOM/listener construction from Direct Start. It does not reduce the static source graph, prove a native frame-time improvement, or qualify Steam Deck Chrome or iPhone Safari. Installation, playback activation and cancellation stay with their existing panel/host owners. The production artifact already running before this change retains its older source identity; final qualification needs a prospective artifact that includes this change.

This is the final startup ownership change in this batch. Shared soundtrack, library and compiler boundaries remain inspected dependencies rather than speculative deferrals.
