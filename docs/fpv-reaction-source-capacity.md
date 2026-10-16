# Lossless reaction source capacity — 4 October 2026

**Qualified source and admitted-player checkpoint:** frozen candidate
`45d673d3641b16d4dd8c51daa0eb7ce12ba96a4a` passes full validation, all-three
source-bound admission and the bounded actual-player UI/audio integration smoke.
The existing canonical audio warning-priority test failure remains disclosed below.

**Current main integration:** normal expected-head update `88822f3ecd751b2278bd9131e60e8d5641707343`
merges main `5931ef12678cc52ab332fbbfe5516ad93a60caa9`. The
[committed-input comparison](evidence/fpv-reaction-capacity-main-integration.json)
finds 94 of 95 inputs exact to frozen capacity source `45d673d36`. The only
incoming input is `world-app.mjs`, byte-identical to qualified disposal source
`d9ad2561ee1d7685ef97961478b7de30278c1e48` (SHA-256
`6bd30bcd11caa83ccdb36d9bb7c826a9735b5d4549bb49008494921a6a0ba4cc`).
Its 742-byte growth gives **16,759,664 source bytes / 17,552 bytes remaining**,
with the same 95 input paths. The compaction, licenses, proofs and package
policies remain exact. Prior package/browser receipts keep their historical
candidate identities; fresh protected CI must admit this combined head.
This scoped integration check does not claim another local build or browser run.

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

Frozen candidate `45d673d3641b16d4dd8c51daa0eb7ce12ba96a4a` passes full
`npm run validate` and [source-bound all-three admission](evidence/fpv-reaction-source-capacity-admission.json),
with two byte-identical builds, committed input checks and ZIP-member verification.
World retains 102 admitted runtime files and 104 source-archive files (including
the source inventory itself). [The admitted input comparison](evidence/fpv-reaction-source-capacity-admitted-inputs.json)
reconfirms the exact one-input delta against baseline.

[All 102 player members](evidence/fpv-reaction-capacity-admitted-player.json)
were staged directly from the admitted ZIP and re-read for exact equality.
Ninety-eight immutable files were reused by verified hardlinks; four files
required 1,124,697 new bytes. No live source inode is shared with this fixture.
The [actual-player receipt](evidence/fpv-reaction-capacity-player.json) records a
retained Clearing check-in session initially at 0.6 seconds with sound enabled.
Sound off/on, explicit Resume, Pause and menu Continue work; the final pause is
at 73.7 seconds, and the initial Sound:on preference is restored. Browser warning
and error logs are empty. This qualifies normal admitted UI/render/control and
audio-toggle integration. It does not claim a fresh course start, audible
perception, playback of every voice family, physical-device behavior or sustained
FPS. [Artifact hashes](evidence/fpv-reaction-capacity-browser-provenance.json)
bind the unchanged receipt and screenshot. Detailed existing checks and their
retained failure are in the [local-check receipt](evidence/fpv-reaction-source-capacity-local-checks.json).

Reproduce the source-only identity check using an admitted World source inventory:

```sh
node scripts/refresh-fpv-reaction-runtime.mjs --check
node scripts/qualify-fpv-reaction-source-capacity.mjs c15c179a2e2aa03f63fd86b3f09665adb9db7aa7 path/to/source-inventory-optional-fpv-worlds.json
```
