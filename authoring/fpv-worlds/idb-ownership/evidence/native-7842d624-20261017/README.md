# Bounded native observer evidence — frozen 7842

The root coordinator used the prepared `7842d6249217eade6d4ea5f7220b6dd8d4ff01af` diagnostic fixture once in the Codex in-app browser through CUA, on fresh loopback origin `http://127.0.0.1:50097`. Both transaction and explicit-close interception switches were enabled. This supplements the earlier source/package qualification; it does not change the product branch or qualify newer main.

The visible journey opened Library, refreshed saved regions, exported the observation, selected **Stop observing**, exported again, then returned to Library, refreshed normally and exported the stopped observation again. No map download/import, flight, reset, original public context access or hidden browser evaluation was used. The tab was closed afterward and the owned local server was intentionally stopped.

The three actual UI exports show five native opens, seven completed readonly transactions and eight trusted exact-zero reads: five `getAll` results and three empty cursor exhaustions. Five listing observations are empty in this fresh test origin; two session-only observations correctly remain unknown. There are no captured errors, refusals or dropped observations.

The Stop export differs only in nine fields: two stopped flags, owned retire counts 15→0 and 3→0, and five close-interception labels becoming `restored`. Pending requests and active transactions are zero. Other events, history and counters are unchanged. After the root's normal post-Stop Library refresh, the third export is byte-identical to the second. The screenshot visibly shows `stopped: true` and disabled Stop. These are reported restoration and continued visible operation; native method pointer identity was not independently inspected. The transaction-interception label remains historical after Stop.

The root receipt and independent export review agree on this narrow native empty-listing/explicit-Stop result. The three exports are distinct UI exports; the identical final pair is not independent image evidence or a new database-contents measurement.

## Limits retained

- Initial AX Library click failed with `Node does not have a layout object` during normal startup. The root inspected fresh UI state after the transition, without blindly repeating the click.
- Server output is truncated and contains the original favicon404. Intentional SIGINT ended the owned server with actual exit130; this is not a full HTTP pass.
- Native nonempty/skipped-cursor behavior, actual explicit-close-call capture, abort/failure paths and pagehide restoration remain open. Closing the tab does not prove pagehide teardown.
- Current-main combined qualification and the original affected public database contents, closer and cause remain open. There is no persistence repair, all-edition retention, offline/restart/eviction, public-flight, physical-device or endurance acceptance here.

## Evidence provenance

`ROOT-NATIVE-OBSERVATION-RECEIPT.json` is the unchanged root receipt. Its original file list binds the local source evidence. The exports, screenshot, stop intent and final server-closed record are included unchanged. `server-intent.public.json` and `server-tool-terminal.public.json` are explicitly identified public projections: they preserve original source byte/hash identities but replace the local fixture-root value and two local Python installation paths. Original raw files remain retained locally; the projections are not byte-identical copies of them.

The source/package and 178-production-file/five-authoring-module fixture identity are retained in parent evidence commit `eb942fc857044ffd1647af521b3bd7c48ed20d4d`. The independent review reads only these existing reports; it runs no browser, player database, source tests or new package qualification. Product PR #1545 remains a separate Draft, with current integration and all remaining gates requiring explicit evidence.
