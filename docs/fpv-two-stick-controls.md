# Two-stick keyboard controls

## Player behavior

The default keyboard layout groups inputs like a Mode 2 radio: the left hand
controls throttle and yaw; the arrow keys control pitch and roll. The settings
panel offers **Two-stick** and **Classic**. The choice is shared by Academy,
World Studio and the learning lab, and persists locally.

| Action             | Two-stick                           | Classic          |
| ------------------ | ----------------------------------- | ---------------- |
| Throttle up/down   | W / S                               | Up / Down        |
| Yaw left/right     | A / D                               | Q / E            |
| Pitch forward/back | Up / Down                           | W / S            |
| Roll left/right    | Left / Right                        | A / D            |
| Fine control       | Shift                               | Shift            |
| Arm / pause        | Space, with the flight view focused | On-screen action |
| Reset              | R, with the flight view focused     | On-screen action |
| Pause/menu         | Escape / P                          | Escape / P       |
| Fire in combat     | F                                   | Space            |

Flight and lab hints derive from the selected layout. Selecting a different
layout pauses flight and clears held input. Throttle remains a retained value:
releasing W or S stops adjusting power. The existing fine-control gains,
canonical commands, 50 Hz simulation and deliberate arming checks remain.

Native buttons, text fields, selects and menus keep their normal keyboard
behavior. Space activates a focused button; it does not also arm the drone.
The learning lab owns its controls separately: its Space/R shortcuts affect
only the preview, while the actual lesson remains paused and unscored.
Radio calibration, touch layouts and controller bindings are unchanged.

## Reference inspection — 3 October 2026

The authenticated [FlightDivision simulator](https://www.flightdivision.com/sim)
was inspected through its visible settings, free-flight and Gear screens.
Its keyboard fallback shows W/S throttle, A/D yaw, arrow-key pitch/roll,
Space arm/disarm and R respawn. This change adopts that movement grouping;
our existing safe arm/pause behavior remains explicit. Tab stays available
for accessible menu navigation instead of becoming a drone-selection wheel.

The visual reference has a coherent stylized industrial palette, large readable
structures, defined shadows and quads with recognizable frames, cameras,
batteries and swept propellers. These observations inform a separate focused
drone/Container Yard presentation increment. No proprietary models, textures,
branding or application code were extracted. The reference's broader physical
fidelity and real-world training claims were not independently measured.

Supporting references:

- [FlightDivision control-axis explanation](https://www.flightdivision.com/blog/fpv-drone-controls-explained)
- [Three.js PBR material documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html)

## Qualification

The final source and development packages each pass 25/25 actual-browser
functional check groups: both hosts, both layouts, native-focus/menu isolation,
held-fire release through preset changes, persistence, replay commands and local
school practice. Exact dependency hashes and results are retained in
[source evidence](evidence/fpv-two-stick-browser-source.json) and
[packaged evidence](evidence/fpv-two-stick-browser-package.json).

The browser fixture uses synthetic keyboard events, child-native isolated
IndexedDB, controlled frame callbacks and a renderer stub. It found a genuine
release-propagation defect: menu navigation could consume a held Space release
after a preset change. A capture-phase, release-only observer now clears the
owned firing key without intercepting menu actions. Repeated Space also prevents
page scroll while triggering only one arm/pause action.

Additional unit coverage remains deferred to the approved final phase. This
evidence does not qualify physical radio, iPhone, Steam Deck, graphics performance
or novice learning outcomes. Protected CI and public deployment are separate gates.

Frozen candidate `6562df920` also passed all three optional package admissions,
committed-input/ZIP-member verification and two byte-identical builds.
[Admission receipt](evidence/fpv-two-stick-package-admission.json) retains the
source identity and unchanged package limits. Package review gates remain pending;
`publicEligible: false` is not a failed build or a public release claim.
Packaged touch checks pass32/32 with368 challenge/mode starts; actual WebGL
section replay checks pass53/53. Receipts are stored alongside the keyboard evidence.
