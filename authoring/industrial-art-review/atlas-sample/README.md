# Original actor atlas · produced review sample

This sample exercises the existing Asset Studio and runtime animation contract. It is a produced candidate, not an approved replacement for the released collection. No Broforce, Factorio or other third-party artwork is included.

The source is the project's original `pixelArtForSlot('enemy.bouncer')` drawing. The existing deterministic `encodeSpritePNG` pipeline generates twelve transparent 32×32 poses on a 128×96 atlas: sensor scan, notice, two bracing poses, three tread positions, blocked, two cooling poses and caught. All poses preserve the original alpha silhouette, north-facing nose and centered pivot. The atlas consumes 49,152 decoded bytes; its immutable 32×32 parent adds 4,096 bytes only when separately decoded. This is artwork, not a new tank combat actor.

## Files and ownership

- `industrial-bouncer.rltheme`: complete review collection for the published Studio slot set, with original image bytes, atlas bytes, asset-v2 animation and immutable parent reference. Other slots use the established Field Kit baseline recipes. Unreleased source-registry picture slots are excluded.
- `source.png`: unchanged PNG generated from the shared original drawing.
- `atlas.png`: twelve-frame derivative, transparent surroundings.
- `asset-v2.json`: exact asset revision and animation descriptor.
- `provenance.json`: generator/source hashes, each output's SHA-256 and byte count, and admission scope.

No default compiled theme, saved game, campaign or Company appearance is replaced. The sample uses the existing `.rltheme` transport and does not install executable code. Normal import preserves the previous workspace's immutable revisions, but stages the sample's complete baseline collection. Use a separate sample workspace to preserve your currently selected appearance.

## Studio workflow

1. Download [industrial-bouncer.rltheme](industrial-bouncer.rltheme), then open [Asset Studio](../../asset-studio/).
2. Use a separate workspace, or export/save current edits first. Choose **Import collection** and select the downloaded file. The import validates both PNG hashes and the exact parent dependency before staging the collection.
3. Select the **enemy.bouncer** slot. Open **Actor animation · advanced**, then **Load current actor**.
4. Select `move`, `anticipation`, `recovery` or another clip. Scrub **Presentation time (ms)** and change **Facing**. The same atlas appears at 16/24/32 px and enlarged, on light and dark panels. North is the atlas's source orientation; the renderer rotates the whole pose about the admitted pivot.
5. Use **Check and preview** after editing bounded descriptor data, then **Stage animation revision**. This creates a new immutable asset revision; it does not edit the existing atlas or change AI.
6. Use **Export collection**, then import that exported `.rltheme` into a second review workspace. Re-open the same slot and compare frame count, regions, pivot, clips and retained parent. Both PNGs travel with the collection.
7. Use **Reset to saved** to discard the staged review, or switch back to the previous workspace. A downloaded sample is not an official runtime adoption.

The ordinary Board context previews the moving bouncer. Context prerequisites still apply: this baseline sample does not carry the produced arena photographs required for every specialized Team/Company preview. An unavailable context must remain unavailable rather than substituting a different campaign picture. The advanced atlas panel works independently of those media prerequisites.

## Native clip mapping

The shared Capture/Versus actor sampler reads existing visual projections:

| Authoritative native state              | Clip                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| Pressure patrol / committed movement    | `move` when moving; commitment explicitly uses `move` |
| Pressure warning                        | `anticipation`                                        |
| Pressure cooldown                       | `recovery`                                            |
| Claimed rover dormant / warning         | `idle` / `anticipation`                               |
| Eroder target warning                   | `anticipation`                                        |
| Contour path unavailable (`idle`)       | `blocked`                                             |
| Team hunter warning / commit / recovery | `anticipation` / `move` / `recovery`                  |
| Other actors                            | observed `idle` / `move`                              |

A named clip starts at zero when the native state changes. Pause and native freeze hold its presentation clock; Reduced effects samples the first pose. Existing heading, role, warning and contact markers stay authoritative. Animated atlases suppress the optional static-body tread overlay so two independent tread clocks cannot paint over one another.

`notice` and `caught` remain explicit Studio previews: these generic native actors do not publish those events to this sampler. No `aim` or `fire` is inferred. Hunt soldier rigs retain their existing native-state sampling. FPV SIM keeps its native model/pursuit presentation; importing this 2D atlas does not claim to replace a flight model.

## Reproduction and evidence

Run `node scripts/produce-actor-atlas-sample.mjs` to reproduce, or append `--check` for byte-identical output verification. The generator uses native asset-v2 admission, SHA/header verification, `.rltheme` import, adoption into the exact published Studio workspace and byte-identical re-export. `compiled/studio.json` is a pinned production input: transport validation alone cannot prove that a collection imports into the actual released workspace. Source hashes and output sizes are recorded in `provenance.json`.

Browser decoding, actual Studio import/edit/export, phone-size legibility, native warning/pause observations and artistic approval must be recorded separately. The regression sources in `game/test/actor-atlas-runtime.test.mjs` are authored without running the waived automated suites.
