# Team picture bindings: exact metadata successor 41

The three code-owned `themeRevision` pins advance from `38` to `41`: the two starter arenas and the historical-import picture policy. Their picture tuples, pack/level identities and lease behavior are unchanged. No wildcard, latest-revision lookup or broader match is introduced. Two picture test files and the live actor-presentation expectation now require exact revision 41; historical fixtures remain unchanged.

The source baseline is `ed039c08b68c7b2a59824a9e78f38ee5734308ef`, selected theme `fpv@38`. The checked worktree has HEAD `283685e050219af03ed221d8cce3c8e2c46a8077` plus the explicitly hashed files in [verification.json](verification.json). The final production ledger is revision 41, 7,405,139 bytes, SHA-256 `860e6e5e2e522e3bb99e3714ebf379d771a9be7b3ac38c6de899cff5d892053a`. This work did not regenerate or copy the ledger, media or compiled outputs.

[verify.mjs](verify.mjs) imports and validates both actual ledger bodies without an image decoder, then proves:

- All 127 payload bodies are byte-equal between revisions 38 and 41, and each actual SHA-256 still matches its descriptor.
- Every original asset, theme, slot and collection record remains an identical canonical prefix. The current prefixes also match every group count/hash in the retained revision-40 receipt: 1,334 assets, 41 themes, 293 slots and one collection. Revision 41 appends metadata; it does not rewrite that history.
- Both complete resolved Team picture descriptors and their full-frame geometry are unchanged. The compiled PNG bodies match the ledger, hashes, lengths and 1152×576 PNG header dimensions: Orchard `53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850`, 52,720 bytes; Foundry `d76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d`, 38,090 bytes.
- The five Team actor source descriptors are identical to the baseline. The tests retain their exact asset IDs, revision 2, PNG hashes, dimensions and frame assertions.
- The binding file differs from the baseline only in its three explicit revision values and explanatory comment. The presentation lease and starter pack source files remain byte-identical.

Run the retained verification from the repository root:

```sh
node docs/verification/soundtrack-v3-framework-2026-09-21/preflight-repair/team-bindings/verify.mjs
```

The complete 12-file cohort passed **235/235**, zero failures, skips or cancellations, in [tests.tap](tests.tap):

```sh
node --test --test-concurrency=2 \
  game/test/coop-picture-bindings.test.mjs \
  game/test/coop-historical-import-picture.test.mjs \
  game/test/coop-presentation.test.mjs \
  game/test/coop-picture-host.test.mjs \
  game/test/coop-import-production-reader.test.mjs \
  game/test/coop-local-artwork-picture.test.mjs \
  game/test/coop-presentation-bootstrap-retry.test.mjs \
  game/test/coop-presentation-envelope.test.mjs \
  game/test/coop-view-presentation.test.mjs \
  game/test/coop-actor-presentation.test.mjs \
  game/test/coop-picture-recovery-focus.test.mjs \
  game/test/coop-victory-picture.test.mjs
```

The first complete run is retained as [tests-before-actor-expectation.tap](tests-before-actor-expectation.tap): 234 passed and one live actor test still expected theme revision 38. Only that exact selected revision was corrected before repeating the same full cohort. Positive real-byte picture preparation, full-frame contain/nearest leases, corruption rejection, older/newer unbound snapshot refusal, closed starter namespaces, imports, cancellation, retries, cleanup, recovery and earned-picture presentation checks remain intact.

ESLint and Prettier passed for the four changed source/test files:

```sh
node_modules/.bin/eslint game/couch/coop-picture-bindings.mjs game/test/coop-picture-bindings.test.mjs game/test/coop-historical-import-picture.test.mjs game/test/coop-actor-presentation.test.mjs --max-warnings 0
node_modules/.bin/prettier --check game/couch/coop-picture-bindings.mjs game/test/coop-picture-bindings.test.mjs game/test/coop-historical-import-picture.test.mjs game/test/coop-actor-presentation.test.mjs
```

This review performed no native browser operation, actual image decoding, music listening, physical-device test, offline cold start or public deployment check. Finite test decoders and source/byte preservation do not provide new artwork, soundtrack, visual or release approval. Other agents' host/browser checks have separate receipts.
