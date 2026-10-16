# Regional Library entry — first installed preview

The normal SIM Library and mission chooser now offer one explicitly labelled regional preview. Download verifies and saves its immutable descriptor, both manifests and all scenery dependencies through the separate regional store. Download never starts a flight. The subsequent Fly action loads the selected exact saved descriptor identity with cache-only source reads, then enters the existing shared production flight presentation paused and disarmed.

## Scope and source

- Urban earthworks: 384 × 384 m, original architectural blockout, unscored free flight. This is an early regional preview, not a final art-quality or unlimited-world claim.
- Immutable source commit: `9d97e70c18729c3f399b90610380274e50d7d0df`.
- Descriptor: `authoring/fpv-worlds/regions/urban-bando/delivery-review-r1/delivery.json`, 6,615 bytes, SHA-256 `1ba27d2242d61d61c0552564d75baa5f3e313e63a78c2ef434f63cdc7dbab94c`.
- Exact payload: 38 files / 1,455,090 bytes (two manifests and 36 geometry assets).
- Regional records remain separate from scored WorldPack courses, World.v1 coordinates, recordings and proofs. No flight equation, collision policy or scoring threshold changes here.

## Interaction and recovery

Both English and Ukrainian provide download progress, explicit Fly, refresh and reviewed removal of all saved revisions. Removal uses the reviewed store generation. Failed downloads retain existing revisions. Navigation invalidates pending launch intent; a completed atomic install remains saved even if the user leaves during its commit. Cancellation never deletes existing data. Read-only operations can be cancelled without a late launch; the storage commit itself reports its actual outcome. Error messages are localized and actionable, without exposing implementation exceptions.

Scenery installation and simulator offline preparation are distinct and the Library explains this. Runtime offline availability still requires the existing separate preparation flow. Installed source loading has no network fallback. The first regional preview uses the previously verified continuous residency, atomic geometry adoption, renderer prewarm, shared input/camera/pause and safe recovery lifecycle.

## Verification

- Native Library interaction harness passed 6/6 checks: download without launch, exact-revision Fly, cancellation of pending source load, invalidation of an asynchronous host launch lease, generation-guarded removal, retained commit after navigation, and locale refresh (the first case combines download and Fly). The normal saved Fly path still opened paused and disarmed after the lease fix.
- Scoped lint and syntax checks passed. The real regional host verifier passes installed-identity validation plus both existing flight modes, deliberate arm, pause, reset, source failure/recovery and disposal.
- Normal discovery also passed: fresh Home → Explore worlds → Regional free flight card → Fly opened ready to arm at 3 m / zero input. No direct fragment URL was required.
- Native source browser at port 9042 downloaded the actual immutable remote 38-file payload, displayed Saved, and entered Fly at 3 m with zero input and disarmed. Explicit Arm plus keyboard flight produced climb and drift; Space pause, Chase camera, shared pause menu, reset and Acro mode change worked. Reset and mode change returned to 3 m / zero input / disarmed. Reload retained the saved region.
- Native 390 × 844 Ukrainian viewport: saved Fly worked, document width 390 px without horizontal overflow; removal review then Keep retained the region. This is an emulated viewport, not iPhone or controller hardware qualification.
- Source-only review has an unrelated existing generated catalogue worker absent from the source server; immutable package verification is required separately and must not be inferred from this source review.
- Current portrait flight header wraps to two rows and leaves excessive top space; further responsive flight-shell refinement remains. Initial blockout appearance is not final scenery quality.

## Delivery envelope

This focused UI adds one explicit runtime module after the separate delivery module. Current World SIM closure is 146 runtime paths, 156 manifest dependencies, 157 runtime ZIP members and 159 source ZIP members. Raise the reviewed source member cap from 158 to 159 after the indexed scenery module; retain the 20 MiB byte cap. Main distribution and optional distribution both list the exact new module. These are structural counts, not a claim that a cloud archive has already passed. Exact candidate packaging and offline qualification follow publication.
