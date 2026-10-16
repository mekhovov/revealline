# Team pilot presentation slots

Two seats × six actual states × two treatments yield 24 optional slots:
`team.pilot.p{1|2}.{normal|cutting|downed|crawling|rescuing|recovery}.{compact|detailed}`.
Compact bodies are 32×32; detailed bodies are 64×64. Shared geometry declares the frame, occupied bounds, pivot and exactly four bounded motor hubs. These are cosmetic dimensions, never collision geometry.

The default `team.pilot.v1` recipe explicitly inherits the matching shared Scout. Historical collections without these slots retain their previous Scout behavior. An advertised custom image must decode at the exact size and have valid prepared geometry. Invalid custom data rejects the new painter snapshot before adoption; it cannot silently fall back. The shared release host prepares every registered pilot image, including currently inactive states.

The painter selects the real seat/state/treatment. Player numbers, identity shapes, contact outline, active cut, rescue target and recovery grace remain game-owned. Downed and crawling rotors stop; decorative body changes cannot create abilities or change timing. Reduced effects keeps all role cues. A body image excludes baked propellers, numbers, labels and glow.

## Studio review

1. Open a saved collection and choose **Add Team presentation slots** when offered. Historical revisions remain immutable.
2. Filter by the selected pilot slot. Native preview shows its actual image, or explicitly identified Scout inheritance for a recipe. Upload a correctly sized transparent PNG; review pivot and all four rotor anchors before saving.
3. Select **Couch Team**, **Relay Yard**, and the scene below. Preview both compact (canvas below 480 CSS pixels, or Microtile treatment) and detailed rendering. The scene caption identifies when the selected state/size is inactive. Solo/Versus cannot claim a Team-state preview; choose Native or Team.
4. Inspect actual size, magnified pixels and real placement; use the sprite editor for bounded single-layer edits. Save, reload, export and import. Verify source and prepared bytes, history, geometry and immutable binding revisions.
5. Compile the exported collection and load it through the shared release host. Verify decoded images and actual painter selection; Studio previews alone do not prove release loading.

| State    | Relay Yard scene              |
| -------- | ----------------------------- |
| Normal   | Ready to fly                  |
| Cutting  | Active cuts                   |
| Downed   | Player N downed               |
| Crawling | Player N crawling             |
| Rescuing | Rescuing the **other** player |
| Recovery | Player N recovered            |

Crawl scenes are earned at tick 495 by real public commands. The prior sample is also earned, protects its actor data from caller mutation, and borrows the current attempt’s level identity for painter adjacency checks. Team core level data aliases mutable actors, so prior-state comparisons must use sampled actors rather than level actors. Reset/loop resamples the correct attempt without replaying a long seek each frame. No player save or simulation state is written by the painter.

## Acceptance boundary

These slots and fixtures are authoring/runtime support. Recipe coverage is not proof of 24 finished production sprites or a complete edition. QA PNGs must not be published as approved artwork. Release acceptance also requires ordinary game routes, finished artwork, all six source gates, frozen-byte verification, public play and separately recorded physical-device checks.

## Prepared download recovery

Export requests the download and retains one visible link labelled with the exact prepared filename/revision. If a browser does not start the asynchronous automatic download, use that link. Later edits do not change the prepared file: export again to prepare another revision. Failed preparation keeps the prior link; successful replacement releases its old object URL. Normal page exit releases the URL; cached-page restoration keeps it usable. A requested download is never evidence of a completed export/import round trip.
