# Lesson step input continuity

The paused learning preview now keeps the last recorded stick command visible.
In the reported Coordinated left and right turns lesson, the lift ends at49.3%
throttle and the next step begins with that same49.3%. The paused UI previously
replaced it with0%, even though the drone and recording retained the real value.

The coach now derives all example markers, readouts and illustrative motor inputs
from the snapshot's applied command, including while paused or selecting a step.
Its observer receipt uses the same displayed values. Manual input ownership still
clears on pause, focus loss or disconnection; no real flight can arm from a guide.

Natural objective transitions retain the same flight and stick elements. A
selected step replays the exact prefix and opens at the preceding objective's
final command. It never substitutes neutral input merely because playback is
paused. Actual command changes in the verified recording remain intact; this
fix does not invent smoother commands, alter physics or change proof identities.
The separately labelled movement guide remains a presentation aid.

## Verification — 2 October 2026

The production coach, SVG markers/readouts and World runtime passed120 actual
browser functional cases across all58 original school recordings, including316
natural boundaries and316 explicit step seeks. Each opening command is checked
against the preceding objective's exact final command, then paused, repainted and
resumed. All58 final proof identities remain unchanged. The reported49.3% case is
checked in EN/UK; keyboard/radio pause and disconnect ownership are also checked.
Evidence: `docs/evidence/fpv-step-boundary-browser-20261002.json`.

Focused syntax, lint, formatting and independent source/lifecycle review pass.
No additional unit coverage or physical-device acceptance is claimed. The
continuous-school player was rebuilt and its coordinated-turn lesson inspected.
Public availability requires protected publication and deployment verification.
