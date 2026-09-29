# Current company branding: source browser verification

Date: 2026-09-29. Chrome extension browser, source origin `http://127.0.0.1:8768`, EN, viewport **390 × 844 CSS pixels**. This checks all 14 current edition landings after the FPV / LINE rename and again after the final explicit title/logo CSS selector correction. The results below describe that second pass, with `menu-scene-motion.mjs` present. It is separate from unit tests and prior compiled-launcher checks.

Every row passed: observed landing title equals its current catalog label; original company logo and scene decode; heading/text-fragment bounds and all six visible controls fit the viewport; no horizontal document overflow; only Solo is offered. The controls were Start, Select Mission, Settings, Sound, fullscreen and Solo. No mission was started, progress was not changed, and no controls were activated.

| Source query `edition=` | Observed title | Logo / scene / fit | Propeller |
| --- | --- | --- | --- |
| `coupa-all` | Coupa Village / LINE | Pass | Not applicable |
| `coupa-adventure` | Spend in Motion / LINE | Pass | Not applicable |
| `coupa-culture` | Inside the Village / LINE | Pass | Not applicable |
| `coupa-foundations` | From Need to Value / LINE | Pass | Not applicable |
| `coupa-operations` | A Day in Coupa / LINE | Pass | Not applicable |
| `coupa-developers` | Connect the Network / LINE | Pass | Not applicable |
| `droneaid-community` | Community Relay / LINE | Pass | Not applicable |
| `droneaid` | DroneAid / LINE | Pass | Decoded; rotation observed |
| `droneaid-nl-workshop-lights` | Workshop Lights / LINE | Pass | Decoded; rotation observed |
| `droneaid-nl-parts-in-motion` | Parts in Motion / LINE | Pass | Decoded; rotation observed |
| `droneaid-nl-makers-together` | Makers Together / LINE | Pass | Decoded; rotation observed |
| `droneaid-nl-careful-handoff` | The Careful Handoff / LINE | Pass | Decoded; rotation observed |
| `droneaid-nl-signals-of-support` | Signals of Support / LINE | Pass | Decoded; rotation observed |
| `droneaid-nl-shared-horizon` | Shared Horizon / LINE | Pass | Decoded; rotation observed |

The canonical public selector `droneaid` loaded `DroneAid / LINE` and retained the internal edition identity `droneaid-nl-community`, as intended for compatibility. For each of the seven Dutch DroneAid entries, two actual browser samples had different transform matrices and the propeller animation was running. Each Dutch DroneAid logo also had the intended computed **88 × 88px** square dimensions. Every title used **44px**, `rgb(240, 249, 255)` for its name, with the separate / LINE accent retained. This is visible DOM animation evidence, not a claim about physical-device performance.

The largest heading line box was **138.59px** high; the lowest control ended at **720.49px**, within the 844px viewport. Departure Mono’s inline glyph boxes extend about 4.8px below the heading’s CSS line box. The heading and its content parent have visible overflow; the measured text fragments all remain inside the viewport and end before the Solo control. Therefore `scrollHeight > clientHeight` alone was not treated as text clipping. The longest Coupa title was also inspected visually.

Evidence:

- [Per-edition exact DOM bounds, logo URLs, scenes and rotation matrices](fpv-line-brand-2026-09-29/edition-source-390-corrected.json)
- [Canonical DroneAid portrait](fpv-line-brand-2026-09-29/droneaid-390-corrected.jpg)
- [Long Coupa title portrait](fpv-line-brand-2026-09-29/coupa-developers-390-corrected.jpg)

The temporary viewport override was reset and the agent-created Chrome tab was closed. No language or motion preference was changed during these 14 checks. This pass does not claim Ukrainian, other dimensions, rebuilt distribution, native package installation or controller-hardware acceptance; those have their own earlier or subsequent evidence.

The earlier unsuffixed JSON/screenshots remain as historical before-correction evidence; the `-corrected` artifacts linked above are the final pass.
