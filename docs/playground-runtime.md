# Edit and test current runtime content

The existing [playground](../game/playground/index.html) now loads complete runtime expansions while keeping the same practice preview and six viewport fixtures. It is an authoring working copy; it does not silently install a pack into the main game's player library.

## Load, select and preserve

Use **Import content** or paste into **Complete pack JSON**. The supported inputs are:

- `xonix-playground.v1`: one scenario, including class recipes, role images and optional procedural music.
- `xonix-level.v1`: replace the current map while retaining the current theme, images, classes and music.
- `xonix-pack.v1`: validate and decode an expansion, add it to the prepared authoring catalog, and select its first campaign.
- `xonix-pack-library.v1`: validate and decode the complete catalog, including its dependency pins, before replacing the loaded authoring catalog.

The **Load night shift** and **Load living threads** buttons use shipped example files through that same workflow. **Campaign source** selects a loaded campaign; **Start from** selects a map. Map selection carries its defined theme, filtered class roster, procedural track and per-map visual bindings. The edited map remains a working copy: selecting another source loads that source's saved definition. **Undo** restores the previous working copy, source selector and prepared expansion catalog together.

Imported data is bounded before copying. Image headers and aggregate budgets are checked before sequential full decoding; a failure does not partially adopt the pack. Editing during an asynchronous import makes the older import stale instead of overwriting the new edit. The undo list is bounded by both entry count and serialized content size, retaining at least the immediately previous state even if it alone exceeds the aggregate history target. It is not a persistent version-control system.

**Export scenario** saves the current practice configuration. **Export map as expansion** creates a new self-contained, installable one-map expansion containing the edited map, current theme, registered classes, image bindings and exact procedural track. This does not rewrite the original multi-map pack. **Export loaded library** preserves the original imported campaigns; current unsaved map edits belong to the separate scenario/map expansion export. Use the main game Library to install an exported expansion and record progression there.

## Edit current mechanics

The signal-zone brush paints an interior rectangle with configurable width, height and speed percentage. Edge rectangles clip to the remaining interior. It initially blocks boost and abilities for susceptible classes; edit `disableBoost` and `lockAbility` in Level JSON for other supported combinations. Dashed purple rectangles visualize its location and speed setting in the editor.

The hangar brush adds an equipment-change station. A placed interior hangar becomes usable when that ground is safe. Adding a hangar preserves the implicit home station when the source omitted `hangars`. Erasing the home station makes the array explicitly empty when no others remain, which intentionally disables class switching for that map.

**Paint by coordinates** makes all brushes available without pointing at the canvas. Column and row are zero-based cell indices; actor centers use the corresponding half-cell coordinates. Erase removes a whole wall rectangle or signal rectangle under the cell, and point actors/hangars occupying that cell. Rejected overlaps, invalid positions and out-of-range signal parameters leave the previous level unchanged.

**Challenge budgets** exposes mission time, maximum cut time, maximum live trail cells and equipment-switch cooldown. Zero disables the first three restrictions. The advanced level JSON retains the full `signalZones`, `hangars`, rule objects and unrelated valid authored fields during ordinary painting. JSON names still cannot implement an unsupported core primitive.

## Three direct interaction comparisons

| Preset | What to try | Expected runtime behavior |
| --- | --- | --- |
| Fiber relay | Fly down through the signal band; compare with Scout using the same map. | Fiber keeps its speed, boost and scan capability. Scout is slowed and blocked by the field. Both retain a vulnerable live trail. |
| Bomber supply | Pick up at home, move down about one cell, then use Ability. | One carried charge becomes a short stun field near the waiting enemy. An empty carrier has no charge to spend. |
| Impact pulse | Move down about one cell, then use Ability. | A nearby enemy is stunned, the unfinished cut is cancelled, and the craft redeploys without losing a life. The pulse itself captures no territory. |

These presets retain the current theme and original image bindings, load the registered built-in roster and start a practice preview. Every preset is structurally valid under both steering policies. Tests also exercise actual signal resistance, pickup/stun and pulse/redeployment through normal fixed-step input. They are interaction comparisons rather than real-world aircraft simulations or automatic difficulty recommendations.

## Exact procedural audio and visual fitting

A scenario can include optional `music` using the same six-field descriptor as expansions: `id`, `name`, `genre`, `tempo`, `root` and `scale`. The advanced music JSON field edits that descriptor; clearing it restores game audio defaults. Complete scenario imports and asset/theme edits preserve the optional field. Packs resolve a level's music choice before a campaign choice, then their first track. The descriptor is carried into the practice preview and one-map expansion export. Playback still follows the game's explicit sound setting; authoring never starts sound outside a user gesture.

The existing six size buttons remain 390×844, 844×390, 1024×768, 1280×720, 1065×912 and 320×640. Their DOM-based arena/control readouts measure actual iframe layout. They do not emulate physical touch, a controller, Safari audio policies or hardware performance. **Couch race** opens the separate local two-player game; it is not an alternate rules mode hidden inside the one-player scenario preview. Its **Focus boards** mode hides setup and secondary controls to fit both boards and input sets, with 44 CSS-pixel control targets. The release-candidate check exercised that couch layout at the same six CSS sizes, including 320×640. Those are same-browser layout fixtures, not physical-device tests.

## Verification

Pure authoring logic is in `game/playground/model.mjs`; DOM, async stale-job protection, source selection and bounded undo remain in `playground.mjs`. Run:

```sh
node --test game/test/playground-model.test.mjs game/test/content.test.mjs game/test/imports.test.mjs game/test/packs.test.mjs
```

Tests cover all four import formats, per-map asset/music/roster selection, failure atomicity, mutation during decode, signal/hangar edits, original-field preservation, both steering policies, actual class behavior and an edited scenario becoming an installable expansion. Browser interaction and viewport evidence belong to the release verification record; unit results are not a substitute for those checks.

For animated inspection of recorded gameplay, open [Replay Theater](replay-theater.md). Its four Fieldcraft examples, verified file/JSON import, pause/restart, single-tick step and 0.5×/1×/2× rates are separate from the playground's verification readout. Neither route grants campaign rewards; an unfinished player save resumes through the main game.
