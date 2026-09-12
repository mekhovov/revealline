---
name: xonix-expansion-author
description: Create, revise, validate and install playable Reveal Line expansion packs or recover portable player libraries through the actual runtime contracts. Use for campaigns, configurable classes, per-map artwork and procedural music; separate concept catalogs do not constitute installed packs.
---

# Xonix Expansion Author

Read [library-and-packs.md](../../../docs/library-and-packs.md) for the current file shapes, limits, APIs and ten concrete prompt examples. Inspect the authored examples in `game/content/packs/` and exports in `game/packs.mjs` before choosing IDs or fields. Runtime `xonix-pack.v1` is distinct from the older motion-lab collection and concept schemas.

Use the existing [runtime playground](../../../docs/playground-runtime.md) for interactive source selection, atomic expansion imports, signal/hangar painting and the three class comparisons. Export an edited map as a separate one-map expansion; exporting the loaded library retains its original multi-map content.

Preserve the requested theme and mechanics. Configure registered primitives, class rosters, hangars, signal regions, challenges, visual roles and procedural music descriptors. A JSON name cannot implement an unregistered behavior. A body sprite does not set its class, collision size or attachment anchors. Keep original art bytes and rights metadata; public Telegram previews are references until actual originals and their reuse rights are available.

Prepare candidate JSON with `validatePack`, then use `await preparePack` with a real image decoder before installation. Never treat header-only fixtures as decoded art. `installPack`, `removePack` and `importPackLibrary` create complete frozen libraries and reject incomplete dependencies; preserve the active library until preparation and its intended storage operation succeed. Update an existing pack version intentionally, retaining an export of the prior version. Do not fetch content or execute script fields supplied by an imported pack.

When mechanics or maps change, verify both turning policies and relevant class interactions with normal input. `node scripts/verify-packs.mjs` checks all saved example routes; `--discover` regenerates them after an intentional source change. Expand coverage for new examples rather than claiming the ten existing maps prove an unrelated map. A route proof establishes reachability, not enjoyable difficulty or device performance. Inspect actual capture/reveal, overlays and controls in the playable shell at the target sizes.

Player exports and expansion exports are separate. Preserve corrupt original bytes before recovery; never fabricate individual leaderboard runs or missing gallery artwork from aggregate legacy scores. New awards must preserve roster and class-route identity. Keep local scoreboard claims explicitly local. An in-progress save must use the validated replay/session path; do not deserialize arbitrary kernel state.

Run `node --test game/test/library.test.mjs game/test/packs.test.mjs game/test/progress.test.mjs game/test/expansion-playthrough.test.mjs` for changes to this workflow and complete the relevant release checks from the runtime guide. Record source IDs, pack versions, commands and actual evidence. Follow existing user authorization for local iteration and version history; do not infer storefront credentials, external publication or access to private image collections.

For a portable player transfer, follow `docs/full-backup.md`: include profile, pack library and a verified optional unfinished flight. Use journaled import and preserve the previous collection; never bypass writer ownership.
