# FPV Front · Route Choices — Tactical

This is a **manual optional Tactical teaching/challenge pack candidate**, outside current campaign catalogs, build includes and default downloads. It combines the three distinct layouts from `b832f75e804d22d942b7b5df769f565a2da4e00a` with the three original illustrations from `422b4a8bef0ea6e64ae43ae9fd5dee76f35e8391`. The separate procedural demos and their proof fixtures are preserved. Only their README's depot timing cell is corrected: 1,687 immediate / 1,699 grid-center ticks, as the existing fixture already records.

The new pack is `fpv-route-choices@1.0.0`; its one campaign is `fpv-route-choices`, revision `1`, using the registered `fpv` theme and all seven unmodified class recipes. The chapter advertises **Tactical only**. The first source demo was direction-only Arcade; this new map deliberately omits that optional `arcade-actions.v1` descriptor so ordinary manual equipment is available throughout the chapter. The original Arcade demo keeps it. No new engine, primitive, schema, ability or registry entry is introduced.

| New map / recommended role               | Exact picture assignment                  | Existing route-choice lesson                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `route-choices-foundry` — Scout          | **Split Signal Foundry**, 2,765,609 bytes | Choose west or east around the center barrier after reading the interceptor warning. A stalled center cable receives a travelling line-hit front. Scout Scan remains available; it is not required to win.                |
| `route-choices-depot` — Light carrier    | **Crosswind Depot**, 3,136,739 bytes      | Collect at home and time a stun field for the crossing patrol, or take the longer equipment-free western gate and two cuts. The western relay is visible because the carrier has no Scan.                                 |
| `route-choices-switchback` — Fiber relay | **Signal Switchback**, 3,047,928 bytes    | Cross the signal band directly, or use an ordinary craft on the safe northern rim. Standard Fiber resists interference but retains the eight-second / 76-cell cable limits. Scan supplies information; no-scan also wins. |

These are three different playable wall layouts. Scenic lanes, vehicles and buildings are illustrations, not collision objects or authoritative depictions of a real airframe or incident. Full originals remain under [challenge-chapter-art](../challenge-chapter-art/), with exact prompts and generation observations. That provenance records the earlier unbound creation stage; this candidate's assignments and bytes are recorded separately in [distribution.json](distribution.json).

## Original bytes and budgets

All three opaque RGB8 PNGs are **1774 × 887**, exactly 2:1, and each stays below the existing 4 MiB image cap. Their combined original size is **8,950,276 bytes**. The pack embeds the same bytes as base64 with `fit: contain`; no crop, resize, recompression, derivative image or copied source-game artwork is produced.

The [pack JSON](packs/fpv-route-choices.json) is **11,949,780 bytes**, with **11,944,013 normalized JSON bytes**; its one-pack installed-library envelope is **11,944,058 bytes**. These fit the unchanged 24 MiB pack / 48 MiB installed-library limits. Adding it to all four original-world packs exceeds the installed limit and is explicitly refused. The test preserves the old library exactly; nothing is automatically evicted. Players must explicitly manage installed packs if their existing library lacks room.

No new music descriptor or finished track is included (`music: []`). The registered theme's existing procedural music behavior remains available. The pictures are still images; this chapter does not introduce video/story playback, runtime actor art, animation or a media-workshop assignment.

## Intended progression and limits

The authored Standard goals are 30%, 45% plus the western relay, and 48% plus the northern relay. Existing time-medal thresholds provide fixed grades. They are authored values, not a human difficulty certification. The successful controls do not require waiting for a patrol phase. A brief neutral input after a partial capture allows a deliberate fresh direction; the separate procedural-demo test checks a one-second stopped continuation.

Gentle is the existing separate `gentle-classic.v1` context: five lives, slower enemies and no time/cable limits. Its full campaign key and level revisions differ. The briefs explicitly distinguish Standard cable limits from Gentle; a Gentle route is not evidence that a Standard cable-risk lesson is complete. Foundry's captured side differs under Gentle, and the proofs retain those measured outcomes rather than copying Standard verdicts.

This candidate does not complete the broader Tactical mode, cargo delivery, human challenge/readability testing, physical-device validation or the 29-map production campaign. Actual pack import, level selection, earned-picture display, collection, backup, cold offline and small-screen presentation for these three assigned pictures remain browser gates before public integration. Existing successful browser checks of the procedural demos do not establish this new illustrated pack's host behavior.

## Reproduce and inspect

```sh
node authoring/library/fpv-route-choices/build.mjs
node scripts/verify-route-choices.mjs
node --test game/test/route-choices-chapter.test.mjs
```

The builder reads only pinned ordinary source files, validates the exact original theme/roster/scenarios, matches each PNG and prompt to its provenance, checks byte/header limits and derives the exact new pack. It compares the generated pack and distribution against their complete checked-in bytes. Generated JSON uses deterministic two-space serialization; source formatting is a separate step and must not rewrite the transport without updating its distribution.

The verifier re-executes all 24 preserved procedural-demo routes, then prepares the actual new pack through its real image boundary. The existing bounded PNG decoder verifies every chunk CRC, decompresses and reconstructs every RGB scanline, and records a pixel digest without creating an output image. Each resolved map must contain its exact assigned original PNG with contain fit.

[The new fixture](routes.json) records **38 actual full-campaign traces: 24 Standard traces (14 wins / 10 deliberate failures) and 14 Gentle wins**, totaling **30,540 simulation ticks**. All have real replay verification and serialized unfinished-prefix restoration followed by their complete remaining inputs. They use both immediate and grid-center steering. Explicit verifier requests require non-null pack and proof objects and cannot request output writes. Exact campaign, level, difficulty, roster, input, image and checkpoint identities are checked; no stored cell, actor, life, clock, result or continuation is fabricated.

The tests also cover manual Scout Scan in the new Tactical first map, unchanged equipment-free alternatives, the Standard signal/cable failures, distinct Gentle identities, original byte preservation, installation/export/import, budget refusal without eviction, current-build exclusion and rejection of altered art/policy/route identities/verdicts/saved evidence.

To create reviewed new outputs in an empty destination, use `node authoring/library/fpv-route-choices/build.mjs --write`, followed by `node scripts/verify-route-choices.mjs --record`. Both refuse existing outputs. Preserve earlier candidates before intentional revisions. No automatic install, catalog registration, public deployment or release publication occurs in these tools.
