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

## Shared terrain and active cuts

The terrain/trail successor to source `9f04273a09dd23d44236c1715d62cfa460171e24` adds a small drawing adapter. It borrows `terrain.wall` once from the same accepted snapshot as the actors and picture. The current reviewed asset is `terrain.wall.field-kit` revision 2: a complete 16×16 tile. The host prepares the image; the painter neither decodes it nor owns its lifetime. Each authored wall keeps its flat backing and receives the prepared tile through the shared pivot-aware image primitive with nearest sampling. First Connection has no wall cells and gains none. Relay Yard keeps its existing wall geometry.

Wall preparation precedes actor adoption. A rejected reader or malformed advertised image/pivot leaves the previous complete presentation usable. An absent wall, absent image reader or explicit null snapshot retains the historical flat-wall path; that compatibility behavior does not certify a required collection as complete. Host/compiler validation remains responsible for required assets and approved content identity.

Prepared Team cuts reuse the shared dark-outline, player-colour and light-core trail primitive. The adapter maps Team cell coordinates to the primitive's 16-unit convention without changing the route: safe anchor, visited cell centres and the actual fractional player head. Responsive widths derive from canvas CSS width. Cosmetic pilot offsets never move trail endpoints. P1/P2 accents, number/shape badges, contact markers and all downstream Support, rescue, warning and objective cues remain intact. Explicit null presentation keeps the original trail drawing.

Motion uses the existing active run time and resolved motion scale. Pause adds no new clock; reduced effects removes the moving trail accent while retaining the outlined path and head. No simulation, input, collision, scoring, campaign, replay or HUD contract changes.

`game/test/coop-terrain-trail.test.mjs` exercises the real core and painter at 1152 and 320 CSS pixels, both arenas, accepted replacement and failed adoption, image ownership, exact trail endpoints, identity and unchanged run state. Canvas commands and PNG byte/header checks are distinct from decoded browser pixels. Actual arena review over revealed artwork, performance, touch/controller hardware, source release gates and public verification remain necessary before acceptance.

Reproduction prompt:

> Check Team terrain and active cuts against the approved shared presentation. Borrow the exact prepared `terrain.wall` revision and geometry; do not reload or dispose it. Observe both players making legal simultaneous cuts in First Connection and Relay Yard. Confirm their safe anchors and fractional heads, three-layer trails, number/shape identities, paused/reduced effects and explicit null compatibility. Reject malformed advertised walls atomically. Keep core outcomes, HUD and all existing Team role cues unchanged. Separate command-level evidence from native artwork readability and public release acceptance.

## Active short-landscape layout

The Team shell uses a passive board slot around its existing canvas and overlay. While gameplay is active in landscape at a viewport height of 500 CSS pixels or less, natural-height HUD, objective and footer rows surround the remaining arena space. Both the slot and inner grid allow their fractional tracks to shrink below the canvas's intrinsic dimensions. The sizing rules preserve the canvas's 2:1 aspect ratio and aim to fit it within that space without stretching or cropping gameplay; all-state containment still requires qualification.

Touch gutters depend on the pads that are actually visible, including mixed keyboard/controller/touch seats. Existing pad nodes and target sizes, player status, Support, objective, clock, caption and Pause action remain present. Paused/results screens keep their existing flow. This layout change does not alter the logical board, input semantics or simulation.

Qualification must measure the actual viewport, entire canvas, footer and visible controls together with Standard/Large text. Include 600×400, 844×390 and portrait layouts, safe-area insets, both player identities, long multi-core objective labels and downed/rescue/recovery labels. A paused screenshot cannot establish active-layout fit because the active layout rule requires the overlay to be hidden. A zero-reserve downed player can remain available for contact rescue while the active screen is inspected; the rescue channel lasts one second of active run time and must be observed live. Modeled layout/host tests do not establish CSS geometry, physical-device usability or complete phase acceptance.

Reproduction prompt:

> Review Team's complete active arena and controls in short landscape and portrait with Standard/Large text, safe-area insets, long multi-core objectives and each visible-pad combination. Use normal play to reach downed, held Support and recovery; retain all state labels and minimum 44 CSS-pixel targets. Measure canvas aspect and bounds without cropping or stretching gameplay. Check explicit Pause/Resume and return focus separately. Record actual viewport, visible controls and evidence category; do not use a paused dialog or a modeled input test as proof of active native layout.
