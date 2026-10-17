# Authored Urban endurance review workload

This authoring-only tool measures repeated commanded flight through the already published Urban Bando review-r2. It reuses the production regional flight core and renderer and the existing monotonic elapsed-time clock. It does not change runtime behavior, game progress, scores, source geometry, authored starts, package limits or the earlier synthetic two-hour receipt.

Open `authoring/fpv-worlds/regions/authored-endurance.html` in a coherent source server. **Prepare verified Urban world** downloads and verifies the exact immutable descriptor and all 38 payload files before timing. **Start measured flight** deliberately arms a new zero-time segment. The default is a 10-second smoke; a separate two-hour choice is available. Do not start a browser workload concurrently with other canvas reviews.

The exact descriptor is 6,603 bytes / SHA256 `9a7d157d2d5fd197c632b870bd9b9ebacd62015ad0084605712185064c8ae73a`, pinned to commit `622fade3a7a4e70021cab9c509c1116d0378ad2b`. Terrain manifest SHA is `66ef229f0812c31432bb8b3daac6f16e3dcaea19f44be00395a614bfa587afd7`; scenery is `9ae41033e9a73261eeee3ff2339ceaa0e2f6b47367b212fc1f2de470ca8dacb6`. Payloads total 2,268,846 bytes. Missing source never becomes an empty cell or falls back to the network.

## Real authored route

The unchanged mill-court start climbs from 3 m to the 12 m test height. The commanded pilot follows the north mill/loading/container road, tower court, parking approach and western service road, then returns. It crosses real 128 m source cells and district approaches in the 384 m world; it does not teleport or replace the authored geometry with a synthetic corridor. It is a road/court workload, not indoor-flight coverage or a demonstration of every district challenge.

The first attempted direct return from parking intersected an actual structure and was rejected. The checked route uses the western service road instead. The six waypoint positions, controller and immutable identities are recorded with each report. Accepted waypoints and completed circuits are distinct from source-cell crossings and origin recentres.

## Timing and resource ownership

Each uninterrupted segment is independent. The existing 20 ms accumulator uses `performance.now()` plus the wall-clock discontinuity guard; it neither drops time nor fast-forwards. Hidden/unfocused tabs, viewport changes, graphics loss, unexpected contacts, rejected active ticks, reviewer stop and gaps over 250 ms invalidate the segment. Imported reports are unverified history and never extend a pass. A long authored run additionally requires two completed circuits and twelve cell crossings; short smoke reports expose whether that route-coverage condition was reached.

The full verified source is cached in authoring memory before Start. Thus this workload tests actual source decoding, frame preparation, migration, flight and rendering, **not network latency during flight**. Its fixed cache bytes and request count are reported separately from resident-window ownership. Both source cache and runtime ownership are released after a segment. Preparation can be cancelled without starting a segment.

Diagnostics retain at most 120 recent second samples and 121 minute samples, bounded timing aggregates and eight prior segment summaries. Collider allowance comes from the exact verified whole-region solid topology for one committed plus one staged pair; it does not incorrectly reuse the synthetic corridor's 18-collider limit. Existing 10 MiB combined geometry/texture reservation and 32 MiB source reservation checks remain. Counters are observed samples, not proof of opaque JavaScript/GPU heap sizes or GPU completion.

## Verification

Run:

```sh
node authoring/fpv-worlds/regions/verify-authored-endurance.mjs /path/to/urban-delivery-review-r2
node authoring/fpv-worlds/regions/verify-endurance.mjs
```

The verifier reads the immutable local bundle through the actual production downloader and verifies all 39 responses, without network access. The attached receipt records two accelerated full circuits: 62,753 accepted ticks, twelve cell crossings, thirteen origin recentres and zero contacts. It also checks pause retention, deliberate re-arm, missing-cache rejection, source corruption, pre-aborted preparation and zero collision/scene/reservation/cache ownership after disposal. A separate Node smoke measured about 1.006 real seconds / 50 ticks with no renderer. The earlier concurrent smoke invalidated at a 308 ms gap and was not counted; the final smoke starts after preparation's queued work yields, with the same 250 ms limit.

The existing synthetic clock/flight verification still passes all seven groups. These checks do not establish a new browser elapsed endurance result, native rendered-art acceptance, physical-device FPS, IndexedDB persistence, browser-restart recovery or all-network offline behavior. The earlier synthetic two-hour result remains a separate workload and is not relabelled as authored-world coverage.
