# Team actor presentation checkpoint

This internal P08-A source checkpoint builds on exact Team picture-host commit
`d3ff0bc1e9948f5752e79c5b21c8207dd74c69e1`. It borrows five already prepared sprite
frames with explicit Team roles. Actual `drifter` and `hunter` behavior, actor
positions/radii, board/trails, score, input and accepted artwork ownership stay
unchanged. No host, HTML, CSS, compiled registry, asset, format or version changes
are included. The separate narrow HUD checkpoint is not composed here.

The final held06 source adds CSS-sized number/shape badges and concise state
plates, with complete rectangles kept inside the arena and away from both real
pilot heads. Complete pilot sprites, rotors and nose cues can shift inward at an
edge; a short tether connects cosmetic art to the unchanged luminous head. The
shared renderer's optional body offset restores before contact drawing and leaves
ordinary callers' command path unchanged. Crowding remains best-effort and needs
native inspection; layout bounds alone do not establish readability.

## Source and test boundaries

| Boundary                     | Result and limit                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial whole Node 22        | 150/158. Actual Team `drifter` was incorrectly looked up as source-image `bouncer`; no Node 20 run was claimed on that failed source.                                        |
| Contact overlap              | A focused 0/1 → 1/1 check restored each enemy's actual radius/center after all body images. The final oracle binds each equal-radius enemy to its own transform.             |
| Minimum radius               | A separate 0/1 regression exposed the shared cosmetic 0.05 clamp against valid Team 0.01. The Team frame now preserves its actual radius.                                    |
| Held05 predecessor           | Seven complete files, 159/159 on Node 22 and Node 20, with unchanged inputs. Subsequent native rendering failed portrait labels and edge clipping.                           |
| Readability characterization | Original two command cases failed 0/2, then passed 2/2. The expanded new layout file passed 8/8 before whole qualification. These are not extra coverage totals.             |
| Held06 final                 | Eight complete files, 167/167 on each Node; 345 identical game/authoring inputs, 9,341,964 bytes, before/after both executions. Node 22 took 78.32 s; Node 20 took 126.35 s. |

`verification-readable-tests.json` records the final pair and its eight file
names. The source-only peers and tests do not certify browser decode or visual
clarity. The eight held06 source/test/guide originals are preserved separately
from final documentation updates. The original two-case characterization file
was reconstructed from its retained prefix and accepted only after its exact
4,273-byte size and SHA matched the prior execution receipt; it is not described
as a contemporaneously retained copy. Earlier source reviews missed the type
enum; executable failures, rather than those reviews, established the correction.

## Native observations

Root visually inspected the original source sheet at 1924×1356/DPR 2. At 32 pixels
the three role bodies were distinct; 24 retained coarse shapes. Fine details at
16 pixels were insufficient as the sole identity cue. This was source-sheet
review, not actual-arena acceptance.

Held05's `native-root` contains seven observations and six JPEGs. The clean
390×844/DPR 1 capture had a 362×181 arena with labels near three CSS pixels and
clipped pilot bodies/rotors. The legal Relay Yard loop banked 0.9% with three
reserves. Transitional capture 04 and mismatched/banded landscape capture 06
remain inconclusive; no extra game bug or zoom cause is inferred. All 15 bound
HTTP/local source and asset rows matched before/after that native group.

Held06's `native-readable-root` contains eight observations and eight original
JPEGs, all visually inspected by root. First Connection and Relay Yard were
observed at 1280×720/DPR 2 and clean 390×844/DPR 1. Each map banked an actual 0.5%
loop with three reserves. Player numbers/shapes, HUNTER, SHIELD and anchors were
readable in the phone observations; CHARGE and LOCK 1 were also observed.
Reduced effects retained essential cues after explicit keyboard Resume. Edge
body/head association was understandable in these cases, and an interior cutting
head stayed attached to its line. All 16 bound HTTP/local rows matched before and
after the final native group. The fresh browser tab avoided the earlier capture
issue; it did not constitute a runtime fix.

Only small revealed pockets were observed. This does not qualify complete
bright-art contrast, downed/rescue/grace, stronghold success, full wins, all
actor treatments/themes or physical controller/touch behavior. Fine sprite
information remains limited at the narrow arena size. P08-B catalog `bodyRecord`
surface-motion accents remain unwired. The unchanged HUD in this actor-only
preview still wraps a name; its separate correction requires later composition.
Neither source tests nor these native observations complete P08 or a public
release gate.

## Retained files

`evidence.json` maps every original cache file to a member of the lossless
`evidence.zip`, with byte size and SHA-256. Original logs, source diffs, tested
source copies, preview helpers/bindings, native observations/images and all failed
or superseded receipts remain unchanged. ZIP CRC, exact decompressed hashes and
current-original equality were verified. Preview helpers are historical evidence,
not a deployment or invitation to rerun old candidates against moving files.
See [the actor contract](../../../team-actor-presentation.md) for ownership and
reusable guidance. No additional tests or browser journeys were run for packaging.
