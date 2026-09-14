# Ukraine Atlas role presentations

The current Ukraine appearance set gives each of the seven existing classes a distinct original body and its own wing recipe. This changes presentation only: class abilities, movement, colliders, level identities, replay hashes and campaign rewards retain their existing rules.

| Class       | Current body ID            | Original cohort            |
| ----------- | -------------------------- | -------------------------- |
| Scout       | `atlas-swallow-v3`         | Wide round courier swallow |
| Bomber      | `atlas-pottery-courier-v1` | Pottery courier            |
| Carrier     | `atlas-carved-chest-v1`    | Carved chest               |
| Interceptor | `atlas-falcon-crest-v3`    | Wide cobalt falcon crest   |
| Fiber       | `atlas-weaver-shuttle-v3`  | Wide weaver shuttle        |
| Impact      | `atlas-bell-warden-v1`     | Bell warden                |
| Trapper     | `atlas-woven-basket-v1`    | Woven basket               |

These are fictional Ukrainian folk-inspired craft, not authenticated historical objects. The [first source cohort](../authoring/library/ukraine-role-presentations/README.md) and [wide variants](../authoring/library/ukraine-role-wide-variants/README.md) retain every original, effective prompt and rejected checkerboard attempt. The seven selected PNGs remain byte-identical. The narrow first Scout, Interceptor and Fiber originals remain available in source history but are not shipped by this selection.

## Choose and replace a body

Choose Ukraine and enable **Match class appearance** to follow the current class recommendations. In solo play, selecting a body manually turns matching off; a valid available selection survives class changes, reload and loading its saved flight. Choose `ukrainian-bird` to use the earlier Ukraine body, or another available appearance. These starter cosmetics do not grant medals or unlock a historical reward. Couch uses the same recommendation adapter for its two independent painters; the mode retains its existing shared class selection and profile isolation.

The bounded `characterPresentations` entry in [presets.json](../authoring/motion-lab/presets.json) matches the exact theme ID `ukraine`, family `atlas`, default `ukrainian-bird` and the complete seven-class legacy map. A custom theme or changed class map keeps its authored recommendations. All prior body records, the FPV presentation set and recipes stay intact. Explicit original-image overrides still take precedence. An older reader that does not register a new body ID may show its neutral fallback; the saved ID is not rewritten into an older catalog.

For a replacement, retain the original/provenance and add a new versioned body ID, recipe ID, exact SHA-256 and individual [build allowlist](../game/build-config.json) path. Update only the desired current mapping and starter list. Preserve the outgoing preset bytes through [metadata history](../authoring/production/README.md#preserve-metadata-revisions); never repin a historical production register to the new catalog. The preserved `e857a548…` snapshot is the complete prior 21-body preset, alongside the earlier `edbb5c4e…` snapshot.

## Supported movement presentation

Each selected body is north-facing, square, uses nearest-neighbor sampling and opts into the existing loaded-image compact minimum of 20 CSS pixels. The shared renderer retains its existing sizing on larger viewports and its existing fallback sizing when the image is missing. Originals are never stretched to improve their shape.

Each recipe uses one existing `wings` component, two ordered left/right roots and no rotors. The adapter checks exact fields, finite roots, the existing animation ranges and a conservative full wing envelope inside the body frame. Travel speed drives the existing flap clock; pause and reduced-motion behavior stay shared with the renderer. Wings, colors and roots remain independently editable within those bounds. There are no new atlas frames or ability-state animations. A boost or another class ability still uses its existing game behavior; these seven recipes do not complete fourteen movement/ability treatments or the 56-set target.

## Budget and qualification

The seven selected originals add **5,873,332 bytes**. The frozen v040 core inventory is 52,816,659 bytes; with these files and a 65,536-byte text allowance, the projection is **58,755,527 bytes**, below the existing 64 MiB cap by 8,353,337 bytes. This source projection does not require an optional character bundle. A later exact candidate build must confirm the real inventory and text delta. Entire source-art directories and rejected candidates are excluded from the build allowlist.

Source artwork and the scoped authoring previews have been reviewed, including the wider three-role comparison. The six focused source files pass all 46 cases on Node 20. Node 22 qualification combines 39 initially passed cases with seven cases from the affected FPV unit file after restoring its omitted 13 KB source fixture; the original 39/40 result is retained. No runtime or assertion correction was needed. These checks verify all fourteen FPV/Ukraine original byte identities, recommendations, manual and saved appearances, exact checkpoint restoration, separate Couch painters, wing clocks and historical metadata. The history test received formatting only afterward, with an equal parsed syntax tree.

Actual 20/32-pixel game rendering, gameplay/native review, the separate full-source allowlist fixture and final build/offline qualification remain pending. No production assessment, release number or device approval is added by this source candidate. See [the unit suite](../game/test/ukraine-role-presentation.test.mjs) and [the host suite](../game/test/ukraine-role-host.test.mjs) for the modeled boundaries; they do not establish human visual or device acceptance.
