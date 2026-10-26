# Propulsion inspector at 200% zoom — 19 October 2026

The English and Ukrainian inspector workflows passed an actual Chrome Guest
**200% page-zoom** check. Chrome's accessibility tree reported `Zoom: 200%`;
this was not CSS scaling or responsive-device emulation.

## Exact package and scope

The standalone World package was freshly emitted from clean committed source
`7d92d2fd10a0e0b098f95eadea30df9bb5080932`, tree
`70343197c6178f45d7edee2ff06c84af83acbdc3`. Every emitted input was checked
against its committed bytes. It contains **209 files / 18,628,527 bytes** and
was served only from `127.0.0.1:8883`. Unlike the earlier narrow-layout receipt,
this check used a complete fresh package without a source overlay.

The initial attempt at the artifact root returned 404; the actual emitted
`optional-practice/fpv-worlds/index.html` entry then loaded and unlocked through
the normal password form. The test used a separate Guest session, not the
public SIM tab or a user's Chrome profile.

## Observed results

- Both locales reached Settings → Controls → workbench → Aircraft → Use in
  draft → Expert PID → Advanced reference practice → Aircraft and controller
  tuning → Bench data. The Air65 draft used the current aircraft configuration.
- The synthetic command-axis example remained explicitly unavailable for the
  battery calculation. Editing command to **0.5** with keyboard input, Tab and
  Return updated its source point to 6,000 rpm, 4 N, 0.04 N·m and 4 A.
- A synthetic voltage-axis fixture with `I(V) = V` was pasted through the
  ordinary inspector. Keyboard entry of **3 V**, **0.2 Ω**, one independent
  path, and Space on the DC-current declaration enabled calculation. Both
  locales displayed **2.5 V**, **2.5 A**, **7.5 W** source power, **6.25 W**
  delivered power, **1.25 W** resistance loss and zero equation residual.
- The long Ukrainian current-basis label wrapped within the fieldset. Its
  checkbox, numeric controls and action remained visible and reachable. Focus
  on Evaluate point / Calculate load was unobscured in the captured views.
- Changing English resistance from **0.2** to **0.3 Ω** cleared the old result
  and restored the instruction to calculate. This closes the previous manual
  result-invalidation attempt that was inconclusive during mobile emulation.
- The practice clock and retained interval stayed at **0.0–0.0 seconds**.
  Return to tuning restored the PID section and its 14-change aircraft draft.
  Revert restored **My drone / Legacy feel / zero changes**. No flight, setup
  save, archive creation/deletion or public-tab interaction occurred.
- The Guest window and the test's local server were closed afterward.

Screenshots are retained in the task's `sustained-flight` visualization folder:
`propulsion-inspector-200-en-20261019.png` and
`propulsion-inspector-200-uk-20261019.png`.

This is a desktop Chrome, local-package layout/keyboard check. It does not
qualify physical touch, a virtual keyboard, installed PWA behavior, other
platforms, public deployment, measured propulsion, or archive retention. The
synthetic data never changes aircraft settings or establishes real-aircraft
accuracy. No source modification was necessary for this check.
