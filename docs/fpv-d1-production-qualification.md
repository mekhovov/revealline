# D1 production renderer qualification

## Source and admitted-package runs passed

The actual production renderer passed all 14 functional gates in separate source
and admitted-package browser runs on local combined
candidate `e572026ba357f3194bf47e7137a0817cacb1a640`, tree
`6a90e48f99151041d899b4b8d6b2de5fcffd8b2f`. This candidate combines the reviewed
Woodland groves (#996), Woodland material response (#1001), and published optional
source-budget repair (#1011), preserving Yard, Stadium, Hangar and Garage. It is a
local qualification branch, not a replacement runtime PR or public deployment.
These receipts certify only the named historical candidate and admitted ZIP;
they do not qualify a newer main tip or any later renderer changes.

The source run lasted 415.778 seconds, from 2026-10-03 19:22:13.940Z to
19:29:09.718Z. The admitted-package run lasted 244.253 seconds, from
19:37:54.512Z to 19:41:58.765Z on the same date.
Chrome 154 reported a 1280×720 viewport, actual/requested DPR 2, and a 640×360 CSS
canvas. Both runs observed each measured configuration as visible. WebGL
reported generic WebKit renderer information; no named GPU or physical-device
qualification follows from this run.

The fixture uses the unchanged `createFlightRenderer`, `setCourse`, `loadScene`,
`setQuality`, `prepare`, `draw` and `resources` APIs. A read-only
`Scene.onBeforeRender` observer inspects the actual rendered scene and renderer;
it does not replace lighting, force-hide fallback scenery, or substitute a
synthetic renderer. All 31 production/model dependency hashes were checked before
and after execution against the frozen source manifest.

| Scope               | Observed result                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arenas              | `snake-hunt-chase-06`, `woodland-08`, `container-yard-08`, `beginner-40`, `beginner-37`: five distinct environment/bounds groups                        |
| Main matrix         | Five arenas × three presets × three cameras × imported/fallback = 90 unique configurations; three replacement rounds produced 270 view observations     |
| Additional controls | 60 Pixel/Industrial Workshop observations: five arenas × two appearances × two scenery paths × three presets, using overview                            |
| Quality settings    | Actual DPR caps 1/1.5/2; shadows off/1024/2048; generated texture tiers and nearest-filtered Pixel; linear sampling of shared Themes surfaces           |
| Scene contracts     | Unchanged supplied course/physics snapshots and fog across quality/camera changes; production actor positions, visibility and hunt-marker state checked |
| Ownership           | Exact matching registered/GPU-counter/program plateaus between rounds two and three; empty registered ownership after disposal                          |
| Preparation         | Quality/course replacement invalidated stale preparation; abort rejected explicitly; disposal invalidated pending work and refused later preparation    |
| Errors              | No captured console/WebGL errors or unexpected context loss                                                                                             |

The original focused material/grove receipts remain separate. These results
supersede the older direct-`THREE.Scene` fixture only for the production
configuration/lifecycle coverage exercised here. They do not manufacture a pass
for any historical failure, including the retained Courtyard raster discrepancy.

## Complete evidence in bounded archives

Both complete receipts are stored without dropping any sample, timing, material,
resource or control record. The source archive is:

- [`fpv-d1-production-source-browser.json.gz`](evidence/fpv-d1-production-source-browser.json.gz): **98,644 compressed bytes**, gzip `mtime=0`.
- Compressed SHA-256: `3d3d1c32b75ee97c683b1561d39afe33cd39888b95183d17566be521873395fd`.
- Original JSON: **3,492,950 bytes**, SHA-256 `abb38414fb27d4211cd22fc614af01e3fe3db6e8de8fa1b3d8a7c06ed26347e2`.

The admitted-package archive is:

- [`fpv-d1-production-package-browser.json.gz`](evidence/fpv-d1-production-package-browser.json.gz): **98,875 compressed bytes**, gzip `mtime=0`.
- Compressed SHA-256: `f8b8bb899c48b38560cf97d814f0f532d0844e0865042a34d5a26097a47e5f1d`.
- Original JSON: **3,494,467 bytes**, SHA-256 `3d0062f4c14ec0a45cd60efbc67890c24705343ffd399e4d3e95e539acd19f2f`.

Both archives were decoded and compared byte-for-byte with the original receipts.
Neither uncompressed 3.49 MB JSON is added to the repository/default Pages output.
Each archive has machine-readable metadata, a bounded summary, a source manifest,
the exact executed harness and a browser screenshot alongside it. Summaries are
indexes into the complete evidence, not replacements for it.

Decode and verify both receipts from the repository root; the command leaves the
full JSON files in the temporary directory:

```python
from pathlib import Path
import gzip, hashlib, json
for mode in ("source", "package"):
    metadata = json.loads(Path(f"docs/evidence/fpv-d1-production-{mode}-archive.json").read_text())
    archive = Path("docs/evidence", metadata["file"]).read_bytes()
    assert len(archive) == metadata["compressedBytes"]
    assert hashlib.sha256(archive).hexdigest() == metadata["compressedSha256"]
    assert archive[4:8] == bytes(4)
    raw = gzip.decompress(archive)
    assert len(raw) == metadata["rawBytes"]
    assert hashlib.sha256(raw).hexdigest() == metadata["rawSha256"]
    Path(f"/tmp/fpv-d1-production-{mode}-browser.json").write_bytes(raw)
```

To repeat the browser fixture, serve the retained candidate's dependency bytes at
the paths pinned by `fpv-d1-production-source-manifest.json`, then open the exact
`fpv-d1-production-source-harness.html`. The harness fails on a missing or changed
input. Keep the tab visible and run source and package fixtures sequentially.
The package fixture reads its 31 dependencies from the exact admitted distribution;
all production/model inputs match source except the declared validator-locale
projection, whose admitted descriptor and four committed original inputs were
verified. The admitted distribution ZIP is 15,547,680 bytes, SHA-256
`906a1e319a2ef17d8852fe18fe1c16a1bf620ecaeabe64e52fb12d3706744370`.

The strict source/package comparison aligns records by round, arena, scenery path
and quality, then views by camera; controls also include appearance. It found
**zero discrepancies across 72,680 compared leaves** in 90 sample records, 270 main
views and 60 control views. It compares complete resources, materials, shadow/DPR/
fog/surface observations, actor observations, GL errors, blob sizes, all checks and
browser/WebGL metadata. Only explicitly named timing fields, root provenance and
run timestamps are excluded; those remain in both complete receipts and timing
analyses. The exact exclusions and counts are recorded in
[`fpv-d1-production-source-package-comparison.json`](evidence/fpv-d1-production-source-package-comparison.json).

## Bounded timing observations

The functional pass does **not** establish smooth or acceptable performance.
Both runs contain long browser-wall pauses: **21 of 2,160 source RAF intervals**
and **12 of 2,160 package RAF intervals exceed one second**. This is a descriptive count, not a newly invented
acceptance threshold. No outlier is removed from the receipt or aggregates.

The main matrix has eight sampled draw/RAF iterations per view. The 60 controls
have only two iterations each and are excluded from the following aggregates.
Generation/load values are repeated in each quality row but represent a single
load per arena/path/round; the table deduplicates those into 15 imported loads.
Quantiles use sorted samples at `floor((n - 1) * p)`, matching the harness.

Values below are median / p95 / maximum in milliseconds. Counts apply separately
to each run.

| Measurement                 | Count |                   Source |         Admitted package |
| --------------------------- | ----: | -----------------------: | -----------------------: |
| CPU draw submission         | 2,160 |          0.9 / 1.7 / 5.1 |          0.8 / 1.6 / 5.5 |
| RAF resume interval         | 2,160 |    8.2 / 10.2 / 32,861.5 |    8.2 / 10.1 / 20,152.6 |
| First CPU draw per view     |   270 |      4.2 / 102.8 / 204.6 |      3.3 / 103.7 / 183.3 |
| Awaited shader preparation  |    90 |  43.4 / 247.8 / 16,194.2 |  41.9 / 203.2 / 15,718.9 |
| Imported scenery generation |    15 |         1.3 / 1.5 / 30.2 |         1.4 / 1.6 / 31.7 |
| Imported scene load         |    15 | 213.8 / 991.6 / 17,827.1 | 194.1 / 901.7 / 17,469.2 |

The source run's largest RAF pause was round three, Woodland-08/imported/Performance/chase
(**32.862 seconds**). The largest preparation wait was round two,
Container-Yard-08/fallback/Performance (**16.194 seconds**); the largest import
load was round two, Beginner-40 (**17.827 seconds**). The largest first draw was
round three, Beginner-40/fallback/Quality/FPV (**204.6 ms**). The largest sampled
draw submission was round two, Container-Yard-08/imported/Performance/chase
(**5.1 ms**). These labels and per-quality/path/round distributions are retained in
`fpv-d1-production-source-timing.json`.

The package run's largest RAF pause was round two,
Beginner-40/fallback/Quality/overview (**20.153 seconds**). Its largest preparation
wait was round two, Container-Yard-08/fallback/Performance (**15.719 seconds**),
and its largest import load was round two, Beginner-40 (**17.469 seconds**).
All stored per-view distributions recompute exactly in both receipts; the package
analysis is retained in `fpv-d1-production-package-timing.json`.

The two independent runs localize the largest preparation/load waits to the same
cases: Container-Yard-08/fallback/Performance preparation takes 2,424.6/2,417.3 ms
in round one and 16,194.2/15,718.9 ms in round two (source/package respectively).
Beginner-40/imported round-two loading takes 17,827.1/17,469.2 ms; the same load
observation is repeated across its three quality rows. These are repeatable,
case-specific hotspot candidates for a focused benchmark of those transitions,
not proof of general tab starvation or a diagnosed renderer cause. No optimization
is introduced by this evidence PR.

The worst pauses occur in later rounds, so they cannot be dismissed as first-pass
cold costs. All rounds share one renderer and run qualities/cameras in fixed
order; first-pass/later-pass figures are not controlled cold/warm benchmarks.

Draw-call timings measure synchronous CPU submission to WebGL. RAF intervals
measure elapsed time between browser callback resumes and can include scheduling
or other work; neither is GPU elapsed time or hardware FPS. Shader preparation
measures the elapsed `prepare()` wait, excluding `setCourse`/`setQuality` work.
The harness also performs inspection, progress/receipt serialization and resource
replacement, so its total runtime is not a gameplay benchmark. Visibility is
sampled at run start and the end of each `renderCase`, not continuously traced.
These receipts cannot attribute the pauses to rendering, scheduling or other
causes. Performance remains unqualified; source/package timing comparisons must
preserve this uncertainty rather than turn the passing functional gates into a
performance claim.

## Gameplay, admission and remaining limits

All 26 Woodland/Yard course definitions and all 36 installed demonstration
recordings are bound to the production gameplay closure. Those recordings
completed **77,840 ticks and 152 objectives** through the real replay API. The
prior execution at `d7bf9f992` is preserved losslessly in
`fpv-d1-production-gameplay-replays.json.gz`; its archive descriptor records raw
and compressed hashes/sizes. The integrated binding proves all 21 transitive
course/proof/replay modules remain byte-identical at `e572026ba`.

The six Snake Yard courses were validated and initialized in both modes, including
actor positions, health and hunt targets; no completed Snake recording is
installed. Their initial actor counts are 3/4/5/6/7/10. The production matrix uses
the ten-actor representative. The four School courses have installed Acro
recordings only, so this evidence does not claim completed Self-level School
replays. The matrix renders initial snapshots; it does not exercise every route,
camera position, visibility condition or long-running actor encounter in-browser.

All 30 existing art checks and all three exact-source optional admissions pass.
Admission includes two identical builds, committed-input identity and ZIP-member
verification. World Studio contains 102 files / 15,531,574 runtime bytes. Its 95
original inputs total **16,737,736 bytes**, leaving **39,480 bytes** under the
unchanged 16-MiB limit. The source-budget repair's separately recorded canonical
hunt assertion remains an existing failure; it is not silently included among
these 30 passing art checks.

The full admitted distribution was staged without a rebuild: all 102 ZIP entries
were checked against their admitted member descriptors and extracted below the
retained package fixture's `/player/` path. The local entry is
`http://127.0.0.1:8852/player/optional-practice/fpv-worlds/index.html`; the staging
receipt is `fpv-d1-production-player-staging.json`.

Actual admitted-player offline acceptance then passed. The operator selected
**Prepare simulator offline** and observed **Offline runtime preparation completed**.
The fixture server was stopped; curl returned connection-refused exit 7. Reloading
retained the catalogue and player UI. With that origin still unavailable, Woodland
**Clearing check-in** rendered, was deliberately armed, advanced from an observed
0.3 seconds to 18.9 seconds and was explicitly paused. The operator then selected
**Yard check-in**, rendered and armed it, observed 0.2 seconds and paused. Captured
console errors and warnings were empty. A second curl probe still returned exit 7
before the same fixture root was restarted.

This is **local-origin-unavailable** acceptance, not airplane-mode or device-wide
network isolation. The structured operator observation and two original screenshots
are retained in `fpv-d1-production-offline-player.json` and its referenced images.
The screenshots show HUD times of 18.8 seconds and 0.3 seconds at their capture
moments; they are separate from the reported duration checkpoints. These sessions
prove cached reload, world selection, rendered arm and pause; they do not claim
challenge completion, hardware performance or physical-device acceptance.

Normal protected runtime publication and a matching public deployment marker plus
actual public player launch remain necessary before calling the combined work live.
This evidence-only continuation leaves runtime source unchanged and does not
publish the local integration branch.

Resource counters are not allocated VRAM bytes; empty registered ownership does
not prove zero driver/internal lookup allocation. Sustained hardware FPS, thermal
behavior, low-end/mobile performance and artist/novice acceptance remain
unmeasured. The owner's standing direction makes physical-device/player feedback
nonblocking; those limits are recorded without inventing acceptance.
