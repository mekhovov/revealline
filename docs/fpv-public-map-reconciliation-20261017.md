# Public FPV map delivery — 17 October 2026 reconciliation

At the recorded checkpoint, the public SIM serves **`fb3caf12bd43743670f47c42dc21f7a406223379`**. The normal [Pages run](https://github.com/mekhovov/revealline/actions/runs/39038793037) passed. A bounded HTTP check at 15:27 UTC found that revision in both the public deployment marker and manifest; the marker stayed unchanged through the check.

The current shipped catalogue contains **24 regional editions**, **20 downloadable Worldpacks / 41 course definitions**, and the unchanged **14 built-in environments**. These overlap by family and are not a count of distinct landscapes. Use [SIM](https://mekhovov.github.io/revealline/optional-practice/fpv-worlds/index.html?lang=en#packs), or the previously observed main menu **More → SIM** route. This checkpoint checks shipped source, not a new UI journey.

**Actual public launch coverage remains 13/24 regional editions, 20/20 Worldpacks with one course each, and 14/14 built-ins. Eleven regional public launches remain: the ten earlier editions plus Alpine R6.** The earlier [per-offer audit](fpv-public-map-availability-20261016.md) preserves the original launch observations, installation failure and later saved-map visibility failure. None was retested or reclassified here.

## Current delivery evidence

- Six shipped source modules match `fb3caf12` byte-for-byte: the regional catalogue, its cell-size capability, regional delivery, WorldStore, world app and built-in catalogue. Their lengths and hashes also match the public manifest. The generated world reaction runtime separately matches its public manifest; direct source-byte equivalence is not claimed for that bundle.
- Static catalogue extraction resolves the actual imported 512 m capability and all 24 offers without executing production code. All 23 prior IDs, EN/UK titles, edition labels, descriptor pins and advertised sizes match the frozen audit. The live Worldpack feed matches all eight recorded fields of each earlier 20 rows, including 41 course definitions.
- Alpine **Station approach R6** is already in the shipped default catalogue. [#1535](https://github.com/mekhovov/revealline/pull/1535) records its exact package and bounded local native acceptance plus [earlier public descriptor/source verification](https://github.com/mekhovov/revealline/pull/1535#issuecomment-6205549263). Its public normal install/Fly remains unchecked. The previous report's “not yet available” statement is historical.
- The publicly served regional delivery module contains the approved 512 MiB policy; Worldpacks retain their separate 256 MiB policy. This does not prove all 24 coexist or repair saved-map visibility.
- One initial audit probe requested the source-only `world-library.mjs` output path and received 404. It is absent from the emitted manifest; the actual app imports the generated `world-reaction-runtime.mjs`, whose public hash passed. This preparation negative is retained and is not presented as a player loading failure.

The [machine-readable receipt](fpv-public-map-reconciliation-20261017.json) records exact hashes, every regional identity, historical/current distinctions and limits. No map payload was downloaded again.

## Regional editions

“Historical launch” means the earlier bounded public Arm/Pause sample. It does not mean the present saved Library is healthy or every start/course was flown. Every row below is offered in current public source.

| Region / edition | Revision | Public native status |
| --- | --- | --- |
| Alpine Highlands — connected mountain study · Station approach | station-r6 | Local native/package passed; public install/Fly unchecked |
| Alpine Highlands — connected mountain study · Station concourse | station-r5 | Historical bounded launch passed; no new test |
| Lunar Basin — flight study · Shelter detail | composition-r3 | Historical bounded launch passed; no new test |
| Alpine Highlands — connected mountain study · Quieter station surfaces | station-r4 | Historical bounded launch passed; no new test |
| Alpine Highlands — connected mountain study · Station surface details | station-r3 | Historical bounded launch passed; no new test |
| Lunar Basin — flight study | composition-r2 | Historical bounded launch passed; no new test |
| Alpine Highlands — connected mountain study · Refined contours | review-r2 | Historical install failed; public flight unchecked |
| Alpine Highlands — connected mountain study · Original study | review-r1 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Canal City — bridges and courtyards | district-r2 | Historical bounded launch passed; no new test |
| Desert Expedition — rock routes · Rock practice routes | landmarks-r1 | Historical bounded launch passed; no new test |
| Desert Expedition — 16 km relief study · Open desert terrain | natural-r1 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Tropical coast — connected harbour · Connected harbour | harbour-r3 | Historical bounded launch passed; no new test |
| Railway Valley — six districts | review-r1 | Historical bounded launch passed; no new test |
| Coaster Gardens — connected park study · Connected park routes | review-r2 | Historical bounded launch passed; no new test |
| Coaster Gardens — 2 km study · Original park study | review-r1 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Hillside Town — civic court materials · Civic courtyard materials | courtyard-r5 | Historical bounded launch passed; no new test |
| Hillside Town — terraces and courtyards · Terraces and courtyards | town-r2 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Tropical coast — six flight districts · Six coastal districts | review-r2 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Canyon Expanse — broad relief study | relief-r1 | Historical bounded launch passed; no new test |
| Tropical coast — bounded flight study | review-r1 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Canyon Badlands — six districts | districts-r1 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Canyon Badlands — regional preview | rounded-r1 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Railway Valley — regional preview | structure-r1 | Public flight unchecked; prior pin-bound HTTP integrity passed |
| Urban earthworks — regional preview | review-r2 | Historical bounded launch passed; no new test |

## Persistence and later independent checks

The two earlier failures remain open: a closing-IDBDatabase transaction error during School mode/input changes, and a later normal reopen showing zero saved regional rows and no installed Worldpack cards. Their actual original contents, connection closer and cause remain unknown. Neither the capacity increase nor [#1537's metadata-listing optimization](https://github.com/mekhovov/revealline/pull/1537) establishes a causal repair. Preserve the affected context; do not repopulate or clear it to obtain a pass.

[#1564's separate delivery evidence](https://github.com/mekhovov/revealline/blob/6018a0f5d113759ad7a13ad06208366cbd5d652e/docs/fpv-boundary-delivery-verification.json) now records normal password entry, saved rates, offline browser-process reopen, short unscored recording/export/replay and worker disposal for fresh isolated Chrome Academy and World installations at this deployment. A labelled Electron fixture has separate saved-library and short Regional evidence. These improve the documented runtime/recovery coverage; they add no regional map launch to this table and do not qualify the original affected map-storage context. The first World startup timed out; its unexplained failure remains preserved despite the later successful reopen and fresh rerun.

[Input-recovery #1565](https://github.com/mekhovov/revealline/pull/1565) merged as `3e744a5e` during report preparation. Its [Pages run](https://github.com/mekhovov/revealline/actions/runs/39045107325) was still in progress when checked. The repository comparison changes none of the seven modules audited here or the map catalogue. This report branch includes that newer main, while the actual public observations remain pinned to `fb3caf12`; no later rollout or native acceptance is inferred.

## Remaining work in priority order

1. **P0 — Diagnose original saved-map visibility and connection ownership.** Obtain supported read-only lifecycle evidence before choosing a causal fix. Keep the original context and its negative reports intact.
2. **P0 — Finish the eleven regional public install/flight journeys.** Start with R6 and the historically refused Alpine refined contours, then the nine other older editions. Use normal visible UI and explicit arming with a bounded, identified context after safe storage headroom is available. A separate context cannot close the original persistence failure.
3. **P1 — Prove retained all-24 coexistence and recovery.** Logical 427,609,228-byte accounting fits the 512 MiB policy; actual installation, browser overhead, reopen and interruption behavior remain to be observed. Do not delete existing editions to make a test pass.
4. **P1 and later — Complete the broader SIM plan.** Preserve the separate native School/HUD, control/device, measured performance, actual two-hour authored endurance, full per-map starts/courses and final-art gates. Short neutral-input lifecycle checks and historical software replay do not substitute for them.

This reconciliation opens no browser or renderer and reads no player database. It changes no application code, catalogue entry, storage policy, asset, physics or acceptance gate.
