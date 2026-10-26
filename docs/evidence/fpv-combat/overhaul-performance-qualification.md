# FPV overhaul performance and qualification

Date: 2026-10-20. Local isolated workspace only; nothing published.

## Status

The four application runs completed without page errors, failed resources, context loss or automatic suspension. The strict whole-run **60 FPS gate remains open for 64, 96 and 128 actors**; the exact averages below are not rounded into passes. The catalogue admission/recovery/replay matrix passed **7,420/7,420** cases. Human satisfaction, updated physical-radio commands and broader hardware acceptance remain unqualified.

The corrected long-archive playback and actual large-autosave reload both passed. The earlier ten-minute controlled comparison passed its fixture validity checks but **Realistic r2 at forced Ultra detail missed the 3 ms additional p95 CPU target**. After the bounded rendering repair, a shorter final native/r2 comparison measured +1.1 ms at High and +1.9 ms at forced Ultra. Those short results meet the target in that fixture; sustained final-source and regional qualification remain open. The invalid first fixture run is excluded.

## Reference and workload

- Apple M4 Pro, 14 logical CPUs, 48 GiB RAM, macOS Darwin 25.6.0; Chrome 155.0.8059.85 / ANGLE Metal.
- 1920×1080, DPR 1, High graphics, Current art; native Standard stadium-01.
- 20 actors used Continuous combat; 64/96/128 used Endless Survival. Scripted keyboard yaw/hover, Balanced ammunition, autocannon/rocket and bomb payload, invulnerability and one-hit enemies were enabled. This assisted workload exercises rendering, progression and persistence; it does not qualify ordinary difficulty or player enjoyment.
- The fixed hover pilot did not pursue every remaining actor. Requested population is not the continuously living population. Five-second snapshots record the actual range below; explicit no-Fire intervals let the Survival roster fill.
- Other agents stopped substantial CPU work during timing. The user's radio tab was untouched. Other desktop processes remained available.

## Actual application performance

All time values in the three p95 columns are milliseconds. Mean FPS is calculated from observed display-frame intervals.

| Requested actors | Wall seconds | Mean FPS | Frame p95 | rAF CPU p95 | Flight-view GPU p95 | Living range | Defeats / shots |
| ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 20 | 600.189 | 60.0024 | 16.7 | 5.7 | 1.942 | 0–20 | 36 / 3630 |
| 64 | 600.188 | 59.7540 | 16.8 | 9.3 | 2.354 | 8–64 | 652 / 2730 |
| 96 | 601.000 | 59.4698 | 16.8 | 12.3 | 2.330 | 6–96 | 865 / 2757 |
| 128 | 840.305 | 58.6097 | 16.8 | 15.4 | 2.422 | 18–128 | 1730 / 4194 |

### Fully populated intervals

The pilot released Fire between approximately four and 6.5 accepted minutes. These are the measured intervals after filling, rather than inferred capacity.

| Requested | Measured wall interval | Accepted ticks | Living min–max | Mean FPS | rAF CPU p95 |
| ---: | --- | --- | --- | ---: | ---: |
| 64 | 60 s | 16737–19742 | 64–64 | 59.9858 | 9.1 ms |
| 96 | 55 s | 16745–19502 | 96–96 | 60.0023 | 11.9 ms |
| 128 | 60 s | 16503–19512 | 128–128 | 59.6701 | 15.0 ms |

No ten-minute interval held every requested actor alive continuously. The 20-actor run's median sampled living count was 4; it establishes sustained-flight/fire stability rather than sustained 20-enemy pressure.

### Observed effects and resource bounds

| Actors | Largest same-step mixed-material defeat burst | Maximum destruction / impact records | Final combined ring evictions |
| ---: | ---: | --- | ---: |
| 20 | 0 | 36 / 1024 | 462 |
| 64 | 48 | 652 / 1024 | 56 |
| 96 | 70 | 865 / 1024 | 25 |
| 128 | 75 | 1024 / 1024 | 1196 |

The large bursts were actual accepted chain explosions under one-hit assistance; they are not synthetic injections or a balance-quality claim. All three enemy projectile styles were observed across the runs. The 128 run retained 1,730 defeats while both logical rings stayed at 1,024. Its saved destruction records span ticks 23,210–42,070 and impacts 11,018–42,079, proving old entries were evicted independently of defeat accounting. Final visible presentation was 768 settled instances, 38 marks, 52 moving fragments and 3 pending fragments. Pending geometry is not silently treated as a floating resting pose.

Sampled renderer draws ranged 50–102 across the Survival runs; geometry/texture/program counts remained bounded. The 128 run’s reported heap ranged 99.3–169.9 MB and ended 140.5 MB. These browser heap observations do not prove absence of every leak and do not include all decoded/GPU memory.

## Timing scope

CPU is aggregated synchronous requestAnimationFrame callback work per display frame. It excludes asynchronous workers and GPU execution. The 10 Hz keyboard-hover helper executes outside that total and is recorded separately. Frame intervals include browser scheduling/presentation. Simulation runs at 50 accepted ticks/second; wall and accepted times are reported separately.

GPU is sampled **flight-view render GPU work**, including that renderer's shadow/internal passes. It excludes browser composition and other contexts. The same qualification-only probe wraps one in 15 render calls, with at most 8 pending asynchronous queries. Results are read only after availability with the disjoint flag clear; invalid/lost samples are discarded. This follows the [Khronos timer-query contract](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/). There is no blocking readback, finish or flush. Probe overhead is included identically in the On/Off comparison.

The 20/64/96/128 runs yielded 2,400/2,390/2,382/3,282 valid GPU samples respectively, with zero discarded, disjoint, context-loss or probe errors.

## Recording capacity and recovery

The 128 run crossed the 12-minute in-memory recording limit. At pause, aircraft and encounter were at 42,134 ticks; the live tail retained 6,000–42,134 and explicitly marked itself incomplete. Its independently persisted archive covered 0–42,134 in 15 segments and exported successfully. Importing the plain bounded recovery restored the same tick, 1,730 defeats and 4,194 shots; its new archive correctly reports a missing beginning. The complete archive is a separate artifact, not reconstructed from that tail.

The initial post-run playback probe found a real UI defect: the compact flight shell hid the speed selector despite successful playback preparation. A scoped combat-playback bar now exposes the supported speed choices and resets on exit; focused host checks pass 29/29. The original failed probe remains preserved in the stress report. The corrected UI then imported the complete archive, selected the actually visible supported 4× option, resumed playback, and verified all 42,134 accepted ticks with `FPVCombatReplayVerification.v2` and the `accepted-dynamics-v1` physical boundary. No errors occurred. The 842.68 simulation seconds took 360.29 wall seconds: 4× is the selected requested rate, not a claim of sustained fourfold throughput. Playback awarded no rewards and remained practice-only.

The same 128 run exposed another real host limit: its 7,180,019-byte recovery exceeded browser localStorage capacity while its independent IndexedDB archive remained healthy. Autosave now falls back to a dedicated single-record IndexedDB store. The actual browser saved a 7,180,077-byte wrapper with both 1,024-record presentation rings, reloaded the page, and restored through **Continue saved combat** without another file import. It returned paused at tick 42,134 with 1,730 defeats, 4,194 shots, 767 visible settled instances, 38 marks and zero replayed bursts. All logical records were retained. The rebuilt presentation reported 1,043 deferred fragments; this result does not establish that every off-screen or capacity-deferred piece was revalidated. The browser reported no errors.

## Controlled effects comparison

Eight 75-second measured phases total ten minutes, plus five seconds of warmup per phase. This is a renderer experiment, not ten minutes per condition or a full-application benchmark. It uses the production flight renderer, 128 fixed living military actors (32 organic and 96 mechanical), native and synthetic regional scenes, High overall graphics, and **forced Ultra effect detail**. This intentionally exercises the Ultra effect ceiling beyond the ordinary High cap. Full gore stays enabled throughout every measured On window.

On phases begin with 1,024 logical destruction and 1,024 surface-impact records. Eight mixed-material defeat facts and eight impacts are scheduled every two seconds; restoration occurs every thirty seconds. Off phases stage the same living actors, camera and movement without the effect facts or ledger, so the CPU difference includes ingestion and presentation work. The infinite flat fixture support has stable attachment identities and radius-aware swept contact. It does not test production terrain admission, corners or streaming.

Differences below are `p95(On) − p95(Off)` from sequential conditions, not a confidence interval or per-frame paired statistic. CPU covers fact ingestion, actor staging and synchronous draw. GPU retains the sampled flight-view scope described above.

| Scene / art | CPU off / on | CPU difference | GPU off / on | GPU difference | 3 ms CPU target |
| --- | --- | ---: | --- | ---: | --- |
| Native / Current | 3.0 / 4.8 ms | 1.8 ms | 2.482 / 2.667 ms | 0.185 ms | Met in this fixture |
| Native / Realistic r2 | 2.5 / 5.9 ms | 3.4 ms | 4.680 / 5.733 ms | 1.053 ms | Missed |
| Synthetic regional / Current | 1.9 / 4.6 ms | 2.7 ms | 1.231 / 1.392 ms | 0.161 ms | Met in this fixture |
| Synthetic regional / Realistic r2 | 2.4 / 5.7 ms | 3.3 ms | 3.388 / 4.365 ms | 0.977 ms | Missed |

### Actual rendered workload

| Enabled condition | Settled instances | Moving fragments | Visible marks | Pending/deferred fragments |
| --- | --- | --- | --- | --- |
| Native Current | 859–1,534 | 0–512 | 80–92 | 0–617 |
| Native r2 | 745–1,536 | 0–479 | 69–77 | 0–1,175 |
| Synthetic regional Current | 859–1,534 | 0–512 | 80–90 | 0–617 |
| Synthetic regional r2 | 745–1,536 | 0–479 | 69–75 | 0–1,175 |

These ranges are two-second snapshots; they are not per-frame maxima. Every enabled condition observed eight simultaneous breakup effects and retained both complete logical rings. The renderer deliberately does not show all logical records simultaneously. Phase-correct screenshots show grounded clusters and recognizable living military actors, but this is not an assertion that every recorded cluster was rendered or that distant screenshots qualify every wound detail. Restoration temporarily leaves additional pieces pending/deferred; support callbacks reported zero invalid results.

Each phase asserts actual activation, actor and effects appearance identities. Current has no appearance hash; r2 matches the pinned manifest. There were zero browser errors, GPU disjoint events, context losses or discarded queries. Off phases produced 300 GPU samples each; On phases produced 296 each. The burst scheduler emits at most once per rendered frame and does not retain an exact emitted-count receipt, so identical scheduled inputs do not establish identical emitted totals if a frame gap exceeds two seconds. Exact totals are not claimed.

The initial partial comparison used an invalid fixture attachment callback and rendered zero settled remains. It is explicitly excluded and preserved as `overhaul-effects-workload-grounding-invalid.json`. The corrected smoke and final run use the actual surface schema; no gameplay source changed for this correction.

### Short capped-High diagnostic

A subsequent native r2 comparison used High effect detail, thirty measured seconds plus five warmup seconds per condition. CPU p95 was 2.7 ms Off and 6.0 ms On (**+3.3 ms**); sampled GPU p95 was 4.749 and 4.865 ms (**+0.116 ms**). It emitted all eighteen scheduled burst groups across warmup plus measurement, with a maximum measured frame interval of 66.7 ms and no invalid support, appearance or browser errors. The enabled samples showed 761–768 settled instances, 108–256 moving fragments, 70–82 marks and up to six simultaneous breakup effects. Both logical rings remained full.

This diagnostic exposes a presentation limit: r2 living actors stayed active, but its destruction resources reported zero authored triangles. That measured revision fell back to Current-art remains when a complete authored cluster exceeded the tier's draw-call ceiling (32 appearance draws versus High's ceiling of 24). Therefore this result **does not qualify High-detail r2 destruction** and does not repair the failed Ultra target. It includes one restoration within the measured window and is a shorter diagnostic, not a replacement qualification run.

### Authored High-detail repair and bounded follow-up

The failure above led to a narrower rendering change. Each opaque r2 exterior region and its cut-surface cap now share a derived draw, while masked hair remains separate. The implementation retains all twelve authored regions, UVs, normals, material response and equipment ownership. Blood switches between original interior shading and an opaque neutral closure without compiling another program. Whole clusters are deferred when the global visible-pool budget is full; the renderer no longer substitutes Current-art organic remains. Logical records remain intact.

The actual GLB browser smoke checked all **36 family/cast identities individually** at High detail, each with one complete twelve-region cluster and zero procedural substitution. A representative shield troop passed all eight Blood/Brutal/Remains combinations. All shader programs linked, with no page or console errors. Three effect-owner disposal cycles returned to exactly 29 geometries, 9 textures and 7 programs; after initial broad-identity warming, repeated active instances used 46/9/9. This qualifies scoped effect-owner cleanup, not whole-application leak freedom.

The separate mixed fixture showed four complete authored clusters alongside procedural mechanical wreckage within **23 of 24 effect draws**. Other organic clusters were wholly deferred; this is not a claim that all 1,024 records or all families render simultaneously. Derived buffers cost 6,581,322 bytes, one shared material and no new textures. Added to the existing source-and-living-crowd accounting, totals are **120,470,018 decoded bytes and 142,801,754 GPU bytes**, under 128 MiB and 160 MiB. The immutable r2 pack and its hash are unchanged. Source-level counters distinguish complete clusters from the actual number of visible regions under partial Remains-off filtering.

The parent also cached unchanged ring ordering and moved impact-category quota checks ahead of support queries. The older failed timing receipts above remain authoritative for their recorded revisions. The 36-identity smoke used preformat canonical presentation hash `43d79ed4…`; only formatting changed before the final canonical hash `8c1402c122840b859263edffadd3d1cd99734221a1acdb1cc8b8ea4b7556fe9f`. The generated application bundle was then refreshed and verified byte-identical to fresh generation.

### Final short generated-bundle comparison

The following repeat imports `createCombatPresentation` from the actual generated application bundle (`e13a1fd21b79cf0cb50b64a22f494b0fdbe9b3a4afb1cf6fb5945cb4580deb06`). It uses the same native renderer fixture, 128 living actors, full logical rings and Full gore, with thirty measured seconds plus five warmup seconds per condition. High overall graphics stays fixed; the effect setting is High or forced Ultra. It is not a replacement for the prior ten-minute experiment or the application runs.

| Effect detail | CPU off / on | CPU difference | GPU off / on | GPU difference |
| --- | --- | ---: | --- | ---: |
| High | 2.7 / 3.8 ms | **1.1 ms** | 4.552 / 5.217 ms | 0.665 ms |
| Forced Ultra | 2.4 / 4.3 ms | **1.9 ms** | 4.709 / 6.748 ms | 2.039 ms |

Both meet the 3 ms CPU-difference target in this short fixture. The cost of rendering genuine authored r2 remains is included. These sequential p95 differences have no confidence interval and do not establish sustained or regional performance.

Each On phase emitted exactly eighteen eight-defeat/eight-impact groups across warmup plus measurement. Maximum measured display gaps were 66.7 ms at High and 66.6 ms at Ultra, well below the two-second scheduling period. Both logical rings remained at 1,024; both phases included a thirty-second presentation restore. Actual sampled visible ranges were:

| Effect detail | Complete authored clusters / regions | Settled / moving instances | Marks | Pending/deferred fragments | Effect draws |
| --- | --- | --- | --- | --- | --- |
| High | 3–5 / 36–60 | 758–768 / 80–256 | 50–56 | 0–288 | 21–24 of 24 |
| Forced Ultra | 11–31 / 132–372 | 537–1,536 / 49–454 | 80–90 | 0–1,125 | 30–36 of 40 |

Every sampled authored cluster represented all twelve regions. Mechanical wreckage remains procedural by design; the organic authored-to-Current fallback is removed. High samples observed five concurrent breakup effects, and Ultra observed eight. The full logical rings are not a claim that every cluster is visible at once.

GPU samples were 120/119 for High Off/On and 120/118 for Ultra Off/On, with zero discarded, disjoint or lost-context samples. All appearance-identity, support and cluster invariants passed, with no page or shader exceptions. **One console404 is retained as unattributed** because the measured harness captured only its message, not its URL. A separate five-second bootstrap with failed-response URLs enabled did not reproduce it; this does not prove the original404 was harmless or absent. No zero-browser-error claim is made for this repeat.

The report preserves canonical, bundle, actor, appearance, renderer, harness and GPU-probe hashes. The GPU probe retains the earlier bounded asynchronous render-call scope. No gameplay runtime or pack asset changed for this repair.

## Appearance and other coverage

- Realistic r2: 128 organic actors across 36 variants render 20 full rigs plus 108 shared-pose Realistic bodies, without Current-art body fallback; measured 108.61 MiB decoded and 129.91 MiB GPU resources. 51 visual captures cover 36 family/cast variants and all 8 Blood/Brutal/Remains combinations.
- Three actual r2 app attempts kept 96 prepared/116 running geometries, 66 textures and 34 programs on each restart, with no accumulating counts. They are short lifecycle checks, not fourteen-minute Realistic stress qualification.
- All six activities had browser start/arm/fire smoke coverage. Railway Valley passed pinned-byte download admission/install/play; supplied local pinned bytes do not qualify unreliable remote network delivery.
- Final catalogue coverage includes both physics backends and actual paired recovery/fresh replay. The long performance runs themselves cover native Standard only.

## Evidence and revisions

- Actual runs: [overhaul-app-stress-final.json](overhaul-app-stress-final.json)
- Complete archive: [compressed 42,134-tick archive](overhaul-app-stress-final-128-complete-archive.json.gz)
- Bounded recovery: [overhaul-128-recovery.json.gz](overhaul-128-recovery.json.gz)
- Corrected full-chain playback: [overhaul-long-archive-replay.json](overhaul-long-archive-replay.json)
- Actual large autosave and Continue: [overhaul-large-autosave.json](overhaul-large-autosave.json)
- Controlled Ultra comparison: [overhaul-effects-workload-final.json](overhaul-effects-workload-final.json)
- Short High diagnostic and identified fallback: [overhaul-effects-high-diagnostic.json](overhaul-effects-high-diagnostic.json)
- Repaired real-r2 High clusters, preferences and cleanup: [overhaul-cap-batching-browser.json](overhaul-cap-batching-browser.json)
- Final short packed High/Ultra repeat: [overhaul-effects-batching-diagnostic.json](overhaul-effects-batching-diagnostic.json)
- Separate failed-resource bootstrap probe: [overhaul-effects-batching-resource-probe.json](overhaul-effects-batching-resource-probe.json)
- Corrected support/appearance smoke: [overhaul-effects-grounding-smoke.json](overhaul-effects-grounding-smoke.json)
- Application, art, grounding, recovery and earlier diagnostic detail: [overhaul-browser-qualification.md](overhaul-browser-qualification.md)
- Catalogue matrix: [overhaul-catalogue-matrix.json](overhaul-catalogue-matrix.json)

The full-app timing source hashes are retained per run; later host-only replay/autosave corrections have separate browser evidence and do not retroactively change those hashes. Timing used world-app `636b470e388f5c2004ebb0426502df5d6f984964aa2f9a2c94d779ada6c5dea0`, reaction bundle `b8d87796987de4953a3a62ef3094c069046e94628a7465d26161428c205da703`, renderer `277de38a0acded3da5b52f668bf77688478cdd420dcb603e8a7c9eeb855d2fc0`. The report also records actor/presentation source hashes and separate harness/probe hashes.

## Remaining release gates

1. Strict 60 FPS whole-run target for the larger tiers, plus sustained and regional final-source qualification of the 3 ms CPU effect-overhead target. The authored High-budget fallback defect is repaired; short native/r2 High and Ultra repeats meet the CPU target in their stated fixture.
2. A new physical-radio pass for weapon switching, reload and payload commands; earlier user confirmation covered flight and Fire before/after pause.
3. Five-player formative play sessions and required satisfaction/threat-clarity ratings.
4. Broader hardware, full-app Advanced/regional performance, and long-session Realistic performance. Current-art desktop measurements do not establish those results. The final presentation batching/order changes have not repeated the long full-application runs.

R2 repartitions the existing provenance-tracked asset and equipment. It is not a new commissioned photorealistic sculpt. Superseded slow/failed measurements remain in the evidence folder and are not final acceptance.
