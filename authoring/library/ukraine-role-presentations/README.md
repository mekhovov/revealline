# Seven Ukraine Atlas role presentations

Seven original bodies and seven independent wing recipes for the existing player classes. These are source candidates; the current game, packs, saved appearances, class abilities and production register are unchanged. The four-theme target is seven player classes in compact and detailed treatments: 56 slots. This cohort is seven originals, not fourteen finished treatments.

| Class       | Candidate body ID        | Distinct body / motion                                          |
| ----------- | ------------------------ | --------------------------------------------------------------- |
| scout       | atlas-swallow-v1         | Forked tail and ivory breast; quick shallow wings               |
| bomber      | atlas-pottery-courier-v1 | Round ceramic belly and one handle; short rounded wings         |
| carrier     | atlas-carved-chest-v1    | Rectangular lid and side bundles; slow broad wings              |
| interceptor | atlas-falcon-crest-v1    | Angular chevron breast and short tail; tight swept wings        |
| fiber       | atlas-weaver-shuttle-v1  | Large exposed bobbin and asymmetric counterweight; narrow wings |
| impact      | atlas-bell-warden-v1     | Broad bronze rim; restrained rounded wings                      |
| trapper     | atlas-woven-basket-v1    | Arch handle and four lattice panels; short shallow wings        |

All seven default imagegen outputs are **1254 × 1254 RGBA PNGs**, despite requesting 1024 × 1024. Their exact bytes total **5,228,557**; each is below the existing 4 MiB image ceiling. Originals, generated alpha and metadata are preserved without crop, stretching, palette conversion, resampling or background removal. The [seven records](presentations.json) link each [original and complete prompt](provenance/scout.json). All seven generated images were individually inspected. The parent reviewer accepted their source-art direction; compact review leaves three roles open as described below. Provenance review statuses retain the original intake observations.

The palette follows the existing Atlas ivory, indigo, turquoise, amber and restrained coral. Shapes and ornament are invented craft-inspired fantasy. Pottery, bell and basket have angled/front-facing forms rather than the requested strict overhead view. Scout, falcon and shuttle are longer and narrower than the intended compact framing; their actual-size widths need particular attention. Basket lattice contains finer diamonds within four large panels. These deviations are retained in each provenance record. No historical reconstruction, authentic regional pattern, official emblem or working craft mechanism is claimed.

## Motion and appearance boundary

The existing [wing renderer](../../motion-lab/render-character.mjs) paints separate procedural wings beneath the original. All bodies omit extended moving wings, so the rig does not double painted wingbeats. Two anchors use the complete original rectangle, including transparent margins. Each recipe owns its own span, chord, base frequency, speed gain, angle and fold. A conservative circle around each pivot bounds the full moving envelope. It is not a collider or an attachment-intersection proof.

The [strict source model](model.mjs) permits only one existing `wings` component and two ordered side attachments. It calls the shared animation validator after exact-field, identity and finite-data checks. No sprite atlas, scan-trigger, payload-release, spool-motion or action-state interface is invented. The preview uses actual existing `playerPaintSize` with the compact 20px preset opt-in and `paintCharacter`; it does not copy or change the sizing formula.

Wingbeats read only an authoring speed sample. Scout/Fiber retain the game's actual scan hints, both carriers its stun-field display, Interceptor its shield ring, Impact its pulse/redeployment feedback and Trapper its slow-field cue when considered for later adoption. None of these abilities is activated or verified in this source preview. Pause holds the phase; reduced motion uses static wings. Different view modes are cosmetic samples, not replay or input-policy tests.

## Inspect and verify

Open [the preview](index.html) through a repository-root static server. It presents 128px inspection, fixed 20px and 32px frames, and 1× CSS output at 294/390/600/1152 arena widths for 72- or 48-column boards, four headings, idle/moving speed, light/dark/checker backgrounds, wing visibility, pivot guides, pause and reduced motion. Role selection resets old animation state; pagehide stops the owned frame loop. Pink guides show the source rectangle/center; green guides show shoulder sockets, not contact radii. Browser zoom and physical-device scale remain separate.

```sh
node authoring/library/ukraine-role-presentations/verify.mjs
node --test authoring/library/ukraine-role-presentations/test.mjs
```

Verification reuses the unchanged [FPV RGBA decoder](../fpv-role-presentations/png.mjs) for every chunk CRC, bounded inflation, all scanlines and alpha bounds. Hollow socket centers may be transparent: the report records their actual alpha and nearest substantial rim pixel within a finite four-percent neighborhood. It never fills a hole or moves source pixels. `--tool-originals` also compares the retained default imagegen outputs; portable verification needs only repository originals. `--record PATH` writes an exclusive new receipt and refuses overwrite.

Full CRC/scanline/alpha verification passed for all seven originals, including exact retained tool-output copies. The six focused source cases passed on Node 22 and Node 20. The first Canvas buffer load failed with “Invalid SVG image”; a single filename-loading retry rendered the unchanged PNGs successfully. No metadata or image bytes were stripped. The code-rendered contact sheet and 448 heading/phase/viewport samples use the shared painter; a fixed static browser preview is available for separate native inspection.

At a fixed 20px frame, the measured north-facing body widths are Scout 8px, Bomber 15px, Carrier 12px, Interceptor 8px, Fiber 8px, Impact 14px and Trapper 14px. These are thresholded painted-pixel measurements, not human readability scores. The parent reviewer found pottery, chest, bell and basket distinct enough for source iteration. **Scout, Interceptor and Fiber remain too similar at 20px, and their wing differences do not resolve the narrow bodies.** Wider, separately preserved variants targeting at least 12px body width are required before considering their runtime adoption. No original is stretched to meet that target.

Source art and contact-sheet review do not establish compact/detailed production, full ability animation, partial-reveal gameplay readability, physical-device approval or release readiness. Native preview qualification remains separate.

## Replace one role

Follow [the prompt contract](PROMPTS.md), preserve the new tool output and make a new versioned candidate when replacing an adopted original. Keep the other six original/recipe/provenance associations exact. Update only that role's source path/hash, natural dimensions and measured shoulder anchors; inspect the full-frame wing envelope and both light/dark tiny output before selecting it. If a narrow body fails tiny-size inspection, request a wider imagegen variant and retain the parent original; never stretch it to manufacture a pass.

Later runtime integration must use the existing declarative `characterPresentations` adapter and exact canonical theme guard. Preserve `ukrainian-bird`, old theme maps, explicit manual/saved body IDs and earned alternatives. Presets, build inclusion, total core-media budget, production history and actual Solo/Couch acceptance require a separate change. This source folder makes no such bindings and grants no unlock or production approval.
