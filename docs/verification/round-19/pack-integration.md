# Pack mastery integration checks

Verified on 12 September 2026 against the current Round 19 source. These are focused integration checks, not the project's total test count or a browser/hardware certification.

The new [integration suite](../../../game/test/pack-mastery-integration.test.mjs) passes **23/23 tests**. ESLint and Prettier checks on that file pass. The suite uses prepared, opt-in `xonix-pack.v2` Homeward content and a mixed library containing a `xonix-pack.v1` Night Shift pack. Only dedicated presentation overrides are removed from these test inputs; original maps, equipment recipes and recorded routes are retained. An injected image decoder throws if accidentally invoked, so these checks make no image-decoding claim.

## Independent compatibility oracle

Twelve complete `{preview, verification, record}` results were calculated using the **frozen v0.8.0 site modules**, then pinned as canonical SHA-256 constants in the new test. They cover Steady Signal, Supply Line and Safe Return, each with its qualifying specialty route and an ordinary Interceptor control under both steering policies. Normal test execution uses current modules against these constants; it neither reads Git nor regenerates expected values from current behavior.

The frozen source commit is `8410d814dbcc7b3aef53e11c6f94d384d01cce05`. Its source archive SHA-256 is `6ea37522cf6e253b2999611b2a66e0a2aa661dac61ca37d7db6771edfe86e52b`. The existing [v0.8 release verification](../round-18/release-integrity.json) establishes the archived site/source relationship. One-time oracle output is retained at `/tmp/round19-v080-goldens-SsAwLp/hashes.json`; that temporary file is supplementary and is not needed to run the committed test.

The original Homeward proof file is independently pinned to SHA-256 `63a77908b1ce98b480f9fd0431894e4f1d58ad56e4266ae0860206de564d8c1a`. Each replay's final summary and authoritative checkpoint must also match the unchanged proof. Four additional omitted-action controls retain their original checkpoints and remain unqualified. None of the old fixtures or frozen release files was changed.

## Behaviors covered

- Prepared declarations are owned, frozen sidecars; mutating a returned pack entry cannot change an already-created catalog. Campaign and roster identities remain unchanged. The v1 member remains v1 after a mixed pack-library round trip.
- All six qualifying routes preserve every frozen preview, verification and earned-record field. The six Interceptor routes remain ordinary wins without these optional seals. Copying a verification result does not manufacture an award capability.
- Full backup export/import preserves six earned records, three collected pictures, both pack formats and recorder-backed sessions. Both policies restore Supply Line after the western crossing and Safe Return while awaiting redeployment, reconstruct the same preview from the replay prefix, then complete with the original authoritative checkpoint.
- Revising a goal archives its old labels while preserving records and pictures. An explicit empty v2 declaration has no built-in fallback. Removing the pack retains the collection in a complete backup; reinstalling the original v1 content makes matching original seals current again and leaves the revised seal archived.
- Restoring a saved prefix against a revised four-cell Supply threshold recomputes its optional progress from the recording. The original south three-cell route still wins the same board but does not earn the revised goal. Removing the declaration restores an ordinary run without an observer.
- The real backup journal and guarded `saveLibrary` adapter handle mixed replacement and explicit Undo. Injecting a profile-write refusal after pack/session writes restores the exact prior storage values. Successful replacement adopts the new collection, and Undo removes those new records instead of merging them back. Journal and backup-lock values are cleared.

The journal test uses in-memory storage and asset adapters, with an injected lock executor. It verifies transaction integration and failure behavior; it does not exercise browser Web Locks, IndexedDB, multi-tab scheduling or disk quota failures. UI adoption and practice-only award restrictions require their separate app and browser checks.

## Commands and result

```sh
node --test game/test/pack-mastery-integration.test.mjs
node node_modules/eslint/bin/eslint.js game/test/pack-mastery-integration.test.mjs
node node_modules/prettier/bin/prettier.cjs --check game/test/pack-mastery-integration.test.mjs
```

The focused run completed in about 5.5 seconds with zero failures. Its temporary TAP log is `/tmp/round19-pack-mastery-integration.log`. No production code was changed by this task, and no concrete integration defect was found by these checks.

A second agent read the complete assertions and found no concrete contradiction in the certificate, revised-definition restore, archive-label or rollback boundaries. That review did not independently regenerate the archived oracle. A final focused rerun after app/view integration also passed 23/23 in about 5.1 seconds.
