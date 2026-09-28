# Selectable discovery illustrations

`inspect-image-atlas` revision 1 extends the existing exploration viewer with a single exact image and numbered, selectable points. It is presentation-only: inspecting cards, making predictions, printing, and previewing never creates a Journey clear, learning completion or mastery receipt. The existing `inspect-compare-atlas` revision 1 remains unchanged.

## Authored format

An exploration payload retains its existing bilingual title/intro, 2–8 explanation cards, 0–4 predictions and source list. Its new recipe uses:

```json
{
  "id": "inspect-image-atlas",
  "revision": 1,
  "cards": [],
  "predictions": [],
  "sources": [],
  "diagram": {
    "asset": { "assetId": "approved-illustration", "sha256": "exact-64-hex-digest" },
    "locales": {
      "en": { "alt": "Describe the complete image.", "caption": "State its illustrative limits." },
      "uk": { "alt": "Опишіть ціле зображення.", "caption": "Укажіть межі умовної ілюстрації." }
    },
    "hotspots": [{ "cardId": "existing-card-id", "x": 0.25, "y": 0.5 }]
  }
}
```

This excerpt is structural, not a complete valid fixture: replace the placeholder hash and supply at least two valid explanation cards. There must be 1–8 points, each referencing a different existing card. Coordinates are finite numbers from zero to one, relative to the **entire uncropped image**. They never describe a simulation collider, wiring connection or real aircraft configuration. Card order determines numbering. Authors should keep points sufficiently separated at intended image sizes; geometry and factual accuracy require visual/content review.

The registered validator rejects unknown properties, scripts, extra earning conditions, unsafe URLs, unsupported recipe revisions and invalid points. Existing recipe/document bounds remain in place. Both languages require an image description and caption; each card keeps its own explanation and source note.

## Player and print behaviour

The shared reward viewer loads only the exact asset through the existing selected-edition/retained-revision loader. Points appear after a successful image decode. The full numbered card controls remain available alongside the image, including when exact media is missing. Selecting a point or its corresponding control performs the same existing transient inspect action; at most two cards are compared. Arrow keys and Home/End move within point or card controls. Native buttons support Enter and Space.

The diagram is static in all motion settings. It never adds an animation, delay, timer or gameplay transition. At viewport widths up to 480 px, image points become static numbered markers and the full controls remain below the image, avoiding overlapping small touch targets. The image is scaled proportionally without cropping. These are implementation rules and automated DOM checks, not physical-device validation.

Closing or replacing the viewer aborts its image load, detaches listeners and releases its object URL. A late loader response is disposed immediately. The printable offline document embeds the verified image with static numbered markers, explanation labels and sources; no script is included. Missing images retain useful text.

## Shared Studio workflow

Level/Campaign Studio and Company Studio already mount the shared exploration editor. Load or create an atlas, then use **Selectable illustration** to enter an existing approved asset ID/hash, English/Ukrainian descriptions and captions, and card coordinates. **Stage** changes the JSON draft only. Preview before **Apply**, which uses the existing reward revision/source binding operation. Remove restores the older text/card recipe in the draft. Existing JSON editing and reward-sidecar export/import remain available.

The preview offers an explicit local file picker for each exact image dependency. It checks the file hash and supported static raster bytes, makes temporary object URLs, and disposes them when replaced or closed. Previewing does not register assets, upload a file, mutate the catalogue or earn anything. Register approved assets through the existing inventory workflow before edition validation/export. Selected compiler admission checks hash, rights, local extension, actual raster bytes and the existing 4 MiB image limit; exact dependencies follow existing reward retention, exclusion and source reports.

## Validation and remaining scope

Run:

```sh
node --test game/test/discovery-diagram.test.mjs game/test/discovery-diagram-studio.test.mjs game/test/discovery-exploration.test.mjs
```

The tests cover legacy shape compatibility, bounded coordinates, native point/list equivalence, missing/late media, 20 deterministic disposal cycles, local-file hash and size rejection, Studio draft/apply/export, unchanged gameplay bindings, selected dependency round trips, private exclusion, malformed raster admission and printable fallback. The DOM fixture does not establish visual layout, actual keyboard/touch device quality, browser memory stability or game performance.

The concrete Frame pilot and immutable authored revision capture are admitted separately. Animated motor/propeller explanations and textile lighting comparisons require their own registered recipes and reviewed content; this static illustration recipe does not claim to implement them.
