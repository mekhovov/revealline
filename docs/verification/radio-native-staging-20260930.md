# Radio / FPV native staging checkpoint — 30 September 2026

Source: `a1b7e328fa5c7eda0ca7efa27ee151e21d772cb0`, main `e39b4197a` plus the
sound-credits HTML correction in [PR #859](https://github.com/mekhovov/revealline/pull/859).

## Completed

- The sound-credits page now has explicit head/body elements. Displayed credit
  text and verbatim license pre blocks are unchanged. No generator for this page
  is present in the committed repository.
- All 47 included source HTML pages pass the production `iosHTMLPolicy` transform.
- Full `game-cli build` passes with 2,660 files and the exact source revision above.
  Version `0.142.4` is the existing build-config label, not a newly allocated release.
- ZIP SHA-256: `8bd51cc77982329f40fa25caa9dafcde0b35ca29fa239ae6b86da087c86dd4e0`.
- Manifest SHA-256: `194cd1f6036b78da3063fc17c1c95ad1807666567709e85a065776103d360936`.
- Official iOS plugin bridge builds under Node 22.22.2. Bridge SHA-256:
  `4d94ad1701b8e8d27cd5a0091fea09ca95f6560bb178a62e2e4901fb747260bc`.
- iOS doctor reports valid configuration, linked privacy manifest and the existing
  native project. Full Xcode and simulator tools are unavailable.

The sparse checkout initially omitted required build modules, art and publication
provenance. Those failed attempts are not successful builds. Restoring committed
non-release inputs allowed the final full build to complete; no content was
removed or rewritten to satisfy validation.

## Remaining blocker

`native-cli stage --platform ios` rejects the verified source inventory before
writing a native stage: **Native site exceeds 768 MiB**.

| Measurement                              |       Bytes |
| ---------------------------------------- | ----------: |
| Full web inventory                       | 949,537,804 |
| Existing native limit                    | 805,306,368 |
| Excess                                   | 144,231,436 |
| `game/content-design/assets`             | 273,267,869 |
| `game/editions/assets`                   | 144,999,955 |
| `game/content/packs`                     |  92,499,578 |
| `authoring/library/four-worlds-chapters` |  44,479,519 |

The desktop and iOS staging paths share this size guard. The group sizes do not
establish that any file is expendable. [Issue #865](https://github.com/mekhovov/revealline/issues/865)
is assigned to v0.150.0 to decide the native distribution scope or justified
capacity policy while preserving dependencies, original assets and licenses.
No limit was increased and no mandatory validation was disabled.

No complete current native stage, Xcode compilation, simulator/native launch or
physical controller qualification is claimed. Hardware checks remain deferred
by the user. Automated test-only suites were not run under the current waiver.

Local build output: `.cache/radio-native-current/`. The generated bridge and
build are local development artifacts; this receipt is not publication approval.
