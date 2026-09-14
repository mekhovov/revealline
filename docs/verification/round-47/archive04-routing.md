# Archive04 delivery and v0.39 routing

Archive04 now serves the original **v0.36.0 and v0.37.0** sites. The v0.39 source allocation appends these two mappings and preserves all three earlier shard definitions. It leaves frozen v0.38 retained; the later v0.39 freeze adds the new retained edition. This source change has not deployed the main site's forwarding pages.

| Check                          | Observed result                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Archive04 public artifact      | 607 files / 429,334,701 bytes; three hidden files                                       |
| Original canonical payload     | 602 files / 429,319,211 bytes, including unchanged release records and original workers |
| Generated archive indexes      | Five files / 15,490 bytes                                                               |
| Archive budget                 | 800,000,000 bytes; 370,665,299 bytes available                                          |
| Main v0.39 capacity projection | 748,507,125 bytes; exact v0.39 build still required                                     |

The canonical links are [v0.36.0](https://mekhovov.github.io/revealline-archive-04/releases/v0.36.0/site/game/) and [v0.37.0](https://mekhovov.github.io/revealline-archive-04/releases/v0.37.0/site/game/). ZIP downloads remain at their original GitHub Releases. Nothing changes either edition's source, artwork, media owners, storage keys or worker bytes.

## Deployment and verification

[Archive04 PR1](https://github.com/mekhovov/revealline-archive-04/pull/1) merged as `930de95c59116a4dbaaadc33207a8cbd42409559`, preserving reviewed tree `cf9e64ac0973f79ce8ec9f103a0ab7e26bc97827`. [Hosted run 34806877793](https://github.com/mekhovov/revealline-archive-04/actions/runs/34806877793) rebuilt both editions using their own original CLIs, verified the complete artifact, and deployed it at **2026-09-14 04:43:20 UTC** (deployment `6430601595`). Its controller is exact frozen v0.38 source `b0a7ded10a816876c0e6bdac75b205948acf61da`.

One public audit ran from 04:47:05 to 04:48:42 UTC. Every one of the 607 unique URLs returned direct HTTP 200 with the exact decoded size, SHA256 and accepted MIME type. There were 607 attempts, zero retries and zero failures; all three hidden files and the unchanged local inventory were checked. The independent receipt review reconciled every row and deployment timestamp.

The earlier local assembly used explicitly admitted frozen-site reuse, with 22 finite guard tests, original TAR/Git stream and member checks, ZIP CRC/member/body equality, loose-byte verification and a separate artifact check. It did not claim new local CLI rebuilds. All **45 frozen records and 46 tag objects** remain exact. The hosted run subsequently performed both original CLI builds.

Evidence retained under `ROOT/.cache/round47/`:

- `archive04-preparation/local-candidate-handoff.json`: `aee2f1accc20dfb4d828e7a1a3230caff3ea7f840a31492088046e3b1cb98943`.
- `archive04-publication/public-http-receipt-corrected.json`: `50c96bc5f9eafcc1f3baa7265fe4b6b395dbe2bf35646132e3f13db27326a04c`.
- `archive04-publication/peer-final-parfit.json`: `27083fcf0a1a3e10e25136042cdac240d2ff3a1416bb97e741dd994b4e569a23`.
- `archive04-native/receipt.json`: `3a344371b35ae165e6d7bb3e79f73c0472b892e5c110cd5098c2f20391fc7818`.

The initial HTTP summary receipt `d93a0d96…` retained stale Archive035 aggregate labels. Its raw 607-row audit and per-version totals were correct. The corrected successor derives 602 / 429,319,211 directly from those rows and preserves the original receipt and correction diff. No network audit was repeated.

## Routing and capacity limits

The candidate uses the exact deployed archive allocation SHA256 `507de4832aef81e4c7ac49047e4a3b699506244cc3722ffb98a387dc57c75363`: 44 mapped historical versions across four shards. The existing archive tests pass on Node 22.22.2 and 20.19.5; actual record/owner validation separately confirms both new canonical URLs and unchanged earlier shards. These tests include query/fragment preservation, retirement-worker scope, distinct capacity limits, immutable inputs and failure retention.

The capacity report at `archive04-routing/capacity-estimate-v3.json` measures **120,467 bytes** of replacement bridges and records for these editions (12 HTML bridges each), plus **498 bytes** of changed global metadata in the frozen v0.38 layout. Removing the original canonical payload yields a known routing delta of **−429,198,246 bytes** for that layout.

Applying this delta to the earlier v0.39 projection yields **748,507,125 bytes**, approximately 201,492,875 bytes below the unchanged **950,000,000-byte main cap**. The projection still assumes a similar retained next tree and two copies of the 34,127,168 new Fracture pair bytes. It does not measure the final v0.39 runtime, current-entry overrides, manifests or metadata. The exact frozen/Pages build must establish fit; the official capacity CLI's freeze/tag requirement remains unchanged.

Root completed the same ordinary Pressure Lines journey at both canonical versions: Pause at 0% / 0 points / 3 lives / 2:58, reload, explicit Continue restoring those paused values, then Resume reaching 51.5% / 12,060 / 3 / 2:56 and stopping after capture. The native receipt binds eight raw snapshots; an independent read checked those pins and the v0.37 capture screenshot. These observations cover direct canonical URLs only.

No archive win, Collection original, offline behavior, main old-prefix forwarding, old-origin profile migration or physical-device qualification is claimed here. Keep prior missing-owner/original observations and distinguish wrong-pack refusals. Public byte equality does not establish human play quality. The existing [v0.38 native evidence](v038-native.md) and [v0.37 delivery](v037-delivery.md) retain their own source and URL scope. No reset, eviction, forced worker takeover, new release/tag or increased storage budget is part of this mapping change.
