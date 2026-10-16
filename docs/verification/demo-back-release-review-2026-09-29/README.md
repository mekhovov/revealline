# Demo Back activation review — 29 September 2026

Base source: `5b0f830b3d8f5481cf85567c297861bc914bacc6`, preserved in PR #781.

The actual Demo Back button is nested under `[data-demo-ui]`. The input owner
yielded to that wrapper before reaching the Back activation guard. A held Enter
could therefore leave Demo through native activation and then activate the
restored Watch button without a fresh press.

Back now claims Enter, NumpadEnter and Space before generic UI yielding. The
existing exit-key guard consumes repeats, key release and the trailing keyboard
click after focus moves Home. An independent later activation still works.
Fullscreen, Next and menu controls retain native activation.

## Verification

- Real-wrapper regression on the original runtime: **52 passed, 6 failed**.
- Same tests with the fix: **58 passed, 0 failed**.
- Covers watching and loading, nested labels, keyboard repeats and release,
  trailing clicks, pointer exit, and ordinary nested Demo controls.
- Scoped ESLint and Prettier pass. See the retained red/green TAP logs.

Tests used a bounded source export with the existing event fixture. These are
automated adapter results, not a fresh browser journey, physical keyboard or
controller qualification. The wider old/new Confirm coordinator conflict is a
separate open integration gate. No full suite, build or publication is claimed.
