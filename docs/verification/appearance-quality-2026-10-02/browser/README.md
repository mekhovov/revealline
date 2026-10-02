# Follow-up browser review

These checks use the actual source server at `http://127.0.0.1:8768` in the
Codex browser. They supplement the previous packaged-browser evidence. They do
not certify every screen or physical input device.

The final smoke check also uses the rebuilt distribution at port 8799. Packaged
Display & Language and Audio settings open correctly; the complete Music Library
uses Industrial. Its 108 sampled text/background pairs have no contrast failures,
and no page errors were logged. `packaged-industrial-music-library.png` records
the view. Source/runtime byte comparisons are retained in `../packaged-source.json`.

Reviewed and corrected in this pass:

- Industrial Audio settings, complete Music Library dialog, mission library,
  race Ready, race Pause, replay Ready, and the embedded offline-download dialog.
- Nested music, offline, replay, recovery and creator surfaces now consume the
  same panel, inset, toolbar and semantic-state recipes. Quiet text centers remain
  distinct from textured edges. Control and link spacing no longer runs together.
- Mission-card action badges had ivory text on amber at approximately 1.58:1.
  They now use the theme's paired action foreground and a larger 12px label.
- Dnipro Porcelain uses the same Music Library dialog at desktop and 390px width.
  The narrow dialog remains within the viewport with no horizontal page overflow.
- Dnipro high-contrast appearance controls passed the 7:1 sampled text threshold
  at 390px. The check restored normal contrast and Industrial afterwards.
- The actual Theme selector now has a stable accessible name independent of its
  selected option. Native selection and Apply were exercised through that label.

`contrast-checks.json` records the sampled computed-style results. The method
compares direct rendered text with its nearest opaque ancestor background and
excludes hidden/inert elements. Normal text uses 4.5:1, disabled text 3:1, and
high-contrast text 7:1. This does not measure texture extrema, alpha compositing,
canvas text, full screen-reader behavior or all state combinations. Screenshots
provide complementary visual evidence.

The primary `/game/` preview remains behind its existing password gate. No gate
was bypassed. Actual unguarded multiplayer/replay/tool routes and production-host
tests supply the evidence for this pass. Main home/results/rewards and broader
device/language combinations retain their prior evidence and open qualification
items; this is not a claim that every requested visual acceptance gate is closed.

The optional local storage warning shown in some shots is retained honestly.
It is not counted as an appearance regression or concealed by changing user data.
