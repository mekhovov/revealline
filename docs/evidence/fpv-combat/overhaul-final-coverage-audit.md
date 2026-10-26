# Final six-phase coverage audit

2026-10-20. Compared the final overhaul plan with current implementation,
player documentation, and retained evidence. This was a source/document review;
no catalogue workers, browser, or performance workload were started by this
audit. The running catalogue matrix retains its own qualification status.

## Findings and corrections

Two concrete host UI omissions were found and corrected during the audit:

1. **Result settings were saved but not displayed.** Combat results retained
   loadout, payload, ammunition preset, and independent player/enemy assistance
   in their stored configuration, but the result card omitted them. The card
   now displays those settings in English and Ukrainian through
   `combatResultSettings` in `world-app.mjs:7631`, rendered at line 7742.
   Historical results without these fields do not invent defaults.
2. **Health visibility did not cover every overlay.** The combat status widget
   obeyed Off / When damaged / Always, while flight instruments and the generic
   flight HUD could still display combat health, including regional return
   guidance. `flightHealthText` at `world-app.mjs:2796` now governs all three
   consumers. Original-course health display retains its previous behavior.

Focused regressions in `fpv-encounter-host-lifecycle.test.mjs` exercise the actual
production rendering expressions, all three health preferences, healthy/damaged/
zero health, regional-return guidance, original courses, both result languages,
all three ammo presets, and all independent assistance combinations.

No additional missing core mechanism was verified in this limited audit.
That conclusion does not certify every tuning value, map objective, resource
strategy, or human quality criterion.

## Phase coverage

| Phase | Mechanisms present | Remaining scope distinction |
| --- | --- | --- |
| 1 — Shared correctness and immersion | Swept fragment contacts, pending unloaded surfaces, saved settling poses, independent destruction preferences, military identities, 1.6 m Chase default with 0.6 m height and 0.75–6 m distance, FPV props, existing shared widgets, bounded package closures | Surface handling and resource bounds have code and scoped evidence. Current full-application performance is qualified separately. |
| 2 — Weapons and resources | Four weapons/two slots, three payloads, finite heavy ammo, Arcade recharge, Tactical pad-only ammo replenishment, health/repair pickups, damage assistance, persistent marks, Strike aftermath, retry/new-run identity | The two reporting/visibility gaps above are fixed. Presence of resupply mechanisms is not proof that every loadout/preset is enjoyable or viable on every map. |
| 3 — Character destruction | Twelve connected Current/r2 regions with caps, shared family/cast recipes, independent preference combinations, optional-art fallback, production Studio preview with pause/restart/timeline/contact inspection | The 51-scene visual matrix is a rendering review. The adapted r2 body and wardrobe are an explicit art scope choice; no new photorealistic sculpt was required. |
| 4 — Catalogue and Studio | Shared activity selection, separate learning defaults, exact content identities, authored encounters, undo/redo, stable-ID source reimport and missing-ID decisions, companion import/export | The catalogue runner checks admission, a short accepted interval, recovery and replay. Its strict merge is necessary for its own pass, but cannot prove every objective can be completed or every route can be navigated. |
| 5 — Survival | Timed six-minute and Endless modes; requested 64/96/128 slots; pressure ramp, formations, local pursuit/separation, elite scheduling, reserved final actor, guarded supplies, secondary skill challenges, immutable attempt loadouts | Actual admitted counts can be lower. Local steering, resource economy, and offering a noticeable secondary skill challenge within 30 seconds require their specific gameplay evidence; a three-step catalogue case does not establish them. |
| 6 — Release | Versioned tests, historical compatibility checks, package admission measurements, isolated browser evidence and qualification tooling | Existing physical-radio, five-player, long-performance and publication gates remain tracked elsewhere. This audit does not relabel them as passed. |

## Confirmed detailed contracts

- **Retry / New run:** `retryFlight` retains the encounter selection and active
  tuning draft; New run requests a fresh seed. Configuration changes create
  another attempt.
- **Service:** the runtime requires 250 accepted ticks near the validated pad,
  low speed/throttle, and released weapons. Normal combat processing continues.
- **Lethal damage before healing:** pickup processing is gated by positive
  health after accepted physical destruction is applied
  (`encounter-runtime.mjs:3878–3879`).
- **Final actor capacity:** Survival reserves an admitted final prototype before
  play. A blocked entry waits, and the host shows move-away guidance.
- **Recording:** full archived history and bounded live recovery have separate
  contracts. The final short frame-path browser check verified export, continued
  flight, real IndexedDB closure, imported Watch and exact Continue. Earlier
  minute and long-runtime archive evidence retains its stated scope.

## Documented limits, not additional unmet plan clauses

- Strike resolves deployed ordnance for twenty accepted seconds after a crash.
  Actors retain their last accepted collider poses. The final plan did not
  require an actor-only physical transaction after aircraft destruction.
- Survival pursues locally and falls back to admitted authored routes when a
  move is blocked. No global path-search algorithm was required; the available
  checks do not prove global navigation completeness.
- A run chooses one compatible secondary skill challenge. Completion is
  recorded and signaled; it does not award a separate score/resource bonus or
  schedule another challenge. Repeating/rewarded challenges were not required.
  The HUD label was clarified from “Bonus” to “Challenge” in English and
  Ukrainian to match that behavior.

The delivery report now distinguishes the short catalogue check (three steps
by default) from separate complete navigation and objective-completion
qualification. The same scope appears in `overhaul-runtime-qualification.md`.

## Related evidence

- [Delivery status](overhaul-delivery.md)
- [Runtime and catalogue qualification](overhaul-runtime-qualification.md)
- [Archive host browser checks](overhaul-archive-host-browser.md)
- [Final frame-path browser regression](overhaul-frame-path-browser.md)
- [Package measurement](overhaul-package-measurement.json)

The accompanying host change also adds 2× and 4× speeds for combat playback.
Original-course playback retains its prior speed choices. Accepted simulation
intervals, the five-interval catch-up bound, single pending worker, pause, and
recording contents are unchanged. This is covered by focused tests; actual
long-archive accelerated playback remains part of the scheduled browser check.

## Final focused verification

- `fpv-encounter-host-lifecycle.test.mjs`: **27/27 passed**, including the new
  health/result cases and fast-playback validation. Initial development exposed
  a missing `navigation` value in the new test fixture; the fixture was corrected
  before the passing runs.
- Existing encounter controls, regional preparation clock, original replay-rate,
  and World appearance/UI files: **153/153 passed**, zero failures or cancellations
  in the serial run (86.835 seconds). This preceded only the final Challenge copy
  change and expansion of independent-assistance test combinations; the focused
  27-test file was rerun afterward.
- Changed-source ESLint and scoped `git diff --check`: passed.
- Final `world-app.mjs`: **533,109 bytes**,
  SHA-256 `048be869cc5713839c738f6895ccbfc251eb3d5b1c3556f8818a3f038d239255`.
- Focused test file SHA-256:
  `1c4d15f7c6aff43c92e3901b93832f5b68de0c54966e7509431e752ee2f876f2`.

The catalogue owner confirmed that `world-app.mjs` is outside the logical
catalogue fingerprint. Encounter runtime/session/geometry and aircraft adapters
were not changed by these fixes. No browser was launched, and no test process
from this audit remains running.
