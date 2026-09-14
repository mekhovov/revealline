# Current FPV role presentations

This source candidate adds seven independently replaceable body images and three-blade rotor rigs to the existing character registry. Solo and Couch use one declarative current-presentation adapter. It changes cosmetic recommendations and drawing size only: no class recipe, movement, ability, collider, geometry, score, saved flight or earned reward format changes. Native gameplay and public delivery remain pending for this candidate.

| Class key     | Current body ID        | Original          |
| ------------- | ---------------------- | ----------------- |
| `scout`       | `fpv-scout-v1`         | `scout.png`       |
| `bomber`      | `fpv-light-carrier-v1` | `bomber.png`      |
| `carrier`     | `fpv-heavy-carrier-v1` | `carrier.png`     |
| `interceptor` | `fpv-interceptor-v1`   | `interceptor.png` |
| `fiber`       | `fpv-fiber-relay-v1`   | `fiber.png`       |
| `impact`      | `fpv-impact-v1`        | `impact.png`      |
| `trapper`     | `fpv-trapper-v1`       | `trapper.png`     |

The unchanged [source manifest](../authoring/library/fpv-role-presentations/presentations.json) owns the full originals and rig provenance. The new `characterPresentations` section in [presets.json](../authoring/motion-lab/presets.json) owns current recommendation data, starter availability and the exact original-map guard. The [adapter](../game/character-presentations.mjs) accepts bounded plain data, registered original/new IDs and supported three-blade rigs. It has no gameplay, storage or image-loading side effects.

## Selection and compatibility

With Match class appearance enabled, the current set applies only to theme ID/family `fpv`, original player `fpv-body`, and the complete unchanged seven-class map. A custom pack that changes any of those values keeps its authored recommendations. An exact copy of the canonical map intentionally receives the current presentation. Raw themes and immutable pack/proof identities stay unchanged.

Manual appearance selection disables matching and preserves the selected registered ID. Old starters and earned appearances remain selectable under the same existing unlock checks. The seven new bodies are current starter cosmetics; they do not appear as newly earned progress rewards. Preferences and suspended flights retain their existing stable body IDs. Existing neutral/missing-art guidance remains the fallback for unknown or unavailable bodies. Explicit pack/practice player-image overrides still reach the painter unchanged.

This also fixes authored briefing preparation resetting a valid manual appearance when changing class or reopening the title. With matching off, preparation now keeps a registered body that is available in the current campaign (or the existing practice preview). Matching still applies the current recommendation. Locked choices keep the existing default; unknown IDs use the neutral fallback without rewriting stored preferences. Explicit Load restores the saved body and paused checkpoint. No replay, class recipe, progress or profile format changes are involved.

Solo practice shares this host adapter and keeps its existing preview-only availability and no-awards rules. Couch uses the same recommendation and starter adapter without opening or writing solo progress for cosmetic availability. Theater does not gain a new recommendation policy; its explicit body IDs continue through the shared registered renderer. This work does not expand practice, Theater or Couch mechanics.

Old readers do not contain these seven new PNG/preset IDs. Importing an otherwise readable new manual appearance into such a reader can display that reader’s existing unknown-body/default fallback. No migration or transparent old-reader appearance guarantee is claimed. Saved pictures and campaign authority are separate from this cosmetic choice.

## Drawing and byte budget

Each original is an unchanged 1254×1254 RGBA PNG, despite the requested 1024×1024 canvas. The seven files total **5,772,788 bytes**, each below 4 MiB. They use complete-image containment, source-relative hubs and the existing procedural rotor clock. The source manifest remains a historical authoring record; the runtime preset records own the new separate presentation binding.

Only the seven registered loaded bodies opt into a **20 CSS-pixel image rectangle below 480-pixel arena width**. This lifts the old logical cap only enough to honor that minimum. Old bodies and missing-image fallback sizes retain their original formula; desktop sizes remain unchanged. The rectangle is not a collider and is not a promise that every visible silhouette occupies exactly 20 pixels. The earlier north-facing sample improved major body spans to 15–18 pixels; Impact remained narrower. Four headings, bright/dark artwork, pause/reduced motion, contact cues and physical-phone readability still require integrated review.

The frozen v038 core measured 46,986,097 bytes. Adding these originals and the known intervening source delta projects 52,774,766 bytes before this small adapter/preset change; allowing another 1 MiB still leaves 13,285,522 bytes below the unchanged 64 MiB cap. An optional bundle is unnecessary for this seven-body set on that projection. The actual integrated build/core inventory is a later gate, not a result established by this calculation. Only the seven original PNG paths enter the explicit build allowlist; the authoring verifier, provenance and galleries do not become core payload.

## Replace or inspect one role

Use [the source preview and replacement guide](../authoring/library/fpv-role-presentations/README.md) and [prompt contract](../authoring/library/fpv-role-presentations/PROMPTS.md). Preserve original bytes and provenance; generate a new versioned candidate instead of overwriting a shipped identity. Add its body and supported rotor recipe to presets, update one class entry and the matching starter list in the current set, and add its exact original path to the build allowlist. Keep the legacy map guard and other six roles unchanged.

Verify registration, supported rig fields, alpha/dimensions and actual-size painting; then check matching, manual original/new selection, custom-map fallback, missing-image guidance and saved preference/flight identity. Compare identical simulation checkpoints when changing only appearance. Source/model results, integrated native observations and physical-device/human quality remain separate. This supplies seven FPV presentations, not 56 finished theme/role sets or production-register approval.
