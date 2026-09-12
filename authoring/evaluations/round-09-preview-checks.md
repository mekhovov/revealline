# Round 09 — ability and visual preview checks

Executed 12 September 2026 against the local [motion/ability lab](../motion-lab/README.md), [reference atlas](../../docs/concepts/round-09-reference-atlas.html), and existing [viewport fixture](../../docs/concepts/round-07-device-preview.html). The tested implementation is an isolated study; territory capture, real opponents, lives, scoring and production progression remain planned.

## Automated behavior checks

`node --test --test-reporter=dot authoring/motion-lab/test-*.mjs` passed **70/70 tests** after the ability review fixes: 12 original movement, 12 grid-policy, 9 animation/rig, 18 collection and 19 ability cases. `node --check authoring/motion-lab/app.js` also passed after the final wording correction.

Independent review found and corrected six useful defects before completion:

- Dash distance now consumes the fictional fiber budget.
- Short grid dashes cannot round backward; an unreachable forward center rejects without spending a charge.
- Fiber uses cumulative authoritative travel, including both segments of a within-frame reversal, instead of only endpoint displacement.
- Nets can complete a capture exactly at their expiry boundary, including partial final ticks.
- Projectiles resolve the first swept contact rather than sorting by target-center distance.
- Supply and synthetic-haze labels use the selected theme vocabulary.

The reviewer rechecked the fixes, including movement frame partitions, net timing boundaries, projectile ordering and strike/reset distance continuity under both policies. The [authoring evaluation](round-09-authoring-checks.md) separately records 15 independent workflow scenarios, all 124 prompt renders and validation/installation of nine skills. No unrelated pack/media regression run was repeated in this round; those tools were unchanged.

## Browser interactions actually exercised

Used the in-app browser with the running project server on port 8767. Interaction tests used a separate `127.0.0.1` origin so their test collection did not overwrite the user's `localhost` profile. The viewport fixture embeds the existing localhost lab but does not apply collection rewards or equipment writes. Browser actions went through visible controls and readouts.

| Flow | Observed result |
|---|---|
| Class/link discovery | Ten class options and independent Radio/Fiber choices loaded |
| Empty light bomber | Action rejected with an empty-charge message |
| Supply pickup / drop | Pickup filled 1/1; drop spent the charge and began cooldown. This browser drop was a miss at the pad; target filtering/hits are covered separately |
| Heavy capacity | Pickup filled 2/2 |
| Scan keyboard action | E revealed one nearby note and began the displayed cooldown |
| Pause | An action while paused was rejected with a Play instruction |
| Fiber selection and supply | Class/body stayed separate; 36/36 budget and refill availability were shown at the pad |
| Immediate strike | Picked up a charge, established rightward travel through the autoplay control, then acted: a ground toy was tagged, one marker updated, the player returned to start and the charge was consumed |
| Grid strike with fiber | The same flow landed/returned at policy-valid coordinates, cleared the buffer, updated one marker and showed 30.0/36 budget after the six-unit outbound dash |
| Preferred appearance | Explicitly applied heavy, scout, fixed-wing and delta bodies through the class appearance button; class, link and turn policy remained independently selected |
| Cross-theme vocabulary | Navi palette/family look showed Insight scout, Parcel/Batch/Express courier, Workflow filter and other business labels; Fiber became Budgeted link. The existing original Spend Sprite body loaded |
| Final refresh | Updated study scope, cosmetic wording and links to the reference atlas and both preset files loaded without a visible load error |

The complete effect matrix was tested in the pure evaluator; this browser review does **not** claim successful live aiming/capture of every net, projectile, delivery or relay case. Existing physical gamepad, native iPhone input, production save migration and full territory rules were not tested or introduced here. Local background-file handling was unchanged and was not re-exercised through a file chooser in this round.

## Applied bodies and attachment inspection

All four new PNGs loaded at their expected actual dimensions. The enlarged inspection showed the heavy six-rotor rig with three blades per rotor, scout four-rotor rig, fixed-wing two-blade pusher recipe and delta rear-effect recipe. The same body/recipe is bound to the small arena character. Slow inspection was toggled during review. Motor count and blade count are separate parameters.

The source concepts, alpha counts, generation prompts and hashes are recorded in [the art review](../../docs/concepts/round-09-review.md) and [provenance JSON](../../docs/concepts/round-09-generated-prompts.json). These are original category-inspired bodies, not verified replicas of named aircraft. High-resolution concepts, approximate attachment alignment and tiny on-board silhouettes still need production pixel cleanup and device readability review.

The additional twelve-role world sheet loaded in the atlas and its disclosure expanded correctly. It is a static three-quarter reference composition, not twelve separately exported/animated/implemented actors.

## Screen-size fixture results

The fixture embedded the actual updated lab at each CSS viewport. Its own measured DOM readout reported the following; these are layout measurements, not physical device emulation or performance benchmarks.

| Viewport | Arena CSS pixels | Body slot | Whole arena visible | Horizontal overflow |
|---|---:|---:|---|---|
| 390 × 844 | 360.0 × 270.0 | 9 px | Yes | None |
| 844 × 390 | 367.3 × 275.5 | 10 px | Yes | None |
| 1024 × 768 | 695.3 × 521.5 | 18 px | Yes | None |
| 1280 × 720 | 620.0 × 465.0 | 16 px | Yes | None |
| 320 × 640 | 290.0 × 217.5 | 8 px | Yes | None |

The slot is 1.25 logical cells; transparent image padding means the visible body can be smaller. Settings and action controls may require scrolling, especially in phone landscape. A future playable layout needs separate thumb-reach and uninterrupted action-control testing.

## Reference atlas

- Both catalogs loaded: **67 cards**, comprising 33 drone references and 34 ground/support/personnel references. These include named platforms, families, a linked modification and role categories; they are not 67 implemented units.
- Search for `fiber` returned three relevant records. Family filtering for `military-personnel` returned seven roles, including infantry/patrol and drone operator. Restoring All families returned all 67.
- Four body images and the world reference sheet loaded; no horizontal overflow occurred at the reviewed full browser viewport.
- Review caught ambiguous “source-backed visible traits” wording. It now distinguishes sourced names/public purpose from proposed silhouettes, and exposes visual-evidence limits, available maker/airframe/field-use context and source evidence mode/type.
- Small atlas layouts are styled responsively but were not separately measured in this round's five-size lab fixture.

## Production boundary

Classes, equipment and cosmetic choices are independently configurable within their current registries. New behavior types require explicit implementations and validation; arbitrary strings cannot add a new mechanic. Runtime toy state is ephemeral, while existing cosmetic test ownership remains separate. Real class unlocks, enemy AI, territory integration, finished sprite/audio packs and campaign balance follow the [Round 09 integration plan](../../docs/round-09-classes-and-world.md).
