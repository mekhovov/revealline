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
Title-departure, Legacy return, Couch departure and shell suites are being run on
Node 20.19.5 and 22.22.2 before promotion.

An initial test expected the fixture's pre-departure URL without its query; the
fixture correctly retained `?journey=opening`. That assertion was corrected; the
observed save-failure warning and paused attempt were already correct. Native
browser evidence and accepted-release integration remain separate gates.
