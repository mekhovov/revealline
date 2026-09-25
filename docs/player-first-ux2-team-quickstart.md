# UX2 Team quick start — draft candidate

## Scope

- Rebased base: `a63ad4cc32fb14c53fa126d69df42e2e53d1477d`, the latest
  `origin/main` fetched on 2026-09-26.
- Branch: `codex/ux2-player-lobby-cleanup`.
- This is an unversioned draft. It does not claim a merge, release, Pages
  deployment, physical-controller check, or public acceptance.
- The slice changes the Team lobby only. The base already contains the compact
  mission gallery and guarded Couch Confirm from merged PR #535. This slice
  does not duplicate the secondary navigation shell in open PR #539.

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

- Team structure keeps Arena inside the closed optional setup surface: 1/1
  selected structural test passed.
- Scoped ESLint and repository Prettier formatting passed for every changed
  source, locale, test, and evidence file.
- Localization catalogs were regenerated, then `npm run i18n:check` and
  `git diff --check` passed.

The focused structural, keyboard, touch/pointer, and modeled Steam Deck and
controller-preparation checks pass on the committed tree without diagnostic
overlays. The corrected base includes the exact revision-84 Team picture
bindings needed by the runtime fixture.

## Dependencies and evidence limits

1. Reconcile PR #539 afterward. PR #539 and this slice both touch
   `relay-rescue.mjs`, but they own different behavior: PR #539 owns secondary
   navigation while this slice owns passive-preparation focus and collapsed
   Team setup. Resolve the textual overlap without duplicating either owner.

Physical Steam Deck/controller behavior and browser touch remain separate
acceptance work. The automated-suite waiver does not turn skipped or inherited
failures into passes.
