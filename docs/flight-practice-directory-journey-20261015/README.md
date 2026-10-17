# Retained directory-journey observations

These are local full-source-shell observations, not production-build, hosting or
release approvals. See the [report](../flight-practice-directory-journey-2026-10-15.md)
for source identities, scope, failures and remaining gates.

The original failed run and successful retry are preserved without rewriting
their receipts or capture-time paths. Archives contain the complete original
output directories: 24 failed-run files and 36 completed-run files. Every archive
member was compared byte-for-byte with the original output; no member has an
absolute or parent-traversal path. Both receipt copies match their originals.
The independent audit records a separate read-only source, overlay, authority,
screenshot and claim review. It does not turn observations into review approvals.

| File                         |   Bytes | SHA-256                                                            |
| ---------------------------- | ------: | ------------------------------------------------------------------ |
| completed.json               |  272022 | `e54cd5c26af345ebcd6280fd51298b828ec0df9bdf1fa4fbbf8ede3223154480` |
| completed-artifacts.tgz      | 5137175 | `e73f780f51cfcf2b4776765d2d3db16d6eba00a782076d1ec9d0353d7eb74b0c` |
| initial-failed.json          |  259996 | `11f2bc62d29c4544a9e6594053e8b4a107a37a731f2700991298f276d2de46b3` |
| initial-failed-artifacts.tgz | 6651770 | `7469961ae0c84830e2e38bb38c9bd050f7446507edcc00a6c259a4d45e2a0d90` |
| independent-audit.json       |    1306 | `4e4e49bd373448ae591f18b149d57280b6befa1da8be18fdeec95461c7a660f5` |
| observer-tests.log           |   15120 | `cee5ffa214a8b06022ae46e4344da097099107d396a904935a978a5f3236ca28` |
| practice-tests.log           |   81838 | `b65d0aeb74e2c79e9c6f55025c9f2bbe0d5e64ff3329f06150ab4fe4489d2f04` |

The successful run has six passed journeys and `qualified: false`. It retains
twelve source-only build-info and two favicon failures. Neither default appearance
nor guide screenshots establish positive customized appearance, complete visual
translation or accessibility acceptance. The test logs retain 68 observer and
352 practice passes, respectively, with no failures or skips in those suites.
