# UX2 Couch secondary-navigation parity — reconciliation draft

## Scope

This unversioned draft reconciles the Couch secondary-navigation slice on top of
Team quick start `15568328cab4b0f4baa9135f3784ede53e608153`. It does not own a
release, tag, archive-selector change, or publication.

- Versus exposes **More** beside the primary lobby utilities. Home, About &
  credits, and Releases no longer require opening How to play first.
- Back closes More and restores its opener. Live-match departures continue
  through the existing discard guard and Stay restores the exact destination.
- About and Releases use live localized destination labels and the generic
  unsaved-attempt warning. Changing English to Ukrainian while the dialog is
  open preserves both paused boards and keyboard/controller focus.
- Team Pause exposes quick Sound in the direct Resume, Retry, Missions, Help,
  Settings, Sound, Home hierarchy. Changing Sound while paused does not resume
  or advance the arena.
- Team quick-start focus ownership and the already accepted controller Confirm
  hook remain unchanged. The More disclosure retains a 44 CSS-pixel target.

## Reconciliation decisions

The earlier draft's duplicate `activateControl` additions were dropped because
both Couch hosts already use the shared controller Confirm guard. The current
FPV revision-84 picture bindings are exercised directly; no historical theme
revision override remains. The localized More markup moved intact from Help to
the lobby, so there is one copy of every destination ID.

## Verification state

Syntax and staged-diff checks passed. A requested cumulative host run was
started but stopped early when workspace disk pressure became critical. Its
completed controller-confirm cohort passed 32/32. The broader Team host cohort
reported pre-existing async import/preparation timing failures before the stop;
those results are not counted as passes and need comparison with the untouched
quick-start parent when disk capacity is restored. Physical controller, Steam
Deck, and touch-device qualification also remains outstanding.
