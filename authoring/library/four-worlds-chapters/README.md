# Four worlds: optional illustrated Pressure Lines

These four optional three-map chapters embed all twelve reviewed source illustrations through the existing `levelVisuals.background` pack contract. They reuse **three Pressure Lines R5 geometries**, presented in four worlds with distinct campaign/map identities and twelve distinct pictures. They do not add twelve new layouts, new enemy logic, completed music tracks or P5 live-media adoption.

The [source catalog](../four-worlds-source/catalog.json), raw originals, prompts and generation-time observations remain unchanged. Every embedded PNG is exactly its original 1774 × 887 file, with `contain` fit. No image was resized, cropped, recolored or reencoded. The illustrations are static; actors, lines, warnings and celebrations remain separate runtime graphics.

| Optional pack                                            | Registered world | Formatted JSON bytes | Compact pack bytes |
| -------------------------------------------------------- | ---------------- | -------------------: | -----------------: |
| [Illustrated Pressure](packs/original-fpv-pressure.json) | `fpv`            |           10,719,959 |         10,711,106 |
| [Woven Lines](packs/original-ukraine-atlas.json)         | `ukraine`        |           12,358,446 |         12,349,593 |
| [After Hours](packs/original-retro-1994.json)            | `retro`          |           10,329,657 |         10,320,804 |
| [Shared Routes](packs/original-spend-network.json)       | `coupa`          |           11,067,202 |         11,058,349 |

The source catalog calls the Atlas artwork family `heritage`; the registered runtime theme ID is **`ukraine`**. The builder maps these explicitly. `coupa` and its existing body IDs are runtime registry names, not newly produced logos, Navi likenesses, endorsements or actual product functionality. The harbor's invented leaf emblems remain in its unchanged original and in the source observations. Ukrainian settings and motifs are imaginative interpretations rather than authenticated historical reconstructions.

The four-pack portable library totals **44,439,900 bytes**, below the unchanged **48 MiB (50,331,648-byte)** installed-library limit. The largest raw image is 3,286,349 bytes, below 4 MiB. Each pack remains below 24 MiB and the existing per-pack encoded-image/pixel bounds. Adding the image-heavy R5 edition to all four exceeds the installed limit and is refused; an explicit removal can make room. No automatic eviction or capacity increase is introduced. Export the existing pack/library before choosing a removal.

## Manual optional installation

These source outputs deliberately live under `authoring/library/four-worlds-chapters/packs/`, outside the normal build include list and active/archive indexes. Without an explicit optional-publication adapter they are absent from the distribution entirely. An explicit `build-config.optionalChapters` registration can add their exact bodies to the complete manifest and ZIP while keeping them out of automatic core offline downloads; only lightweight optional catalog metadata belongs in the core. Source preparation does not mean these chapters are already deployed.

Open a compatible source game (core v5 / pack v5), pause any flight, and use its existing **Library & saves** expansion file picker to import one selected JSON. Review the exact new chapter, then install it. The imported pack contains its three original pictures; no remote image URLs are resolved. Existing import/storage errors keep their current handling and do not grant progression. Removing a pack preserves earned metadata but can make its art unavailable until that exact pack is reinstalled; keep the file externally.

The [private distribution manifest](distribution.json) gives exact byte hashes, campaign keys, map-to-image and reused-geometry mappings. It is authoring evidence, **not an additional runtime index format**. Publication uses a separately validated small optional catalog and an explicit build adapter; it must verify the exact source paths and byte hashes before adding the four pack bodies. Keep those bodies excluded from the core offline inventory even when the complete ZIP contains them. Never copy them into `game/content/packs/` without the corresponding reviewed exclusion: `game/` is recursively included in builds. Core offline limits remain 64 MiB. Browser installation, persistence, separate Install/Choose behavior and offline readiness remain separate integration gates.

## Identity and gameplay

Every pack has a unique ID/version `1.0.0`, its own revision-1 campaign and three unique prefixed map IDs. All original campaign/level/class/replay identities remain intact. Theme/body recipes come from the registered four-world data; only Scout display text is tailored. Its gameplay recipe remains exact. The three existing R5 procedural music recipes and all music references remain unchanged; they are reused scores, not new audio assets.

The level-v4/core-v5 contract remains direction-only Arcade: direction release does not stop a cut; successful closure stops movement and requires a fresh direction; manual Scan, supply and Boost remain disabled. Pressure warnings, locked targets, contact pickups, lanes, terrain, limits, speeds and geometry are unchanged. Goals remain 68%, 74% and 80%. This reskin does not promise new difficulty or improved enjoyment.

## Reproduce and verify

From the repository root with its supported Node version:

```sh
# Read-only exact compilation comparison, including distribution hashes:
node authoring/library/four-worlds-chapters/build.mjs

# Read-only full 48-route and saved-continuation verification:
node scripts/verify-four-worlds.mjs

# Focused pack, transport, capacity, source-exclusion and negative tests:
node --test game/test/four-worlds-chapters.test.mjs
```

The builder pins the source R5 pack, its retained proof, registered themes, twelve-image catalog, every raw PNG and every prompt. It refuses symlink/special/oversized inputs. `--write` is only for an explicitly reviewed, absent designated output set and refuses overwrites. The proof emitter similarly writes only an absent `routes.json`; ordinary verification never updates expectations. Preserve earlier candidates/evidence when making an intentional revision.

The separate [proof](routes.json) records **48 actual wins, 60,592 simulated ticks and 360 command segments**: twelve map identities × Standard/Gentle × Immediate/Grid + buffer. Commands come from the unchanged R5 routes, but each new context is reconstructed, executed and independently replay-verified. Every trace saves during an actual committed-pressure live cut, restores through the public session API, preserves the saved heading, continues to its exact final checkpoint and verifies the reconstructed replay. Full physical outcomes and event counts match the corresponding R5 route; identity, roster and derived Gentle revision fields are recomputed rather than copied. Closing cuts retain explicit one-tick neutral releases before fresh commands. No kernel state is patched to create a win.

The verifier prepares the actual compiled pack, resolves its real scenario/art binding and fully decodes all owned non-interlaced RGB8 PNG scanlines using bounded DEFLATE, chunk CRC and all five filter rules. This is stronger than header inspection and leaves source bytes untouched. It is a restricted Node decoder for this exact batch, not a replacement for browser decoding, color management, Canvas or visual review. Existing-art capacity controls use explicitly identified prior header fixtures separately.

Focused negatives reject foreign or duplicated routes, missing coverage, changed geometry/art, manual-action injection, fabricated checkpoints and saved hashes. Capacity tests check refusal before decoding/adoption and unchanged prior library bytes. The actual build file set proves all four packs and twelve source PNGs remain optional/outside default downloads.

Parent-run browser work must still check import/retry, partial reveal, full reward/gallery replay and small-screen contrast. In particular, the night scene is dark, the market/foliage/reflections are detailed, and the source catalog retains its artistic caveats. No browser, physical-controller, listening, accessibility or human-fun acceptance is inferred from route/hash tests.
