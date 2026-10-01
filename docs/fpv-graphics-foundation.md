# FPV graphics foundation

This is the first R4 increment in the approved continuation plan. It improves
the shared renderer used by Academy, World Studio, replays and the drone
inspection view. It does not complete the eight-world art pass or establish
photorealism, novice acceptance or target-device performance.

## Presentation

Performance caps device pixel ratio at 1 and disables dynamic shadows. Balanced
caps it at 1.5 with a 1024-pixel shadow map; Quality caps it at 2 with a
2048-pixel map and extra drone/scenery detail. Balanced and Quality use the
pinned Three.js renderer's supported PCF shadow filter. Fog, route geometry,
collision, targets, simulation and course identities do not vary by preset.

Locally generated albedo, normal and packed ambient/roughness surfaces add
concrete joints, metal, brick, wood, grass and carbon detail. Their shared
texture storage changes resolution with the preset; pixel materials retain
64-pixel nearest-filtered textures. A local procedural environment probe supplies
PBR reflections. These original procedural surfaces add no external asset or
decoder dependency. Existing licensed Kenney scenery remains in use.

Racer, Pixel and Utility appearances now have constructed frames, motors,
batteries/straps, cameras, antennae, power leads and front/rear markers. Quality
adds motor winding and fastener detail; simpler presets retain recognizable
silhouettes. Cosmetic selection survives preset changes. Rotor phase follows
elapsed simulation ticks and throttle. Actor rotor, limb and wheel presentation
uses simulation time without moving gameplay bodies.

## Preparation and lifetime

Both hosts prepare shaders after scene content is loaded and before enabling
arming or demonstration playback. Changing graphics or aircraft safely pauses
flight and requires explicit resume. Revision tokens reject stale preparation
after another quality, aircraft or course selection; disposal and abort prevent
late completion from re-enabling a departed flight. Shader link errors remain
visible failures instead of silently allowing a blank flight view.

Shared textures are explicitly disposed before changing immutable GPU storage.
Scene replacement releases geometry, materials, instancing resources, imported
assets, shadow targets and environment targets. Renderer resource counters are
diagnostic counts, not measured VRAM or sustained performance.

## Verification and remaining work

The functional GPU fixture uses actual imported scenery and fixed-step v1/v2
flight snapshots across eight worlds, three presets and FPV/chase/overview
views. Its receipt records source hashes, browser identity, GL errors, resource
counts over repeated rounds and shader preparation lifecycle cases. The first
run detected two unreleased GPU textures per complete eight-world cycle. The
cause was a shared shadow-material uniform retaining a disposed world's map.
Source-owned depth materials keep that uniform inside the visual asset lifetime;
the pinned vendor implementation remains unchanged.

The corrected run passed all 14 checks: 216 world/preset/view configurations,
stable repeated resource counts, an actual three-primitive GLB (opaque textured,
untextured and alpha-masked materials) with three stable replacements, and all
preparation/abort/disposal cases. No GL errors, unexpected context loss or console
errors occurred. The browser reports Chromium 154, WebGL 2 and a 1280×720
viewport at DPR 2; its generic renderer identity does not identify a qualifying
physical desktop or mobile device.

Disposal leaves zero registered scene resources and releases the WebGL context.
The pinned renderer's diagnostic texture counter still reports its shared DFG
lookup texture; four internal placeholder allocations are also context-owned.
This is not a claim of zero internal texture counters or measured VRAM usage.

Source-bound evidence is in
[`fpv-graphics-browser-20261001.json`](evidence/fpv-graphics-browser-20261001.json).
Serve the repository and open
[`fpv-graphics-browser-harness.html`](evidence/fpv-graphics-browser-harness.html)
to reproduce the checks against its recorded renderer/model hashes. It refuses
to qualify changed source bytes; update the snapshot explicitly for a new
candidate. This is a manual functional qualification fixture, outside the
runtime packages and deferred unit suite.

Frozen candidate `5eea46503e987e9686ab77433531a9c375aeb32e` passed all three
optional-package admissions, committed-input checks, two byte-identical builds
and ZIP-member verification. See
[`fpv-graphics-package-20261001.json`](evidence/fpv-graphics-package-20261001.json).
Academy remains 62 runtime / 64 source files; World Studio remains 94 / 96.
No package ceiling changed. The local development playtest at
`dist/fpv-graphics-foundation-playtest` contains 87 files / 12,379,796 bytes,
ZIP SHA-256 `8bdd6be65b803ce0bebd8377d16e977dbba093ab580d591fc4c0a45ec8e553b0`.
Admission remains `publicEligible: false` pending the separate release gates.

Player-interface checks cover World Studio preset and drone changes, safe paused
resume, all three hangar appearances and Academy demonstration launch. A rapid
Performance → Racer → Quality → Pixel selection sequence kept an active flight
paused and left Arm / resume enabled once preparation finished. Inspection opens
at the front so the camera, nose markers and Utility propeller guards are visible.
New unit coverage
is deferred to R7. Physical radio, five novice-player sessions and named desktop
and mobile sustained frame-time/memory qualification remain outstanding.

Next graphics increments must select and license optimized material resources,
polish the hangar/meadow, courtyard/woodland, warehouse/stadium and yard/garage
batches, and reduce expensive scenery draw calls where measurements justify it.
The procedural foundation is not a claim that those art or performance goals
have already passed.
