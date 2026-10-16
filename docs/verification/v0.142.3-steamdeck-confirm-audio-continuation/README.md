# Steam Deck v0.142.3 audio provenance continuation

This record continues the eight existing procedural audio approvals for the exact source at `afb19ebd06db336d32dfe4660c43aa0f6711dca5`. Against published v0.142.2 source `a5859df784314556072f9215f9b293962e4f2ea4`, only `game/app.mjs` changes among the 28 audio inputs. The diff concerns Confirm coordination and diagnostics. Audio implementation, routing, recipes and payloads are unchanged.

The ordered audio fingerprint changes from `d9650ffde4c938064703de7c1e8ec987ac1efc1b6470ebcad4ca4ab459a32018` to `39fe40240f0475e471a52772060899d3e329e4d54d6b2bb6679e76dc745ee9a4`. The input closure grows by 711 bytes to 1,074,390 bytes. Every non-audio fingerprint is unchanged.

`review.json` binds all 28 current source blobs, the previous correction review, and the independent production99 oracle at `game/test/fixtures/production-v01422-a585-fpv99.json`. The producer fails closed when any pinned review or oracle byte changes.

## Generation

The existing `node scripts/produce-field-kit-theme.mjs --write` command produced revision100, and `--check` reproduced it.

- Eight audio52 successors retain their corresponding audio51 parents and all prior evidence. The new fpv100 theme inherits fpv99.
- The 2,598 prior assets and 100 prior themes remain exact prefixes; the result has 2,606 assets and 101 themes.
- All 132 payloads remain unchanged, totaling 4,009,342 bytes. Non-audio resolved assets are unchanged.
- Compiled output contains 140 files. Only the current manifest, runtime metadata and Studio metadata change. Studio string-table indexes move as the new provenance strings are inserted; retained records resolve identically.
- Team bindings select revision100 and retain revision99 with its own exact identities. Previously unsupported revision98 remains unsupported.
- The readiness content check reports 194 required reviewed slots and 141 optional slots. The committed-readiness CLI additionally requires the exact ledger to be committed and must run after the source commit.

| Artifact                  |     Bytes | SHA-256                                                            |
| ------------------------- | --------: | ------------------------------------------------------------------ |
| Preserved production99    | 8,152,874 | `d9991c729d38dd378d9cde2d9656ed3e40e0ac9a78bd62df4979561c9500b64d` |
| Generated production100   | 8,227,540 | `3cfdf800e5794058de080edddf5a91a914ddd20098015a25a27818694478c71f` |
| Current compiled manifest |         — | `3774361e226ace53cdca425843859ba257b37b2a94907a034b459c49b00ac233` |
| Current compiled runtime  |         — | `5da47a010beb0feab986e2a24c910b5ffe985367f417cf46c5041883b1b999d6` |
| Current compiled Studio   |         — | `baaf4c56fd2847c6bbbbc6c096625cdf47425689bdd4f5de78da3ff31031208e` |

## Scope limits

This continuation establishes source provenance and append-only production preservation. It does not claim listening acceptance, frozen/public release verification or physical Steam Deck acceptance. Those remain separate release gates.
