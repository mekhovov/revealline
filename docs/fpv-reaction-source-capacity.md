# Lossless reaction source capacity — 4 October 2026

The generated World reaction runtime now uses the existing checked lexical
projection after pinned Prettier formatting. This extends source repair #1011
without changing canonical modules, recordings, licenses, package policies or
file counts. Only redundant spaces/tabs outside lexical content are removed.
Every token, comment, literal and line terminator must remain exact; the helper
also compares syntax trees and fails closed on any difference.

Against main `c15c179a2e2aa03f63fd86b3f09665adb9db7aa7`, the generated module
shrinks from **849,454 to 838,378 bytes**, recovering **11,076 bytes**. The
95 original World inputs total **16,758,922 bytes**, leaving **18,294 bytes**
under the unchanged 16-MiB guard. Pending disposal and coaching changes consume
some of this reserve; their eventual integrated source must be admitted again.
This is source capacity, not a performance or memory improvement claim.

The [manual source receipt](evidence/fpv-reaction-source-capacity-source.json)
binds all 95 input paths to baseline Git bytes. Exactly one runtime input changes.
All 57 canonical source/asset pins and all 24 decoded recordings are unchanged.
AST, exact tokens, exact comment text, line terminators and idempotence pass.
Canonical physics, demonstration proofs, policies and license files retain their
original bytes. No new unit coverage is introduced.

Generator `--check`, syntax, scoped ESLint and generator formatting pass. Existing
compactor, audio and actor-recording checks report **16 pass / 1 fail**. The failure
is the already recorded native dialogue warning-priority assertion at
`game/test/fpv-hunt-reactions.test.mjs:169`; the test and its direct canonical
audio imports are byte-identical to baseline and do not import this generated
projection. It remains a separate known audio defect, not an all-green claim.
The first manual receipt attempt hit Node's default 1-MiB child-output buffer
while reading pinned Rapier source. Giving this read-only Git reader a bounded
16-MiB buffer allowed the unchanged package policy to be checked normally.

Source-bound all-three admission, reproducible ZIP verification and the actual
admitted-player/audio smoke check are pending at this source checkpoint.

Reproduce the source-only identity check using an admitted World source inventory:

```sh
node scripts/refresh-fpv-reaction-runtime.mjs --check
node scripts/qualify-fpv-reaction-source-capacity.mjs c15c179a2e2aa03f63fd86b3f09665adb9db7aa7 path/to/source-inventory-optional-fpv-worlds.json
```
