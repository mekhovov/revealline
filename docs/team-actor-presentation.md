# Team actor presentation candidate

This internal P08-A slice builds on the Team picture host checkpoint `d3ff0bc1e9948f5752e79c5b21c8207dd74c69e1`. It is a read-only drawing adapter, with no Team core, level, replay, scoring, host input, producer or compiled-registry change. It is not phase or release acceptance.

## Explicit roles and existing artwork

| Team presentation role | Prepared source slot                             | Retained Team meaning                                                                      |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Pilot 1 and Pilot 2    | `player.scout.compact` / `player.scout.detailed` | Equal-capability players; number plus circle/diamond identification, downed and grace cues |
| Field-bouncer          | `enemy.bouncer`                                  | Actual Team drifter movement and contact radius                                            |
| Line-hunter            | `enemy.border-patrol`                            | Actual Team hunter; target lock, charge and recovery remain Team states                    |
| Stronghold core        | `enemy.relay-sentinel`                           | Stationary authored structure, shield, anchors and capture state                           |

The hunter reuses an existing coral quad image, not Solo border-patrol behavior. The pilot image does not adopt the Solo Scout class. These are five existing source frames, not new Team character sets. The exact `fpv@19` / null-collection compiled snapshot and PNG hashes are pinned in the source inventory and new test. No accepted source authority is broadened.

`coop-actor-presentation.mjs` borrows prepared images and geometry from the accepted page snapshot. It acquires, decodes and closes no resources. A replacement snapshot resets only cosmetic history. Missing images retain the prior geometric drawing; that fallback does not prove shared-art readiness. The accepted Team picture host still owns the candidate/accepted presentation boundary.

## Drawing and motion

The adapter reuses the shared actor sampler, body-size policy and prepared-image renderer. Position observations determine heading; Team ticks and elapsed active time drive cosmetic phases. Pause, downed state and reduced motion freeze the relevant accents. New attempts reset history. The shared renderer draws pilot rotors from prepared geometry; this slice does not add newly authored tread, hunter or stronghold animation sequences.

All body images are painted before functional overlays. Player numbers retain circle/diamond form cues, including the player number when downed. Required labels get a dark backing over artwork. Hunter lock/charge/recovery and slow labels begin outside the cosmetic body, with bounded placement around other cues; grace and slow states retain dashed patterns. Stronghold art uses the shared boss-size policy beneath anchors and shield/capture labels, without creating a circular core hitbox. Player/enemy contact markers keep the real radii.

Compact/detailed source selection is separate from display scaling: microtile or a canvas below 480 CSS pixels selects the compact pilot frame. Shared CSS-size limits still apply. A 64-pixel source is not a 64-pixel rendered body or a larger hitbox. The sampled 16-pixel source preview does not establish detail readability; numbers, form and phase cues remain necessary.

## Evidence boundary

The standalone source sheet was visually reviewed at 1924×1356, DPR 2. At 32 pixels the tracked vehicle, quad and radar structure were distinct; 24 pixels retained coarse shapes. Fine details at 16 pixels cannot carry identity alone. This is source-sheet evidence, not actual-arena or motion acceptance.

New tests observe real Team run continuity, exact existing PNG hashes/headers, prepared image identity, geometry, sampled poses and canvas commands. Their image objects are modeled; they do not prove browser decode, bright-art contrast, clipped-border readability, physical devices or complete actor parity. The held05 predecessor passed seven whole files (159/159 on each supported Node). Its subsequent actual-arena review failed label readability and edge clipping; that test result did not establish native acceptance. No full Team win/rescue or all-character-set claim is added.

The initial whole Node 22 run exposed a real lookup omission: it used the source-image name `bouncer` instead of the strict Team type `drifter`. That failed 150/158 run is retained, and this successor preserves actual `drifter` identity while explicitly reusing the field-bouncer image. A separate minimum-radius regression reproduced the shared sampler's cosmetic clamp (0.05 versus Team's valid 0.01); Team frames now keep the actual radius. Source review alone did not establish these boundaries.

The held05 clean 390×844 native capture had a 362×181 arena: inherited labels rendered near three CSS pixels, and pilot body/rotor art clipped at the outer edge. The native record retains seven events and six JPEGs, including an inconclusive transitional capture and a mismatched landscape/DPR capture; neither is a new gameplay defect. A legal Relay Yard loop banked 0.9%, but did not prove full-win or rescue behavior. Backing plates alone did not establish readability. Catalog `bodyRecord` surface-motion accents are not passed to the shared renderer in this slice; their explicit Team mapping remains P08-B work, without new loaders or behavior aliases.

## Readability successor

The Team-only layout helper derives cue size from the actual canvas CSS width. Player numerals use a 14 CSS pixel minimum and separate 20/24-pixel circle/diamond badges; anchor and concise state labels use a 12-pixel minimum, capped at 18. These sizes are proposed presentation bounds, not a readability or accessibility certification. `LOCK 1/2`, `CHARGE`, `RECOVER`, `SLOWED`, and indexed `SHIELD` / `CAPTURE` / `SECURED` retain their Team meanings. A downed plus and dashed grace cue remain distinct from color.

The full prepared pilot frame, motor and nose envelope is bounded after heading and banking. Only its cosmetic body can shift inward; no actor coordinate, contact radius, trail endpoint, board extent or source crop moves. A short dark-backed dashed tether connects shifted body art to the actual luminous cutting head. The shared renderer's optional finite `bodyOffset` surrounds only body/rotor/badge drawing and is restored before the real contact cue; absent or invalid offsets preserve the default command path. Team pilots have no catalog role badge. Full cue rectangles stay inside the arena and avoid both true pilot heads; text is never shrunk to fit. If a canvas is too small to contain a complete plate, the helper refuses that plate rather than drawing clipped text. The supported phone-size gate remains actual native review, not this defensive behavior.

Command tests characterize the original two failures and then check CSS sizes, compact/detailed images at corners, rotation/banking/motor bounds, plain and theme fonts, complete cue plates, unchanged run bytes and shared default drawing. The corrected eight-file suite passed 167/167 on both Node 22.22.2 and Node 20.19.5 with 345 unchanged inputs. Root then visually inspected eight original native JPEGs from eight observations at desktop 1280×720 and clean portrait 390×844. Both First Connection and Relay Yard banked an actual 0.5% loop with three reserves; CHARGE and LOCK 1 were observed, and Reduced effects retained essential cues. Pilot body/head association was understandable in the observed edge positions. Only small revealed pockets were inspected, so complete bright-art contrast, crowding, downed/rescue/grace, stronghold success, full wins and physical-device acceptance remain open. No HUD CSS change is included here; the separate HUD checkpoint is not composed into this source.

[XAG 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102) motivates checking gameplay symbols against changing backgrounds, and [XAG 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) motivates shape and text cues in addition to color. Token contrast and source-sheet previews do not establish actual-size readability or full accessibility.

The [checkpoint evidence](verification/cross-mode/p08-team-actors/README.md) retains the source sheet, incorrect-type and minimum-radius failures, the held05 159/159 pair and failed native readability group, the two-case size/clipping characterization, and corrected 167/167 pair with before/after HTTP pins. These groups qualify different source boundaries and are not additive coverage. The final source remains an internal P08-A checkpoint; catalog surface-motion work and broader Team/P08 acceptance remain separate.
