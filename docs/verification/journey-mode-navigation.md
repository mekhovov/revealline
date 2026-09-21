# Authored Journey mode navigation

## Scope

Explicit authored Solo and paired-board Versus routes now preserve the selected
Journey edition when changing modes. Previously ordinary Solo activation was
blocked for candidate hosts; its static link and the Versus return link also lacked
the authored route. This is a navigation fix, not a content publication or progress
migration.

The shared fixed-destination helper accepts only the five known authored route
IDs. The actual current Solo entry or Versus round must belong to its candidate
host. A Journey-enabled shell, arbitrary query string, imported Legacy flight or
unknown route cannot grant that authority. Native and modified links advertise the
same edition before activation. Team's separately authored maps are not inferred
from Solo missions and its destination policy remains separate.

Each mode retains its own cursor, receipts and progress. Returning to Solo opens
Title without starting automatically; deliberate Continue restores the checked
suspended attempt from that edition's existing slot. No Legacy selection bookmark
is written for an authored execution. Existing Legacy return-token validation and
explicit token-read timing are retained.

## Departure and recovery

- Unfinished Solo flights still pause, verify their save under the existing
  storage lock, and offer Stay or explicit Leave. A failed save remains visibly
  session-only; no durability claim or automatic departure is added.
- Versus attempts remain unsaved. Stay preserves both paused boards; leaving an
  unfinished race explicitly discards that attempt.
- Currentness checks pin the selected edition as well as the existing run, match,
  generation and foreground identities. A changed edition invalidates confirmation.
- No mission geometry, player physics, art, source revision, content count,
  completion award or release version changes in this patch.

## Verification status

Focused real-host checks cover all five authored Solo links, authored Versus links,
modified activation, checked cut retention, explicit Stay/Leave, scoped storage,
deliberate return/Continue, refused saving and the Legacy-backed `journey=1` preview.
Adversarial shell checks cover changed and invalid edition readers. Existing
Title-departure, Legacy return, Couch departure, route and shell suites pass on
Node 20.19.5 and 22.22.2: 129 existing regression checks, 13 navigation checks
(including two round-trip subtests), and 20 Couch departure checks. ESLint,
Prettier and `git diff --check` pass. The final token-read preservation change
also passes the combined 33 navigation/departure checks on Node 22.

An initial test expected the fixture's pre-departure URL without its query; the
fixture correctly retained `?journey=opening`. That assertion was corrected; the
observed save-failure warning and paused attempt were already correct.

## Native browser sample

The read-only local server served exact source `53780e2fcb53a35fe1074948f5fc8dfeed21f038`.
Actual title-link activation retained `journey=whole-originals-v3` in Versus.
The prior independent Versus selection remained Neon Contours / Folded corner,
while Solo had Apex Aurora / Crossing complete selected. Starting and pausing
the race, selecting Solo and deliberately discarding the race returned to the
same Solo edition and its unchanged independent selection. It did not auto-play.
Deliberate Continue resumed Solo. Game menu → Versus then displayed the native
“saved and verified” departure dialog; Stay returned focus to the initiating
Versus link and kept Solo paused. No injected application state was used.

One browser wait used `Start race` instead of the actual `Start race ↗` accessible
name; the current accessibility tree supplied the correct native action. This was
an automation-selector mismatch, not a failed application transition.

This is local technical evidence, not physical-controller, human-enjoyment or
public-release acceptance. Accepted-release integration and Pages remain pending.
