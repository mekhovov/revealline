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
They use the real modules with the repository's in-memory DOM. Actual rendered
acceptance of these two lifecycle fixes remains separate from the completed
[inspector zoom check](fpv-inspector-zoom-20261019.md), which used their parent.

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
