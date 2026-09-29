# Retro Versus and Team artwork — 29 September 2026

This Phase 5 batch adds independently authored landscape and portrait compositions for 1994 Forever's Versus and Team modes. The approved Solo street remains unchanged. Both modes retain its rainy arcade, navy brick, warm cabinets, cyan/magenta light and the original ivory/orange `retro-craft` actor. Versus turns two craft inward on separate cyan/magenta platforms; Team aligns the pair on one shared dock with a connecting blue cable. Neither arrangement is a tint, zoom or floating-symbol substitute.

## Originals and encoding

All selected originals were generated through the built-in OpenAI `image_gen` tool and visually inspected. The existing Retro Solo scene and original `retro-craft` PNG supplied the first references. The Versus landscape needed one targeted built-in edit because the initial craft pointed forward; the selected result faces them inward. Complete initial/correction prompts and the discarded intermediate's SHA-256 are recorded in `authoring/library/menu-scenes/retro-mode-prompts.json`. Only the four selected originals were copied into the project. Each portrait was independently generated using its selected landscape and the Solo world as references.

| Composition      | Original under `authoring/library/menu-scenes/` | Runtime under `game/ui/art/menu-scenes/` | Dimensions | Bytes     | Encoding                       |
| ---------------- | ----------------------------------------------- | ---------------------------------------- | ---------- | --------- | ------------------------------ |
| Versus landscape | `retro-versus-v1.png`                           | `retro-versus.webp`                      | 1536×1024  | 1,929,216 | Lossless, effort 100, method 6 |
| Versus portrait  | `retro-versus-portrait-v1.png`                  | `retro-versus-portrait.webp`             | 941×1672   | 580,790   | Quality 94, method 6           |
| Team landscape   | `retro-team-v1.png`                             | `retro-team.webp`                        | 1536×1024  | 1,937,786 | Lossless, effort 100, method 6 |
| Team portrait    | `retro-team-portrait-v1.png`                    | `retro-team-portrait.webp`               | 941×1672   | 545,932   | Quality 94, method 6           |

Pillow 12.1.1/libwebp preserves all dimensions and applies no crop, resize or retouch. Both landscape derivatives passed decoded RGBA equality. The more detailed portraits use the existing quality-94 fallback; their verification establishes decoding, unchanged dimensions, visual quality and exact admitted bytes, not pixel equality. The largest active image plus the 147,343-byte atlas is **2,085,129 bytes**, leaving 12,023 bytes below 2 MiB. Only one orientation is active at a time.

The existing preparation script now reproduces Retro and Coupa mode assets without rewriting other selected scenes. Scene provenance binds runtime/source hashes and encoding methods, and the shared public asset/source ledgers explicitly admit the eight combined additions. Coupa originals and their detailed generation evidence belong to the [parallel Coupa batch](coupa-mode-scenes-2026-09-29.md).

## Integration and checks

All four base worlds now have nested Versus/Team profiles while the catalog stays at 18 identities. Retro's landscape and portrait motion regions are separately mapped to pavement reflections, actual lamps/neon and plant leaves. Craft silhouettes, docks and cables remain static; this is localized motion of the painting, not rigged spacecraft flight. Existing reduced/static, visibility/gameplay/dialog pause, fallback, single-owner and focus-preservation behavior remains shared.

Focused scene/renderer/receiver/edition checks: **69/69 passed**. They include all 18 base profiles and eight authored mode profiles, six-viewport crop geometry for 25 animated profiles (**150 combinations**), original/prompt/reference hashes, both orientations, the image-plus-atlas budget and all 14 Solo-only edition projections. One older test's assumption that Retro modes shared a bitmap was moved to an actual Solo-only edition, retaining its no-reload/focus/renderer assertions. The default dependency closure includes all 16 mode rasters; each company projection excludes them. Source admission verified 187 runtime assets. Scoped ESLint, formatting and whitespace checks passed.

An independent actual in-memory compilation then passed for all 14 editions against the frozen Retro/Coupa source. Its 835 captured inputs remained stable and the 574-file engine set agreed. Every edition excluded multiplayer scene images. The largest final offline core was DroneAid at 66,781,145 bytes, with 327,719 bytes below the 64 MiB cap. This validates compiled dependency closure and byte budgets without materializing large packages; it is not an installed-app or published-release check. The parent thread retains the complete matrix in its packaging evidence.

## Browser evidence

The parent thread ran `game/test/manual/portrait-motion-check.html?suite=retro` in the in-app browser against source port 8985. The final fixture passed **4/4**, selected the correct source for every composition, and found changes in all four measured regions. Both inactive-gameplay and reduced-motion checks stopped rendering in all four cases. All four selected source images also passed the parent's visual identity/composition review.

These values are transcribed from the observed fixture DOM report, not a saved raw framebuffer capture. Pixel pairs come from the production WebGL output approximately two seconds apart, inside the fully weighted regions visible through the final crop. The CSS entrance, menu shade and receiver noise are outside this buffer and cannot account for those changes.

| Composition      | Viewport | Changed water / lamp / neon or second lamp / foliage pixels | Browser callback median / p95 / max |
| ---------------- | -------- | ----------------------------------------------------------- | ----------------------------------- |
| Versus landscape | 1280×800 | 8,047 / 1,804 / 2,682 / 4,168                               | 8.3 / 9.2 / 9.3 ms                  |
| Versus portrait  | 390×844  | 12,362 / 1,444 / 1,536 / 6,728                              | 8.3 / 9.0 / 9.4 ms                  |
| Team landscape   | 1280×800 | 9,521 / 1,803 / 2,766 / 4,347                               | 8.3 / 9.2 / 9.3 ms                  |
| Team portrait    | 390×844  | 13,996 / 1,234 / 1,535 / 4,724                              | 8.3 / 9.0 / 9.3 ms                  |

Each row has 120 `requestAnimationFrame` callback intervals measured while artwork motion is active. The renderer still caps drawing at 30 fps. These callback timings are neither GPU costs nor mobile-device performance qualification.

Verified source SHA-256 values:

- `game/ui/menu-scene-catalog.mjs`: `f9d72a2795a8ece95b9c126b49afce1884f82713745e622f875b80b12bd2fec7`
- `game/ui/menu-scenes.mjs`: `d288b3b0450848f89ce482cc7d94dbfc68038c7116d9e182d61184c9175956c1`
- `game/ui/menu-scene-motion.mjs`: `9cd29d1cfd8fdf8702218ccbd7ecd92e0c9b1319454488540ae1936ed6883c2a`
- `game/test/manual/portrait-motion-check.mjs`: `7fcee584ce8a2d3a0ee32616bf8494674eae8f9e9a1f859f08ec3f4f46a935b1`

The parent also checked the actual Versus host at `/game/couch/?journey=legacy`: choose the First Signal tactical map, wait for its asynchronous selection to settle, then choose Retro. At 1280×720, both opposing craft were visible beside the quiet menu. At 390×844, the craft remained visible partly beneath the action scrim. The full title, mode choices, four actions, fullscreen control and footer fit both viewports without split labels. The host selected the correct 1536×1024 landscape or 941×1672 portrait and reported `composition=retro-versus`, `loaded=true`, `motion=on`, `renderer=webgl` and `running=true`. No gameplay was started. Team received the production-renderer fixture checks above, not a separate actual-host visual inspection in this batch.

A transient loading observation is retained separately: an initial attempt selected Done before the world load had settled, displayed “Retry picture” and retained the previous artwork. Reselecting Retro after the map/world selection settled produced the correct completed-state results above; this was not a persistent artwork failure.

This batch does not claim physical-controller testing, phone GPU/memory qualification, long-session comfort or a published release.
