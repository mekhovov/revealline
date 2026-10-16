# Sim Snake Hunt

FPV World Studio adds **24 authored courses in four six-course chapters**: Open loops, Weave and return, Height changes, and Moving quarry. Every course supports Self-level and Acro; those are two control modes for the same 24 courses, not 48 different levels. The existing flight physics, manual throttle and explicit Arm/Resume controls remain in use.

Choose **Snake Hunt** in the simulator catalogue or open one of its four playlists. Touch the numbered fictional humanoids to catch them. Ordered courses highlight the next target; touching another target leaves it available. Pulses cannot catch or damage these targets. The first course has no tail. Later catches grow a solid orange echo of the path already flown: avoid it, turn around it, or change altitude to cross above it. This is a three-dimensional flight variation, not the arcade's territory trail.

Hunt presentation controls share the arcade's `revealline.destruction.v1` and `revealline.encounter-display.v1` preferences. Brutal defaults Off. Clean catches, brutal fragments, and optional blood/body parts all use exactly the same targets, contact geometry, score and recorded inputs. **Show enemy remains** hides settled parts and stains while keeping brief catch feedback. Reduced motion suppresses flying cosmetic fragments; the solid gameplay tail remains visible under either choice. Physics pauses and presentation poses freeze with recorded simulation time.

Links from the campaign hub:

- `optional-practice/fpv-worlds/index.html?snake-hunt=loops&lang=en` opens the Open loops playlist. Other chapter values are `weave`, `heights`, and `chase`.
- `optional-practice/fpv-worlds/index.html?snake-course=snake-hunt-loops-01&lang=en` prepares one course disarmed. Course suffixes run from `01` to `06`; `lang=uk` selects Ukrainian.

The criterion `hunt-contact-v1` lives inside separately identified `FlightCourse.v2` sources. Such courses select `civilian-world-hunt.v1`; historical courses retain `civilian-world-fixed.v2`. Catch history, echo samples and failure reason belong to the authoritative state and therefore the existing `FlightAttempt.v2` final-state identity, replay and paused recovery. The catalogue owns its own `fpv-snake-hunt:` pack identity. Existing Academy, world, adventure and Flight School source identities were compared directly to the branch base and remain unchanged.

The echo uses at most 64 solid links and 256 distance-spaced historical samples. Rapier checks it through the same swept movement path as other moving collision proxies. A 4.5 m neck gap in shipped courses avoids immediate contact with a newly created trail. Target populations are 3–10 per shipped course, within the existing 12-actor combat admission limit. Presentation has at most four bursts, 128 cosmetic fragments and twelve settled clusters; those meshes supply no collision data.

Verification is recorded in [the runtime observation](evidence/sim-snake-hunt-runtime-observation.json) and [its portable course/input proofs](evidence/sim-snake-hunt-flight-proofs.json). Direct initial construction admitted all 24 courses in both modes. Recorded production-model inputs completed the first actual course with three swept catches; replay reproduced the final state. Another actual course produced an echo-tail failure and reproduced it both by replay and by recovering tick 700 paused, then consuming the remaining recorded inputs. Separate bounded observations show pulse immunity and preservation after wrong-order physical contacts. These are scripted observations, not a test-suite pass or human-pilot approval.

The optional package built in memory with 97 files and 14,307,419 bytes, below the existing 104-file / 16 MiB policy. This includes the shared remains preference module. The legacy Academy package does not import the new Hunt catalogue or presentation adapter. No package was published by this work.

Seven meaningful regression cases were authored in `game/test/fpv-snake-hunt.test.mjs` but remain **WAIVED_SKIPPED_NOT_PASSED** under the repository suite waiver. Full-course human playthroughs, Acro completions, unfamiliar-player readability, medal tuning, physical controller qualification and low-end device performance remain unqualified. The route-distance medal estimates are provisional.

Design references: Google's [Snake variation](https://blog.google/products-and-platforms/products/maps/sssnakes-map/) combines collection with avoiding one's own path. Rapier's [shape-casting documentation](https://www.rapier.rs/docs/user_guides/javascript/scene_queries/) supports checking whole moving shapes against contacts; the game continues using its existing pinned backend rather than a proximity-only collection shortcut.
