# Ukraine Versus and Team artwork — 29 September 2026

This bounded Phase 5 batch adds two authored mode arrangements to the Ukraine base world, each in landscape and portrait. Solo's approved river-valley image remains unchanged. Versus has blue/gold birds facing one another on separate posts. Team has the pair together on one continuous railing, linked by a woven strand. These are new paintings within the same dawn village, timber lookout and embroidered folk-art identity, not color or camera variants.

## Source, encoding and admission

All four originals were generated through the built-in OpenAI `image_gen` tool and visually inspected. The existing Ukraine Solo artwork provided the world reference. Each new landscape and the original Solo then provided references for its independently composed portrait. Full prompts, reference roles and source/reference SHA-256 hashes are retained in `authoring/library/menu-scenes/ukraine-mode-prompts.json`. The PNG originals remain unmodified; preparation applies no cropping, resizing or retouching.

| Composition      | Original PNG under `authoring/library/menu-scenes/` | Runtime WebP under `game/ui/art/menu-scenes/` | Dimensions | Bytes     | Encoding                       |
| ---------------- | --------------------------------------------------- | --------------------------------------------- | ---------- | --------- | ------------------------------ |
| Versus landscape | `ukraine-versus-v1.png`                             | `ukraine-versus.webp`                         | 1536×1024  | 1,887,892 | Lossless, effort 100, method 6 |
| Versus portrait  | `ukraine-versus-portrait-v1.png`                    | `ukraine-versus-portrait.webp`                | 941×1672   | 579,008   | Quality 94, method 6           |
| Team landscape   | `ukraine-team-v1.png`                               | `ukraine-team.webp`                           | 1536×1024  | 1,848,324 | Lossless, effort 100, method 6 |
| Team portrait    | `ukraine-team-portrait-v1.png`                      | `ukraine-team-portrait.webp`                  | 940×1672   | 546,480   | Quality 94, method 6           |

Pillow 12.1.1/libwebp decoded both lossless derivatives to RGBA identical to their sources. Exhaustive lossless encoding still produced 2,206,962 and 2,154,012 bytes for the portraits; the established quality-94 fallback therefore remains appropriate. Portrait checks verify decoding, dimensions and exact admitted bytes, not pixel equality. All four delivered outputs were visually reviewed by the parent thread.

The largest active image plus the shared 147,343-byte receiver atlas totals **2,035,235 bytes**, leaving 61,917 bytes below the 2 MiB limit. The preparation script and scene regression both enforce the combined budget. One orientation is active at a time. Existing images, original source hashes and production theme receipts are unchanged. The scene provenance and runtime asset/source ledgers admit each new derivative explicitly.

## Behavior and checks

The catalog remains at 18 theme identities. Its nested Ukraine mode map uses the existing mode resolver and renderer. Portraits use their own measured source-coordinate regions rather than inheriting landscape coordinates. Clouds, actual hanging lamps, river patches and shelter leaves move; bird bodies, woven strands and posts are not independently rigged. Reduced motion and animation-off retain the selected still composition. Gameplay/hidden/dialog pause, focus preservation, one active image/renderer and disposal behavior are unchanged.

The focused scene, renderer, receiver and edition suite passed **62/62 tests**. The geometry regression covers 17 animated base profiles plus four FPV/Ukraine mode profiles at six viewports (**126 combinations**). Checks bind all originals, prompts and references to their hashes, verify both orientations and safe mode fallback, enforce the combined download budget, and exclude all eight mode images from every one of the 14 Solo-only company edition projections. Source admission verified 179 runtime assets. Scoped ESLint, formatting and whitespace checks passed.

An independent read-only closure check enumerated 1,713 files through the actual default `collectBuildFiles`, with no `game/test` fixtures included. `selectOfflineCore` retained all four Ukraine images in Solo, Versus and Team entry closures. All 14 standalone resource projections and projected scene catalogs excluded them. The exact four image sizes matched the table. That selector check used original text content but omitted binary payload contents, so it establishes dependency inclusion rather than a full offline package byte-budget pass. The separate 14-edition package gate remains owned by the release verification batch.

## Browser verification

The fixture `game/test/manual/portrait-motion-check.html?suite=ukraine` uses the production scene host and WebGL renderer at 1280×800 and 390×844. It compares two actual framebuffer draws approximately two seconds apart inside visible fully weighted source regions. CSS entrance transforms, receiver noise and the menu shade are outside that buffer and cannot create false-positive pixel differences. It also checks that gameplay-inactive and reduced-motion contexts stop drawing.

Each case now samples 120 browser `requestAnimationFrame` callback intervals while the production animation is active and reports median, p95 and maximum. These are browser callback timings, not GPU render timings or physical-mobile qualification. This instrument is test-only, has an eight-second timeout, and cancels its frame callback on page exit.

The parent thread ran the final fixture in the in-app browser on the source server at port 8983: **4/4 passed**, with all four measured regions changing in every composition. Both pause and reduced-motion assertions were true in every case. The following values are transcribed from the observed DOM report; no raw framebuffer file is claimed.

| Composition      | Viewport | WebGL canvas | Frame-pair interval | Changed cloud / lamp / water / foliage pixels | Callback median / p95 / max |
| ---------------- | -------- | ------------ | ------------------- | --------------------------------------------- | --------------------------- |
| Versus landscape | 1280×800 | 1469×979     | 2,118.0 ms          | 31,603 / 3,417 / 1,856 / 7,362                | 8.3 / 9.0 / 9.3 ms          |
| Versus portrait  | 390×844  | 900×1599     | 2,110.8 ms          | 12,151 / 1,248 / 2,047 / 3,401                | 8.3 / 8.9 / 9.3 ms          |
| Team landscape   | 1280×800 | 1469×979     | 2,114.9 ms          | 25,936 / 1,686 / 3,101 / 7,378                | 8.3 / 9.1 / 9.4 ms          |
| Team portrait    | 390×844  | 899×1600     | 2,119.2 ms          | 12,760 / 2,441 / 1,480 / 5,739                | 8.3 / 8.9 / 9.3 ms          |

Each row contains 120 callback intervals. The artwork renderer retains its existing 30 fps drawing cap; the faster browser callback cadence is not the number of artwork draws and does not measure GPU cost.

Verified source SHA-256 values:

- `game/ui/menu-scene-catalog.mjs`: `7546b40ce0cdec1b84f6861446c5bd2315bd45c0d92741c5511969f75c364734`
- `game/ui/menu-scenes.mjs`: `d288b3b0450848f89ce482cc7d94dbfc68038c7116d9e182d61184c9175956c1`
- `game/ui/menu-scene-motion.mjs`: `9cd29d1cfd8fdf8702218ccbd7ecd92e0c9b1319454488540ae1936ed6883c2a`
- `game/test/manual/portrait-motion-check.mjs`: `26933ea987e0b3000b51fc2be57a88db090cf3ef798392ca0814f1050081bb69`

The parent thread also checked the actual Versus host at `/game/couch/?journey=legacy`, selecting the First Signal tactical map and the Ukraine Atlas world before returning to the landing. At 1280×720, a screenshot showed both opposing birds clearly, with the complete logo, modes, four actions, fullscreen control and footer fitting the viewport. The scene reported `renderer=webgl`, `composition=ukraine-versus`, `loaded=true`, `motion=on` and `running=true`, using the 1536×1024 `ukraine-versus.webp`. Resizing to 390×844 selected the 941×1672 `ukraine-versus-portrait.webp`; all controls and footer still fit without split labels. The foreground birds sit partially behind the quiet action scrim in this narrow composition. No gameplay was started. Team received the production-renderer fixture checks above, not a separate actual-host visual check in this batch.

No phone GPU/memory, physical-controller, long-session comfort or published-release claim is made by this batch. Retro and Coupa Versus/Team are the next separate artwork batches.
