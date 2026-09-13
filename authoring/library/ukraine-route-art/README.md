# Ukraine Atlas — Route Choices picture candidates

Three original generated still-picture candidates for the existing Route Choices map roles, held as source artwork. They contain no movies, audio, story bindings, new map geometry or game configuration. No pack, installed catalog, saved flight, Collection receipt, build or release is changed.

| Candidate               | Existing role only                                                                                                | Preserved original                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Two Lanes, One Forge    | `route-choices-foundry` / Scout: two exits around the barrier                                                     | [PNG](originals/two-lanes-forge.png)         |
| Crosswind Market Depot  | `route-choices-depot` / Light carrier: prepare supplies or take the longer western route                          | [PNG](originals/crosswind-market-depot.png)  |
| Carpathian Thread Relay | `route-choices-switchback` / Fiber relay: direct crossing or outer route; signal and cable limits remain separate | [PNG](originals/carpathian-thread-relay.png) |

These are visual parallels to the [existing chapter roles](../fpv-route-choices/README.md) and its [38 recorded routes](../fpv-route-choices/routes.json). Painted passages, railway tracks, bridge, people and antenna are scenery, not collision geometry, equipment, objectives or operational instructions. The proposed Ukraine Atlas interpretation is not registered to those FPV-authored identities. A future pack or managed assignment needs its own exact owner/theme binding and review.

## Original pixels and visual review

Exactly three built-in `image_gen.imagegen` generation calls produced these originals, with no reference images, edits or API/CLI fallback. All are opaque RGB8 PNGs at **1672 × 941**, approximately 16:9 (ratio 1.776833); the requested 1536 × 864 size was not returned. Original dimensions and metadata are retained without cropping, resizing, palette conversion, re-encoding or Python image edits.

The forge is **2,780,010 bytes**, the depot **3,107,900 bytes**, and the relay **2,926,966 bytes**: **8,814,876 bytes total**. Each fits the unchanged 4 MiB asset and 1920 × 1080 poster bounds. This does not establish an installed-pack budget, total catalog capacity or managed-store availability. Keep originals available through the eventual original-media backup path; do not enlarge caps to install the full catalog.

The actual returned images were visually inspected individually. The forge has a strong central warm workshop and two dark side passages. The depot has a distinct diagonal railway, foreground supply alcove, busy market and open gate. The relay contrasts a close loom and wool with a broad misty mountain view, footbridge and ridge path. Navy/blue shadows and amber light connect the set; each contains detailed materials worth revealing.

These are generated pixel-style illustrations, not certified hand-authored pixel grids or indexed palettes. Dense foliage, wool, rail and cobble details need real active-trail/actor and partial-reveal checks before gameplay use. The depot contains tiny notice-like marks despite the no-lettering prompt; no legible wording is relied upon. The dramatic mountain relief, bridge structure, craft garments, tools and textile patterns are fictional interpretations rather than authenticated geography, working mechanisms or museum reconstructions. Additional painted animals and distant buildings are incidental scene details.

## Cultural sources and provenance

Pyrohiv's description of the Novi Sanzhary forge supports the red-clay timber construction, projecting reed roof, hearth, bellows, stump-mounted anvil, hanging tools and repair-work theme. The generated workshop is invented and does not reproduce the museum building or a maker's stamp. [National Museum of Folk Architecture and Folkways of Ukraine](https://www.pyrohiv.com/exponat/kuznya-iz-selishcha-novi-sanzhari).

A university account of a firsthand visit to a Yavoriv weaving workshop supports sheep-wool yarn, wooden handlooms and restrained geometric textiles. No named artisan's work or portrait was supplied to generation, and no traditional symbolic meaning is assigned to the invented pattern. [Chernivtsi National University field report](https://art-deco.chnu.edu.ua/novyny-kafedry/ekspedytsiia-do-sertsia-hutsulskoho-lizhnykarstva-an-expedition-to-the-heart-of-hutsul-lizhnyk-making/).

The railway operator's Kyiv heritage-rail page describes a railway museum, depot visits, a restored steam locomotive and manual hand trolley. These inform broad transport details only. The market, town, architecture and rail alignment are fictional, without a claimed station, locomotive type, date or incident. [Ukrainian Railways heritage-rail page](https://dytiacha.uz.gov.ua/kyiv).

All three primary pages were read on 13 September 2026. Only descriptive facts informed the prompts; no external photographs, museum objects, artwork or source-game images were downloaded or supplied to generation. New generation is documented provenance, not a legal opinion about exclusivity or a license certification. The preserved PNGs retain their tool-supplied metadata.

[prompts.json](prompts.json) contains the complete effective prompts and the explicit adaptation of the existing Atlas template. [generation-results.json](generation-results.json) identifies the preserved tool paths, actual output dimensions and hashes. [provenance.json](provenance.json) separates cultural facts, creative choices, original bytes and visual observations. [verification.json](verification.json) records file pins and full bounded RGB scanline checks.

## Verify without changing images

From the checkout root:

```sh
node authoring/library/ukraine-route-art/verify.mjs
```

The read-only verifier checks exactly three preserved PNGs, full chunk CRCs, bounded decompression, all RGB filters, pixel digests, individual media limits, prompt identities and pinned source context. It does not start a server, generate or modify pixels, validate a pack, simulate a route, install media or publish anything. Its initial `--record` mode refuses an existing report.

Before integration: review the illustrations and regional motifs, explicitly choose owner/theme identities, inspect actual browser decoding and game contrast at partial/full reveal, preserve earned/saved choices and original backups, then check combined storage, optional distribution and offline behavior. No physical-device, browser, animation, audio, playability or public-release acceptance is asserted by this source batch.
