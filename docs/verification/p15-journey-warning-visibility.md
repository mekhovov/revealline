# P15: visible Solo Journey persistence warnings

22 September 2026. Source candidate; no release version allocated and no public
delivery claimed. This is a bounded Solo correction, not completion of P15.

## Problem and scope

Public v0.82.0 exposed an actual disk-full Journey save during a legal First
return clear. Play/Next/Skip remained available, but the existing recovery aside
was below the running viewport and outside the fixed result overlay. Its presence
in an accessibility tree did not establish that a player could see it.

Keep the existing Journey store, export/retry handlers, edition keys, receipt
authority, input, pause and Next behavior. Add a stationary warning badge to the
existing Game menu target; expose an explicit Save options action immediately
after the primary Start/Resume/Next action; place the full recovery section in
the existing scrollable Game menu. Warning changes never open a dialog or focus
a control. A successful retry clears indicators without removing focused
recovery controls. This is independent of Legacy library/media writer warnings.

The frontend-design guidance was applied as a restrained amber, text-and-shape
warning using existing pixel-art typography and controls. No animation, new
font, extra header slot, arena-size rule, storage schema or version change.

## Verification

Base: accepted selector source `0816c8051cf6a2294f07718284036365ceaeefa1`.

- Node 20.19.5: `node --test game/test/journey-host.test.mjs
  game/test/journey-save-notice.test.mjs game/test/journey-backup.test.mjs`:
  **26 passed**, zero failed/cancelled/skipped/todo, 155292 ms after independent
  review corrections (initial candidate: 25 passed in 159218 ms). Includes ten
  consecutive mission clears, cross-pack failure/retry, Skip, backup restoration,
  failed saving, result preservation and deliberate Next.
- Scoped ESLint with zero warnings, scoped Prettier check and `git diff --check`
  pass. Full exact-commit CI/build/frozen/public gates remain required.
- Preserve the initial sparse-checkout failure: the first invocation lacked the
  MP3 fixture; the subsequent broad invocation passed 15 of 17 but lacked
  `fpv-arcade-r5.json` for two pack cases. Restoring those exact tracked fixtures
  produced the separate 24/24 then final 25/25 successful runs. No product
  expectation or timeout was weakened.

## Actual browser observations

Codex in-app browser, keyboard/pointer, isolated localhost port 8948. Accepted
Git blobs were served with captured candidate UI files; generated dependencies
came from the exact v0.82.0 public graph. This is a source diagnostic, not a
frozen distribution. Only the Journey backend was deliberately refused using
the store's existing backend boundary; no simulation state was injected.
It does not prove a real quota failure or successful durable recovery.

Before/after failures were retained:

1. Recovery before the title actions took initial focus away from Start. Moving
   it after those actions restored Start/Continue as the initial focus.
2. At 600×400 Large/Plain, the existing running branding-span rule hid the badge.
   Overriding display alone still inherited zero font size. The final scoped
   display and explicit icon font size give a visible 16×16 badge.
3. The extra result/pause action initially appeared below the visible scrollport.
   Moving it immediately after primary play in DOM order and spanning its grid
   row made Next/Resume and the warning initially visible together. Other
   secondary actions retain keyboard-accessible scrolling.

Observed journeys:

- Desktop 1280×720: real First return down-cut, 34.3%, 8160 points, three lives;
  primary Next focus and visible warning. This first desktop observation precedes
  the final compact-order correction; it is not final desktop qualification.
- Final compact 600×400, Large/Plain and reduced effects selected through actual
  Settings: running badge visible; full arena remained 600×300 at x=0,y=74,
  matching the prior warning-layout sample. Pause retained primary Resume with
  Save options immediately below it. This compares candidate layout revisions,
  not a live durable-to-failed transition.
- Final legal First return clear: 34.3%, 8160 points, three lives, 11 seconds.
  Both Next and the complete Save options label visible without scrolling.
- Same result at 320×568: Next, warning, picture/retry/menu actions visible.
  Save options opened the real menu and focused Retry; the message and both
  recovery controls were readable. A refused Retry followed by Escape restored
  the unchanged result and Save options focus. One deliberate Next started
  Choose your share with three lives and no additional Start/menu step.
- Earlier compact pause → Save options → menu and result → Save options →
  Escape journeys retained their exact paused/result state. No automatic resume.

Independent review of initial PR253 head `fa092389` found two additional issues:

4. The 320×568 result check did not cover running portrait mode. Its more
   specific handheld branding rule still hid the badge. A native running
   reproduction confirmed `display:none`, 0×0. The corrected selector now
   yields `display:grid`, 16×16 at x=38,y=2. The arena remains exactly
   296×480.6015625 at x=12,y=56 before and after this source correction.
5. A successful background retry could remove focused Save options. It now
   retains that target until blur, changes its label to truthful saved/Game menu
   text, and never moves focus automatically. A dedicated failed-to-success
   unit test covers the case. This is modeled focus evidence, not native
   successful storage recovery.

After these corrections, actual 600×400 running still showed a 16×16 badge;
Escape retained Resume as primary. At 1280×720, pause showed Resume and Save
options together, and the latter opened the existing menu with Retry focused.
The original diagnostic refusal and no-state-injection limits still apply.

Corrected diagnostic UI SHA-256 pins:

| File | SHA-256 |
| --- | --- |
| game/app.mjs | cd5853b3b00bf8a487225830f3499eb6e70673f1cecae9e83f30a650277b0f8e |
| game/index.html | 3d4a98ca91a4c4ff248629fe4a85eaaad8c372d74c59297a8101bd651b638348 |
| game/ui/journey.css | ca204294db12ec6692a7a6d192d42fdb2ea582cc2f310f2a3851287b584c8f73 |
| game/ui/journey-save-notice.mjs | 42620aff615df4359953806cb59b5d59513a2421752cb250c8bf0156f7ae946a |

Diagnostic-only refused-backend profile module:
`d530565b4a5a4130069ee5c1b0b4cc3f8c641f371baa9a629026951f58307b1d`.
It is not a shipping change.

## Remaining gates

Final desktop result and additional viewport review; live status-transition geometry;
native successful retry/export-to-disk; modeled and physical controllers;
screen-reader/zoom and actual devices; matching Versus/Team presentation;
independent PR review; full exact-source CI; coordinated version allocation,
immutable release, Pages deployment and public verification. Do not merge or
publish independently of the release owner's serial queue.
