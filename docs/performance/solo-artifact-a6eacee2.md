# Verified production package: a6eacee2f

[Appearance run 39008793814](https://github.com/mekhovov/revealline/actions/runs/39008793814) completed successfully on 17 October 2026 at 06:58:00 UTC. It packages exact source `a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4`, tree `6b13627e324f695b6ee8d9f2dee2eeeb7217c332`, with merged runtime boundary `32abd322afd8243e4537ce4784e2f78ee45ecbec`. Node 22.13.1 executed all 105 distinct declared focused files under the required test policy; that step passed in 2,268 seconds. The combined full-game/Worlds build passed in 644 seconds within the existing 720-second bound. All checksum and upload steps passed. Individual builder durations are not recorded separately.

This artifact includes the startup graph, Optional Worlds, media scheduling/accounting and latest-main changes missing from the intermediate adb package. Subsequent commits through `16708351b` change qualification tools/tests/documentation only; there are no `game/` changes from this artifact source. Native consumers must still verify the exact package before observing gameplay.

| Bound item                | Identity                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Full artifact             | `12092903788`, `appearance-preview-pr-1544-a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4`                    |
| Outer archive             | 1,091,879,339 bytes; SHA-256 `a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a`         |
| Inner distribution        | 1,073,755,490 bytes; SHA-256 `52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1`         |
| Manifest                  | 523,832 bytes; SHA-256 `b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7`               |
| Compact metadata artifact | `12093018459`; 16,050 bytes; SHA-256 `84817643f9af167b2ffd9dc688f1894ac74bf64cf2493ce3da81eabb9eada8d5` |

## Independent readback and limits

Two independent readbacks verify all five compact ZIP members, CRCs, member hashes, exact source/tree/runtime, required policy and the 105-file inventory against the producer and fresh GitHub APIs. The members expand to 15,398 bytes. The 7,285-byte package binding hashes to `0b22f74bf0c08adef7d8a26d0485fa013100cc2cd5df355b71a7363ee48f535b`; the 6,930-byte identity record hashes to `2ced41356c46007803c780d234191aa84a9951aa7728b76d448321d9cbab6166`.

The full package was not downloaded locally. Every hosted consumer must verify full outer and inner archive bytes, manifest, exact source, static workers/lazy modules/offline closure and served CSP before gameplay. Compact metadata is package authority, not a native performance or correctness result. The normal-production comparison baseline remains `8b01991942dc764b8aa4726851699ce1985e53ae`; earlier packages and failed observations remain available as separate evidence and rollback artifacts.

Retained evidence is under `.cache/solo-followup/remote-39008793814/`. The root analysis is 9,188 bytes, SHA-256 `2e05167f1e3e39fb27fab9182a3d1ce8982914682a9cf3a9d104469e5c97e676`; candidate pins are 1,111 bytes, SHA-256 `89f559d846dccde41e8e41599cc9b109f84478bb138e27096097d2b13fbb8213`. Independent fresh API/readback receipt `peer-readback.json` is 1,635 bytes, SHA-256 `998864073a00798776dff2a66369a60557a76383553b074d5e1b283a1f1c9f97`.

The first local reader attempt retained the obsolete 98-unique-file assertion while checking the new 105-file total. It stopped without producing package authority. The original reader and failure are retained; correcting that assertion to 105 unique files permits the full readback, independently reproduced above. No producer failure, hash check or test gate was suppressed.

Final-source browser timing, sustained/resource behavior, input surfaces and offline checks remain pending. The successful build does not establish physical iPhone Safari/PWA or Steam Deck Chrome qualification.
