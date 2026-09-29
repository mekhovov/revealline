# Field Kit Team feedback

Four original 32×32 transparent badges complete the produced artwork family for `team.effect.support`, `slowed`, `rescue` and `recovery`. They share the radio-anchor palette, dark outline and crisp pixel construction. These are original code-authored icons, not sampled Xposed or community artwork.

| Role     | Silhouette                                   | Meaning and limits                                                                                                                      |
| -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Support  | Transmitter and detached stepped signal bars | A short pulse at the stored origin; may hit nothing. No Scan sweep or damage claim.                                                     |
| Slowed   | Braced hourglass                             | Temporary slowdown on an affected active enemy, including a stationary enemy. Keep the SLOWED caption; no literal timer, pause or stun. |
| Rescue   | Linked round/diamond partner shapes          | Held rescue by the active helper. Keep target/progress cues; no completion or reward claim. Do not reuse for joint-capture artwork.     |
| Recovery | Four-arm craft in a tapered badge            | Revived-player grace from any revival cause; not hunter cooldown or a shared-reserve reward.                                            |

## Reproduction

Run `node scripts/produce-team-feedback-art.mjs --check` and `node --test scripts/test-team-feedback-art.mjs`. Generation without `--check` writes missing outputs only after preflighting the whole family. Existing unequal files reject regeneration. A changed source must use a new immutable family revision; never relabel cached drawing code or overwrite retained PNGs. `source.mjs` is the editable integer-pixel source; the manifest records exact hashes, occupied bounds, palette, dimensions, geometry, provenance and complete generation/edit prompts.

## Studio workflow

1. Open [the review page](./review.html) at native32 and displayed24 pixels, including grayscale/light backgrounds.
2. In Asset Studio select **Prepare Team effect slots**. Search `team.effect.`.
3. Upload each corresponding prepared PNG. Wait for preparation, enter real provenance, preserve centered geometry, then validate and stage.
4. Inspect Field context → Couch Team: Support pulse and Slowed enemies in both arenas; Rescuing Player1/2 and Player1/2 recovered in Relay Yard. Inspect reduced effects and an inactive initial scene. The badges may yield to functional cues when crowded.
5. Select all four roles and stage one coordinated collection. Save a local revision, export `.rltheme`, import and compare. Source PNGs and prepared derivatives must remain available with immutable history.
6. Treat the result as produced until the release review covers actual runtime adoption, representative imports, all affected viewports and applicable normal-play/offline journeys. Browser staging does not publish the public game.

Native candidate review confirmed all four active states in Relay Yard, First Connection Support and initial inactive behavior, with the real Studio painter and existing approved arena pictures. This is bounded art/authoring evidence, not complete P04/P08 or physical-device qualification. See the local release handoff for exact source and browser evidence.
