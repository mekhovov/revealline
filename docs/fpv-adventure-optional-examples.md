# Optional Adventure examples

This data-only increment converts the 60 retained Adventure authoring proofs
into one optional recording archive. All 30 existing challenges have an Acro
and a Self-level example. The original 178 bundled examples, player runtime,
course geometry, physics, package policy, core downloads and precache are
unchanged. Use the [download and import instructions](../authoring/fpv-worlds/demonstrations/optional/README.md#adventure-examples-both-modes).

The player already supports local examples through Library import and the
selected-mode catalogue Watch action. Imported flags are not trusted: the host
replays each recording against the exact installed pack and normalized course
before enabling it. Demonstrations remain unscored and award no notebook
progress or rewards. This is the optional-data portion of D3, not completion of
coaching, continuous practice, alternate School examples or device polish.

## Source and deterministic transport

The retained `adventures-qualification.zip` is 493,982 bytes, SHA-256
`273a68519c195f8f0ca001ce42497a28e288cf2710cc7fcb84c120003d6a2db2`.
Its manifest is separately bound by
`fcd36fd2e3de39bfd65a423d37b5ea53d237bd7f5b2f2b72375b5ff233a07bcb`.
The converter only decodes this exact bounded authoring archive. It preserves
the original proof commands and demonstration markers; it does not author or
optimize flights.

The exported `FPVProofArchive.v2` file has 60 records and is 4,637,320 bytes:
SHA-256 `c9734dcf05fcfc87a42960daad05e3b594e938dcfeb44624305802972aad5ca3`.
Archive identity: `dc52b11d221aba213ac811827e3106865d02ab493ae4bba8148e35db6fa90ea9`.
Payload hash: `6b8ccb98ddf88fc708135a4821f66358435bfffef88a7dea010c46499e119f70`.
The existing 32 MiB import, 1,024-record archive and 512-record/64 MiB library
limits remain unchanged. No recordings are appended to the core registry.

## Qualification

The full conversion and browser qualification baseline is `bf167a4fdfc81d7327fd94518da65ac82d64eb7e`.
The portable converter passes **992 checks**, including every exact identity,
original outcome and proof hash, deterministic export, import verification reset
and independent replay of all 60 imported records. Each pass executes **253,011
ticks**; all **120 Rapier worlds** are freed exactly once, with peak ownership
one and zero live afterward. The complete original and round-trip observations
are retained in [the conversion receipt](evidence/fpv-adventure-optional-conversion.json).

All 60 complete with zero contacts. Fifty-four retain full health. The six
laser-duel examples for Quarry 04, Rail Depot 05 and Solar Farm 05 retain their
original health (94 or 97 of 100), shots, hits and exact final state. No claim of
perfect play or continuous swept clearance follows from their sampled paths.

The real-host browser fixture freezes the complete admitted 102-file Railworks
player from `9efa36364425e2846002748bb29478b378d2b5cb`. Its production inputs
are byte-identical to baseline `bf167a4f`; its ZIP is
`67d3a9f526dd39d8e011a9d38efc5a8710128123a4e7d481757badec733b208b`.
All modules, CSS and artwork are verified and linked immutably. The fixture uses
actual File inputs, IndexedDB and existing catalogue Watch actions; it isolates
database names and preferences and controls animation timestamps. The accepted
bounded browser contract is all 60 imports and selected-mode lookup identities,
reload persistence, invalid/missing dependencies, and 12 complete rendered
replays covering both modes in each of the six worlds. The accepted [v5 browser receipt](evidence/fpv-adventure-optional-browser-v5.json) passes **395/395 checks** with empty runtime errors: all 60 actual imports and persisted lookups, invalid/missing states and all 12 exact rendered replays. The screenshot and full source/fixture bindings are retained beside it. The prior foundation host's 117
checks are historical evidence, not repeated or newly claimed here.

## Reproduce and limits

```sh
node scripts/convert-fpv-adventure-examples.mjs --out /tmp/NEW-ADVENTURE-EXAMPLES
node scripts/prepare-fpv-optional-example-player-verification.mjs \
  --player-root /absolute/path/to/immutable-admitted-player \
  --player-receipt /absolute/path/to/full-player-receipt.json \
  --harness docs/evidence/fpv-adventure-examples-browser-harness.html \
  --proof-file authoring/fpv-worlds/demonstrations/optional/adventures-v1.json \
  --source-revision bf167a4fdfc81d7327fd94518da65ac82d64eb7e \
  --out dist/fpv-optional-example-player-new
```

Use a lowercase output suffix. Serve the repository over local HTTP and run the
fixture through the approved browser. Preparation alone is not browser evidence.
The preparer rejects a player whose source differs from the explicitly selected committed
production tree (default HEAD) and never replaces an existing fixture. Its private fixture
archive limit does not modify production limits.

The [input-scope audit](evidence/fpv-adventure-optional-input-scope.json) checks all 95 original admitted inputs against current files and Git: **16,762,811 bytes**, unchanged **14,405-byte headroom** below 16 MiB on this baseline. This is an equality audit of an existing admission, not a new build. The optional JSON is absent from every admitted original input.

This scope has no runtime inputs to rebuild; the admitted player is reused
without manufacturing a new admission result. Public download availability is
separate from local qualification and must be checked after protected merge.
No hardware FPS, physical-controller, beginner acceptance, airplane-mode or new
offline qualification is claimed. Additional unit coverage remains deferred to
D6 as approved.

## Retained first-browser failure and separate host defect

The [v1 receipt](evidence/fpv-adventure-optional-browser-v1-failure.json) records **256 passing checks**, including all 60 imports and exact lookups, before failing during the fixture’s explicit `app.dispose()` call at reload. It is not an all-pass receipt. The [original harness](evidence/fpv-adventure-optional-browser-v1-harness.html) and [manifest](evidence/fpv-adventure-optional-browser-v1-fixture.json) are preserved.

The unchanged host disposes its play shell first (`world-app.mjs:5936`); shell disposal removes the generated `main` (`game/ui/mode-play-shell.mjs:447`). Menu navigation disposal then invokes the hint callback (`input.mjs:931`), which queries the now-missing main and calls `append` (`world-app.mjs:5278`). Explicit host disposal rejects before later input, flight, renderer and store cleanup. This existing lifecycle defect is a separate narrow follow-up; it is not repaired or suppressed by this data-only increment.

The v2 fixture uses native iframe HTTP navigation, matching browser refresh, and then native frame removal with private-database cleanup. It does not claim the public explicit-unmount API passes. Runtime bytes are unchanged.

## Integration and retained playback diagnostics

The branch then fast-forwarded to Orchard merge `5e4abe27305ef06f4bbecb8f9365c218dee55979`. The [scoped integration audit](evidence/fpv-adventure-optional-orchard-integration.json) finds exactly one changed original input: the independently qualified Orchard surface module `7313e732…`, +4,204 bytes. All other 94 inputs, host/import/lookup, physics, course and recording bytes are identical. This map change applies to the five Adventure Orchard courses; it is not described as inactive. Its separate 96-check/43-pair source and package matrices, ten physics replays and actual-player observation remain in [Orchard qualification](fpv-orchard-tree-surfaces.md). The resulting source total is 16,767,015 bytes with 10,201-byte headroom. No new admission or browser rendering on this later merge is claimed by the historical Adventure fixture.

The [v2 partial receipt](evidence/fpv-adventure-optional-browser-v2-partial.json) and [external pause observation](evidence/fpv-adventure-optional-browser-v2-paused-note.json) retain a run that completed imports and persistence but stopped progressing during its first playback after another browser tab was used. Its fixture inherited a long paused loop; that run does not establish uninterrupted playback or an exact pause cause. V3 adds bounded visible/focused checks, focus-event observations and prompt pause failure. The [complete v3 failure](evidence/fpv-adventure-optional-browser-v3-failure.json) preserves a **316.1 ms** first active-pulse observation: the player paused at zero ticks despite visible, focused ownership. All 321 recorded checks passed before this overall failed run; there was no blur during that playback. The production 250 ms execution-gap guard remains unchanged.

V4 deliberately pauses through the actual UI and records at most ten zero-delta preparation frames without changing flight ticks. It requires two consecutive measured paused pulses at or below 250 ms before one deliberate Arm. Any subsequent active pause, focus loss or bounded-playback failure stops qualification; there is no blind resume loop, clock-guard patch or performance claim. All original failed receipts remain separate from eventual accepted playback evidence.

The [v4 failure](evidence/fpv-adventure-optional-browser-v4-failure.json) also stopped at zero ticks, after 9.5 ms and 4.6 ms paused preparation samples; its observed active-loop gap was 240.6 ms. These loop observations do not equal the host’s callback-entry execution gap, so they do not establish a GPU bottleneck or exact pause cause. Read-only inspection found that every `app.snapshot()` clones the entire saved recording library. V3/V4 repeatedly requested those 60-record snapshots around each frame; those observers themselves can perturb the real 250 ms safety guard.

V5 transparently forwards the existing renderer `setCourse` and `draw` calls with unchanged receiver, arguments and return value and observes the already-produced draw state. The hot playback loop reads actual status/result DOM and that state, with no full-library snapshot calls. A full snapshot is measured only while paused or after completed playback; final rendered identity must equal the completed host snapshot. The controlled RAF scheduler retains bounded real callback-entry timing, UI click duration and snapshot-cost observations without replacing `performance.now`, changing the guard or automatically resuming. This is functional instrumentation, not uninstrumented frame-performance evidence.

The [final artifact review](evidence/fpv-adventure-optional-final-artifact-review.json) passes 23 scope and receipt checks. Accepted v5 took 73.347 seconds for the complete functional run. Its measured whole-host snapshot call rose from 0.1 ms with an empty library to 99.6–119.5 ms with the 60 examples and two negative controls. This supports the observer-overhead explanation for the earlier guard pauses; those earlier runs lacked equivalent callback timing, so their precise cause is not retrospectively proven. The accepted run’s largest observed active-loop gap was 43 ms. These are instrumented loop observations, not hardware FPS or unmodified rendering benchmarks.

## Current-main integration

The ordinary merge of main `72d6661b117e1cf1d76ac5de44381685c63d19b9` preserves
the published Solar implementation and its plan edits. The [95-input scope audit](evidence/fpv-adventure-main-solar-integration.json)
finds only `renderer.mjs` and `world-visuals.mjs` changed; the host, physics, course
definitions and proof transport remain exact. Solar surfaces apply to the five
Adventure Solar courses. Their art qualification remains in the separate Solar
delivery; the Adventure receipt still identifies its frozen historical player.
This integration is not represented as a new browser run or package admission.
