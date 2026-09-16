# Couch race formats and Campaign Tour

This internal P07 candidate extends the [retained-Results Next transaction](retained-next-results.md) on source `1f3b9995af43879d54fb7b0053846f0723e2e069`. Its [bounded verification record](verification/cross-mode/p07-campaign-tour/README.md) covers source and modeled-host tests. Native navigation, current-P02 composition, public delivery and full P07 acceptance remain open.

## Player choices

Race setup offers three session-only formats. Choosing a format prepares a fresh attempt; it does not alter a live round or Solo progress.

| Format                 | Result and next action                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **One race** — default | Finish one round, including a draw. Rematch names the same mission. Its new score starts only when the prepared rematch is adopted.                                                        |
| **First to two**       | A win earns one round point; a draw earns none. Next round repeats the named mission until one player has two wins. Rematch match then prepares a new series.                              |
| **Campaign tour**      | Play the exact campaign's authored missions in order. Each mission winner earns one tour point. Next names the following mission; the last result offers Choose campaign without wrapping. |

Selecting Campaign tour starts at the chosen campaign's **first** authored mission, even if Race setup previously selected a later map. The setup note names the campaign, number of missions and first mission before Start. A tour does not combine adjacent map-menu entries from different campaigns.

Tour Results also offer a named Rematch of the current mission. The earlier mission point remains visible during preparation and play. Finishing the rematch replaces that mission's result: a different winner transfers its point, and a draw removes the earlier point. Reopening Results or viewing the picture never grants another point. Choose campaign uses the existing setup confirmation; it does not download or choose another campaign automatically.

## Preparing the next mission safely

Next and Rematch retain the completed duel, result text, totals and picture while preparing a separate candidate. Decode failure, cancellation or changed installed ownership keeps that result available to View and retains the captured target for retry. A retry cannot silently substitute another campaign or a same-named map.

Adoption publishes the exact mission recipe, duel, picture and progression cursor before retiring the old picture. The accepted in-memory round identity can finish only once. A secondary Rematch may transfer its still-owned action focus to the primary Start control, but newer focus, another screen, backgrounding or cleanup callbacks can veto automatic Start.

Shipped content keeps the existing explicit-action handoff when that gesture still owns adoption. [Installed originals](couch-installed-chapters.md) instead become **Ready** after final confirmation and need a fresh Start. Returning to the tab or finishing picture decoding does not start an installed mission. These differences do not change pause, saved continuation, core rules, replay versions or Solo awards.

## Authoring and implementation boundaries

`game/couch/couch-progression.mjs` owns in-memory format, authored order, accepted round identity and displayed tour/series totals. The host supplies real terminal duel outcomes. The progression owner does not step a simulation or write profile data.

The host uses shared frozen campaign identities for shipped rows and exact checked identities for installed rows. The installed reader publishes each owner's authored order; refresh replaces its checked row objects. If an owner disappears, its previous selection may remain visible as unavailable, but that placeholder is not a new valid tour. The player must restore the owner or select current content.

A campaign uses one supported simulation version. Board dimensions belong to that version: a 48-cell legacy map and a 72-cell wide map cannot be mixed into one tour. Vary routing, obstacles and originals within the campaign's legal grid. Explicit setup changes between campaigns handle different cores and dimensions; these are separately tested.

The complete nine-file command is recorded with exact source and runtime hashes in the evidence archive. Current tests use real input, simulation ticks, media bytes, chapter readers and pointer transactions with bounded DOM, image-decode and IndexedDB models. They do not establish browser pixels, storage durability, physical-controller comfort or public readiness. Use the [authoring examples](../authoring/prompts/couch-native-chapters.md#campaign-tour-and-rematch-qualification) for future extensions and keep failed evidence alongside corrections.
