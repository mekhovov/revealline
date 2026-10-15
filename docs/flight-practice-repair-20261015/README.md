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
