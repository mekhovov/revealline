# Exact Field Kit revision 62 retention

Revision 62 is an explicit immutable compiler input, alongside retained revisions 54, 58 and 60. Its original `game/presentation/compiled/runtime.json` bytes come from commit `2e64c130d219dfece5134ba9119b85a5bf34904d`, an ancestor of accepted baseline `a4b4de89065b519bca13bb991319f2daee0fa73d`.

- SHA-256: `b4a7285520550e4cd04c7b9e80b4c6468c0a914faac77c05fa7f86a72c8a3c8f`.
- Size: 1,094,096 bytes.
- Source: `field-kit` revision 62; theme: `fpv` revision 62; collection: null.
- Authoring input: `authoring/library/fpv-field-kit/retained/runtime.b4a7285520550e4cd04c7b9e80b4c6468c0a914faac77c05fa7f86a72c8a3c8f.json`.

`readFieldKitRetainedOutput` validates the original byte count, hash and identities before including the manifest. It inventories and verifies every transitive image, font and lazy picture/audio dependency against the existing production asset map. Missing or changed bytes fail the build; neither the current output directory nor a saved pin supplies replacements. No image or audio originals are duplicated.

The normal production compiler retains this manifest at the matching hash-named runtime path, with its dependencies in the compiler ownership manifest. A later ledger or formatter revision cannot silently replace these bytes. The checked-in current runtime, Studio document, CSS and asset bytes are unchanged; only the retained runtime alias and ownership entry are added to compiled output.

Focused verification covers all four immutable inputs, exact dependency hashes, changed/truncated revision-62 input, deterministic regeneration, and retention when current formatting changes. These are byte/provenance checks, not browser decoding, visual quality, source approval for additional content, complete offline recovery or public deployment evidence. Actor-only compatibility remains the separate actor-release registry's responsibility.
