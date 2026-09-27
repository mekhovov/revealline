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

## Cumulative reconciliation — 2026-09-27

The sections above preserve the original PR548 review receipt. Its 49/54
baseline, Studio exclusion and ordered serial dependencies are historical
context; they do not describe the cumulative PR542 + PR548 source now being
admitted on top of accepted `main` at `756eae6c`.

The cumulative fixture exposed a second, test-only timing fault. Its modeled
controller clock restarted at 1000 for every app host, although the production
router, Confirm lifecycle and Steam/native duplicate-input guard require
monotonic time. The fixture also moved between deliberate Confirm actions before
the production 120 ms release interval and 1250 ms duplicate-input window had
finished. That could suppress Help/Collection reader entry and Studio controls
depending on file order. The correction keeps one monotonic fixture clock,
models both production intervals exactly, and exercises the two delayed
Collection toggle orders in one host. Runtime behavior and every focus,
checkpoint, storage, reading, edit and native-change assertion remain intact.

Current cumulative evidence:

- Initial combined run preserved: 56 tests, 51 pass and 5 fail (Help, three
  Collection cases and Studio) before the bounded fixture correction.
- Author verification, repeated twice: modal navigation 57/57 and Pause 4/4,
  with zero skips on both runs.
- Independent coordinator verification: modal navigation, Pause, controller
  Confirm lifecycle and duplicate-input guard 97/97, with zero skips.
- Scoped syntax, ESLint, Prettier and staged/unstaged diff checks pass.

This is one cumulative latest-first input. It does not allocate or require an
independent game release. The evidence is modeled automation and does not claim
physical controller, Steam Deck or touch-device certification.
