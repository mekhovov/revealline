# Retained Field Kit production input

Reproduce the complete current Field Kit output from its immutable ledger and
the explicitly pinned original FPV revision 54 runtime. Follow
`docs/field-kit-retained-production.md`. Prove that the hash-named retained
runtime is byte-identical to the original b810 input, all lazy dependencies are
authenticated, and no current output-directory read supplies retention history.

Corrupt the original input and remove or corrupt a dependency in isolated test
data: all cases must refuse before adoption. Keep current runtime/studio/CSS,
all 127 historical payloads and revision 54–58 records unchanged for this bounded
integration. Repeat generation from identical inputs and compare every output
byte. Never format hash-named retained runtime JSON or silently advance the fixed
fresh policy. Preserve append-only history and distinguish focused source tests
from controlled output adoption, native/offline and public release acceptance.
