# Native-feeling play and real-world reference batch

Research and implementation review: **28 September 2026**. This supplements the
[current delivery plan](../plan-status-2026-09-28.md), not the frozen historical
rules or earlier observations. Findings are design evidence, not proof of fun,
retention, cultural authenticity or physical-device acceptance.

## Product decisions

1. **Make mastery and choice rewarding.** Research connects experienced competence
   and autonomy with enjoyment and desire to play again. For RevealLine, prioritize
   two genuinely different route choices, understandable failure, a useful next
   attempt and optional mastery. More enemies, violence or compulsory time spent
   are not substitutes. Keep difficulty changes, Skip and exit available; no
   streak punishment, artificial scarcity or mandatory grind is added.
   [Przybylski, Ryan and Rigby, 2009](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/2009_PrzbylskiRyanRigby_PSPB.pdf)
2. **Native feel comes from dependable interaction.** Valve's hardware guidance
   emphasizes controller completeness, input prompts and legibility. Apply these
   principles to the existing shell, retained configuration and action ownership;
   do not add another launcher or pretend browser tests establish Steam Deck
   verification. The separate Confirm correction and Couch-download owners remain
   responsible for those active changes.
   [Steamworks recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations)
3. **Scope browser-behavior changes to gameplay.** A running canvas should not open
   a pointer context menu accidentally. Text, forms, browser navigation, zoom,
   keyboard context menus and modified gestures remain available. Existing safe
   areas, install/fullscreen controls and reduced effects should be qualified,
   not implemented a second time. The new guard acts only on actual owned canvases
   while their host reports active play. Safari callouts that dispatch no
   `contextmenu` event remain outside this claim.
   [PWA app design](https://web.dev/learn/pwa/app-design),
   [contextmenu behavior](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event)
4. **Art must not hide the game.** Real photographs can reward discovery, but active
   trails, return ground and threat warnings still need outlines and contrast over
   both bright and dark detail. Evaluate actual compact sizes and reduced effects.
   Do not change collision footprints with decorative asset sizes.
   [Xbox accessibility contrast guideline](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102)
5. **Preserve choice between editions without bloating progression.** The newest
   candidates must retain changed predecessor missions in the unified library.
   They remain manual selections with their own owners; Next does not traverse a
   search result list or silently switch editions. Studio should expose registered
   candidates through its existing selector, not another screen.

These are applications inferred for this game. No source guarantees commercial
success or justifies claiming that our unfinished pacing work is complete.

## Real-world source board and admission decisions

Use specific objects, places and construction details. Do not assign invented
universal meanings to regional ornaments. References can inform new geometry and
original pixel art without copying someone else's photographs.

| Reference                                                                                                     | Useful visual/spatial idea                                                                                 | Rights and present use                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Middle Polissia woven rushnyk-curtain, КН-1504](https://honchar.org.ua/en/collections/detail/1962)           | Fine red/white bands, zigzags and diamonds: staggered contested bands rather than decorative safe landings | Museum page's license link is BY-NC 4.0 despite abbreviated visible wording. Reference only; image not bundled.                    |
| [Krolevets rushnyk, КН-9162](https://honchar.org.ua/en/collections/detail/1792)                               | Repeated woven bands with a contrasting focal area: distinct side routes around a central objective        | BY-NC link; reference only. Do not infer exact manufacture location from collection association.                                   |
| [Carpathian wooden tserkvas](https://whc.unesco.org/en/list/1424/)                                            | Tripartite plans, log walls and tiered roofs: linked chambers and offset openings                          | UNESCO description does not license every photograph. New layouts/illustrations only until each image is cleared.                  |
| [Pavo Pico](https://betafpv.com/products/pavo-pico-brushless-whoop-quadcopter)                                | Four ducted rotors, compact camera, battery/frame separation: readable original craft silhouette           | Product reference only, no copied photo, logo or endorsement.                                                                      |
| [Evoque F5 V2 frame](https://shop.iflight.com/Evoque-F5-V2-Frame-Kit-Pro1887)                                 | Thin plates, thick arms, camera and antenna mounts: workshop obstacles and actor facing                    | Product reference only; no manufacturer image permission assumed.                                                                  |
| [Rafts on Synevyr Lake](https://commons.wikimedia.org/wiki/File:Synevyr_Lake_rafts.jpg)                       | Two rafts, diagonal oars, reflected trees and calm water: asymmetry and progressive discovery              | **Bundled CC0 reference**, Jan Pešula, 2018. Exact small JPEG pinned; optional Studio underlay and download.                       |
| [Rivne countryside passage](https://commons.wikimedia.org/wiki/File:Countryside_Passage_with_Wildflowers.jpg) | A passage through tall plants: edge detail and a clear focal corridor                                      | CC BY 4.0: future use needs author/license/change notice. Not downloaded.                                                          |
| [Degas, Dancer in Ukrainian Dress](https://www.metmuseum.org/art/collection/search/436157)                    | A contrasting human focal silhouette and cloth movement                                                    | Museum identifies public-domain artwork. French artistic interpretation, not a documentary folk-costume reference. Not downloaded. |
| [Rough white plaster](https://polyhaven.com/a/white_plaster_rough_01)                                         | Weathered lime/plaster material for an original workshop palette                                           | Asset maps CC0 under [Poly Haven's license](https://polyhaven.com/license), not automatically every webpage image. Not downloaded. |
| [Fabric pattern 07](https://polyhaven.com/a/fabric_pattern_07)                                                | Coarse red/cream weave as a material study                                                                 | CC0 asset maps; generic cloth, **not** an authenticated Ukrainian ornament. Large pack not downloaded.                             |

Also shortlisted: [Kenney input prompts](https://kenney.nl/assets/input-prompts),
with [author usage guidance](https://kenney.nl/knowledge-base/game-assets-2d/using-input-prompts).
Use correct hardware prompts and adequate contrast if adopted; no pack imported
in this batch and no new controller-logo claims.

### Admitted photograph

Only `game/content-design/assets/real-world-r1/synevyr-rafts.jpg` is added:
960 × 540 JPEG, **124,649 bytes**, SHA-256
`3ca8b4caf48a016e2e9c59afb8bcce45d5e93451a82496f099b644fe37837de8`.
The adjacent README preserves the author, date, source revision, exact rendition
and file-level CC0 grant. This is a close view of rafts, not a mountain panorama.

Loading is deliberate, same-origin and bounded, with hash/header checks and normal
image decoding before acceptance. No external runtime image request, automatic
tracing, collision change, publication or gameplay-artwork replacement occurs.
The existing source/mission ownership tickets reject stale completions and retain
the previous reference on failure. A verified one-file download is available for
explicit reuse in existing local-image workflows. Optional-cache handling must
not download the entire Workshop package just to get this photograph.

## Consolidated implementation batch

Existing PR **#735** is the preparation umbrella for its own #730/#733 predecessors
and these compatible follow-ups. Keep internal changes independently reviewable;
do not create another PR per sub-item while the publisher's queue is occupied.

| Slice                  | Implementation                                                                                                                                              | Remaining acceptance                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Spatial v35–v37        | Eight successor mission redesigns already prepared, fair movement and effective-speed v37 first-return evidence                                             | Full strategic routes, integrated-source gates, public launch and human balance      |
| Prior-edition access   | Explicit v26–v37 predecessor mapping, adding 33 changed historical mission-editions cumulatively                                                            | Public selection, historical launch and same-owner Next                              |
| Studio discoverability | Twelve registered review editions in the existing searchable selector, exact Solo/Versus links, detached full-source inspection and stale-result protection | Actual built Studio import/apply/return flow and compact/controller navigation       |
| Playfield polish       | Context-menu guard shared by Solo, both Versus boards and Team; active pointer requests only, removable listeners                                           | Public browser/device verification; no Safari-only or physical-input claim           |
| Real-world reference   | Pinned CC0 Synevyr photo, explicit underlay/download, attribution and error handling                                                                        | Frozen-build load, installed-worker behavior, cancel/failure and public availability |

Do not append unrelated source after this batch is admitted/frozen. The one release
owner chooses the final base/version, runs the mandatory build/provenance and
artifact gates, then publishes and verifies the actual Pages snapshot. Public
default v25 is unchanged here; choosing a new default requires the remaining
spatial/balance acceptance, not just registering more candidates.

## Next compatible work and effort

1. Finish current-source full routes and reference dispositions alongside the
   queued batch: 1–3 engineering days for a bounded slice, then human review.
2. Evaluate one photographic reveal pilot and two original object-inspired
   compositions after their maps are accepted: 1–2 days, including contrast,
   progressive focal detail, provenance and media-size review. Studio reference
   availability does not count as completed gameplay art.
3. Complete installed/offline and keyboard/controller/touch continuity against the
   same frozen release: 2–4 days plus device access. Repair demonstrated failures
   without duplicating another owner's pending fix.
4. Continue complementary Team routes and whole-Journey pacing: 5–10 days per
   bounded workstream plus human playtests. Original P13–P15 remain open.

Effort is not a release-time promise. Disk pressure, release serialization and
physical/human evidence are real constraints. Longer automated suites remain
explicitly waived under the user's exception, never counted as passes.
