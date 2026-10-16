# PR #1124 migration provenance

PR [#1124](https://github.com/mekhovov/revealline/pull/1124) is an historical
appearance-system snapshot. Its head is preserved by the annotated tag
`archive/pr-1124-unified-appearance-20261009` at
`c6ade59e07bd62afb7a62cae2fa6e841eb06f912`.

It must not be merged as a single change: it was based on
`6ecaced32e53db33add14d0db3138d3bc407522d`, conflicts with later `main`, and
would replace newer retained revisions, mission identities, and FPV behaviour.
This record maps its logical product work to the successor integrations on
`main`, so the source remains recoverable without reintroducing stale code.

| #1124 logical area | Current successor / evidence | Migration disposition |
| --- | --- | --- |
| Versioned shared appearance, first paint and theme transfer | `game/presentation/theme-system.mjs`, `theme-bootstrap.mjs`, and `theme-host.mjs`; current contract: `game/test/unified-appearance.test.mjs` | Kept through the newer current implementation. Do not restore the older family registry or bootstrap. |
| Mission-library chooser presentation | `game/ui/mission-library-browser.mjs`, introduced by `55dc4c2db`; `mission-library-chooser.mjs` is now the focused compatibility adapter | Kept through the shared browser. Do not replace it with #1124's pre-extraction chooser. |
| FPV world presentation and simulator surfaces | Current `optional-practice/civilian-fpv/world-*.mjs` and later FPV integrations, including `#1101`, `#1102`, `#1104`, `#1105`, and `#1110` | Kept through later, feature-scoped integrations. The #1124-only renderer wrapper was unreferenced and is intentionally not introduced. |
| Curated appearance, community, Studio and authoring surfaces | Current theme-family controls, Studio modules, and their focused tests | Kept through successor implementations that preserve later revisions and validated source identities. |
| Content-pack visual overrides | Current v1.1 pack records and their retained per-level visual overrides | Kept. #1124's v1.0 copies would remove those overrides and must not be ported. |
| Pages/release/queue workflows | Later delivery policy integrations; Pages-specific workflows were deliberately retired or replaced | Not migrated. Restoring them would reverse the current delivery configuration. |
| Verification receipts, screenshots and planning documents | The immutable archive tag above | Preserved as historical evidence, not copied into mutable current documentation or treated as current qualification. |

## Verification boundary

The current unified-appearance, theme-system, bootstrap, family-host, preview,
and notices suites are the current implementation evidence. Historical receipts
from #1124 remain attributable to their exact archived source revision; they do
not certify a later build.

This record does not delete the original branch or tag, repoint a release, or
claim physical-device qualification. A future feature may deliberately reuse an
archived idea, but must be reintroduced as a new narrow change with current
tests and a current source/data review.
