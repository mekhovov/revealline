# Verified bab3 production package

[Appearance producer 39059454401](https://github.com/mekhovov/revealline/actions/runs/39059454401) completed successfully on 17 October 2026. Its separate 11-file admission prerequisite passed all 87 controls, the complete 118-file gate passed in 33m20s, and the full build passed in 8m12s. Package binding and both package uploads passed. These identities refer only to the committed bab3 source; subsequent local runtime and tooling changes are not included.

| Identity           | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Source             | `bab3b2790944c6257f9c1f9b346839996bbefebb`                         |
| Tree               | `4bdfc784e14b41ed5d32895b4fa139920f494a63`                         |
| Full artifact      | `12111459962`, 1,091,995,022 bytes                                 |
| Full SHA-256       | `62ba191f48b49c6dd86a434ab3ecf74c41c463ae72f8f27aba4271e858c71c72` |
| Inner distribution | 1,073,812,509 bytes                                                |
| Inner SHA-256      | `4b6cc26f74d0913f8c60c046267e398a82478bd8095819b7095b222800e6e796` |
| Manifest SHA-256   | `7acdbb3c8f9c97dcdac71b0c42ff660be8c0c87fff8e563b641cb485add1cc52` |
| Compact artifact   | `12112271632`, 22,786 bytes                                        |
| Compact SHA-256    | `a4dd30b4e0fc6765ede0cbfe770f25d8b5bba2ba3dbd12221be026b006cb8167` |
| Admission artifact | `12111180776`, 6,316 bytes                                         |
| Admission SHA-256  | `8eab9f9182adb27160f3941933bce9afd1328ebfe00bbeb8800fa1d4256ed11a` |

Independent readback verified the five compact members and two admission members, ZIP CRCs, every member byte/hash, checksum manifests, exact Git source/tree, required-test policy, and the two declared test-file lists. The embedded prerequisite proof matches the separately retained 87/87 TAP, and direct live API responses bind all three artifact IDs to the same successful run. The admission TAP has no failures, skips, cancellations or todos. The policy digest is `ed52029154df24dcc9c0b9c808b632abdfac7478b6b718f312863ab41c3082b2`.

Retained analysis: `.cache/solo-followup/bab3-package/appearance-analysis.json`, 14,274 bytes, SHA-256 `7084611a533eb1d7aad45376d925c3d4c45be27d9497efa8e645995c8c5f112f`. Exact consumer pins: `.cache/solo-followup/bab3-package/candidate-pins.json`, 1,106 bytes, SHA-256 `a4f9df81b3d7a9a0fd798376e05c011ae87dc0332c2ba414bb3415eded94f788`. The two original small ZIPs, API responses, inventories, admission TAP and proof remain beside these receipts.

The full distribution was not downloaded locally. Every native consumer must still verify the complete outer archive, inner payload, manifest, fresh exact source, worker/offline closure and CSP remotely. This receipt establishes package identity and required producer checks; it adds no native performance, physical-device or offline qualification. Previous package failures and native observations remain unchanged. Nothing was deployed.
