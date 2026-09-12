# v0.15.0 frozen browser and offline check

Verified on 12 September 2026 against the independently preserved `v0.15.0` site, source commit `8eef7e2ada51dbd6ebec0fe134aeef667d047c6c`. The [integrity report](integrity-notes.md) establishes the archive and rebuild identity; this report records actual browser use of that artifact.

## Offline preparation and disconnected play

The archived CLI served `releases/v0.15.0/site` on isolated port 8832. In its fresh solo page, Settings → Prepare offline play reported **128 verified files / 20,535,053 bytes**, with no missing or corrupt files. The displayed build ID was `8b0c4581556d63a66894c21eac7aa3c2b9aaa5c6270b702034a6b96f2228554e`, matching the independent artifact inspection. The server process then exited with code 0 and stayed stopped for every check below. The existing port-8767 server was untouched.

Fresh navigation to `/game/` loaded the frozen game offline. With Tap steering and Grid + buffer, Start followed by the visible Down button completed First Signal: **52.2% captured, three lives, 8,160 points, HUD 0:03**. The full-picture celebration and Keep picture action appeared. After another navigation, Collection contained one gold First Signal picture, the first-clear appearance milestone and the corresponding achievements. Its Play celebration action worked. Local scores retained exactly one entry: **8,160 points / 3.71 seconds / gold / scout / grid-center**. The score's precise saved time is distinct from the rounded HUD clock.

The [machine record](frozen-offline.json) preserves the visible offline result, play outcomes and browser logs. Screenshots of the [first clear](frozen-solo-win.jpg) and [collection celebration](frozen-gallery-celebration.jpg) were inspected. The first-clear screenshot is scrolled; it is evidence of that displayed state, not a claim that the whole desktop board and flight deck fit simultaneously.

## First offline Playground load and controls

The Playground had not been visited on this isolated origin before the server stopped. Its first load succeeded offline, including the new Control geometry module. Using its native size presets and Capture geometry action measured the actual child document:

| Configuration                                 | Actual viewport | Flight targets            | Geometry result                                                                                                         |
| --------------------------------------------- | --------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| First Signal                                  | 1280 × 720      | 11, each at least 44 × 44 | All initially inside viewport; no positive-area target/target or target/arena intersection; no horizontal page overflow |
| First Signal                                  | 844 × 390       | 11, each at least 44 × 44 | Same result; landscape rail fits beside the board                                                                       |
| First Signal                                  | 320 × 640       | 11, each at least 44 × 44 | Same result for this ordinary ready screen                                                                              |
| First Signal with an 80-character class label | 320 × 640       | 11, each at least 44 × 44 | No intersections or horizontal overflow; seven targets initially inside, four require vertical scrolling                |

The complete [geometry captures](frozen-control-geometry.json) retain dimensions, scroll extents, actual media capabilities and each control's state. All four captures reported fine pointer, hover and DPR 2; coarse pointer was false. These are CSS viewport checks on this browser, not physical touch or mobile hardware emulation. Reported visibility and scroll/client comparisons do not establish absence of occlusion or glyph-level clipping.

The existing long-label fixture was loaded through Complete pack JSON → Apply content JSON → Play configuration. Down and Stop worked through visible controls in that actual preview; the run had a live line, three lives and zero captured percentage before replacing the practice scenario. No runtime state was injected.

## Compact failure, reading and retry

Through the same offline editor, the preserved strict Grid boss-lane fixture was applied and explicitly launched. At 320 × 640, Start → Right → Stop produced the expected terminal marked-lane loss at HUD 0:02, zero lives and zero coverage/score. Read details exposed the cause, suggested action and practice reset consequence; Done reading kept the terminal state. Try again started a fresh attempt with **one life, 0.0%, zero score, HUD 0:00, SHIELD RELAY and 0 / 2 objectives**.

The [compact reader screenshot](frozen-compact-retry-reader.jpg) was inspected. Its inner reader scrolls and the short preview requires vertical scrolling to reach some actions. The complete text was read from the actual Mission details region. This frozen check does not claim a separate physical controller or pointer-edge test; the [source browser report](source-browser.md) records the software Controller Lab and broader layout checks.

After this practice work, the normal page still showed exactly the one First Signal score above. Solo and Playground warning/error logs were both empty. The source full-preview host errors documented in [the source report](source-browser.md) remain recorded; these clean frozen logs do not erase that separate observation.

## Scope

These checks establish the tested artifact's disconnected navigation, saved result and picture replay, custom-content loading, control geometry and compact retry behavior. They do not establish physical iPhone/Safari/controller behavior, native or store acceptance, a deployed public service, beginner comprehension or player enjoyment. Earlier release files and tags remain independently preserved.
