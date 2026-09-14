# Original Field Kit semantic icons

`game/presentation/icons.mjs` provides original integer-pixel drawings for all 45 currently registered `icon.*`, `hud.*`, `reward.*` and `control.*` slots. These are produced recipe candidates, awaiting review inside their actual components. No reference image, font glyph, generated bitmap or external icon set was copied to make them. The module owns no gameplay, storage or DOM behavior.

Open the [review page](../game/assets/field-kit/icons/review.html) for every native-size and 3× enlarged specimen, dark/light palette comparison, exact semantic description and copyable variation brief. The [contact sheet](../game/assets/field-kit/icons/contact-sheet.png) is a static overview. Neither artifact is a game simulation or approval record.

```js
import { iconForSlot } from '../presentation/icons.mjs';
const image = iconForSlot('icon.download'); // native 24 × 24
// { width, height, rgba: Uint8ClampedArray }
const counter = iconForSlot('hud.life'); // native 16 × 16
const award = iconForSlot('reward.gold'); // native 32 × 32
```

`FIELD_KIT_ICON_VERSION`, `FIELD_KIT_ICON_IDS`, `FIELD_KIT_ICON_SIZES` and `FIELD_KIT_ICON_DESCRIPTIONS` expose the revision, complete inventory, registered native grids and intended meaning. Each call returns a fresh pixel buffer. Unsupported slots, sizes and malformed known color tokens are rejected. An optional `size` of 16, 24 or 32 creates a bounded inspection variant using nearest integer placement; production should use the registered native grid. Colors accept six-digit hex tokens `text`, `ink`, `cyan`, `amber`, `muted`, `hazard` and `success`. Unknown tokens have no effect. Bronze derives a quiet shade from amber and ink instead of using the danger color.

Every native frame has transparent edge clearance, binary alpha, crisp geometry and at most four opaque colors. Dark/light preview palettes demonstrate actual contrast adaptation; the light specimen does not merely place pale artwork on a pale background. Reward medals retain one, two or three dark rank marks as well as bronze/silver/gold color. Menu and keyboard marks use short repeated bars; undo/redo use bent return arrows, distinct from a circular Retry symbol. Audio is a speaker; music is a pair of notes. Load uses a folder, while Download/Upload use a tray and opposing arrows.

Component owners must retain accessible names, visible labels where needed, focus/pressed/selected/disabled/busy/error treatments and actual binding text. Icons are supplementary marks; an icon must never invent controller buttons, signal readings, an ability, an objective or another game mechanic. `hud.signal` and `hud.connection` may only accompany an existing labelled status. Changing an icon never changes input behavior or game geometry.

Before recording review evidence, inspect all 45 native specimens and actual icon-bearing controls at Standard/Large text, keyboard/controller focus, disabled/error states, dark/light surfaces and representative phone widths. Confirm directional arrows, import/export, Save/Load, Undo/Redo, sound/music and award tiers remain distinguishable. Counter glyphs must remain clear beside the actual values, with no reliance on color alone.

The unit tests verify complete catalog coverage and registered grids, binary alpha and palette limits, native edge clearance, unique semantic outputs, direction/undo symmetry, rank marks, malformed input rejection and independent pixel buffers. These checks establish geometry and contract integrity; they do not replace visual context review.
