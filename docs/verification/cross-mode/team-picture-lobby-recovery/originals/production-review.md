# Team composition: independent production review

The four Team runtime changes can retain **FPV@28** without changing the producer, production ledger, compiled artwork or strict Team picture bindings. This is a structural production review, not acceptance of the new host/painter behavior or a public release.

The accompanying `production-review.json` pins exact base `d2455ebfa444a8692d2694790afa6e4199af64e0`, its tree, producer, complete production bundle, compiled tree and every manifest-listed body. It also pins the four current uncommitted runtime files from `.cache/worktrees/p08a-team-composed-d245`; those bodies and HEAD remained stable during this review.

## Source ownership

All five current recipe digests match their approved digests. Their input path sets, order and individual hashes are in the JSON record. None contains `game/couch/coop-view.mjs` or `game/couch/relay-rescue.{css,html,mjs}`. The current producer therefore does not invalidate its recipe approvals for this host-only change. Those approvals remain scoped to unchanged recipe inputs; they are not inherited approval for the newly changed Team rendering, lobby, recovery or focus behavior.

| Group | Approved and current SHA-256 |
|---|---|
| ui | `c4bf0ef9888d0985666b936e8cc1fa4055fac9959ea0a4c356d3db4efdd99766` |
| screens | `4f9a3429dd418dc2376c6d2b871280fd8866e4a23f1f2acc30d4775ecb013e0d` |
| motion | `39127024d6fb37fb50e42a4d3e1e7034b633be8e7e31225b638963a577e63554` |
| effects | `e564793d7dd8db06474ed13f6cc773267f733d4361b9d648d84135484f5501b4` |
| audio | `ffc98cb5fae178aa91524368abbe5d62f13e79ab7726f0f312feb4e64dc4e130` |

The compiled manifest contains **127 asset payloads / 4,007,816 bytes**. All 130 manifest-listed Git bodies (127 payloads plus runtime JSON, Studio JSON and theme CSS) match their recorded hashes and lengths. The manifest excludes itself. The runtime's 124 selected asset URLs are a different count from the 127 retained payloads. Available working compiled bodies also match; sparse-absent inputs were read from exact Git objects without hydration.

## Strict binding preservation

Both current `coop-picture-bindings.mjs` rows bind FPV revision **28**, collection `null`, the exact starter-pack and level identities, and reviewed 1152×576 artwork revision 2:

- First Connection: `scene.reveal.wide`, hash `53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850`, 52,720 bytes.
- Relay Yard: `picture.fpv.adf5c9eea274ba7f`, hash `d76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d`, 38,090 bytes.

`coop-presentation.mjs:225-239` requires exact theme revision equality together with content/collection identity; lines 114-135 require the reviewed picture revision, bytes, hash and full frame. No wildcard or fallback is proposed. The unchanged binding tests cover both real PNGs and refusal of older/newer theme snapshots before reading or decoding.

## Integration gates

Retain fresh source and native evidence for the four composed runtime bodies. Requalify affected Team host, painter, lobby, recovery and victory tests against the current compiled assets. During final exact-source qualification run `node scripts/produce-field-kit-theme.mjs --check` and, after committing the exact source, `node scripts/check-field-kit-readiness.mjs`. The expected production delta is empty; compare the ledger and complete compiled tree with d245.

First Connection native victory and post-victory Retry remain a separate pending gate here. No test, build, producer/compiler, browser or network operation was run for this review. Byte equality does not establish decoding, appearance, input usability, gameplay or public acceptance.

If Team files are deliberately added to recipe provenance later, make that an explicit ownership change: retain source-stage and reviewed successors, reproduce the ledger/output, and synchronize both strict Team rows to the actual resulting theme revision. Preserve all historical records and all 127 payloads. That broader change is not required or performed by this integration.
