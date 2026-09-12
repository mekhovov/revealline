# v0.14.0 frozen browser verification

Observed on 12 September 2026 using the frozen [v0.14.0 site](../../../releases/v0.14.0/site/game/) in the in-app Chromium browser. The source tag is `21dfaeed08df95e7cb1d0e20c28c39b3fd3364ee`. The server on port 8829 used the CLI extracted from this release's Git source archive. This QA origin was separate from the player's release on port 8767.

## Offline preparation and ordinary play

Settings → Prepare offline play reported all **127 files / 20,519,745 bytes** verified, with no missing or corrupt files. Build ID: `676d0bf4990099f7b8fd16bf6e15587202324680fcc6d8c320707e126014b910`. The visible details were preserved in [frozen-offline.json](frozen-offline.json), and match the independently rebuilt inventory in [integrity notes](integrity-notes.md).

After stopping only the 8829 server, a fresh navigation to `/game/` loaded v0.14.0 from the prepared cache. First Signal started with three lives, zero coverage and score. With Tap steering enabled, three actual Down/Up self-contact routes exhausted the lives. The final HUD showed 0:06 and the reader explained that the unfinished line crossed itself, suggested rejoining safe ground without crossing it, and said that Retry resets this reveal while keeping collected pictures and best results. Read/Done left the loss in place. Retry started a fresh three-life, zero-score, zero-coverage attempt at 0:00.

A continuous Down route then won with **52.2% coverage, three lives, 8,160 points and 0:03 on the HUD**. The full-picture celebration and Keep picture control appeared. Reloading offline retained one gold First Signal picture, First light, Clear skies and Golden line, and the first-clear appearances. Opening the saved picture and activating Play celebration worked offline. Local scores showed exactly one entry: Scout / Immediate / seed 1, **8,160 points / 3.75s / gold**. The rounded HUD and stored time are reported separately.

Screenshots: [loss reader](frozen-offline-loss.jpg), [saved picture celebration](frozen-offline-picture.jpg).

## First offline Playground load

The Playground had not been visited on this origin before the server stopped. Its first offline navigation loaded the authoring UI and real game preview. A complete, prevalidated Round 24 `boss-lane` Grid + buffer practice scenario was pasted into Complete pack JSON and applied. Apply changed the editor; the existing preview remained First Signal until the explicit **Play configuration** action. No runtime state or terminal result was injected.

After Play configuration, the actual Compact preview was **320×640 CSS pixels**, with one life, a 100% target and two required relays. Start, Right for about 250ms, Stop and a roughly 2.9s wait produced a real marked-lane failure at HUD 0:02. The loss reader contained the cause, the useful next step and the complete practice consequence: Retry starts this practice again, resets the reveal and grants no campaign rewards. Read/Done did not retry. Try again reset to one life, zero coverage, zero score, HUD 0:00, two uncollected relays and SHIELD RELAY. The short phase clock had naturally advanced to 0.8s when inspected after the click.

The [compact practice screenshot](frozen-offline-practice.jpg) records the reader. A subsequent main-game reload still showed the single 8,160 / 3.75s score; the practice attempt added no score. Both the frozen solo and Playground pages returned empty error/warning logs after these journeys.

## Player release and scope

The player-facing [v0.14.0 game](http://127.0.0.1:8767/releases/v0.14.0/site/game/) has all six bundled expansions installed through Library → Expansion packs and is ready on Sentinel Relay with three lives, zero coverage, zero score and HUD 0:00. No QA scores, practice scenarios or forced progress were imported into that release profile. Earlier independently playable releases remain available.

Together with the [source browser checks](source-browser.md), [candidate checks](candidate-browser.md), [1,439-test source gates](source-gates.md) and independent archive rebuild, this verifies the described browser behavior. It does not certify physical phones/controllers, native distribution, a public deployment, player comprehension, retention or perfect game feel. Offline availability depends on the browser retaining its prepared storage. The workspace server on port 8767 was not stopped.
