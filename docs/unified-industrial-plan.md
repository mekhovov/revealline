# Unified gameplay and industrial art — implementation register

Updated 3 October 2026. This register follows the approved hybrid Broforce/Factorio direction and the subsequent authorization to increase budgets. It describes this review branch, not a public release. Earlier dated delivery registers remain historical evidence.

## Required work and current boundary

| Priority                         | Implemented in this branch                                                                                                                                                                                                                                                                                                                                 | Remaining acceptance                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local character behavior         | Versioned Capture/Team pursuit v2: ordinary Sprinter, committed Refuge, warned Switchback and coordinated Rendezvous. Native SIM pursuit v1 adds six finite-population courses in two flight modes, routes and Studio editing.                                                                                                                             | Human completion/interception review, historical device recordings and controller qualification. Structural admission is not a completed play route.                            |
| Local UX and shared presentation | Snake uses the shared board artwork provider. Existing main-menu, briefing, explicit Start, play, Pause and Results remain authoritative. The private-room host now follows the same shell with native input/HUD.                                                                                                                                          | Cross-device fullscreen, enlarged text, touch ownership and gamepad review across every host. Native flight arming remains native.                                              |
| Art A/B and first C specimens    | Tracked inventory; bounded animation descriptor and image-atlas asset v2; shared decoded-memory pool; Asset Studio advanced authoring; four original procedural silhouette/animation specimens; car/tank and concrete/earth/metal samples; shared drone/body and three defeat previews; a twelve-frame original atlas; six shared-mixer listening samples. | Capture access, broader native/device/offline review and artistic approval. Terrain/audio and the multi-frame sample are implemented; the treatment is not production-approved. |
| Multiplayer recordings           | Terminal native Capture Team/Versus export and reconstruction, including consumed commands, ordered releases, full terminal-state digest and exact build/ownership metadata.                                                                                                                                                                               | Exact command/provenance/result verification, native pilot clear evidence and historical compatibility. See the pursuit-pilot README for the accepted one-round scope.          |
| Private-room consistency         | Successor control/snapshot contract, native equipment, fresh steering, Boost/Support, bounded cosmetic journal, shared shell/audio/reactions/destruction and silent reconnect.                                                                                                                                                                             | Latency/reconnection/backgrounding/device review and a configured HTTPS service. A local service is not hosted multiplayer delivery.                                            |

## Art phases

A. **Inventory/specification:** `qualification/industrial-art/inventory.json` inventories 603 tracked game visual files, 575 authoring visual/model files and three optional-practice visual files at the recorded baseline. Hashes and bytes preserve provenance. Keep/Refine tags are mechanical triage, not an artistic review of every file. Authored photographs, Company/custom bindings, vendor material and retained revisions are kept intact.

B. **Shared animation/assets:** `revealline-actor-animation.v1` is bounded data: identity, revision, approved rig/parts, material, anchors, atlas frames, clips and compact fallback. Asset v2 admits image atlases only, with the same frame dimensions and pivot as admitted geometry. Direct Team enemy slots accept admitted asset-v2 full-sheet images through the same frame contract; historical static slots still require their intact 32×32 image. Generic enemy rendering selects observed idle/move plus native pressure/hunter warning, committed and recovery clips, claimed-rover/eroder warnings and contour blocked states. The presentation clock restarts on a state change and freezes with native pause/freeze. Notice/caught remain Studio-only for these generic actors; aim/fire are never inferred. Hunt soldier rigs sample native states directly. Custom descriptors cannot change AI, collisions, vulnerability, objectives or sound timing.

C. **Playable review sample:** open `authoring/industrial-art-review/`. It compares released and candidate Runner, Courier, Guard and Shield at actual 16/24/32 px, plus enlarged light/dark specimens. `artReview=industrial-pilot-v1` selects the candidate overhead art for that page session; it is not a saved preference or default replacement. With Military Field selected, utility-car/tank details and opaque concrete/earth/metal material samples use the shared adapter while preserving custom IDs/SHA and native hazard cues. Capture Team admits the same material frames; modern Snake uses concrete walls and Retro remains unchanged. Native SIM reuses the material pixels in existing concrete/grass/steel maps, retaining geometry and physical material rules. Six deliberate sound samples and bounded native footsteps/equipment/machine onsets use the existing shared mixer. The shared FPV/Retro body is retained. New native SIM models remain a separate review surface. No Broforce or Factorio artwork is copied.

The original machinery atlas contains twelve transparent 32×32 poses on a 128×96 sheet: 906 bytes transferred and 49,152 bytes decoded. Its complete `.rltheme` sample is 990,438 bytes and matches the published Studio’s 335-slot contract. Native workspace adoption and immutable parent transport are validated by the producer. The browser imported, staged, saved and reloaded the sample. Although the download-event adapter timed out, the actual exported file was found in Downloads and successfully re-imported; the twelve frames, seven clips and pivot were retained. A SHA-256 receipt records that external file. This is a technical sample, not a newly approved tank combat actor.

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
| FPV Worlds optional source/runtime envelope |                                16 MiB |                                                                    20 MiB | New original source inputs exceeded 16 MiB by about 52 KiB; the revised envelope admits the complete pinned source inventory.    |

These are ceilings, not preallocated memory or a quality setting that downloads everything. Actor originals and derived crops are accounted before decode, keyed by immutable bytes and geometry, and shared through leases. The final owner releases the image. A canceled last owner cannot make a late decode escape accounting. Studio actor image-asset previews and their output canvases use the same pool and release on disposal. Small fixed built-in fixture images still use the existing BoardPainter loader; the actor pool is not a whole-page or GPU-memory measurement. Unrelated media-store, image geometry, effect and custom-model limits remain unchanged.

Committed Worlds package at `fb4815ff3`: 105 runtime files /15,626,030 bytes; 98 original inputs /16,829,790 bytes. Academy contains 69 runtime files /4,357,687 bytes. Both packages passed two reproducible builds, committed-input verification and ZIP membership verification. Final review-head receipts supersede these baseline measurements. These are package measurements, not FPS or peak-process-memory benchmarks.

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

## Next required items after candidate 02

1. Finish Phase C evidence: unlock the local Capture preview for Solo/Versus/Team observations; complete offload/interrupted-load review; review the material/sound samples and actual animation motion. Snake and SIM startup/Pause screenshots are recorded separately from human completion evidence.
2. Review and approve the visual treatment, then produce the remaining families, machinery, Team hardware and native 3D bindings in chapter-sized batches. Keep Company/custom ownership and compact fallbacks.
3. Complete the existing qualification matrices for historical recordings, private-room reconnects, controllers, touch and device performance. The required recording and room source is present; public hosting and human acceptance are not implied.

The 390 px review page is measured at its actual CSS width with no horizontal overflow and native-size canvas specimens. 320/360 px and physical-device play qualification remain open. No additional budget increase was needed for candidate 02.

The existing published-production continuation also needs reconciliation: its exact additive Team migration guard rejects 54 newer picture slots. The new sample deliberately targets the published Studio slot contract. Production approval is not rewritten to make this check pass.
