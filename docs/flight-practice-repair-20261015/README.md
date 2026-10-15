# Repair continuation evidence

See the [report](../flight-practice-repair-2026-10-15.md) for exact source bindings
and limits. Raw reports/logs below are original bytes. The archive retains the
complete C7 output directory: plan, 16 checkpoint files, six screenshots and nine
observer-source snapshots. Capture-time absolute paths remain provenance.

| File                                     | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `cold-diagnostic.json`                   | `dd46dbbe9030daadbe51c40c98f3c790330865717c9c1e6958c1b60c2540ce84` |
| `cold-five-rounds.json`                  | `fa7c8e2abb18f4ecce8e54d22c9f5bb4252162fc2026e99c722c6cbb683a6cb0` |
| `diagnostics-tests.log`                  | `bb8ca090e6f99a8db8d76017d5b8531940b977ed1569e322e9d98508927a9b1b` |
| `cache-repair.json`                      | `e70239430097aab03d0bbbedb145b61c23a18410c70b52970278dd84d07a1b4f` |
| `cache-repair-originals.tar.gz`          | `4aea3ad222d811883210fab81958da733af804dfbfc2a4103080d24ab8a01eba` |
| `cache-repair-tests.log`                 | `7884f0bf2d9da569dd388779daffa9d575c7d656e7efe6d6f8c99db9d835f103` |
| `practice-tests.log`                     | `f26d3373ee9fe701624f941d0847811c9d6c64c6070763394bfb4c2db598ca2f` |
| `cache-repair-seeded.json`               | `d7e037bac344c468b8624b7287cefab393aa5e9338c55d4438b90a5951ea8f36` |
| `cache-repair-seeded-originals.tar.gz`   | `ff1eeb7daf9d80ee9d2576f2abd1b96e19f1e4bbbbaf788ff50afe871534a5df` |
| `first-flight-attempt1.json`             | `05278cbb381ea0693bf1c1a1e365664fcb18876c605eaa138a77e21bc96f9b94` |
| `first-flight-attempt1-originals.tar.gz` | `a8d5d0b2a83f5d7ab666b2ba2160921ddc200f81e553de8fab10d6a686aa70bc` |
| `first-flight-attempt2.json`             | `ad984b2df59c8bae74e8f0bf0c42ad2f423f2eac0bf0f5b12b3f424f103cff79` |
| `first-flight-attempt2-originals.tar.gz` | `1f419461f9f5adad5bcb8320a425cc1eeca2d496e5ebc723f4415e20761647eb` |
| `first-flight-attempt3.json`             | `cf26ba90d2bc070f8ff03ba75b0d7e82c072664a037de8f36a7a0fa73596a0a8` |
| `first-flight-attempt3-originals.tar.gz` | `167daa2a1b13f812ed9d7a6325e6b64642ee0b01cefaae839ea0bffc2fb43b98` |
| `current-optional-packages.json`         | `60a579e6ec9e309841c875014c15143dea49892c2fe5546417e1bf66f3b3a09e` |
| `current-candidate-verification.json`    | `b6543d14a3e58db26b3c6151b90d00df187ab9f749ff7cae51b2c43cb88aa66b` |
| `current-first-flight.json`              | `e0cfdbc18e53576a5a5902f85a95b40c3121b5f2f9736f625101dc2319212446` |
| `current-first-flight-originals.tar.gz`  | `d6401b1ac5035c606dcd30166a1fc682fd1532facf5b297f1d6ec2f13a15abe5` |
| `current-cache-repair.json`              | `38b579c8b4667e1048dcad19deca700a8fc6e7ebe73104fe76179367f4fe5366` |
| `current-cache-repair-originals.tar.gz`  | `164fa602d7649afdf9dc4dd95d4b716fb9cf0ade21810df50548040b7f5ea88e` |
| `current-retained-world.png`             | `0aa226cd903a37a4e19d682d066e8e296fee73005ea6f179e11d46bfd1eeb93f` |
| `quota-zero-attempt.json`                | `cb86eabaeb980717bcaa90a51f4b331d155845da4b3d8f16c7221fb2bbb0736e` |
| `observer-tests.log`                     | `de795a6e628e47e612766a421450ac34223bdcf6573994e464b59b8333a2f2ca` |
| `pointer-tests.log`                      | `2c3e462130f0004bf59c79725e9951e870a43961110bc2fe9835fc4891ae08b6` |
| `regional-setup-failure.log`             | `845d137a0bcfc948db860f502303c66307c6f445665d561ffc6c34a255574629` |
| `regional-tests.log`                     | `d15d7527f6959623c824ea44bfce86c1183a6988345b2cf725359fb4d6a872c3` |

Additional final receipts:

| File                                    | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `quota-positive-academy.json`           | `79dfedbdd58caa64ab7adc9003b5e5b58348923e869bd2b55da4d6d0b6a3fbec` |
| `final-practice-tests.log`              | `54e3d4428f8354aaec244edb35971e1976f92665327e090b1d0c1ade8e05bd1f` |
| `final-observer-tests.log`              | `b072cf36acba3989c30cab97a230c4dd6bb9b6eefbb26e204682d13904232bc4` |
| `final-pointer-tests.log`               | `22067c2fdd75600404d0f49782a68e48e24dcb3c9e282a4ee1d4baff9d339df8` |
| `first-flight-helper-reconstructed.mjs` | `b1e47bf44eced82128ae7eb51a374aebe944d41b97756fa2c05dfd0f21560bd8` |
| `independent-audit.json`                | `62598e039c7b6144dbe161e66b3a368f1cd9a6173cc0c3de93ce648a10eff3ca` |

Latest all-three receipts:

| File                               | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `quota-all-attempt1.json`          | `d219d6be71ac0c35de705257e3a7f1e6b141b033d1a91d7076fe961dc2ef9a9d` |
| `quota-all-attempt2.json`          | `7a17a1a2f19c5f8f0e55eb487a173fe9f7ac3823c72039ec2b90b2d6f82befc3` |
| `all-practice-tests.log`           | `464155dba74613e18cc93b3d9d3c8027f63096ec84330bebaf78ae93fc59e3cf` |
| `all-observer-tests.log`           | `8e6f62d42450c58f606e2ba624ae94e05547a42479f2293bf8a75049c8d74592` |
| `all-pointer-tests.log`            | `c2ef75d54a7b42fb8546ac7f31b311501f5cfc65560a8cb88def618200bc67ba` |
| `verified-practice-tests.log`      | `e94e7cce9e33f6988115e5576e519b036dbccecb68b9041a563a0aa2364e1e7c` |
| `verified-observer-tests.log`      | `db5ab39b7630ae8f0c764ad799bfbf7368d0572a48d59072a45668abf15d6722` |
| `verified-pointer-tests.log`       | `9481d213f68b51c8b084d2c3438390397f3f607e8b8cd46a686cb979fd06000a` |
| `all-quota-independent-audit.json` | `8ba61632d844c3ebf26c251c126aa06ed496e6cb83a4d15dd7996c525dbcdb26` |

Independently computed screenshot hashes (each fault pair shows the same UI):

| Prefix, each with `missing-dependency.png` and `missing-worker.png` | Bytes per file | SHA-256 per file                                                   |
| ------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| `civilian-flight-`                                                  | 148524         | `e7256133af96db18a88e8aea5f40b393a79e0ebef89127e7a546ef7f8cdb5641` |
| `civilian-fpv-`                                                     | 149635         | `9fc44ea0d8a71a5d8ac4ee95c56b443bdefd04e8607a54db598f6ea96149ee7c` |
| `fpv-worlds-`                                                       | 155978         | `5f0103c3dc5b8a391c3478c690dc534c32f4c41e058b7ba5b0c814cdbe98d843` |

The six screenshot pins are added by this inventory; the original report does
not embed them. No report here grants human, physical-device or public-release
approval. Empty-store comparisons do not qualify populated-content retention.
The separate v2 seeded report and archive retain one UI-created World Studio
project/revision through 18 checkpoints; their scope does not replace the v1
empty-store limitation. First-flight attempts 1 and 2 are failed aggregate runs.
Attempt 3 completed the declared four-case automated EN flow, not exercise or
full release qualification; `qualified: false` is retained.
The fresh `50b7612e8` candidate has separate `current-*` receipts; earlier receipts
are not relabelled. `quota-zero-attempt.json` failed: the zero override was an
ineffective denial control, not a product defect. The initial regional test log
records missing dependency resolution; the unchanged retry uses the existing
authoring dependency path and passes six tests. No packages were installed.
