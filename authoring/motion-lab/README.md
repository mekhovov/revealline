# Character motion lab

A working browser **character, motion, material and arcade ability design sandbox** on a fixed **48 × 36 / 4:3** arena. It is isolated from the game and the pack/media contracts. There is no territory game, real opponent, damage/life system, economy, terrain collision or drone physics. The ability study adds abstract toy markers, supply pads and deterministic effects. The character passes through terrain samples intentionally. Test collection results remain separate and explicitly simulated.

## Open and use

From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open [the lab](http://127.0.0.1:8080/authoring/motion-lab/). No npm, build step, external fonts, CDN or AI call is needed. HTTP is required for ES modules and JSON; `file://` is unsupported.

- **Autoplay** follows a fixed cardinal route. Enabling it resets the route start. Pause freezes both the arena and inspection animation; Reset keeps artwork and response settings.
- **Arrows / WASD** request the most recently held cardinal direction under the selected turn policy. Release stops travel immediately. **Shift / Hold boost** multiplies speed by 1.7; **Space / Hold slow** by 0.38. Touch and keyboard holds are supported.
- **Body turn response**, banking, rotor speed and attachments affect presentation only. They never steer or delay authoritative travel.
- **Escape, window blur and tab hiding** pause and release inputs. Press Play or intentionally move to resume. Held buttons also release on losing focus.
- **Reduced motion** begins paused when the OS requests it. It freezes attachment animation, removes particles, and disables banking/facing interpolation. Explicit Play still allows intentional movement.

Defaults remain **hybrid terrain** and a **1.25-cell FPV body slot**. The scale slider changes presentation only. The body readout reports the slot's CSS-pixel width; transparent padding and contained non-square art may occupy less of that slot. The enlarged north-up **inspection view** uses the same body and attachment rig without enlarging the arena character. Its slow mode exposes blades/flaps/exhaust detail; disabling it follows the normal visual response.

## Two configurable turn policies

Use **Turn policy** above the arena. The value is also configurable as `motion.turnPolicy` in [presets.json](presets.json): `immediate` (default) or `grid-center`. A missing value preserves immediate compatibility. These are demo movement policies; the planned game ruleset IDs are `input.turn-immediate.v1` and `input.turn-grid-center.v1`, not registered content-pack primitives.

Changing this selector **explicitly resets and pauses** at the selected policy's route start, disables autoplay, clears all held controls and the buffer, and keeps artwork, collection preferences and response settings. The event note states the new coordinate. There is no silent snap while continuing a run.

| Behavior | Immediate | Grid center + buffer |
|---|---|---|
| Turn | Changes travel direction immediately, even between cells | Changes travel direction only at the next cell center |
| Reverse | Immediate | Queued exactly like a perpendicular turn; unchanged speed until the center, then reversed |
| Buffer | None | One latest-held cardinal command; newer commands replace it |
| Release all directions | Stops immediately | Stops immediately at the current position and clears the buffer; never coasts to a center after release |
| Restart between centers | Travels in the new requested direction immediately | Travels along the retained previous direction while a direction remains held, turning at the next center into that current command |
| Bounds | Historical inset: x 0.8–47.2, y 0.8–35.2 | Actual edge cell centers: x 0.5–47.5, y 0.5–35.5; an outward command stops there, and a new turn/reverse is immediately eligible |

The drawn cell `[n,n+1]` has center `n+0.5`. Grid mode therefore resets to **(6.5,6.5)**, while immediate mode retains **(6,6)**. Grid autoplay derives center-aligned waypoints from the existing authored route (`floor(coordinate)+0.5`); the source route and 48×36 board remain unchanged. Adjacent waypoints must map to distinct centers, validated before the preview starts. This mode-specific route alignment and edge convention are intentional control-policy differences, not art-driven geometry changes.

In grid mode, commands are consumed **before** spending leftover travel after a center crossing. Boosted or slow frames cannot skip a queued corner or lose the remaining distance. A same-direction command continues straight and cancels a different queued command. Releasing the newest key falls back to the most recently still-held direction; releasing all stops. There is no timed retained tap: the queue remains valid only while its direction is the current held command, and targets at most the next center. Presses shorter than a rendered frame may not create visible movement.

The **queue readout** names the queued direction and target coordinates. A dashed segment, square and arrow mark the upcoming turn on the arena. An empty queue is explicit. The marker is presentation only. **Autoplay** follows its center-aligned route in grid mode and keeps the human queue empty; it compares alignment and visual motion, not human buffering. Enabling autoplay resets to its route start. Any fresh direction input takes over manually.

To feel the difference slowly, choose 3 cells/s under Response, start moving, then press another direction before reaching the next center. Hold slow makes the waiting interval longer. Compare the same inputs in Immediate mode; the policy selector resets the experiment each time.

Boost/slow change travel speed immediately under either policy, with the same multipliers; if both are held their multipliers combine. They do not flush or change a held turn. Body facing/banking, sprites, palettes, attachments and reduced motion never affect turn eligibility, buffer selection, speed or center crossing. At a grid boundary the movement readout is zero; there is no fractional edge position that traps a turn.

Pause, Escape, focus loss, tab hiding, Reset and a policy change clear held commands and the queue. Pausing freezes the current cosmetic pose and position; manual Play with no fresh held direction remains stationary. Stale keyboard auto-repeat cannot reactivate cleared movement or hold-boost/slow buttons after a pause. A new press or an explicit autoplay action is needed. Changing mode changes the planned challenge/result identity; no scored runs or leaderboards exist in this sandbox.

## Configurable arcade abilities

The new **Ability study** is an isolated toy subsystem. **Class / loadout** selects behavior, **Communication module** selects the radio/fiber modifier, and the existing collection selects appearance. Equipping a body cannot change charges, cooldowns, target filters, link budget or abilities. **Apply class appearance** is an explicit convenience that equips an eligible preferred body for the current collection context; it does not change class or link. A preferred earned cosmetic remains subject to collection eligibility.

Use **E / Action** once per action and **R / Pick up** inside a marked supply-pad circle. Keyboard input works with the arena focused. The buttons also support touch and single keyboard activation; holding E/R/Enter/Space does not auto-fire or queue a later action. The readout shows Ready/paused/cooldown, charges, updated markers and temporarily revealed notes. A separate link readout shows signal display, budget and pad availability.

For a first test: select the Light bomber class, click **Reset ability test**, then **Play**. Autoplay is now off, so the character stays at the supply pad until you move. Pick up with R, move close to Tile A, and use E. Try Heavy carrier for two charges, Scout for a temporary note reveal, or Pulse emitter for a travelling dot. None of these results awards collection unlocks.

All ten presets are implemented using five reusable primitives:

| Class ID / FPV label | Primitive | Implemented toy effect |
|---|---|---|
| `scout` / Scout | `pulse`, scan | Temporarily reveals nearby question-mark note labels |
| `light-bomber` / Light bomber | `drop`, clear | Pick up one charge; a drop applies an immediate abstract clearing pulse to nearby ground markers |
| `heavy-carrier` / Heavy carrier | `drop`, clear | Same primitive with capacity two; one charge per action |
| `fiber-courier` / Fiber courier | `pulse`, scan | Scan preset recommending the independently selectable fiber module |
| `fixedwing-courier` / Fixed-wing courier | `drop`, deliver | Pick up a parcel; deliver near the parcel marker; a decorative wake suggests glide, without inertia or continuous-flight constraints |
| `strike` / Strike dash | `dash`, clear | Spend one charge on a short cardinal relocation; a ground-marker tag returns the player to the stage start |
| `interceptor` / Interceptor | `dash`, disable | Short cardinal relocation tags airborne toys only; no pursuit/autoguidance |
| `repeater` / Pulse emitter | `projectile`, clear | One travelling dot per press; limited charges; swept contact updates a ground/air marker |
| `net-catcher` / Net catcher | `net`, capture | Places a temporary field that slows airborne toys and collects eligible toys after sufficient dwell time |
| `relay` / Relay helper | `pulse`, restore | Restores a nearby relay marker |

These are fictional cell/second parameters. There are no real payloads, ballistic models, weapon timings, guidance, aerodynamics, operational ranges or named-aircraft performance claims. A heavy body with six rotors is an original concept, not an identified real model. Labels adapt through family vocabulary: business uses Insight scout, Parcel courier, Batch courier, Express courier, Pulse emitter and Workflow filter. The same toy geometry and primitives remain available across all four palettes.

The **radio/fiber** module is independent of airframe/class. All initial classes accept both solely as fictional game configuration. Radio lowers only the labelled signal **display** while inside a synthetic haze rectangle; it never scrambles inputs or changes movement. Fiber ignores that display penalty and shows a straight presentation tether. Its finite spool/link budget decreases with authoritative cardinal path distance; outbound dash distance is charged once, while a strike's return-to-start teleport is excluded. Empty budget blocks Action but leaves movement and pad pickup usable. R refills charges and the link budget at a pad. This is not cable routing, material physics or a real-world compatibility claim.

Changing class or communication module explicitly resets the toy targets, effects, resources and cooldown while keeping the player's position, selected art and movement policy. It preserves a compatible selected link; **Use recommended link** applies the class recommendation explicitly. Reset ability test resets the player to the selected movement policy's start, clears held input, disables autoplay and pauses. The main Reset, mode change and autoplay reset also start a fresh toy test. Hiding the ability study pauses its clock/budget and removes its layer; movement remains available, and hidden movement is not retrospectively charged when showing it again.

Pause, focus loss and hidden tabs freeze cooldown, moving toys, projectiles and fields. Action attempts while paused are rejected; release cannot schedule a deferred action. Dash deliberately ends autoplay, clears all held/queued movement and uses **authoritative cardinal direction**, not rendered heading. Immediate mode keeps a continuous destination; grid mode lands at the last reachable forward cell center within range, maintaining its rail. If no forward center/destination is reachable, the action rejects without spending a charge or starting cooldown. A tagged strike return uses the correct policy-specific start. Terrain remains visual; dash/projectile/drop effects only interact with the toy markers.

### Ability data and module boundary

[ability-presets.json](ability-presets.json) is separately versioned (`1.0.0`) and names the supported registry `arcade-abilities.v1`. [ability.mjs](ability.mjs) validates class, link, stage, vocabulary and primitive references before running. Unknown primitives or unsupported primitive/outcome pairs fail visibly instead of silently becoming another behavior. This local registry is not a registered content-pack runtime.

- `classes[]`: stable `id`, `primitive`, `description`, `tuning`, compatible/recommended equipment IDs and preferred bodies per family. Common tuning is `cooldown` seconds, integer `capacity`/`initial`/`cost`, `radius` cells, `duration` seconds and `outcome`. Dash/projectile/net use `range` cells. Projectiles add `speed` cells/s; dash uses explicit `resetOnHit`; net uses `slowFactor` and `captureSeconds`. Optional `visualWake` has cell `spacing` and second `duration`; it can be bound to any class without changing travel.
- `equipment[]`: stable ID, label, `budgetCapacity`, `costPerCell`, `ignoreHaze`, and `blockWhenEmpty`. Zero capacity means no budget resource.
- `stage`: bounded supply pads, synthetic haze rectangles and ground/air/note/delivery/relay markers. Air toys follow simple horizontal lanes; their speed and lane extents are validated.
- `vocabulary`: class/link labels for all four palette families, independent from primitive identity.

Pure entry points are `validateAbilityPresets`, `createAbilityState`, `switchAbilityLoadout`, `requestAbility`, `advanceAbility` and `abilityReadout`. `requestAbility` takes a positive, monotonically increasing event ID and `act`/`pickup` type, plus `{player, stageStart, turnPolicy, paused}` context. The demo supplies `player.distance` from the movement engine’s cumulative path counter, including both sides of a center reversal. IDs at or below the last processed event are rejected, including rejected attempts; class resets retain the last ID. Accepted dashes return an explicit relocation command for the demo bridge. The module never reads body sprites, collection saves, browser storage or networking.

The toy clock uses fixed 1/120-second ticks and caps a true frame stall at 250 ms. Projectile contact is swept between ticks. The scene is bounded (24 targets, six pads/haze areas), with at most 32 active projectiles and 16 net fields. These limits keep the study modest; this is not production performance validation. The motion engine accumulates travel distance for every traversed segment before reversal or corner consumption; the ability bridge uses that counter, so frame partitioning does not change spool cost. Its API retains a simple endpoint-distance fallback for isolated callers without `player.distance`; such callers must supply the authoritative counter for accurate out-and-back travel. Dash charges its outbound path separately, and return/reset teleports are excluded.

Ability state is ephemeral. It is not persisted, exported as a real result, connected to the progression fixture evaluator, or used to grant rewards. Future territory integration, balance, collision/capture rules, real character abilities, production sprites and a complete authoring UI remain planned.

## Collection, context and equipment

Choose a **Preview context** to examine family/level/challenge/map availability. Choose **Character to inspect** to view any character, including locked and unavailable art. The arena changes only when an eligible character is explicitly equipped, or when context resolution chooses the appropriate saved/default character. Locked cards show conditions and current progress.

**Equip** saves a cosmetic preference for this exact context, the current theme, or every eligible context. More-specific saved scopes take precedence over broader preferences. When a saved choice is unavailable or locked, resolution uses an eligible authored family starter, then the neutral fallback. No collection ownership or cosmetic equipment changes travel statistics. Ability classes and communication modules are separate controls described above.

| Family | Starter | Earned cosmetic examples | Source distinction |
|---|---|---|---|
| FPV Front | Daybreak FPV | Skyline FPV; Night signal FPV | Three separate image bodies, each with its own motor rig |
| Ukraine Atlas | Atlas bird | Falcon trim | Trim uses the same swallow body with a different wing palette; not a separate falcon illustration |
| 1994 Forever | Tape runner | Vector trail | Shared craft body, alternate thruster palette |
| Navi Network | Spend Sprite | Audit pulse | Shared original helper body; not verified official Coupa Navi art |

**Apply test reward** inserts the selected authored simulated result. Repeating the same fixture cannot count twice. The six fixtures demonstrate wins, distinct-level star totals, map objectives and clean-run criteria. Ownership persists independently of current context, while availability remains context-specific. **Reset test collection** restores starters. These controls demonstrate collection design, not real wins or a live economy.

The browser stores only the lab profile at `xonix.motion-lab.collection.v1`, with `mode: "lab"` and `profileId: "local-design"`. Corrupt/incompatible raw saves are not overwritten on load; before an explicit equip/reward/reset write, the original raw value is copied to a timestamped `.recovery.*` key. If recovery/storage cannot be written, changes remain session-only and the old save is retained. Cosmetic recipe edits, palette settings and background files are not persisted. This is a single-tab authoring preview; concurrent tabs do not merge test profiles. The pure collection module's future `game` mode is only a format distinction, **not trusted result authentication or backend integration**.

## Independent scenes and local backgrounds

Palette, terrain materials, body and animation recipe are independent. **Apply family look** explicitly chooses the selected palette's material family and example context, resolving existing equipment preferences without rewriting them.

| Family | Wall / slow / danger material diagrams |
|---|---|
| FPV Front | Concrete / mud / wire |
| Ukraine Atlas | Stone / reeds / thorns |
| 1994 Forever | Circuit / static / plasma |
| Navi Network | Archive / queue / alerts |

Microtiles repeat at one-cell pitch; props use larger spaced diagrams; hybrid combines quiet texture and props. Every treatment clips to the same authored rectangles. These are frontend-rendered diagrams, not finished production tiles.

**Local background** accepts PNG, JPEG, WebP or GIF up to 25 MiB, using a browser object URL. Contain displays the whole image; Cover crops only its display. Opacity and Clear affect the preview. No original bytes are altered, no file is uploaded or saved by the lab, and no AI call is made. This ephemeral preview is separate from the persistent [media authoring CLI](../media/README.md). Animated source formats are not promoted as controlled animation assets; prefer a still PNG/JPEG for repeatable comparisons.

## Presentation manifest and attachment recipes

[presets.json](presets.json) is a local presentation manifest, separate from [collection-presets.json](collection-presets.json). It is not a content pack, media-library record or save. Same-origin image paths resolve relative to the presentation JSON. Reload after editing JSON or replacing a file.

A character entry references a body and an independently replaceable animation recipe:

```json
{
  "label": "My FPV body",
  "src": "assets/my-fpv.png",
  "sourceStatus": "Reviewed concept; production export pending",
  "widthCells": 1.25,
  "heightCells": 1.25,
  "headingOffsetDegrees": 0,
  "sampling": "nearest",
  "animationRecipe": "fpv-tri",
  "rotors": [
    {"x": -0.31, "y": -0.30, "radiusScale": 1, "direction": 1, "phaseDegrees": 0},
    {"x": 0.31, "y": -0.30, "radiusScale": 1, "direction": -1, "phaseDegrees": 25},
    {"x": -0.31, "y": 0.27, "radiusScale": 1, "direction": -1, "phaseDegrees": 50},
    {"x": 0.31, "y": 0.27, "radiusScale": 1, "direction": 1, "phaseDegrees": 75}
  ]
}
```

This is an entry fragment. Body images fit proportionally within the declared cell dimensions. `nearest` and `linear` sampling are supported; zero heading offset assumes north/up. A missing/null/failed source displays an explicitly labelled neutral marker, with attachments omitted until the image exists. Asynchronous image completion refreshes both canvases even while paused.

Anchors are normalized to the **actual contained source image rectangle**, including transparent padding: `(0,0)` is its center, `(-0.5,-0.5)` its upper-left. Rotor radius is recipe `radius × anchor.radiusScale × displayed image width`. All attachments share the body's scale, heading and bank. Legacy `[x,y,radius]` rotor tuples remain readable, but new object anchors explicitly provide direction and phase. `centerMark` is an optional small two-color overlay for arena readability; it leaves source bytes unchanged.

Each named `animationRecipes` entry has a `label` and up to eight uniquely identified `components`. The renderer currently supports:

| Type | Data and units |
|---|---|
| `rotors` | `bladeCount`: 2/3/4; `bladeShape`: swept/tapered/paddle; `radius`: fraction of body-image width; `bladeWidth`: fraction of radius; `fillColor`, `tipColor`, `hubColor`: hex colors; `direction`: ±1; `phaseDegrees`: degrees; `idleRps`, `travelRps`: requested visual rotations/s at idle and per cruise-speed ratio; `maxVisualRps`: display cap; `blurOpacity`: 0–0.4 |
| `wings` | `anchors`: `[x,y,side]`, side ±1; `span`: fraction of image width; `chord`: fraction of image height; `frequencyHz`; `speedFrequencyGain`: added frequency per cruise ratio; `amplitudeDegrees`; `foldFraction`; `color`, `tipColor` |
| `thruster` | `anchors`: `[x,y]`; `length`: fraction of image height; `width`: fraction of image width; `speedGain`: visual length gain; `flickerHz`; `color`, `innerColor` |
| `pulse` | `anchors`: `[x,y]`; `radius`, `amplitude`: fractions of source dimensions; `frequencyHz`; `opacity`; `color` |
| `blink` | `anchors`: `[x,y]`; `size`: fraction of image width; `frequencyHz`; `dutyCycle`; `color` (small light/eye-highlight animation) |

The live recipe selector and 2/3/4-blade, shape and radius controls are ephemeral per-character presentation overrides. All other parameters are editable in JSON. A rotor recipe selected on a body without motor anchors is reported as unattached, rather than inventing a rig. Effects are designed visual cues, not photoreal flight/biological/engine simulation.

At high requested spin, discrete blade motion is capped and sampled below a quarter of the repeating blade pattern per displayed frame to reduce apparent reversal. A restrained blur disc conveys higher requested activity. Slow inspection caps rotor detail to 0.65 visual rotations/s. Blade shapes stay countable without claiming real RPM; visual phase is intentionally presentation-timed and may slow at low frame rates. Authoritative movement remains time-consistent.

Terrain role entries expose `kind`, optional `microSrc`, optional `propSrc`. Null/missing image layers use diagrams. `terrainStyles` defines texture/prop opacity and prop pitch, validated before rendering so zero pitch cannot freeze a draw loop. Both art placements are clipped to the same role rectangle.

## Image sources and limitations

The ten supplied body PNGs are generated concepts. The existing [FPV body](assets/fpv-body.png) is a byte-identical copy of [round-07-fpv-body.png](../../docs/concepts/round-07-fpv-body.png). Five new originals are in [assets](assets/), with prompt provenance in [round-08-generated-prompts.json](../../docs/concepts/round-08-generated-prompts.json) and [round-08-fpv-correction-prompts.json](../../docs/concepts/round-08-fpv-correction-prompts.json). Those five were visually inspected before binding; motor/wing/nozzle/highlight anchors are approximate manual measurements. Four additional concepts—Scout quad, Heavy lift, Fixed-wing body and Delta interceptor—were inspected and added as FPV-only lab starter cosmetics, with source provenance in [round-09-generated-prompts.json](../../docs/concepts/round-09-generated-prompts.json). The heavy body uses six small rotor anchors; the fixed-wing body uses a separate two-blade pusher cue; the delta body uses an abstract rear glow. None changes ability statistics. Skyline FPV guards and motor hubs are static body art; the overlay supplies separate blades.

These high-resolution transparent concepts are not production atlases, hand-retouched small sprite exports or a complete asset set. Production would still need small-size art review, consistent pixel sampling, attachment refinements and device performance checks. The lab does not generate sprites, remove backgrounds, invoke AI, or overwrite any image original.

## Motion/device invariants and checks

`motion` exposes cruise/boost/slow speeds, response easing, body turn rate and integration step. The default body turn is 540°/s. Its legacy `rotorIdleRps`/`rotorTravelRps` fields remain in the prior motion-state format; current visible rotor response comes from the selected animation recipe. Cosmetic modules never feed a value into movement.

Normal slow frames are consumed in bounded substeps, preserving leftover distance at route corners. Original travel tests compare 10, 20 and 60 fps; grid travel tests cover 10–120 fps, and blade-sampling tests cover 4–120 fps. A true stall beyond 250 ms caps catch-up; hidden tabs pause separately. Resize changes only the canvas transform: board cells, speed, route and terrain stay fixed. Desktop and short landscape fit the full 4:3 arena; short landscape places settings at right. Portrait uses settings below; compact widths wrap telemetry and D-pad controls. The physically small phone avatar remains an explicit design tradeoff exposed by the scale control, not a claim of production accessibility.

```sh
node --check authoring/motion-lab/app.js
node --test authoring/motion-lab/test-motion.mjs authoring/motion-lab/test-grid-motion.mjs authoring/motion-lab/test-animation.mjs authoring/motion-lab/test-collection.mjs authoring/motion-lab/test-ability.mjs
```

**70 tests pass**: 12 original movement/preset invariants, 12 grid policy checks, 9 animation/rig/separation checks, 18 collection cases, and 19 ability checks. Ability checks cover primitive validation, pad pickup/drop, capacities, cooldown, scan/relay/delivery, cardinal dash/return, short-range rejection, fiber dash cost, projectile first-contact ordering/frame-rate consistency, equal-expiry and partial-tick net dwell, pause/deduplication, authoritative reversal-distance accounting, independent link budget/haze and class reset. Grid tests cover immediate compatibility, center alignment, latest-command replacement, reversals, release/restart, pause, skipped crossings, boosts/slowing, all four boundaries, 10–120 fps, autoplay and cosmetic independence. Browser layout, interaction and visual inspection are separately performed by the parent design task; pure tests do not establish visual quality or mobile device performance.
