# UX2 Team quick start — draft candidate

## Scope

- Rebased base: `72355ee5d0be05a83ef5a6aca5348977f2646759`, the latest
  `origin/main` documentation reconciliation inspected after public v0.130.0.
- Branch: `codex/ux2-player-lobby-cleanup`.
- This is an unversioned draft. It does not claim a merge, release, Pages
  deployment, physical-controller check, or public acceptance.
- The slice changes the Team lobby only. It does not duplicate the compact
  mission gallery preserved in PR #535 or the secondary navigation shell in
  PR #539.

## Player problem and resulting behavior

The Team lobby placed its legacy arena selector in the quick-start path even
though the current Team Journey already provides a valid default arena. During
passive picture preparation, modeled-controller focus also landed on that
selector. This made Team feel like a setup form and placed a secondary control
between the player and Start.

The draft moves Arena into the existing collapsed **Arena & team options**
disclosure with play style, difficulty, actor style, and imported packs. The
ready lobby keeps its one-action Start. Players who want a different legacy
arena can open the disclosure and select it without losing the existing route,
preview, or preparation behavior.

During passive initial picture preparation, default controller focus now stays
on the disclosure summary rather than a hidden form control or Cancel. Cancel
preparation remains available for a genuinely stalled or unwanted operation,
but it is not placed in the default Confirm path.

## Focused evidence

The following checks passed against the draft source:

- Team lobby keyboard navigation reaches the closed options summary and Start,
  keeps Arena out of the collapsed Tab order, then reaches Arena after the
  disclosure opens: 1/1 selected test passed.
- Team structure, touch disclosure/arena selection, and Steam Deck-style
  Confirm-echo preparation ownership: 3/3 selected tests passed.
- Scoped ESLint, repository Prettier formatting, and `git diff --check` passed.

The complete Team host file reported 66 passes and 11 failures. Selected
failures were reproduced unchanged on the exact untouched base, so they are
recorded as inherited baseline evidence rather than attributed to this slice.
The complete quick-start-parity file reported five passes and four failures:
two Versus and two Team controller-start cases depend on the controller
activation guard currently preserved in the reverted PR #535. Applying only
that guard diagnostically made all Team cases pass. No PR #535 runtime change
is included in this branch.

## Dependency and promotion order

1. Publicly accept v0.131 localization and v0.132 offline installed gameplay.
2. Reconcile and publish PR #535 as the cumulative v0.133 compact-gallery
   release, including its controller activation owner.
3. Rebase this Team quick-start slice onto that accepted source and rerun the
   focused keyboard, touch, controller-preparation, and ready-start checks.
4. Reconcile PR #539 afterward. PR #539 and this slice both touch
   `relay-rescue.mjs`, but they own different behavior: PR #539 owns secondary
   navigation while this slice owns passive-preparation focus and collapsed
   Team setup. Resolve the textual overlap without duplicating either owner.

Physical Steam Deck/controller behavior and browser touch remain separate
acceptance work. The automated-suite waiver does not turn skipped or inherited
failures into passes.
