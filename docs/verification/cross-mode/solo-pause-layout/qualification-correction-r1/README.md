# P03 Pause qualification correction r1

Immutable source `58643e0c03aab013f805b9bd01574d8a57dc87fe` (tree `53a4dddae7b16456e7752ffc2315b231e581d5e8`, allocated version `0.61.24`, production `field-kit@32`) contains an intentional `Scoped P03 Pause source review` declaration but a stale `Scoped P03 source review` expectation in `game/test/presentation-production-history.test.mjs:433`. The retained patch changes only that exact screen label. The P08-A motion branch, both source fingerprints, reviewed-stage assertions and 14-recipe coverage remain unchanged. No runtime, generator, production ledger or version change belongs to this correction.

The exact originals are retained in [originals.zip](originals.zip), with every member, source identity, original location, size and SHA-256 listed in [originals-index.json](originals-index.json). The ZIP has 23 explicitly selected members; extraction/CRC and every extracted byte were compared with the retained originals. Its fixed container timestamp is not an observation timestamp.

| Hosted family | Run / attempt | Failed job | Status when collected |
| --- | --- | --- | --- |
| PR source | 35400495848 / 1 | 105779423724, test (3) | Job completed with failure; whole family incomplete |
| Manual source | 35400661221 / 1 | 105779983355, test (3) | Job completed with failure; whole family incomplete |

Both original logs show the same single failed assertion, `screen.missions.background`, at line 430 of the affected test. The PR job’s final tracked-source check passed. The manual job’s final tracked-source check was **skipped** after its test failure. The original job metadata, compressed log and collection receipt remain exact for each family. These are failure-diagnosis records collected before whole-family completion; they do not qualify `58643e0`, assert a terminal whole-family result, or overwrite later terminal evidence.

The separately retained local checks used Node 20.19.5 and the same immutable source dependencies. The original targeted assertion failed (one failure, ten skipped); the one-line correction passed (one pass, ten skipped); the complete affected file passed **11/11 tests, zero failures or skips**. Its three stdout/stderr/result groups, runner, patch and identity records are original bytes from the sealed local packet, not rerun results. The 214 present runtime/compiled/ledger/generator/version bodies matched the immutable source before the checks and remained unchanged afterward; 45 pre-existing sparse omissions stayed absent. That local preservation check is separate from each hosted job’s source check.

Only necessary evidence is retained. Disposable cache harnesses and symlinks, duplicated source/fixture bodies, temporary state, duplicate summaries, unrelated candidate files and other artifact bodies are excluded. Existing originals contain their original diagnostic paths; they were not reformatted or redacted. The full pre-existing sealed packet remains intact in cache, identified by ready SHA-256 `32348f12a4b03af3b3dbacfb9d188d09b3278de0e11c6d79dc1c95207ecc0ad1`.

The correction commit and its qualification identities are deliberately unbound in this index. Root retains each old family’s final originals separately and runs full qualification on the new evidence-complete source. Neither these focused passes nor archive/native work qualifies the failed source, a future correction commit, a public release, or the parent phase.
