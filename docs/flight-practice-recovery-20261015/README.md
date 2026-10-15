# Recovery verification evidence — 15 October 2026

Source `89537fe0b40725d9302fa07ce06f44ce2229f14b`, tree
`accf0deba67c558160760ce47d12adecf7f0794c`. Files are original tool outputs copied
byte-for-byte. Absolute local paths are capture-time provenance, not public URLs.

| Evidence                                                       | Result                                                                               | SHA-256                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [Package envelope](optional-packages.json)                     | Exact three-app artifact identities                                                  | `1037661ca0f97d8f13d38bbf52f9ccab8effdb43a95ce626e0b86d71ed0641b0` |
| [Build verification](optional-candidate-verification.json)     | Twice reproducible, committed inputs and inventories admitted; not publicly eligible | `c0978c7d50f8336e679cff056327404e95499dd33a1e68acf6be4d79ef73cb13` |
| [Browser observation](browser.json)                            | Nine checkpoints passed; cleanup succeeded                                           | `80affc4f1b76a71174bdc2149c479361cc69c8100ff5f90c8182302f4872ca1b` |
| [Frozen practice suite](frozen-practice-tests.log)             | 334 passed, zero failed or skipped                                                   | `321903df81a0f599cb8401c32aa66b6a25f003877a84f481b6310dd3642b2927` |
| [Earlier source-changing attempt](source-changing-attempt.log) | Failed; final source edit overlapped the run, causing launcher/template mismatch     | `9d5c3491d98b9775da690c147589814ab45e3cfef819513413c5909cdfa9ac99` |

See the [recovery report](../flight-practice-recovery-2026-10-15.md) for the fixes,
source comparison boundary, package limits and remaining acceptance. The browser
pass is not a real-version migration, physical-device or human-learning approval.
No hosting, release allocation or public selector change is represented here.
