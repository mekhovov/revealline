# Deliberate Team terminal retry

This unversioned audit candidate replays the player contract from draft PR545
onto the prepared player-first sequence after compact gallery, Team quick start,
Couch secondary navigation, and contextual Team teaching. It does not claim a
merge, version, release, Pages deployment, physical-controller check, or
browser-touch certification.

## Player contract

- A terminal Team loss remains on its result until the player deliberately
  chooses an action. The former 700 ms automatic restart and its timer-only copy
  are removed.
- **Retry same arena** remains the focused primary action and starts immediately
  after a fresh keyboard, controller, or touch activation.
- Keyboard activation and primary touch held across the loss are consumed
  through release. Controller Confirm must return to neutral before a later
  Confirm can activate Retry.
- Retry preserves the accepted arena, difficulty, setup, actor choices, and
  exact prepared picture without rereading the artwork.
- Ordinary reserve recovery and partner rescue remain in play. Only the
  no-reserve terminal outcome changes.
- Blur, hidden state, and persisted pagehide retain the result. A failed first
  paint after deliberate Retry leaves a stopped recovery result instead of
  entering a restart loop.

The failure surface continues to expose **Browse Team arenas** for mission
selection and **Change setup** for difficulty and setup changes. Those routes
are functional, but the panel does not yet provide a dedicated **Change
difficulty** action or rename the mission action to **Missions**; this slice must
not be presented as closing that broader UX4 menu wording requirement.

## Reconciliation

The terminal patch applies cleanly to the prepared sequence except for two
expected generated/current-main reconciliations:

1. preserve the accepted installed-attempt cleanup before adding the fresh-input
   boundary around terminal loss; and
2. rebuild `game/i18n/catalogs.mjs` from the English and Ukrainian locale sources
   after removing the two obsolete automatic-retry messages.

The older PR545-only picture transport helper is not needed on the current
exact-picture host fixture. The foreground Skip fixture must sample one neutral
controller frame after returning to the foreground.

## Focused evidence

On the reconciled audit tree:

- terminal and fresh-activation host/unit cohort: 9/9;
- contextual Team teaching cohort: 11/11;
- reserve, rescue, and Team core simulation cohort: 62/62;
- lost-result Skip case: 1/1 (24 unrelated cases filtered);
- foreground Skip neutralization case: 1/1 (24 unrelated cases filtered);
- locale build/check, syntax, scoped ESLint, scoped Prettier, and diff checks:
  pass.

An earlier full run on the equivalent terminal donor stack also passed 89/89
across Team Journey, reserve, rescue, and terminal cases. Modeled gamepad and
pointer boundaries are automated evidence; physical Steam Deck/controller,
physical touch, short-landscape visual review, and assistive-technology checks
remain release qualification work.
