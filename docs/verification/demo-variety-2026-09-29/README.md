# Demo viewing variety — 29 September 2026

This optional expansion follows baseline `78831c543c530c9209d808998f995c897642d059` on held draft PR #781. It adds four authored recordings to the existing six, giving **ten scenes across eight unchanged base-campaign maps**, with **398.300 seconds** of recorded gameplay. The two existing live-bot maps remain separately qualified; no bot scope, physics, progression, picture-access policy or replay tolerance changed.

| Scene            | Duration | Closed cuts / bends | Final capture | Teaching content                        |
| ---------------- | -------: | ------------------: | ------------: | --------------------------------------- |
| Stone Lanes      | 25.042 s |               3 / 3 |        77.74% | Walls, bent approaches, required relay  |
| Hidden Frequency | 44.392 s |               5 / 5 |        84.91% | Scan, hidden relay, alternating returns |
| The Crossing     | 34.608 s |               4 / 4 |        84.34% | Six actual lane-warning events          |
| Signal Garden    | 47.133 s |               5 / 5 |        78.77% | Jammer entry/exit and hidden archive    |

All additions use Scout, seed 1, immediate steering and the ordinary Standard tuning. They win with all three lives and use no boosts. Routes are explicit waypoint sequences selected through bounded simulation, **not recordings of human play sessions**. No attributable, compatible human-session recording was found in the checked-in sources. Existing opt-in personal recording reuse remains the source for genuine player performances.

## Verification and evidence

- [Recording metrics and original-asset hashes](recording-checks.json): strict Node replay verification, mechanics event counts, and byte-for-byte preservation of all twelve original replay files.
- [Exact browser authoring bundle](browser-authoring.json): all ten committed traces were executed with the real core and recorder in Chromium 154/macOS and independently verified. Only final enemy checkpoint sections differ from Node; input traces, maps, rules, equipment, summaries and other checkpoint sections agree. New browser variants carry individual `recordedIn` provenance; original manifest metadata is retained.
- [Shipped browser adapter results](browser-adapters.txt): all ten source adapters selected an exactly matching frozen replay, then completed strict playback with three lives. No replay outcome was patched or accepted with tolerance.
- [Focused automated tests](automated-tests.txt): 37/37 recordings, source admission/isolation, edition runtime and build tests. Includes an independent practice fork during a live bent cut, real mechanics checks, no-boost/duration bounds, default Journey plus base entry composition, and rejection by the three public company providers.
- [Authoring safeguards](authoring-tests.txt): 7/7 focused tests cover missing historical recordings, atomic metadata writes, interrupted-addition recovery and refusal to report success for an empty browser catalogue. The final authoring-tool review left all twenty-two production demo JSON files byte-identical.
- Caption tests (10/10) additionally cover real scan/objective/signal events, resistance and jammer suppression, duplicate suppression, scene reset and the six-second reading interval. English and Ukrainian catalogues were regenerated.
- [Final edition inventories](edition-inventories.json): all fourteen editions compiled in memory, passed code closure, and included all twenty exact replay files in verified offline byte/hash inventories. The largest Dutch edition used 67,029,054 bytes, leaving 79,810 bytes under the unchanged 64 MiB limit. The [exact check script](edition-check-script.mjs) is retained; no package ZIP or native launch was produced. An [interim attempt](edition-inventories-interim.json) passed individual inventories but detected catalogue formatting during execution; the final stable-source pass supersedes it.
- [Browser UI samples](browser-ui-samples.json), [Signal Garden](signal-garden.png), and [Hidden Frequency](visual-review-final.png): actual demo rendering with protected picture content, sharp gameplay elements, new scan text, completion recaps and rotation. Some scenes were selected through Next level; these samples are not a new soak or proof of uninterrupted playback.

Visual inspection uses the real game on this task's isolated port 8820. Sampled DOM states and screenshots support a desktop presentation review, not a continuous video or unfamiliar-viewer acceptance. Scene rotation can occur between a text sample and a screenshot. The recording export's download event timed out; its complete read-only DOM textarea was instead saved in bounded chunks and parsed before import.

Pointer activation in this browser review did not reliably activate the requested controls; keyboard Space/Escape allowed the review to proceed. This is recorded as an input-check limitation rather than a pointer acceptance pass. Both task-created tabs and the task-owned port 8820 server were closed after evidence was saved; the user's port 8779 game was not changed.

## Scope and remaining limits

The ordinary main game includes these base/Legacy owners in its installed execution catalogue. These recordings are not retagged as the current Journey missions, and are not admitted to DroneAid or Coupa editions. Exact campaign, level revision, map and equipment fingerprints remain mandatory. Broader Journey, tactical-equipment and company-specific scenes need their own freshly authored compatible traces. Historical R5 Night Crossfire proof inputs lose a life under current Standard tuning and were rejected rather than shipped; the live bot remains limited to Orchard Crossing and Courtyard Exits.

Edition build resources now derive their bounded local replay paths from the validated catalogue instead of a hardcoded list. This keeps future additions present in offline/native source inventories. Packaging still includes the existing generic catalogue as shared runtime data; this change adds no private company content.

The prior [two-hour observation and its limitations](../demo-qualification-2026-09-29/loading-recovery/README.md) remain historical evidence on their original source. This expansion does not resolve the known visible-return stall, establish browser memory stability, verify physical audio/controllers/mobile devices, or satisfy the three unfamiliar-viewer release criterion. No new soak, version, merge, release or Pages publication is part of this work.
