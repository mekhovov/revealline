# UX5 Collection navigation fixture reconciliation

## Scope

This draft isolates the four player-facing Collection failures found by the full modal-navigation audit on ordered-train `main` at `9d5947724983e3b5b3d921a3f276bf2fcdeb6a0f`.

The Collection runtime already has the required behavior:

- keyboard, touch and controller activation opens the achievements/appearances disclosure once;
- the reading surface becomes the controller owner and Back/Escape returns to its exact `Read achievements` origin;
- collapsing the disclosure ends reading, returns hidden focus to its summary and does not steal a later deliberate focus;
- `Choose appearance` retains the title or paused-field parent while opening the mission setup, with the exact attempt checkpoint and storage unchanged.

The failures were test-boundary drift. The shared `SoloElement.click()` boundary began modeling the browser's native `<summary>` default in `a85c446d`, while `modal-navigation.test.mjs` retained an older local mock that toggled the same `<details>` a second time. Every modeled keyboard, touch or controller activation therefore opened and immediately closed the disclosure before the application could enter reading or route to appearance setup.

## Correction

- Remove the duplicate local `<summary>` toggle and use the shared browser boundary as the single activation owner.
- Add explicit keyboard and touch disclosure checks alongside the existing controller reader check.
- Preserve the exact paused simulation checkpoint, storage bytes/write count, opener focus and modal stack in the focused assertions.

There is no production runtime, content, version, tag, release or publishing change in this draft.

## Evidence

Baseline full modal-navigation audit:

- 54 tests: 49 pass, 5 fail.
- Four failures were the Collection fixture drift described above.
- The remaining failure is the separately owned nested Studio editor/admin Back behavior and is outside this change.

Corrected focused player checks:

- 8/8 pass: keyboard and touch disclosure activation, controller reading and disclosure collapse, Choose appearance, and exact Home/field mission-return ownership.
- The nested Studio editor/admin assertion remains excluded from this player-only change and is not weakened.

These are modeled browser/controller checks. They do not claim physical touch-device, Steam Deck or controller certification.

## Ordered release dependencies

This branch is based on the history-preserving v0.133 train revert and remains draft/unversioned.

1. Reconcile after v0.131 localization.
2. Reconcile after v0.132 offline gameplay.
3. Reapply/reconcile the compact-gallery v0.133 source.
4. Carry this test-boundary correction into the later UX5 cumulative source, together with PR542's paused Settings/Help return behavior, without replacing newer test or runtime work.

Do not merge, tag, freeze, publish or deploy this branch independently.
