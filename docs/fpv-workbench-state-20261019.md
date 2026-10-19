# Workbench input ownership and search lifecycle — 19 October 2026

Two reproduced workbench state defects are corrected without changing aircraft
physics, rate evaluation, saved libraries or recording identities.

- **Preview input status:** capture could remain active after a locale change
  while its text said sticks navigated menus. After close/reopen, the opposite
  mismatch was possible. The message is now derived from the current capture
  checkbox during translation, close, section changes and explicit release.
  It is excluded from the static translation bindings that overwrote it.
- **Settings search:** changing rate algorithms rebuilt fields but left visible
  results pointing to removed controls. Visible results now refresh with the
  fields and locale, preserving the query and keyboard-result position.
  Detached targets cannot receive activation. Choosing a result still hides
  search, and editing the selected control does not reopen it. Basic remains
  Basic when revealing an Expert field.

The isolated fix is `36d8b40594f2d633d8e1718a6beca0169831ab7f`, based on
`7d92d2fd10a0e0b098f95eadea30df9bb5080932`. It changes two existing runtime
modules by **23 bytes net** and adds three transition regressions. Those three
checks fail before the fix; 145 unrelated cases were intentionally unselected
in that negative run. The complete tuning UI and workbench-input run then
passes **155/155, zero skips**, with ESLint, formatting and whitespace checks
passing. Independent source review found no additional defect in the change.

The regressions cover EN→UK→EN capture ownership, close/reopen, explicit capture
release and section changes; Legacy→Actual search target replacement; locale
changes while a search result has focus; preservation of raw numeric text,
draft rates and Basic preference; and no library save or flight application.
They use the real modules with the repository's in-memory DOM. The separate
[inspector zoom check](fpv-inspector-zoom-20261019.md) used their parent.

## Fresh rendered acceptance

A new complete World package was emitted from clean committed source
`0c5a079bdc04adb331ce8dec162d83ab99b10617`, tree
`96797cbacdd70cdbca6a78c5f9648e5593f32231`, with every input matched to the
commit. It contains **209 files / 18,624,100 bytes**, including the shared
appearance projection and course-result prerequisite, before reference-consumer
integration. It was served only on `127.0.0.1:8884` in Chrome Guest.

- In Basic, search **Expo** while Legacy is selected; change the algorithm to
  Actual while results remain open. The result list updates to the new fields.
  Activating the first result focuses the connected Roll Expo input; typing
  `17` after its initial `0` leaves raw text `017`, correctly evaluated as
  **17%**, with the curve/readouts updated. Basic remains selected.
- Enable preview capture, close the editor and reopen it. Capture is unchecked
  and the status correctly says sticks navigate menus. This passes in both
  English and Ukrainian. Enabling capture in Ukrainian shows the matching
  preview-ownership message and paused menu-navigation hint.
- Both projected Settings and standalone SIM appearance controls render in
  Display & Language and translate to Ukrainian. Their unique DOM IDs and
  independent state/disposal are covered by the shared-appearance tests.
- Revert restores **My drone / Legacy feel / zero changes**. No flight or
  setup save occurs. Locale changes use the ordinary Settings selector in this
  disposable Guest session. The Guest window, profile picker and local server
  are closed afterward. Public browser state and archives are untouched.

The in-place locale-refresh-with-capture transition is covered by the automated
real-module tests; the rendered route changes language from Settings while the
workbench is closed. No physical radio input or public deployment is claimed.
Screenshots `workbench-live-search-20261019.png` and
`workbench-capture-uk-20261019.png` are retained in the task's `sustained-flight`
visualization folder.

Retained logs:

- `/private/tmp/fpv-workbench-input-state-before.log`, SHA-256
  `3456955beddc3323238905679050eb6ae55abc976f57c4fa6386ffad2c56e6ac`.
- `/private/tmp/fpv-workbench-input-state-focused.log`, SHA-256
  `96d349c5187d9d041019b321b1b5568e128e22a3b90efd4044181ff843e8ef13`.
- `/private/tmp/fpv-workbench-input-state-36d8b4059-receipt.json`, SHA-256
  `6786c6e377e10f9a016f6570d530c874d6b36464c939d2074f97e51a27293a29`.

Publication and exact combined-package checks are tracked in the
[completion plan](fpv-current-completion-plan.md). No public browser or archives
were used by this implementation or its tests.

## Supplemental Academy check: limited scope

A new isolated Academy artifact at source
`51c9c82f586e6142c250af0a191d9456556ca64e`, tree
`e7c91c5f49667211eafb5f8dfd6d0f24e71b8cb3`, contained
149 files / 12,112,344 bytes with committed inputs verified and localhost base
path `/`. On the fresh `127.0.0.1:8885` origin, ordinary UI unlocked the app,
selected Meteor75, applied its starter rates to the draft and entered the
unchanged Lift and land lesson paused at zero. Explicit Arm and keyboard input
advanced the current recording to 1.58 seconds; Pause opened the expected
unscored archive/recovery controls. No objective completion or takeoff metric
was captured, so this is only an entry/arm/pause check.

An attempted import of the earlier known test flight stopped at the file picker.
Native Codex inspection was refused by the computer-use tool; no alternate app
inspection or hidden storage path was used. No file was selected or imported,
and no positive rendered proof-selection acceptance is claimed from this attempt.
The temporary tab (including its picker) and local server were closed. Public
SIM/archive state was untouched. The 366-test integrated cohort separately
checks proof ownership and the real worker-handler path.
