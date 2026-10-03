# Unified gameplay and industrial art — implementation register

Updated 3 October 2026. This register follows the approved hybrid Broforce/Factorio direction and the subsequent authorization to increase budgets. It describes this review branch, not a public release. Earlier dated delivery registers remain historical evidence.

## Required work and current boundary

| Priority                         | Implemented in this branch                                                                                                                                                                                                                                               | Remaining acceptance                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local character behavior         | Versioned Capture/Team pursuit v2: ordinary Sprinter, committed Refuge, warned Switchback and coordinated Rendezvous. Native SIM pursuit v1 adds six finite-population courses in two flight modes, routes and Studio editing.                                           | Human completion/interception review, historical device recordings and controller qualification. Structural admission is not a completed play route.                                        |
| Local UX and shared presentation | Snake uses the shared board artwork provider. Existing main-menu, briefing, explicit Start, play, Pause and Results remain authoritative. The private-room host now follows the same shell with native input/HUD.                                                        | Cross-device fullscreen, enlarged text, touch ownership and gamepad review across every host. Native flight arming remains native.                                                          |
| Art A/B and first C specimens    | Tracked inventory; bounded animation descriptor and image-atlas asset v2; shared decoded-memory pool; Asset Studio advanced authoring; four original procedural silhouette/animation specimens; car/tank surface specimens; shared drone/body and three defeat previews. | Complete Phase C terrain/audio/native scene review, complete Studio evidence packet, then artistic approval. This is a partial playable sample, not the approved full production treatment. |
| Multiplayer recordings           | Terminal native Capture Team/Versus export and reconstruction, including consumed commands, ordered releases, full terminal-state digest and exact build/ownership metadata.                                                                                             | Exact command/provenance/result verification, native pilot clear evidence and historical compatibility. See the pursuit-pilot README for the accepted one-round scope.                      |
| Private-room consistency         | Successor control/snapshot contract, native equipment, fresh steering, Boost/Support, bounded cosmetic journal, shared shell/audio/reactions/destruction and silent reconnect.                                                                                           | Latency/reconnection/backgrounding/device review and a configured HTTPS service. A local service is not hosted multiplayer delivery.                                                        |

## Art phases

A. **Inventory/specification:** `qualification/industrial-art/inventory.json` inventories 603 tracked game visual files, 575 authoring visual/model files and three optional-practice visual files at the recorded baseline. Hashes and bytes preserve provenance. Keep/Refine tags are mechanical triage, not an artistic review of every file. Authored photographs, Company/custom bindings, vendor material and retained revisions are kept intact.

B. **Shared animation/assets:** `revealline-actor-animation.v1` is bounded data: identity, revision, approved rig/parts, material, anchors, atlas frames, clips and compact fallback. Asset v2 admits image atlases only, with the same frame dimensions and pivot as admitted geometry. Generic enemy rendering currently selects idle/move; the other named clips can be authored/previewed but are not claimed as universal runtime state integration. Hunt soldier rigs sample native states directly. Custom descriptors cannot change AI, collisions, vulnerability, objectives or sound timing.

C. **Playable review sample:** open `authoring/industrial-art-review/`. It compares released and candidate Runner, Courier, Guard and Shield at actual 16/24/32 px, plus enlarged light/dark specimens. `artReview=industrial-pilot-v1` selects the candidate overhead art for that page session; it is not a saved preference or default replacement. Utility-car/tank details are review specimens only. The shared FPV/Retro body is retained. Native SIM models remain a separate review surface. No Broforce or Factorio artwork is copied.

D. **Full roster/machinery:** pending Phase C artistic approval. Extend the accepted treatment to all twelve families/36 appearances, six vehicle families and Team hardware. Do not multiply an unapproved style.

E. **Environment/campaign adoption:** pending the accepted material kit. Introduce chapter appearance packages without revealing concealed photographs or obscuring reward pictures, hazards and ownership cues.

F. **Qualification/recommendation:** pending measured phone/device/performance, offline, replay, Studio, audio and human review. The candidate is not the recommended appearance yet.

## Visual specification

- Overhead silhouettes face their authoritative heading; cosmetic movement never offsets the collision location. Accessories identify a family before color does.
- Runner: narrow body and light belt; Courier: angular offset satchel; Guard: broad armor and carried equipment; Shield: pronounced frontal plate and viewing slot.
- A restrained olive/charcoal/steel base uses warm wear highlights. Ukrainian FPV blue/yellow markings stay readable. Retain main theme tokens and typography.
- Use consistent upper-left highlights, dark contact outlines and transparent surroundings. At 16 px prioritize head/shoulders/accessory; 24/32 px add equipment and material wear.
- Soldier stride, notice, anticipation, blocked and recovery accents sample presentation time. Pause/Reduced effects suppress motion independently of gameplay.
- Clean, brutal without blood and bloody destruction use the shared cause/material recipes. Gore remains opt-in. Essential cues render above debris. The page-wide 128 transient pieces/four burst envelopes and 24 settled clusters per board are unchanged.

## Increased budgets and ownership

| Budget                                      |                              Previous |                                                                       New | Reason                                                                                                                           |
| ------------------------------------------- | ------------------------------------: | ------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------- |
| Decoded actor art per page                  | Declared 32 MiB, no common accounting | 64 MiB desktop; 32 MiB compact/coarse-pointer or reported <=4 GiB devices | A single pool reserves in-flight images, shares both boards and releases abandoned previews. Compact fallback remains available. |
| Core offline inventory                      |                                64 MiB |                                                                    80 MiB | Matching build and service-worker admission; finite headroom for new modules.                                                    |
| FPV Academy optional file count             |                                    72 |                                                                        96 | Shared presentation and discovery dependencies. Byte cap remains 8 MiB.                                                          |
| FPV Worlds optional file count              |                                   104 |                                                                       128 | Native route/pursuit and shared animation modules.                                                                               |
| FPV Worlds optional source/runtime envelope |                                16 MiB |                                                                    20 MiB | New original source inputs exceeded 16 MiB by about 38 KiB; the revised envelope admits the complete pinned source inventory.    |

These are ceilings, not preallocated memory or a quality setting that downloads everything. Actor originals and derived crops are accounted before decode, keyed by immutable bytes and geometry, and shared through leases. The final owner releases the image. A canceled last owner cannot make a late decode escape accounting. Studio preview lifetime uses the same pool. Unrelated media-store, image geometry, effect and custom-model limits remain unchanged.

Current mutable Worlds measurement: 105 runtime files /15,624,601 bytes; 98 original inputs /16,828,526 bytes; source ZIP 15,675,377 bytes. Exact committed-source package receipts supersede these preparatory measurements. This is not an FPS or peak-process-memory benchmark.

## Historical compatibility and ownership

New Capture generations use level.v14/core.v15/replay.v16 and Capture-Snake level.v15/core.v16/replay.v17. Team uses level/pack.v13/core.v15 and Capture-Snake level/pack.v14/core.v16. Historical helpers/saves default to v1, while new Varied preparation requests v2 explicitly. Native SIM uses FlightCourse.v3 / civilian-world-pursuit.v1; older flight courses keep their model. See `fpv-native-pursuit.md` for exact bounds and contact rules.

Presentation descriptors contain no executable code. Static asset v1 packages remain supported. Community/Company ownership and immutable dependencies remain authoritative. Imported recordings do not grant official progression or unlock rewards.

## Optional work retained

- Broader authored campaign promotion beyond qualified pilots.
- Media-bearing Community private rooms and explicit Company Versus editions.
- Room-scoped verified media registry and asset delivery.
- Hosted accounts, public matchmaking, challenges/ghosts and networked SIM.
- New destructible terrain, vehicle combat and environmental chain reactions.

## Verification and release discipline

Automated suites are explicitly waived by `publishing/test-policy.json`; relevant regressions are authored without running them. Mandatory lint, formatting, localization/content validation, projection checks, committed-source identity and package builds remain required. Manual checks are listed in `qualification/industrial-art/README.md` and native structural admission in `verification/native-pursuit-structural.json`. Neither technical admission nor an agent screenshot grants artistic or human-play approval.

Push reviewable PRs; do not merge or enable auto-merge. Phase C approval precedes mass art production. Independent local behavior, recordings and room corrections do not wait for that art decision.
